import {qualificationIdentity} from './professional-qualification.js';
import {templateCanonicalFields} from './client-template-bindings.js';
export const IFC_QUALIFICATION_SOURCE=Object.freeze({frameworkId:'ifc_ps_2012',sha256:'831cfba9482fdd210603cf493e92a098baad8d22561c251aad0d2dc04daa5068',versionId:'3080e436-0899-515c-bf27-3854539796d6'});
/** Declared PS5 research scope, reused by CLI and the trusted local review flow. */
export function ifcGapActionQualificationDefinition({rendering}={}){
 const sourceVersionId=IFC_QUALIFICATION_SOURCE.versionId,policySha256=IFC_QUALIFICATION_SOURCE.sha256;
const rows = [
  ['criterion', 'Applicable criterion and exact edition', 'requirements.text', 'direct', 'PS5 paragraphs 9, 14–15, 20–22, 25–29'],
  ['coverage', 'Document coverage', 'findings.coverage', 'direct', 'PS5 paragraphs 14–15'],
  ['adequacy', 'Evidence adequacy', 'findings.adequacy', 'direct', 'PS5 paragraphs 14–15'],
  ['performance', 'Professional judgment', 'findings.performance', 'direct', 'PS5 paragraphs 9, 20–22, 25–29'],
  ['rationale', 'Evidence-based reasoning and uncertainty', 'findings.rationale', 'narrative', 'PS5 paragraphs 14–15'],
  ['support', 'Supporting exact evidence assertions', 'findings.supportingAssertionIds', 'repeating', 'PS5 paragraphs 14–15'],
  ['contradiction', 'Contradictory exact evidence assertions', 'findings.contradictoryAssertionIds', 'repeating', 'PS5 paragraphs 14–15'],
  ['corrective-action', 'Corrective measure linked to deficiency', 'actions.description', 'repeating', 'PS5 paragraph 15 and completion-audit footnote 18'],
  ['responsibility', 'Assigned responsible party', 'actions.owner', 'direct', 'PS5 paragraphs 14–15'],
  ['deliverables', 'Verifiable deliverables', 'actions.deliverables', 'repeating', 'PS5 paragraphs 14–15'],
  ['timing', 'Due date or trigger', 'actions.dueDate', 'direct', 'PS5 paragraphs 9, 14–15'],
  ['verification', 'Outcome verification criteria', 'actions.verificationCriteria', 'narrative', 'PS5 paragraphs 14–15, 25–29']
];
const mappings = rows.map(([id, label, canonicalPath, kind, sourceLocator]) => {if (!templateCanonicalFields[canonicalPath]) throw Error('Qualification mapping is outside the existing canonical field registry.');return {id, label, canonicalPath, kind, sourceVersionId, sourceLocator, consequential:true, interpretation:'Application-authored professional review mapping; exact policy meaning and project applicability require named independent acceptance.'};});
return qualificationIdentity({id:'ifc-ps5-gap-report-action-plan-v1', revision:1, frameworkId:'ifc_ps_2012', edition:'2012', workProducts:['gap_report', 'action_plan'], scopeStatement:'One bounded PS5 evidence-gap review and linked corrective action plan, using the current shared requirement, finding, exact assertion and action records; the declared criteria concern compensation timing, security of tenure, livelihood outcomes and independent completion monitoring.', exclusions:['Other Performance Standards and a comprehensive PS5 clause checklist are outside this qualification packet.', 'No IFC official report form, lender acceptance, current project compliance determination or qualified model accuracy is claimed.', 'Protected household/entitlement records and outcomes require separately authorized actual project evidence.'], sources:[{versionId:sourceVersionId, sha256:policySha256, classification:'official_publisher_original', locator:'IFC Performance Standard 5, January 2012; PDF pages 26–33', url:'https://www.ifc.org/content/dam/ifc/doc/2010/2012-ifc-performance-standards-en.pdf'}], mappings, rendering});
}
