"""Read-only identity/coverage audit. No forecast fitting or serving export."""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'research/manifests/catalogue-admission-v1.json'


def snapshot_sql():
    query = (ROOT / 'scripts/catalog/catalog-feature-snapshot.sql').read_text()
    require(query.count('begin read only;') == query.count('commit;') == 1, 'Unexpected snapshot SQL')
    select = query[query.index('select jsonb_build_object('):query.rindex('commit;')].strip().removesuffix(';')
    return ("begin read only;\nwith snapshot as (" + select + ")\n"
            "select jsonb_build_object('featureSnapshot', catalog_feature_snapshot, 'aliases', "
            "(select coalesce(jsonb_agg(jsonb_build_object('namespace',a.namespace,'externalId',a.external_id,"
            "'itemId',a.item_id,'itemType',i.item_type,'discoverable',i.discoverable) order by a.namespace,a.external_id), "
            "'[]'::jsonb) from private.item_external_ids a join public.items i on i.id=a.item_id)) "
            "as audit_input from snapshot;\ncommit;")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def read(path, limit):
    require(path.is_file() and path.stat().st_size <= limit, 'Input size')
    data = path.read_bytes()
    require(len(data) <= limit, 'Input size changed')
    return data


def parse_links(data, expected):
    require(len(data) == expected['bytes'] and hashlib.sha256(data).hexdigest() == expected['sha256'], 'Source bytes changed')
    reader = csv.DictReader(io.StringIO(data.decode('utf-8'), newline=''))
    require(reader.fieldnames == ['movieId', 'imdbId', 'tmdbId'], 'Link header')
    rows = []
    for row in reader:
        require(set(row) == set(reader.fieldnames) and all(isinstance(v, str) for v in row.values()), 'Link row')
        require(re.fullmatch(r'[1-9][0-9]{0,14}', row['movieId']), 'Movie identity')
        require(not row['tmdbId'] or re.fullmatch(r'[1-9][0-9]{0,14}', row['tmdbId']), 'TMDB identity')
        require(not row['imdbId'] or re.fullmatch(r'[0-9]{7,15}', row['imdbId']), 'IMDb identity')
        aliases = {}
        if row['imdbId']:
            aliases['imdb_title'] = 'tt' + row['imdbId']
        if row['tmdbId']:
            aliases['tmdb_movie'] = row['tmdbId']
        rows.append((row['movieId'], aliases))
        require(len(rows) <= 100000, 'Source object budget')
    return rows


