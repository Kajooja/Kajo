import { describe, expect, it } from 'vitest';
import { visibleItemDescription } from '../mobile/src/domain/itemDescription';
import { acceptanceCases } from './fixtures';

describe('isolated description acceptance cases', () => {
  it('renders a bound long paragraph and separately identifiable real HTTPS test destinations', () => {
    const valid = acceptanceCases.find(test => test.id === 'attributed')!;
    const visible = visibleItemDescription(valid.item);
    expect(visible.descriptionStatus).toBe('attributed');
    expect(visible.description!.length).toBeGreaterThan(500);
    expect(visible.descriptionAttribution?.sourceUrl).toBe('https://example.com/?kajo-description-test=source');
    expect(visible.descriptionAttribution?.licenseUrl).toBe('https://example.com/?kajo-description-test=license');
    expect(visible.descriptionAttribution).not.toHaveProperty('permission');
  });

  it.each(['missing-credit', 'unsafe-link', 'changed-text', 'text-only'])(
    'withholds %s text without losing the Item title', id => {
      const test = acceptanceCases.find(candidate => candidate.id === id)!;
      expect(visibleItemDescription(test.item).description).toBeUndefined();
      expect(visibleItemDescription(test.item).descriptionAttribution).toBeUndefined();
      expect(test.item.title).toBe('Synteettinen testikirja');
    },
  );

  it('preserves explicit legacy text and the empty-description case without fabricating credit', () => {
    const legacy = visibleItemDescription(acceptanceCases.find(test => test.id === 'legacy')!.item);
    expect(legacy.descriptionStatus).toBe('legacy');
    expect(legacy.description).toBeTruthy();
    expect(legacy.descriptionAttribution).toBeUndefined();
    expect(visibleItemDescription(acceptanceCases.find(test => test.id === 'empty')!.item)).toEqual({});
  });
});
