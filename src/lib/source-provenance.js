import {sourceProvenanceRecords, sourceProvenanceCoverage} from './source-provenance-records.js';
import {sourceProvenanceUrl, sourceMetadataSpecifications, resolveSourceProvenance} from './source-provenance-core.js';

export {sourceProvenanceCoverage, sourceProvenanceUrl, sourceMetadataSpecifications};
const invalid = message => {throw new TypeError(message);};
const registry = new Map(sourceProvenanceRecords.map(record => [sourceProvenanceUrl(record.originalUrl), record]));
/** Complete registry lookup for licensing and JSON-LD exports. Common source
 * links use the generated compact reference lookup instead. */
export const sourceProvenance = value => resolveSourceProvenance(value, url => registry.get(url));
export const getSourceProvenance = url => sourceProvenance(url);

export const sourceProvenanceContext = Object.freeze({
  dcterms: 'http://purl.org/dc/terms/', schema: 'https://schema.org/', prov: 'http://www.w3.org/ns/prov#',
  xsd: 'http://www.w3.org/2001/XMLSchema#', esia: 'https://esia.categori.se/ns/provenance#'
});
/** JSON-LD application profile: standard terms retain their defined meaning;
 * observation/rights decisions without a standard counterpart use esia terms. */
export function exportSourceDatasetJsonLd(records = sourceProvenanceRecords) {
  if (!Array.isArray(records) || records.length > 10000) invalid('Choose a bounded source metadata dataset.');
  return {'@context': sourceProvenanceContext, '@id': 'urn:esia:community:source-provenance', '@type': ['schema:Dataset', 'prov:Collection'],
    'schema:name': 'E&S source provenance and rights metadata', 'schema:description': 'Public metadata only; source copyrights, private storage access and redistribution permissions remain separate.',
    'dcterms:conformsTo': sourceMetadataSpecifications.map(item => ({'@id': item.url})),
    'prov:hadMember': records.map(value => {
      const record = sourceProvenance(value), entity = {'@id': record.id, '@type': ['schema:CreativeWork', 'prov:Entity'],
        'schema:url': {'@id': record.originalUrl}, 'dcterms:source': {'@id': record.originalUrl},
        'esia:metadataStatus': record.metadataStatus, 'esia:rightsStatus': record.rightsStatus, 'esia:publicRedistribution': record.publicRedistribution, 'esia:internalCopyLocked': record.internalCopyLocked};
      if (record.title) entity['dcterms:title'] = record.title;
      if (record.publisher) entity['dcterms:publisher'] = {'@type': 'schema:Organization', 'schema:name': record.publisher};
      if (record.lastAccessedAt) entity['esia:lastAccessedAt'] = {'@value': record.lastAccessedAt, '@type': 'xsd:dateTime'};
      if (record.rightsURI) entity['dcterms:rights'] = {'@id': record.rightsURI};
      if (record.licenseURI) {entity['dcterms:license'] = {'@id': record.licenseURI};entity['schema:license'] = {'@id': record.licenseURI};}
      if (record.attribution) entity['schema:creditText'] = record.attribution;
      if (record.rightsEvidenceURL) entity['esia:rightsEvidence'] = {'@id': record.rightsEvidenceURL};
      if (record.permissionVerifiedAt) entity['esia:permissionVerifiedAt'] = {'@value': record.permissionVerifiedAt, '@type': 'xsd:dateTime'};
      if (record.versions.length) entity['dcterms:hasVersion'] = record.versions.map(item => ({'@id': item.id, '@type': ['schema:MediaObject', 'prov:Entity'],
        'prov:wasDerivedFrom': {'@id': record.originalUrl}, 'schema:contentSize': `${item.size} bytes`, 'schema:encodingFormat': item.mediaType,
        'esia:sha256': item.sha256, 'esia:captureScope': item.captureScope,
        ...(item.capturedAt ? {'esia:captureObservation': {'@type': 'prov:Activity', 'prov:used': {'@id': record.originalUrl}, 'prov:endedAtTime': {'@value': item.capturedAt, '@type': 'xsd:dateTime'}, 'prov:generated': {'@id': `${record.originalUrl}#esia-capture-${item.sha256}-${encodeURIComponent(item.capturedAt)}`, '@type': 'prov:Entity', 'prov:specializationOf': {'@id': item.id}, 'prov:generatedAtTime': {'@value': item.capturedAt, '@type': 'xsd:dateTime'}}}} : {}),
        ...(item.captureMethod ? {'esia:captureMethod': item.captureMethod} : {})}));
      return entity;
    })};
}