def audit_links(rows, snapshot, supported):
    """Full-release alias quarantine precedes current-catalogue intersection."""
    items = {i['itemId']: i for i in snapshot['featureSnapshot']['items']}
    require(len(items) == len(snapshot['featureSnapshot']['items']) <= 20000, 'Duplicate/budget Item')
    aliases = snapshot['aliases']
    require(len(aliases) <= 200000, 'Alias budget')
    native, by_item, attributes = collections.defaultdict(set), collections.defaultdict(lambda: collections.defaultdict(set)), {}
    for a in aliases:
        require(set(a) == {'itemId', 'namespace', 'externalId', 'itemType', 'discoverable'}, 'Native alias shape')
        require(all(isinstance(a[k], str) and 0 < len(a[k]) <= 512 for k in ['itemId', 'namespace', 'externalId', 'itemType'])
                and type(a['discoverable']) is bool, 'Native alias values')
        identity = (a['itemType'], a['discoverable'])
        require(a['itemId'] not in attributes or attributes[a['itemId']] == identity, 'Inconsistent Item attributes')
        attributes[a['itemId']] = identity
        if a['itemId'] in items:
            require(a['discoverable'] and items[a['itemId']]['itemType'] == a['itemType'], 'Snapshot Item mismatch')
        elif a['discoverable'] and a['itemType'] in ('BOOK', 'MOVIE'):
            raise ValueError('Incomplete active Item snapshot')
        native[(a['namespace'], a['externalId'])].add(a['itemId'])
        by_item[a['itemId']][a['namespace']].add(a['externalId'])
    source = collections.defaultdict(set)
    frequencies = collections.Counter(i for i, _ in rows)
    require(supported <= set(frequencies), 'Training object absent from source links')
    for i, aa in rows:
        for key in aa.items():
            source[key].add(i)
    decisions = {}
    for i, aa in rows:
        status, target = 'UNMAPPED', None
        candidates = set().union(*(native[key] for key in aa.items())) if aa else set()
        if frequencies[i] != 1:
            status = 'DUPLICATE_SOURCE_OBJECT'
        elif any(len(source[key]) > 1 for key in aa.items()):
            status = 'SOURCE_ALIAS_CONFLICT'
        elif len(candidates) > 1 or any(len(native[key]) > 1 for key in aa.items()):
            status = 'NATIVE_ALIAS_CONFLICT'
        elif candidates:
            target = next(iter(candidates))
            if attributes[target][0] != 'MOVIE':
                status = 'WRONG_DOMAIN'
            elif any(by_item[target][ns] and by_item[target][ns] != {value} for ns, value in aa.items()):
                status = 'CROSS_ALIAS_DISAGREEMENT'
            elif not attributes[target][1]:
                status = 'INACTIVE_ITEM'
            else:
                providers = [s for s in items[target]['sources'] if s['providerKey'] == 'tmdb']
                if (len(providers) != 1 or providers[0]['identityMatches'] is not True
                        or by_item[target]['tmdb_movie'] != {providers[0]['providerItemId']}):
                    status = 'NATIVE_SOURCE_UNVERIFIED'
                else:
                    status = 'MATCHED'
        decisions[i] = {'sourceObjectId': i, 'itemId': target, 'status': status,
                        'candidateItemIds': sorted(candidates)}
    # Different unambiguous source rows may still converge through different aliases.
    targets = collections.defaultdict(list)
    for row in decisions.values():
        if row['status'] == 'MATCHED':
            targets[row['itemId']].append(row)
    for group in targets.values():
        if len(group) > 1:
            for row in group:
                row['status'] = 'NON_UNIQUE_CANONICAL_TARGET'
    matched = [r for r in decisions.values() if r['status'] == 'MATCHED']
    coverage = collections.Counter(r['status'] for r in decisions.values())
    active_movies = sum(i['itemType'] == 'MOVIE' for i in items.values())
    active_books = sum(i['itemType'] == 'BOOK' for i in items.values())
    native_status = {}
    for item_id, item in items.items():
        if item['itemType'] == 'MOVIE':
            affected = [r['status'] for r in decisions.values() if item_id in r['candidateItemIds']]
            native_status[item_id] = ('MATCHED' if 'MATCHED' in affected else
                                     '|'.join(sorted(set(affected))) if affected else 'NO_SOURCE_ALIAS_MATCH')
    report = {
        'sourceLinkRows': len(rows), 'sourceObjects': len(decisions),
        'sourceAliasConflicts': sum(len(v) > 1 for v in source.values()),
        'sourceDisposition': dict(sorted(coverage.items())),
        'activeMovieItems': active_movies, 'exactMappedMovieItems': len(matched),
        'activeMoviesWithoutVerifiedMapping': active_movies - len(matched),
        'activeMovieDisposition': dict(sorted(collections.Counter(native_status.values()).items())),
        'mappedMovieItemsWithTrainingSupport': sum(r['sourceObjectId'] in supported for r in matched),
        'mappedMovieItemsWithoutTrainingSupport': sum(r['sourceObjectId'] not in supported for r in matched),
        'sourceObjectsWithTrainingSupport': len(supported),
        'book': {'activeItems': active_books, 'verifiedMappings': 0,
                 'disposition': 'NO_REVIEWED_BOOK_GENOME_TO_OPEN_LIBRARY_CROSSWALK',
                 'actualOverlap': 'UNKNOWN'},
        'nativeAliasNamespaces': dict(sorted(collections.Counter(a['namespace'] for a in aliases).items())),
        'admission': 'NONE', 'fallback': 'EXISTING_NATIVE_ONLY',
    }
    return report, sorted(decisions.values(), key=lambda r: int(r['sourceObjectId']))


