"""Pinned ratings-only Book Genome intake. Standard library; never native data."""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile
import time
import urllib.request
import zlib

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'research/manifests/book-genome-2021.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def save(path, value):
    path.write_bytes(json.dumps(value, indent=2).encode() + b'\n')


def file_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Publisher redirect requires source review')


def fetch(plan, start=None, length=None):
    url = plan['readmeUrl'] if start is None else plan['archiveUrl']
    headers = {'Accept-Encoding': 'identity'}
    if start is not None:
        if not (0 <= start and 0 < length <= plan['budgets']['chunkBytes']
                and start + length <= plan['archiveBytes']):
            raise ValueError('Range budget')
        end = start + length - 1
        headers.update({'Range': f'bytes={start}-{end}', 'If-Match': plan['etag']})
    else:
        length = plan['readmeBytes']
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        if response.headers.get('Content-Encoding', 'identity') != 'identity':
            raise ValueError('Unexpected transfer encoding')
        if start is not None:
            if (response.status != 206 or response.headers.get('Content-Range') !=
                    f'bytes {start}-{end}/{plan["archiveBytes"]}' or
                    response.headers.get('ETag') != plan['etag'] or
                    response.headers.get('Last-Modified') != plan['lastModified']):
                raise ValueError('Publisher range or identity changed')
        elif response.status != 200:
            raise ValueError('README response')
        data = response.read(length + 1)
        if len(data) != length:
            raise ValueError('Transfer length mismatch')
        return data


def blocks(path, plan):
    """Bound both compressed and expanded bytes before yielding small blocks."""
    m = plan['member']
    if path.stat().st_size != m['compressedBytes']:
        raise ValueError('Compressed size mismatch')
    inflater = zlib.decompressobj(-15)
    raw_hash, compressed_hash = hashlib.sha256(), hashlib.sha256()
    size, crc = 0, 0
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            compressed_hash.update(chunk)
            pending = chunk
            while pending:
                raw = inflater.decompress(pending, 65536)
                pending = inflater.unconsumed_tail
                size += len(raw)
                if size > m['expandedBytes']:
                    raise ValueError('Expansion budget')
                raw_hash.update(raw)
                crc = zlib.crc32(raw, crc)
                yield raw
    if (not inflater.eof or inflater.unused_data or size != m['expandedBytes']
            or crc != m['crc32'] or raw_hash.hexdigest() != m['expandedSha256']
            or compressed_hash.hexdigest() != m['compressedSha256']):
        raise ValueError('Ratings member integrity mismatch')


def unique_keys(pairs):
    result = {}
    for k, v in pairs:
        if k in result:
            raise ValueError('Duplicate JSON key')
        result[k] = v
    return result


def rows(path, plan):
    pending, count = b'', 0
    for block in blocks(path, plan):
        lines = (pending + block).split(b'\n')
        pending = lines.pop()
        if len(pending) > plan['budgets']['maxLineBytes']:
            raise ValueError('Line budget')
        for line in lines:
            count += 1
            if count > plan['budgets']['maxRows'] or len(line) > plan['budgets']['maxLineBytes']:
                raise ValueError('Row budget')
            r = json.loads(line.decode('utf-8'), object_pairs_hook=unique_keys)
            if not isinstance(r, dict) or set(r) != {'user_id', 'item_id', 'rating'}:
                raise ValueError('Unexpected rating schema')
            u, i, grade = (r[k] for k in ('user_id', 'item_id', 'rating'))
            if (any(type(x) is not int for x in (u, i, grade)) or not 0 <= u <= 2**53 - 1
                    or not 0 <= i <= 2**53 - 1 or not 1 <= grade <= 5):
                raise ValueError('Invalid original grade or identity')
            yield count, u, i, grade
    if pending or count != plan['expectedCounts']['ratings']:
        raise ValueError('Incomplete member or row count mismatch')


