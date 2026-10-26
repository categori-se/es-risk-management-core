// Bibliographic formats are generated from an exact-edition metadata snapshot.
// Stored-file URLs, extraction text and account data are never citation fields.
const clean = value => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
const fail = message => {throw Object.assign(new TypeError(message), {status: 400, statusCode: 400});};
const csv = value => {const result = clean(value);return '"' + (/^[=+@-]/.test(result) ? "'" : '') + result.replace(/"/g, '""') + '"';};
const names = value => (value || []).map(author => typeof author === 'string' ? clean(author) : clean(author.literal || [author.family, author.given].filter(Boolean).join(', ')));
function source(record) {if (!record || typeof record !== 'object') fail('Choose a resource citation record.');return record.citation && typeof record.citation === 'object' ? record.citation : record;}
function identified(record, type) {return record.identifiers?.find(item => String(item.type).toLowerCase() === type)?.value || '';}
function yearParts(value) {const match = /^(\d{4})(?:-(\d\d)(?:-(\d\d))?)?$/.exec(value || '');return match ? [match.slice(1).filter(Boolean).map(Number)] : undefined;}
function authorCsl(author) {return typeof author === 'string' ? {literal: clean(author)} : Object.fromEntries(['literal', 'family', 'given', 'suffix'].filter(key => author[key]).map(key => [key, clean(author[key]) ]));}
export function resourceToCslJson(record) {
  const item = source(record), result = {id: item.resourceVersionId || item.id || item.resourceId, type: ['research_paper'].includes(item.type) ? 'article-journal' : 'report', title: clean(item.title), author: (item.authors || []).map(authorCsl)};
  const fields = {'publisher': item.publisher, 'edition': item.edition, 'URL': item.officialUrl, 'language': item.language, 'collection-title': item.series, 'number': item.reportNumber, 'DOI': identified(item, 'doi'), 'ISBN': identified(item, 'isbn'), 'ISSN': identified(item, 'issn')};
  for (const [key, value] of Object.entries(fields)) if (value) result[key] = clean(value);
  const issued = yearParts(item.publicationDate);if (issued) result.issued = {'date-parts': issued};return result;
}
function bib(value) {return clean(value).replace(/[\\{}%&#_$~^]/g, character => ({'\\': '\\textbackslash{}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'}[character] || '\\' + character));}
export function resourceToBibtex(record) {
  const item = source(record), key = ('resource_' + (item.resourceVersionId || item.id || item.resourceId || 'citation')).replace(/[^A-Za-z0-9_:-]/g, '_');
  const author = (item.authors || []).map(value => typeof value === 'string' || value.literal ? '{' + bib(typeof value === 'string' ? value : value.literal) + '}' : bib([value.family, value.given].filter(Boolean).join(', '))).join(' and ');
  const fields = {title: bib(item.title), author, institution: bib(item.publisher), year: clean(item.publicationDate).slice(0, 4), edition: bib(item.edition), series: bib(item.series), number: bib(item.reportNumber), doi: bib(identified(item, 'doi')), isbn: bib(identified(item, 'isbn')), issn: bib(identified(item, 'issn')), url: bib(item.officialUrl), language: bib(item.language)};
  return `@${item.type === 'research_paper' ? 'article' : 'techreport'}{${key},\n${Object.entries(fields).filter(([, value]) => value).map(([key, value]) => `  ${key} = {${value}}`).join(',\n')}\n}`;
}
export function resourceToRis(record) {
  const item = source(record), rows = [['TY', item.type === 'research_paper' ? 'JOUR' : 'RPRT'], ['ID', item.resourceVersionId || item.id || item.resourceId], ['TI', item.title], ...names(item.authors).map(name => ['AU', name]), ['PB', item.publisher], ['PY', item.publicationDate], ['ET', item.edition], ['T2', item.series], ['M1', item.reportNumber], ['DO', identified(item, 'doi')], ['SN', identified(item, 'isbn') || identified(item, 'issn')], ['UR', item.officialUrl], ['LA', item.language]];
  return rows.filter(([, value]) => value).map(([key, value]) => `${key}  - ${clean(value)}`).join('\r\n') + '\r\nER  -\r\n';
}
export const resourceCitationCsvColumns = Object.freeze(['resourceId', 'resourceVersionId', 'title', 'authors', 'publisher', 'publicationDate', 'edition', 'type', 'language', 'doi', 'isbn', 'issn', 'officialUrl']);
function csvRow(record) {const item = source(record);return resourceCitationCsvColumns.map(key => csv(key === 'authors' ? names(item.authors).join('; ') : ['doi', 'isbn', 'issn'].includes(key) ? identified(item, key) : item[key])).join(',');}
export function resourceToCsv(record) {return resourceCitationCsvColumns.join(',') + '\r\n' + csvRow(record) + '\r\n';}
export function exportResourceCitations(records, format = 'csl-json') {
  if (!Array.isArray(records) || records.length > 20000) fail('Choose a bounded resource citation list.');
  if (format === 'csl-json' || format === 'csl') return JSON.stringify(records.map(resourceToCslJson), null, 2);
  if (format === 'bibtex' || format === 'bib') return records.map(resourceToBibtex).join('\n\n') + (records.length ? '\n' : '');
  if (format === 'ris') return records.map(resourceToRis).join('\r\n');
  if (format === 'csv') return resourceCitationCsvColumns.join(',') + '\r\n' + records.map(csvRow).join('\r\n') + (records.length ? '\r\n' : '');
  fail('Choose CSL-JSON, BibTeX, RIS or CSV citation export.');
}
export function resourceBibliographicMappings(record) {
  const item = source(record), creators = names(item.authors), identifier = item.resourceVersionId ? `urn:uuid:${item.resourceVersionId}` : item.officialUrl;
  const dublinCore = {'@context': {dcterms: 'http://purl.org/dc/terms/'}, '@id': identifier, 'dcterms:title': clean(item.title), 'dcterms:creator': creators, 'dcterms:publisher': clean(item.publisher), 'dcterms:issued': clean(item.publicationDate), 'dcterms:language': clean(item.language), 'dcterms:type': clean(item.type), 'dcterms:source': clean(item.officialUrl), 'dcterms:isVersionOf': item.resourceId ? `urn:uuid:${item.resourceId}` : undefined, 'dcterms:bibliographicCitation': [creators.join('; '), item.publicationDate, item.title, item.edition, item.publisher, item.officialUrl].filter(Boolean).map(clean).join('. '), 'dcterms:identifier': (item.identifiers || []).map(value => `${value.type}:${value.value}`)};
  const dataCite = {identifiers: (item.identifiers || []).map(value => ({identifier: clean(value.value), identifierType: clean(value.type).toUpperCase()})), creators: creators.map(name => ({name})), titles: [{title: clean(item.title)}], publisher: clean(item.publisher), publicationYear: clean(item.publicationDate).slice(0, 4), types: {resourceTypeGeneral: item.type === 'research_paper' ? 'JournalArticle' : 'Text', resourceType: clean(item.type)}, version: clean(item.edition), language: clean(item.language), relatedIdentifiers: [{relatedIdentifier: item.officialUrl, relatedIdentifierType: 'URL', relationType: 'IsPublishedIn'}, ...(item.resourceId ? [{relatedIdentifier: `urn:uuid:${item.resourceId}`, relatedIdentifierType: 'URN', relationType: 'IsVersionOf'}] : [])].filter(value => value.relatedIdentifier)};
  const schemaOrg = {'@context': 'https://schema.org', '@type': item.type === 'research_paper' ? 'ScholarlyArticle' : 'CreativeWork', '@id': identifier, name: clean(item.title), author: (item.authors || []).map(author => typeof author === 'string' || author.literal ? {'@type': 'Organization', name: clean(typeof author === 'string' ? author : author.literal)} : {'@type': 'Person', familyName: clean(author.family), givenName: clean(author.given)}), publisher: {'@type': 'Organization', name: clean(item.publisher)}, datePublished: clean(item.publicationDate), version: clean(item.edition), inLanguage: clean(item.language), url: clean(item.officialUrl), identifier: (item.identifiers || []).map(value => ({'@type': 'PropertyValue', propertyID: clean(value.type), value: clean(value.value)})), ...(item.resourceId ? {isPartOf: {'@id': `urn:uuid:${item.resourceId}`}} : {})};
  return {dublinCore: JSON.parse(JSON.stringify(dublinCore)), dataCite, schemaOrg};
}
// Convenient names for callers that use the vocabulary/export terminology.
export const toCslJson = resourceToCslJson;
export const toBibtex = resourceToBibtex;
export const toRis = resourceToRis;
export const toCsv = resourceToCsv;
