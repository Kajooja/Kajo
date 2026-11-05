"""No downloads: exact checkpoint replay, leakage and independent reference math."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import book_genome as bg
import scalable_ratings as sr


def fixture(root, domain='book', extra=b''):
    protocol = sr.read_json(sr.PROTOCOL)
    protocol.update(developmentSubjects=2, confirmationSubjects=2, trainingSubjects=[2, 4, 'ALL'])
    protocol['budgets'].update(checkpointRows=7, fitCheckpointSubjects=1)
    protocol['decision']['bootstrapReplicates'] = 50
    protocol[domain]['exclusions'] = []
    source = sr.read_json(sr.PROTOCOL.parent / protocol[domain]['sourceManifest'])
    if domain == 'book':
        raw = b''.join(bg.canonical({'user_id': u, 'item_id': i, 'rating': (u + 2 * i) % 5 + 1}) + b'\n'
                       for u in range(12) for i in range(30)) + extra
        source['member'].update(expandedSha256=bg.sha(raw), expandedBytes=len(raw))
    else:
        raw = b'userId,movieId,rating,timestamp\n' + b''.join(
            f'{u},{i},{((u + i) % 10 + 1) / 2},{1609459190 if i < 20 else 1609459200 if i < 25 else 1640995200}\n'.encode()
            for u in range(12) for i in range(30)) + extra
        source['sourceVerification']['files']['ml-32m/ratings.csv'].update(sha256=bg.sha(raw), bytes=len(raw))
    source['expectedCounts'] = {'ratings': 360 + extra.count(b'\n'), 'subjects': 12,
                                'objects' if domain == 'book' else 'movies': 30}
    path = root / 'source.txt'
    path.write_bytes(raw)
    return path, source, protocol


def build(root, domain='book', extra=b''):
    raw, source, protocol = fixture(root, domain, extra)
    store = sr.Store(root / 'run', raw, domain, source, protocol, [])
    store.ingest()
    store.partition()
    store.fit()
    return store, (raw, source, protocol)


class ScalableRatings(unittest.TestCase):
    def test_only_one_runner_can_mutate_a_store_and_lock_releases_after_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'run'
            with sr.exclusive_run(path):
                with self.assertRaises(BlockingIOError), sr.exclusive_run(path):
                    self.fail('Concurrent runner entered')
            with self.assertRaises(ValueError), sr.exclusive_run(path):
                raise ValueError('Artificial failure')
            with sr.exclusive_run(path):
                self.assertTrue((path / 'runner.lock').is_file())

    def test_interruption_replay_quarantines_late_conflicts_and_duplicate_repeats(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            # First occurrence is in the first committed checkpoint; conflict arrives last.
            extra = b''.join(bg.canonical({'user_id': 0, 'item_id': 0, 'rating': r}) + b'\n' for r in [1, 5, 1])
            raw, source, protocol = fixture(root, extra=extra)
            resumed = sr.Store(root / 'resumed', raw, 'book', source, protocol, [])
            state = resumed.ingest(stop_after=7)
            self.assertEqual(state['rows'], 7)
            self.assertFalse(state['complete'])
            with self.assertRaisesRegex(ValueError, 'Partial'):
                resumed.partition()
            resumed.close()
            resumed = sr.Store(root / 'resumed', raw, 'book', source, protocol, [])
            result = resumed.ingest()
            self.assertEqual((result['conflictingPairs'], result['quarantinedRows'], result['eligiblePairs']), (1, 4, 359))
            resumed.partition()
            resumed.fit(stop_after=3)
            with self.assertRaisesRegex(ValueError, 'partial'):
                resumed.model(2)
            resumed.close()
            resumed = sr.Store(root / 'resumed', raw, 'book', source, protocol, [])
            resumed.fit()
            full = sr.Store(root / 'full', raw, 'book', source, protocol, [])
            full.ingest()
            full.partition()
            full.fit()
            self.assertEqual(resumed.get('ingest'), full.get('ingest'))
            self.assertEqual(resumed.get('partition'), full.get('partition'))
            self.assertEqual(resumed.get('fit'), full.get('fit'))
            for size in full.get('partition')['sizes']:
                self.assertEqual(resumed.model(size), full.model(size))
            resumed.close()
            full.close()

    def test_movie_tied_groups_and_fixed_targets_across_sizes(self):
        with tempfile.TemporaryDirectory() as tmp:
            store, _ = build(Path(tmp), 'movie')
            rows = store.evaluation_rows('development')
            checks = []
            for n in store.get('partition')['sizes']:
                for budget in [0, 5, 10, 20]:
                    result, _ = store.evaluate(n, rows, budget)
                    checks.append(result['targetSha256'])
                    self.assertEqual(result['visibleMean'], 20 if budget == 20 else 0)
            self.assertEqual(len(set(checks)), 1)
            self.assertEqual(sr.movie_prefix([(1, 3, 10), (2, 4, 10), (3, 5, 9)], 1), [])
            store.close()

    def test_source_protocol_and_statistics_changes_reject_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw, source, protocol = fixture(root)
            store = sr.Store(root / 'run', raw, 'book', source, protocol, [])
            store.ingest(stop_after=7)
            store.close()
            changed = copy.deepcopy(protocol)
            changed['model']['itemShrinkage'] = 2
            with self.assertRaisesRegex(ValueError, 'identity changed'):
                sr.Store(root / 'run', raw, 'book', source, changed, [])
            raw.write_bytes(raw.read_bytes().replace(b'"rating":1', b'"rating":2', 1))
            with self.assertRaisesRegex(ValueError, 'Source integrity'):
                sr.Store(root / 'run', raw, 'book', source, protocol, [])
        with tempfile.TemporaryDirectory() as tmp:
            store, _ = build(Path(tmp))
            with store.db:
                store.db.execute('UPDATE stats SET s=s+1 WHERE i=0')
            with self.assertRaisesRegex(ValueError, 'statistics changed'):
                store.fit()
            store.close()

    def test_exact_exclusion_witness_and_membership_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw, source, protocol = fixture(root)
            witness = root / 'exposed.jsonl'
            witness.write_bytes(bg.canonical({'record': {'user_id': 0}}) + b'\n')
            protocol['book']['exclusions'] = [{'sha256': bg.file_hash(witness), 'subjects': 1, 'ratings': 1}]
            with self.assertRaisesRegex(ValueError, 'Exactly'):
                sr.Store(root / 'none', raw, 'book', source, protocol, [])
            store = sr.Store(root / 'run', raw, 'book', source, protocol, [witness])
            store.ingest()
            store.partition()
            self.assertEqual(store.db.execute('SELECT role FROM subjects WHERE u=0').fetchone()[0], 'exposed')
            store.fit()
            with self.assertRaisesRegex(ValueError, 'subject cannot'):
                store.evaluate(2, {0: ([], [(1, 6, -1)])}, 0)
            with store.db:
                store.db.execute("UPDATE subjects SET role='background' WHERE role='confirmation'")
            with self.assertRaisesRegex(ValueError, 'membership changed'):
                store.curve()
            store.close()

    def test_confirmation_requires_locked_selection_and_cannot_be_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            store, _ = build(Path(tmp))
            with self.assertRaisesRegex(ValueError, 'selection required'):
                store.evaluation_rows('confirmation')
            result = store.curve()
            self.assertFalse(result['selection']['confirmationRead'])
            confirmed = store.confirm()
            self.assertEqual(confirmed['admission'], 'NONE')
            with self.assertRaisesRegex(ValueError, 'already exposed'):
                store.confirm()
            store.close()
        with tempfile.TemporaryDirectory() as tmp:
            store, _ = build(Path(tmp))
            store.curve()
            path = store.directory / 'selection.json'
            path.write_text(path.read_text() + ' ')
            with self.assertRaisesRegex(ValueError, 'receipt changed'):
                store.confirm()
            store.close()

    def test_leakage_changed_labels_unknown_pairs_and_time_rejected(self):
        for domain in ['book', 'movie']:
            with self.subTest(domain=domain), tempfile.TemporaryDirectory() as tmp:
                store, _ = build(Path(tmp), domain)
                rows = store.evaluation_rows('development')
                u = next(iter(rows))
                visible, targets = rows[u]
                with self.assertRaisesRegex(ValueError, 'overlapping'):
                    store.evaluate(2, {u: (visible + targets[:1], targets)}, 20)
                with self.assertRaisesRegex(ValueError, 'Foreign'):
                    store.evaluate(2, {u: (visible, [(999, 2, -1)])}, 20)
                if domain == 'movie':
                    with self.assertRaisesRegex(ValueError, 'Temporal'):
                        store.evaluate(2, {u: (targets, visible)}, 20)
                store.close()

    def test_withdrawal_and_absent_disallowed_native_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            store, (raw, source, protocol) = build(Path(tmp))
            store.withdraw()
            with self.assertRaisesRegex(ValueError, 'withdrawn'):
                store.model(2)
            store.close()
            with self.assertRaisesRegex(ValueError, 'withdrawn'):
                sr.Store(Path(tmp) / 'run', raw, 'book', source, protocol, [])
            source['rights']['purpose'] = 'DISALLOWED'
            with self.assertRaisesRegex(ValueError, 'not approved'):
                sr.Store(Path(tmp) / 'new', raw, 'book', source, protocol, [])
        self.assertIsNone(sr.native_fallback([]))
        self.assertEqual(sr.native_fallback([0, 10]), 5)
        for value in [None, True, -1, 11, 0.5]:
            with self.assertRaises(ValueError):
                sr.native_fallback([value])

    def test_budgets_fail_closed_without_publishing_complete_fit(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, source, protocol = fixture(Path(tmp))
            protocol['budgets']['maxDiskBytes'] = 1
            store = sr.Store(Path(tmp) / 'run', raw, 'book', source, protocol, [])
            with self.assertRaisesRegex(ValueError, 'Disk budget'):
                store.ingest()
            self.assertFalse(store.get('ingest')['complete'])
            store.close()

    def test_raw_scales_missing_and_fake_book_time_are_not_repaired(self):
        for data in [b'{"user_id":1,"item_id":1,"rating":0}\n', b'{"user_id":1,"item_id":1,"rating":true}\n',
                     b'{"user_id":1,"item_id":1,"rating":2,"timestamp":0}\n', b'{"user_id":1,"item_id":1,"rating":2}']:
            with self.assertRaises(ValueError):
                sr.parse_line(data, 'book')
        for data in [b'1,1,0,1\n', b'1,1,nan,1\n', b'1,1,2.1,1\n', b'1,1,2,\n']:
            with self.assertRaises(ValueError):
                sr.parse_line(data, 'movie')

    def test_all_three_estimators_match_independent_built_engine_on_bounded_fixture(self):
        engine = sr.ROOT / 'packages/prediction-engine/dist/research-static.js'
        if not engine.exists():
            self.fail('Build engine before research tests (root check does this)')
        with tempfile.TemporaryDirectory() as tmp:
            store, _ = build(Path(tmp))
            model = store.model(2)
            train = list(store.db.execute("SELECT p.u,p.i,p.y FROM pairs p JOIN subjects s ON s.u=p.u WHERE s.role='background' AND s.ordinal<=2 AND p.bad=0 ORDER BY p.u,p.i"))
            rows = store.evaluation_rows('development')
            user = next(iter(rows))
            visible, targets = rows[user]
            # A file URL literal from the local test fixture, not a shell command.
            script = f"import {{fitStaticRatings,predictStaticRatings}} from {json.dumps(engine.as_uri())};\n" + """
