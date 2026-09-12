"""Bounded, offline MovieLens intake. Source data never enters native Kajo storage."""
from __future__ import annotations

import argparse
import csv
import hashlib
import heapq
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
import time
from datetime import datetime, timezone
import urllib.request
import zipfile
from collections import Counter

REPO = Path(__file__).resolve().parents[2]
PLAN_PATH = REPO / "research/manifests/movielens-32m.json"
SCHEMA = "movielens-intake-v1"
SMALL_RELEASE = "ml-latest-small-2018-kaggle-v2"
KAGGLE_REF = "grouplens/movielens-latest-small"
KAGGLE_API = "https://www.kaggle.com/api/v1/datasets/"
HEADERS = {"movies.csv": ["movieId", "title", "genres"], "links.csv": ["movieId", "imdbId", "tmdbId"],
           "ratings.csv": ["userId", "movieId", "rating", "timestamp"], "tags.csv": ["userId", "movieId", "tag", "timestamp"]}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, name = tempfile.mkstemp(prefix=".json-", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(canonical(value) + "\n")
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def location(root, value):
    """Resolve symlinks before enforcing ignored, repository-local research roots."""
    allowed = REPO / root
    path = Path(value).resolve()
    if allowed.is_symlink() or path == allowed or not path.is_relative_to(allowed):
        raise ValueError(f"Use a child of ignored {root}/")
    return path


def load_plan(source="32m"):
    path = {"32m": PLAN_PATH, "small": REPO / "research/manifests/movielens-small-v2.json"}[source]
    plan = json.loads(path.read_text())
    release = "ml-32m" if source == "32m" else SMALL_RELEASE
    if plan["schemaVersion"] != SCHEMA or plan["datasetId"] != "movielens" or plan["releaseId"] != release:
        raise ValueError("Unsupported source/schema")
    if source == "small":
        expected = {"readmeUrl": KAGGLE_API + "download/" + KAGGLE_REF + "/README.md?datasetVersionNumber=2",
                    "archiveUrl": KAGGLE_API + "download/" + KAGGLE_REF + "?datasetVersionNumber=2",
                    "metadataUrl": KAGGLE_API + "view/" + KAGGLE_REF,
                    "filesUrl": KAGGLE_API + "list/" + KAGGLE_REF + "?datasetVersionNumber=2"}
        if any(plan[key] != value for key, value in expected.items()) or plan["publisherRef"] != KAGGLE_REF or plan["publisherVersion"] != 2:
            raise ValueError("Unexpected publisher/version URL")
        return plan
    for field, suffix in (("readmeUrl", "ml-32m-README.html"), ("checksumUrl", "ml-32m.zip.md5"), ("archiveUrl", "ml-32m.zip")):
        if plan[field] != "https://files.grouplens.org/datasets/movielens/" + suffix:
            raise ValueError("Unexpected publisher URL")
    return plan


def source_member(plan, name):
    if plan["releaseId"] == "ml-32m":
        return "ml-32m/" + name
    if plan["releaseId"] == SMALL_RELEASE:
        return "README.md" if name == "README.txt" else name
    raise ValueError("Unsupported source release")


def archive_name(plan):
    return "ml-32m.zip" if plan["releaseId"] == "ml-32m" else "movielens-small-v2.zip"


def fetch_small(url, limit, opener=urllib.request.urlopen):
    with opener(url, timeout=20) as response:
        content = response.read(limit + 1)
    if len(content) > limit:
        raise ValueError("Publisher metadata exceeds budget")
    return content


def prepare(plan, data_dir, opener=urllib.request.urlopen):
    """Fetch metadata only. Exact terms/checksum must be reviewed before download."""
    readme = fetch_small(plan["readmeUrl"], 64 * 1024, opener)
    if plan["releaseId"] == SMALL_RELEASE:
        metadata = fetch_small(plan["metadataUrl"], 128 * 1024, opener)
        inventory = fetch_small(plan["filesUrl"], 64 * 1024, opener)
        publisher, files = json.loads(metadata), json.loads(inventory)
        listed = files["datasetFiles"]
        if (publisher["ownerRef"] != "grouplens" or publisher["ref"] != KAGGLE_REF or publisher["id"] != 63741
                or not any(version["versionNumber"] == 2 for version in publisher["versions"])
                or files.get("nextPageToken") or len(listed) != 5
                or {file["name"]: file["totalBytes"] for file in listed}
                   != {name: value["bytes"] for name, value in plan["sourceVerification"]["files"].items()}
                or hashlib.sha256(readme).hexdigest() != plan["sourceVerification"]["readmeSha256"]):
            raise ValueError("Publisher identity, version, README or file inventory changed")
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "publisher-readme.md").write_bytes(readme)
        (data_dir / "publisher-metadata.json").write_bytes(metadata)
        (data_dir / "publisher-files.json").write_bytes(inventory)
        result = {"datasetId": plan["datasetId"], "releaseId": plan["releaseId"],
                  "retrievedAt": datetime.now(timezone.utc).isoformat(), "publisherRef": KAGGLE_REF, "version": 2,
                  "readmeSha256": hashlib.sha256(readme).hexdigest(), "publisherMd5": None,
                  "metadataSha256": hashlib.sha256(metadata).hexdigest(), "inventorySha256": hashlib.sha256(inventory).hexdigest()}
        atomic_json(data_dir / "publisher.json", result)
        return result
    checksum = fetch_small(plan["checksumUrl"], 256, opener)
    match = re.fullmatch(rb"([a-fA-F0-9]{32})\s+\*?ml-32m\.zip\s*", checksum)
    if not match:
        raise ValueError("Invalid publisher checksum document")
    data_dir.mkdir(parents=True, exist_ok=True)
    # These small snapshots are data under the ignored source directory.
    (data_dir / "publisher-readme.html").write_bytes(readme)
    (data_dir / "publisher-checksum.md5").write_bytes(checksum)
    result = {"datasetId": plan["datasetId"], "releaseId": plan["releaseId"],
              "retrievedAt": datetime.now(timezone.utc).isoformat(),
              "readmeSha256": hashlib.sha256(readme).hexdigest(), "publisherMd5": match[1].decode().lower()}
    atomic_json(data_dir / "publisher.json", result)
    return result


