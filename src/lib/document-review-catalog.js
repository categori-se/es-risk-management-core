import {ifcMeAssessmentScale, ifcMeMatrixDiagnostics, ifcMePerformanceStandards} from "./ifc-me-matrix-template.js";

export const lenderFrameworkCatalog = [
  {
    framework_id: "ifc_performance_standards",
    lender: "IFC",
    label: "IFC Performance Standards",
    coverage: "PS1-PS8",
    default_selected: true,
    standards: ifcMePerformanceStandards.map((standard) => ({
      standard_id: standard.performance_standard,
      label: standard.label,
      requirement_count: standard.diagnostic_count,
      conceptual_groups: standard.conceptual_groups
    }))
  },
  {
    framework_id: "dfc_espp",
    lender: "DFC",
    label: "DFC ESPP",
    coverage: "Screening, conditions, monitoring",
    default_selected: false,
    standards: [
      {
        standard_id: "DFC_ESPP",
        label: "DFC Environmental and Social Policy and Procedures",
        requirement_count: 3,
        conceptual_groups: ["screening_categorization", "applicable_standards", "esap_conditions", "monitoring_reporting"]
      }
    ]
  },
  {
    framework_id: "adb_sps_ess",
    lender: "ADB",
    label: "ADB Safeguard Policy Statement (2009 legacy)",
    coverage: "SPS2009: concepts approved before 1 January 2026; newer concepts require the separate ADB ESF edition",
    default_selected: false,
    standards: [
      {
        standard_id: "ADB_SPS_ESS",
        label: "ADB SPS2009 safeguard review (legacy concepts)",
        requirement_count: 3,
        conceptual_groups: ["environment", "involuntary_resettlement", "indigenous_peoples", "information_disclosure"]
      }
    ]
  },
  {
    framework_id: "world_bank_esf",
    lender: "World Bank",
    label: "World Bank ESF",
    coverage: "ESS1-ESS10",
    default_selected: false,
    standards: [
      {
        standard_id: "WB_ESF",
        label: "World Bank Environmental and Social Framework",
        requirement_count: 3,
        conceptual_groups: ["assessment_management", "labor", "resettlement", "stakeholder_engagement", "commitments"]
      }
    ]
  }
];

