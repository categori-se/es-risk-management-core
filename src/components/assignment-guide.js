const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Navigation advice from retained records. It never grants approval or claims
 * that an original, extracted passage or AI answer has been professionally read. */
export function assignmentProgress(engagement, sourceCount = 0) {
  const e = engagement || {}, requirements = (e.requirements || []).filter(row => !row.cycleId);
  const findings = (e.findings || []).filter(row => !row.cycleId);
  const assessed = requirements.filter(row => findings.some(finding => finding.requirementId === row.id)).length;
  const reviewed = requirements.filter(row => findings.some(finding => finding.requirementId === row.id && ['verified','approved'].includes(finding.status))).length;
  const actions = (e.actions || []).filter(row => row.status !== 'superseded');
  const needsAction = findings.filter(row => row.deficiency || ['partially_compliant','noncompliant'].includes(row.performance));
  const withoutAction = needsAction.filter(row => !actions.some(action => action.findingIds?.includes(row.id))).length;
  const published = (e.publications || []).length > 0, issued = (e.issuedRenditions || []).length;
  const steps = [
    {tab:'evidence', label:'Read evidence', detail:`${sourceCount} source versions · ${(e.assertions || []).length} saved citations`, complete:sourceCount > 0 && (e.assertions || []).length > 0},
    {tab:'matrix', label:'Record judgments', detail:`${assessed} of ${requirements.length} requirements assessed`, complete:requirements.length > 0 && assessed === requirements.length},
    {tab:'actions', label:'Plan actions', detail:withoutAction ? `${withoutAction} findings with gaps need an action` : `${actions.length} actions · check responsibilities and verification`, complete:requirements.length > 0 && assessed === requirements.length && withoutAction === 0},
    {tab:'approval', label:'Submit for review', detail:`${reviewed} of ${requirements.length} requirement findings verified`, complete:published},
    {tab:'outputs', label:'Issue and hand over', detail:`${issued} retained output files`, complete:published && issued > 0}
  ];
  return {steps, next:steps.find(step => !step.complete) || steps.at(-1), published};
}

export function renderAssignmentGuide({engagement, sourceCount = 0, authenticated = false} = {}) {
  if (!engagement) return '';
  const {steps, next} = assignmentProgress(engagement, sourceCount);
  return `<section class="ew-panel" data-assignment-guide aria-label="Assignment next steps"><h2>Continue this assignment</h2><p>${h(engagement.client)} · ${h(engagement.name)}. Select a requirement, read its evidence, record a judgment and prepare any action before review.</p><ol class="ew-assignment-steps">${steps.map(step => `<li><button type="button" data-engagement-tab="${step.tab}">${h(step.label)}</button><small>${h(step.detail)}</small></li>`).join('')}</ol><p><strong>Suggested next step:</strong> <button type="button" data-engagement-tab="${next.tab}">${h(next.label)}</button>. These counts guide navigation; extraction, source coverage and substantive review need separate inspection.</p><details data-assignment-operating-guide><summary>Report production and assessment limits</summary><p>${authenticated ? 'This assignment uses signed-in access. Prepare editable Word and Excel outputs from an approved baseline. Hosted native conversion of imported Office/PDF templates remains unavailable; use the local installation with its required native tools for that workflow.' : 'This assignment is stored on this computer. Prepare editable Word and Excel outputs from an approved baseline. Native PDF and imported Office/PDF template conversion require separately installed tools. Named local roles record responsibility within the computer owner’s workspace.'}</p><p>Hosted and local records do not synchronize automatically. For handover, retain the issued files, structured assessment and authorized source originals together.</p><p>Framework starter checks and source mappings require professional interpretation. An official original, a project-specific example, an application-authored report profile and an accepted mapping have different authority. Selecting a framework does not certify its coverage.</p><p>AI assessment accuracy has not been established by a blinded real-document evaluation. Suggestions remain drafts; check the exact sources, missing evidence and contradictions before relying on a conclusion.</p></details></section>`;
}