def approved_source(plan, data_dir):
    verification, rights = plan["sourceVerification"], plan["rights"]
    if (verification["status"] != "verified" or rights["research"] != "approved-for-noncommercial-research"
            or not rights["reviewedBy"] or not rights["reviewedAt"]
            or rights["purpose"] != "NONCOMMERCIAL_RESEARCH_ONLY"):
        raise ValueError("Exact publisher terms/checksum review is pending; run prepare and record the verified source first")
    snapshot = json.loads((data_dir / "publisher.json").read_text())
    if snapshot.get("datasetId") != plan["datasetId"] or snapshot.get("releaseId") != plan["releaseId"]:
        raise ValueError("Publisher source snapshot belongs to another release")
    if plan["releaseId"] == SMALL_RELEASE:
        if (snapshot["publisherRef"] != KAGGLE_REF or snapshot["version"] != 2
                or not re.fullmatch(r"[a-f0-9]{64}", verification["archiveSha256"])
                or snapshot["readmeSha256"] != verification["readmeSha256"]
                or digest(data_dir / "publisher-readme.md") != verification["readmeSha256"]
                or digest(data_dir / "publisher-metadata.json") != snapshot["metadataSha256"]
                or digest(data_dir / "publisher-files.json") != snapshot["inventorySha256"]):
            raise ValueError("Publisher source snapshot differs from reviewed identity")
        return snapshot
    if (not re.fullmatch(r"[a-f0-9]{64}", verification["readmeSha256"] or "")
            or not re.fullmatch(r"[a-f0-9]{32}", verification["publisherMd5"] or "")
            or snapshot["readmeSha256"] != verification["readmeSha256"]
            or snapshot["publisherMd5"] != verification["publisherMd5"]
            or digest(data_dir / "publisher-readme.html") != verification["readmeSha256"]):
        raise ValueError("Publisher source snapshot differs from reviewed identity")
    return snapshot


def archive_identity(path, plan):
    if path.stat().st_size > plan["budgets"]["maxArchiveBytes"]:
        raise ValueError("Archive exceeds byte budget")
    sha, md5 = hashlib.sha256(), hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(chunk)
            md5.update(chunk)
    verification = plan["sourceVerification"]
    if plan["releaseId"] == SMALL_RELEASE:
        if sha.hexdigest() != verification["archiveSha256"] or path.stat().st_size != verification["archiveBytes"]:
            raise ValueError("Archive does not match the pinned publisher-version bytes")
    elif md5.hexdigest() != verification["publisherMd5"]:
        raise ValueError("Archive does not match the reviewed publisher checksum")
    return {"sha256": sha.hexdigest(), "md5": md5.hexdigest(), "bytes": path.stat().st_size}


