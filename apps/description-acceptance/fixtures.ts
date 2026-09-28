import { ATTRIBUTED_DESCRIPTION, descriptionTextHash, type DescriptionAttribution } from '@kajo/catalog-contracts';
import sourceFixture from '../../packages/catalog-contracts/fixtures.json';
import type { Item } from '../mobile/src/domain/contracts';
import { readCatalogDescription } from '../mobile/src/domain/itemDescription';

const text = Array.from({ length: 6 }, () => sourceFixture.description).join(' ');
const credit: DescriptionAttribution = {
  ...sourceFixture.attribution,
  contract: 'description-attribution-v1',
  sourceTitle: 'Synteettinen lähde pitkän lähdenimen ja rivittymisen testaamiseen',
  sourceUrl: 'https://example.com/?kajo-description-test=source',
  licenseUrl: 'https://example.com/?kajo-description-test=license',
  licenseName: 'Synteettinen testilisenssi',
  credit: 'Kajo-testiaineisto. Tämä itse luotu esimerkkiteksti ja sen pitkät lähdetiedot on tarkoitettu ainoastaan kuvausnäkymän rivittymisen ja saavutettavuuden testaamiseen.',
  changes: 'Synteettinen teksti toistettiin pitkän kuvauksen testaamista varten.',
  textSha256: descriptionTextHash(text),
};
const base: Item = {
  id: '00000000-0000-4000-8000-000000000182',
  itemType: 'BOOK',
  title: 'Synteettinen testikirja',
  creators: ['Kajo-testiaineisto'],
};
const valid: Item = { ...base, ...readCatalogDescription(text, {
  descriptionProvenance: {
    contract: ATTRIBUTED_DESCRIPTION,
    textSha256: credit.textSha256,
    recordSha256: credit.recordSha256,
    attribution: credit,
  },
}) };

export const acceptanceCases: readonly { id: string; label: string; expected: string; item: Item }[] = [
  { id: 'attributed', label: 'Kelvollinen lähdetieto',
    expected: 'Kuvaus näkyy. Lähdetiedot näkyvät myös kuvauksen ollessa tiivistettynä. Molemmat testilinkit avaavat example.com-sivun eri osoitteilla.', item: valid },
  { id: 'missing-credit', label: 'Puuttuva lähdetieto',
    expected: 'Kuvaus ja lähdetiedot puuttuvat. Kirjan nimi säilyy.',
    item: { ...base, description: text, descriptionStatus: 'attributed' } },
  { id: 'unsafe-link', label: 'Turvaton lähdelinkki',
    expected: 'Kuvaus ja lähdetiedot puuttuvat. Turvatonta linkkiä ei voi avata.',
    item: { ...valid, descriptionAttribution: { ...credit, sourceUrl: 'javascript:alert(1)' } } },
  { id: 'changed-text', label: 'Muuttunut välimuistiteksti',
    expected: 'Muuttunut kuvaus ja sen lähdetiedot puuttuvat. Kirjan nimi säilyy.',
    item: { ...valid, description: `${text} Changed after validation.` } },
  { id: 'text-only', label: 'Pelkkä rajapinnan teksti',
    expected: 'Kuvaus puuttuu, kun kanonisia lähdetietoja ei ole saatu.',
    item: { ...base, description: text, descriptionStatus: 'unverified' } },
  { id: 'legacy', label: 'Vanha merkitsemätön kuvaus',
    expected: 'Vanha kuvaus näkyy ilman keksittyä lähdemerkintää.',
    item: { ...base, ...readCatalogDescription(sourceFixture.description, {}) } },
  { id: 'empty', label: 'Ei kuvausta',
    expected: 'Kirjan nimi näkyy. Kuvaus ja lähdetiedot puuttuvat.', item: base },
];
