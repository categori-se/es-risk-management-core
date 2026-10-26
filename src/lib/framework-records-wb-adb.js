// Practitioner screening prompts, researched 2026-10-18. These are incomplete
// paraphrases, not the institutions' standards or an equivalence determination.
// Guidance notes explain policy; they do not create additional requirements.
const source = (id, title, url) => ({id, title, url});
const cell = (summary, sourceIds, locator) => ({summary, sourceIds, ...(locator ? {locator} : {})});
const check = (framework, suffix, topic, standard, clause, title, prompt, evidence, sourceIds) =>
  ({id: `${framework}.${suffix}`, topic, standard, clause, title, prompt, evidence, sourceIds});
const coverage = "Curated starter checks; incomplete";

const wb = {
  transition: source("wb.transition", "World Bank: ESF and transition", "https://www.worldbank.org/en/projects-operations/environmental-and-social-framework"),
  cycle: source("wb.cycle", "World Bank: project cycle and retained safeguards", "https://projects.worldbank.org/en/projects-operations/products-and-services/brief/projectcycle"),
  full: source("wb.esf", "World Bank ESF: policy and borrower standards", "https://pubdocs.worldbank.org/en/837721522762050108/Environmental-and-Social-Framework.pdf"),
  ess1: source("wb.ess1", "WB ESS1: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/4bd5a5a506fdc47ec012691d7374c0c9-0290012025/original/ESS1-Assessment-and-Management-of-Environmental-and-Social-Risks-and-Impacts-English.pdf"),
  ess2: source("wb.ess2", "WB ESS2: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/3de37080eea65659d546b043c2f7e9be-0290012025/original/ESS2-Labor-and-Working-Conditions-English.pdf"),
  ess3: source("wb.ess3", "WB ESS3: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/8f8bf1aac80e99faec1c66cdb7cae609-0290012025/original/ESS3-Resource-Efficiency-and-Pollution-Prevention-and-Management-English.pdf"),
  ess4: source("wb.ess4", "WB ESS4: policy provisions and guidance", "https://pubdocs.worldbank.org/en/290471530216994899/ESF-GN4-June-2018.pdf"),
  ess5: source("wb.ess5", "WB ESS5: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/f25263d7a7f5415b79b69c5cc65a96cf-0290012025/original/ESS5-Land-Acquisition-Restrictions-on-Land-Use-and-Involuntary-Resettlement-English.pdf"),
  ess6: source("wb.ess6", "WB ESS6: policy provisions and guidance", "https://pubdocs.worldbank.org/en/924371530217086973/ESF-GN6-June-2018.pdf"),
  ess7: source("wb.ess7", "WB ESS7: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/15afe4164f8d1b2c190e83d36f373ac0-0290012025/original/ESS7-Indigenous-Peoples-Sub-Saharan-African-Historically-Underserved-Traditional-Local-Communities-English.pdf"),
  ess8: source("wb.ess8", "WB ESS8: policy provisions and guidance", "https://pubdocs.worldbank.org/en/743151530217186766/ESF-GN8-June-2018.pdf"),
  ess9: source("wb.ess9", "WB ESS9: policy provisions and guidance", "https://pubdocs.worldbank.org/en/484961530217326585/ESF-GN9-June-2018.pdf"),
  ess10: source("wb.ess10", "WB ESS10: policy provisions and guidance", "https://thedocs.worldbank.org/en/doc/e90b65996fdb2dcfc71f0018d55692d5-0290012025/original/ESS10-Stakeholder-Engagement-and-Information-Disclosure-English.pdf"),
  manual: source("wb.manual", "WB operational-policy register", "https://policies.worldbank.org/en/policies/operational-manual"),
  op401: source("wb.op401", "WB OP4.01: environmental assessment", "https://thedocs.worldbank.org/en/doc/f3077ee7a3590f4f4610ede4734496fc-0290012023/original/OP-4-01-Environmental-Assessment.pdf"),
  op404: source("wb.op404", "WB OP4.04: habitat protection", "https://thedocs.worldbank.org/en/doc/920b60ec811a53704f2770a4c25005bf-0290012023/original/OP-4-04-Natural-Habitats.pdf"),
  op410: source("wb.op410", "WB OP4.10: Indigenous Peoples", "https://thedocs.worldbank.org/en/doc/2e32d9beeec85a16da0bac98d14df191-0290012023/original/OP-4-10-Indigenous-Peoples.pdf"),
  op412: source("wb.op412", "WB OP4.12: displacement safeguards", "https://thedocs.worldbank.org/en/doc/b192cc75476bc0d5a54a1e4ceba50776-0290012023/original/OP-4-12-Involuntary-Resettlement.pdf"),
  op403: source("wb.op403", "WB OP4.03: private-sector eligibility and responsibilities (May 2013)", "https://thedocs.worldbank.org/en/doc/fe9c45a624fa3111c4bfe0a9aa03bd2a-0290012023/original/OP-4-03-Performance-Standards-for-Private-Sector-Activites.pdf"),
  adoption: source("wb.ps.adoption", "WB management note: adoption of the 2012 IFC standards", "https://documents1.worldbank.org/curated/en/111071468181778511/pdf/774480BR0SECM2020Box377297B00OUO090.pdf"),
  ps: source("wb.ps.text", "Incorporated IFC standards, 2012 edition", "https://www.ifc.org/content/dam/ifc/doc/2010/2012-ifc-performance-standards-en.pdf")
};

