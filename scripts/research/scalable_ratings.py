"""Disk-backed, resumable individual-rating research. No native or serving inputs.

SQLite is the exact membership/quarantine witness; integer sufficient statistics
replace row arrays, not individual observations. The frozen protocol owns all
selection rules. Research predictions require the matching, nonwithdrawn store.
"""
import argparse
import collections
import contextlib
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import random
import resource
import sqlite3
import sys
import time
import zipfile

import book_genome as bg

ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = ROOT / 'research/manifests/rating-learning-curves-v1.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(value):
    return bg.sha(bg.canonical(value))


def read_json(path):
    return json.loads(path.read_text(), object_pairs_hook=bg.unique_keys)


def save_new(path, value):
    with path.open('x', encoding='utf8') as output:
        os.chmod(path, 0o600)
        output.write(json.dumps(value, indent=2, allow_nan=False) + '\n')


@contextlib.contextmanager
def exclusive_run(directory):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    require(not directory.is_symlink() and directory.stat().st_mode & 0o077 == 0, 'Private directory required')
    with (directory / 'runner.lock').open('a') as handle:
        os.chmod(directory / 'runner.lock', 0o600)
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def source_spec(domain, source):
    if domain == 'book':
        return source['member']['expandedSha256'], source['member']['expandedBytes'], 2
    entry = source['sourceVerification']['files']['ml-32m/ratings.csv']
    return entry['sha256'], entry['bytes'], 1


def rights(source):
    require(source['rights']['purpose'] == 'NONCOMMERCIAL_RESEARCH_ONLY'
            and source['rights']['productionServing'] == 'not-approved', 'Source use is not approved')


def expand_source(domain, source, input_path, output):
    """Verified local publisher input only. Interrupted extraction is never reused."""
    rights(source)
    expected, length, _ = source_spec(domain, source)
    if output.exists():
        require(output.stat().st_size == length and bg.file_hash(output) == expected, 'Expanded source changed')
        return
    temporary = output.with_suffix(output.suffix + '.partial')
    require(not temporary.exists(), 'Incomplete extraction requires explicit removal before restart')
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with temporary.open('xb') as target:
        os.chmod(temporary, 0o600)
        h, size = hashlib.sha256(), 0
        if domain == 'book':
            chunks = bg.blocks(input_path, source)
            manager = contextlib.nullcontext()
        else:
            require(input_path.stat().st_size == source['sourceVerification']['archiveBytes']
                    and bg.file_hash(input_path) == source['sourceVerification']['archiveSha256'], 'Archive changed')
            manager = zipfile.ZipFile(input_path)
        with manager as archive:
            if domain == 'movie':
                member = archive.open('ml-32m/ratings.csv')
                chunks = iter(lambda: member.read(1024 * 1024), b'')
            for block in chunks:
                size += len(block)
                require(size <= length, 'Expansion budget')
                h.update(block)
                target.write(block)
        require(size == length and h.hexdigest() == expected, 'Expanded source integrity')
        target.flush()
        os.fsync(target.fileno())
    temporary.rename(output)


def exclusions(domain, paths, protocol):
    expected = protocol[domain]['exclusions']
    require(len(paths) == len(expected), 'Exactly the declared exclusion witnesses are required')
    users = set()
    for path, spec in zip(paths, expected):
        require(path.stat().st_size <= 33554432 and bg.file_hash(path) == spec['sha256'], 'Exclusion witness integrity')
        seen, count = set(), 0
        with path.open('rb') as handle:
            for line in handle:
                require(len(line) <= 4096 and line.endswith(b'\n'), 'Exclusion line')
                row = json.loads(line, object_pairs_hook=bg.unique_keys)
                user = row['record']['user_id'] if domain == 'book' else int(row['userId'])
                require(type(user) is int and 0 <= user <= 2**53 - 1, 'Exclusion identity')
                seen.add(user)
                count += 1
        require(count == spec['ratings'] and len(seen) == spec['subjects'] and not users & seen,
                'Exclusion count or overlap')
        users.update(seen)
    return users