const genericLenderRequirements = [
  {
    framework_id: "dfc_espp",
    standard_id: "DFC_ESPP",
    requirement_id: "DFC_ESPP_SCREENING_001",
    group: "screening_categorization",
    title: "Risk screening and categorization",
    requirement: "Classify the project E&S risk and identify the due diligence pathway, applicable standards, disclosure timing, and specialist review needs.",
    source: "DFC ESPP",
    document_types: ["screening memo", "ESIA", "ESDD", "ESAP"],
    evidence_prompts: ["risk category", "screening rationale", "standard trigger basis", "specialist review notes"]
  },
  {
    framework_id: "dfc_espp",
    standard_id: "DFC_ESPP",
    requirement_id: "DFC_ESPP_STANDARDS_002",
    group: "applicable_standards",
    title: "Applicable standards and conditions",
    requirement: "Identify IFC Performance Standards or other lender standards that govern the review and convert material gaps into conditions or action-plan commitments.",
    source: "DFC ESPP",
    document_types: ["ESDD", "clearance memo", "legal agreement", "ESAP"],
    evidence_prompts: ["standard selection", "gap basis", "condition text", "borrower commitment"]
  },
  {
    framework_id: "dfc_espp",
    standard_id: "DFC_ESPP",
    requirement_id: "DFC_ESPP_MONITORING_003",
    group: "monitoring_reporting",
    title: "Monitoring and reporting framework",
    requirement: "Define borrower monitoring, reporting, and independent monitoring requirements proportionate to project risk.",
    source: "DFC ESPP",
    document_types: ["ESAP", "monitoring plan", "annual report", "IESC report"],
    evidence_prompts: ["reporting cadence", "monitoring responsibility", "independent review", "closeout criteria"]
  },
  {
    framework_id: "adb_sps_ess",
    standard_id: "ADB_SPS_ESS",
    requirement_id: "ADB_SPS_ENV_001",
    group: "environment",
    title: "Environmental assessment and mitigation",
    requirement: "Review whether environmental risks, mitigation hierarchy commitments, monitoring measures, and disclosure requirements are addressed.",
    source: "ADB Safeguard Policy Statement (2009)",
    document_types: ["EIA", "IEE", "EMP", "monitoring report"],
    evidence_prompts: ["impact significance", "mitigation hierarchy", "EMP measures", "public disclosure"]
  },
  {
    framework_id: "adb_sps_ess",
    standard_id: "ADB_SPS_ESS",
    requirement_id: "ADB_SPS_IR_002",
    group: "involuntary_resettlement",
    title: "Involuntary resettlement planning",
    requirement: "Review whether displacement impacts, eligibility, replacement cost, livelihood restoration, consultation, and grievance management are addressed.",
    source: "ADB Safeguard Policy Statement (2009)",
    document_types: ["LARP", "RAP", "census", "livelihood plan"],
    evidence_prompts: ["affected persons", "entitlements", "replacement cost", "livelihood restoration"]
  },
  {
    framework_id: "adb_sps_ess",
    standard_id: "ADB_SPS_ESS",
    requirement_id: "ADB_SPS_IP_003",
    group: "indigenous_peoples",
    title: "Indigenous Peoples safeguards",
    requirement: "Review whether Indigenous Peoples impacts, consultation, culturally appropriate benefits, and consent requirements are addressed.",
    source: "ADB Safeguard Policy Statement (2009)",
    document_types: ["IPP", "social assessment", "consultation record", "SEP"],
    evidence_prompts: ["IP screening", "consultation", "benefit measures", "consent process"]
  },
  {
    framework_id: "world_bank_esf",
    standard_id: "WB_ESF",
    requirement_id: "WB_ESS1_001",
    group: "assessment_management",
    title: "Assessment and ESCP commitments",
    requirement: "Review whether project E&S risks are assessed and converted into management measures, commitments, monitoring, and institutional responsibilities.",
    source: "World Bank ESF",
    document_types: ["ESIA", "ESMP", "ESCP", "ESRS"],
    evidence_prompts: ["risk assessment", "ESCP commitment", "responsibility", "timeline"]
  },
  {
    framework_id: "world_bank_esf",
    standard_id: "WB_ESF",
    requirement_id: "WB_ESS2_002",
    group: "labor",
    title: "Labor and working conditions",
    requirement: "Review whether worker terms, OHS, grievance channels, contractor controls, and labor risk measures are documented.",
    source: "World Bank ESF",
    document_types: ["LMP", "OHS plan", "worker grievance log", "contractor plan"],
    evidence_prompts: ["labor terms", "OHS controls", "worker grievance", "contractor management"]
  },
  {
    framework_id: "world_bank_esf",
    standard_id: "WB_ESF",
    requirement_id: "WB_ESS10_003",
    group: "stakeholder_engagement",
    title: "Stakeholder engagement and disclosure",
    requirement: "Review whether engagement, disclosure, grievance management, and differentiated consultation measures are adequate for affected parties.",
    source: "World Bank ESF",
    document_types: ["SEP", "grievance log", "consultation records", "disclosure plan"],
    evidence_prompts: ["stakeholder mapping", "engagement records", "disclosure", "grievance closeout"]
  }
];

export function getDocumentReviewRequirements(audit) {
  const selectedFrameworks = selectedFrameworkIds(audit);
  const selectedIfcStandards = selectedIfcStandardIds(audit);
  const ifcRequirements = selectedFrameworks.includes("ifc_performance_standards")
    ? ifcMeMatrixDiagnostics
        .filter((diagnostic) => selectedIfcStandards.includes(diagnostic.performance_standard))
        .map((diagnostic) => ({
          framework_id: "ifc_performance_standards",
          framework_label: "IFC Performance Standards",
          standard_id: diagnostic.performance_standard,
          standard_label: ifcMePerformanceStandards.find((standard) => standard.performance_standard === diagnostic.performance_standard)?.label || diagnostic.performance_standard,
          requirement_id: diagnostic.diagnostic_id,
          diagnostic_id: diagnostic.diagnostic_id,
          group: diagnostic.conceptual_group || diagnostic.section || "Unclassified",
          title: diagnostic.audit_question,
          requirement: diagnostic.ifc_provision || diagnostic.audit_question,
          source: `${diagnostic.performance_standard}${diagnostic.paragraph ? ` / ${diagnostic.paragraph}` : ""}`,
          document_types: ["ESIA", "ESMP", "RAP", "SEP", "HRIA", "monitoring report"],
          evidence_prompts: ["relevant document", "supporting evidence", "criteria fulfillment", "reviewer analysis"],
          diagnostic
        }))
    : [];
  const crossFrameworkRequirements = genericLenderRequirements.filter((requirement) => selectedFrameworks.includes(requirement.framework_id));
  return [...ifcRequirements, ...crossFrameworkRequirements];
}

