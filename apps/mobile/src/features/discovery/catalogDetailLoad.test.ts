import React, { type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ATTRIBUTED_DESCRIPTION } from '@kajo/catalog-contracts';
import fixture from '../../../../../packages/catalog-contracts/fixtures.json';
import { getRoomTheme } from '../../theme/roomTheme';
import { CATALOG_DETAIL_TIMEOUT_MS, startCatalogDetailLoad, type CatalogDetailResult } from './catalogDetailLoad';
import { clearPredictionItemCacheForTests, rememberPredictionItems } from './predictionRankingCache';
import { getMockItem } from './mockDiscovery';
import { DescriptionCredit } from './DescriptionCredit';
import { ItemDescription } from './ItemDescription';

vi.mock('react-native', () => ({
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  Alert: { alert: vi.fn() }, Linking: { openURL: vi.fn() },
  StyleSheet: { create: (value: unknown) => value },
}));

const itemId = '00000000-0000-4000-8000-000000000182';
const row = { id: itemId, item_type: 'BOOK', title: 'Canonical synthetic book',
  description: fixture.description, tags: ['fiction'], creators: ['Test author'], release_year: 2020,
  image_url: null, original_language: 'en', metadata: { descriptionProvenance: {
    contract: ATTRIBUTED_DESCRIPTION, textSha256: fixture.attribution.textSha256,
    recordSha256: fixture.attribution.recordSha256, attribution: fixture.attribution,
  } } };

type Response = { data: unknown; error: unknown };
function fakeClient(response: Promise<Response> | Response) {
  const read = vi.fn().mockImplementation(() => Promise.resolve(response));
  const select = vi.fn(() => ({ in: read }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, read };
}
function load(client: SupabaseClient) {
  return new Promise<CatalogDetailResult>(resolve => startCatalogDetailLoad(client, itemId, resolve));
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}
type NodeProps = { children?: ReactNode; attribution?: unknown };
function nodes(value: ReactNode): ReactElement<NodeProps>[] {
  return React.Children.toArray(value).flatMap(child => React.isValidElement<NodeProps>(child)
    ? [child, ...nodes(child.props.children)] : []);
}

beforeEach(() => { vi.useFakeTimers(); clearPredictionItemCacheForTests(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); clearPredictionItemCacheForTests(); });

describe('canonical List/history detail entry', () => {
  it('opens a cold Item absent from every recommendation and carries credit into the actual renderer', async () => {
    expect(getMockItem(itemId)).toBeUndefined(); // The previous detail-only cache lookup lost this Item.
    const api = fakeClient({ data: [row], error: null });
    const result = await load(api.client);
    expect(api.from).toHaveBeenCalledWith('items');
    expect(api.select).toHaveBeenCalledWith(expect.stringContaining('metadata'));
    expect(api.read).toHaveBeenCalledWith('id', [itemId]);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected canonical Item');
    expect(result.item.title).toBe(row.title);
    for (const expanded of [false, true]) {
      const output = nodes(ItemDescription({ item: result.item, expanded, onExpandedChange: vi.fn(), theme: getRoomTheme('DAWN') }));
      expect(output.find(node => node.type === DescriptionCredit)?.props.attribution).toEqual(fixture.attribution);
    }
    expect(getMockItem(itemId)).toBeUndefined(); // Reading a List does not fabricate a delivered slate.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not reuse stale description text from a different cached recommendation', async () => {
    rememberPredictionItems('unrelated-prediction', [{ id: itemId, itemType: 'BOOK', title: 'Old title',
      description: 'Stale text', descriptionStatus: 'legacy' }]);
    const result = await load(fakeClient({ data: [row], error: null }).client);
    expect(result).toMatchObject({ status: 'ready', item: { title: row.title,
      description: fixture.description, descriptionAttribution: fixture.attribution } });
  });

  it.each([{ label: 'empty response', data: [] }, { label: 'wrong Item', data: [{ ...row, id: 'unrequested-item' }] }])('reports a missing Item without borrowing another row: $label', async ({ data }) => {
    expect(await load(fakeClient({ data, error: null }).client)).toEqual({ status: 'missing' });
  });

  it.each([{ label: 'missing metadata', metadata: undefined }, { label: 'null metadata', metadata: null },
    { label: 'missing credit', metadata: { descriptionProvenance: null } },
    { label: 'unsafe link', metadata: { descriptionProvenance: { ...row.metadata.descriptionProvenance,
      attribution: { ...fixture.attribution, sourceUrl: 'javascript:alert(1)' } } } }])(
    'keeps the Item usable but withholds text when its canonical credit is invalid: $label', async ({ metadata }) => {
      const result = await load(fakeClient({ data: [{ ...row, metadata }], error: null }).client);
      expect(result).toMatchObject({ status: 'ready', item: { title: row.title, descriptionStatus: 'unverified' } });
      if (result.status !== 'ready') throw new Error('Expected title without credit');
      expect(ItemDescription({ item: result.item, expanded: true,
        onExpandedChange: vi.fn(), theme: getRoomTheme('DAWN') })).toBeNull();
    },
  );

  it('returns a recoverable error, hides backend diagnostics and retries the same Item', async () => {
    const api = fakeClient({ data: null, error: { message: 'Private backend diagnostic' } });
    expect(await load(api.client)).toEqual({ status: 'error' });
    api.read.mockResolvedValue({ data: [row], error: null });
    expect(await load(api.client)).toMatchObject({ status: 'ready', item: { id: itemId } });
    expect(api.read.mock.calls).toEqual([['id', [itemId]], ['id', [itemId]]]);
  });

  it('treats thrown network failures and malformed catalog responses as recoverable errors', async () => {
    const api = fakeClient({ data: [{ ...row, title: null }], error: null });
    expect(await load(api.client)).toEqual({ status: 'error' });
    api.read.mockRejectedValue(new Error('Connection reset'));
    expect(await load(api.client)).toEqual({ status: 'error' });
  });

  it('ignores the cancelled scope after a new scope has loaded the same Item', async () => {
    const old = deferred();
    const onOldResult = vi.fn();
    const cancel = startCatalogDetailLoad(fakeClient(old.promise).client, itemId, onOldResult);
    cancel();
    expect(await load(fakeClient({ data: [row], error: null }).client)).toMatchObject({ status: 'ready' });
    old.resolve({ data: [{ ...row, title: 'Old scope result' }], error: null });
    await vi.advanceTimersByTimeAsync(CATALOG_DETAIL_TIMEOUT_MS);
    expect(onOldResult).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled read, permits retry and ignores the late result from the timed-out attempt', async () => {
    const stalled = deferred();
    const onResult = vi.fn();
    startCatalogDetailLoad(fakeClient(stalled.promise).client, itemId, onResult);
    await vi.advanceTimersByTimeAsync(CATALOG_DETAIL_TIMEOUT_MS - 1);
    expect(onResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ status: 'error' });
    expect(await load(fakeClient({ data: [row], error: null }).client)).toMatchObject({ status: 'ready' });
    stalled.resolve({ data: [row], error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
