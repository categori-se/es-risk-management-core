// Read-only projections over the existing engagement graph. Instrument forms
// never own a second set of evidence, findings, actions or monitoring values.
import {canonicalInstrumentPaths} from './resource-library.js';
import {assertEngagement as assert, stableJson} from './engagement-domain.js';
import {bibliographyFromResource} from './engagement-bibliography.js';

export const thematicInstrumentWorkflows = Object.freeze(['prepare', 'review', 'monitor']);
const clone = value => structuredClone(value);
const nonempty = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
const valueAt = (record, path) => path.reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, record);
const ref = row => ({id: row.id, ...(row.revision !== undefined ? {revision: row.revision} : {}), ...(row.updatedAt ? {updatedAt: row.updatedAt} : {})});

/** Input must already be authorized and source/right checked by the host. This
 * pure projection grants no access and does not establish policy applicability. */
export function projectInstrumentWorkflow({definition, project, engagement, workflow = 'prepare', cycleId} = {}) {
  assert(thematicInstrumentWorkflows.includes(workflow), 'Choose prepare, review or monitor.');
  assert(project?.id && engagement?.projectId === project.id, 'Use the instrument within its owning engagement project.', 409);
  const instrument = definition?.instrument;
  assert(instrument?.approval?.status === 'approved', 'Use a reviewed source-bound instrument.', 409);
  assert(!instrument.workflows || instrument.workflows.includes(workflow), 'The source instrument does not support this workflow.', 409);
  assert(!cycleId || workflow === 'monitor', 'Select a reporting period only for the monitoring workflow.');
  const cycle = cycleId && (engagement.cycles || []).find(row => row.id === cycleId);
  assert(!cycleId || cycle, 'Select an existing reporting period in this engagement.', 404);

  const frameworkMappings = definition.requirementMappings || instrument.frameworks || definition.resource.frameworks || [];
  const topics = instrument.topics || [];
  const requirements = (engagement.requirements || []).filter(row =>
    frameworkMappings.some(mapping => mapping.recognized !== false && mapping.frameworkId === row.frameworkId && mapping.edition === row.edition &&
      (!mapping.standardIds?.length || mapping.standardIds.includes(row.standard))) &&
    (!topics.length || row.topics?.some(topic => topics.includes(topic))) &&
    (!cycle || !cycle.requirementIds?.length || cycle.requirementIds.includes(row.id)));
  const requirementIds = new Set(requirements.map(row => row.id));
  const findings = (engagement.findings || []).filter(row => requirementIds.has(row.requirementId) &&
    (workflow === 'monitor' ? !cycleId || !row.cycleId || row.cycleId === cycleId : !row.cycleId));
  const findingIds = new Set(findings.map(row => row.id));
  const monitoringObligations = (engagement.monitoringObligations || []).filter(row =>
    (!cycle || row.programId === cycle.programId) &&
    ((row.requirementIds || []).some(id => requirementIds.has(id)) || (row.originFindingIds || []).some(id => findingIds.has(id))));
  const obligationIds = new Set(monitoringObligations.map(row => row.id));
  const actions = (engagement.actions || []).filter(row =>
    (!cycle || !row.cycleId || row.cycleId === cycleId) &&
    ((row.findingIds || []).some(id => findingIds.has(id)) || (row.monitoringObligationIds || []).some(id => obligationIds.has(id))));
  const assertionIds = new Set([...findings.flatMap(row => [...row.supportingAssertionIds || [], ...row.contradictoryAssertionIds || []]),
    ...actions.flatMap(row => row.closureAssertionIds || [])]);
  const indicators = (engagement.indicators || []).filter(row => (!cycle || row.programId === cycle.programId) &&
    ((row.requirementIds || []).some(id => requirementIds.has(id)) || (row.obligationIds || []).some(id => obligationIds.has(id))));
  const indicatorIds = new Set(indicators.map(row => row.id));
  const measurements = (engagement.measurements || []).filter(row => indicatorIds.has(row.indicatorId) && (!cycle || row.cycleId === cycle.id));
  const cycles = cycle ? [cycle] : (engagement.cycles || []).filter(row => (row.requirementIds || []).some(id => requirementIds.has(id)));
  const missions = (engagement.missions || []).filter(row => cycle ? row.cycleId === cycle.id : cycles.some(item => item.id === row.cycleId));
  const actionIds=new Set(actions.map(row=>row.id));
  const verifications=(engagement.verifications||[]).filter(row=>(!cycle||row.cycleId===cycle.id)&&
    (row.targetType==='action'&&actionIds.has(row.targetId)||row.targetType==='obligation'&&obligationIds.has(row.targetId)));
  for(const row of [...measurements,...missions,...verifications,...monitoringObligations.flatMap(item=>item.occurrences||[])])for(const id of row.assertionIds||[])assertionIds.add(id);
  const assertions = (engagement.assertions || []).filter(row => assertionIds.has(row.id) || (row.requirementIds || []).some(id => requirementIds.has(id)));
  const graph = {project: [project], engagement: [engagement], requirements, assertions, findings, actions, monitoringObligations, indicators, measurements, cycles, missions, verifications};
  let projectedCharacters=0,projectedValues=0;
  const fields = (instrument.fields || []).map(field => {
    assert(!field.canonicalPath || canonicalInstrumentPaths.includes(field.canonicalPath), 'Instrument contains an unrecognized canonical field.', 409);
    const [entity, ...path] = (field.canonicalPath || '').split('.');
    const values = field.canonicalPath ? (graph[entity] || []).flatMap(row => {
      const value = valueAt(row, path);if(!nonempty(value))return[];
      projectedCharacters+=JSON.stringify(value).length;projectedValues++;
      assert(projectedCharacters<=2*1024*1024&&projectedValues<=10000,'Narrow the instrument scope before exporting more than 2 MiB or 10,000 shared field values.',413);
      return [{...ref(row), value: clone(value)}];
    }) : [];
    return {...clone(field), values, coverage: field.canonicalPath ? values.length ? 'available' : 'missing' : 'specialist_profile_required'};
  });
  const bibliography = (engagement.bibliography || []).filter(row => row.resourceVersionId === instrument.resourceVersionId && row.instrumentId === instrument.id);
  const warnings = [
    'Framework and topic matches identify candidate review criteria; a practitioner must decide applicability and completeness for the assignment.',
    'This working document reads the current shared records. Its export is not an approved engagement baseline or an assurance opinion.'
  ];
  if (!requirements.length) warnings.push('No exact framework edition and thematic requirements match this instrument. Select and review criteria in the engagement before drawing conclusions.');
  if (fields.some(field => field.coverage === 'specialist_profile_required')) warnings.push('Specialist fields remain explicit domain proposals; these values are not captured in independent template storage.');
  if (workflow === 'monitor' && !cycleId) warnings.push('Select a reporting period to isolate period measurements and monitoring findings.');
  return {format: 'esia-thematic-instrument-workflow', schemaVersion: 1, workflow, cycleId: cycleId || null,
    engagementId: engagement.id, projectId: project.id, expectedRevision: engagement.revision, projectRevision: project.revision,
    requirementMappings: clone(frameworkMappings),instrument: {id: instrument.id, title: instrument.title, kind: instrument.kind, authorityCategory: instrument.authorityCategory,
      source: clone(instrument.source), approval: clone(instrument.approval)}, citation: clone(definition.resource), rightsNotice: clone(definition.rightsNotice || {}),
    fields, coverage: {mapped: fields.filter(row => row.canonicalPath).length, available: fields.filter(row => row.coverage === 'available').length,
      missing: fields.filter(row => row.coverage === 'missing').map(row => row.id), specialist: fields.filter(row => row.coverage === 'specialist_profile_required').map(row => row.id)},
    records: Object.fromEntries(Object.entries(graph).filter(([name]) => !['project', 'engagement'].includes(name)).map(([name, rows]) => [name, rows.map(ref)])),
    evidence: assertions.map(row => ({...ref(row), versionId: row.versionId, sourceSha256: row.sourceSha256, locator: row.locator, reviewStatus: row.reviewStatus})),
    bibliography: bibliography.map(ref), warnings,
    links: {engagement: `/engagements?${new URLSearchParams({project: project.id, engagement: engagement.id})}`}};
}

