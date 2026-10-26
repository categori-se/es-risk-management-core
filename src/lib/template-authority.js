// Source identity, application authorship and a recorded mapping decision are
// separate facts. A publisher name or a generic approval cannot imply acceptance.
export function sourceAuthorityLabel(value = {}) {
  const kind=value.sourceClassification||value.classification||'';
  if(/^(?:historic_)?official_/.test(kind)) return 'Official publisher original';
  if(/project|borrower|completed|published_example/.test(kind)||value.kind==='project_example'||value.authorityCategory==='published_example') return 'Project-specific example';
  if(['official_template','official_outline'].includes(value.kind)) return 'Official publisher original';
  if(value.authorityCategory==='project_commitment') return 'Project-specific source';
  return 'Source authority requires review';
}

export function sourceMappingAcceptanceLabel(instrument = {}) {
  const approval=instrument.approval,record=approval?.professionalAcceptance;
  const accepted=approval?.status==='approved'&&record?.format==='esia-source-form-professional-acceptance'&&record.schemaVersion===1&&record.instrumentId===(instrument.instrumentId||instrument.id)&&/^[a-f0-9]{64}$/.test(record.sourceSha256||'')&&/^[a-f0-9]{64}$/.test(record.definitionSha256||'')&&(!instrument.source?.sha256||record.sourceSha256===instrument.source.sha256)&&(!instrument.definitionRevision||record.definitionRevision===instrument.definitionRevision)&&record.sourceExamined===true&&record.applicabilityReviewed===true&&record.reviewerName&&record.reviewedAt&&['complete','limited'].includes(record.scope);
  return accepted ? `Accepted mapping · ${record.scope==='limited'?'limited scope':'declared scope'}` : 'No professional mapping acceptance recorded';
}

export function sourceDefinitionLabel(instrument = {}) {
  return instrument.authorityCategory==='derived_recommendation'||instrument.kind==='guide_derived_outline' ? 'Application-authored adaptation' : 'Source-linked definition';
}
