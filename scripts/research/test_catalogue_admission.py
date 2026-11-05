"""Synthetic identity failures must never become usable catalogue links."""
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

import catalogue_admission as ca


def snapshot():
    return {'featureSnapshot': {'checkedAt': '2026-11-05T00:00:00Z', 'items': [
        {'itemId': 'native-a', 'itemType': 'MOVIE', 'sources': [
            {'providerKey': 'tmdb', 'providerItemId': '7', 'identityMatches': True}]},
        {'itemId': 'native-book', 'itemType': 'BOOK', 'sources': []}]},
        'aliases': [{'itemId': 'native-a', 'namespace': ns, 'externalId': value,
                     'itemType': 'MOVIE', 'discoverable': True}
                    for ns, value in [('tmdb_movie', '7'), ('imdb_title', 'tt0000001')]]}


def links(text='1,0000001,7\r\n'):
    raw = ('movieId,imdbId,tmdbId\r\n' + text).encode()
    return ca.parse_links(raw, {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})


class CatalogueAdmission(unittest.TestCase):
    def test_one_read_only_statement_reuses_existing_feature_projection(self):
        sql = ca.snapshot_sql()
        self.assertTrue(sql.startswith('begin read only;'))
        self.assertTrue(sql.endswith('commit;'))
        self.assertEqual(sql.count(';'), 3)
        self.assertNotIn('public.events', sql)
        self.assertNotIn('auth.users', sql)
        self.assertIn('from private.item_external_ids', sql)

    def test_exact_aliases_preserve_imdb_zeroes_and_separate_item_support(self):
        rows = links()
        self.assertEqual(rows[0][1]['imdb_title'], 'tt0000001')
        report, private = ca.audit_links(rows, snapshot(), {'1'})
        self.assertEqual(report['exactMappedMovieItems'], 1)
        self.assertEqual(report['mappedMovieItemsWithTrainingSupport'], 1)
        self.assertEqual(private[0]['status'], 'MATCHED')
        report, _ = ca.audit_links(rows, snapshot(), set())
        self.assertEqual(report['mappedMovieItemsWithoutTrainingSupport'], 1)
        self.assertEqual(report['book']['actualOverlap'], 'UNKNOWN')
        self.assertEqual(report['admission'], 'NONE')

    def test_source_alias_collision_anywhere_quarantines_both_objects(self):
        report, private = ca.audit_links(links('1,0000001,7\n2,0000002,7\n'), snapshot(), {'1'})
        self.assertEqual(report['sourceDisposition'], {'SOURCE_ALIAS_CONFLICT': 2})
        self.assertTrue(all(p['status'] != 'MATCHED' for p in private))

    def test_duplicate_source_object_is_not_silently_deduplicated(self):
        report, _ = ca.audit_links(links('1,0000001,7\n1,0000001,7\n'), snapshot(), set())
        self.assertEqual(report['sourceLinkRows'], 2)
        self.assertEqual(report['sourceDisposition'], {'DUPLICATE_SOURCE_OBJECT': 1})

    def test_known_cross_alias_disagreement_cannot_use_one_good_alias(self):
        report, _ = ca.audit_links(links('1,0000002,7\n'), snapshot(), set())
        self.assertEqual(report['sourceDisposition'], {'CROSS_ALIAS_DISAGREEMENT': 1})

    def test_native_alias_collision_and_wrong_domain_are_quarantined(self):
        s = snapshot()
        extra = {**s['aliases'][0], 'itemId': 'native-book', 'itemType': 'BOOK'}
        s['aliases'].append(extra)
        report, _ = ca.audit_links(links(), s, set())
        self.assertEqual(report['sourceDisposition'], {'NATIVE_ALIAS_CONFLICT': 1})
        s['aliases'] = [extra]
        report, _ = ca.audit_links(links(), s, set())
        self.assertEqual(report['sourceDisposition'], {'WRONG_DOMAIN': 1})

    def test_missing_alias_is_not_zero_and_known_inactive_is_not_active(self):
        report, _ = ca.audit_links(links('1,0000001,\n2,,\n'), snapshot(), set())
        self.assertEqual(report['sourceDisposition'], {'MATCHED': 1, 'UNMAPPED': 1})
        s = snapshot()
        s['featureSnapshot']['items'] = s['featureSnapshot']['items'][1:]
        for a in s['aliases']:
            a['discoverable'] = False
        report, _ = ca.audit_links(links(), s, set())
        self.assertEqual(report['sourceDisposition'], {'INACTIVE_ITEM': 1})

    def test_unverified_native_source_and_incomplete_snapshot_do_not_match(self):
        s = snapshot()
        s['featureSnapshot']['items'][0]['sources'][0]['identityMatches'] = False
        report, _ = ca.audit_links(links(), s, set())
        self.assertEqual(report['sourceDisposition'], {'NATIVE_SOURCE_UNVERIFIED': 1})
        s['featureSnapshot']['items'] = s['featureSnapshot']['items'][1:]
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            ca.audit_links(links(), s, set())

    def test_distinct_source_objects_cannot_converge_through_different_aliases(self):
        report, _ = ca.audit_links(links('1,0000001,\n2,,7\n'), snapshot(), set())
        self.assertEqual(report['sourceDisposition'], {'NON_UNIQUE_CANONICAL_TARGET': 2})

    def test_bad_source_bytes_and_invalid_or_extra_csv_fields_fail(self):
        with self.assertRaisesRegex(ValueError, 'bytes'):
            ca.parse_links(b'anything', {'bytes': 8, 'sha256': '0' * 64})
        for line in ['1,tt0000001,7\n', '1,0000001,0\n', '1,0000001,7,extra\n']:
            with self.subTest(line=line), self.assertRaises(ValueError):
                links(line)
        with self.assertRaisesRegex(ValueError, 'absent from source'):
            ca.audit_links(links(), snapshot(), {'999'})

    def test_model_support_binds_source_partition_and_withdrawal_without_writing(self):
        source = {'sourceVerification': {'files': {'ml-32m/ratings.csv': {'sha256': 'raw'}}}}
        protocol = {'fixture': True}
        identity = {'domain': 'movie', 'source': ca.digest(source), 'protocol': ca.digest(protocol), 'raw': 'raw'}
        model = {'complete': True, 'admission': 'NONE', 'identity': identity, 'partition': 'partition',
                 'items': {'1': [14, 2]}, 'rows': 2, 'sum': 14}
        meta = {'fit': {'complete': True}, 'identity': identity, 'partition': {'sha256': 'partition'}}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'ratings.sqlite'
            with sqlite3.connect(path) as db:
                db.executescript('CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT); CREATE TABLE models(body TEXT,sha TEXT);')
                db.executemany('INSERT INTO meta VALUES(?,?)', [(k, json.dumps(v)) for k, v in meta.items()])
                db.execute('INSERT INTO models VALUES(?,?)', (json.dumps(model), ca.digest(model)))
            before = path.read_bytes()
            self.assertEqual(ca.model_support(path, ca.digest(model), source, protocol), {'1'})
            self.assertEqual(path.read_bytes(), before)
            with self.assertRaisesRegex(ValueError, 'Source/plan'):
                ca.model_support(path, ca.digest(model), source, {'other': True})
            with sqlite3.connect(path) as db:
                db.execute('INSERT INTO meta VALUES(?,?)', ('withdrawn', 'true'))
            with self.assertRaisesRegex(ValueError, 'withdrawn'):
                ca.model_support(path, ca.digest(model), source, protocol)


if __name__ == '__main__':
    unittest.main()
