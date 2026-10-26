import {sourceReferenceRecords} from './source-reference-records.js';
import {resolveSourceProvenance} from './source-provenance-core.js';

export {sourceProvenanceUrl} from './source-provenance-core.js';

/** Decode only a requested source. The generated dictionaries remove repeated
 * metadata without dropping version pins, observation dates or rights evidence.
 * Full JSON-LD export and catalogue coverage remain on the licensing page. */
export function createSourceReferenceLookup(records) {
  const registry = new Map(records.sources.map(row => [row[0], row]));
  function recordFor(url) {
    const row = registry.get(url);
    if (!row) return undefined;
    const [originalUrl, title, publisher, accessedAt, versions, flags, materials, rights] = row;
    return {
      originalUrl, title: records.titles[title], publisher: records.publishers[publisher],
      lastAccessedAt: records.timestamps[accessedAt],
      metadataStatus: flags & 1 ? 'metadata_missing' : 'recorded',
      captureStatus: flags & 2 ? 'capture_failed' : 'not_captured',
      versions: versions.map(index => {
        const [sha256, size, mediaType, capturedAt, captureMethod] = records.versions[index];
        return {sha256, size, mediaType: records.mediaTypes[mediaType],
          capturedAt: records.timestamps[capturedAt], captureMethod: records.captureMethods[captureMethod]};
      }),
      metadataSources: materials.map(index => records.metadataSources[index]),
      ...rights
    };
  }
  return value => resolveSourceProvenance(value, recordFor);
}

export const sourceProvenance = createSourceReferenceLookup(sourceReferenceRecords);
export const getSourceProvenance = url => sourceProvenance(url);
