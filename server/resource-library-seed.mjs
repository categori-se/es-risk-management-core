import {normalizeCatalog} from '../src/lib/resource-library.js';

const collections = ['institutions', 'resources', 'versions', 'files', 'instruments', 'mappings', 'collections', 'events'];
const bindings = {resources: ['institutionId'], versions: ['resourceId', 'edition', 'language'], files: ['resourceVersionId', 'sha256', 'size'], instruments: ['resourceVersionId'], mappings: ['resourceVersionId', 'frameworkId', 'edition']};

/** Add shipped metadata once. Local rights, reviews, original custody and edits win. */
export async function reconcileResourceSeed({library, seed, requireSeedLineage = false, preserveLocalMappingEditions = false}) {
  const incoming = normalizeCatalog(seed), current = normalizeCatalog(await library.exportCatalog());
  if(requireSeedLineage && current.resources.length && !current.resources.some(row=>incoming.resources.some(item=>item.id===row.id))) {
    return {addedMetadataRecords:0,networkRequests:0,preservedIndependentCatalog:true};
  }
  const merged = structuredClone(current);
  let addedMetadataRecords = 0;
  const preservedLocalMappingEditions=[];
  for (const name of collections) {
    const existing = new Map(merged[name].map(row => [row.id, row]));
    for (const row of incoming[name]) {
      const previous = existing.get(row.id);
      if (previous) {
        for (const key of bindings[name] || []) {
          if ((previous[key] ?? '') !== (row[key] ?? '')) {
            if(preserveLocalMappingEditions&&name==='mappings'&&key==='edition') {preservedLocalMappingEditions.push({mappingId:row.id,existingEdition:previous.edition,shippedEdition:row.edition});continue;}
            throw Object.assign(new Error(`Shipped ${name} metadata conflicts with an existing ${key} identity.`), {status: 409});
          }
        }
        continue;
      }
      merged[name].push(structuredClone(row));
      existing.set(row.id, row);
      addedMetadataRecords++;
    }
  }
  if (addedMetadataRecords) await library.importCatalog(normalizeCatalog(merged));
  return {addedMetadataRecords, preservedLocalMappingEditions, networkRequests: 0};
}