def download(directory, plan, transport=fetch):
    directory.mkdir(parents=True, exist_ok=True)
    readme = directory / 'book-genome-readme.txt'
    if not readme.is_file() or file_hash(readme) != plan['readmeSha256']:
        raise ValueError('Run prepare: reviewed README required')
    target = directory / 'ratings.deflate'
    if target.exists():
        for _ in blocks(target, plan):
            pass
        return target
    m = plan['member']
    header = struct.unpack('<4s5H3I2H', transport(plan, m['headerOffset'], 30))
    if header[0] != b'PK\x03\x04' or header[2] & 1 or header[3] != m['method'] or m['method'] != 8:
        raise ValueError('Unexpected local ZIP header')
    name = transport(plan, m['headerOffset'] + 30, header[-2]).decode('utf-8')
    if name != m['name']:
        raise ValueError('Ratings member name mismatch')
    start = m['headerOffset'] + 30 + header[-2] + header[-1]
    if start + m['compressedBytes'] > plan['archiveBytes']:
        raise ValueError('Member range exceeded')
    fd, temporary = tempfile.mkstemp(prefix='.ratings-', dir=directory)
    temporary = Path(temporary)
    started = time.monotonic()
    try:
        with os.fdopen(fd, 'wb') as output:
            remaining = m['compressedBytes']
            while remaining:
                if time.monotonic() - started > plan['budgets']['maxSeconds']:
                    raise ValueError('Transfer time budget')
                size = min(remaining, plan['budgets']['chunkBytes'])
                data = transport(plan, start, size)
                if len(data) != size:
                    raise ValueError('Incomplete range')
                output.write(data)
                remaining -= size
                start += size
        for _ in blocks(temporary, plan):
            pass
        # Do not replace an accepted concurrent writer's file.
        os.link(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def normalize(path, output, plan):
    lineage = {'planSha256': sha(canonical(plan)), 'codeSha256': file_hash(Path(__file__)),
               'compressedSha256': plan['member']['compressedSha256']}
    run_id = sha(canonical(lineage))
    target = output / run_id
    if target.exists():
        receipt = json.loads((target / 'manifest.json').read_text())
        if (receipt['lineage'] != lineage or file_hash(path) != lineage['compressedSha256']
                or file_hash(target / 'ratings.jsonl') != receipt['cohortSha256']):
            raise ValueError('Cached stage integrity mismatch')
        return target, receipt, True
    started = time.monotonic()
    counts, histogram, objects = collections.Counter(), collections.Counter(), set()
    budget = plan['budgets']
    for _, u, i, grade in rows(path, plan):
        counts[u] += 1
        histogram[grade] += 1
        objects.add(i)
        if len(counts) > budget['maxSubjects'] or len(objects) > budget['maxObjects']:
            raise ValueError('Identity budget')
    source_counts = {'ratings': sum(counts.values()), 'subjects': len(counts), 'objects': len(objects)}
    if source_counts != plan['expectedCounts']:
        raise ValueError('Source counts mismatch')
    c = plan['cohort']
    rank = lambda u: (sha(f'{c["seed"]}:{u}'.encode()), u)
    potential = sorted((u for u, n in counts.items() if n >= c['minUniqueRatings']), key=rank)[:c['candidatePool']]
    histories = {u: {} for u in potential}
    conflicts, duplicates, candidate_rows = set(), 0, 0
    for line, u, i, grade in rows(path, plan):
        if u not in histories:
            continue
        candidate_rows += 1
        if candidate_rows > budget['maxCandidateRows'] or time.monotonic() - started > budget['maxSeconds']:
            raise ValueError('Candidate/time budget')
        key = (u, i)
        if key in conflicts:
            continue
        previous = histories[u].get(i)
        if previous is not None:
            if previous[0] == grade:
                duplicates += 1
            else:
                conflicts.add(key)
                del histories[u][i]
        else:
            histories[u][i] = (grade, line)
        if len(histories[u]) > budget['maxHistoryRows']:
            raise ValueError('History budget')
    selected = [u for u in potential if len(histories[u]) >= c['minUniqueRatings']][:c['size']]
    total = sum(len(histories[u]) for u in selected)
    if len(selected) != c['size'] or total > budget['maxCohortRows']:
        raise ValueError('Insufficient bounded candidates or cohort budget')
    output.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.book-stage-', dir=output))
    try:
        with (temporary / 'ratings.jsonl').open('xb') as f:
            for u in sorted(selected):
                for i, (grade, line) in sorted(histories[u].items()):
                    f.write(canonical({'sourceRecordLine': line,
                                      'record': {'user_id': u, 'item_id': i, 'rating': grade}}) + b'\n')
        receipt = {'schema': 'book-genome-normalized-v1', 'lineage': lineage, 'source': plan,
                   'sourceCounts': source_counts, 'originalHistogram': dict(histogram),
                   'cohort': {'subjects': len(selected), 'ratings': total,
                              'minHistory': min(len(histories[u]) for u in selected),
                              'maxHistory': max(len(histories[u]) for u in selected)},
                   'cohortSha256': file_hash(temporary / 'ratings.jsonl'),
                   'cohortBytes': (temporary / 'ratings.jsonl').stat().st_size,
                   'quarantine': {'scope': 'bounded candidate pool', 'candidateRows': candidate_rows,
                                  'identicalDuplicates': duplicates, 'conflictingPairs': len(conflicts)},
                   'sourceOccurredAt': None, 'qualityAdmission': 'NONE', 'servingActivation': 'NONE'}
        save(temporary / 'manifest.json', receipt)
        temporary.rename(target)
        return target, receipt, False
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'download', 'normalize'])
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'research-data/book-genome-2021')
    parser.add_argument('--member', type=Path)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'research-artifacts/book-genome-intake')
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text())
    if args.command == 'prepare':
        data = fetch(plan)
        if sha(data) != plan['readmeSha256']:
            raise ValueError('Publisher README changed')
        args.data_dir.mkdir(parents=True, exist_ok=True)
        p = args.data_dir / 'book-genome-readme.txt'
        if p.exists() and p.read_bytes() != data:
            raise ValueError('Existing README differs')
        p.write_bytes(data)
        print(json.dumps({'readmeSha256': sha(data), 'path': str(p)}))
    elif args.command == 'download':
        print(json.dumps({'path': str(download(args.data_dir, plan))}))
    else:
        path, receipt, reused = normalize(args.member or args.data_dir / 'ratings.deflate', args.output_dir, plan)
        print(json.dumps({'path': str(path), 'cohort': receipt['cohort'],
                          'cohortSha256': receipt['cohortSha256'], 'reused': reused}))


if __name__ == '__main__':
    main()