export function selectedFrameworkIds(audit) {
  const states = audit.frameworks || {};
  const selected = Object.values(states)
    .filter((state) => state?.selected)
    .map((state) => state.framework_id);
  return Object.keys(states).length ? [...new Set(selected)] : ["ifc_performance_standards"];
}

export function selectedIfcStandardIds(audit) {
  const states = audit.standards || {};
  const selected = Object.entries(states)
    .filter(([, state]) => state && state.selected !== false)
    .map(([id, state]) => normalizeIfcStandardId(state.performance_standard || id))
    .filter(Boolean);
  return Object.keys(states).length ? [...new Set(selected)] : ["PS1"];
}

/** Display aliases identify the same legacy IFC standard, never an edition. */
export function normalizeIfcStandardId(value) {
  const match = /^(?:IFC\s*)?PS\s*([1-8])$/i.exec(String(value || "").trim());
  return match ? `PS${match[1]}` : null;
}

export function conceptualGroupLabel(value) {
  const id = typeof value === "string" ? value : value?.group || value?.label || "Unmapped topic";
  const label = String(id).replaceAll("_", " ");
  return typeof value === "object" && Number.isSafeInteger(value?.diagnostic_count) ? `${label} (${value.diagnostic_count} diagnostics)` : label;
}

export function standardApplicabilityForExport(record = {}) {
  const decision = record.applicability;
  const hasDecision = ["applicable", "not applicable"].includes(decision);
  const justified = Boolean(String(record.rationale || "").trim());
  return hasDecision && !justified ? {...record, recorded_applicability: decision, applicability: "determination pending", applicability_review_status: "rationale_required"} : {...record, applicability_review_status: hasDecision ? "rationale_recorded" : "determination_pending"};
}

export function questionReviewSummary(results = []) {
  const hasDetermination = result => {
    const value = String(result.response?.compliance_assessment || "").trim().toLowerCase();
    return Boolean(value && !["not assessed", "not_assessed", "not-assessed"].includes(value));
  };
  const humanAssessed = results.filter(result => result.human_verification?.status === "confirmed" && hasDetermination(result));
  const hasAiDraft = result => Boolean(result.ai_pipeline?.draft_response || result.ai_pipeline?.draft_audit || result.ai_pipeline?.status === "drafted_pending_human");
  return {touched: results.length, assessed: humanAssessed.length, humanReviewed: results.filter(result => result.human_verification?.status === "confirmed").length,
    aiDrafted: results.filter(hasAiDraft).length,
    unverified: results.filter(result => hasAiDraft(result) && result.human_verification?.status !== "confirmed").length,
    draftDeterminations: results.filter(result => hasDetermination(result) && !humanAssessed.includes(result)).length,
    nonCompliant: humanAssessed.filter(result => ifcMeAssessmentScale.some(item => item.value === result.response.compliance_assessment && item.non_compliant)).length,
    specialistReview: results.filter(result => result.audit?.specialist_review_required).length};
}

export function createFrameworkState(project = {}) {
  const hasIfcStandards = (project.standards || []).some((standard) => String(standard).startsWith("IFC"));
  return Object.fromEntries(
    lenderFrameworkCatalog.map((framework) => [
      framework.framework_id,
      {
        framework_id: framework.framework_id,
        lender: framework.lender,
        label: framework.label,
        selected: framework.framework_id === "ifc_performance_standards" ? framework.default_selected || hasIfcStandards : framework.default_selected,
        applicability: framework.default_selected ? "selected for review" : "available",
        rationale: ""
      }
    ])
  );
}