def model_support(path, expected, source_manifest, protocol):
    # Read only model/meta tables; never open evaluation people or rating histories.
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.execute('PRAGMA query_only=ON')
        meta = {k: json.loads(v) for k, v in db.execute('SELECT k,v FROM meta')}
        require(not meta.get('withdrawn') and meta.get('fit', {}).get('complete') is True, 'Model absent/partial/withdrawn')
        row = db.execute('SELECT body,sha FROM models WHERE sha=?', (expected,)).fetchall()
        require(len(row) == 1, 'Expected model unavailable')
        model = json.loads(row[0][0])
        require(digest(model) == expected and model['complete'] is True and model['admission'] == 'NONE', 'Model changed')
        require(model['identity'] == meta['identity'] and model['partition'] == meta['partition']['sha256'], 'Model lineage changed')
        require(model['identity']['domain'] == 'movie' and model['identity']['source'] == digest(source_manifest)
                and model['identity']['protocol'] == digest(protocol)
                and model['identity']['raw'] == source_manifest['sourceVerification']['files']['ml-32m/ratings.csv']['sha256'], 'Source/plan changed')
        require(all(re.fullmatch(r'[1-9][0-9]{0,14}', i) and len(v) == 2
                    and all(type(n) is int for n in v) and v[1] > 0 and v[1] <= v[0] <= 10 * v[1]
                    for i, v in model['items'].items()), 'Invalid item statistics')
        require(sum(v[1] for v in model['items'].values()) == model['rows']
                and sum(v[0] for v in model['items'].values()) == model['sum'], 'Invalid model totals')
        return set(model['items'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--print-snapshot-sql', action='store_true')
    parser.add_argument('--snapshot', type=Path)
    parser.add_argument('--links', type=Path)
    parser.add_argument('--movie-store', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.print_snapshot_sql:
        require(not any([args.snapshot, args.links, args.movie_store, args.out]), 'SQL-only command')
        print(snapshot_sql())
        return
    require(all([args.snapshot, args.links, args.movie_store, args.out]), 'All four paths required')
    plan = json.loads(PLAN.read_text())
    source = json.loads((ROOT / plan['movieSourceManifest']).read_text())
    protocol = json.loads((ROOT / plan['trainingProtocol']).read_text())
    snapshot_bytes = read(args.snapshot, 64 * 1024 * 1024)
    snapshot = json.loads(snapshot_bytes)
    require(set(snapshot) == {'featureSnapshot', 'aliases'}, 'Snapshot shape')
    links = read(args.links, 4 * 1024 * 1024)
    rows = parse_links(links, source['sourceVerification']['files']['ml-32m/links.csv'])
    require(len(rows) == source['expectedCounts']['movies'], 'Source catalogue count')
    support = model_support(args.movie_store, plan['movieModelSha256'], source, protocol)
    report, private = audit_links(rows, snapshot, support)
    report.update(version=plan['version'], checkedAt=snapshot['featureSnapshot']['checkedAt'],
                  inputSha256=hashlib.sha256(snapshot_bytes).hexdigest(),
                  linksSha256=hashlib.sha256(links).hexdigest(), planSha256=digest(plan),
                  codeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  snapshotSqlSha256=hashlib.sha256(snapshot_sql().encode()).hexdigest(),
                  modelSha256=plan['movieModelSha256'],
                  privateDecisionsSha256=digest(private))
    args.out.mkdir(mode=0o700)
    for filename, data in [('coverage.json', report), ('mapping-private.json', private)]:
        path = args.out / filename
        with path.open('x') as f:
            path.chmod(0o600)
            json.dump(data, f, indent=2, allow_nan=False)
            f.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