def download(plan, data_dir, opener=urllib.request.urlopen):
    approved_source(plan, data_dir)
    target = data_dir / archive_name(plan)
    if target.exists():
        return {"reused": True, **archive_identity(target, plan)}
    start = time.monotonic()
    handle, name = tempfile.mkstemp(prefix=".download-", dir=data_dir)
    temporary = Path(name)
    try:
        with os.fdopen(handle, "wb") as stream, opener(plan["archiveUrl"], timeout=20) as response:
            size = 0
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                size += len(chunk)
                if size > plan["budgets"]["maxArchiveBytes"] or time.monotonic() - start > plan["budgets"]["maxDownloadSeconds"]:
                    raise ValueError("Download budget exceeded")
                stream.write(chunk)
        identity = archive_identity(temporary, plan)
        os.replace(temporary, target)
        return {"reused": False, **identity}
    finally:
        temporary.unlink(missing_ok=True)


def inspect_archive(archive, plan):
    """Read allowlisted members directly; never extract supplied paths to disk."""
    total, found, hashes = 0, set(), {}
    members = {source_member(plan, name) for name in (*HEADERS, "README.txt")}
    readme_name = source_member(plan, "README.txt")
    for info in archive.infolist():
        if info.is_dir() and plan["releaseId"] == "ml-32m" and info.filename == "ml-32m/":
            continue
        mode = stat.S_IFMT(info.external_attr >> 16)
        if (info.filename not in members or info.filename in found or mode not in (0, stat.S_IFREG)
                or info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)):
            raise ValueError("Unexpected, duplicate or unsafe archive member")
        found.add(info.filename)
        total += info.file_size
        if total > plan["budgets"]["maxExpandedBytes"] or info.file_size > max(1, info.compress_size) * 300:
            raise ValueError("Expanded archive budget exceeded")
        if info.filename == readme_name and info.file_size > 64 * 1024:
            raise ValueError("Archive README exceeds budget")
    if found != members:
        raise ValueError("Required archive members are missing")
    for name in sorted(found):
        sha, size = hashlib.sha256(), 0
        with archive.open(name) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                size += len(chunk)
                if size > archive.getinfo(name).file_size:
                    raise ValueError("Expanded member differs from declared size")
                sha.update(chunk)
        hashes[name] = {"sha256": sha.hexdigest(), "bytes": size}
    if plan["releaseId"] == SMALL_RELEASE and hashes != plan["sourceVerification"]["files"]:
        raise ValueError("Source member bytes differ from the pinned publisher version")
    return hashes