def parse_line(line, domain):
    require(line.endswith(b'\n'), 'Incomplete record')
    if domain == 'book':
        row = json.loads(line, object_pairs_hook=bg.unique_keys)
        require(isinstance(row, dict) and set(row) == {'user_id', 'item_id', 'rating'}, 'BOOK schema')
        user, item, original = row['user_id'], row['item_id'], row['rating']
        require(all(type(x) is int for x in (user, item, original)) and 1 <= original <= 5, 'BOOK original scale')
        grade, at = original * 2, -1
    else:
        values = line.decode('ascii').rstrip('\r\n').split(',')
        require(len(values) == 4 and all(values[i].isdigit() for i in (0, 1, 3)), 'MOVIE schema')
        user, item, at = (int(values[i]) for i in (0, 1, 3))
        original = float(values[2])
        require(math.isfinite(original) and 0.5 <= original <= 5 and original * 2 == int(original * 2), 'MOVIE original scale')
        grade = int(original * 2)
        require(0 <= at <= 1697164147, 'MOVIE timestamp')
    require(0 <= user <= 2**53 - 1 and 0 <= item <= 2**53 - 1, 'Source identity')
    return user, item, grade, at


SCHEMA = """
CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
CREATE TABLE pairs(u INTEGER,i INTEGER,y INTEGER NOT NULL,t INTEGER NOT NULL,
 first_line INTEGER NOT NULL,n INTEGER NOT NULL,bad INTEGER NOT NULL,
 PRIMARY KEY(u,i)) WITHOUT ROWID;
CREATE TABLE subjects(u INTEGER PRIMARY KEY,role TEXT NOT NULL,ordinal INTEGER NOT NULL);
CREATE INDEX role_order ON subjects(role,ordinal);
CREATE TABLE stats(i INTEGER PRIMARY KEY,s INTEGER NOT NULL,n INTEGER NOT NULL);
CREATE TABLE models(size INTEGER PRIMARY KEY,body TEXT NOT NULL,sha TEXT NOT NULL);
"""