export function instrumentBibliographyCommand(definition, {workflow, statement} = {}) {
  assert(thematicInstrumentWorkflows.includes(workflow), 'Choose prepare, review or monitor.');
  const instrument = definition.instrument;
  const authorityKind = ({binding_requirement: 'institutional_requirement', official_guidance: 'official_guidance', project_commitment: 'project_commitment', published_example: 'example', derived_recommendation: 'practitioner_recommendation'})[instrument.authorityCategory];
  return {type: 'bibliography-save', ...bibliographyFromResource(definition.resource, {instrumentId: instrument.id, locator: instrument.source.locator || instrument.source.section || '',
    purpose: `Use this source-linked instrument to ${workflow} the thematic E&S work product against the shared engagement records.`, authorityKind,
    clientVisible: false, statement})};
}

export function renderInstrumentWorkflowHtml(view) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const value = item => escape(typeof item === 'string' ? item : stableJson(item)).replaceAll('\n', '<br>');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(view.instrument.title) + '</title><body><main>' +
    `<h1>${escape(view.instrument.title)}</h1><p>Working ${escape(view.workflow)} document · Engagement ${escape(view.engagementId)} revision ${escape(view.expectedRevision)} · Project revision ${escape(view.projectRevision)}</p>` +
    view.warnings.map(warning => `<p>${escape(warning)}</p>`).join('') +
    view.fields.map(field => `<section><h2>${escape(field.label)}</h2><p>${escape(field.canonicalPath || field.extensionProposal?.path || 'Specialist profile required')} · ${escape(field.coverage)}</p>` +
      field.values.map(row => `<div contenteditable="true" aria-label="${escape(field.label)}">${value(row.value)}</div><small>Shared record ${escape(row.id)}${row.revision !== undefined ? ' revision ' + escape(row.revision) : ''}</small>`).join('') +
      `<p>Source location: ${escape(field.sourceLocator)}</p></section>`).join('') +
    '<p>Downloaded working copies can be edited locally. Save substantive evidence and conclusions through the engagement records to retain review history.</p>' +
    `<footer><p>Source: ${escape(view.citation.title)}; edition ${escape(view.citation.edition)}; ${escape(view.citation.officialUrl)}. ${escape(view.instrument.source.locator)}</p>` +
    `<p>Instrument ${escape(view.instrument.id)} · Source SHA256 ${escape(view.instrument.source.sha256)} · Source field approval ${escape(view.instrument.approval.reviewedAt)}</p>` +
    Object.values(view.rightsNotice).flatMap(item => Array.isArray(item) ? item : [item]).map(item => `<p>${escape(item)}</p>`).join('') + '</footer></main></body></html>';
}