const adb = {
  transition: source("adb.transition", "ADB: ESF applicability and effectiveness", "https://www.adb.org/who-we-are/environmental-social-requirements/environmental-social-framework"),
  spsOverview: source("adb.sps.overview", "ADB: SPS transition and safeguard themes", "https://www.adb.org/who-we-are/safeguards/environment"),
  sps: source("adb.sps", "ADB SPS, June 2009: borrower safeguards and finance modalities", "https://www.adb.org/sites/default/files/institutional-document/32056/safeguard-policy-statement-june2009.pdf"),
  spsIp: source("adb.sps.ip", "ADB: SPS Indigenous Peoples sourcebook (non-mandatory draft)", "https://www.adb.org/documents/indigenous-peoples-safeguards-planning-and-implementation-good-practice-sourcebook"),
  esf: source("adb.esf", "ADB ESF 2024, amended November 2025 (Part V)", "https://www.adb.org/sites/default/files/institutional-document/1033311/environmental-social-framework.pdf"),
  ess1: source("adb.ess1", "ADB ESS1: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172626/ess-1-guidance-note.pdf"),
  ess2: source("adb.ess2", "ADB ESS2: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172631/ess-2-guidance-note.pdf"),
  ess3: source("adb.ess3", "ADB ESS3: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172646/ess-3-guidance-note.pdf"),
  ess4: source("adb.ess4", "ADB ESS4: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172651/ess-4-guidance-note.pdf"),
  ess5: source("adb.ess5", "ADB ESS5: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172656/ess-5-guidance-note.pdf"),
  ess6: source("adb.ess6", "ADB ESS6: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172661/ess-6-guidance-note.pdf"),
  ess7: source("adb.ess7", "ADB ESS7: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172666/ess-7-guidance-note.pdf"),
  ess8: source("adb.ess8", "ADB ESS8: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172671/ess-8-guidance-note.pdf"),
  ess9: source("adb.ess9", "ADB ESS9: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172676/ess-9-guidance-note.pdf"),
  ess10: source("adb.ess10", "ADB ESS10: policy provisions and guidance", "https://www.adb.org/sites/default/files/institutional-document/1172681/ess-10-guidance-note.pdf"),
  guidance: source("adb.guidance", "ADB: guidance status and FI/corporate-finance references", "https://www.adb.org/documents/series/environmental-social-standards-ess-guidance-notes")
};

const wbCurrent = "wb_esf_2016";
const wbLegacy = "wb_safeguards_legacy";
const wbPrivate = "wb_private_ps_2012";
const adbLegacy = "adb_sps_2009";
const adbCurrent = "adb_esf_2024";