class Store:
    def __init__(self, directory, raw, domain, source, protocol, witnesses):
        require(domain in ('book', 'movie'), 'Unknown domain')
        rights(source)
        self.directory, self.raw, self.domain = directory, raw, domain
        self.source, self.protocol = source, protocol
        self.started = time.monotonic()
        self.exposed = exclusions(domain, witnesses, protocol)
        expected, length, self.minimum = source_spec(domain, source)
        require(raw.stat().st_size == length and bg.file_hash(raw) == expected, 'Source integrity')
        self.identity = {'domain': domain, 'source': digest(source), 'raw': expected, 'bytes': length,
                         'protocol': digest(protocol), 'code': bg.file_hash(Path(__file__)),
                         'bookParser': bg.file_hash(Path(bg.__file__)),
                         'python': sys.version.split()[0], 'sqlite': sqlite3.sqlite_version,
                         'exclusions': protocol[domain]['exclusions']}
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        require(not directory.is_symlink() and directory.stat().st_mode & 0o077 == 0, 'Private directory required')
        db = directory / 'ratings.sqlite'
        fresh = not db.exists()
        self.db = sqlite3.connect(db, timeout=1)
        os.chmod(db, 0o600)
        self.db.execute('PRAGMA cache_size=-32768')
        self.db.execute('PRAGMA temp_store=FILE')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('PRAGMA journal_mode=DELETE')
        self.db.set_progress_handler(self.budget, 100000)
        if fresh:
            self.db.executescript(SCHEMA)
            with self.db:
                self.put('identity', self.identity)
                self.put('ingest', {'rows': 0, 'offset': 0, 'complete': False, 'histogram': {}})
                self.put('resources', {})
        require(self.get('identity') == self.identity, 'Source/code/protocol/runtime identity changed')
        require(not self.get('withdrawn'), 'Source withdrawn; rebuild from newly permitted source in a new store')
        self.prior_resources = self.get('resources')
        self.stage = 'open'

    def get(self, key):
        row = self.db.execute('SELECT v FROM meta WHERE k=?', (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key, value):
        self.db.execute('INSERT INTO meta VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v',
                        (key, json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)))

    def budget(self):
        limit = self.protocol['budgets']
        used = self.prior_resources.get(self.stage, {}).get('seconds', 0) if hasattr(self, 'prior_resources') else 0
        disk = sum(p.stat().st_size for p in self.directory.iterdir() if p.is_file()) + self.raw.stat().st_size
        require(time.monotonic() - self.started + used <= limit['maxStageSeconds'], 'Stage time budget')
        require(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 <= limit['maxRssMiB'], 'RSS budget')
        require(disk <= limit['maxDiskBytes'], 'Disk budget')
        return 0

    def checkpoint_resources(self):
        self.budget()
        prior = self.prior_resources.get(self.stage, {})
        counters = dict(self.prior_resources)
        counters[self.stage] = {'seconds': prior.get('seconds', 0) + time.monotonic() - self.started,
                               'maxRssKiB': max(prior.get('maxRssKiB', 0), resource.getrusage(resource.RUSAGE_SELF).ru_maxrss),
                               'storeBytes': sum(p.stat().st_size for p in self.directory.iterdir() if p.is_file())}
        self.put('resources', counters)

    def close(self):
        self.db.close()

    def start_stage(self, stage):
        self.stage = stage
        self.prior_resources = self.get('resources')
        self.started = time.monotonic()

    def verify_partition(self):
        partition = self.get('partition')
        require(partition and digest(list(self.db.execute('SELECT u,role,ordinal FROM subjects ORDER BY u'))) == partition['sha256'], 'Partition membership changed')

    def ingest(self, stop_after=None):
        self.start_stage('ingest')
        state = self.get('ingest')
        if state['complete']:
            return state
        with self.raw.open('rb') as handle:
            handle.seek(state['offset'])
            if state['offset'] == 0 and self.domain == 'movie':
                require(handle.readline() in (b'userId,movieId,rating,timestamp\n',
                                              b'userId,movieId,rating,timestamp\r\n'), 'CSV header')
            while True:
                batch, eof = [], False
                for _ in range(self.protocol['budgets']['checkpointRows']):
                    line = handle.readline(self.protocol['budgets']['maxLineBytes'] + 1)
                    if not line:
                        eof = True
                        break
                    require(len(line) <= self.protocol['budgets']['maxLineBytes'], 'Record byte budget')
                    user, item, grade, at = parse_line(line, self.domain)
                    state['rows'] += 1
                    require(state['rows'] <= self.source['expectedCounts']['ratings'], 'Source row budget')
                    k = str(grade)
                    state['histogram'][k] = state['histogram'].get(k, 0) + 1
                    batch.append((user, item, grade, at, state['rows']))
                state['offset'] = handle.tell()
                with self.db:
                    self.db.executemany('''INSERT INTO pairs VALUES(?,?,?,?,?,1,0)
                      ON CONFLICT(u,i) DO UPDATE SET n=pairs.n+1,
                      bad=MAX(pairs.bad,pairs.y!=excluded.y OR pairs.t!=excluded.t)''', batch)
                    if eof:
                        require(state['rows'] == self.source['expectedCounts']['ratings'], 'Source row count')
                        require(bg.file_hash(self.raw) == self.identity['raw'], 'Source changed during ingestion')
                        counts = self.db.execute('SELECT COUNT(DISTINCT u),COUNT(DISTINCT i),COUNT(*),SUM(bad),SUM(n-1),SUM(CASE WHEN bad=1 THEN n ELSE 0 END) FROM pairs').fetchone()
                        require(counts[0] == self.source['expectedCounts']['subjects'], 'Source subject count')
                        # MOVIE's catalogue count includes unrated objects; do not fabricate ratings for them.
                        require(counts[1] == self.source['expectedCounts']['objects'] if self.domain == 'book'
                                else counts[1] <= self.source['expectedCounts']['movies'], 'Source object count')
                        state.update(complete=True, uniquePairs=counts[2], conflictingPairs=counts[3],
                                     repeatRows=counts[4], quarantinedRows=counts[5], eligiblePairs=counts[2] - counts[3],
                                     sourceSubjects=counts[0], ratedObjects=counts[1])
                    self.put('ingest', state)
                    self.checkpoint_resources()
                if eof or stop_after is not None and state['rows'] >= stop_after:
                    return state

    def rank(self, kind, value):
        return bg.sha(f'{self.protocol["seed"]}:{self.domain}:{kind}:{value}'.encode())

    def partition(self):
        self.start_stage('partition')
        require(self.get('ingest')['complete'], 'Partial ingestion')
        if self.get('partition'):
            self.verify_partition()
            return self.get('partition')
        rule = self.protocol[self.domain]
        cutoff, test_from = rule.get('trainBefore', 0), rule.get('testFrom', 0)
        # Eligibility uses counts/times only; grade values never enter selection.
        census = self.db.execute('''SELECT u,COUNT(*),SUM(t<?),SUM(t>=? AND t<?),SUM(t>=?)
          FROM pairs WHERE bad=0 GROUP BY u''', (cutoff, cutoff, test_from, test_from))
        candidates, background = [], set()
        for user, total, train, valid, test in census:
            if user in self.exposed:
                continue
            if self.domain == 'book':
                eligible = rule['minimumRatings'] <= total <= rule['maximumRatings']
                train = total
            else:
                eligible = total <= rule['maximumRatings'] and train >= rule['minimumTrain'] and valid >= rule['minimumValidation'] and test >= rule['minimumTest']
            if eligible:
                candidates.append(user)
            if train:
                background.add(user)
        candidates.sort(key=lambda u: (self.rank('evaluation', u), u))
        ndev, nfinal = self.protocol['developmentSubjects'], self.protocol['confirmationSubjects']
        require(len(candidates) >= ndev + nfinal, 'Insufficient untouched evaluation subjects')
        development, confirmation = candidates[:ndev], candidates[ndev:ndev + nfinal]
        background.difference_update(development + confirmation)
        ordered = sorted(background, key=lambda u: (self.rank('background', u), u))
        schedule = [len(ordered) if n == 'ALL' else n for n in self.protocol['trainingSubjects']]
        require(schedule == sorted(set(schedule)) and schedule[-1] <= len(ordered), 'Insufficient background or nonnested sizes')
        rows = [(u, 'development', j) for j, u in enumerate(development)] + [(u, 'confirmation', j) for j, u in enumerate(confirmation)]
        rows += [(u, 'background', j + 1) for j, u in enumerate(ordered)]
        rows += [(u, 'exposed', j) for j, u in enumerate(sorted(self.exposed))]
        identity = digest(sorted(rows))
        summary = {'sha256': identity, 'evaluationEligible': len(candidates), 'backgroundSubjects': len(ordered),
                   'developmentSubjects': ndev, 'confirmationSubjects': nfinal, 'excludedSubjects': len(self.exposed), 'sizes': schedule}
        with self.db:
            self.db.executemany('INSERT INTO subjects VALUES(?,?,?)', rows)
            self.put('partition', summary)
            self.put('fit', {'subjects': 0, 'rows': 0, 'sum': 0, 'complete': False})
            self.checkpoint_resources()
        return summary

    def fit(self, stop_after=None):
        self.start_stage('fit')
        partition = self.get('partition')
        require(partition and self.get('ingest')['complete'], 'Missing complete partition')
        self.verify_partition()
        state = self.get('fit')
        require(state.get('statsSha256', digest([])) == digest(list(self.db.execute('SELECT i,s,n FROM stats ORDER BY i'))), 'Cumulative statistics changed')
        if state['complete']:
            return state
        cutoff = self.protocol[self.domain].get('trainBefore', 0)
        for size in partition['sizes']:
            while state['subjects'] < size:
                end = min(size, state['subjects'] + self.protocol['budgets']['fitCheckpointSubjects'])
                sums = self.db.execute('''SELECT p.i,SUM(p.y),COUNT(*) FROM subjects s JOIN pairs p ON p.u=s.u
                  WHERE s.role='background' AND s.ordinal>? AND s.ordinal<=? AND p.bad=0 AND p.t<? GROUP BY p.i''',
                                       (state['subjects'], end, cutoff)).fetchall()
                require(sums, 'Empty training increment')
                with self.db:
                    self.db.executemany('''INSERT INTO stats VALUES(?,?,?) ON CONFLICT(i) DO UPDATE SET
                      s=stats.s+excluded.s,n=stats.n+excluded.n''', sums)
                    state['subjects'] = end
                    state['rows'] += sum(x[2] for x in sums)
                    state['sum'] += sum(x[1] for x in sums)
                    state['statsSha256'] = digest(list(self.db.execute('SELECT i,s,n FROM stats ORDER BY i')))
                    if end == size:
                        model = {'identity': self.identity, 'partition': partition['sha256'], 'subjects': end,
                                 'rows': state['rows'], 'sum': state['sum'], 'complete': True, 'admission': 'NONE',
                                 'items': {str(i): [s, n] for i, s, n in self.db.execute('SELECT i,s,n FROM stats ORDER BY i')}}
                        self.db.execute('INSERT INTO models VALUES(?,?,?)', (size, json.dumps(model, separators=(',', ':')), digest(model)))
                    state['complete'] = end == partition['sizes'][-1]
                    self.put('fit', state)
                    self.checkpoint_resources()
                if stop_after is not None and end >= stop_after:
                    return state
        return state

    def model(self, size):
        require(not self.get('withdrawn') and self.get('fit')['complete'], 'Absent, withdrawn or partial model')
        row = self.db.execute('SELECT body,sha FROM models WHERE size=?', (size,)).fetchone()
        require(row, 'Absent model')
        model = json.loads(row[0])
        require(digest(model) == row[1] and model['identity'] == self.identity
                and model['partition'] == self.get('partition')['sha256'] and model['complete'], 'Model lineage changed')
        return model

    def evaluation_rows(self, role):
        require(role in ('development', 'confirmation'), 'Evaluation role')
        if role == 'confirmation':
            require(self.get('selectionSha256') and bg.file_hash(self.directory / 'selection.json') == self.get('selectionSha256'), 'Locked selection required before confirmation')
        rule = self.protocol[self.domain]
        all_rows, total = {}, 0
        for (user,) in self.db.execute('SELECT u FROM subjects WHERE role=? ORDER BY ordinal', (role,)):
            rows = list(self.db.execute('SELECT i,y,t FROM pairs WHERE u=? AND bad=0 ORDER BY i', (user,)))
            total += len(rows)
            require(total <= self.protocol['budgets']['maxEvaluationRows'], 'Evaluation row budget')
            if self.domain == 'book':
                rows.sort(key=lambda r: (self.rank(f'mask:{user}', r[0]), r[0]))
                n = max(1, math.floor(len(rows) * rule['targetFraction']))
                targets, visible = rows[:n], rows[n:]
            else:
                visible = [r for r in rows if r[2] < rule['trainBefore']]
                targets = [r for r in rows if (rule['trainBefore'] <= r[2] < rule['testFrom'] if role == 'development' else r[2] >= rule['testFrom'])]
            require(targets and not {r[0] for r in visible} & {r[0] for r in targets}, 'Target leakage')
            all_rows[user] = (visible, targets)
        require(len(all_rows) == self.protocol['developmentSubjects' if role == 'development' else 'confirmationSubjects'], 'Missing evaluation subjects')
        return all_rows

    def evaluate(self, size, rows, budget):
        model = self.model(size)
        expected = set(u for (u,) in self.db.execute("SELECT u FROM subjects WHERE role IN ('development','confirmation')"))
        require(set(rows) <= expected, 'Training/exposed/unknown subject cannot be evaluated')
        subjects, target_hash = [], hashlib.sha256()
        for user, (visible, targets) in rows.items():
            # Exact disk witness protects against tampered/relabelled supplied masks.
            for item, grade, at in visible + targets:
                require(self.db.execute('SELECT y,t,bad FROM pairs WHERE u=? AND i=?', (user, item)).fetchone() == (grade, at, 0), 'Foreign evaluation row')
            require(len({r[0] for r in visible + targets}) == len(visible) + len(targets), 'Duplicate/overlapping evaluation pair')
            if self.domain == 'movie':
                require(all(r[2] < self.protocol['movie']['trainBefore'] for r in visible)
                        and all(r[2] >= self.protocol['movie']['trainBefore'] for r in targets), 'Temporal leakage')
            else:
                require(all(r[2] == -1 for r in visible + targets), 'Invented BOOK time')
            prefix = visible[:budget] if self.domain == 'book' else movie_prefix(visible, budget)
            values = forecasts(model, prefix, [r[0] for r in targets], self.protocol['model'], self.minimum)
            errors = [pred - row[1] for pred, row in zip(values, targets)]
            base_errors = [pred - row[1] for pred, row in zip(forecasts(model, [], [r[0] for r in targets], self.protocol['model'], self.minimum), targets)]
            target_hash.update(bg.canonical([user, targets]))
            subjects.append({'user': user, 'mse': sum(e * e for e in errors) / len(errors),
                             'mae': sum(abs(e) for e in errors) / len(errors), 'bias': sum(errors) / len(errors),
                             'itemMse': sum(e * e for e in base_errors) / len(base_errors),
                             'targets': len(targets), 'visible': len(prefix),
                             'coldItems': sum(str(r[0]) not in model['items'] for r in targets)})
        result = aggregate(subjects)
        result.update(targetSha256=target_hash.hexdigest(), modelSha256=digest(model), trainingRows=model['rows'], trainingSubjects=size)
        return result, subjects

    def curve(self):
        self.start_stage('curve')
        self.verify_partition()
        require(not (self.directory / 'selection.json').exists(), 'Selection already exposed; use retained result')
        rows = self.evaluation_rows('development')
        sizes, budgets = self.get('partition')['sizes'], self.protocol['coldBudgets']
        results, journals = {}, {}
        for size in sizes:
            results[str(size)], journals[size] = {}, {}
            for budget in budgets:
                result, journal = self.evaluate(size, rows, budget)
                results[str(size)][str(budget)], journals[size][budget] = result, journal
                self.budget()
        decision = choose_size(results, sizes, self.protocol)
        primary = self.protocol['primaryBudget']
        decision['pairedDevelopment'] = paired(journals[sizes[0]][primary], journals[decision['selected']][primary], self.protocol)
        with self.db:
            self.checkpoint_resources()
        report = {'identity': self.identity, 'partition': self.get('partition'), 'results': results,
                  'selection': decision, 'resources': self.get('resources'), 'admission': 'NONE'}
        save_new(self.directory / 'development-private.json', journals)
        save_new(self.directory / 'selection.json', report)
        with self.db:
            self.put('selectionSha256', bg.file_hash(self.directory / 'selection.json'))
        return report

    def confirm(self):
        self.start_stage('confirmation')
        self.verify_partition()
        require(not (self.directory / 'confirmation.json').exists(), 'Confirmation already exposed; do not retest')
        require(self.get('selectionSha256') and bg.file_hash(self.directory / 'selection.json') == self.get('selectionSha256'), 'Selection receipt changed')
        selection = read_json(self.directory / 'selection.json')
        require(selection['identity'] == self.identity and selection['partition'] == self.get('partition'), 'Selection lineage changed')
        require(selection['selection'] == {**choose_size(selection['results'], self.get('partition')['sizes'], self.protocol),
                                          'pairedDevelopment': selection['selection']['pairedDevelopment']}, 'Selection decision changed')
        rows = self.evaluation_rows('confirmation')
        small, selected = self.get('partition')['sizes'][0], selection['selection']['selected']
        results, journals = {}, {}
        for size in sorted({small, selected}):
            results[str(size)], journals[size] = {}, {}
            for budget in self.protocol['coldBudgets']:
                result, journal = self.evaluate(size, rows, budget)
                results[str(size)][str(budget)], journals[size][budget] = result, journal
                self.budget()
        comparison = paired(journals[small][self.protocol['primaryBudget']], journals[selected][self.protocol['primaryBudget']], self.protocol)
        rule = self.protocol['decision']
        guard = cold_guard(results[str(small)], results[str(selected)], self.protocol)
        passed = selected != small and comparison['rmseDelta'] <= -rule['minimumGain'] and comparison['interval95'][1] < 0 and guard
        with self.db:
            self.checkpoint_resources()
        report = {'identity': self.identity, 'selectionSha256': bg.file_hash(self.directory / 'selection.json'),
                  'results': results, 'comparison': comparison, 'coldGuardsPassed': guard,
                  'disposition': 'RETAIN_LARGER_RESEARCH_MODEL' if passed else 'RETAIN_SMALL_RESEARCH_CONTROL',
                  'resources': self.get('resources'), 'admission': 'NONE', 'nativeCatalogueMapping': 'NOT_QUERIED'}
        save_new(self.directory / 'confirmation-private.json', journals)
        save_new(self.directory / 'confirmation.json', report)
        return report

    def withdraw(self):
        with self.db:
            self.put('withdrawn', {'source': self.identity['source'], 'allDerivedModelsInvalid': True})
            self.db.execute('DELETE FROM models')
            self.db.execute('DELETE FROM stats')
        return {'withdrawn': True, 'replacement': 'New permitted source and new complete run required', 'admission': 'NONE'}