let text='';for await (const x of process.stdin)text+=x;
const x=JSON.parse(text), sourceId='fixture';
const spec={sourceId,snapshotId:'a'.repeat(64),originalScale:{min:1,max:5},scale:{min:2,max:10},multiplier:2,itemShrinkage:10,subjectShrinkage:10};
const row=(u,i,y)=>({kind:'undated-external-rating',sourceId,snapshotId:spec.snapshotId,subjectId:`fixture:${u}`,objectId:`fixture:${i}`,sourceOccurredAt:null,original:{value:y/2,min:1,max:5},value:y});
const model=fitStaticRatings(x.train.map(r=>row(...r)),spec);
const forecasts=predictStaticRatings(model,`fixture:${x.user}`,x.visible.map(r=>row(x.user,r[0],r[1])),x.targets.map(r=>`fixture:${r[0]}`));
process.stdout.write(JSON.stringify({mean:model.globalMean,forecasts}));
"""
            proc = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps({'train': train, 'user': user, 'visible': visible[:20], 'targets': targets}), text=True, capture_output=True, check=True)
            reference = json.loads(proc.stdout)
            self.assertAlmostEqual(reference['mean'], model['sum'] / model['rows'], places=12)
            result = sr.forecasts(model, visible[:20], [r[0] for r in targets], store.protocol['model'], 2)
            base = sr.forecasts(model, [], [r[0] for r in targets], store.protocol['model'], 2)
            for i, r in enumerate(reference['forecasts']):
                self.assertAlmostEqual(result[i], r['values']['profile-offset'], places=12)
                self.assertAlmostEqual(base[i], r['values']['item-mean'], places=12)
            store.close()


if __name__ == '__main__':
    unittest.main()
