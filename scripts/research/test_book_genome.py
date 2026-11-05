"""Offline artificial sources: integrity, complete histories, quarantine and retry."""
import copy
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib

import book_genome as bg


def fixture(root, raw=None):
    plan = json.loads(bg.PLAN.read_text())
    if raw is None:
        raw = b''.join(bg.canonical({'user_id': u, 'item_id': i, 'rating': (u + i) % 5 + 1}) + b'\n'
                       for u in range(6) for i in range(4))
    compressor = zlib.compressobj(wbits=-15)
    data = compressor.compress(raw) + compressor.flush()
    plan['member'].update(compressedBytes=len(data), expandedBytes=len(raw), crc32=zlib.crc32(raw),
                          compressedSha256=bg.sha(data), expandedSha256=bg.sha(raw))
    plan['expectedCounts'] = {'ratings': raw.count(b'\n'), 'subjects': 6, 'objects': 4}
    plan['cohort'].update(size=3, candidatePool=6, minUniqueRatings=2)
    path = root / 'ratings.deflate'
    path.write_bytes(data)
    return path, plan


class BookIntake(unittest.TestCase):
    def test_complete_deterministic_histories_and_integrity_checked_reuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, plan = fixture(root)
            a, receipt, reused = bg.normalize(source, root / 'a', plan)
            b, other, _ = bg.normalize(source, root / 'b', plan)
            self.assertFalse(reused)
            self.assertEqual(receipt['cohort'], {'subjects': 3, 'ratings': 12, 'minHistory': 4, 'maxHistory': 4})
            self.assertEqual((a / 'ratings.jsonl').read_bytes(), (b / 'ratings.jsonl').read_bytes())
            self.assertEqual(receipt, other)
            self.assertTrue(bg.normalize(source, root / 'a', plan)[2])
            (a / 'ratings.jsonl').write_text('corruption')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                bg.normalize(source, root / 'a', plan)

    def test_all_conflicting_versions_excluded_and_identical_duplicates_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lines = [{'user_id': u, 'item_id': i, 'rating': 3} for u in range(6) for i in range(4)]
            lines += [{'user_id': 0, 'item_id': 0, 'rating': r} for r in [3, 4, 3]]
            source, plan = fixture(root, b''.join(bg.canonical(r) + b'\n' for r in lines))
            plan['cohort']['size'] = 6
            path, receipt, _ = bg.normalize(source, root / 'out', plan)
            result = [json.loads(s)['record'] for s in (path / 'ratings.jsonl').read_text().splitlines()]
            self.assertEqual(len(result), 23)
            self.assertFalse(any(r['user_id'] == 0 and r['item_id'] == 0 for r in result))
            self.assertEqual(receipt['quarantine']['identicalDuplicates'], 1)
            self.assertEqual(receipt['quarantine']['conflictingPairs'], 1)

    def test_invalid_rows_are_never_coerced_to_zero_or_time(self):
        invalid = [b'{"user_id":0,"item_id":1,"rating":0}\n',
                   b'{"user_id":0,"item_id":1,"rating":null}\n',
                   b'{"user_id":0,"item_id":1,"rating":true}\n',
                   b'{"user_id":0,"item_id":1,"rating":2.5}\n',
                   b'{"user_id":0,"item_id":1,"rating":3,"rating":4}\n',
                   b'{"user_id":0,"item_id":1,"rating":3,"timestamp":0}\n',
                   b'{"user_id":9007199254740992,"item_id":1,"rating":3}\n',
                   b'{"user_id":0,"item_id":1,"rating":3}']
        for raw in invalid:
            with self.subTest(raw=raw), tempfile.TemporaryDirectory() as tmp:
                source, plan = fixture(Path(tmp), raw)
                with self.assertRaises(ValueError):
                    list(bg.rows(source, plan))

    def test_hash_crc_truncation_trailing_bytes_and_expansion_budgets(self):
        for kind in ['compressedHash', 'rawHash', 'crc', 'truncated', 'trailing', 'expansion', 'line', 'rows']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                source, plan = fixture(Path(tmp))
                m = plan['member']
                if kind == 'compressedHash': m['compressedSha256'] = '0' * 64
                if kind == 'rawHash': m['expandedSha256'] = '0' * 64
                if kind == 'crc': m['crc32'] += 1
                if kind == 'truncated': source.write_bytes(source.read_bytes()[:-1]); m['compressedBytes'] -= 1
                if kind == 'trailing': source.write_bytes(source.read_bytes() + b'extra'); m['compressedBytes'] += 5
                if kind == 'expansion': m['expandedBytes'] = 1
                if kind == 'line': plan['budgets']['maxLineBytes'] = 4
                if kind == 'rows': plan['budgets']['maxRows'] = 1
                with self.assertRaises((ValueError, zlib.error)):
                    list(bg.rows(source, plan))

    def test_candidate_and_history_bounds_fail_without_partial_publication(self):
        for field in ['maxCandidateRows', 'maxHistoryRows', 'maxCohortRows', 'maxSubjects', 'maxObjects']:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                source, plan = fixture(root)
                plan['budgets'][field] = 1
                with self.assertRaises(ValueError):
                    bg.normalize(source, root / 'out', plan)
                self.assertFalse((root / 'out').exists())

    def test_download_checks_pinned_member_and_does_not_publish_corruption(self):
        for corrupt in [False, True]:
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                source, plan = fixture(root)
                payload = source.read_bytes(); source.unlink()
                plan['readmeSha256'] = bg.sha(b'reviewed')
                (root / 'book-genome-readme.txt').write_bytes(b'reviewed')
                name = plan['member']['name'].encode()
                header = struct.pack('<4s5H3I2H', b'PK\x03\x04', 20, 0, 8, 0, 0, 0, 0, 0, len(name), 0)
                responses = iter([header, name, b'x' * len(payload) if corrupt else payload])
                transport = lambda *args: next(responses)
                if corrupt:
                    with self.assertRaises((ValueError, zlib.error)):
                        bg.download(root, plan, transport)
                    self.assertFalse(source.exists())
                    self.assertFalse(list(root.glob('.ratings-*')))
                else:
                    self.assertEqual(bg.download(root, plan, transport).read_bytes(), payload)
                    self.assertEqual(bg.download(root, plan, lambda *args: self.fail('Network on valid reuse')), source)

    def test_http_rejects_ignored_ranges_changed_identity_and_wrong_lengths(self):
        plan = json.loads(bg.PLAN.read_text())
        class Response:
            status = 206
            headers = {'Content-Range': f'bytes 1-3/{plan["archiveBytes"]}',
                       'ETag': plan['etag'], 'Last-Modified': plan['lastModified']}
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, n): return b'abc'
        for kind in ['ok', 'status', 'range', 'etag', 'modified', 'encoding', 'length']:
            response = Response(); response.headers = copy.copy(response.headers)
            if kind == 'status': response.status = 200
            if kind == 'range': response.headers['Content-Range'] = 'bytes 1-4/100'
            if kind == 'etag': response.headers['ETag'] = 'changed'
            if kind == 'modified': response.headers['Last-Modified'] = 'changed'
            if kind == 'encoding': response.headers['Content-Encoding'] = 'gzip'
            if kind == 'length': response.read = lambda n: b'abcd'
            with self.subTest(kind=kind), patch('urllib.request.OpenerDirector.open', return_value=response):
                if kind == 'ok': self.assertEqual(bg.fetch(plan, 1, 3), b'abc')
                else:
                    with self.assertRaises(ValueError): bg.fetch(plan, 1, 3)


if __name__ == '__main__':
    unittest.main()
