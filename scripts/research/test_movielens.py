"""Artificial archives test intake contracts, never stand in for the real cohort."""
import copy
import csv
import hashlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
from unittest.mock import patch
import zipfile

import movielens as ml


def fixture(directory, *, source="32m", users=8, movies=None, links=None, ratings=None, tags=None, overrides=None):
    plan = ml.load_plan(source)
    movies = movies if movies is not None else [["1", 'Example, "quoted"\nfilm', "Drama|Comedy"], ["2", "Second", "(no genres listed)"]]
    links = links if links is not None else [["1", "0000012", "15"], ["2", "0000013", ""]]
    ratings = ratings if ratings is not None else [[str(user), str(movie), str(0.5 * (user % 10 + 1)), str(100 + user + (3 - movie) * 10)]
                                                for user in range(1, users + 1) for movie in (1, 2)]
    tags = tags if tags is not None else [["1", "1", "fixture-only", "130"]]
    content = {}
    for name, entries in (("movies.csv", movies), ("links.csv", links), ("ratings.csv", ratings), ("tags.csv", tags)):
        stream = io.StringIO(newline="")
        writer = csv.writer(stream)
        writer.writerow(ml.HEADERS[name])
        writer.writerows(entries)
        content[ml.source_member(plan, name)] = stream.getvalue()
    content[ml.source_member(plan, "README.txt")] = "Artificial test archive; not MovieLens source evidence."
    if overrides:
        content.update(overrides)
    path = Path(directory) / "fixture.zip"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in content.items():
            archive.writestr(name, text)
    plan["sourceVerification"]["publisherMd5"] = hashlib.md5(path.read_bytes(), usedforsecurity=False).hexdigest()
    if source == "small":
        files = {name: {"sha256": hashlib.sha256(value.encode()).hexdigest(), "bytes": len(value.encode())} for name, value in content.items()}
        plan["sourceVerification"].update(archiveSha256=ml.digest(path), archiveBytes=path.stat().st_size,
                                         files=files, readmeSha256=files["README.md"]["sha256"], publisherMd5=None)
    plan["expectedCounts"] = {"ratings": len(ratings), "subjects": len({row[0] for row in ratings}), "movies": len(movies), "tags": len(tags)}
    plan["cohort"].update(size=min(3, users), minimumSourceRatings=1)
    return path, plan


class MovieLensIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def run_fixture(self, **kwargs):
        archive, plan = fixture(self.root, **kwargs)
        path, report, reused = ml.normalize_archive(archive, self.root / "output", plan)
        return path, report, archive, plan, reused

    def small_metadata(self, plan):
        return {"ownerRef": "grouplens", "ref": ml.KAGGLE_REF, "id": 63741, "versions": [{"versionNumber": 2}]}, {
            "datasetFiles": [{"name": name, "totalBytes": info["bytes"]} for name, info in plan["sourceVerification"]["files"].items()]}

    def test_small_version_uses_its_own_namespace_complete_histories_and_byte_identical_replay(self):
        path, report, archive, plan, _ = self.run_fixture(source="small")
        self.assertEqual(report["source"]["releaseId"], ml.SMALL_RELEASE)
        subjects = [json.loads(line) for line in (path / "subjects.jsonl").read_text().splitlines()]
        self.assertTrue(all(row["subjectRef"].startswith("movielens:" + ml.SMALL_RELEASE + ":subject:") for row in subjects))
        expected = sorted(range(1, 9), key=lambda user: hashlib.sha256(f"movielens:{ml.SMALL_RELEASE}:{plan['cohort']['seed']}:{user}".encode()).hexdigest())[:3]
        self.assertEqual({row["userId"] for row in subjects}, {str(user) for user in expected})
        self.assertTrue(all(row["ratingCount"] == 2 for row in subjects))
        _, repeated, reused = ml.normalize_archive(archive, self.root / "independent", plan)
        self.assertFalse(reused)
        self.assertEqual(report, repeated)

    def test_small_prepare_checks_publisher_version_inventory_and_terms_before_writing(self):
        archive, plan = fixture(self.root, source="small")
        with zipfile.ZipFile(archive) as zipped: readme = zipped.read("README.md")
        for kind in ("owner", "version", "inventory", "duplicate", "terms", "pagination", "valid"):
            publisher, inventory = self.small_metadata(plan)
            terms = readme
            if kind == "owner": publisher["ownerRef"] = "another-uploader"
            if kind == "version": publisher["versions"] = [{"versionNumber": 3}]
            if kind == "inventory": inventory["datasetFiles"][0]["totalBytes"] += 1
            if kind == "duplicate": inventory["datasetFiles"].append(inventory["datasetFiles"][0])
            if kind == "terms": terms += b"changed"
            if kind == "pagination": inventory["nextPageToken"] = "more"
            replies = {plan["readmeUrl"]: terms, plan["metadataUrl"]: json.dumps(publisher).encode(), plan["filesUrl"]: json.dumps(inventory).encode()}
            opener = lambda url, timeout: io.BytesIO(replies[url])
            data = self.root / kind
            if kind == "valid":
                snapshot = ml.prepare(plan, data, opener)
                self.assertEqual(ml.approved_source(plan, data), snapshot)
                self.assertIsNone(snapshot["publisherMd5"])
            else:
                with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "Publisher"):
                    ml.prepare(plan, data, opener)
                self.assertFalse(data.exists())

    def test_small_download_and_normalization_verify_archive_and_member_hashes(self):
        archive, plan = fixture(self.root, source="small")
        publisher, inventory = self.small_metadata(plan)
        with zipfile.ZipFile(archive) as zipped: readme = zipped.read("README.md")
        replies = {plan["readmeUrl"]: readme, plan["metadataUrl"]: json.dumps(publisher).encode(),
                   plan["filesUrl"]: json.dumps(inventory).encode(), plan["archiveUrl"]: archive.read_bytes()}
        opener = lambda url, timeout: io.BytesIO(replies[url])
        data = self.root / "source"
        ml.prepare(plan, data, opener)
        downloaded = ml.download(plan, data, opener)
        self.assertFalse(downloaded["reused"])
        self.assertTrue(ml.download(plan, data, opener)["reused"])
        bad_member = copy.deepcopy(plan)
        bad_member["sourceVerification"]["files"]["ratings.csv"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Source member bytes"):
            ml.normalize_archive(archive, self.root / "bad-member", bad_member)
        with archive.open("ab") as stream: stream.write(b"changed")
        with self.assertRaisesRegex(ValueError, "pinned publisher-version bytes"):
            ml.archive_identity(archive, plan)
        pending = copy.deepcopy(plan)
        pending["rights"]["research"] = "pending-exact-source-review"
        with self.assertRaisesRegex(ValueError, "review is pending"):
            ml.download(pending, data, opener)

    def test_source_snapshot_release_and_metadata_integrity_are_checked(self):
        archive, plan = fixture(self.root, source="small")
        publisher, inventory = self.small_metadata(plan)
        with zipfile.ZipFile(archive) as zipped: readme = zipped.read("README.md")
        replies = {plan["readmeUrl"]: readme, plan["metadataUrl"]: json.dumps(publisher).encode(), plan["filesUrl"]: json.dumps(inventory).encode()}
        data = self.root / "source"
        snapshot = ml.prepare(plan, data, lambda url, timeout: io.BytesIO(replies[url]))
        other = {**snapshot, "releaseId": "ml-32m"}
        ml.atomic_json(data / "publisher.json", other)
        with self.assertRaisesRegex(ValueError, "another release"):
            ml.approved_source(plan, data)
        ml.atomic_json(data / "publisher.json", snapshot)
        (data / "publisher-metadata.json").write_text("changed")
        with self.assertRaisesRegex(ValueError, "reviewed identity"):
            ml.approved_source(plan, data)

    def test_streams_quoted_metadata_and_keeps_complete_seeded_histories(self):
        path, report, *_ = self.run_fixture()
        objects = [json.loads(line) for line in (path / "objects.jsonl").read_text().splitlines()]
        self.assertEqual(objects[0]["title"], 'Example, "quoted"\nfilm')
        self.assertEqual(objects[0]["aliases"]["imdb"], "imdb:tt0000012")
        self.assertIsNone(objects[1]["aliases"]["tmdb"])
        self.assertIsNone(objects[0]["metadataAvailableAt"])
        subjects = [json.loads(line) for line in (path / "subjects.jsonl").read_text().splitlines()]
        expected = sorted(range(1, 9), key=lambda user: hashlib.sha256(f"movielens:ml-32m:kajo-d1-ml32-v1:{user}".encode()).hexdigest())[:3]
        self.assertEqual({row["userId"] for row in subjects}, {str(user) for user in expected})
        self.assertNotEqual({row["userId"] for row in subjects}, {"1", "2", "3"})
        self.assertEqual(report["cohort"]["ratings"], 6)
        self.assertTrue(all(row["ratingCount"] == 2 for row in subjects))
        ratings = [json.loads(line) for line in (path / "ratings.jsonl").read_text().splitlines()]
        self.assertEqual(ratings, sorted(ratings, key=lambda row: (row["timestamp"], int(row["userId"]), int(row["movieId"]))))

    def test_repeats_byte_identically_and_reuses_only_verified_completion(self):
        path, report, archive, plan, _ = self.run_fixture()
        _, repeated, reused = ml.normalize_archive(archive, self.root / "output", plan)
        self.assertTrue(reused)
        self.assertEqual(report, repeated)
        independent, result, reused = ml.normalize_archive(archive, self.root / "other", plan)
        self.assertFalse(reused)
        self.assertEqual(report, result)
        self.assertEqual((path / "ratings.jsonl").read_bytes(), (independent / "ratings.jsonl").read_bytes())
        (path / "ratings.jsonl").write_text("corrupted")
        with self.assertRaisesRegex(ValueError, "integrity"):
            ml.normalize_archive(archive, self.root / "output", plan)

    def test_conflicting_ratings_are_all_quarantined_and_identical_duplicates_count_once(self):
        ratings = [["1", "1", "1.5", "100"], ["1", "1", "1.5", "100"], ["1", "2", "2", "110"],
                   ["1", "2", "4", "120"], ["2", "1", "3", "110"], ["3", "2", "4.5", "120"]]
        path, report, *_ = self.run_fixture(users=3, ratings=ratings)
        self.assertEqual(report["quarantine"], {"conflicting-rating-pair": 2, "identical-rating-duplicate": 1})
        self.assertEqual(report["cohort"]["ratings"], 3)
        rows = [json.loads(line) for line in (path / "ratings.jsonl").read_text().splitlines()]
        self.assertFalse(any(row["userId"] == "1" and row["movieId"] == "2" for row in rows))

    def test_invalid_scale_ids_references_and_timestamps_are_counted(self):
        ratings = [["1", "1", "0.5", "100"], ["1", "2", "nan", "110"], ["1", "2", "0", "110"],
                   ["1", "2", "1.3", "110"], ["1", "2", "5.5", "110"], ["1", "99", "1", "110"],
                   ["1", "2", "4", "-1"], ["1", "0", "4", "110"]]
        _, report, *_ = self.run_fixture(users=1, ratings=ratings)
        self.assertEqual(report["quarantine"]["invalid-rating"], 4)
        self.assertEqual(report["quarantine"]["unknown-movie"], 1)
        self.assertEqual(report["quarantine"]["invalid-timestamp"], 1)
        self.assertEqual(report["quarantine"]["invalid-id"], 1)
        self.assertEqual(report["cohort"]["ratings"], 1)

    def test_alias_conflicts_remove_both_mappings_without_merging_movies(self):
        path, report, *_ = self.run_fixture(links=[["1", "0000012", "15"], ["2", "0000012", "15"]])
        self.assertEqual(report["mapping"]["objects"], 2)
        self.assertEqual(report["mapping"]["conflictingAliases"], 2)
        self.assertEqual(report["mapping"]["missingImdb"], 2)
        self.assertEqual(report["quarantine"]["conflicting-alias"], 4)
        self.assertTrue(all(json.loads(line)["aliases"] == {"imdb": None, "tmdb": None}
                            for line in (path / "objects.jsonl").read_text().splitlines()))

    def test_source_user_reordering_cannot_silently_truncate_history(self):
        archive, plan = fixture(self.root, users=2, ratings=[["2", "1", "3", "100"], ["1", "1", "4", "110"]])
        with self.assertRaisesRegex(RuntimeError, "grouping/order"):
            ml.normalize_archive(archive, self.root / "output", plan)
        self.assertEqual(list((self.root / "output").iterdir()), [])

    def test_headers_and_invalid_csv_quoting_fail_before_completion(self):
        for text in ['movieId,userId,rating,timestamp\n1,1,5,100\n', 'userId,movieId,rating,timestamp\n1,1,"5,100\n']:
            archive, plan = fixture(self.root, overrides={"ml-32m/ratings.csv": text})
            with self.assertRaises((ValueError, csv.Error)):
                ml.normalize_archive(archive, self.root / "output", plan)
            self.assertEqual(list((self.root / "output").iterdir()), [])

    def test_archive_traversal_symlinks_duplicate_names_and_unknown_files_are_rejected(self):
        for name in ["../../outside.txt", "/absolute", "ml-32m/extra.csv", "ml-32m/movies.csv"]:
            archive, plan = fixture(self.root)
            with warnings.catch_warnings(), zipfile.ZipFile(archive, "a") as container:
                warnings.simplefilter("ignore", UserWarning)
                container.writestr(name, "invalid")
            plan["sourceVerification"]["publisherMd5"] = hashlib.md5(archive.read_bytes(), usedforsecurity=False).hexdigest()
            with self.assertRaisesRegex(ValueError, "unsafe archive"):
                ml.normalize_archive(archive, self.root / "output", plan)
        archive, plan = fixture(self.root)
        with zipfile.ZipFile(archive) as source:
            content = {name: source.read(name) for name in source.namelist()}
        with zipfile.ZipFile(archive, "w") as target:
            for name, data in content.items():
                entry = zipfile.ZipInfo(name)
                entry.external_attr = ((stat.S_IFLNK if name.endswith("ratings.csv") else stat.S_IFREG) | 0o600) << 16
                target.writestr(entry, data)
        plan["sourceVerification"]["publisherMd5"] = hashlib.md5(archive.read_bytes(), usedforsecurity=False).hexdigest()
        with self.assertRaisesRegex(ValueError, "unsafe archive"):
            ml.normalize_archive(archive, self.root / "output", plan)

    def test_checksum_counts_and_resource_bounds_fail_closed(self):
        archive, plan = fixture(self.root)
        variants = []
        changed = copy.deepcopy(plan); changed["sourceVerification"]["publisherMd5"] = "0" * 32; variants.append(changed)
        changed = copy.deepcopy(plan); changed["expectedCounts"]["ratings"] += 1; variants.append(changed)
        for key in ["maxArchiveBytes", "maxExpandedBytes", "maxRows", "maxSubjects", "maxMovies", "maxRatingsPerSubject", "maxCohortRatings"]:
            changed = copy.deepcopy(plan); changed["budgets"][key] = 1; variants.append(changed)
        for variant in variants:
            with self.assertRaises((ValueError, RuntimeError)):
                ml.normalize_archive(archive, self.root / "output", variant)
        self.assertEqual(list((self.root / "output").iterdir()), [])

    def test_prepare_reads_only_small_metadata_and_does_not_approve_unknown_terms(self):
        plan = ml.load_plan()
        class Response(io.BytesIO):
            pass
        calls = []
        def opener(url, timeout):
            calls.append(url)
            return Response(b"fixture terms" if url == plan["readmeUrl"] else b"a" * 32 + b"  ml-32m.zip\n")
        snapshot = ml.prepare(plan, self.root, opener)
        self.assertEqual(len(calls), 2)
        self.assertNotIn(plan["archiveUrl"], calls)
        self.assertEqual(snapshot["readmeSha256"], hashlib.sha256(b"fixture terms").hexdigest())
        with self.assertRaisesRegex(ValueError, "pending"):
            ml.download(plan, self.root, opener)
        self.assertEqual(len(calls), 2)

    def test_download_integrity_and_atomic_retry(self):
        archive, plan = fixture(self.root)
        data = archive.read_bytes()
        plan["sourceVerification"].update(status="verified", readmeSha256=hashlib.sha256(b"fixture terms").hexdigest())
        plan["rights"].update(research="approved-for-noncommercial-research", reviewedBy="test-fixture", reviewedAt="fixture-time")
        (self.root / "publisher-readme.html").write_bytes(b"fixture terms")
        ml.atomic_json(self.root / "publisher.json", {"datasetId": "movielens", "releaseId": "ml-32m", "readmeSha256": plan["sourceVerification"]["readmeSha256"], "publisherMd5": plan["sourceVerification"]["publisherMd5"]})
        with self.assertRaisesRegex(ValueError, "checksum"):
            ml.download(plan, self.root, lambda *a, **kw: io.BytesIO(b"corrupt"))
        self.assertFalse((self.root / "ml-32m.zip").exists())
        self.assertEqual(list(self.root.glob(".download-*")), [])
        result = ml.download(plan, self.root, lambda *a, **kw: io.BytesIO(data))
        self.assertFalse(result["reused"])
        self.assertTrue(ml.download(plan, self.root, lambda *a, **kw: self.fail("retry should not download"))["reused"])

    def test_ignored_storage_guard_rejects_symlink_escape(self):
        with patch.object(ml, "REPO", self.root):
            (self.root / "research-data").mkdir()
            outside = self.root / "other"
            outside.mkdir()
            (self.root / "research-data" / "escape").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "ignored"):
                ml.location("research-data", self.root / "research-data/escape/source")
            self.assertEqual(ml.location("research-data", self.root / "research-data/source"), self.root / "research-data/source")

    def test_conflicting_metadata_quarantines_both_source_records(self):
        _, report, *_ = self.run_fixture(users=1, movies=[["1", "First", "Drama"], ["1", "Conflicting", "Comedy"], ["2", "Valid", "Drama"]],
                                         links=[["2", "0000012", "15"], ["2", "0000013", "16"]],
                                         ratings=[["1", "2", "4", "100"]], tags=[])
        self.assertEqual(report["quarantine"]["conflicting-movie-id"], 2)
        self.assertEqual(report["quarantine"]["conflicting-link-id"], 2)
        self.assertEqual(report["mapping"]["objects"], 1)
        self.assertEqual(report["mapping"]["missingImdb"], 1)

    def test_csv_line_and_utf8_field_budgets_prevent_unbounded_records(self):
        archive, plan = fixture(self.root, overrides={"ml-32m/ratings.csv": "userId,movieId,rating,timestamp\n" + "," * 2000})
        plan["budgets"]["maxCsvFieldBytes"] = 100
        with self.assertRaisesRegex(ValueError, "line exceeds budget"):
            ml.normalize_archive(archive, self.root / "output", plan)
        archive, plan = fixture(self.root, movies=[["1", "🧪" * 30, "Drama"], ["2", "Valid", "Drama"]])
        plan["budgets"]["maxCsvFieldBytes"] = 100
        with self.assertRaisesRegex(ValueError, "field byte budget"):
            ml.normalize_archive(archive, self.root / "output", plan)

    def test_changed_terms_and_partial_checkpoints_are_not_reused(self):
        path, _, archive, plan, _ = self.run_fixture()
        checkpoint = json.loads((path / "manifest.json").read_text())
        del checkpoint["outputFiles"]["ratings.jsonl"]
        ml.atomic_json(path / "manifest.json", checkpoint)
        with self.assertRaisesRegex(ValueError, "checkpoint identity"):
            ml.normalize_archive(archive, self.root / "output", plan)
        plan["sourceVerification"].update(status="verified", readmeSha256="a" * 64)
        plan["rights"].update(research="approved-for-noncommercial-research", reviewedBy="fixture", reviewedAt="fixture")
        (self.root / "publisher-readme.html").write_bytes(b"changed terms")
        ml.atomic_json(self.root / "publisher.json", {"datasetId": "movielens", "releaseId": "ml-32m", "readmeSha256": "a" * 64, "publisherMd5": plan["sourceVerification"]["publisherMd5"]})
        with self.assertRaisesRegex(ValueError, "snapshot differs"):
            ml.approved_source(plan, self.root)


if __name__ == "__main__":
    unittest.main()
