// Synthetic, reusable local acceptance data. No real project, client agreement,
// institutional finding or AI result is represented by these documents.
export const roles = Object.freeze({preparer: ["Alice"], reviewer: ["Bob"], approver: ["Cara"], client: ["David"]});

function pdf(text) {
  const escaped = text.replace(/[\\()]/g, value => `\\${value}`), stream = `BT /F1 11 Tf 40 760 Td (${escaped}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let result = "%PDF-1.4\n", offsets = [0];
  for (const [index, object] of objects.entries()) {offsets.push(Buffer.byteLength(result));result += `${index + 1} 0 obj\n${object}\nendobj\n`;}
  const xref = Buffer.byteLength(result);result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result);
}

export function buildEngagementDocuments(count = 30) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw Error("Choose 1–100 synthetic source documents.");
  return Array.from({length: count}, (_, index) => {
    const base = `Synthetic document ${index + 1}. Pollution and noise monitoring require dated measurements. Workers and affected communities reported consultation gaps. Verify implementation before any compliance conclusion. Revision ${index % 3 + 1}.`;
    const first = "Client terms of reference. Deliver a source-cited due diligence assessment and corrective action plan. Review pollution monitoring and stakeholder consultation against the separately selected lender standards. Client acceptance is required before publication.";
    const formats = [
      ["txt", "text/plain", Buffer.from(index === 0 ? first : base)], ["md", "text/markdown", Buffer.from(`# Monitoring note ${index + 1}\n\n${base}`)],
      ["html", "text/html", Buffer.from(`<!doctype html><html><head><title>Synthetic consultation</title></head><body><h1>Consultation record ${index + 1}</h1><p>${base}</p></body></html>`)],
      ["csv", "text/csv", Buffer.from(`date,topic,observation\n2026-10-20,pollution,Noise monitoring record ${index + 1}\n2026-10-20,consultation,Follow-up missing\n`)],
      ["json", "application/json", Buffer.from(JSON.stringify({title: `Monitoring source ${index + 1}`, topics: ["pollution", "engagement"], observations: base}))],
      ["pdf", "application/pdf", pdf(`Synthetic monitoring record ${index + 1}. Noise measurements and consultation follow-up need verification.`)]
    ];
    const [extension, mediaType, bytes] = formats[index % formats.length];
    return {name: `engagement-source-${index + 1}.${extension}`, title: index === 0 ? "Client terms of reference" : `Synthetic monitoring source ${index + 1}`, mediaType, bytesBase64: bytes.toString("base64")};
  });
}

export function mandate(projectId, sourceVersionId) {
  return {projectId, actorId: "Alice", name: "Synthetic DFI due diligence", client: "Example lender", contractingParties: ["Example lender", "Example consultant"], type: "due_diligence",
    scope: ["Document review", "Gap analysis", "Action plan", "Reporting"], exclusions: "No assurance on uncited historic periods or specialist measurements.", agreementVersionIds: sourceVersionId ? [sourceVersionId] : [], amendments: [],
    deliverables: [{id: "report-1", title: "Due diligence assessment and action plan", description: "Evidence-linked findings and verification criteria", dueDate: "2026-12-01"}], roles: structuredClone(roles),
    dataRules: "Private local acceptance fixture. Client acceptance required before external publication. No real client or substantive institutional judgment.", clientAcceptanceRequired: true, frameworkIds: ["ifc_ps_2012", "wb_esf_2016"]};
}