export const wbAdbFrameworks = [
  {
    id: wbCurrent, institutionId: "world_bank", institution: "World Bank", name: "World Bank Environmental and Social Framework", edition: "Approved 2016; effective 2018", status: "current", coverage,
    applicability: "New IPF initiated on or after 1 October 2018; confirm the project's concept-stage transition and legal instruments. Other financing instruments need their own policy mapping.",
    sources: [wb.transition, wb.full, wb.ess1, wb.ess2, wb.ess3, wb.ess4, wb.ess5, wb.ess6, wb.ess7, wb.ess8, wb.ess9, wb.ess10],
    checks: [
      check(wbCurrent, "regime", "applicability", "ESF policy", "Scope; transition", "Confirm governing regime", "Does the financing instrument and concept-stage date establish ESF applicability?", ["Financing instrument", "Concept-stage record", "Legal agreement"], ["wb.transition", "wb.esf"]),
      check(wbCurrent, "commitments", "assessment", "ESS1", "Paragraph 36; ESCP", "Track agreed commitments", "Does the ESCP assign dated measures, responsibility and monitoring evidence for identified gaps?", ["ESCP", "Assessment", "Monitoring record"], ["wb.ess1"]),
      check(wbCurrent, "workers", "labor", "ESS2", "Labor procedures; paragraphs 21–30", "Review worker protection", "Do labor procedures, worker grievances and OHS controls cover the relevant worker groups?", ["Labor procedures", "Worker grievance log", "OHS records"], ["wb.ess2"]),
      check(wbCurrent, "pollution", "pollution", "ESS3", "Resource efficiency; pollution and waste sections", "Review pollution controls", "Do baseline conditions, emissions controls and waste arrangements support the applicable project limits?", ["Baseline sampling", "Emission limits", "Waste tracking"], ["wb.ess3"]),
      check(wbCurrent, "community_safety", "health_safety", "ESS4 / ESS2", "Community safety; worker OHS under ESS2", "Separate community and worker risks", "Are community exposure, emergency and security risks reviewed alongside separate worker OHS controls?", ["Community risk assessment", "Emergency plan", "OHS controls"], ["wb.ess4", "wb.ess2"]),
      check(wbCurrent, "stakeholders", "engagement", "ESS10", "Engagement plan; paragraphs 26–27", "Review engagement and remedy", "Can the SEP and grievance record demonstrate accessible engagement and documented responses?", ["SEP", "Disclosure record", "Grievance responses"], ["wb.ess10"]),
      check(wbCurrent, "displacement", "land", "ESS5", "Compensation; economic displacement", "Test livelihood outcomes", "Do eligibility, compensation and livelihood measures address both physical and economic displacement?", ["Census", "Valuation", "Livelihood monitoring"], ["wb.ess5"]),
      check(wbCurrent, "consent", "indigenous", "ESS7", "Paragraphs 24–26", "Check FPIC circumstances", "Have land/resource impacts, relocation and significant cultural impacts been screened for FPIC?", ["Social assessment", "Consultation record", "FPIC process/outcome"], ["wb.ess7"]),
      check(wbCurrent, "habitats", "biodiversity", "ESS6", "Paragraphs 16 and 24", "Review habitat safeguards", "Are habitat classification, alternatives and critical-habitat mitigation outcomes supported by evidence?", ["Habitat assessment", "Alternatives", "Biodiversity monitoring"], ["wb.ess6"]),
      check(wbCurrent, "climate", "climate", "ESS1 / ESS3 / ESS4", "Climate risks; ESS3 GHG provisions", "Separate emissions and resilience", "Are material climate hazards assessed separately from the project's GHG estimates and mitigation?", ["Climate assessment", "GHG methods/boundary", "Mitigation measures"], ["wb.esf", "wb.ess3"]),
      check(wbCurrent, "intermediary", "financial_intermediaries", "ESS9", "Scope; ESMS and subproject procedures", "Verify FI implementation", "Does the FI's ESMS identify covered financing and apply the required subproject screening and oversight?", ["Portfolio scope", "ESMS", "Subproject review"], ["wb.ess9"]),
      check(wbCurrent, "heritage", "cultural_heritage", "ESS8", "Risk assessment; chance finds", "Screen cultural heritage", "Are cultural heritage risks and chance-find arrangements reflected in project assessment and contracts?", ["Heritage assessment", "Chance-find procedure", "Contract clauses"], ["wb.ess8"])
    ],
    comparison: {
      applicability: cell("IPF transition begins October 2018; existing safeguard projects retain their regime.", ["wb.transition"], "ESF applicability"),
      assessment: cell("ESS1 uses an ESCP; the Bank's policy and borrower standards have separate roles.", ["wb.ess1"], "ESS1 paragraph 36"),
      labor: cell("ESS2 includes employment terms, worker grievances and occupational safety.", ["wb.ess2"], "ESS2 sections A–D"),
      pollution: cell("ESS3 covers resource efficiency and pollution; emissions estimates do not replace pollution controls.", ["wb.ess3"]),
      health_safety: cell("ESS4 covers communities; worker OHS is in ESS2, unlike ADB's combined ESS4.", ["wb.ess4", "wb.ess2"]),
      cultural_heritage: cell("ESS8 covers heritage and chance finds; Indigenous Peoples' heritage may also trigger ESS7.", ["wb.ess8", "wb.ess7"]),
      engagement: cell("ESS10 is dedicated to engagement; worker grievances remain under ESS2.", ["wb.ess10", "wb.ess2"], "ESS10 paragraphs 26–27; ESS2 paragraph 21"),
      land: cell("ESS5 covers land-use restrictions and economic displacement, not only relocation.", ["wb.ess5"], "ESS5 scope and economic displacement"),
      indigenous: cell("ESS7 requires FPIC in three specified circumstances; do not substitute legacy consultation terminology.", ["wb.ess7"], "ESS7 paragraph 24"),
      biodiversity: cell("ESS6 uses habitat-specific conditions; critical-habitat mitigation requires net gains.", ["wb.ess6"], "ESS6 paragraph 24"),
      climate: cell("Climate provisions span ESS1/3/4; ESS9 is not a climate standard.", ["wb.esf", "wb.ess3"], "ESS1 risk scope; ESS3 GHG; ESS4 design"),
      financial_intermediaries: cell("ESS9 is the FI standard; covered portfolios and subprojects determine the ESMS scope.", ["wb.ess9"], "ESS9 paragraphs 4–5 and ESMS requirements")
    }
  },
  {
    id: wbLegacy, institutionId: "world_bank", institution: "World Bank", name: "World Bank legacy safeguard policies", edition: "Multiple OP/BP editions: record each project's applicable revisions", status: "legacy", coverage,
    applicability: "Use for retained safeguard-policy projects. Record the exact triggered OP/BP editions and project covenants; this is not one standardized historical edition.",
    sources: [wb.cycle, wb.manual, wb.op401, wb.op404, wb.op410, wb.op412, wb.full],
    checks: [
      check(wbLegacy, "policy_map", "applicability", "Applicable OP/BP policies", "Project-specific safeguard mapping", "Pin policy revisions", "Which policies, revisions and covenants govern this project?", ["ISDS", "Appraisal document", "Financing covenants"], ["wb.cycle", "wb.manual"]),
      check(wbLegacy, "assessment", "assessment", "OP4.01", "Paragraphs 2, 7–8; EMP", "Review assessment and controls", "Does the assigned category support the assessment and management instruments?", ["Category rationale", "EA", "EMP"], ["wb.op401"]),
      check(wbLegacy, "consultation", "engagement", "OP4.01", "Paragraphs 14–16", "Trace consultation and disclosure", "Are consultation timing, disclosed material and responses documented?", ["Consultation record", "Disclosure evidence"], ["wb.op401"]),
      check(wbLegacy, "resettlement", "land", "OP4.12", "Paragraphs 2 and 6; instruments", "Review displacement measures", "Do resettlement instruments address replacement compensation and livelihood restoration?", ["Resettlement plan", "Payments", "Livelihood results"], ["wb.op412"]),
      check(wbLegacy, "indigenous", "indigenous", "OP4.10", "Paragraphs 10–11", "Verify consultation outcome", "Does culturally appropriate consultation demonstrate the required broad community support?", ["Social assessment", "Consultation outcome", "IPP"], ["wb.op410"]),
      check(wbLegacy, "habitats", "biodiversity", "OP4.04", "Paragraphs 4–5", "Review habitat conversion", "Do alternatives and mitigation satisfy the applicable habitat-conversion conditions?", ["Habitat baseline", "Alternatives", "Mitigation plan"], ["wb.op404"])
    ],
    comparison: {
      applicability: cell("Retained project policies; multiple OP/BP revisions must be mapped explicitly.", ["wb.cycle", "wb.manual"]),
      assessment: cell("OP4.01 uses EA categories and management instruments, rather than the ESCP structure.", ["wb.op401"]),
      labor: cell("The classic safeguard register has no standalone ESS2; map labor covenants and law separately.", ["wb.manual"], "Practitioner mapping implication, not exemption"),
      pollution: cell("EA and pest-management policies provide relevant controls; map actual triggers and covenants.", ["wb.op401", "wb.manual"]),
      health_safety: cell("OP4.01 considers human health/safety; dam safety has a separate policy.", ["wb.op401", "wb.manual"]),
      cultural_heritage: cell("OP4.11 is a separate physical-cultural-resource policy; it is not ESS8.", ["wb.manual"]),
      engagement: cell("OP4.01 consultation/disclosure works alongside policy-specific social consultation.", ["wb.op401", "wb.op410"]),
      land: cell("OP4.12 governs relevant resettlement instruments; do not relabel them ESS5 compliance.", ["wb.op412"]),
      indigenous: cell("OP4.10 uses informed consultation and broad community support, not ESS7's FPIC formulation.", ["wb.op410"]),
      biodiversity: cell("OP4.04 addresses natural habitats; map forest-related policy triggers separately.", ["wb.op404", "wb.manual"]),
      climate: cell("OP4.01 includes global environmental issues; no dedicated climate safeguard in this register.", ["wb.op401", "wb.manual"]),
      financial_intermediaries: cell("OP4.01 includes FI categorization and subproject EA; this is not ESS9.", ["wb.op401"], "OP4.01 paragraphs 8 and 11")
    }
  },
  {
    id: wbPrivate, institutionId: "world_bank", institution: "World Bank", name: "World Bank performance standards for private-sector activities", edition: "IFC standards 2012; WB adoption 2012; OP4.03 May 2013", status: "specialized", coverage,
    applicability: "Bank-selected eligible private-sector activities under OP4.03, including qualifying components. Private contracting alone does not establish eligibility; record the Bank's rationale and project scope.",
    sources: [wb.op403, wb.adoption, wb.full, wb.ps],
    checks: [
      check(wbPrivate, "eligibility", "applicability", "OP4.03", "Paragraphs 3–7", "Verify eligible activity", "Do entity autonomy, risk responsibility and activity boundaries meet OP4.03 eligibility?", ["Entity responsibilities", "Bank rationale"], ["wb.op403"]),
      check(wbPrivate, "esms", "assessment", "OP4.03 / PS1", "OP4.03 paragraph 8", "Review private-entity ESMS", "Does the private entity implement an ESMS for its approved activity?", ["ESMS", "Implementation records"], ["wb.op403"]),
      check(wbPrivate, "bank_review", "assessment", "OP4.03", "Paragraphs 9–11", "Track Bank review", "Are Bank review, categorization and the standards-selection rationale documented?", ["Bank review", "Project documents"], ["wb.op403"]),
      check(wbPrivate, "workers", "labor", "PS2", "Selected 2012 standard", "Review worker arrangements", "Do employment and worker-grievance arrangements address the incorporated PS2 requirements?", ["Labor records", "Worker grievances"], ["wb.ps.text", "wb.ps.adoption"]),
      check(wbPrivate, "land_and_ip", "land", "PS5 / PS7", "Selected 2012 standards", "Separate land and IP duties", "Are displacement and Indigenous Peoples applicability decisions separately evidenced?", ["Land assessment", "Indigenous Peoples assessment"], ["wb.ps.text"]),
      check(wbPrivate, "fi", "financial_intermediaries", "OP4.03", "Paragraph 8", "Verify financed portfolio", "Does the FI implement the Bank-accepted ESMS for supported subprojects?", ["ESMS", "Financed portfolio"], ["wb.op403"])
    ],
    comparison: {
      applicability: cell("Eligible private-sector scope is selected under OP4.03; ESF does not replace that policy.", ["wb.op403", "wb.esf"], "OP4.03 paragraphs 3–7; ESF policy footnote 1"),
      assessment: cell("Private-entity ESMS and Bank review apply; preserve the selected PS edition.", ["wb.op403", "wb.ps.adoption"]),
      labor: cell("PS2 governs workers; an ESS2 label would identify a different framework.", ["wb.ps.text"]),
      pollution: cell("PS3 governs resource efficiency and pollution prevention.", ["wb.ps.text"]),
      health_safety: cell("PS4 covers community safety/security; PS2 covers occupational safety.", ["wb.ps.text"]),
      cultural_heritage: cell("PS8 covers cultural heritage; preserve the separate PS7 consent review.", ["wb.ps.text"]),
      engagement: cell("Engagement is integrated in PS1; there is no PS10.", ["wb.ps.text"]),
      land: cell("PS5 is the displacement standard, distinct from WB ESS5.", ["wb.ps.text"]),
      indigenous: cell("PS7 consent provisions require their own trigger review.", ["wb.ps.text"]),
      biodiversity: cell("PS6 applies within the selected private-sector activity.", ["wb.ps.text"]),
      climate: cell("PS3 contains emissions provisions; do not import ADB ESS9 thresholds.", ["wb.ps.text"]),
      financial_intermediaries: cell("OP4.03 paragraph 8 requires a Bank-accepted FI ESMS.", ["wb.op403"])
    }
  },
  {
    id: adbLegacy, institutionId: "adb", institution: "ADB", name: "ADB Safeguard Policy Statement", edition: "2009", status: "legacy", coverage,
    applicability: "Retained for projects with concept approval before 1 January 2026. Verify transition and financing documents for the particular operation.",
    sources: [adb.spsOverview, adb.sps, adb.spsIp],
    checks: [
      check(adbLegacy, "regime", "applicability", "SPS", "Concept approval; safeguard categorization", "Confirm SPS scope", "Does concept approval establish the retained SPS regime?", ["Concept approval", "Safeguard categories"], ["adb.sps.overview"]),
      check(adbLegacy, "environment", "assessment", "SR1", "Assessment; management planning", "Review environmental controls", "Do assessment and EMP address screened risks?", ["EIA/IEE", "EMP"], ["adb.sps"]),
      check(adbLegacy, "participation", "engagement", "SR1 / SR2 / SR3", "Consultation and grievance sections", "Test accessible remedy", "Are consultation and grievance arrangements operating for affected groups?", ["Consultation record", "Grievance responses"], ["adb.sps.overview"]),
      check(adbLegacy, "resettlement", "land", "SR2", "Planning and livelihood restoration", "Verify livelihood recovery", "Are compensation and livelihood outcomes monitored?", ["Resettlement plan", "Livelihood monitoring"], ["adb.sps.overview", "adb.sps"]),
      check(adbLegacy, "consent", "indigenous", "SR3", "Paragraphs 30–31", "Check required consent", "Is required broad community support documented?", ["IPP", "Consultation outcomes"], ["adb.sps", "adb.sps.ip"]),
      check(adbLegacy, "intermediary", "financial_intermediaries", "SR4", "Section G; paragraphs 13–16", "Review FI safeguards", "Does the FI screen and monitor subprojects through its ESMS?", ["ESMS", "Subproject review"], ["adb.sps"])
    ],
    comparison: {
      applicability: cell("Pre-January-2026 concept approvals retain SPS; categorize environment, resettlement and IP separately.", ["adb.sps.overview", "adb.sps"]),
      assessment: cell("SR1 uses EIA/IEE and EMP instruments; no ten-ESS architecture.", ["adb.sps"]),
      labor: cell("No standalone labor standard; SR1 includes worker safety. Check other labor obligations separately.", ["adb.sps"], "SR1 health/safety; mapping implication"),
      pollution: cell("SR1 contains pollution and waste controls, rather than a separate ESS3.", ["adb.sps"], "SR1 pollution section"),
      health_safety: cell("SR1 includes occupational and community safety; no separate ESS4.", ["adb.sps"], "SR1 section 10"),
      cultural_heritage: cell("SR1 addresses physical cultural resources; SR3 covers Indigenous Peoples' cultural issues.", ["adb.sps.overview", "adb.sps"], "SR1 paragraphs 46–48; SR3"),
      engagement: cell("Consultation and grievances sit within individual safeguard requirements.", ["adb.sps.overview", "adb.sps"]),
      land: cell("SR2 links resettlement planning with livelihood recovery.", ["adb.sps.overview"]),
      indigenous: cell("SR3 consent is defined through broad community support for specified activities.", ["adb.sps", "adb.sps.ip"], "SR3 paragraphs 30–31"),
      biodiversity: cell("SR1 addresses habitats; do not assume the newer ESS6 structure.", ["adb.sps"], "SR1 biodiversity section"),
      climate: cell("SR1 includes GHG provisions; it has no standalone ESS9.", ["adb.sps"], "SR1 paragraph 39"),
      financial_intermediaries: cell("SR4.G governs FI ESMS and subproject screening.", ["adb.sps"], "SR4 paragraphs 13–16")
    }
  },
  {
    id: adbCurrent, institutionId: "adb", institution: "ADB", name: "ADB Environmental and Social Framework", edition: "2024, amended November 2025 (Part V); effective 2026", status: "current", coverage,
    applicability: "Effective 1 January 2026 for the new concept-approval cohort; earlier concepts retain SPS. Record the operation's exact transition decision and financing modality.",
    sources: [adb.transition, adb.spsOverview, adb.sps, adb.esf, adb.ess1, adb.ess2, adb.ess3, adb.ess4, adb.ess5, adb.ess6, adb.ess7, adb.ess8, adb.ess9, adb.ess10, adb.guidance],
    checks: [
      check(adbCurrent, "regime", "applicability", "ESF policy / financing modalities", "Scope and transition", "Confirm framework and product", "Do concept approval and financing modality establish the governing ESF requirements?", ["Concept approval", "Financing modality", "Legal agreement"], ["adb.transition", "adb.sps.overview", "adb.esf"]),
      check(adbCurrent, "commitments", "assessment", "ESS1", "Section E; paragraphs 41–47", "Track agreed actions", "Does the ESCP/ESAP assign measures, dates and implementation evidence for identified gaps?", ["ESCP/ESAP", "Assessment", "Progress evidence"], ["adb.ess1"]),
      check(adbCurrent, "workers", "labor", "ESS2", "Employment conditions; paragraphs 31–35", "Review worker arrangements", "Do employment arrangements and the worker grievance mechanism cover the relevant worker groups?", ["Labor procedures", "Worker grievances", "Contractor records"], ["adb.ess2"]),
      check(adbCurrent, "pollution", "pollution", "ESS3", "Resource conservation; pollution/waste sections", "Review resource and pollution controls", "Do ambient baselines, resource use and pollution controls address the receiving environment's sensitivity?", ["Baseline sampling", "Resource records", "Waste/emissions monitoring"], ["adb.ess3"]),
      check(adbCurrent, "safety", "health_safety", "ESS4", "Occupational and community safety sections", "Review workers and communities", "Are occupational, community, emergency and security risks addressed under ESS4?", ["Risk assessment", "Safety plan", "Incident follow-up"], ["adb.ess4"]),
      check(adbCurrent, "stakeholders", "engagement", "ESS10", "Engagement plan; paragraphs 28–32", "Review engagement and grievances", "Does engagement include accessible information, responses and protection against reprisals?", ["SEP", "Disclosure evidence", "Grievance register"], ["adb.ess10"]),
      check(adbCurrent, "displacement", "land", "ESS5", "Paragraphs 23–24 and 53–54", "Test compensation and livelihoods", "Are replacement-cost valuation and livelihood measures evidenced for affected people, including those without formal title?", ["Valuation method", "Eligibility register", "Livelihood program"], ["adb.ess5"]),
      check(adbCurrent, "consent", "indigenous", "ESS7", "Paragraph 36; section F", "Check FPIC triggers", "Have customary land/resource impacts, relocation and significant cultural impacts been screened for FPIC?", ["Social assessment", "IPP", "FPIC process/outcome"], ["adb.ess7"]),
      check(adbCurrent, "habitats", "biodiversity", "ESS6", "Habitat requirements; paragraph 29", "Review biodiversity outcomes", "Do habitat assessment and mitigation demonstrate the applicable no-net-loss or net-gain outcome?", ["Habitat baseline", "Alternatives", "Mitigation/offset monitoring"], ["adb.ess6"]),
      check(adbCurrent, "climate", "climate", "ESS9", "GHG assessment/reporting; climate risk assessment", "Verify climate methods", "Are GHG boundaries, ADB-agreed reporting criteria and physical climate risks documented separately?", ["GHG assessment", "Reporting criteria", "Climate risk assessment"], ["adb.ess9"]),
      check(adbCurrent, "intermediary", "financial_intermediaries", "ESF Part IV", "Section J; FI requirements", "Review FI implementation", "Does the FI's ESMS implement screening, exclusion checks and risk-based subproject oversight?", ["ESMS", "Financed portfolio", "Subproject review"], ["adb.esf", "adb.guidance"]),
      check(adbCurrent, "heritage", "cultural_heritage", "ESS8", "Assessment; chance finds", "Screen cultural heritage", "Are cultural heritage risks and chance-find arrangements reflected in project assessment and contracts?", ["Heritage assessment", "Chance-find procedure", "Contract clauses"], ["adb.ess8"])
    ],
    comparison: {
      applicability: cell("New 2026 concept cohort; integrated risk classes replace separate SPS thematic categories.", ["adb.transition", "adb.sps.overview"]),
      assessment: cell("ESS1 provides ESCP/ESAP commitments; financing modalities have additional Part IV requirements.", ["adb.ess1", "adb.esf"]),
      labor: cell("ESS2 covers employment and worker grievances; occupational safety is in ESS4.", ["adb.ess2", "adb.ess4"]),
      pollution: cell("ESS3 includes circular-economy and resource-conservation provisions; climate has its own ESS9.", ["adb.ess3", "adb.ess9"]),
      health_safety: cell("ESS4 combines worker OHS and community safety/security, rather than WB's ESS2/4 split.", ["adb.ess4"]),
      cultural_heritage: cell("ESS8 covers tangible and relevant intangible heritage, including chance finds and user access.", ["adb.ess8"]),
      engagement: cell("ESS10 requires project grievances; a separate worker mechanism sits under ESS2.", ["adb.ess10", "adb.ess2"], "ESS10 paragraph 28; ESS2 paragraph 31"),
      land: cell("ESS5 expressly addresses land-use restriction and includes a livelihood restoration program.", ["adb.ess5"], "ESS5 paragraphs 53–54"),
      indigenous: cell("ESS7 uses FPIC in specified circumstances, replacing SPS's consent-through-broad-support formulation.", ["adb.ess7", "adb.sps"], "ESS7 paragraph 36; compare SPS SR3 paragraphs 30–31"),
      biodiversity: cell("ESS6 differentiates habitat outcomes; critical habitat requires net gain and offsets are last resort.", ["adb.ess6"], "ESS6 paragraph 29 and habitat provisions"),
      climate: cell("ESS9 is a dedicated climate standard; reporting criteria are determined by ADB, not inherited SPS thresholds.", ["adb.ess9"], "ESS9 paragraph 10"),
      financial_intermediaries: cell("FI requirements are Part IV.J, not ESS9; corporate finance is separately addressed in IV.K.", ["adb.esf", "adb.guidance"], "Part IV sections J–K")
    }
  }
];