def movie_prefix(rows, budget):
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row[2]].append(row)
    result = []
    for at in sorted(groups, reverse=True):
        group = sorted(groups[at])
        if len(result) + len(group) > budget:
            break
        result.extend(group)
    return result


def forecasts(model, visible, targets, config, minimum):
    require(model['complete'] and model['rows'] > 0 and model['admission'] == 'NONE', 'Partial/invalid research model')
    require(not {r[0] for r in visible} & set(targets), 'Target leakage')
    mean = model['sum'] / model['rows']
    def base(item):
        total, n = model['items'].get(str(item), [0, 0])
        return (total + config['itemShrinkage'] * mean) / (n + config['itemShrinkage'])
    offset = sum(y - base(i) for i, y, _ in visible) / (len(visible) + config['subjectShrinkage'])
    return [min(10, max(minimum, base(i) + offset)) for i in targets]


def native_fallback(native_grades):
    """Absent/disallowed/withdrawn external model: only separately supplied native evidence."""
    require(all(type(x) is int and 0 <= x <= 10 for x in native_grades), 'Invalid native grade')
    return sum(native_grades) / len(native_grades) if native_grades else None


def aggregate(subjects):
    n = len(subjects)
    require(n > 0, 'No evaluation subjects')
    targets = sum(r['targets'] for r in subjects)
    return {'subjects': n, 'targets': targets, 'coverage': 1,
            'rmse': math.sqrt(sum(r['mse'] for r in subjects) / n),
            'mae': sum(r['mae'] for r in subjects) / n, 'bias': sum(r['bias'] for r in subjects) / n,
            'itemOnlyRmse': math.sqrt(sum(r['itemMse'] for r in subjects) / n),
            'coldItemFraction': sum(r['coldItems'] for r in subjects) / targets,
            'visibleMean': sum(r['visible'] for r in subjects) / n,
            'zeroVisibleSubjects': sum(r['visible'] == 0 for r in subjects)}