def rows(archive, name, counts, limit, plan):
    with archive.open(source_member(plan, name)) as binary, io.TextIOWrapper(binary, encoding="utf-8-sig", newline="") as text:
        def bounded_lines():
            while True:
                line = text.readline(csv.field_size_limit() * 8 + 1)
                if len(line) > csv.field_size_limit() * 8:
                    raise ValueError("CSV physical line exceeds budget")
                if not line:
                    return
                yield line
        reader = csv.reader(bounded_lines(), strict=True)
        if next(reader, None) != HEADERS[name]:
            raise ValueError(f"Unexpected {name} header")
        for row in reader:
            if any(len(field) > csv.field_size_limit() // 4 and len(field.encode("utf-8")) > csv.field_size_limit() for field in row):
                raise ValueError("CSV field byte budget exceeded")
            counts[name] += 1
            if counts[name] > limit:
                raise ValueError(f"{name} row budget exceeded")
            yield reader.line_num, row


def positive_id(value):
    if len(value) > 16 or not re.fullmatch(r"[1-9][0-9]*", value) or int(value) > 9007199254740991:
        raise ValueError("invalid-id")
    return value


def timestamp(value):
    if len(value) > 13 or not re.fullmatch(r"0|[1-9][0-9]*", value) or int(value) > 9007199254740:
        raise ValueError("invalid-timestamp")
    return int(value)


def alias(value, provider):
    if not value:
        return None
    if len(value) > 16 or not re.fullmatch(r"[0-9]+", value) or not 0 < int(value) <= 9007199254740991:
        raise ValueError("invalid-alias")
    return "imdb:tt" + value.zfill(7) if provider == "imdb" else "tmdb:movie:" + str(int(value))


def verify_completed(path):
    result = json.loads((path / "manifest.json").read_text())
    if result["runId"] != path.name or set(result["outputFiles"]) != {"ratings.jsonl", "objects.jsonl", "subjects.jsonl", "quarantine.jsonl"}:
        raise ValueError("Existing normalized checkpoint identity is invalid")
    for name, expected in result["outputFiles"].items():
        if name not in ("ratings.jsonl", "objects.jsonl", "subjects.jsonl", "quarantine.jsonl") or digest(path / name) != expected["sha256"]:
            raise ValueError("Existing normalized output failed integrity check")
    return result


def normalize_archive(path, output_root, plan):
    identity = archive_identity(path, plan)
    code_hash = digest(Path(__file__))
    run_id = hashlib.sha256(canonical({"source": identity, "plan": plan, "codeSha256": code_hash}).encode()).hexdigest()
    completed = output_root / run_id
    if completed.exists():
        result = verify_completed(completed)
        if result["archive"] != identity or result["normalizerCodeSha256"] != code_hash or result["planSha256"] != hashlib.sha256(canonical(plan).encode()).hexdigest():
            raise ValueError("Existing normalized checkpoint lineage differs")
        return completed, result, True
    output_root.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".normalize-", dir=output_root))
    counts, reasons = Counter(), Counter()
    csv.field_size_limit(plan["budgets"]["maxCsvFieldBytes"])
    budgets = plan["budgets"]
    try:
        with zipfile.ZipFile(path) as archive, (work / "quarantine.jsonl").open("w", encoding="utf-8") as quarantine:
            hashes = inspect_archive(archive, plan)

            def reject(file, line, reason, row):
                reasons[reason] += 1
                if sum(reasons.values()) > budgets["maxQuarantineRows"]:
                    raise ValueError("Quarantine budget exceeded")
                quarantine.write(canonical({"file": file, "line": line, "reason": reason, "record": row}) + "\n")

            movies, movie_lines, blocked_movies = {}, {}, set()
            for line, row in rows(archive, "movies.csv", counts, budgets["maxMovies"], plan):
                try:
                    if len(row) != 3:
                        raise ValueError("column-count")
                    movie_id = positive_id(row[0])
                    if not row[1]:
                        raise ValueError("missing-title")
                    value = {"movieId": movie_id, "title": row[1], "genres": row[2].split("|") if row[2] != "(no genres listed)" else [],
                             "aliases": {"imdb": None, "tmdb": None}, "metadataAvailableAt": None, "metadataUse": "static-release-only"}
                    if movie_id in blocked_movies:
                        raise ValueError("conflicting-movie-id")
                    if movie_id in movies:
                        if movies[movie_id] != value:
                            reject("movies.csv", movie_lines[movie_id], "conflicting-movie-id", movies[movie_id])
                            del movies[movie_id]
                            blocked_movies.add(movie_id)
                            raise ValueError("conflicting-movie-id")
                        raise ValueError("duplicate-movie-id")
                    movies[movie_id] = value
                    movie_lines[movie_id] = line
                except ValueError as error:
                    reject("movies.csv", line, str(error), row)

            links, link_lines, blocked_links, aliases, conflicting_aliases = {}, {}, set(), {}, set()
            for line, row in rows(archive, "links.csv", counts, budgets["maxMovies"], plan):
                try:
                    if len(row) != 3:
                        raise ValueError("column-count")
                    movie_id = positive_id(row[0])
                    if movie_id not in movies:
                        raise ValueError("unknown-movie")
                    mapping = {"imdb": alias(row[1], "imdb"), "tmdb": alias(row[2], "tmdb")}
                    if movie_id in blocked_links:
                        raise ValueError("conflicting-link-id")
                    if movie_id in links:
                        if links[movie_id] != mapping:
                            reject("links.csv", link_lines[movie_id], "conflicting-link-id", {"movieId": movie_id, "aliases": links[movie_id]})
                            del links[movie_id]
                            blocked_links.add(movie_id)
                            raise ValueError("conflicting-link-id")
                        raise ValueError("duplicate-link-id")
                    links[movie_id] = mapping
                    link_lines[movie_id] = line
                except ValueError as error:
                    reject("links.csv", line, str(error), row)
            for movie_id, mapping in links.items():
                for value in mapping.values():
                    if value is not None:
                        if value in aliases and aliases[value] != movie_id:
                            conflicting_aliases.add(value)
                        aliases[value] = movie_id
            for movie_id, mapping in links.items():
                for provider, value in mapping.items():
                    if value in conflicting_aliases:
                        reject("links.csv", link_lines[movie_id], "conflicting-alias", {"movieId": movie_id, "alias": value})
                    else:
                        movies[movie_id]["aliases"][provider] = value

            heap, subject_ids = [], set()
            retained_count, valid_count, eligible_subjects, minimum, maximum = 0, 0, 0, None, None
            current_user, current_rows, source_order = None, [], None

            def finish_subject(user_id, entries):
                nonlocal retained_count, valid_count, eligible_subjects
                if user_id is None:
                    return
                pairs, blocked = {}, set()
                for line, row in entries:
                    movie_id = row["movieId"]
                    if movie_id in blocked:
                        reject("ratings.csv", line, "conflicting-rating-pair", row)
                    elif movie_id in pairs:
                        prior_line, prior = pairs[movie_id]
                        if prior == row:
                            reject("ratings.csv", line, "identical-rating-duplicate", row)
                        else:
                            reject("ratings.csv", prior_line, "conflicting-rating-pair", prior)
                            reject("ratings.csv", line, "conflicting-rating-pair", row)
                            del pairs[movie_id]
                            blocked.add(movie_id)
                    else:
                        pairs[movie_id] = (line, row)
                history = [row for _, row in pairs.values()]
                valid_count += len(history)
                if len(history) < plan["cohort"]["minimumSourceRatings"]:
                    return
                eligible_subjects += 1
                rank = int(hashlib.sha256(f"movielens:{plan['releaseId']}:{plan['cohort']['seed']}:{user_id}".encode()).hexdigest(), 16)
                candidate = (-rank, -int(user_id), history)
                if len(heap) < plan["cohort"]["size"]:
                    heapq.heappush(heap, candidate)
                    retained_count += len(history)
                elif (rank, int(user_id)) < (-heap[0][0], -heap[0][1]):
                    removed = heapq.heapreplace(heap, candidate)
                    retained_count += len(history) - len(removed[2])
                if retained_count > budgets["maxCohortRatings"]:
                    raise ValueError("Complete cohort histories exceed budget; do not truncate them")

            for line, row in rows(archive, "ratings.csv", counts, budgets["maxRows"], plan):
                try:
                    if len(row) != 4:
                        raise ValueError("column-count")
                    user_id, movie_id = positive_id(row[0]), positive_id(row[1])
                    subject_ids.add(user_id)
                    if len(subject_ids) > budgets["maxSubjects"]:
                        raise RuntimeError("Subject budget exceeded")
                    if source_order is not None and int(user_id) < source_order:
                        raise RuntimeError("Source user grouping/order changed; cannot prove complete histories")
                    source_order = int(user_id)
                    if movie_id not in movies:
                        raise ValueError("unknown-movie")
                    try:
                        rating = float(row[2])
                    except ValueError:
                        raise ValueError("invalid-rating") from None
                    if not math.isfinite(rating) or not 0.5 <= rating <= 5 or not (rating * 2).is_integer():
                        raise ValueError("invalid-rating")
                    at = timestamp(row[3])
                except ValueError as error:
                    reject("ratings.csv", line, str(error), row)
                    continue
                if current_user != user_id:
                    finish_subject(current_user, current_rows)
                    current_user, current_rows = user_id, []
                current_rows.append((line, {"userId": user_id, "movieId": movie_id, "rating": rating, "timestamp": at}))
                if len(current_rows) > budgets["maxRatingsPerSubject"]:
                    raise ValueError("Per-subject history budget exceeded")
                minimum = at if minimum is None else min(minimum, at)
                maximum = at if maximum is None else max(maximum, at)
            finish_subject(current_user, current_rows)

            for line, row in rows(archive, "tags.csv", counts, budgets["maxRows"], plan):
                try:
                    if len(row) != 4:
                        raise ValueError("column-count")
                    if positive_id(row[0]) not in subject_ids or positive_id(row[1]) not in movies:
                        raise ValueError("unknown-tag-reference")
                    timestamp(row[3])
                except ValueError as error:
                    reject("tags.csv", line, str(error), row)

        observed = {"ratings": counts["ratings.csv"], "subjects": len(subject_ids), "movies": counts["movies.csv"], "tags": counts["tags.csv"]}
        if observed != plan["expectedCounts"]:
            raise ValueError("Observed release counts differ from the pinned source manifest")
        if len(heap) != plan["cohort"]["size"]:
            raise ValueError("Insufficient eligible subjects for the complete requested cohort")
        histories = sorted((str(-user), history) for _, user, history in heap)
        ratings = sorted((row for _, history in histories for row in history),
                         key=lambda row: (row["timestamp"], int(row["userId"]), int(row["movieId"])))
        write_sets = {
            "ratings.jsonl": ratings,
            "objects.jsonl": (movies[key] for key in sorted(movies, key=int)),
            "subjects.jsonl": ({"userId": user, "subjectRef": f"movielens:{plan['releaseId']}:subject:{user}", "ratingCount": len(history)} for user, history in histories),
        }
        for name, entries in write_sets.items():
            with (work / name).open("w", encoding="utf-8") as stream:
                for entry in entries:
                    stream.write(canonical(entry) + "\n")
        result = {"schemaVersion": SCHEMA, "runId": run_id,
                  "source": {"datasetId": "movielens", "releaseId": plan["releaseId"], "archiveSha256": identity["sha256"],
                             "purpose": "NONCOMMERCIAL_RESEARCH_ONLY"},
                  "archive": identity, "sourceFiles": hashes, "planSha256": hashlib.sha256(canonical(plan).encode()).hexdigest(),
                  "normalizerCodeSha256": code_hash, "pythonVersion": sys.version.split()[0], "sourceCounts": observed,
                  "validUniqueRatings": valid_count, "eligibleSubjects": eligible_subjects, "quarantine": dict(sorted(reasons.items())),
                  "cohort": {"subjects": len(histories), "ratings": len(ratings), "seed": plan["cohort"]["seed"],
                             "subjectsSha256": hashlib.sha256(canonical([user for user, _ in histories]).encode()).hexdigest(),
                             "minimumHistory": min(len(history) for _, history in histories), "maximumHistory": max(len(history) for _, history in histories)},
                  "sourceTimestampRange": {"min": minimum, "max": maximum}, "semantics": plan["semantics"],
                  "mapping": {"objects": len(movies), "missingImdb": sum(m["aliases"]["imdb"] is None for m in movies.values()),
                              "missingTmdb": sum(m["aliases"]["tmdb"] is None for m in movies.values()),
                              "conflictingAliases": len(conflicting_aliases), "kajoIntersection": "not-queried"},
                  "outputFiles": {name: {"sha256": digest(work / name), "bytes": (work / name).stat().st_size}
                                  for name in ("ratings.jsonl", "objects.jsonl", "subjects.jsonl", "quarantine.jsonl")}}
        atomic_json(work / "manifest.json", result)
        try:
            os.rename(work, completed)
        except FileExistsError:
            if verify_completed(completed) != result:
                raise ValueError("Concurrent normalized result differs")
        return completed, result, False
    finally:
        if work.exists():
            shutil.rmtree(work)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("prepare", "download", "normalize"))
    parser.add_argument("--source", choices=("small", "32m"), default="small")
    parser.add_argument("--data-dir")
    parser.add_argument("--output-dir")
    args = parser.parse_args()
    plan = load_plan(args.source)
    folder = "movielens-small" if args.source == "small" else "movielens-32m"
    data_dir = location("research-data", args.data_dir or REPO / "research-data" / folder)
    if args.stage == "prepare":
        result = prepare(plan, data_dir)
    elif args.stage == "download":
        result = download(plan, data_dir)
    else:
        approved_source(plan, data_dir)
        output_dir = location("research-artifacts", args.output_dir or REPO / "research-artifacts" / folder)
        path, result, reused = normalize_archive(data_dir / archive_name(plan), output_dir, plan)
        result = {"path": str(path), "reused": reused, "manifest": result}
    print(canonical(result))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, csv.Error, zipfile.BadZipFile, KeyError) as error:
        print(f"MovieLens intake stopped: {error}", file=sys.stderr)
        raise SystemExit(1) from error