def paired(control, candidate, protocol):
    require([r['user'] for r in control] == [r['user'] for r in candidate], 'Unpaired subjects')
    require([r['targets'] for r in control] == [r['targets'] for r in candidate], 'Unpaired targets')
    n = len(control)
    rng = random.Random(protocol['seed'] + ':paired')
    deltas = []
    for _ in range(protocol['decision']['bootstrapReplicates']):
        indices = [rng.randrange(n) for _ in range(n)]
        deltas.append(math.sqrt(sum(candidate[i]['mse'] for i in indices) / n) - math.sqrt(sum(control[i]['mse'] for i in indices) / n))
    deltas.sort()
    quantile = lambda q: deltas[math.floor(q * (len(deltas) - 1))]
    return {'rmseDelta': math.sqrt(sum(r['mse'] for r in candidate) / n) - math.sqrt(sum(r['mse'] for r in control) / n),
            'interval95': [quantile(.025), quantile(.975)], 'subjects': n}


def cold_guard(control, candidate, protocol):
    rule = protocol['decision']
    return all(candidate[str(b)]['coverage'] == rule['requiredCoverage']
               and candidate[str(b)]['targetSha256'] == control[str(b)]['targetSha256']
               and candidate[str(b)]['rmse'] - control[str(b)]['rmse'] <= rule['maximumColdRmseIncrease']
               for b in protocol['coldBudgets']) and candidate[str(protocol['primaryBudget'])]['mae'] - control[str(protocol['primaryBudget'])]['mae'] <= rule['maximumMaeIncrease']


def choose_size(results, sizes, protocol):
    primary = str(protocol['primaryBudget'])
    best = min(results[str(n)][primary]['rmse'] for n in sizes)
    eligible = [n for n in sizes if results[str(n)][primary]['rmse'] <= best + protocol['decision']['nearBestRmse']
                and cold_guard(results[str(sizes[0])], results[str(n)], protocol)]
    return {'selected': min(eligible) if eligible else sizes[0], 'bestDevelopmentRmse': best,
            'rule': 'SMALLEST_NEAR_BEST_WITH_COLD_GUARDS', 'confirmationRead': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['expand', 'ingest', 'partition', 'fit', 'curve', 'confirm', 'withdraw'])
    parser.add_argument('--domain', required=True, choices=['book', 'movie'])
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--directory', required=True, type=Path)
    parser.add_argument('--exclude', nargs='*', type=Path, default=[])
    parser.add_argument('--stop-after', type=int)
    args = parser.parse_args()
    protocol = read_json(PROTOCOL)
    source = read_json(PROTOCOL.parent / protocol[args.domain]['sourceManifest'])
    with exclusive_run(args.directory):
        if args.command == 'expand':
            expand_source(args.domain, source, args.input, args.directory / 'source-ratings.txt')
            print(json.dumps({'expanded': True, 'admission': 'NONE'}))
            return
        store = Store(args.directory, args.input, args.domain, source, protocol, args.exclude)
        try:
            command = getattr(store, args.command)
            result = command(args.stop_after) if args.command in ('ingest', 'fit') else command()
            print(json.dumps(result, allow_nan=False))
        except Exception as error:
            # Attempt record is private; arbitrary input values and histories stay out of logs.
            with store.db:
                store.put('lastFailure', {'stage': args.command, 'kind': type(error).__name__})
            raise
        finally:
            store.close()


if __name__ == '__main__':
    main()
