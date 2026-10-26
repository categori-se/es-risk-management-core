// Generated from src/assets/IFC Performance Standards - M&E matrix template.xlsx.
// Keep this file ASCII-safe so Observable can bundle it consistently.

export const ifcMeMatrixMetadata = {
  "id": "ifc_ps_me_matrix_2012",
  "label": "IFC Performance Standards - M&E Matrix",
  "owner": "IFC",
  "coverage": "PS1-PS8",
  "source_asset": "src/assets/IFC Performance Standards - M&E matrix template.xlsx",
  "diagnostic_count": 524,
  "workbook_sheets": [
    "PS1",
    "PS2",
    "PS3",
    "PS4",
    "PS5",
    "PS6",
    "PS7",
    "PS8"
  ],
  "extracted_at": "2026-06-10",
  "purpose": "Technical audit and monitoring evaluation matrix for IFC Performance Standards due diligence."
};

export const ifcMeAttributeModel = [
  {
    "attribute": "diagnostic_id",
    "label": "Diagnostic ID",
    "json_path": "diagnostic_results[].diagnostic_id",
    "concept": "identity",
    "required": true
  },
  {
    "attribute": "performance_standard",
    "label": "Performance Standard",
    "json_path": "diagnostic_results[].source.performance_standard",
    "concept": "standard_reference",
    "required": true
  },
  {
    "attribute": "section_path",
    "label": "Conceptual Section Path",
    "json_path": "diagnostic_results[].source.section_path",
    "concept": "conceptual_organization",
    "required": true
  },
  {
    "attribute": "paragraph",
    "label": "IFC Paragraph",
    "json_path": "diagnostic_results[].source.paragraph",
    "concept": "standard_reference",
    "required": false
  },
  {
    "attribute": "ifc_provision",
    "label": "IFC Provision",
    "json_path": "diagnostic_results[].labels.ifc_provision",
    "concept": "requirement_text",
    "required": false
  },
  {
    "attribute": "audit_question",
    "label": "M&E Question",
    "json_path": "diagnostic_results[].labels.audit_question",
    "concept": "diagnostic_prompt",
    "required": true
  },
  {
    "attribute": "compliance_assessment",
    "label": "Compliance Assessment",
    "json_path": "diagnostic_results[].response.compliance_assessment",
    "concept": "determination",
    "required": true
  },
  {
    "attribute": "relevant_documents",
    "label": "Relevant Document(s)",
    "json_path": "diagnostic_results[].response.relevant_documents",
    "concept": "evidence_source",
    "required": false
  },
  {
    "attribute": "supporting_evidence",
    "label": "Supporting Evidence",
    "json_path": "diagnostic_results[].response.supporting_evidence",
    "concept": "evidence_finding",
    "required": false
  },
  {
    "attribute": "recommendation",
    "label": "Recommendations or Remedial Actions",
    "json_path": "diagnostic_results[].response.recommendation",
    "concept": "corrective_action",
    "required": false
  },
  {
    "attribute": "auxiliary_notes",
    "label": "Auxiliary Notes",
    "json_path": "diagnostic_results[].response.auxiliary_notes",
    "concept": "reviewer_context",
    "required": false
  },
  {
    "attribute": "schedule_for_compliance",
    "label": "Schedule for Achieving Compliance",
    "json_path": "diagnostic_results[].response.schedule_for_compliance",
    "concept": "implementation_schedule",
    "required": false
  },
  {
    "attribute": "criteria_fulfillment",
    "label": "Criteria Fulfillment",
    "json_path": "diagnostic_results[].audit.criteria_fulfillment",
    "concept": "technical_rationale",
    "required": false
  },
  {
    "attribute": "reviewer_analysis",
    "label": "Reviewer Analysis",
    "json_path": "diagnostic_results[].audit.reviewer_analysis",
    "concept": "technical_rationale",
    "required": false
  },
  {
    "attribute": "specialist_review_required",
    "label": "Specialist Review Required",
    "json_path": "diagnostic_results[].audit.specialist_review_required",
    "concept": "escalation",
    "required": false
  }
];

export const ifcMeAssessmentScale = [
  {
    "value": "yes",
    "label": "Yes",
    "meaning": "Compliance achieved or provision not applicable after reasoned assessment.",
    "non_compliant": false
  },
  {
    "value": "on-going",
    "label": "On-going",
    "meaning": "Action toward compliance is being undertaken.",
    "non_compliant": true
  },
  {
    "value": "pending",
    "label": "Pending",
    "meaning": "Action toward compliance is planned but not yet implemented.",
    "non_compliant": true
  },
  {
    "value": "out-standing",
    "label": "Outstanding",
    "meaning": "Issue is known and current action does not indicate compliance.",
    "non_compliant": true
  },
  {
    "value": "unknown",
    "label": "Unknown",
    "meaning": "Issue status is unknown and should be treated as non-compliant until evidenced.",
    "non_compliant": true
  },
  {
    "value": "not-applicable",
    "label": "Not applicable",
    "meaning": "Provision is not applicable to the project; rationale should be documented.",
    "non_compliant": false
  }
];

export const ifcMeAuditStages = [
  {
    "stage_id": "setup",
    "label": "Set scope",
    "question": "What project, documents, review boundary, and reviewer role define this audit?",
    "required_fields": [
      "review_type",
      "audit_scope",
      "source_documents"
    ]
  },
  {
    "stage_id": "applicability",
    "label": "Screen PS",
    "question": "Which Performance Standards are applicable, pending, or excluded, and why?",
    "required_fields": [
      "standards_applicability"
    ]
  },
  {
    "stage_id": "evidence",
    "label": "Map evidence",
    "question": "Which documents or observations support each determination?",
    "required_fields": [
      "relevant_documents",
      "supporting_evidence"
    ]
  },
  {
    "stage_id": "diagnostics",
    "label": "Run diagnostics",
    "question": "What does the matrix require, what was found, and how strong is the evidence?",
    "required_fields": [
      "compliance_assessment",
      "reviewer_analysis"
    ]
  },
  {
    "stage_id": "actions",
    "label": "Close gaps",
    "question": "What remedial action, owner, and schedule will close each non-compliant item?",
    "required_fields": [
      "recommendation",
      "schedule_for_compliance"
    ]
  }
];

export const ifcMeDiagnosticConventions = {
  "minimum_diagnostic_fields": [
    "diagnostic_id",
    "performance_standard",
    "section_path",
    "audit_question",
    "compliance_assessment",
    "supporting_evidence",
    "reviewer_analysis"
  ],
  "response_object_shape": {
    "source": [
      "template_id",
      "source_workbook",
      "source_sheet",
      "source_row",
      "performance_standard",
      "section_path",
      "paragraph"
    ],
    "labels": [
      "ifc_provision",
      "audit_question",
      "conceptual_group"
    ],
    "response": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance"
    ],
    "audit": [
      "criteria_fulfillment",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  "naming": {
    "ids": "IFC_ME_PS{n}_{sequence}",
    "keys": "snake_case canonical attributes; original workbook labels retained as human-facing labels.",
    "grouping": "standard -> conceptual_group -> section_path -> diagnostic_id"
  }
};

export const ifcMePerformanceStandards = [
  {
    "performance_standard": "PS1",
    "label": "IFC PS1",
    "diagnostic_count": 119,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 5,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 2,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System",
        "diagnostic_count": 3,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
        "diagnostic_count": 6,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_policy"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
        "diagnostic_count": 19,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_identification_of_risks_and_impacts"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
        "diagnostic_count": 9,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_management_programs"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
        "diagnostic_count": 8,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_organizational_capacity_and_competency"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
        "diagnostic_count": 6,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_emergency_preparedness_and_response"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
        "diagnostic_count": 13,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_monitoring_and_review"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement",
        "diagnostic_count": 3,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
        "diagnostic_count": 6,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_stakeholder_analysis_and_engagement_planning"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
        "diagnostic_count": 6,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_disclosure_of_information"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
        "diagnostic_count": 10,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_consultation"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
        "diagnostic_count": 5,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_informed_consultation_and_participation"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Indigenous Peoples",
        "diagnostic_count": 1,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_indigenous_peoples"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Private Sector Responsibilities Under Government-Led Stakeholder Engagement",
        "diagnostic_count": 3,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_stakeholder_engagement_private_sector_responsibilities_under_government_led_stakeholder_engagement"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
        "diagnostic_count": 6,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_external_communications_and_grievance_mechanisms_external_communications"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
        "diagnostic_count": 7,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_external_communications_and_grievance_mechanisms_grievance_mechanisms_for_affected_communities"
      },
      {
        "section": "Requirements > Environmental and Social Assessment and Management System > Ongoing Reporting to Affected Communities",
        "diagnostic_count": 1,
        "section_id": "requirements_environmental_and_social_assessment_and_management_system_ongoing_reporting_to_affected_communities"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 6
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 2
      },
      {
        "group": "policy_esms",
        "diagnostic_count": 111
      }
    ]
  },
  {
    "performance_standard": "PS2",
    "label": "IFC PS2",
    "diagnostic_count": 60,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 6,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 3,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > Working Conditions and Management of Worker Relationship",
        "diagnostic_count": 30,
        "section_id": "requirements_working_conditions_and_management_of_worker_relationship"
      },
      {
        "section": "Requirements > Protecting the Work Force",
        "diagnostic_count": 6,
        "section_id": "requirements_protecting_the_work_force"
      },
      {
        "section": "Requirements > Occupational Health and Safety",
        "diagnostic_count": 7,
        "section_id": "requirements_occupational_health_and_safety"
      },
      {
        "section": "Requirements > Workers Engaged by Third Parties",
        "diagnostic_count": 5,
        "section_id": "requirements_workers_engaged_by_third_parties"
      },
      {
        "section": "Requirements > Supply Chain",
        "diagnostic_count": 3,
        "section_id": "requirements_supply_chain"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 6
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 3
      },
      {
        "group": "labor_working_conditions",
        "diagnostic_count": 27
      },
      {
        "group": "grievance_external_communications",
        "diagnostic_count": 8
      },
      {
        "group": "policy_esms",
        "diagnostic_count": 3
      },
      {
        "group": "protecting_the_work_force",
        "diagnostic_count": 2
      },
      {
        "group": "monitoring_review",
        "diagnostic_count": 2
      },
      {
        "group": "occupational_health_safety",
        "diagnostic_count": 8
      },
      {
        "group": "third_party_workers_supply_chain",
        "diagnostic_count": 1
      }
    ]
  },
  {
    "performance_standard": "PS3",
    "label": "IFC PS3",
    "diagnostic_count": 43,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 2,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 3,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements",
        "diagnostic_count": 6,
        "section_id": "requirements"
      },
      {
        "section": "Requirements > Resource Efficiency",
        "diagnostic_count": 3,
        "section_id": "requirements_resource_efficiency"
      },
      {
        "section": "Requirements > Resource Efficiency > Greenhouse Gases",
        "diagnostic_count": 3,
        "section_id": "requirements_resource_efficiency_greenhouse_gases"
      },
      {
        "section": "Requirements > Resource Efficiency > Water Consumption",
        "diagnostic_count": 1,
        "section_id": "requirements_resource_efficiency_water_consumption"
      },
      {
        "section": "Requirements > Pollution Prevention",
        "diagnostic_count": 5,
        "section_id": "requirements_pollution_prevention"
      },
      {
        "section": "Requirements > Pollution Prevention > Wastes",
        "diagnostic_count": 7,
        "section_id": "requirements_pollution_prevention_wastes"
      },
      {
        "section": "Requirements > Pollution Prevention > Hazardous Materials Management",
        "diagnostic_count": 4,
        "section_id": "requirements_pollution_prevention_hazardous_materials_management"
      },
      {
        "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
        "diagnostic_count": 9,
        "section_id": "requirements_pollution_prevention_pesticide_use_and_management"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 3
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 3
      },
      {
        "group": "resource_efficiency",
        "diagnostic_count": 9
      },
      {
        "group": "requirements",
        "diagnostic_count": 2
      },
      {
        "group": "risk_identification",
        "diagnostic_count": 1
      },
      {
        "group": "pollution_prevention",
        "diagnostic_count": 25
      }
    ]
  },
  {
    "performance_standard": "PS4",
    "label": "IFC PS4",
    "diagnostic_count": 35,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 2,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 2,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > Community Health and Safety",
        "diagnostic_count": 22,
        "section_id": "requirements_community_health_and_safety"
      },
      {
        "section": "Requirements > Security Personnel",
        "diagnostic_count": 9,
        "section_id": "requirements_security_personnel"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 2
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 2
      },
      {
        "group": "risk_identification",
        "diagnostic_count": 3
      },
      {
        "group": "occupational_health_safety",
        "diagnostic_count": 16
      },
      {
        "group": "labor_working_conditions",
        "diagnostic_count": 2
      },
      {
        "group": "emergency_preparedness",
        "diagnostic_count": 1
      },
      {
        "group": "security_personnel",
        "diagnostic_count": 3
      },
      {
        "group": "monitoring_review",
        "diagnostic_count": 1
      },
      {
        "group": "policy_esms",
        "diagnostic_count": 2
      },
      {
        "group": "community_health_safety",
        "diagnostic_count": 1
      },
      {
        "group": "grievance_external_communications",
        "diagnostic_count": 1
      },
      {
        "group": "stakeholder_engagement",
        "diagnostic_count": 1
      }
    ]
  },
  {
    "performance_standard": "PS5",
    "label": "IFC PS5",
    "diagnostic_count": 98,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 7,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 10,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > General > Project Design",
        "diagnostic_count": 1,
        "section_id": "requirements_general_project_design"
      },
      {
        "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
        "diagnostic_count": 6,
        "section_id": "requirements_general_compensation_and_benefits_for_displaced_persons"
      },
      {
        "section": "Requirements > General > Community Engagement",
        "diagnostic_count": 5,
        "section_id": "requirements_general_community_engagement"
      },
      {
        "section": "Requirements > General > Grievance Mechanism",
        "diagnostic_count": 1,
        "section_id": "requirements_general_grievance_mechanism"
      },
      {
        "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
        "diagnostic_count": 16,
        "section_id": "requirements_general_resettlement_and_livelihood_restoration_planning_and_implementation"
      },
      {
        "section": "Requirements > Displacement",
        "diagnostic_count": 7,
        "section_id": "requirements_displacement"
      },
      {
        "section": "Requirements > Displacement > Physical Displacement",
        "diagnostic_count": 18,
        "section_id": "requirements_displacement_physical_displacement"
      },
      {
        "section": "Unclassified",
        "diagnostic_count": 3,
        "section_id": "unclassified"
      },
      {
        "section": "Requirements > Displacement > Economic Displacement",
        "diagnostic_count": 13,
        "section_id": "requirements_displacement_economic_displacement"
      },
      {
        "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
        "diagnostic_count": 11,
        "section_id": "requirements_private_sector_responsibilities_under_government_managed_resettlement"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 8
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 10
      },
      {
        "group": "land_acquisition_resettlement",
        "diagnostic_count": 62
      },
      {
        "group": "stakeholder_engagement",
        "diagnostic_count": 4
      },
      {
        "group": "monitoring_review",
        "diagnostic_count": 4
      },
      {
        "group": "grievance_external_communications",
        "diagnostic_count": 1
      },
      {
        "group": "labor_working_conditions",
        "diagnostic_count": 3
      },
      {
        "group": "risk_identification",
        "diagnostic_count": 1
      },
      {
        "group": "security_personnel",
        "diagnostic_count": 2
      },
      {
        "group": "economic_displacement",
        "diagnostic_count": 2
      },
      {
        "group": "community_health_safety",
        "diagnostic_count": 1
      }
    ]
  },
  {
    "performance_standard": "PS6",
    "label": "IFC PS6",
    "diagnostic_count": 71,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 3,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 2,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > General",
        "diagnostic_count": 9,
        "section_id": "requirements_general"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity",
        "diagnostic_count": 5,
        "section_id": "requirements_protection_and_conservation_of_biodiversity"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity > Modified Habitat",
        "diagnostic_count": 3,
        "section_id": "requirements_protection_and_conservation_of_biodiversity_modified_habitat"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
        "diagnostic_count": 7,
        "section_id": "requirements_protection_and_conservation_of_biodiversity_natural_habitat"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
        "diagnostic_count": 10,
        "section_id": "requirements_protection_and_conservation_of_biodiversity_critical_habitat"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
        "diagnostic_count": 8,
        "section_id": "requirements_protection_and_conservation_of_biodiversity_legally_protected_and_internationally_recognized_areas"
      },
      {
        "section": "Requirements > Protection and Conservation of Biodiversity > Invasive Alien Species",
        "diagnostic_count": 3,
        "section_id": "requirements_protection_and_conservation_of_biodiversity_invasive_alien_species"
      },
      {
        "section": "Requirements > Management of Ecosystem Services",
        "diagnostic_count": 6,
        "section_id": "requirements_management_of_ecosystem_services"
      },
      {
        "section": "Requirements > Sustainable Management of Living Natural Resources",
        "diagnostic_count": 9,
        "section_id": "requirements_sustainable_management_of_living_natural_resources"
      },
      {
        "section": "Requirements > Supply Chain",
        "diagnostic_count": 6,
        "section_id": "requirements_supply_chain"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 3
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 6
      },
      {
        "group": "risk_identification",
        "diagnostic_count": 1
      },
      {
        "group": "biodiversity_conservation",
        "diagnostic_count": 49
      },
      {
        "group": "community_health_safety",
        "diagnostic_count": 2
      },
      {
        "group": "general",
        "diagnostic_count": 1
      },
      {
        "group": "monitoring_review",
        "diagnostic_count": 3
      },
      {
        "group": "resource_efficiency",
        "diagnostic_count": 1
      },
      {
        "group": "policy_esms",
        "diagnostic_count": 1
      },
      {
        "group": "third_party_workers_supply_chain",
        "diagnostic_count": 4
      }
    ]
  },
  {
    "performance_standard": "PS7",
    "label": "IFC PS7",
    "diagnostic_count": 46,
    "sections": [
      {
        "section": "Scope of Application",
        "diagnostic_count": 6,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > General > Avoidance of Adverse Impacts",
        "diagnostic_count": 4,
        "section_id": "requirements_general_avoidance_of_adverse_impacts"
      },
      {
        "section": "Requirements > General > Participation and Consent",
        "diagnostic_count": 7,
        "section_id": "requirements_general_participation_and_consent"
      },
      {
        "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
        "diagnostic_count": 11,
        "section_id": "requirements_circumstances_requiring_free_prior_and_informed_consent_impacts_on_lands_and_natural_resources_subject_to_traditional_ownership_or_under_customary_use"
      },
      {
        "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
        "diagnostic_count": 3,
        "section_id": "requirements_circumstances_requiring_free_prior_and_informed_consent_relocation_of_indigenous_peoples_from_lands_and_natural_resources_subject_to_traditional_ownership_or_under_customary_use"
      },
      {
        "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
        "diagnostic_count": 5,
        "section_id": "requirements_circumstances_requiring_free_prior_and_informed_consent_critical_cultural_heritage"
      },
      {
        "section": "Requirements > Mitigation and Development Benefits",
        "diagnostic_count": 6,
        "section_id": "requirements_mitigation_and_development_benefits"
      },
      {
        "section": "Requirements > Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues",
        "diagnostic_count": 4,
        "section_id": "requirements_private_sector_responsibilities_where_government_is_responsible_for_managing_indigenous_peoples_issues"
      }
    ],
    "conceptual_groups": [
      {
        "group": "applicability_scope",
        "diagnostic_count": 6
      },
      {
        "group": "risk_identification",
        "diagnostic_count": 3
      },
      {
        "group": "indigenous_peoples",
        "diagnostic_count": 10
      },
      {
        "group": "community_health_safety",
        "diagnostic_count": 12
      },
      {
        "group": "stakeholder_engagement",
        "diagnostic_count": 4
      },
      {
        "group": "monitoring_review",
        "diagnostic_count": 3
      },
      {
        "group": "fpic_participation_consent",
        "diagnostic_count": 2
      },
      {
        "group": "economic_displacement",
        "diagnostic_count": 2
      },
      {
        "group": "occupational_health_safety",
        "diagnostic_count": 1
      },
      {
        "group": "labor_working_conditions",
        "diagnostic_count": 1
      },
      {
        "group": "mitigation_and_development_benefits",
        "diagnostic_count": 1
      },
      {
        "group": "objectives",
        "diagnostic_count": 1
      }
    ]
  },
  {
    "performance_standard": "PS8",
    "label": "IFC PS8",
    "diagnostic_count": 52,
    "sections": [
      {
        "section": "Objectives",
        "diagnostic_count": 2,
        "section_id": "objectives"
      },
      {
        "section": "Scope of Application",
        "diagnostic_count": 10,
        "section_id": "scope_of_application"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution",
        "diagnostic_count": 4,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Chance Find Procedures",
        "diagnostic_count": 4,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_chance_find_procedures"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Consultation",
        "diagnostic_count": 3,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_consultation"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Community Access",
        "diagnostic_count": 1,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_community_access"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
        "diagnostic_count": 6,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_removal_of_replicable_cultural_heritage"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Non-Replicable Cultural Heritage",
        "diagnostic_count": 4,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_removal_of_non_replicable_cultural_heritage"
      },
      {
        "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
        "diagnostic_count": 11,
        "section_id": "requirements_protection_of_cultural_heritage_in_project_design_and_execution_critical_cultural_heritage"
      },
      {
        "section": "Requirements > Project's Use of Cultural Heritage",
        "diagnostic_count": 7,
        "section_id": "requirements_project_s_use_of_cultural_heritage"
      }
    ],
    "conceptual_groups": [
      {
        "group": "objectives",
        "diagnostic_count": 2
      },
      {
        "group": "applicability_scope",
        "diagnostic_count": 10
      },
      {
        "group": "critical_habitat_protected_areas",
        "diagnostic_count": 7
      },
      {
        "group": "cultural_heritage",
        "diagnostic_count": 22
      },
      {
        "group": "policy_esms",
        "diagnostic_count": 1
      },
      {
        "group": "stakeholder_engagement",
        "diagnostic_count": 6
      },
      {
        "group": "biodiversity_conservation",
        "diagnostic_count": 2
      },
      {
        "group": "community_health_safety",
        "diagnostic_count": 2
      }
    ]
  }
];

export const ifcMeMatrixDiagnostics = [
  {
    "diagnostic_id": "IFC_ME_PS1_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 21,
    "performance_standard": "PS1",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "* To identify and evaluate environmental and social risks and impacts of the project.",
    "audit_question": "Does the project have a clear risk and impact evaluation framework?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 22,
    "performance_standard": "PS1",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "* To adopt a mitigation hierarchy to anticipate and avoid, or where avoidance is not possible, minimize, [FN5] and, where residual impacts remain, compensate/offset for risks and impacts to workers, Affected Communities, and the environment.",
    "audit_question": "Does the project define a risk mitigation hierarchy in accordance with Performance Standard 1?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 24,
    "performance_standard": "PS1",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "3",
    "ifc_provision": "* To promote improved environmental and social performance of clients through the effective use of management systems.",
    "audit_question": "Does the project utilize management systems to promote improved environmental and social performance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 25,
    "performance_standard": "PS1",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "3",
    "ifc_provision": "* To ensure that grievances from Affected Communities and external communications from other stakeholders are responded to and managed appropriately.",
    "audit_question": "Are grievances from Affected Communities and other stakeholders managed appropriately?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 26,
    "performance_standard": "PS1",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "3",
    "ifc_provision": "* To promote and provide means for adequate engagement with Affected Communities throughout the project cycle on issues that could potentially affect them and to ensure that relevant environmental and social information is disclosed and disseminated.",
    "audit_question": "Does the project have a mechanism for promoting engagement with Affected Communities on issues that could potentially affect them and which is based on disclosed of relevant information? If so, does is this mechanism designed to extend throughout the project lifecycle?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 28,
    "performance_standard": "PS1",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "4",
    "ifc_provision": "This Performance Standard applies to business activities with environmental and/or social risks and/or impacts.",
    "audit_question": "Do the proposed project activities entail potential environmental and/or social risks and/or impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 33,
    "performance_standard": "PS1",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "4",
    "ifc_provision": "The requirements of this Performance Standard apply to all business activities unless otherwise noted in the specific limitations described in each of the paragraphs below.",
    "audit_question": "Does the project apply the requirements of the Performance Standard to all business activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 36,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "The client, in coordination with other responsible government agencies and third parties as appropriate, [FN8] will conduct a process of environmental and social assessment, and establish and maintain an ESMS appropriate to the nature and scale of the project and commensurate with the level of its environmental and social risks and impacts.",
    "audit_question": "Is the process of environmental and social assessment, and the resulting ESMS, commensurate with the project's environmental and social risks and impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 37,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "[FN8] That is, those parties legally obligated and responsible for assessing and managing specific risks and impacts (e.g., government-led resettlement).",
    "audit_question": "Are the roles of project stakeholders and third parties clearly defined?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 38,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "The ESMS will incorporate the following elements:",
    "audit_question": "Does the ESMS address each of the following points?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 47,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The client will establish an overarching policy defining the environmental and social objectives and principles that guide the project to achieve sound environmental and social performance. [FN9]",
    "audit_question": "Does the project employ a policy governing environmental and social performance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 49,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The policy provides a framework for the environmental and social assessment and management process, and specifies that the project (or business activities, as appropriate) will comply with the applicable laws and regulations of the jurisdictions in which it is being undertaken, including those laws implementing host country obligations under international law.",
    "audit_question": "Does the project's environmental and social performance policy i) provide a framework for environmental and social assessment and management, and ii) commit the project to compliance with applicable laws (including laws of the host country as well as international law)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 50,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The policy should be consistent with the principles of the Performance Standards.",
    "audit_question": "Is the project's environmental and social performance policy consistent with the principles of the Performance Standards?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 51,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "Under some circumstances, clients may also subscribe to other internationally recognized standards, certification schemes, or codes of practice and these too should be included in the policy.",
    "audit_question": "Does the project subscribe to other external standards, schemes or codes of practice? If so, are they included in the environmental and social performance policy?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 52,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "6",
    "ifc_provision": "The policy will indicate who, within the client's organization, will ensure conformance with the policy and be responsible for its execution (with reference to an appropriate responsible government agency or third party, as necessary).",
    "audit_question": "Does the project's environmental and social performance policy indicate responsible parties for its execution?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 53,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Policy",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Policy"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "6",
    "ifc_provision": "The client will communicate the policy to all levels of its organization.",
    "audit_question": "Was the policy effectively communicated throughout the entirety of the organization?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 55,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The client will establish and maintain a process for identifying the environmental and social risks and impacts of the project (see paragraph 18 for competency requirements).",
    "audit_question": "Has the client established and maintained a process for identifying the environmental and social risks and impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 56,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The type, scale, and location of the project guide the scope and level of effort devoted to the risks and impacts identification process.",
    "audit_question": "Was the scope and level of effort devoted identification of risks appropriate for the type, scale, and location of the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 57,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The scope of the risks and impacts identification process will be consistent with good international industry practice, [FN10] and will determine the appropriate and relevant methods and assessment tools.",
    "audit_question": "Is the process for risk and impact identification consistent with good international industry practice\u2014displaying professional skill, diligence, prudence, and foresight?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 63,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The risks and impacts identification process will be based on recent environmental and social baseline data at an appropriate level of detail.",
    "audit_question": "Was the process of risks and impacts identification informed by recent and suitably detailed baseline data?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 64,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The process will consider all relevant environmental and social risks and impacts of the project, including the issues identified in Performance Standards 2 through 8, and those who are likely to be affected by such risks and impacts. [FN12]",
    "audit_question": "Does the project's risk and impacts identification process account for all eight Performance Standards? Does it identify project-affected peoples with regard to each Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 66,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "The risks and impacts identification process will consider the emissions of greenhouse gases, the relevant risks associated with a changing climate and the adaptation opportunities, and potential trans-boundary effects, such as pollution of air, or use or pollution of international waterways.",
    "audit_question": "Does the process of risks and impacts identification take climate issues, including emissions of greenhouse gases and climate change, into consideration, and are the issues addressed adequately?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 67,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "Where the project involves specifically identified physical elements, aspects, and facilities that are likely to generate impacts, environmental and social risks and impacts will be identified in the context of the project's area of influence. This area of influence encompasses, as appropriate:",
    "audit_question": "Where the physical infrastructure associate with project operations may impose environmental and social impacts, has the project's definition of its area of impact taken into consideration the following elements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 68,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "* The area likely to be affected by:",
    "audit_question": "* areas likely to be affected",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 69,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "(i) the project [FN13] and the client's activities and facilities that are directly owned, operated or managed (including by contractors) and that that are a component of the project; [FN14]",
    "audit_question": "** project and client activities and facilities that are directly owned, operated or managed (including by contractors)",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 72,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "(ii) impacts from unplanned but predictable developments caused by the project that may occur later or at a different location; or",
    "audit_question": "** impacts from unplanned but predictable developments caused by the project that may occur later or at a different location",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 73,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "(iii) indirect project impacts on biodiversity or on ecosystem services upon which Affected Communities' livelihoods are dependent.",
    "audit_question": "** indirect project impacts on biodiversity or on ecosystem services upon which Affected Communities' livelihoods are dependent",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 74,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "8",
    "ifc_provision": "* Associated facilities, which are facilities that are not funded as part of the project and that would not have been constructed or expanded if the project did not exist and without which the project would not have been viable. [FN15]",
    "audit_question": "* associated facilities",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 76,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "8",
    "ifc_provision": "* Cumulative impacts [FN16] that result from the incremental impact, on areas or resources used or directly impacted by the project, from other existing, planned or reasonably defined developments at the time the risks and impacts identification process is conducted.",
    "audit_question": "* cumulative impacts",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 78,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "9",
    "ifc_provision": "In the event of risks and impacts in the project\u2019s area of influence resulting from a third party\u2019s actions, the client will address those risks and impacts in a manner commensurate with the client\u2019s control and influence over the third parties, and with due regard to conflict of interest.",
    "audit_question": "Where risks and impacts have resulted, or may result, from the actions of any third party within the project's area of influence, did the project attempt to work with the concerned parties to identify appropriate risk-management measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 79,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "10",
    "ifc_provision": "Where the client can reasonably exercise control, the risks and impacts identification process will also consider those risks and impacts associated with primary supply chains, as defined in Performance Standard 2 (paragraphs 27\u201329) and Performance Standard 6 (paragraph 30).",
    "audit_question": "Where the client can exercise a reasonable amount of control over primary supply chains, has it made an examination of risks and impacts in accordance with PS2:27-29 and PS6:30?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 80,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "11",
    "ifc_provision": "Where the project involves specifically identified physical elements, aspects and facilities that are likely to generate environmental and social impacts, the identification of risks and impacts will take into account the findings and conclusions of related and applicable plans, studies, or assessments prepared by relevant government authorities or other parties that are directly related to the project and its area of influence. [FN17]",
    "audit_question": "Has the project taken into account the data provided by relevant governmental authorities and other interested parties\u2014including scientific concerns or concerns from the Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 83,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "11",
    "ifc_provision": "The risks and impacts identification will take account of the outcome of the engagement process with Affected Communities as appropriate.",
    "audit_question": "Was the identification of risks and impacts appropriately considerate of the outcomes of engagement with Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 84,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "Where the project involves specifically identified physical elements, aspects and facilities that are likely to generate impacts, and as part of the process of identifying risks and impacts, the client will identify individuals and groups that may be directly and differentially or disproportionately affected by the project because of their disadvantaged or vulnerable status. [FN18]",
    "audit_question": "Where the physical elements, aspects and facilities of the project are likely to generate impacts, were disadvantaged or vulnerable individuals and groups identified?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 86,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Identification of Risks and Impacts",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Identification of Risks and Impacts"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "Where individuals or groups are identified as disadvantaged or vulnerable, the client will propose and implement differentiated measures so that adverse impacts do not fall disproportionately on them and they are not disadvantaged in sharing development benefits and opportunities.",
    "audit_question": "Does the project employ measures to ensure that (i) adverse impacts do not disproportionately affect individuals or groups identified as disadvantaged or vulnerable and (ii) that these groups are not further disadvantaged by the structure of project benefits-sharing arrangements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 87,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "Consistent with the client\u2019s policy and the objectives and principles described therein, the client will establish management programs that, in sum, will describe mitigation and performance improvement measures and actions that address the identified environmental and social risks and impacts of the project.",
    "audit_question": "Has the project established, maintained and utilized management programs to address identified environmental and social risks and impacts in a manner compatible with client policy and PS1?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 88,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "14",
    "ifc_provision": "Depending on the nature and scale of the project, these programs may consist of some documented combination of operational procedures, practices, plans, and related supporting documents (including legal agreements) that are managed in a systematic way. [FN19]",
    "audit_question": "Does the project employ operational management programs, and if so, are such documents managed in a systematic way?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 90,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "14",
    "ifc_provision": "The programs may apply broadly across the client\u2019s organization, including contractors and primary suppliers over which the organization has control or influence, or to specific sites, facilities, or activities.",
    "audit_question": "Are the management programs incorporated broadly throughout the project organization as well as to entities within the project's control or influence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 91,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "14",
    "ifc_provision": "The mitigation hierarchy to address identified risks and impacts will favor the avoidance of impacts over minimization, and, where residual impacts remain, compensation/offset, wherever technically [FN20] and financially feasible. [FN21]",
    "audit_question": "Has the project employed a mitigation hierarchy to address identified risks and impacts? In cases where avoidance was untenable, did it favor avoidance over minimization and provide compensation for impacts wherever technically and financially feasible?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 94,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "15",
    "ifc_provision": "Where the identified risks and impacts cannot be avoided, the client will identify mitigation and performance measures and establish corresponding actions to ensure the project will operate in compliance with applicable laws and regulations, and meet the requirements of Performance Standards 1 through 8.",
    "audit_question": "Where risks and impacts cannot be avoided, has the client identified mitigation and performance measures ensuring the project's compliance with applicable laws and the requirements of the Performance Standards?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 95,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "15",
    "ifc_provision": "The level of detail and complexity of this collective management program and the priority of the identified measures and actions will be commensurate with the project\u2019s risks and impacts, and will take account of the outcome of the engagement process with Affected Communities as appropriate.",
    "audit_question": "Is the project's management program (i) formulated to a level of detail and complexity and the priority of actions were commensurate with the risks and impacts of the project; and (ii) considerate of the outcome of the engagement process with Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 96,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "The management programs will establish environmental and social Action Plans, [FN22] which will define desired outcomes and actions to address the issues raised in the risks and impacts identification process, as measurable events to the extent possible, with elements such as performance indicators, targets, or acceptance criteria that can be tracked over defined time periods, and with estimates of the resources and responsibilities for implementation.",
    "audit_question": "Does the environmental and social Action Plans define desired outcomes and specify actions and measurable targets to address issues stemming from identified risks and impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 98,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "As appropriate, the management program will recognize and incorporate the role of relevant actions and events controlled by third parties to address identified risks and impacts.",
    "audit_question": "Where actions and events are controlled by third parties, has the project's management program incorporated their role in such within project risks and impacts management programme?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 99,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Management Programs",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Management Programs"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "Recognizing the dynamic nature of the project, the management program will be responsive to changes in circumstances, unforeseen events, and the results of monitoring and review.",
    "audit_question": "Is the project's management program appropriately responsive to changes in circumstances, unforeseen events, and monitoring results and review?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 101,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "The client, in collaboration with appropriate and relevant third parties, will establish, maintain, and strengthen as necessary an organizational structure that defines roles, responsibilities, and authority to implement the ESMS.",
    "audit_question": "Has the project established, in collaboration with the relevant third parties, an organizational structure to define roles, responsibilities, and authority to implement the ESMS?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 102,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "Specific personnel, including management representative(s), with clear lines of responsibility and authority should be designated.",
    "audit_question": "Has the project adequately designated responsibilities and authority of specific personnel?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_047",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 103,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "Key environmental and social responsibilities should be well defined and communicated to the relevant personnel and to the rest of the client\u2019s organization.",
    "audit_question": "Were environmental and social responsibilities defined and communicated effectively throughout the client's organization?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_048",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 104,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "Sufficient management sponsorship and human and financial resources will be provided on an ongoing basis to achieve effective and continuous environmental and social performance.",
    "audit_question": "Is the project providing, on a continuous basis, sufficient human and financial resources to achieving environmental and social performance targets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_049",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 105,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "18",
    "ifc_provision": "Personnel within the client\u2019s organization with direct responsibility for the project\u2019s environmental and social performance will have the knowledge, skills, and experience necessary to perform their work, including current knowledge of the host country\u2019s regulatory requirements and the applicable requirements of Performance Standards 1 through 8.",
    "audit_question": "Were personnel with responsibility for the project's environmental and social performance chosen and employed according to required skills, knowledge and experience for social performance management?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_050",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 106,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "18",
    "ifc_provision": "Personnel will also possess the knowledge, skills, and experience to implement the specific measures and actions required under the ESMS and the methods required to perform the actions in a competent and efficient manner.",
    "audit_question": "Do the personnel employed for ESMS implementation possess adequate knowledge, skills, and experience necessary to implement the ESMS in a competent and efficient manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_051",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 107,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "19",
    "ifc_provision": "The process of identification of risks and impacts will consist of an adequate, accurate, and objective evaluation and presentation, prepared by competent professionals.",
    "audit_question": "Was the process of risks and impacts identification characterized by adequate, accurate, and objective evaluations and presentations that were prepared by competent professionals?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_052",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 108,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Organizational Capacity and Competency",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Organizational Capacity and Competency"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "19",
    "ifc_provision": "For projects posing potentially significant adverse impacts or where technically complex issues are involved, clients may be required to involve external experts to assist in the risks and impacts identification process.",
    "audit_question": "Was external expertise engaged to assist the process of risk and impacts identification?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_053",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 110,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "20",
    "ifc_provision": "Where the project involves specifically identified physical elements, aspects and facilities that are likely to generate impacts, the ESMS will establish and maintain an emergency preparedness and response system so that the client, in collaboration with appropriate and relevant third parties, will be prepared to respond to accidental and emergency situations associated with the project in a manner appropriate to prevent and mitigate any harm to people and/or the environment.",
    "audit_question": "Where the project involves specifically identified physical elements, aspects and facilities that are likely to generate impacts, has the project's ESMS, in collaboration with appropriate and relevant third parties, established an emergency preparedness and response system that can respond to accidental and emergency situations associated with the project in a manner appropriate to prevent and mitigate any harm to people and/or the environment?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_054",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 111,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "20",
    "ifc_provision": "This preparation will include the identification of areas where accidents and emergency situations may occur, communities and individuals that may be impacted, response procedures, provision of equipment and resources, designation of responsibilities, communication, including that with potentially Affected Communities and periodic training to ensure effective response.",
    "audit_question": "Did the preparation of the project's emergency preparedness and response system adequately identify areas where accidents and emergency situations may occur, communities and individuals that may be impacted, and response procedures? Did it also provide for equipment and resources, designate responsibilities and communication protocol, and provide for periodic training to ensure effective response\u2014including those for potentially Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_055",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 112,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "20",
    "ifc_provision": "The emergency preparedness and response activities will be periodically reviewed and revised, as necessary, to reflect changing conditions.",
    "audit_question": "Is the emergency preparedness and response system continuously reviewed and revised according to the circumstances of the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_056",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 113,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "Where applicable, the client will also assist and collaborate with the potentially Affected Communities (see Performance Standard 4) and the local government agencies in their preparations to respond effectively to emergency situations, especially when their participation and collaboration are necessary to ensure effective response.",
    "audit_question": "Is the client collaborating with the potentially Affected Communities and the local government agencies in their preparations to respond effectively to emergency situations, according to the specifications of both this Performance Standard and the specifications of Performance Standard 4?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_057",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 114,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "If local government agencies have little or no capacity to respond effectively, the client will play an active role in preparing for and responding to emergencies associated with the project.",
    "audit_question": "Where local government agencies cannot guarantee effective response to project-related emergencies, has the project employed an active role in the preparation for and response to such?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_058",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 115,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Emergency Preparedness and Response",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Emergency Preparedness and Response"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "The client will document its emergency preparedness and response activities, resources, and responsibilities, and will provide appropriate information to potentially Affected Community and relevant government agencies.",
    "audit_question": "Are the activities of the emergency preparedness and response system adequately documented and disseminated to potentially Affected Communities and relevant government agencies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_059",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 117,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "The client will establish procedures to monitor and measure the effectiveness of the management program, as well as compliance with any related legal and/or contractual obligations and regulatory requirements.",
    "audit_question": "Has the client established adequate procedures to monitor and measure the effectiveness of its management program? If so, is it effectively and appropriately monitoring compliance with any regulatory requirements or contractual obligations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_060",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 118,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "Where the government or other third party has responsibility for managing specific risks and impacts and associated mitigation measures, the client will collaborate in establishing and monitoring such mitigation measures.",
    "audit_question": "Has the client collaborated with government or other third parties in establishing and monitoring mitigation measures in cases where third parties carry managerial responsibility?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_061",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 119,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "Where appropriate, clients will consider involving representatives from Affected Communities to participate in monitoring activities. [FN23]",
    "audit_question": "Are representatives from Affected Communities adequately included in the monitoring and reviewing of project activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_062",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 121,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "The client\u2019s monitoring program should be overseen by the appropriate level in the organization.",
    "audit_question": "Is the oversight of the monitoring program conducted by the appropriate level of the organization?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_063",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 122,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "For projects with significant impacts, the client will retain external experts to verify its monitoring information.",
    "audit_question": "Does the project employed external expertise to verify its monitoring information?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_064",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 123,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "The extent of monitoring should be commensurate with the project\u2019s environmental and social risks and impacts and with compliance requirements.",
    "audit_question": "Is the extent of the monitoring program commensurate with the associated risks and impacts of the project, and with compliance requirements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_065",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 124,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "6",
    "paragraph": "23",
    "ifc_provision": "In addition to recording information to track performance and establishing relevant operational controls, the client should use dynamic mechanisms, such as internal inspections and audits, where relevant, to verify compliance and progress toward the desired outcomes.",
    "audit_question": "Does the project employ dynamic mechanisms, such as internal inspections and audits, where relevant, to verify compliance with regulatory frameworks and progress towards desired outcomes?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_066",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 126,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "23",
    "ifc_provision": "Monitoring should be adjusted according to performance experience and actions requested by relevant regulatory authorities.",
    "audit_question": "Are the client's monitoring activities adjusted according to performance experience and requests from relevant regulatory authorities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_067",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 127,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "23",
    "ifc_provision": "The client will document monitoring results and identify and reflect the necessary corrective and preventive actions in the amended management program and plans.",
    "audit_question": "Are monitoring results used by the client to identify necessary corrective and preventive actions? If so, are these adequately reflected in the amended management program and plans?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_068",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 128,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "23",
    "ifc_provision": "The client, in collaboration with appropriate and relevant third parties, will implement these corrective and preventive actions, and follow up on these actions in upcoming monitoring cycles to ensure their effectiveness.",
    "audit_question": "Are corrective and preventive actions being implemented in collaboration with appropriate and relevant third parties? If so, are such also being followed-up regularly throughout the project lifecycle?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_069",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 129,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "24",
    "ifc_provision": "Senior management in the client organization will receive periodic performance reviews of the effectiveness of the ESMS, based on systematic data collection and analysis.",
    "audit_question": "Does the senior management of the client organization receive periodic reviews of the effectiveness of the ESMS based on systematic data collection and analysis?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_070",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 130,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "24",
    "ifc_provision": "The scope and frequency of such reporting will depend upon the nature and scope of the activities identified and undertaken in accordance with the client\u2019s ESMS and other applicable project requirements.",
    "audit_question": "Is the scope and frequency of data and analysis reporting commensurate with the ESMS and the project requirements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_071",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 131,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Monitoring and Review",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Monitoring and Review"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "24",
    "ifc_provision": "Based on results within these performance reviews, senior management will take the necessary and appropriate steps to ensure the intent of the client\u2019s policy is met, that procedures, practices, and plans are being implemented, and are seen to be effective.",
    "audit_question": "Is senior management of the client organization taking appropriate steps to ensure the fulfilment of policy intent based on the results of continuous performance reviews?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_072",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 134,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "25",
    "ifc_provision": "[FN25] Requirements regarding engagement of workers and related grievance redress procedures are found in Performance Standard 2.",
    "audit_question": "Does the project's engagement of stakeholders in comply with the requirements stipulated in Performance Standard 2 regarding engagement of workers and related grievance redress procedures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_073",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 135,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "25",
    "ifc_provision": "Stakeholder engagement is an ongoing process that may involve, in varying degrees, the following elements: stakeholder analysis and planning, disclosure and dissemination of information, consultation and participation, grievance mechanism, and ongoing reporting to Affected Communities.",
    "audit_question": "Is the project's process of stakeholder engagement ongoing\u2014including, in varying degrees, recurring stakeholder analysis and planning, disclosure and dissemination of information, consultation and participation, grievance mechanism, and ongoing reporting to Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_074",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 136,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "25",
    "ifc_provision": "The nature, frequency, and level of effort of stakeholder engagement may vary considerably and will be commensurate with the project\u2019s risks and adverse impacts, and the project\u2019s phase of development.",
    "audit_question": "Is the nature, frequency, and level of effort of stakeholder engagement commensurate with the project\u2019s risks and adverse impacts, and the project\u2019s phase of development?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_075",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 138,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "26",
    "ifc_provision": "Clients should identify the range of stakeholders that may be interested in their actions and consider how external communications might facilitate a dialog with all stakeholders (paragraph 34 below).",
    "audit_question": "Has the client identified all potentially relevant stakeholders, and were measures considered to facilitate communications with these stakeholders?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_076",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 139,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "26",
    "ifc_provision": "Where projects involve specifically identified physical elements, aspects and/or facilities that are likely to generate adverse environmental and social impacts to Affected Communities the client will identify the Affected Communities and will meet the relevant requirements described below.",
    "audit_question": "Where projects involve specifically identified physical elements, aspects and/or facilities that are likely to generate adverse environmental and social impacts, has the client met the following requirements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_077",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 140,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "27",
    "ifc_provision": "The client will develop and implement a Stakeholder Engagement Plan that is scaled to the project risks and impacts and development stage, and be tailored to the characteristics and interests of the Affected Communities.",
    "audit_question": "Has the client developed a Stakeholder Engagement Plan that is commensurate with the project's risks and impacts? If so, has it been tailored to the characteristics and interests of Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_078",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 141,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "27",
    "ifc_provision": "Where applicable, the Stakeholder Engagement Plan will include differentiated measures to allow the effective participation of those identified as disadvantaged or vulnerable.",
    "audit_question": "Where applicable, does the Stakeholder Engagement Plan that allows for the effective participation of groups and persons identified as disadvantaged or vulnerable?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_079",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 142,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "27",
    "ifc_provision": "When the stakeholder engagement process depends substantially on community representatives, [FN25] the client will make every reasonable effort to verify that such persons do in fact represent the views of Affected Communities and that they can be relied upon to faithfully communicate the results of consultations to their constituents.",
    "audit_question": "In cases where the stakeholder engagement process depends on community representatives\u2014such as religious leaders, civil society representatives, or government representatives\u2014has the client adequately verified the accurate representation of Affected Communities by these representatives?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_080",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 144,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Stakeholder Analysis and Engagement Planning",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Stakeholder Analysis and Engagement Planning"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "In cases where the exact location of the project is not known, but it is reasonably expected to have significant impacts on local communities, the client will prepare a Stakeholder Engagement Framework, as part of its management program, outlining general principles and a strategy to identify Affected Communities and other relevant stakeholders and plan for an engagement process compatible with this Performance Standard that will be implemented once the physical location of the project is known.",
    "audit_question": "In cases where the exact location of the project is not known, but it is reasonably expected to have significant impacts on local communities, has the client prepared, as part of its management program, a Stakeholder Engagement Framework that outlines general principles and a strategy to identify Affected Communities and other relevant stakeholders and plan for an engagement process to be implemented once the physical location of the project is known?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_081",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 146,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "Disclosure of relevant project information helps Affected Communities and other stakeholders understand the risks, impacts and opportunities of the project. The client will provide Affected Communities with access to relevant information [FN26] on:",
    "audit_question": "Do Affected Communities have access to the relevant information on the aspects and elements listed below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_082",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 148,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "(i) the purpose, nature, and scale of the project;",
    "audit_question": "* the purpose, nature, and scale of the project",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_083",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 149,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "(ii) the duration of proposed project activities;",
    "audit_question": "* the duration of proposed project activities",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_084",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 150,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "(iii) any risks to and potential impacts on such communities and relevant mitigation measures;",
    "audit_question": "* any risks to and potential impacts on such communities and relevant mitigation measures",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_085",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 151,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "(iv) the envisaged stakeholder engagement process; and",
    "audit_question": "* the envisaged stakeholder engagement process",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_086",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 152,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Disclosure of Information",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Disclosure of Information"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "29",
    "ifc_provision": "(v) the grievance mechanism.",
    "audit_question": "* the grievance mechanism",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_087",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 154,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "When Affected Communities are subject to identified risks and adverse impacts from a project, the client will undertake a process of consultation in a manner that provides the Affected Communities with opportunities to express their views on project risks, impacts and mitigation measures, and allows the client to consider and respond to them.",
    "audit_question": "Have the Affected Communities who are subject to identified risks and impacts been consulted in a manner providing them opportunities to express their views? If so, has the client considered and responded to these views in an appropriate manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_088",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 155,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "The extent and degree of engagement required by the consultation process should be commensurate with the project\u2019s risks and adverse impacts and with the concerns raised by the Affected Communities.",
    "audit_question": "Is the extent of engagement with Affected Communities commensurate with their concerns and the risks faced by them stemming from the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_089",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 156,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "Effective consultation is a two-way process that should:",
    "audit_question": "Does the consultation with Affected Communities fulfill the following criteria?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_090",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 157,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(i) begin early in the process of identification of environmental and social risks and impacts and continue on an ongoing basis as risks and impacts arise;",
    "audit_question": "* Did identification of environmental and social risks and impacts begin early in the project lifecycle and continue on an ongoing basis as risks and impacts arise?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_091",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 158,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(ii) be based on the prior disclosure and dissemination of relevant, transparent, objective, meaningful and easily accessible information which is in a culturally appropriate local language(s) and format and is understandable to Affected Communities;",
    "audit_question": "* Were consultations based on the prior disclosure and dissemination of relevant, transparent, objective, meaningful and easily accessible information which is in a culturally appropriate local language(s) and format and is understandable to Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_092",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 159,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(iii) focus inclusive [FN27] engagement on those directly affected as opposed to those not directly affected;",
    "audit_question": "* Did the project focus on inclusive engagement with those directly affected (as distinguished from those not directly affected)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_093",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 161,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(iv) be free of external manipulation, interference, coercion, or intimidation;",
    "audit_question": "* Was the consultation process free of external manipulation, interference, coercion, or intimidation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_094",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 162,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(v) enable meaningful participation, where applicable; and",
    "audit_question": "* Did the consultation process enable meaningful participation, where applicable?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_095",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 163,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "(vi) be documented.",
    "audit_question": "* Is the consultation process well documented?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_096",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 164,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Consultation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Consultation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "30",
    "ifc_provision": "The client will tailor its consultation process to the language preferences of the Affected Communities, their decision-making process, and the needs of disadvantaged or vulnerable groups. If clients have already engaged in such a process, they will provide adequate documented evidence of such engagement.",
    "audit_question": "Has the client tailored its consultation process to the needs of Affected Communities and groups identified as disadvantaged or vulnerable? If so, has it maintained adequate documentation of this engagement?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_097",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 166,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Informed Consultation and Participation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "For projects with potentially significant adverse impacts on Affected Communities, the client will conduct an Informed Consultation and Participation (ICP) process that will build upon the steps outlined above in Consultation and will result in the Affected Communities\u2019 informed participation.",
    "audit_question": "For project with potentially significant adverse impacts on Affected Communities, did the client conduct an Informed Consultation and Participation (ICP) process that builds upon project consultation processes and that seeks to culminate in the Affected Communities\u2019 informed participation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_098",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 168,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Informed Consultation and Participation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "The consultation process should:",
    "audit_question": "Did the consultation process attend to each of the following issues?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_099",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 169,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Informed Consultation and Participation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(i) capture both men\u2019s and women\u2019s views, if necessary through separate forums or engagements, and",
    "audit_question": "* Did the consultation process adequately address and incorporate the views and concerns of both men and women?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_100",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 170,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Informed Consultation and Participation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(ii) reflect men\u2019s and women\u2019s different concerns and priorities about impacts, mitigation mechanisms, and benefits, where appropriate.",
    "audit_question": "* Did the consultation process reflect men\u2019s and women\u2019s different concerns and priorities about impacts, mitigation mechanisms, and benefits, where appropriate?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_101",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 171,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Informed Consultation and Participation",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Informed Consultation and Participation"
    ],
    "conceptual_group": "policy_esms",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "The client will document the process, in particular the measures taken to avoid or minimize risks to and adverse impacts on the Affected Communities, and will inform those affected about how their concerns have been considered.",
    "audit_question": "Did the client document the consultation process\u2014in particular, the measures taken to avoid or minimize risks to and adverse impacts on the Affected Communities? Did the client inform those affected about how their concerns have been considered?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_102",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 173,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Indigenous Peoples",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Indigenous Peoples"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "32",
    "ifc_provision": "For projects with adverse impacts to Indigenous Peoples, the client is required to engage them in a process of ICP and in certain circumstances the client is required to obtain their Free, Prior, and Informed Consent (FPIC). The requirements related to Indigenous Peoples and the definition of the special circumstances requiring FPIC are described in Performance Standard 7.",
    "audit_question": "For projects with adverse impacts to Indigenous Peoples, did the project engage the affected Indigenous Peoples communities in a process of ICP and was their FPIC obtained in accordance with the circumstances described in Performance Standard 7?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_103",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 175,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Private Sector Responsibilities Under Government-Led Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Private Sector Responsibilities Under Government-Led Stakeholder Engagement"
    ],
    "conceptual_group": "objectives",
    "page": "9",
    "paragraph": "33",
    "ifc_provision": "Where stakeholder engagement is the responsibility of the host government, the client will collaborate with the responsible government agency, to the extent permitted by the agency, to achieve outcomes that are consistent with the objectives of this Performance Standard.",
    "audit_question": "Where the responsibility of stakeholder engagement lies with the host government, has the client collaborated with the government to achieve outcomes that are consistent with the objectives of the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_104",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 176,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Private Sector Responsibilities Under Government-Led Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Private Sector Responsibilities Under Government-Led Stakeholder Engagement"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "33",
    "ifc_provision": "In addition, where government capacity is limited, the client will play an active role during the stakeholder engagement planning, implementation, and monitoring.",
    "audit_question": "If the government capacity is limited, has the client played an active role in the planning, implementation and monitoring of stakeholder engagement?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_105",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 177,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Stakeholder Engagement > Private Sector Responsibilities Under Government-Led Stakeholder Engagement",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Stakeholder Engagement",
      "Private Sector Responsibilities Under Government-Led Stakeholder Engagement"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "33",
    "ifc_provision": "If the process conducted by the government does not meet the relevant requirements of this Performance Standard, the client will conduct a complementary process and, where appropriate, identify supplemental actions.",
    "audit_question": "In instances where the process conducted by the host government is not compliant with relevant requirements of the Performance Standard, has the client conducted a complementary process? If so, have supplemental actions been identified?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_106",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 180,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "Clients will implement and maintain a procedure for external communications that includes methods to",
    "audit_question": "Has the client established a procedure for external communications that incorporated the following methods?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_107",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 181,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "(i) receive and register external communications from the public;",
    "audit_question": "* Are communications from the public systematically received and registered?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_108",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 182,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "(ii) screen and assess the issues raised and determine how to address them;",
    "audit_question": "* Are registered communications screened and assessed to determine responsive actions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_109",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 183,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "(iii) provide, track, and document responses, if any; and",
    "audit_question": "* Does the project actively provide, track, and document responses, if any?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_110",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 184,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "(iv) adjust the management program, as appropriate.",
    "audit_question": "* Does the project adjust its management programs, as appropriate, in response to its interactions with the public?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_111",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 185,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > External Communications",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "External Communications"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "34",
    "ifc_provision": "In addition, clients are encouraged to make publically available periodic reports on their environmental and social sustainability.",
    "audit_question": "Has the client made periodic reports on its environmental and social sustainability publicly available?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_112",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 187,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "35",
    "ifc_provision": "Where there are Affected Communities, the client will establish a grievance mechanism to receive and facilitate resolution of Affected Communities\u2019 concerns and grievances about the client\u2019s environmental and social performance.",
    "audit_question": "Has the client established a grievance mechanism to receive and facilitate the resolution of concerns and grievances from Affected Communities regarding project environmental and social performance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_113",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 188,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "35",
    "ifc_provision": "The grievance mechanism should be scaled to the risks and adverse impacts of the project and have Affected Communities as its primary user.",
    "audit_question": "Is the grievance mechanism scaled to and based on risks and adverse impacts faced by Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_114",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 189,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "35",
    "ifc_provision": "It should seek to resolve concerns promptly, using an understandable and transparent consultative process that is culturally appropriate and readily accessible, and at no cost and without retribution to the party that originated the issue or concern.",
    "audit_question": "Does the grievance mechanism help to resolve concerns promptly and in an understandable, transparent and culturally appropriate manner? Is it employed without costs or retribution to the party from which the concern arose?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_115",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 190,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "35",
    "ifc_provision": "The mechanism should not impede access to judicial or administrative remedies.",
    "audit_question": "Does the project employ adequate measures to ensure that the grievance mechanism does not impede access to judicial and/or administrative remedies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_116",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 191,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "35",
    "ifc_provision": "The client will inform the Affected Communities about the mechanism in the course of the stakeholder engagement process.",
    "audit_question": "Did the client inform the Affected Communities about the mechanism in the course of the stakeholder engagement process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_117",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 193,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > Ongoing Reporting to Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "Ongoing Reporting to Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "36",
    "ifc_provision": "The client will provide periodic reports to the Affected Communities that describe progress with implementation of the project Action Plans on issues that involve ongoing risk to or impacts on Affected Communities and on issues that the consultation process or grievance mechanism have identified as a concern to those Communities.",
    "audit_question": "Are Affected Communities periodically and adequately informed on the progress of Action Plan implementation on issues identified as relevant to them?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_118",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 194,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "36",
    "ifc_provision": "If the management program results in material changes in or additions to the mitigation measures or actions described in the Action Plans on issues of concern to the Affected Communities, the updated relevant mitigation measures or actions will be communicated to them.",
    "audit_question": "When the mitigation measures or actions of the Action Plans on issues of concern to Affected Communities have been changed as a result of stakeholder feedback of management program implementation experience, is the relevant information communicated to Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS1_119",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS1",
    "source_row": 195,
    "performance_standard": "PS1",
    "section": "Requirements > Environmental and Social Assessment and Management System > External Communications and Grievance Mechanisms > Grievance Mechanisms for Affected Communities",
    "section_path": [
      "Requirements",
      "Environmental and Social Assessment and Management System",
      "External Communications and Grievance Mechanisms",
      "Grievance Mechanisms for Affected Communities"
    ],
    "conceptual_group": "policy_esms",
    "page": "9",
    "paragraph": "36",
    "ifc_provision": "The frequency of these reports will be proportionate to the concerns of Affected Communities but not less than annually.",
    "audit_question": "Is the frequency of project reviews and reporting proportionate to the concerns of Affected Communities and not less than annually?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 13,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "To promote the fair treatment, non-discrimination, and equal opportunity of workers",
    "audit_question": "Does the project promote the fair treatment, non-discrimination, and equal opportunity of the personnel it will engage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 14,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To establish, maintain, and improve the worker-management relationship",
    "audit_question": "Has the project made efforts to establish, maintain, and improve the worker-management relationship?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 15,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To promote compliance with national employment and labor laws",
    "audit_question": "Are the project's labor practices compliant with relevant national employment and labor laws?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 16,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To protect workers, including vulnerable categories of workers such as children, migrant workers, workers engaged by third parties, and workers in the client\u2019s supply chain",
    "audit_question": "Does the client's labor policies adequately provide for the protection of workers? Does this protection extend through the client's supply chain?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 17,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To promote safe and healthy working conditions, and the health of workers",
    "audit_question": "Does the project adequately promote safe and healthy working conditions, and the health of workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 18,
    "performance_standard": "PS2",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To avoid the use of forced labor",
    "audit_question": "Has the project ensured that no forced labor will be used?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 20,
    "performance_standard": "PS2",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Has the project adopted a stance on PS2 applicability?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 21,
    "performance_standard": "PS2",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System (ESMS), the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the Environmental and Social Management System (ESMS) provide for the management of the implementation of actions necessary to achieve compliance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 22,
    "performance_standard": "PS2",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "4",
    "ifc_provision": "The scope of application of this Performance Standard depends on the type of employment relationship between the client and the worker.",
    "audit_question": "Has the scope of application for the project been determined?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 35,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "The client will adopt and implement human resources policies and procedures appropriate to its size and workforce that set out its approach to managing workers consistent with the requirements of this Performance Standard and national law.",
    "audit_question": "Are the human resources policies and procedures of the project compliant with the requirements of PS2 and national law? Are they appropriate to the project's size?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 36,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "2",
    "paragraph": "9",
    "ifc_provision": "The client will provide workers with documented information that is clear and understandable, regarding their rights under national labor and employment law and any applicable collective agreements, including their rights related to hours of work, wages, overtime, compensation, and benefits upon beginning the working relationship and when any material changes occur.",
    "audit_question": "Does the project provide workers with clear and understandable information regarding their rights under national law and applicable collective agreements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 38,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "Where the client is a party to a collective bargaining agreement with a workers\u2019 organization, such agreement will be respected.",
    "audit_question": "Is the client party to any applicable collective bargaining agreements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 39,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "Where such agreements do not exist, or do not address working conditions and terms of employment [FN5], the client will provide reasonable working conditions and terms of employment [FN6].",
    "audit_question": "Does the project ensure that reasonable working conditions and terms of employment are provided?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 42,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "2",
    "paragraph": "11",
    "ifc_provision": "The client will identify migrant workers and ensure that they are engaged on substantially equivalent terms and conditions to non-migrant workers carrying out similar work.",
    "audit_question": "Does the project ensure the equivalent terms and conditions of engagement for migrant workers as compared to non-migrant workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 43,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "Where accommodation services [FN7] are provided to workers covered by the scope of this Performance Standard, the client will put in place and implement policies on the quality and [FN8] management of the accommodation and provision of basic services.",
    "audit_question": "Does the project have policies on the quality and management of accommodation services to workers, including via third parties?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 46,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The accommodation services will be provided in a manner consistent with the principles of non-discrimination and equal opportunity.",
    "audit_question": "Are the project's policies for accommodation services consistent with the principles of non-discrimination and equal opportunity?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 47,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "Workers\u2019 accommodation arrangements should not restrict workers\u2019 freedom of movement or of association.",
    "audit_question": "Has the client ensured that workers' accommodation arrangements do not hinder their freedom of movement or of association?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 49,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "13",
    "ifc_provision": "In countries where national law recognizes workers\u2019 rights to form and to join workers\u2019 organizations of their choosing without interference and to bargain collectively, the client will comply with national law.",
    "audit_question": "Has the client evaluated the national legal framework regarding workers' organizations, as well as project compliance with national law?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 50,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "3",
    "paragraph": "13",
    "ifc_provision": "Where national law substantially restricts workers\u2019 organizations, the client will not restrict workers from developing alternative mechanisms to express their grievances and protect their rights regarding working conditions and terms of employment.",
    "audit_question": "If national law restricts workers' organizations, does the project ensure that workers can develop alternative mechanisms to express grievances and protect their rights?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 51,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "14",
    "ifc_provision": "The client should not seek to influence or control these mechanisms.",
    "audit_question": "Does the project ensure non-interference with alternative mechanisms to protect workers' rights?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 53,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "14",
    "ifc_provision": "The client will engage with such workers\u2019 representatives and workers\u2019 organizations, and provide them with information needed for meaningful negotiation in a timely manner.",
    "audit_question": "Does the project engage with workers' representatives and organizations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 56,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "The client will not make employment decisions on the basis of personal characteristics [FN9] unrelated to inherent job requirements.",
    "audit_question": "Do the project's hiring policies ensure that employment decisions are not based on personal characteristics unrelated to job requirements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 58,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "The client will base the employment relationship on the principle of equal opportunity and fair treatment, and will not discriminate with respect to any aspects of the employment relationship, such as recruitment and hiring, compensation (including wages and benefits), working conditions and terms of employment, access to training, job assignment, promotion, termination of employment or retirement, and disciplinary practices.",
    "audit_question": "Has the project established processes to ensure non-discrimination in all employment relationship?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 59,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "The client will take measures to prevent and address harassment, intimidation, and/or exploitation, especially in regard to women.",
    "audit_question": "Has the project defined measures to prevent and address harassment, intimidation, and/or exploitation of workers, and to prevent gender discrimination?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 60,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "The principles of non-discrimination apply to migrant workers.",
    "audit_question": "Do the project's non-discrimination measures and policies take migrant workers into account?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 61,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "16",
    "ifc_provision": "In countries where national law provides for non-discrimination in employment, the client will comply with national law",
    "audit_question": "Has the project's compliance with national non-discrimination law been evaluated?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 62,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "16",
    "ifc_provision": "When national laws are silent on non-discrimination in employment, the client will meet this Performance Standard.",
    "audit_question": "Has the project identified the gaps between national non-discrimination law and the requirements of PS2? Does it ensure compliance with PS2 requirements where gaps are identified?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 66,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "18",
    "ifc_provision": "Prior to implementing any collective dismissals, [FN10] the client will carry out an analysis of alternatives to retrenchment. [FN11]",
    "audit_question": "Has the project established procedures for investigating alternatives to retrenchment in its policies on collective dismissals?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 69,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "18",
    "ifc_provision": "If the analysis does not identify viable alternatives to retrenchment, a retrenchment plan will be developed and implemented to reduce the adverse impacts of retrenchment on workers",
    "audit_question": "Has the project established procedures for developing a retrenchment plan should it become necessary?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 70,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "18",
    "ifc_provision": "The retrenchment plan will be based on the principle of non-discrimination and will reflect the client\u2019s consultation with workers, their organizations, and, where appropriate, the government, and comply with collective bargaining agreements if they exist",
    "audit_question": "Does the project ensure non-discrimination in the development of a retrenchment plan?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 71,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "18",
    "ifc_provision": "The client will comply with all legal and contractual requirements related to notification of public authorities, and provision of information to, and consultation with workers and their organizations.",
    "audit_question": "Has the project developed plans for consulting with workers and their organizations, and for ensuring compliance with all legal and contractual requirements, in the event of retrenchment?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 72,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "19",
    "ifc_provision": "The client should ensure that all workers receive notice of dismissal and severance payments mandated by law and collective agreements in a timely manner.",
    "audit_question": "Do the project's policies on dismissal ensure proper notice and severance payments as mandated by law and collective agreements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 73,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "19",
    "ifc_provision": "All outstanding back pay and social security benefits and pension contributions and benefits will be paid (i) on or before termination of the working relationship to the workers, (ii) where appropriate, for the benefit of the workers, or (iii) payment will be made in accordance with a timeline agreed through a collective agreement.",
    "audit_question": "Does the project have a policy on back pay, social security benefits, and pension contributions and benefits?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 74,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "19",
    "ifc_provision": "Where payments are made for the benefit of workers, workers will be provided with evidence of such payments.",
    "audit_question": "Has the project established a procedure for payments made for the benefit of workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 76,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "20",
    "ifc_provision": "The client will provide a grievance mechanism for workers (and their organizations, where they exist) to raise workplace concerns.",
    "audit_question": "Has the project established a grievance mechanism for workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 77,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "20",
    "ifc_provision": "The client will inform the workers of the grievance mechanism at the time of recruitment and make it easily accessible to them.",
    "audit_question": "Is the project's grievance mechanism easily accessible to workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 78,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "20",
    "ifc_provision": "The mechanism should involve an appropriate level of management and address concerns promptly, using an understandable and transparent process that provides timely feedback to those concerned, without any retribution",
    "audit_question": "Is the grievance mechanism appropriately managed and capable of addressing concerns promptly and transparently?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 79,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "20",
    "ifc_provision": "The mechanism should also allow for anonymous complaints to be raised and addressed.",
    "audit_question": "Does the grievance mechanism allow for anonymous complaints?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 80,
    "performance_standard": "PS2",
    "section": "Requirements > Working Conditions and Management of Worker Relationship",
    "section_path": [
      "Requirements",
      "Working Conditions and Management of Worker Relationship"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "20",
    "ifc_provision": "The mechanism should not impede access to other judicial or administrative remedies that might be available under the law or through existing arbitration procedures, or substitute for grievance mechanisms provided through collective agreements.",
    "audit_question": "Does the grievance mechanism ensure that workers can still access other judicial or administrative remedies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 83,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "21",
    "ifc_provision": "The client will not employ children in any manner that is economically exploitative, or is likely to be hazardous or to interfere with the child\u2019s education, or to be harmful to the child\u2019s health or physical, mental, spiritual, moral, or social development.",
    "audit_question": "Does the project adequately ensure the avoidance of employing child labor?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 84,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "protecting_the_work_force",
    "page": "4",
    "paragraph": "21",
    "ifc_provision": "The client will identify the presence of all persons under the age of 18.",
    "audit_question": "Has the project established adequate procedures for determining the age of the people it will employ?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 85,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "monitoring_review",
    "page": "4",
    "paragraph": "21",
    "ifc_provision": "Where national laws have provisions for the employment of minors, the client will follow those laws applicable to the client.",
    "audit_question": "Has the project reviewed the national legal framework regarding child labor?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 86,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "protecting_the_work_force",
    "page": "4",
    "paragraph": "21",
    "ifc_provision": "Children under the age of 18 will not be employed in hazardous work. [FN12]",
    "audit_question": "Do the project's hiring policies ensure that children under the age of 18 will not be employed in hazardous work?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 88,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "policy_esms",
    "page": "4",
    "paragraph": "21",
    "ifc_provision": "All work of persons under the age of 18 will be subject to an appropriate risk assessment and regular monitoring of health, working conditions, and hours of work.",
    "audit_question": "Does the project have a policy on the usage of child labor?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 90,
    "performance_standard": "PS2",
    "section": "Requirements > Protecting the Work Force",
    "section_path": [
      "Requirements",
      "Protecting the Work Force"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "5",
    "paragraph": "22",
    "ifc_provision": "The client will not employ forced labor, which consists of any work or service not voluntarily performed that is exacted from an individual under threat of force or penalty.",
    "audit_question": "Has the project defined adequate measures to ensure the avoidance of employing forced labor and trafficked persons?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 95,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "The client will provide a safe and healthy work environment, taking into account inherent risks in its particular sector and specific classes of hazards in the client\u2019s work areas, including physical, chemical, biological, and radiological hazards, and specific threats to women.",
    "audit_question": "Has the project evaluated the safety of its work environments?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_047",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 96,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "The client will take steps to prevent accidents, injury, and disease arising from, associated with, or occurring in the course of work by minimizing, as far as reasonably practicable, the causes of hazards.",
    "audit_question": "Has the project taken adequate steps to minimize identified causes of hazards?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_048",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 98,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "(i) identification of potential hazards to workers, particularly those that may be life-threatening;",
    "audit_question": "Has the project identified potential hazards to workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_049",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 99,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "(ii) provision of preventive and protective measures, including modification, substitution, or elimination of hazardous conditions or substances;",
    "audit_question": "Have preventive and protective measures been established by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_050",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 100,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "(iii) training of workers;",
    "audit_question": "Does the project adequately address occupational health and safety in its training of workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_051",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 101,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "(iv) documentation and reporting of occupational accidents, diseases, and incidents; and",
    "audit_question": "Have processes for documenting and reporting accidents, diseases, and incidents been established by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_052",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 102,
    "performance_standard": "PS2",
    "section": "Requirements > Occupational Health and Safety",
    "section_path": [
      "Requirements",
      "Occupational Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "(v) emergency prevention, preparedness, and response arrangements.",
    "audit_question": "Has the project made adequate arrangements for emergency prevention, preparedness and response?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_053",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 106,
    "performance_standard": "PS2",
    "section": "Requirements > Workers Engaged by Third Parties",
    "section_path": [
      "Requirements",
      "Workers Engaged by Third Parties"
    ],
    "conceptual_group": "policy_esms",
    "page": "5",
    "paragraph": "24",
    "ifc_provision": "With respect to contracted workers the client will take commercially reasonable efforts to ascertain that the third parties who engage these workers are reputable and legitimate enterprises and have an appropriate ESMS that will allow them to operate in a manner consistent with the requirements of this Performance Standard, except for paragraphs 18\u201319, and 27\u201329.",
    "audit_question": "Has the project defined adequate measures to ensure the legitimacy of third parties employers engaging contracted workers, and for ascertaining whether they have an appropriate ESMS?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_054",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 107,
    "performance_standard": "PS2",
    "section": "Requirements > Workers Engaged by Third Parties",
    "section_path": [
      "Requirements",
      "Workers Engaged by Third Parties"
    ],
    "conceptual_group": "monitoring_review",
    "page": "5",
    "paragraph": "25",
    "ifc_provision": "The client will establish policies and procedures for managing and monitoring the performance of such third party employers in relation to the requirements of this Performance Standard.",
    "audit_question": "Have policies and procedures for managing and monitoring the performance of third party employers with regard to PS2 been established by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_055",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 108,
    "performance_standard": "PS2",
    "section": "Requirements > Workers Engaged by Third Parties",
    "section_path": [
      "Requirements",
      "Workers Engaged by Third Parties"
    ],
    "conceptual_group": "third_party_workers_supply_chain",
    "page": "5",
    "paragraph": "25",
    "ifc_provision": "In addition, the client will use commercially reasonable efforts to incorporate these requirements in contractual agreements with such third party employers.",
    "audit_question": "Are the requirements of PS2 been incorporated into contractual agreements between the project and third party employers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_056",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 109,
    "performance_standard": "PS2",
    "section": "Requirements > Workers Engaged by Third Parties",
    "section_path": [
      "Requirements",
      "Workers Engaged by Third Parties"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "5",
    "paragraph": "26",
    "ifc_provision": "The client will ensure that contracted workers, covered in paragraphs 24\u201325 of this Performance Standard, have access to a grievance mechanism.",
    "audit_question": "Does the project ensure access to a grievance mechanism for contracted workers?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_057",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 110,
    "performance_standard": "PS2",
    "section": "Requirements > Workers Engaged by Third Parties",
    "section_path": [
      "Requirements",
      "Workers Engaged by Third Parties"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "5",
    "paragraph": "26",
    "ifc_provision": "In cases where the third party is not able to provide a grievance mechanism the client will extend its own grievance mechanism to serve workers engaged by the third party.",
    "audit_question": "Does the project provide a grievance mechanism for contracted workers where the third party employer does not have one?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_058",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 112,
    "performance_standard": "PS2",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "6",
    "paragraph": "27",
    "ifc_provision": "Where there is a high risk of child labor or forced labor [FN15] in the primary supply chain, the client will identify those risks consistent with paragraphs 21 and 22 above.",
    "audit_question": "Has the client identified the risk of child labor or forced labor in the primary supply chain?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_059",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 114,
    "performance_standard": "PS2",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "6",
    "paragraph": "27",
    "ifc_provision": "If child labor or forced labor cases are identified, the client will take appropriate steps to remedy them.",
    "audit_question": "Has the project established procedures for remedying identified child labor or forced labor cases in the primary supply chain?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS2_060",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS2",
    "source_row": 115,
    "performance_standard": "PS2",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "6",
    "paragraph": "28",
    "ifc_provision": "Additionally, where there is a high risk of significant safety issues related to supply chain workers, the client will introduce procedures and mitigation measures to ensure that primary suppliers within the supply chain are taking steps to prevent or to correct life-threatening situations.",
    "audit_question": "Has the project introduced procedures for ensuring that primary suppliers take adequate steps to prevent significant safety issues?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 14,
    "performance_standard": "PS3",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": null,
    "ifc_provision": "* To avoid or minimize adverse impacts on human health and the environment by avoiding or minimizing pollution from project activities.",
    "audit_question": "Does the project avoid or minimize adverse impacts on human health and the environment by avoiding or minimizing pollution from project activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 15,
    "performance_standard": "PS3",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": null,
    "ifc_provision": "* To promote more sustainable use of resources, including energy and water.",
    "audit_question": "Does the project promote more sustainable use of resources, including energy and water?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 17,
    "performance_standard": "PS3",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": null,
    "ifc_provision": "Scope of Application",
    "audit_question": "Does the project have measures in place that help to reduce project-related GHG emissions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 18,
    "performance_standard": "PS3",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Has the project adopted a stance on PS3 applicability?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 19,
    "performance_standard": "PS3",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System, the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the Environmental and Social Management System (ESMS) provide for the management of the implementation of actions necessary to achieve compliance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 21,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "1",
    "paragraph": "4",
    "ifc_provision": "During the project life-cycle, the client will consider ambient conditions and apply technically and financially feasible resource efficiency and pollution prevention principles and techniques that are best suited to avoid, or where avoidance is not possible, minimize adverse impacts on human health and the environment. [FN3]",
    "audit_question": "Does the project consider ambient conditions and apply technically and financially feasible resource efficiency and pollution prevention principles and techniques that are best suited to avoid, or where avoidance is not possible, minimize adverse impacts on human health and the environment?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 23,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "requirements",
    "page": "44928",
    "paragraph": "4",
    "ifc_provision": "The principles and techniques applied during the project life-cycle will be tailored to the hazards and risks associated with the nature of the project and consistent with good international industry practice (GIIP), [FN4] as reflected in various internationally recognized sources, including the World Bank Group Environmental, Health and Safety Guidelines (EHS Guidelines).",
    "audit_question": "Does the project apply principles and techniques that are tailored to the hazards and risks associated with the nature of the project and consistent with good international industry practice (GIIP)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 25,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "The client will refer to the EHS Guidelines or other internationally recognized sources, as appropriate, when evaluating and selecting resource efficiency and pollution prevention and control techniques for the project.",
    "audit_question": "Does the client refer to the EHS Guidelines or other internationally recognized sources, as appropriate, when evaluating and selecting resource efficiency and pollution prevention and control techniques for the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 27,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "requirements",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "When host country regulations differ from the levels and measures presented in the EHS Guidelines, clients will be required to achieve whichever is more stringent.",
    "audit_question": "When host country regulations differ from the levels and measures presented in the EHS Guidelines, does the client achieve whichever is more stringent?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 28,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "risk_identification",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "If less stringent levels or measures than those provided in the EHS Guidelines are appropriate in view of specific project circumstances, the client will provide full and detailed justification for any proposed alternatives through the environmental and social risks and impacts identification and assessment process.",
    "audit_question": "Where the client applies stringent levels or measures, is this supported by full and detailed justification for the proposed alternatives through the environmental and social risks and impacts identification and assessment process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 29,
    "performance_standard": "PS3",
    "section": "Requirements",
    "section_path": [
      "Requirements"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "This justification must demonstrate that the choice for any alternate performance levels is consistent with the objectives of this Performance Standard.",
    "audit_question": "Does the justification demonstrate that the choice for any alternate performance levels is consistent with the objectives of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 31,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency",
    "section_path": [
      "Requirements",
      "Resource Efficiency"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The client will implement technically and financially feasible and cost effective [FN5] measures for improving efficiency in its consumption of energy, water, as well as other resources and material inputs, with a focus on areas that are considered core business activities.",
    "audit_question": "Does the client implement technically and financially feasible and cost effective measures for improving efficiency in its consumption of energy, water, as well as other resources and material inputs, with a focus on areas that are considered core business activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 33,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency",
    "section_path": [
      "Requirements",
      "Resource Efficiency"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "Such measures will integrate the principles of cleaner production into product design and production processes with the objective of conserving raw materials, energy, and water.",
    "audit_question": "Do the efficiency improvement measures integrate the principles of cleaner production into product design and production processes with the objective of conserving raw materials, energy, and water?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 34,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency",
    "section_path": [
      "Requirements",
      "Resource Efficiency"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "Where benchmarking data are available, the client will make a comparison to establish the relative level of efficiency.",
    "audit_question": "Are benchmarking data are available? If so, has the client made a comparison to establish the relative level of efficiency?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 36,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency > Greenhouse Gases",
    "section_path": [
      "Requirements",
      "Resource Efficiency",
      "Greenhouse Gases"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "In addition to the resource efficiency measures described above, the client will consider alternatives and implement technically and financially feasible and cost-effective options to reduce project-related GHG emissions during the design and operation of the project.",
    "audit_question": "Has the client considered alternatives and implemented technically and financially feasible and cost-effective options to reduce project-related GHG emissions during the design and operation of the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 38,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency > Greenhouse Gases",
    "section_path": [
      "Requirements",
      "Resource Efficiency",
      "Greenhouse Gases"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "44960",
    "paragraph": "8",
    "ifc_provision": "For projects that are expected to or currently produce more than 25,000 tonnes of CO2- equivalent annually, [FN6] the client will quantify direct emissions from the facilities owned or controlled within the physical project boundary, [FN7] as well as indirect emissions associated with the off-site production of energy [FN8] used by the project.",
    "audit_question": "Is the project expected to, or does it currently, produce more than 25,000 tonnes of CO2- equivalent annually? If so, has the client quantified direct emissions from the facilities owned or controlled within the physical project boundary, as well as indirect emissions associated with the off-site production of energy used by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 42,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency > Greenhouse Gases",
    "section_path": [
      "Requirements",
      "Resource Efficiency",
      "Greenhouse Gases"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "Quantification of GHG emissions will be conducted by the client annually in accordance with internationally recognized methodologies and good practice.[FN9]",
    "audit_question": "Does the client conduct quantification of GHG emissions annually in accordance with internationally recognized methodologies and good practice?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 45,
    "performance_standard": "PS3",
    "section": "Requirements > Resource Efficiency > Water Consumption",
    "section_path": [
      "Requirements",
      "Resource Efficiency",
      "Water Consumption"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "When the project is a potentially significant consumer of water, in addition to applying the resource efficiency requirements of this Performance Standard, the client shall adopt measures that avoid or reduce water usage so that the project\u2019s water consumption does not have significant adverse impacts on others.",
    "audit_question": "Is the project is a potentially significant consumer of water? If so, does the client adopt measures that avoid or reduce water usage to avoid significant adverse impacts on others?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 48,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention",
    "section_path": [
      "Requirements",
      "Pollution Prevention"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "The client will avoid the release of pollutants or, when avoidance is not feasible, minimize and/or control the intensity and mass flow of their release.",
    "audit_question": "Does the client will avoid the release of pollutants or, when avoidance is not feasible, minimize and/or control the intensity and mass flow of their release?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 51,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention",
    "section_path": [
      "Requirements",
      "Pollution Prevention"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "Where historical pollution such as land or ground water contamination exists, the client will seek to determine whether it is responsible for mitigation measures.",
    "audit_question": "Does historical pollution such as land or ground water contamination exist? If so, does the client seek to determine whether it is responsible for mitigation measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 52,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention",
    "section_path": [
      "Requirements",
      "Pollution Prevention"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "If it is determined that the client is legally responsible, then these liabilities will be resolved in accordance with national law, or where this is silent, with GIIP.[FN11]",
    "audit_question": "Has the client been determined to be legally responsible for historical pollution? If so, have these liabilities will be resolved in accordance with national law, or where this is silent, with GIIP?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 54,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention",
    "section_path": [
      "Requirements",
      "Pollution Prevention"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "To address potential adverse project impacts on existing ambient conditions, [FN12] the client will consider relevant factors, including, for example (i) existing ambient conditions; (ii) the finite assimilative capacity [FN13] of the environment; (iii) existing and future land use; (iv) the project\u2019s proximity to areas of importance to biodiversity; and (v) the potential for cumulative impacts with uncertain and/or irreversible consequences.",
    "audit_question": "Has the client considered relevant factors to address potential adverse project impacts on existing ambient conditions,, including, for example (i) existing ambient conditions; (ii) the finite assimilative capacity of the environment; (iii) existing and future land use; (iv) the project\u2019s proximity to areas of importance to biodiversity; and (v) the potential for cumulative impacts with uncertain and/or irreversible consequences?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 57,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention",
    "section_path": [
      "Requirements",
      "Pollution Prevention"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "In addition to applying resource efficiency and pollution control measures as required in this Performance Standard, when the project has the potential to constitute a significant source of emissions in an already degraded area, the client will consider additional strategies and adopt measures that avoid or reduce negative effects.",
    "audit_question": "Does project have the potential to constitute a significant source of emissions in an already degraded area? If so, has the client considered additional strategies and adopt measures that avoid or reduce negative effects?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 60,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client will avoid the generation of hazardous and non-hazardous waste materials.",
    "audit_question": "Does the client will avoid the generation of hazardous and non-hazardous waste materials?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 61,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "Where waste generation cannot be avoided, the client will reduce the generation of waste, and recover and reuse waste in a manner that is safe for human health and the environment.",
    "audit_question": "Where waste generation cannot be avoided, has the client reduced the generation of waste, and recovered and reused waste in a manner that is safe for human health and the environment?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 62,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "Where waste cannot be recovered or reused, the client will treat, destroy, or dispose of it in an environmentally sound manner that includes the appropriate control of emissions and residues resulting from the handling and processing of the waste material.",
    "audit_question": "Where waste cannot be recovered or reused, has the client treated, destroyed, or disposed of it in an environmentally sound manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 63,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "44989",
    "paragraph": "12",
    "ifc_provision": "If the generated waste is considered hazardous, [FN14] the client will adopt GIIP alternatives for its environmentally sound disposal while adhering to the limitations applicable to its transboundary movement. [FN15]",
    "audit_question": "If the generated waste is considered hazardous, has the client adopted GIIP alternatives for its environmentally sound disposal while adhering to the limitations applicable to its transboundary movement?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 66,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "When hazardous waste disposal is conducted by third parties, the client will use contractors that are reputable and legitimate enterprises licensed by the relevant government regulatory agencies and obtain chain of custody documentation to the final destination.",
    "audit_question": "Is hazardous waste disposal conducted by third parties? If so, does the client use contractors that are reputable and legitimate enterprises licensed by the relevant government regulatory agencies and obtain chain of custody documentation to the final destination?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 67,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "The client should ascertain whether licensed disposal sites are being operated to acceptable standards and where they are, the client will use these sites.",
    "audit_question": "Has the client ascertained whether licensed disposal sites are being operated to acceptable standards and where they are, the client will use these sites?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 68,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Wastes",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Wastes"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "Where this is not the case, clients should reduce waste sent to such sites and consider alternative disposal options, including the possibility of developing their own recovery or disposal facilities at the project site.",
    "audit_question": "Where hazardous waste disposal is not conducted by third parties, does the client send waste to such sites and consider alternative disposal options, including the possibility of developing their own recovery or disposal facilities at the project site?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 71,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Hazardous Materials Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Hazardous Materials Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "The client will avoid or, when avoidance is not possible, minimize and control the release of hazardous materials.",
    "audit_question": "Does the client avoid or, when avoidance is not possible, minimize and control the release of hazardous materials?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 72,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Hazardous Materials Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Hazardous Materials Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "In this context, the production, transportation, handling, storage, and use of hazardous materials for project activities should be assessed.",
    "audit_question": "Has the client assessed the production, transportation, handling, storage, and use of hazardous materials for project activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 73,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Hazardous Materials Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Hazardous Materials Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "The client will consider less hazardous substitutes where hazardous materials are intended to be used in manufacturing processes or other operations.",
    "audit_question": "Has the client considered less hazardous substitutes where hazardous materials are intended to be used in manufacturing processes or other operations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 74,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Hazardous Materials Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Hazardous Materials Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "The client will avoid the manufacture, trade, and use of chemicals and hazardous materials subject to international bans or phase-outs due to their high toxicity to living organisms, environmental persistence, potential for bioaccumulation, or potential for depletion of the ozone layer. [FN16]",
    "audit_question": "Does the client avoid the manufacture, trade, and use of chemicals and hazardous materials subject to international bans or phase-outs?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 77,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "The client will, where appropriate, formulate and implement an integrated pest management (IPM) and/or integrated vector management (IVM) approach targeting economically significant pest infestations and disease vectors of public health significance.",
    "audit_question": "Where appropriate, has the client formulated and implemented an integrated pest management (IPM) and/or integrated vector management (IVM) approach targeting economically significant pest infestations and disease vectors of public health significance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 78,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "The client\u2019s IPM and IVM program will integrate coordinated use of pest and environmental information along with available pest control methods, including cultural practices, biological, genetic, and, as a last resort, chemical means to prevent economically significant pest damage and/or disease transmission to humans and animals.",
    "audit_question": "Does the client\u2019s IPM and IVM program integrate coordinated use of pest and environmental information along with available pest control methods, including cultural practices, biological, genetic, and, as a last resort, chemical means to prevent economically significant pest damage and/or disease transmission to humans and animals?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 79,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "When pest management activities include the use of chemical pesticides, the client will select chemical pesticides that are low in human toxicity, that are known to be effective against the target species, and that have minimal effects on non-target species and the environment.",
    "audit_question": "When pest management activities include the use of chemical pesticides, does the client select chemical pesticides that are low in human toxicity, that are known to be effective against the target species, and that have minimal effects on non-target species and the environment?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 80,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "When the client selects chemical pesticides, the selection will be based upon requirements that the pesticides be packaged in safe containers, be clearly labeled for safe and proper use, and that the pesticides have been manufactured by an entity currently licensed by relevant regulatory agencies.",
    "audit_question": "When the client selects chemical pesticides, is the selection based upon requirements that the pesticides be packaged in safe containers, be clearly labeled for safe and proper use, and that the pesticides have been manufactured by an entity currently licensed by relevant regulatory agencies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 81,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "16",
    "ifc_provision": "The client will design its pesticide application regime to (i) avoid damage to natural enemies of the target pest, and where avoidance is not possible, minimize, and (ii) avoid the risks associated with the development of resistance in pests and vectors, and where avoidance is not possible minimize.",
    "audit_question": "Has the client designed its pesticide application regime to (i) avoid damage to natural enemies of the target pest, and where avoidance is not possible, minimize, and (ii) avoid the risks associated with the development of resistance in pests and vectors, and where avoidance is not possible, to minimize risks?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 82,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "4",
    "paragraph": "16",
    "ifc_provision": "In addition, pesticides will be handled, stored, applied, and disposed of in accordance with the Food and Agriculture Organization\u2019s International Code of Conduct on the Distribution and Use of Pesticides or other GIIP.",
    "audit_question": "Are pesticides handled, stored, applied, and disposed of in accordance with the Food and Agriculture Organization\u2019s International Code of Conduct on the Distribution and Use of Pesticides or other GIIP?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 83,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "The client will not purchase, store, use, manufacture, or trade in products that fall in WHO Recommended Classification of Pesticides by Hazard Class Ia (extremely hazardous); or Ib (highly hazardous).",
    "audit_question": "Does the client avoid purchasing, storing, using, manufacturing, or trading in products that fall in WHO Recommended Classification of Pesticides by Hazard Class Ia (extremely hazardous); or Ib (highly hazardous)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 84,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "The client will not purchase, store, use, manufacture or trade in Class II (moderately hazardous) pesticides, unless the project has appropriate controls on manufacture, procurement, or distribution and/or use of these chemicals.",
    "audit_question": "Does the client avoid purchasing, storing, using, manufacturing, or trading in Class II (moderately hazardous) pesticides, unless the project has appropriate controls on manufacture, procurement, or distribution and/or use of these chemicals?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS3_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS3",
    "source_row": 85,
    "performance_standard": "PS3",
    "section": "Requirements > Pollution Prevention > Pesticide Use and Management",
    "section_path": [
      "Requirements",
      "Pollution Prevention",
      "Pesticide Use and Management"
    ],
    "conceptual_group": "pollution_prevention",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "These chemicals should not be accessible to personnel without proper training, equipment, and facilities to handle, store, apply, and dispose of these products properly.",
    "audit_question": "Are chemicals accessible only to personnel without proper training, equipment, and facilities to handle, store, apply, and dispose of these products properly?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 11,
    "performance_standard": "PS4",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To anticipate and avoid adverse impacts on the health and safety of the Affected Community during the project life from both routine and non-routine circumstances.",
    "audit_question": "Does the project have the necessary frameworks and plans established to anticipate and avoid adverse impacts on the health and safety of all identified Affected Communities? Do these frameworks and plans cover both routine and non-routine circumstances?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 12,
    "performance_standard": "PS4",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To ensure that the safeguarding of personnel and property is carried out in accordance with relevant human rights principles and in a manner that avoids or minimizes risks to the Affected Communities.",
    "audit_question": "In its policies on safeguarding personnel and property, does the project adequately ensure compliance with relevant human rights principles? Is the safeguarding of personnel and property carried out in a manner that avoids or minimizes risks to all identified Affected Communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 14,
    "performance_standard": "PS4",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Has the project taken a clear stance on PS4 applicability?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 15,
    "performance_standard": "PS4",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System, the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the project's Environmental and Social Management System (ESMS) define a process for managing the implementation of all actions needed to comply with the requirements of PS4?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 20,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "risk_identification",
    "page": "1",
    "paragraph": "5",
    "ifc_provision": "The client will evaluate the risks and impacts to the health and safety of the Affected Communities during the project life-cycle and will establish preventive and control measures consistent with good international industry practice (GIIP),[FN1] such as in the World Bank Group Environmental, Health and Safety Guidelines (EHS Guidelines) or other internationally recognized sources.",
    "audit_question": "Has the project evaluated the risks and impacts to the health and safety of all identified Affected Communities in accordance with good international industry practice (GIIP)? Does this evaluation cover the whole project life-cycle and establish preventive and control measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 22,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "1",
    "paragraph": "5",
    "ifc_provision": "The client will identify risks and impacts and propose mitigation measures that are commensurate with their nature and magnitude.",
    "audit_question": "Has the project proposed mitigation measures for every identified risk? Are these measures commensurate with their nature and magnitude?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 23,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "risk_identification",
    "page": "1",
    "paragraph": "5",
    "ifc_provision": "These measures will favor the avoidance of risks and impacts over minimization.",
    "audit_question": "Do the project's mitigation measures favor avoidance over minimization of risks and impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 25,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The client will design, construct, operate, and decommission the structural elements or components of the project in accordance with GIIP, taking into consideration safety risks to third parties or Affected Communities.",
    "audit_question": "Has the project ensured that the design, construction, operation, and decommission of structural elements or components is carried out in accordance with GIIP?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 26,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "When new buildings and structures will be accessed by members of the public, the client will consider incremental risks of the public\u2019s potential exposure to operational accidents and/or natural hazards and be consistent with the principles of universal access.",
    "audit_question": "In plans for new buildings and structures, does the project consider risks of the public's potential exposure to operational accidents and/or natural hazards? Are the plans consistent with the principles of universal access?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 27,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "Structural elements will be designed and constructed by competent professionals, and certified or approved by competent authorities or professionals.",
    "audit_question": "Does the project ensure that all structural elements are designed and constructed by competent? Has the project ensured certification or approval from competent authorities or professionals?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 28,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "When structural elements or components, such as dams, tailings dams, or ash ponds are situated in high-risk locations, and their failure or malfunction may threaten the safety of communities, the client will engage one or more external experts with relevant and recognized experience in similar projects, separate from those responsible for the design and construction, to conduct a review as early as possible in project development and throughout the stages of project design, construction, operation, and decommissioning.",
    "audit_question": "Does the project have contingency plans established for structural elements or components in high-risk locations? Do these plans include the engagement of external experts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 29,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "For projects that operate moving equipment on public roads and other forms of infrastructure, the client will seek to avoid the occurrence of incidents and injuries to members of the public associated with the operation of such equipment.",
    "audit_question": "Does the project adequately ensure the avoidance of incidents and injuries to members of the public where equipment is moved on public infrastructure?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 31,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "The client will avoid or minimize the potential for community exposure to hazardous materials and substances that may be released by the project.",
    "audit_question": "Does the project adequately ensure the avoidance or minimization of the potential for community exposure to hazardous materials and substances?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 32,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "Where there is a potential for the public (including workers and their families) to be exposed to hazards, particularly those that may be life-threatening, the client will exercise special care to avoid or minimize their exposure by modifying, substituting, or eliminating the condition or material causing the potential hazards.",
    "audit_question": "Has the project identified potential hazards from project activities to the public (including workers and their families), modified the conditions causing them, and takes steps to ensure the minimization of exposure?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 33,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "Where hazardous materials are part of existing project infrastructure or components, the client will exercise special care when conducting decommissioning activities in order to avoid exposure to the community.",
    "audit_question": "In its decommissioning plans, does the project ensure the avoidance of exposure to the community?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 34,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "The client will exercise commercially reasonable efforts to control the safety of deliveries of hazardous materials, and of transportation and disposal of hazardous wastes, and will implement measures to avoid or control community exposure to pesticides, in accordance with the requirements of Performance Standard 3.",
    "audit_question": "Does the project adequately control the safety of deliveries of hazardous materials, and of transportation and disposal of hazardous wastes?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 38,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "For example, land use changes or the loss of natural buffer areas such as wetlands, mangroves, and upland forests that mitigate the effects of natural hazards such as flooding, landslides, and fire, may result in increased vulnerability and community safety-related risks and impacts.",
    "audit_question": "Has the client identified the potential impact of project activities on priority ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 41,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "risk_identification",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "Where appropriate and feasible, the client will identify those risks and potential impacts on priority ecosystem services that may be exacerbated by climate change.",
    "audit_question": "Does the project account for climate change in its evaluation of risks and impacts on priority ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 42,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "Adverse impacts should be avoided, and if these impacts are unavoidable, the client will implement mitigation measures in accordance with paragraphs 24 and 25 of Performance Standard 6.",
    "audit_question": "Is the avoidance of adverse impacts ensured by the project? Are the proposed mitigation measures for adverse impacts compliant with paragraphs 24 and 25 of PS6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 43,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "With respect to the use of and loss of access to provisioning services, clients will implement mitigation measures in accordance with paragraphs 25\u201329 of Performance Standard 5.",
    "audit_question": "Has the project established procedures for implementing mitigation measures with regard to the use of and loss of access to provisioning services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 45,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "The client will avoid or minimize the potential for community exposure to water-borne, water-based, water-related, and vector-borne diseases, and communicable diseases that could result from project activities, taking into consideration differentiated exposure to and higher sensitivity of vulnerable groups.",
    "audit_question": "Does the project avoid or minimize the potential for community exposure to diseases that could result from project activities, with special consideration to vulnerable groups?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 46,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "Where specific diseases are endemic in communities in the project area of influence, the client is encouraged to explore opportunities during the project life-cycle to improve environmental conditions that could help minimize their incidence.",
    "audit_question": "Have any endemic diseases been identified in communities within the project's area of influence? Has the project explored opportunities to improve environmental conditions to help minimize their incidence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 47,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "The client will avoid or minimize transmission of communicable diseases that may be associated with the influx of temporary or permanent project labor.",
    "audit_question": "Has the project established procedures for the avoidance or minimization of the transmission of communicable diseases associated with the influx of project labor?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 49,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "In addition to the emergency preparedness and response requirements described in Performance Standard 1, the client will also assist and collaborate with the Affected Communities, local government agencies, and other relevant parties, in their preparations to respond effectively to emergency situations, especially when their participation and collaboration are necessary to respond to such emergency situations.",
    "audit_question": "Does the project collaborate with Affected Communities, local government agencies, and other relevant parties in establishing effective responses to emergency situations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 50,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "If local government agencies have little or no capacity to respond effectively, the client will play an active role in preparing for and responding to emergencies associated with the project.",
    "audit_question": "Has the client evaluated the capacity of local government agencies to respond effectively to emergency situations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 51,
    "performance_standard": "PS4",
    "section": "Requirements > Community Health and Safety",
    "section_path": [
      "Requirements",
      "Community Health and Safety"
    ],
    "conceptual_group": "emergency_preparedness",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "The client will document its emergency preparedness and response activities, resources, and responsibilities, and will disclose appropriate information to Affected Communities, relevant government agencies, or other relevant parties.",
    "audit_question": "Has a process for documenting the project's emergency preparedness and response activities, resources, and responsibilities? Have commensurate disclosure procedures been established?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 53,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "security_personnel",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "When the client retains direct or contracted workers to provide security to safeguard its personnel and property, it will assess risks posed by its security arrangements to those within and outside the project site.",
    "audit_question": "Have the risks posed by security personnel to those within and outside the project site been assessed?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 54,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "monitoring_review",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "In making such arrangements, the client will be guided by the principles of proportionality and good international practice [FN3] in relation to hiring, rules of conduct, training, equipping, and monitoring of such workers, and by applicable law.",
    "audit_question": "Are the project's security arrangements designed in accordance with the principles of proportionality and good international practice in relation to (i) hiring; (ii) rules of conduct; (iii) training; (iv) equipping; and (v) monitoring?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 55,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "[FN3] Including practice consistent with the United Nation\u2019s (UN) Code of Conduct for Law Enforcement Officials, and UN Basic Principles on the Use of Force and Firearms by Law Enforcement Officials.",
    "audit_question": "Is the project's security policy consistent with the UN Code of Conduct for Law Enforcement Officials, and the UN Basic Principles on the Use of Force and Firearms by Law Enforcement Officials?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 56,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "community_health_safety",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client will make reasonable inquiries to ensure that those providing security are not implicated in past abuses; will train them adequately in the use of force (and where applicable, firearms), and appropriate conduct toward workers and Affected Communities; and require them to act within the applicable law.",
    "audit_question": "Has the project established (i) appropriate vetting processes for the hiring of security personnel; (ii) plans for adequately training them in the use of force and appropriate conduct toward workers and Affected Communities; and (iii) provisions for requiring them to comply with applicable laws and regulations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 57,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "policy_esms",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client will not sanction any use of force except when used for preventive and defensive purposes in proportion to the nature and extent of the threat.",
    "audit_question": "Does the project have a policy on the use of force by security personnel that is compliant with the requirements of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 58,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client will provide a grievance mechanism for Affected Communities to express concerns about the security arrangements and acts of security personnel.",
    "audit_question": "Has a grievance mechanism been established for Affected Communities to express concerns about security arrangements and personnel?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 59,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "security_personnel",
    "page": "3",
    "paragraph": "13",
    "ifc_provision": "The client will assess and document risks arising from the project\u2019s use of government security personnel deployed to provide security services.",
    "audit_question": "Does the project assess and document risks arising from the use of government security personnel?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 60,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "13",
    "ifc_provision": "The client will seek to ensure that security personnel will act in a manner consistent with paragraph 12 above, and encourage the relevant public authorities to disclose the security arrangements for the client\u2019s facilities to the public, subject to overriding security concerns.",
    "audit_question": "Does the project encourage the disclosure of security arrangements for the client's facilities to the public?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS4_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS4",
    "source_row": 61,
    "performance_standard": "PS4",
    "section": "Requirements > Security Personnel",
    "section_path": [
      "Requirements",
      "Security Personnel"
    ],
    "conceptual_group": "security_personnel",
    "page": "3",
    "paragraph": "14",
    "ifc_provision": "The client will consider and, where appropriate, investigate all allegations of unlawful or abusive acts of security personnel, take action (or urge appropriate parties to take action) to prevent recurrence, and report unlawful and abusive acts to public authorities.",
    "audit_question": "Does the client have procedures established for the evaluation of and investigation into allegations of unlawful or abusive acts of security personnel, the prevention of their recurrence, and reporting of such acts to public authorities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 18,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "To avoid, and when avoidance is not possible, minimize displacement by exploring alternative project designs.",
    "audit_question": "Are adequate efforts being undertaken to avoid or minimize displacement? Can the client demonstrate that it has evaluated alternative project designs?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 19,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "To avoid forced eviction.",
    "audit_question": "Have forced evictions resulting from the project been avoided?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 20,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "To anticipate and avoid, or where avoidance is not possible, minimize adverse social and economic impacts from land acquisition or restrictions on land use by",
    "audit_question": "Have adverse social and economic impacts been anticipated and avoided by attending to the points below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 21,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "(i) providing compensation for loss of assets at replacement cost [FN4] and",
    "audit_question": "* providing compensation for loss of assets at replacement cost ?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 23,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "(ii) ensuring that resettlement activities are implemented with appropriate disclosure of information, consultation, and the informed participation of those affected.",
    "audit_question": "* ensuring that resettlement activities are implemented with appropriate disclosure of information, consultation, and the informed participation of those affected ?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 24,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "*",
    "ifc_provision": "To improve, or restore, the livelihoods and standards of living of displaced persons.",
    "audit_question": "Does the project ensure the improvement or restoration of the livelihoods and standards of living of displaced persons?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 25,
    "performance_standard": "PS5",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "2",
    "paragraph": "*",
    "ifc_provision": "To improve living conditions among physically displaced persons through the provision of adequate housing with security of tenure [FN5] at resettlement sites.",
    "audit_question": "Are the living conditions of physically displaced persons improved through adequate housing provisions with security of tenure at resettlement sites?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 29,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "4",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System, the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the project have an Environmental and Social Management System that implement actions that meet the requirement of the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 30,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "This Performance Standard applies to physical and/or economic displacement resulting from the following types of land-related transactions:",
    "audit_question": "Has the project resulted in physical and/or economic displacement from any of the land-related transactions listed below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 31,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "* Land rights or land use rights acquired through expropriation or other compulsory procedures in accordance with the legal system of the host country;",
    "audit_question": "* Land rights or land use rights acquired through expropriation or other compulsory procedures in accordance with the legal system of the host country?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 32,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "* Land rights or land use rights acquired through negotiated settlements with property owners or those with legal rights to the land if failure to reach settlement would have resulted in expropriation or other compulsory procedures; [FN6]",
    "audit_question": "* Land rights or land use rights acquired through negotiated settlements with property owners or those with legal rights to the land if failure to reach settlement would have resulted in expropriation or other compulsory procedures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 34,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "* Project situations where involuntary restrictions on land use and access to natural resources cause a community or groups within a community to lose access to resource usage where they have traditional or recognizable usage rights; [FN7]",
    "audit_question": "* Project situations where involuntary restrictions on land use and access to natural resources cause a community or groups within a community to lose access to resource usage where they have traditional or recognizable usage rights?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 36,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "* Certain project situations requiring evictions of people occupying land without formal, traditional, or recognizable usage rights; [FN8] or",
    "audit_question": "* Situations requiring evictions of people occupying land without formal, traditional, or recognizable usage rights?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 38,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "* Restriction on access to land or use of other resources including communal property and natural resources such as marine and aquatic resources, timber and non-timber forest products, freshwater, medicinal plants, hunting and gathering grounds and grazing and cropping areas. [FN9]",
    "audit_question": "* Restriction on access to land or use of other resources including communal property and natural resources such as marine and aquatic resources, timber and non-timber forest products, freshwater, medicinal plants, hunting and gathering grounds and grazing and cropping areas?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 40,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "This Performance Standard does not apply to resettlement resulting from voluntary land transactions (i.e., market transactions in which the seller is not obliged to sell and the buyer cannot resort to expropriation or other compulsory procedures sanctioned by the legal system of the host country if negotiations fail).",
    "audit_question": "Were land transactions voluntary (i.e., market transactions in which the seller is not obliged to sell and the buyer cannot resort to expropriation or other compulsory procedures sanctioned by the legal system of the host country if negotiations fail)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 41,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "It also does not apply to impacts on livelihoods where the project is not changing the land use of the affected groups or communities. [FN10]",
    "audit_question": "Is the project inducing changes to the land use of the affected groups or communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 43,
    "performance_standard": "PS5",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "3",
    "paragraph": "7",
    "ifc_provision": "Where project impacts on land, assets, or access to assets become significantly adverse at any stage of the project, the client should consider applying requirements of this Performance Standard, even where no land acquisition or land use restriction is involved.",
    "audit_question": "In cases where significantly adverse social and environmental impacts are estimated to result from project operations, has the project considered possible means for application of the requirements of the Performance Standards (even where no land acquisition or land use restriction is involved)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 47,
    "performance_standard": "PS5",
    "section": "Requirements > General > Project Design",
    "section_path": [
      "Requirements",
      "General",
      "Project Design"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "8",
    "ifc_provision": "The client will consider feasible alternative project designs to avoid or minimize physical and/or economic displacement, while balancing environmental, social, and financial costs and benefits, paying particular attention to impacts on the poor and vulnerable.",
    "audit_question": "Has the client considered alternative project designs to avoid or minimize physical and/or economic displacement? If so, have these designs been balanced in terms of environmental, social and financial costs and benefits, and were impacts on the poor and vulnerable adequately considered?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 49,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "When displacement cannot be avoided, the client will offer displaced communities and persons compensation for loss of assets at full replacement cost and other assistance [FN11] to help them improve or restore their standards of living or livelihoods, as provided in this Performance Standard.",
    "audit_question": "In cases where displacement was unavoidable, did the client offer compensation and developmental assistance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 51,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "Compensation standards will be transparent and applied consistently to all communities and persons affected by the displacement.",
    "audit_question": "Are compensation payments to communities and persons affected by displacement provided in a consistent and transparent manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 52,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "Where livelihoods of displaced persons are land-based, [FN12] or where land is collectively owned, the client will, where feasible, [FN13] offer the displaced land-based compensation.",
    "audit_question": "Where livelihoods of displaced persons are land-based, or where land is collectively owned, does the client offer land-based compensation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 55,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "The client will take possession of acquired land and related assets only after compensation has been made available [FN14] and, where applicable, resettlement sites and moving allowances have been provided to the displaced persons in addition to compensation. [FN15]",
    "audit_question": "Did the client take possession of acquired land and related assets only after having provided compensation and moving allowances to the displaced persons?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 57,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "[FN15] Unless government-managed resettlement is involved and where the client has no direct influence over the timing of compensation payments. Such cases should be handled in accordance with paragraphs 27\u201329 of this Performance Standard. Staggered compensation payments may be made where one-off cash payments would demonstrably undermine social and/or resettlement objectives, or where there are ongoing impacts to livelihood activities.",
    "audit_question": "In cases where government-managed resettlement is involved and the client has no direct influence over the timing of compensation payments, did the client verify that the resettlement was being handled according to paragraphs 27\u201329 of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 58,
    "performance_standard": "PS5",
    "section": "Requirements > General > Compensation and Benefits for Displaced Persons",
    "section_path": [
      "Requirements",
      "General",
      "Compensation and Benefits for Displaced Persons"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "9",
    "ifc_provision": "The client will also provide opportunities to displaced communities and persons to derive appropriate development benefits from the project.",
    "audit_question": "Does the client provide displaced communities and persons with adequate benefits-sharing opportunities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 60,
    "performance_standard": "PS5",
    "section": "Requirements > General > Community Engagement",
    "section_path": [
      "Requirements",
      "General",
      "Community Engagement"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "The client will engage with Affected Communities, including host communities, through the process of stakeholder engagement described in Performance Standard 1.",
    "audit_question": "Does the project employ a process of stakeholder engagement in compliance with Performance Standard 1? If so, is this process utilized in engagement with Affected Communities in a culturally-appropriate manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 61,
    "performance_standard": "PS5",
    "section": "Requirements > General > Community Engagement",
    "section_path": [
      "Requirements",
      "General",
      "Community Engagement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "Decision-making processes related to resettlement and livelihood restoration should include options and alternatives, where applicable.",
    "audit_question": "Did decision-making processes related to resettlement and livelihood restoration include evaluation of options and alternatives, where applicable?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 62,
    "performance_standard": "PS5",
    "section": "Requirements > General > Community Engagement",
    "section_path": [
      "Requirements",
      "General",
      "Community Engagement"
    ],
    "conceptual_group": "monitoring_review",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "Disclosure of relevant information and participation of Affected Communities and persons will continue during the planning, implementation, monitoring, and evaluation of compensation payments, livelihood restoration activities, and resettlement to achieve outcomes that are consistent with the objectives of this Performance Standard. [FN16]",
    "audit_question": "Has the disclosure of relevant information and the participation of Affected Communities and persons continued throughout the planning, implementation, monitoring, and evaluation of compensation payments, livelihood restoration activities, and resettlement process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 63,
    "performance_standard": "PS5",
    "section": "Requirements > General > Community Engagement",
    "section_path": [
      "Requirements",
      "General",
      "Community Engagement"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "[FN16] The consultation process should ensure that women\u2019s perspectives are obtained and their interests factored into all aspects of resettlement planning and implementation. Addressing livelihood impacts may require intra-household analysis in cases where women\u2019s and men\u2019s livelihoods are affected differently. Women\u2019s and men\u2019s preferences in terms of compensation mechanisms, such as compensation in kind rather than in cash, should be explored.",
    "audit_question": "Does the project adequately ensure that perspectives of women are considered in the consultation process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 64,
    "performance_standard": "PS5",
    "section": "Requirements > General > Community Engagement",
    "section_path": [
      "Requirements",
      "General",
      "Community Engagement"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "Additional provisions apply to consultations with Indigenous Peoples, in accordance with Performance Standard 7.",
    "audit_question": "Where applicable, are consultations with Indigenous Peoples consistent with the requirements of Performance Standard 7?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 66,
    "performance_standard": "PS5",
    "section": "Requirements > General > Grievance Mechanism",
    "section_path": [
      "Requirements",
      "General",
      "Grievance Mechanism"
    ],
    "conceptual_group": "grievance_external_communications",
    "page": "4",
    "paragraph": "11",
    "ifc_provision": "The client will establish a grievance mechanism consistent with Performance Standard 1 as early as possible in the project development phase. This will allow the client to receive and address specific concerns about compensation and relocation raised by displaced persons or members of host communities in a timely fashion, including a recourse mechanism designed to resolve disputes in an impartial manner.",
    "audit_question": "Has the project established a grievance mechanism that meets the requirements of Performance Standard 1 [i.e., one allowing the client to receive and address specific concerns about compensation and relocation raised by displaced persons or members of host communities in a timely fashion, including a recourse mechanism designed to resolve disputes in an impartial manner]?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 68,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "Where involuntary resettlement is unavoidable, either as a result of a negotiated settlement or expropriation, a census will be carried out to collect appropriate socio-economic baseline data to identify the persons who will be displaced by the project, determine who will be eligible for compensation and assistance, [FN17] and discourage ineligible persons, such as opportunistic settlers, from claiming benefits.",
    "audit_question": "Where involuntary resettlement is unavoidable, has the project utilized a census to collect socio-economic baseline data appropriate to (i) identify persons affected by unavoidable involuntary resettlement; (ii) determine eligibility for compensation and assistance; and (iii) discourage ineligible persons from claiming benefits?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 69,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "[FN17] Documentation of ownership or occupancy and compensation arrangements should be issued in the names of both spouses or heads of households, and other resettlement assistance, such as skills training, access to credit, and job opportunities, should be equally available to women and adapted to their needs. Where national law and tenure systems do not recognize the rights of women to hold or contract in property, measures should be considered to provide women as much protection as possible with the objective to achieve equity with men.",
    "audit_question": "Has the project treated women in a manner equitable to that of men, including by ensuring that documentation of ownership or occupancy and compensation arrangements are issued in the names of both spouses or heads of households? Are other forms of resettlement assistance, such as skills training, access to credit, and job opportunities, equally available to women and adapted to their needs? Where national law and tenure systems do not recognize the rights of women to hold or contract in property, are measures in place to provide women as much protection as possible with the objective to achieve equity with men?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 70,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "12",
    "ifc_provision": "In the absence of host government procedures, the client will establish a cut-off date for eligibility. Information regarding the cut-off date will be well documented and disseminated throughout the project area.",
    "audit_question": "Where host government procedures are absent, has the client established a cut-off date for eligibility for compensation and assistance? If so, has the information about it been adequately documented and disseminated across the project area?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 71,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "4",
    "paragraph": "13",
    "ifc_provision": "In cases where affected persons reject compensation offers that meet the requirements of this Performance Standard and, as a result, expropriation or other legal procedures are initiated, the client will explore opportunities to collaborate with the responsible government agency, and, if permitted by the agency, play an active role in resettlement planning, implementation, and monitoring(see paragraphs 30\u201332).",
    "audit_question": "In cases where affected persons reject compensation offers that meet the requirements of this Performance Standard and, as a result, expropriation or other legal procedures are initiated, has the client explored opportunities to collaborate with the relevant government agencies in a joint process of resettlement planning?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 72,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "The client will establish procedures to monitor and evaluate the implementation of a Resettlement Action Plan or Livelihood Restoration Plan (see paragraphs 19 and 25) and take corrective action as necessary. The extent of monitoring activities will be commensurate with the project\u2019s risks and impacts.",
    "audit_question": "Has the client established procedures to monitor and evaluate the implementation of its Resettlement Action Plan or Livelihood Restoration Plan? If so, do these procedures include means for applying corrective actions, where necessary?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 73,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "risk_identification",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "The extent of monitoring activities will be commensurate with the project\u2019s risks and impacts.",
    "audit_question": "Is the extent of project monitoring activities commensurate with the project's risks and impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 74,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "monitoring_review",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "For projects with significant involuntary resettlement risks, the client will retain competent resettlement professionals to provide advice on compliance with this Performance Standard and to verify the client\u2019s monitoring information.",
    "audit_question": "For projects with significant involuntary resettlement risks, is the client retaining resettlement professionals to advice on compliance to verify monitoring data?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 75,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "monitoring_review",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "Affected persons will be consulted during the monitoring process.",
    "audit_question": "Are affected persons consulted during the monitoring process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 76,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "Implementation of a Resettlement Action Plan or Livelihood Restoration Plan will be considered completed when the adverse impacts of resettlement have been addressed in a manner that is consistent with the relevant plan as well as the objectives of this Performance Standard.",
    "audit_question": "Has the project addressed all adverse impacts of resettlement in accordance with the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 77,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "It may be necessary for the client to commission an external completion audit of the Resettlement Action Plan or Livelihood Restoration Plan to assess whether the provisions have been met, depending on the scale and/or complexity of physical and economic displacement associated with a project.",
    "audit_question": "Has the project commissioned an external completion audit by competent resettlement professionals of the Resettlement Action Plan or Livelihood Restoration Plan? If so, has it appropriately assessed whether provisions have been met?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 78,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "The completion audit should be undertaken once all mitigation measures have been substantially completed and once displaced persons are deemed to have been provided adequate opportunity and assistance to sustainably restore their livelihoods.",
    "audit_question": "If an external completion audit has been employed, was it undertaking after the substantial completion of mitigation measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 79,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "The completion audit will be undertaken by competent resettlement professionals once the agreed monitoring period is concluded.",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 80,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "objectives",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "The completion audit will include, at a minimum, a review of the totality of mitigation measures implemented by the Client, a comparison of implementation outcomes against agreed objectives, and a conclusion as to whether the monitoring process can be ended. [FN18]",
    "audit_question": "If an external completion audit has been employed, did it include (i) a review of the totality of implemented mitigation measures; (ii) a comparison of outcomes against objectives; (iii) a conclusion as to whether the monitoring process can be ended, and (iv) a Corrective Action Plan, as necessary?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 81,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "[FN18] The completion audit of the Resettlement Action Plan and/or Livelihood Restoration Plan, will be undertaken by external resettlement experts once the agreed monitoring period is concluded, and will involve a more in-depth assessment than regular resettlement monitoring activities, including at a minimum a review of all mitigation measures with respect to the physical and/or economic displacement implemented by the Client, a comparison of implementation outcomes against agreed objectives, a conclusion as to whether the monitoring process can be ended and, where necessary, a Corrective Action Plan listing outstanding actions necessary to met the objectives.",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 82,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "Where the exact nature or magnitude of the land acquisition or restrictions on land use related to a project with potential to cause physical and/or economic displacement is unknown due to the stage of project development, the client will develop a Resettlement and/or Livelihood Restoration Framework outlining general principles compatible with this Performance Standard.",
    "audit_question": "Has the project developed a Resettlement and/or Livelihood Restoration Framework in compliance with the Performance Standard? If so, has the Framework been expanded into a specific Resettlement Action Plan or Livelihood Restoration Plan once the necessary project components were defined?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 83,
    "performance_standard": "PS5",
    "section": "Requirements > General > Resettlement and Livelihood Restoration Planning and Implementation",
    "section_path": [
      "Requirements",
      "General",
      "Resettlement and Livelihood Restoration Planning and Implementation"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "Once the individual project components are defined and the necessary information becomes available, such a framework will be expanded into a specific Resettlement Action Plan or Livelihood Restoration Plan and procedures in accordance with paragraphs 19 and 25 below.",
    "audit_question": "Did the project expand individual resettlement components into a specific Resettlement Action Plan or Livelihood Restoration Plan in accordance with paragraphs 19 and 25 below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_047",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 85,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "Displaced persons may be classified as persons",
    "audit_question": "Can displaced persons be categories as follows?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_048",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 86,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "(i) who have formal legal rights to the land or assets they occupy or use;",
    "audit_question": "* have formal legal rights to the land or assets they occupy or use?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_049",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 87,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "(ii) who do not have formal legal rights to land or assets, but have a claim to land that is recognized or recognizable under national law; [FN19] or",
    "audit_question": "* have a claim to land that is recognized or recognizable under national law (in the absence of formal legal rights to land or assets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_050",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 89,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "(iii) who have no recognizable legal right or claim to the land or assets they occupy or use.",
    "audit_question": "(iii) have no recognizable legal right or claim to the land or assets they occupy or use?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_051",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 90,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "The census will establish the status of the displaced persons.",
    "audit_question": "Has the status of displaced persons been adequately established?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_052",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 91,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "18",
    "ifc_provision": "Project-related land acquisition and/or restrictions on land use may result in the physical displacement of people as well as their economic displacement. Consequently, requirements of this Performance Standard in respect of physical displacement and economic displacement may apply simultaneously. [FN20]",
    "audit_question": "Have project-related land acquisition and/or restrictions on land use resulted in physical and economical displacement of people? If so, have the requirements of the Performance Standard for both physical and economic displacement been applied?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_053",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 92,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement",
    "section_path": [
      "Requirements",
      "Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "18",
    "ifc_provision": "[FN20] Where a project results in both physical and economic displacement, the requirements of paragraphs 25 and 26 (Economic Displacement) should be incorporated into the Resettlement Action Plan or Framework (i.e., there is no need to have a separate Resettlement Action Plan and Livelihood Restoration Plan).",
    "audit_question": "Where the project has resulted in both physical and economic displacement, has the project incorporated requirements of paragraphs 25 and 26 (Economic Displacement) of this Performance Standard in its Resettlement Action Plan or Framework?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_054",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 94,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "In the case of physical displacement, the client will develop a Resettlement Action Plan that covers, at a minimum, the applicable requirements of this Performance Standard regardless of the number of people affected. This will include compensation at full replacement cost for land and other assets lost.",
    "audit_question": "Has the client developed a Resettlement Action Plan that covers the applicable requirements of the Performance Standard regardless of the number of people affected? If so, does it include compensation at full replacement cost for lost land and other assets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_055",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 95,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "The Plan will be designed to mitigate the negative impacts of displacement; identify development opportunities; develop a resettlement budget and schedule; and establish the entitlements of all categories of affected persons (including host communities).",
    "audit_question": "Where the project results in physical displacement, does the client's Resettlement Action Plan (i) mitigate negative impacts; (ii) identify development opportunities; (iii) incorporate a resettlement budget and schedule; and (iv) establish entitlements of all categories of affected persons?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_056",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 96,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "Particular attention will be paid to the needs of the poor and the vulnerable.",
    "audit_question": "Does the client's Resettlement Action Plan pay adequate attention to the needs of the poor and vulnerable?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_057",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 97,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "The client will document all transactions to acquire land rights, as well as compensation measures and relocation activities.",
    "audit_question": "Are transactions to acquire land rights and all compensation measures and relocation activities adequately documented?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_058",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 98,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "If people living in the project area are required to move to another location, the client will",
    "audit_question": "When people in the project area are required to relocate, does the client address the following points?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_059",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 99,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "(i) offer displaced persons choices among feasible resettlement options, including adequate replacement housing or cash compensation where appropriate; and",
    "audit_question": "* offer them resettlement options and appropriate compensation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_060",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 100,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "(ii) provide relocation assistance suited to the needs of each group of displaced persons.",
    "audit_question": "* provide them with relocation assistance suitable to their needs?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_061",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 101,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "New resettlement sites built for displaced persons must offer improved living conditions.",
    "audit_question": "Has the client built new resettlement sites for displaced persons? If so, do they offer the displaced persons improved living conditions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_062",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 102,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "The displaced persons\u2019 preferences with respect to relocating in pre-existing communities and groups will be taken into consideration.",
    "audit_question": "Are the preferences of displaced persons with respect to relocation in pre-existing communities and groups adequately taken into consideration by the client?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_063",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 103,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "Existing social and cultural institutions of the displaced persons and any host communities will be respected.",
    "audit_question": "Does the client demonstrate respect for existing social and cultural institutions of displaced persons and host communities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_064",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 104,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "security_personnel",
    "page": "5",
    "paragraph": "21",
    "ifc_provision": "In the case of physically displaced persons under paragraph 17 (i) or (ii), the client will offer the choice of replacement property of equal or higher value, security of tenure, equivalent or better characteristics, and advantages of location or cash compensation where appropriate.",
    "audit_question": "Where physically displaced persons have formal legal rights to land or assets or a legally recognized claim to the use thereof, has the client offered a choice of replacement property of equal or higher value, security of tenure, equivalent or better characteristics and advantages of location or cash compensation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_065",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 105,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "5",
    "paragraph": "21",
    "ifc_provision": "Compensation in kind should be considered in lieu of cash. Cash compensation levels should be sufficient to replace the lost land and other assets at full replacement cost in local markets. [FN21]",
    "audit_question": "Has the client considered compensation in kind in lieu of cash? Where cash compensation has been offered, were the levels of compensation sufficient to replace lost land and assets at full replacement cost in local markets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_066",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 106,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "[FN21] Payment of cash compensation for lost assets may be appropriate where",
    "audit_question": "Has the client paid cash compensation for lost asset in any of the instances listed below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_067",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 107,
    "performance_standard": "PS5",
    "section": "Unclassified",
    "section_path": [
      "Unclassified"
    ],
    "conceptual_group": "economic_displacement",
    "page": "6",
    "paragraph": null,
    "ifc_provision": "(i) livelihoods are not land-based;",
    "audit_question": "* for livelihoods that are not land-based;",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_068",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 108,
    "performance_standard": "PS5",
    "section": "Unclassified",
    "section_path": [
      "Unclassified"
    ],
    "conceptual_group": "economic_displacement",
    "page": "6",
    "paragraph": null,
    "ifc_provision": "(ii) livelihoods are land-based but the land taken for the project is a small fraction of the affected asset and the residual land is economically viable; or",
    "audit_question": "* for livelihoods that are land-based but the land taken for the project is a small fraction of the affected asset and the residual land is economically viable; or",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_069",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 109,
    "performance_standard": "PS5",
    "section": "Unclassified",
    "section_path": [
      "Unclassified"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "6",
    "paragraph": null,
    "ifc_provision": "(iii) active markets for land, housing, and labor exist, displaced persons use such markets, and there is sufficient supply of land and housing.",
    "audit_question": "* for situations wherein active markets for land, housing, and labor exist, where displaced persons use such markets, and where there is sufficient supply of land and housing.",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_070",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 110,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "security_personnel",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "In the case of physically displaced persons under paragraph 17 (iii), the client will offer them a choice of options for adequate housing with security of tenure so that they can resettle legally without having to face the risk of forced eviction.",
    "audit_question": "Where physically displaced persons have no recognizable legal right or claim to the concerned land or assets, has the client offered them a choice of options for adequate housing with security of tenure?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_071",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 111,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "Where these displaced persons own and occupy structures, the client will compensate them for the loss of assets other than land, such as dwellings and other improvements to the land, at full replacement cost, provided that these persons have been occupying the project area prior to the cut-off date for eligibility.",
    "audit_question": "Has the client compensated displaced persons for loss of any structures (dwellings and other improvements to the land) at full replacement cost (provided that these persons have been occupying the project area prior to the cut-off date for eligibility)?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_072",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 112,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "Based on consultation with such displaced persons, the client will provide relocation assistance sufficient for them to restore their standard of living at an adequate alternative site. [FN22]",
    "audit_question": "Were provisions for relocation assistance based on consultation with displaced persons? If so, was the assistance sufficient for them to restore their standard of living at an alternative site?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_073",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 113,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "[FN22] Relocation of informal settlers in urban areas may involve trade-offs. For example, the relocated families may gain security of tenure, but they may lose advantages of location. Changes in location that may affect livelihood opportunities should be addressed in accordance with the principles of this Performance Standard (see in particular paragraph 25).",
    "audit_question": "Did the relocation of informal settlers in urban areas involve trade-offs? If so, was the relocation conducted in a manner compliant with the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_074",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 115,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Physical Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Physical Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "24",
    "ifc_provision": "Forced evictions [FN23] will not be carried out except in accordance with law and the requirements of this Performance Standard.",
    "audit_question": "Has the client carried out any forced evictions? If so, have they been in accordance with the requirements of the Performance Standard and the law?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_075",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 118,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "In the case of projects involving economic displacement only, the client will develop a Livelihood Restoration Plan to compensate affected persons and/or communities and offer other assistance that meet the objectives of this Performance Standard.",
    "audit_question": "In the case of projects involving economic displacement only, has the client developed a Livelihood Restoration Plan to address economic displacement? If so, does it ensure the compensation and assistance to affected persons and/or communities in accordance with this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_076",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 119,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "The Livelihood Restoration Plan will establish the entitlements of affected persons and/or communities and will ensure that these are provided in a transparent, consistent, and equitable manner.",
    "audit_question": "Where a Livelihood Restoration Plan has been developed, does it establish and provide the entitlements of affected persons and/or communities in a transparent, consistent, and equitable manner?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_077",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 120,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "The mitigation of economic displacement will be considered complete when affected persons or communities have received compensation and other assistance according to the requirements of the Livelihood Restoration Plan and this Performance Standard, and are deemed to have been provided with adequate opportunity to re-establish their livelihoods.",
    "audit_question": "Have persons and communities affected by economic displacement received compensation and assistance in a way that meets the requirements of the Livelihood Restoration Plan and the Performance Standard? If so, are such persons and communities deemed to have been provided with adequate opportunity to re-establish their livelihoods?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_078",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 121,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "26",
    "ifc_provision": "If land acquisition or restrictions on land use result in economic displacement defined as loss of assets and/or means of livelihood, regardless of whether or not the affected people are physically displaced, the client will meet the requirements in paragraphs 27\u201329 below, as applicable.",
    "audit_question": "Where land acquisition or restrictions on land use has led to loss of assets and/or means of livelihood, has the client fulfilled the requirements on Performance Standard 5:27-29?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_079",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 122,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "27",
    "ifc_provision": "Economically displaced persons who face loss of assets or access to assets will be compensated for such loss at full replacement cost.",
    "audit_question": "Have economically displaced persons who suffered loss of assets or access to assets as a result of the project been compensated at full replacement cost and according to the specifications for all listed cases listed below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_080",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 123,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "6",
    "paragraph": "27",
    "ifc_provision": "* In cases where land acquisition or restrictions on land use affect commercial structures, affected business owners will be compensated for the cost of re-establishing commercial activities elsewhere, for lost net income during the period of transition, and for the costs of the transfer and reinstallation of the plant, machinery, or other equipment.",
    "audit_question": "* In cases where land acquisition or restrictions on land use affect commercial structures, affected business owners will be compensated for the cost of re-establishing commercial activities elsewhere, for lost net income during the period of transition, and for the costs of the transfer and reinstallation of the plant, machinery, or other equipment.",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_081",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 124,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "27",
    "ifc_provision": "* In cases affecting persons with legal rights or claims to land which are recognized or recognizable under national law (see paragraph 17 (i) and (ii)), replacement property (e.g., agricultural or commercial sites) of equal or greater value will be provided, or, where appropriate, cash compensation at full replacement cost.",
    "audit_question": "* In cases affecting persons with legal rights or claims to land which are recognized or recognizable under national law, is replacement property (e.g., agricultural or commercial sites) of equal or greater value, or, where appropriate, is cash compensation at full replacement cost?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_082",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 125,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "27",
    "ifc_provision": "* Economically displaced persons who are without legally recognizable claims to land (see paragraph 17 (iii)) will be compensated for lost assets other than land (such as crops, irrigation infrastructure and other improvements made to the land), at full replacement cost.",
    "audit_question": "* Have economically displaced persons who are without legally recognizable claims to land been compensated for lost assets other than land (such as crops, irrigation infrastructure and other improvements made to the land), at full replacement cost?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_083",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 127,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "In addition to compensation for lost assets, if any, as required under paragraph 27, economically displaced persons whose livelihoods or income levels are adversely affected will also be provided opportunities to improve, or at least restore, their means of income-earning capacity, production levels, and standards of living:",
    "audit_question": "Where the livelihoods or income levels of economically displaced persons have been adversely affected, does the client provide adequate opportunities to improve or restore their income-earning capacity, production levels, and standards of living in accordance as provided in the following cases?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_084",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 128,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "* For persons whose livelihoods are land-based, replacement land that has a combination of productive potential, locational advantages, and other factors at least equivalent to that being lost should be offered as a matter of priority.",
    "audit_question": "* For persons whose livelihoods are land-based, has replacement land been identified for its capacity to provide a combination of productive potential, locational advantages, and other factors at least equivalent to that being lost should be offered as a matter of priority?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_085",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 129,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "* For persons whose livelihoods are natural resource-based and where project-related restrictions on access envisaged in paragraph 5 apply, implementation of measures will be made to either allow continued access to affected resources or provide access to alternative resources with equivalent livelihood-earning potential and accessibility.",
    "audit_question": "* For persons whose livelihoods are natural resource-based and where project-related restrictions on access envisaged in paragraph 5 apply, were measures implemented to either allow continued access to affected resources or provide access to alternative resources with equivalent livelihood-earning potential and accessibility?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_086",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 131,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "* If circumstances prevent the client from providing land or similar resources as described above, alternative income earning opportunities may be provided, such as credit facilities, training, cash, or employment opportunities.",
    "audit_question": "Where circumstances prevents the provision of land or natural resources, has the client provided alternative income earning opportunities may be provided, such as credit facilities, training, cash, or employment opportunities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_087",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 133,
    "performance_standard": "PS5",
    "section": "Requirements > Displacement > Economic Displacement",
    "section_path": [
      "Requirements",
      "Displacement",
      "Economic Displacement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "29",
    "ifc_provision": "Transitional support should be provided as necessary to all economically displaced persons, based on a reasonable estimate of the time required to restore their income-earning capacity, production levels, and standards of living.",
    "audit_question": "Are economically displaced persons provided with the necessary transitional support, asked on a reasonable estimate of the time required to restore their income-earning capacity, production levels, and standards of living?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_088",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 135,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "Where land acquisition and resettlement are the responsibility of the government, the client will collaborate with the responsible government agency, to the extent permitted by the agency, to achieve outcomes that are consistent with this Performance Standard.",
    "audit_question": "Where the responsibility of land acquisition and resettlement lies with the government, has the client collaborated with the responsible government agency? If so, are the outcomes resulting from this collaboration consistent with the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_089",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 136,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "monitoring_review",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "In addition, where government capacity is limited, the client will play an active role during resettlement planning, implementation, and monitoring, as described below.",
    "audit_question": "Where government capacity is limited, does the client play a sufficiently active role during the planning, implementation, and monitoring of resettlement in a manner consistent with the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_090",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 137,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "31",
    "ifc_provision": "In the case of acquisition of land rights or access to land through compulsory means or negotiated settlements involving physical displacement, the client will identify and describe [FN24] government resettlement measures.",
    "audit_question": "Where acquisition of land rights or access to land through compulsory means or negotiated settlements have involved physical displacement, has the client identified and described government resettlement measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_091",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 139,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "7",
    "paragraph": "31",
    "ifc_provision": "If these measures do not meet the relevant requirements of this Performance Standard, the client will prepare a Supplemental Resettlement Plan that, together with the documents prepared by the responsible government agency, will address the relevant requirements of this Performance Standard (the General Requirements and requirements for Physical Displacement and Economic Displacement above).",
    "audit_question": "In cases where government resettlement measures do not meet the relevant requirements of the Performance Standard, has the client prepared a Supplemental Resettlement Plan? If so, does it incorporate documents prepared by the responsible government agency and address the requirements of the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_092",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 140,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "The client will need to include in its Supplemental Resettlement Plan, at a minimum",
    "audit_question": "If a Supplemental Resettlement Plan has been prepared, does it include all of the following elements?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_093",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 141,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(i) identification of affected people and impacts;",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_094",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 142,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(ii) a description of regulated activities, including the entitlements of displaced persons provided under applicable national laws and regulations;",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_095",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 143,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(iii) the supplemental measures to achieve the requirements of this Performance Standard as described in paragraphs 19\u201329 in a way that is permitted by the responsible agency and implementation time schedule; and",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_096",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 144,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "31",
    "ifc_provision": "(iv) the financial and implementation responsibilities of the client in the execution of its Supplemental Resettlement Plan.",
    "audit_question": "***",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_097",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 145,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "community_health_safety",
    "page": "8",
    "paragraph": "32",
    "ifc_provision": "In the case of projects involving economic displacement only, the client will identify and describe the measures that the responsible government agency plans to use to compensate Affected Communities and persons.",
    "audit_question": "In cases involving only economic displacement, has the client identified and described the measures that the responsible government agency plans to use to compensate Affected Communities and persons?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS5_098",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS5",
    "source_row": 146,
    "performance_standard": "PS5",
    "section": "Requirements > Private Sector Responsibilities Under Government-Managed Resettlement",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Under Government-Managed Resettlement"
    ],
    "conceptual_group": "land_acquisition_resettlement",
    "page": "8",
    "paragraph": "32",
    "ifc_provision": "If these measures do not meet the relevant requirements of this Performance Standard, the client will develop an Environmental and Social Action Plan to complement government action. This may include additional compensation for lost assets, and additional efforts to restore lost livelihoods where applicable.",
    "audit_question": "Where government compensation measures do not meet the requirements of the Performance Standard, has the client developed an Environmental and Social Action Plan to complement government actions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 13,
    "performance_standard": "PS6",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To protect and conserve biodiversity.",
    "audit_question": "Has the project defined policies and measures to protect and conserve biodiversity?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 14,
    "performance_standard": "PS6",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To maintain the benefits from ecosystem services.",
    "audit_question": "Has the project defined policies and measures to maintain benefits from ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 15,
    "performance_standard": "PS6",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": "1",
    "paragraph": "*",
    "ifc_provision": "* To promote the sustainable management of living natural resources through the adoption of practices that integrate conservation needs and development priorities.",
    "audit_question": "Does the project promote sustainable management of living natural resources?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 17,
    "performance_standard": "PS6",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "4",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Has the project adopted a clear stance on PS6 applicability?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 18,
    "performance_standard": "PS6",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "4",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System (ESMS), the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the project's Environmental and Social Management System (ESMS) define a process for managing the implementation of all actions needed to comply with the requirements of PS6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 22,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "risk_identification",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "The risks and impacts identification process as set out in Performance Standard 1 should consider direct and indirect project-related impacts on biodiversity and ecosystem services and identify any significant residual impacts.",
    "audit_question": "Has the project identified project-related risks and impacts (direct and indirect) on biodiversity and ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 23,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "This process will consider relevant threats to biodiversity and ecosystem services, especially focusing on habitat loss, degradation and fragmentation, invasive alien species, overexploitation, hydrological changes, nutrient loading, and pollution.",
    "audit_question": "Does the project's risk and impact identification process take relevant threats to biodiversity and ecosystem services into adequate consideration?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 24,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "community_health_safety",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "It will also take into account the differing values attached to biodiversity and ecosystem services by Affected Communities and, where appropriate, other stakeholders.",
    "audit_question": "Does the project's risk and impact identification process take Affected Communities' valuation of biodiversity and ecosystem services into account?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 25,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "Where paragraphs 13\u201319 are applicable, the client should consider project-related impacts across the potentially affected landscape or seascape.",
    "audit_question": "Has the project determined the applicability of paragraphs 13-19 of PS6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 26,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "As a matter of priority, the client should seek to avoid impacts on biodiversity and ecosystem services.",
    "audit_question": "Is the avoidance of impacts on biodiversity and ecosystem services treated as a priority by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 27,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "When avoidance of impacts is not possible, measures to minimize impacts and restore biodiversity and ecosystem services should be implemented.",
    "audit_question": "Has the project identified measures to minimize impacts to biodiversity and ecosystem services, and for the restoration thereof?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 28,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "general",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "Given the complexity in predicting project impacts on biodiversity and ecosystem services over the long term, the client should adopt a practice of adaptive management in which the implementation of mitigation and management measures are responsive to changing conditions and the results of monitoring throughout the project\u2019s lifecycle.",
    "audit_question": "Are the mitigation and management measure established by the project adaptive and responsive to changing conditions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 29,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "Where paragraphs 13\u201315 are applicable, the client will retain competent professionals to assist in conducting the risks and impacts identification process.",
    "audit_question": "Has the project evaluated the applicability of paragraphs 13-15 of PS6? Have competent professionals been retained to assist the risks and impacts identification process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 30,
    "performance_standard": "PS6",
    "section": "Requirements > General",
    "section_path": [
      "Requirements",
      "General"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "Where paragraphs 16\u201319 are applicable, the client should retain external experts with appropriate regional experience to assist in the development of a mitigation hierarchy that complies with this Performance Standard and to verify the implementation of those measures.",
    "audit_question": "Has the project evaluated the applicability of paragraphs 16-19 of PS6? Have competent professionals been retained to assist the development of a mitigation hierarchy and to verify the implementation of measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 35,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "For the protection and conservation of biodiversity, the mitigation hierarchy includes biodiversity offsets, which may be considered only after appropriate avoidance, minimization, and restoration measures have been applied. [FN2]",
    "audit_question": "Does the mitigation hierarchy established by the project include biodiversity offsets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 37,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "A biodiversity offset should be designed and implemented to achieve measurable conservation outcomes [FN3] that can reasonably be expected to result in no net loss and preferably a net gain of biodiversity; however, a net gain is required in critical habitats.",
    "audit_question": "Where biodiversity offsets are included in the mitigation hierarchy, have they been designed and implemented to achieve measurable conservation outcomes resulting in no net loss? Have net gains been ensured in planned biodiversity offsets for critical habitats?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 39,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "The design of a biodiversity offset must adhere to the \u201clike-for-like or better\u201d principle [FN4] and must be carried out in alignment with best available information and current practices.",
    "audit_question": "Do the project's biodiversity offset designs adhere to the \"like-for-like or better\" principle?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 40,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "2",
    "paragraph": "10",
    "ifc_provision": "[FN4]: The principle of \u201clike-for-like or better\u201d indicates that biodiversity offsets must be designed to conserve the same biodiversity values that are being impacted by the project (an \u201cin-kind\u201d offset). In certain situations, however, areas of biodiversity to be impacted by the project may be neither a national nor a local priority, and there may be other areas of biodiversity with like values that are a higher priority for conservation and sustainable use and under imminent threat or need of protection or effective management. In these situations, it may be appropriate to consider an \u201cout-of-kind\u201d offset that involves \u201ctrading up\u201d (i.e., where the offset targets biodiversity of higher priority than that affected by the project) that will, for critical habitats, meet the requirements of paragraph 17 of this Performance Standard.",
    "audit_question": "Has the project defined any \"out-of-kind\" biodiversity offsets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 41,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "When a client is considering the development of an offset as part of the mitigation strategy, external experts with knowledge in offset design and implementation must be involved.",
    "audit_question": "Have external experts been involved in the development of the project's planned biodiversity offsets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 43,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Modified Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Modified Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "Modified habitats are areas that may contain a large proportion of plant and/or animal species of non-native origin, and/or where human activity has substantially modified an area\u2019s primary ecological functions and species composition. [FN5] Modified habitats may include areas managed for agriculture, forest plantations, reclaimed [FN6] coastal zones, and reclaimed wetlands.",
    "audit_question": "Has the project identified any modified habitats within its area of influence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 46,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Modified Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Modified Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "This Performance Standard applies to those areas of modified habitat that include significant biodiversity value, as determined by the risks and impacts identification process required in Performance Standard 1.",
    "audit_question": "Have the biodiversity values of identified modified habitats been determined?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 47,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Modified Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Modified Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client should minimize impacts on such biodiversity and implement mitigation measures as appropriate.",
    "audit_question": "Do the project's policies on biodiversity conservation ensure the minimization of impacts to modified habitats with significant biodiversity value, and define procedures for implementing appropriate mitigation measures?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 49,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "13",
    "ifc_provision": "Natural habitats are areas composed of viable assemblages of plant and/or animal species of largely native origin, and/or where human activity has not essentially modified an area\u2019s primary ecological functions and species composition.",
    "audit_question": "Has the project identified any natural habitats within its area of influence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 50,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "14",
    "ifc_provision": "The client will not significantly convert or degrade [FN7] natural habitats, unless all of the following are demonstrated:",
    "audit_question": "Has the client evaluated the listed conditions for conversion or degrading of natural habitats?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 56,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "In areas of natural habitat, mitigation measures will be designed to achieve no net loss [FN9] of biodiversity where feasible.",
    "audit_question": "Is the design of the project's mitigation measures in areas of natural habitat geared toward achieving no net loss of biodiversity?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 59,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "3",
    "paragraph": "15",
    "ifc_provision": "* Avoiding impacts on biodiversity through the identification and protection of set-asides; [FN10]",
    "audit_question": "Has the project provided for the protection of set-asides in the avoidance of impacts on biodiversity?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 61,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "* Implementing measures to minimize habitat fragmentation, such as biological corridors;",
    "audit_question": "Have any measures to minimize the fragmentation of natural habitat areas been defined by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 62,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "* Restoring habitats during operations and/or after operations; and",
    "audit_question": "Have plans for the restoration of habitats during and/or after operations been designed by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 63,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Natural Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Natural Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "15",
    "ifc_provision": "* Implementing biodiversity offsets.",
    "audit_question": "Has the project implemented any biodiversity offsets?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 65,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "16",
    "ifc_provision": "Critical habitats are areas with high biodiversity value, including (i) habitat of significant importance to Critically Endangered and/or Endangered [FN11] species; (ii) habitat of significant importance to endemic and/or restricted-range species; (iii) habitat supporting globally significant concentrations of migratory species and/or congregatory species; (iv) highly threatened and/or unique ecosystems; and/or (v) areas associated with key evolutionary processes.",
    "audit_question": "Has the project identified any critical habitats within its area of influence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 66,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "16",
    "ifc_provision": "[FN11] As listed on the International Union for the Conservation of Nature (IUCN) Red List of Threatened Species. The determination of critical habitat based on other listings is as follows: (i) If the species is listed nationally / regionally as critically endangered or endangered, in countries that have adhered to IUCN guidance, the critical habitat determination will be made on a project by project basis in consultation with competent professionals; and (ii) in instances where nationally or regionally listed species\u2019 categorizations do not correspond well to those of the IUCN (e.g., some countries more generally list species as \u201cprotected\u201d or \u201crestricted\u201d), an assessment will be conducted to determine the rationale and purpose of the listing. In this case, the critical habitat determination will be based on such an assessment.",
    "audit_question": "Have alternative determinations of critical habitat been employed by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 67,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "In areas of critical habitat, the client will not implement any project activities unless all of the following are demonstrated:",
    "audit_question": "Does the project ensure that, prior to any project activities in areas of critical habitat are implemented, the following has been demonstrated:",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 68,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "* No other viable alternatives within the region exist for development of the project on modified or natural habitats that are not critical;",
    "audit_question": "* No other viable development alternatives on non-critical habitats are available within the region?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 69,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "* The project does not lead to measurable adverse impacts on those biodiversity values for which the critical habitat was designated, and on the ecological processes supporting those biodiversity values; [FN12]",
    "audit_question": "* No measurable adverse impacts on biodiversity values for which the critical habitat was designated nor on supporting ecological processes will arise due to the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 70,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "[FN12] Biodiversity values and their supporting ecological processes will be determined on an ecologically relevant scale.",
    "audit_question": "Has the project determined biodiversity values and supporting ecological processes for areas of critical habitat?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 71,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "* The project does not lead to a net reduction in the global and/or national/regional population [FN13] of any Critically Endangered or Endangered species over a reasonable period of time; [FN14] and",
    "audit_question": "* No net reduction in the global/national/regional population of Critically Endangered or Endangered species occur due to project activities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 74,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "monitoring_review",
    "page": "4",
    "paragraph": "17",
    "ifc_provision": "* A robust, appropriately designed, and long-term biodiversity monitoring and evaluation program is integrated into the client\u2019s management program.",
    "audit_question": "* A robust long-term biodiversity monitoring and evaluation program is integrated into the project's management program?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 75,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "4",
    "paragraph": "18",
    "ifc_provision": "In such cases where a client is able to meet the requirements defined in paragraph 17, the project\u2019s mitigation strategy will be described in a Biodiversity Action Plan and will be designed to achieve net gains [FN15] of those biodiversity values for which the critical habitat was designated.",
    "audit_question": "If the above conditions apply, has the project produced a Biodiversity Action Plan incorporating the mitigation strategy for critical habitats?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 77,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity >Critical Habitat",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Critical Habitat"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "In instances where biodiversity offsets are proposed as part of the mitigation strategy, the client must demonstrate through an assessment that the project\u2019s significant residual impacts on biodiversity will be adequately mitigated to meet the requirements of paragraph 17.",
    "audit_question": "Where biodiversity offsets are part of the proposed mitigation strategy, has the project produced an assessment showing that significant residual impacts on biodiversity will be adequately mitigated?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 79,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "In circumstances where a proposed project is located within a legally protected area [FN16] or an internationally recognized area, [FN17] the client will meet the requirements of paragraphs 13 through 19 of this Performance Standard, as applicable.",
    "audit_question": "Have any legally protected area or internationally recognized area been identified within the project's area of influence?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 82,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "In addition, the client will:",
    "audit_question": "With regard to legally protected and internationally recognized areas, has the project:",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 83,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "* Demonstrate that the proposed development in such areas is legally permitted;",
    "audit_question": "* demonstrated the legality of the proposed development?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 84,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "* Act in a manner consistent with any government recognized management plans for such areas;",
    "audit_question": "* ensured that project activities are consistent with any government recognized management plans?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 85,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "* Consult protected area sponsors and managers, Affected Communities, Indigenous Peoples and other stakeholders on the proposed project, as appropriate; and",
    "audit_question": "* consulted the relevant stakeholders on the proposed development?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 86,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "* Implement additional programs, as appropriate, to promote and enhance the conservation aims and effective management of the area. [FN18]",
    "audit_question": "* designed and/or implemented any additional programs to enhance conservation aims and effective management of the area?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 90,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Invasive Alien Species",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Invasive Alien Species"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "22",
    "ifc_provision": "The client will not intentionally introduce any new alien species (not currently established in the country or region of the project) unless this is carried out in accordance with the existing regulatory framework for such introduction. Notwithstanding the above, the client will not deliberately introduce any alien species with a high risk of invasive behavior regardless of whether such introductions are permitted under the existing regulatory framework.",
    "audit_question": "Has the project evaluated the risk for unintentional introduction of alien species, and established appropriate procedures for its prevention?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_047",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 91,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Invasive Alien Species",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Invasive Alien Species"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "22",
    "ifc_provision": "All introductions of alien species will be subject to a risk assessment (as part of the client\u2019s environmental and social risks and impacts identification process) to determine the potential for invasive behavior.",
    "audit_question": "Does the project have a risk assessment process for the introduction of alien species in place?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_048",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 92,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Invasive Alien Species",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Invasive Alien Species"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "22",
    "ifc_provision": "The client will implement measures to avoid the potential for accidental or unintended introductions including the transportation of substrates and vectors (such as soil, ballast, and plant materials) that may harbor alien species.",
    "audit_question": "Does the project implement any measures to avoid accidental or unintended introductions of alien species?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_049",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 93,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "Where alien species are already established in the country or region of the proposed project, the client will exercise diligence in not spreading them into areas in which they have not already been established.",
    "audit_question": "Has the presence of alien species been evaluated by the project? Have plans been established to exercise diligence in not spreading them into other areas?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_050",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 94,
    "performance_standard": "PS6",
    "section": "Requirements > Protection and Conservation of Biodiversity > Legally Protected and Internationally Recognized Areas",
    "section_path": [
      "Requirements",
      "Protection and Conservation of Biodiversity",
      "Legally Protected and Internationally Recognized Areas"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "5",
    "paragraph": "23",
    "ifc_provision": "As practicable, the client should take measures to eradicate such species from the natural habitats over which they have management control.",
    "audit_question": "Do the management plans for natural habitats provide for appropriate measures to eradicate alien species?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_051",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 96,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "monitoring_review",
    "page": "5",
    "paragraph": "24",
    "ifc_provision": "Where a project is likely to adversely impact ecosystem services, as determined by the risks and impacts identification process, the client will conduct a systematic review to identify priority ecosystem services.",
    "audit_question": "Has the project developed a process for conducting systematic reviews to identify priority ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_052",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 97,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "24",
    "ifc_provision": "Priority ecosystem services are two-fold: (i) those services on which project operations are most likely to have an impact and, therefore, which result in adverse impacts to Affected Communities; and/or (ii) those services on which the project is directly dependent for its operations (e.g., water).",
    "audit_question": "Have priority ecosystem services been identified?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_053",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 98,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "community_health_safety",
    "page": "6",
    "paragraph": "24",
    "ifc_provision": "When Affected Communities are likely to be impacted, they should participate in the determination of priority ecosystem services in accordance with the stakeholder engagement process as defined in Performance Standard 1.",
    "audit_question": "Have Affected Communities participated in the project's determination of priority ecosystem services?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_054",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 99,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "With respect to impacts on priority ecosystem services of relevance to Affected Communities and where the client has direct management control or significant influence over such ecosystem services, adverse impacts should be avoided.",
    "audit_question": "Does the project's management of priority ecosystem services adequately ensure the avoidance of adverse impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_055",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 100,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "If these impacts are unavoidable, the client will minimize them and implement mitigation measures that aim to maintain the value and functionality of priority services.",
    "audit_question": "Does the project's management of priority ecosystem services adequately ensure the minimization of adverse impacts where avoidance is not possible?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_056",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 101,
    "performance_standard": "PS6",
    "section": "Requirements > Management of Ecosystem Services",
    "section_path": [
      "Requirements",
      "Management of Ecosystem Services"
    ],
    "conceptual_group": "resource_efficiency",
    "page": "6",
    "paragraph": "25",
    "ifc_provision": "With respect to impacts on priority ecosystem services on which the project depends, clients should minimize impacts on ecosystem services and implement measures that increase resource efficiency of their operations, as described in Performance Standard 3.",
    "audit_question": "Have measures to increase the resource efficiency of operations been defined and/or implemented by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_057",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 105,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "applicability_scope",
    "page": "6",
    "paragraph": "26",
    "ifc_provision": "Clients who are engaged in the primary production of living natural resources, including natural and plantation forestry, agriculture, animal husbandry, aquaculture, and fisheries, will be subject to the requirements of paragraphs 26 through 30, in addition to the rest of this Performance Standard.",
    "audit_question": "Has the project evaluated the applicability of paragraphs 26-30 of PS6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_058",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 106,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "26",
    "ifc_provision": "Where feasible, the client will locate land-based agribusiness and forestry projects on unforested land or land already converted.",
    "audit_question": "Have land-based agribusiness and forestry components of the project been located on unforested or previously converted land, where feasible?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_059",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 107,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "26",
    "ifc_provision": "Clients who are engaged in such industries will manage living natural resources in a sustainable manner, through the application of industry-specific good management practices and available technologies.",
    "audit_question": "Does the project ensure the sustainable management of living natural resources in line with industry-specific good management practices?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_060",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 108,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "26",
    "ifc_provision": "Where such primary production practices are codified in globally, regionally, or nationally recognized standards, the client will implement sustainable management practices to one or more relevant and credible standards as demonstrated by independent verification or certification.",
    "audit_question": "Has the project applied any relevant globally/nationally/regionally recognized standards for primary production practices involving living natural resources?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_061",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 109,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "27",
    "ifc_provision": "Credible globally, regionally, or nationally recognized standards for sustainable management of living natural resources are those which (i) are objective and achievable; (ii) are founded on a multi-stakeholder consultative process; (iii) encourage step-wise and continual improvements; and (iv) provide for independent verification or certification through appropriate accredited bodies for such standards. [FN20]",
    "audit_question": "Has the project identified any applicable standards for primary production practices involving living natural resources as described in PS6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_062",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 111,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "28",
    "ifc_provision": "Where relevant and credible standard(s) exist, but the client has not yet obtained independent verification or certification to such standard(s), the client will conduct a pre-assessment of its conformity to the applicable standard(s) and take actions to achieve such verification or certification over an appropriate period of time.",
    "audit_question": "Have any pre-assessments of relevant and credible standards that have not yet been independently verified been undertaken by the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_063",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 112,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "6",
    "paragraph": "29",
    "ifc_provision": "In the absence of a relevant and credible global, regional, or national standard for the particular living natural resource in the country concerned, the client will:",
    "audit_question": "Where there is no credible standard for the project to adhere to, does the project:",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_064",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 113,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "7",
    "paragraph": "29",
    "ifc_provision": "* Commit to applying good international industry operating principles, management practices, and technologies; and",
    "audit_question": "* apply good international industry operating principles, management practices, and technologies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_065",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 114,
    "performance_standard": "PS6",
    "section": "Requirements > Sustainable Management of Living Natural Resources",
    "section_path": [
      "Requirements",
      "Sustainable Management of Living Natural Resources"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": "7",
    "paragraph": "28",
    "ifc_provision": "* Actively engage and support the development of a national standard, where relevant, including studies that contribute to the definition and demonstration of sustainable practices.",
    "audit_question": "* actively support the development of a national standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_066",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 116,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "policy_esms",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "Where a client is purchasing primary production (especially but not exclusively food and fiber commodities) that is known to be produced in regions where there is a risk of significant conversion of natural and/or critical habitats, systems and verification practices will be adopted as part of the client\u2019s ESMS to evaluate its primary suppliers. [FN21]",
    "audit_question": "Has the project identified any parts of its supply chain that takes place in areas risking significant conversion of natural and/or critical habitats? Have appropriate systems and verification practices for such situations been defined in the project's ESMS?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_067",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 118,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "third_party_workers_supply_chain",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "The systems and verification practices will",
    "audit_question": "Do the project's systems and verification practices include all of the listed points?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_068",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 119,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "third_party_workers_supply_chain",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "(i) identify where the supply is coming from and the habitat type of this area;",
    "audit_question": "* identification of supply origins and habitat type of these areas?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_069",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 120,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "monitoring_review",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "(ii) provide for an ongoing review of the client\u2019s primary supply chains;",
    "audit_question": "* ongoing review of primary supply chains?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_070",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 121,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "third_party_workers_supply_chain",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "(iii) limit procurement to those suppliers that can demonstrate that they are not contributing to significant conversion of natural and/or critical habitats (this may be demonstrated by delivery of certified product, or progress towards verification or certification under a credible scheme in certain commodities and/or locations); and",
    "audit_question": "* limitation of procurement to suppliers capable of demonstrating that they do not contribute to significant conversion of natural and/or critical habitats?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS6_071",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS6",
    "source_row": 122,
    "performance_standard": "PS6",
    "section": "Requirements > Supply Chain",
    "section_path": [
      "Requirements",
      "Supply Chain"
    ],
    "conceptual_group": "third_party_workers_supply_chain",
    "page": "7",
    "paragraph": "30",
    "ifc_provision": "(iv) where possible, require actions to shift the client\u2019s primary supply chain over time to suppliers that can demonstrate that they are not significantly adversely impacting these areas.",
    "audit_question": "* actions to shift primary supply chains over time to capable of demonstrating that they do not contribute to significant conversion of natural and/or critical habitats?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 23,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Has the project established a clear position with regard to PS7 applicability?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 24,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "1",
    "paragraph": "3",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System, the elements of which are outlined in Performance Standard 1.",
    "audit_question": "Does the project ESMS clearly articulate compliance provisions with regard to PS7?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 26,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "5",
    "ifc_provision": "In this Performance Standard, the term \u201cIndigenous Peoples\u201d is used in a generic sense to refer to a distinct social and cultural group possessing the following characteristics in varying degrees:",
    "audit_question": "Do the project-affected people match with any of the following IFC criteria for \"Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 31,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "This Performance Standard applies to communities or groups of Indigenous Peoples who maintain a collective attachment, i.e., whose identity as a group or community is linked, to distinct habitats or ancestral territories and the natural resources therein.",
    "audit_question": "Can the affected people be understood as having a 'collective attachment' to the specific lands and territories where the project is located?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 32,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "6",
    "ifc_provision": "It may also apply to communities or groups that have lost collective attachment to distinct habitats or ancestral territories in the project area, occurring within the concerned group members\u2019 lifetime, because of forced severance, conflict, government resettlement programs, dispossession of their lands, natural disasters, or incorporation of such territories into an urban area?",
    "audit_question": "Have the affected peoples lost 'collective attachment' in their lifetime because of forced severance, conflict, government resettlement programs, dispossession of their lands, natural disasters, or incorporation of such territories into an urban area.",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 33,
    "performance_standard": "PS7",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": "2",
    "paragraph": "7",
    "ifc_provision": "The client may be required to seek inputs from competent professionals to ascertain whether a particular group is considered as Indigenous Peoples for the purpose of this Performance Standard.",
    "audit_question": "Did the project engage the help of a qualified professional to make the assessment of whether the affected population counts as an \"Indigenous People\"?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 37,
    "performance_standard": "PS7",
    "section": "Requirements > General > Avoidance of Adverse Impacts",
    "section_path": [
      "Requirements",
      "General",
      "Avoidance of Adverse Impacts"
    ],
    "conceptual_group": "risk_identification",
    "page": "2",
    "paragraph": "8",
    "ifc_provision": "The client will identify, through an environmental and social risks and impacts assessment process, all communities of Indigenous Peoples within the project area of influence who may be affected by the project, as well as the nature and degree of the expected direct and indirect economic, social, cultural (including cultural heritage2), and environmental impacts on them.",
    "audit_question": "Has the project undertaken an adequate environmental and social risks and impacts assessment process\u2014identifying thereby all communities of Indigenous Peoples within the project area of influence who may be affected by the project, as well as the nature and degree of the expected direct and indirect economic, social, cultural (including cultural heritage2), and environmental impacts on them?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 38,
    "performance_standard": "PS7",
    "section": "Requirements > General > Avoidance of Adverse Impacts",
    "section_path": [
      "Requirements",
      "General",
      "Avoidance of Adverse Impacts"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "2",
    "paragraph": "9",
    "ifc_provision": "Adverse impacts on Affected Communities of Indigenous Peoples should be avoided where possible.",
    "audit_question": "Does the project design exhibit reasonable efforts to avoid adverse impacts to Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 39,
    "performance_standard": "PS7",
    "section": "Requirements > General > Avoidance of Adverse Impacts",
    "section_path": [
      "Requirements",
      "General",
      "Avoidance of Adverse Impacts"
    ],
    "conceptual_group": "community_health_safety",
    "page": "2",
    "paragraph": "9",
    "ifc_provision": "Where alternatives have been explored and adverse impacts are unavoidable, the client will minimize, restore, and/or compensate for these impacts in a culturally appropriate manner commensurate with the nature and scale of such impacts and the vulnerability of the Affected Communities of Indigenous Peoples.",
    "audit_question": "In the event of 'unavoidable adverse impacts', has the project established adequate measures to minimize, restore, and/or compensate for these impacts in a culturally appropriate manner commensurate with the nature and scale of such impacts and the vulnerability of the Affected Communities of Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 40,
    "performance_standard": "PS7",
    "section": "Requirements > General > Avoidance of Adverse Impacts",
    "section_path": [
      "Requirements",
      "General",
      "Avoidance of Adverse Impacts"
    ],
    "conceptual_group": "community_health_safety",
    "page": "2",
    "paragraph": "9",
    "ifc_provision": "The client\u2019s proposed actions will be developed with the ICP of the Affected Communities of Indigenous Peoples and contained in a time-bound plan, such as an Indigenous Peoples Plan, or a broader community development plan with separate components for Indigenous Peoples.",
    "audit_question": "Has the project's action plan for risk and impact avoidance and mitigation been developed with the ICP of the Affected Communities of Indigenous Peoples and contained in a time-bound plan, such as an Indigenous Peoples Plan, or a broader community development plan with separate components for Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 44,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "The client will undertake an engagement process with the Affected Communities of Indigenous Peoples as required in Performance Standard 1.",
    "audit_question": "Has the client undertaken an engagement process with the Affected Communities of Indigenous Peoples as required in Performance Standard 1?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 45,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "This engagement process includes stakeholder analysis and engagement planning, disclosure of information, consultation, and participation, in a culturally appropriate manner.",
    "audit_question": "Does the client's engagement process include stakeholder analysis and engagement planning, disclosure of information, consultation, and participation, in a culturally appropriate manner.",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 46,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "10",
    "ifc_provision": "In addition, this process will:",
    "audit_question": "Has the client's engagement process been attentive to the following issues?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 50,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "risk_identification",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "Affected Communities of Indigenous Peoples may be particularly vulnerable to the loss of, alienation from or exploitation of their land and access to natural and cultural resources. [FN5]",
    "audit_question": "Does the project involve risks and impacts corresponding to the circumstances described in PS7 paragraphs 13\u201317? Circumstances: * Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use * Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use * Critical Cultural Heritage",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 53,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "monitoring_review",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "FPIC applies to project design, implementation, and expected outcomes related to impacts affecting the communities of Indigenous Peoples.",
    "audit_question": "Have FPIC processes been established for (i) project design, (ii) implementation, and (iii) evaluation and monitoring?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 54,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "risk_identification",
    "page": "3",
    "paragraph": "11",
    "ifc_provision": "When any of these circumstances apply, the client will engage external experts to assist in the identification of the project risks and impacts.",
    "audit_question": "Has the project engaged an external expert(s) who specialize in addressing the risks and impacts for FPIC-specific circumstances?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 56,
    "performance_standard": "PS7",
    "section": "Requirements > General > Participation and Consent",
    "section_path": [
      "Requirements",
      "General",
      "Participation and Consent"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": "3",
    "paragraph": "12",
    "ifc_provision": "The client will document:",
    "audit_question": "Has the client documented the following items?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 67,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "If the client proposes to locate a project on, or commercially develop natural resources on lands traditionally owned by, or under the customary use of, Indigenous Peoples, and adverse impacts [FN8] can be expected, the client will take the following steps:",
    "audit_question": "In the event that the project will be located on, or will commercially develop natural resources within, lands traditionally owned by, or under the customary use of, Indigenous Peoples, and anticipates the potential for adverse impacts\u2014have the following steps been undertaken?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 69,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "fpic_participation_consent",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Document efforts to avoid and otherwise minimize the area of land proposed for the project;",
    "audit_question": "Has the project documented efforts to avoid and otherwise minimize its land use?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 70,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Document efforts to avoid and otherwise minimize impacts on natural resources and natural areas of importance [FN9] to Indigenous People;",
    "audit_question": "Has the project documented efforts to avoid and otherwise minimize impacts on natural resources and natural areas of importance to Indigenous People?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 72,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "monitoring_review",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Identify and review all property interests and traditional resource uses prior to purchasing or leasing land;",
    "audit_question": "Has the project identified and reviewed all property interests and traditional resource uses prior to purchasing or leasing land?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 73,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "community_health_safety",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Assess and document the Affected Communities of Indigenous Peoples\u2019 resource use without prejudicing any Indigenous Peoples\u2019 land claim. [FN10] The assessment of land and natural resource use should be gender inclusive and specifically consider women\u2019s role in the management and use of these resources;",
    "audit_question": "Has the project assessed and documented the Affected Communities of Indigenous Peoples\u2019 resource use without prejudicing any Indigenous Peoples\u2019 land claim? Was the assessment of land and natural resource use gender-inclusive and considerate of women\u2019s role in the management and use of these resources?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 75,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "community_health_safety",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Ensure that Affected Communities of Indigenous Peoples are informed of their land rights under national law, including any national law recognizing customary use rights; and",
    "audit_question": "Has the project ensured that Affected Communities of Indigenous Peoples are informed of their land rights under national law, including any national law recognizing customary use rights?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 76,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "community_health_safety",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "* Offer Affected Communities of Indigenous Peoples compensation and due process in the case of commercial development of their land and natural resources, together with culturally appropriate sustainable development opportunities, including:",
    "audit_question": "In the case of commercial development of their land and natural resources, has the project offered Affected Communities of Indigenous Peoples compensation according to due process and in a manner that is culturally appropriate and considerate of sustainable development opportunities?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 77,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "fpic_participation_consent",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "** Providing land-based compensation or compensation-in-kind in lieu of cash compensation where feasible. [FN11]",
    "audit_question": "Has the project explored options for providing land-based compensation or compensation-in-kind in lieu of cash compensation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 79,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "economic_displacement",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "** Ensuring continued access to natural resources, identifying the equivalent replacement resources, or, as a last option, providing compensation and identifying alternative livelihoods if project development results in the loss of access to and the loss of natural resources independent of project land acquisition.",
    "audit_question": "Has the project ensured continued access to natural resources, such as by identifying the equivalent replacement resources or providing compensation and identifying alternative livelihoods?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 80,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "community_health_safety",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "** Ensuring fair and equitable sharing of benefits associated with project usage of the resources where the client intends to utilize natural resources that are central to the identity and livelihood of Affected Communities of Indigenous People and their usage thereof exacerbates livelihood risk.",
    "audit_question": "Has the project ensured fair and equitable sharing of benefits associated with project usage of the resources where it intends to utilize natural resources that are central to the identity and livelihood of Affected Communities of Indigenous People and their usage thereof exacerbates livelihood risk, ?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 81,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Impacts on Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "occupational_health_safety",
    "page": "4",
    "paragraph": "14",
    "ifc_provision": "** Providing Affected Communities of Indigenous Peoples with access, usage, and transit on land it is developing subject to overriding health, safety, and security considerations.",
    "audit_question": "Are Affected Communities of Indigenous Peoples afforded continued land access throughout project operation? If not, are there overriding health, safety, and security considerations that merit the restrictions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 83,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "45021",
    "paragraph": "15",
    "ifc_provision": "The client will consider feasible alternative project designs to avoid the relocation of Indigenous Peoples from communally held [FN12] lands and natural resources subject to traditional ownership or under customary use.",
    "audit_question": "Has the client considered feasible alternative project designs to avoid the relocation of Indigenous Peoples from communally held lands and natural resources subject to traditional ownership or under customary use?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 85,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "5",
    "paragraph": "15",
    "ifc_provision": "If such relocation is unavoidable the client will not proceed with the project unless FPIC has been obtained as described above. Any relocation of Indigenous Peoples will be consistent with the requirements of Performance Standard 5.",
    "audit_question": "In the event that relocation is unavoidable, has the client obtained FPIC for such relocation of Indigenous Peoples, and is such relocation consistent with the requirements of Performance Standard 5?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 86,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Relocation of Indigenous Peoples from Lands and Natural Resources Subject to Traditional Ownership or Under Customary Use"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "5",
    "paragraph": "15",
    "ifc_provision": "Where feasible, the relocated Indigenous Peoples should be able to return to their traditional or customary lands, should the cause of their relocation cease to exist.",
    "audit_question": "Will it be feasible for relocated Indigenous Peoples to return to their traditional or customary lands, should the cause of their relocation cease to exist?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 88,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "Where a project may significantly impact on critical cultural heritage [FN13] that is essential to the identity and/or cultural, ceremonial, or spiritual aspects of Indigenous Peoples lives, priority will be given to the avoidance of such impacts.",
    "audit_question": "In the case that there is a potential for significant impacts to critical cultural heritage that is essential to the identity and/or cultural, ceremonial, or spiritual aspects of Indigenous Peoples lives, has priority been given to the avoidance of such impacts?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 90,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "16",
    "ifc_provision": "Where significant project impacts on critical cultural heritage are unavoidable, the client will obtain the FPIC of the Affected Communities of Indigenous Peoples.",
    "audit_question": "Has the project obtained the FPIC of the Affected Communities of Indigenous Peoples for its planned actions to avoid and/or mitigate potential significant project impacts on critical cultural heritage are unavoidable?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 91,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "Where a project proposes to use the cultural heritage including knowledge, innovations, or practices of Indigenous Peoples for commercial purposes, the client will inform the Affected Communities of Indigenous Peoples of:",
    "audit_question": "Where a project proposes to use the cultural heritage including knowledge, innovations, or practices of Indigenous Peoples for commercial purposes, has the client will informed the Affected Communities of Indigenous Peoples of all of the following points?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 95,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "(iv) obtain their FPIC.",
    "audit_question": "After having duly informed the Affected Communities of Indigenous Peoples of the foregoing points, has the project obtained their FPIC?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 96,
    "performance_standard": "PS7",
    "section": "Requirements > Circumstances Requiring Free, Prior, and Informed Consent > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Circumstances Requiring Free, Prior, and Informed Consent",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "5",
    "paragraph": "17",
    "ifc_provision": "The client will also ensure fair and equitable sharing of benefits from commercialization of such knowledge, innovation, or practice, consistent with the customs and traditions of the Indigenous Peoples.",
    "audit_question": "Where a project proposes to use the cultural heritage including knowledge, innovations, or practices of Indigenous Peoples for commercial purposes, has the client ensured fair and equitable sharing of benefits from commercialization of such that is consistent with the customs and traditions of the Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 98,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "labor_working_conditions",
    "page": "5",
    "paragraph": "18",
    "ifc_provision": "The client and the Affected Communities of Indigenous Peoples will identify mitigation measures in alignment with the mitigation hierarchy described in Performance Standard 1 as well as opportunities for culturally appropriate and sustainable development benefits.",
    "audit_question": "Has the client collaborated with the Affected Communities of Indigenous Peoples to identify mitigation measures in alignment with the mitigation hierarchy described in Performance Standard 1 as well as opportunities for culturally appropriate and sustainable development benefits?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 99,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "18",
    "ifc_provision": "The client will ensure the timely and equitable delivery of agreed measures to the Affected Communities of Indigenous Peoples.",
    "audit_question": "Has the client ensured the timely and equitable delivery of agreed measures to the Affected Communities of Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 100,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "The determination, delivery, and distribution of compensation and other benefit sharing measures to the Affected Communities of Indigenous Peoples will take account of the laws, institutions, and customs of these communities as well as their level of interaction with mainstream society.",
    "audit_question": "Has the determination, delivery, and distribution of compensation and other benefit sharing measures to the Affected Communities of Indigenous Peoples taken into account the laws, institutions, and customs of these communities as well as their level of interaction with mainstream society?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 103,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "mitigation_and_development_benefits",
    "page": "5",
    "paragraph": "19",
    "ifc_provision": "Where compensation occurs on a collective basis, mechanisms that promote the effective delivery and distribution of compensation to all eligible members of the group will be defined and implemented.",
    "audit_question": "In the event that compensation is organized on a collective basis, has the project defined and implemented mechanisms that promote the effective delivery and distribution of compensation to all eligible members of the group?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 104,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "community_health_safety",
    "page": "5",
    "paragraph": "20",
    "ifc_provision": "Various factors including, but not limited to, the nature of the project, the project context and the vulnerability of the Affected Communities of Indigenous Peoples will determine how these communities should benefit from the project.",
    "audit_question": "Does the design of community benefits account for such factors as (but not limited to,)the nature of the project, the project context and the vulnerability of the Affected Communities of Indigenous Peoples?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 105,
    "performance_standard": "PS7",
    "section": "Requirements > Mitigation and Development Benefits",
    "section_path": [
      "Requirements",
      "Mitigation and Development Benefits"
    ],
    "conceptual_group": "economic_displacement",
    "page": "45052",
    "paragraph": "20",
    "ifc_provision": "Identified opportunities should aim to address the goals and preferences of the Indigenous Peoples including improving their standard of living and livelihoods in a culturally appropriate manner, and to foster the long-term sustainability of the natural resources on which they depend.",
    "audit_question": "Do the benefits-sharing opportunities identified by the project aim to address the goals and preferences of the Indigenous Peoples, including improving their standard of living and livelihoods in a culturally appropriate manner and fostering the long-term sustainability of the natural resources on which they depend?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 107,
    "performance_standard": "PS7",
    "section": "Requirements > Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues"
    ],
    "conceptual_group": "objectives",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "Where the government has a defined role in the management of Indigenous Peoples issues in relation to the project, the client will collaborate with the responsible government agency, to the extent feasible and permitted by the agency, to achieve outcomes that are consistent with the objectives of this Performance Standard.",
    "audit_question": "In cases where government has a defined role in the management of Indigenous Peoples issues in relation to the project, is the client collaborating with responsible government agencies to achieve outcomes that are consistent with PS7 objectives?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 108,
    "performance_standard": "PS7",
    "section": "Requirements > Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues"
    ],
    "conceptual_group": "monitoring_review",
    "page": "6",
    "paragraph": "21",
    "ifc_provision": "In addition, where government capacity is limited, the client will play an active role during planning, implementation, and monitoring of activities to the extent permitted by the agency.",
    "audit_question": "In cases where government capacity is limited, has the client played an active role during planning, implementation, and monitoring of government-mandated activities for management of Indigenous Peoples issues in relation to the project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 109,
    "performance_standard": "PS7",
    "section": "Requirements > Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "The client will prepare a plan that, together with the documents prepared by the responsible government agency, will address the relevant requirements of this Performance Standard.",
    "audit_question": "Has the client prepared a plan that, together with the documents prepared by the responsible government agency, addresses the relevant requirements of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS7_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS7",
    "source_row": 110,
    "performance_standard": "PS7",
    "section": "Requirements > Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues",
    "section_path": [
      "Requirements",
      "Private Sector Responsibilities Where Government is Responsible for Managing Indigenous Peoples Issues"
    ],
    "conceptual_group": "indigenous_peoples",
    "page": "6",
    "paragraph": "22",
    "ifc_provision": "The client may need to include",
    "audit_question": "Does the plan prepared by the client respond to both government-mandated activities for management of Indigenous Peoples issues in relation to the project include the following points?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_001",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 9,
    "performance_standard": "PS8",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": null,
    "paragraph": "1",
    "ifc_provision": "To protect cultural heritage from the adverse impacts of project activities and support its preservation.",
    "audit_question": "Does the client adequately protect cultural heritage from adverse impacts of project activities? Is the client supporting the preservation of cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_002",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 10,
    "performance_standard": "PS8",
    "section": "Objectives",
    "section_path": [
      "Objectives"
    ],
    "conceptual_group": "objectives",
    "page": null,
    "paragraph": "1",
    "ifc_provision": "To promote the equitable sharing of benefits from the use of cultural heritage.",
    "audit_question": "Does the client promote equitable sharing of benefits deriving from the use of cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_003",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 12,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "2",
    "ifc_provision": "The applicability of this Performance Standard is established during the environmental and social risks and impacts identification process.",
    "audit_question": "Was the applicability of the Performance Standard established in process of environmental and social risks and impact identification?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_004",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 13,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "2",
    "ifc_provision": "The implementation of the actions necessary to meet the requirements of this Performance Standard is managed through the client\u2019s Environmental and Social Management System (ESMS), the elements of which are outline in Performance Standard 1.",
    "audit_question": "Has the client established an ESMS in accordance with Performance Standard 1? If so, does it implement actions that meet the requirements of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_005",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 14,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "2",
    "ifc_provision": "During the project life-cycle, the client will consider potential project impacts to cultural heritage and will apply the provisions of this Performance Standard.",
    "audit_question": "Has the client adequately considered potential impacts to cultural heritage arising from project operations throughout the project life-cycle? Is the client applying the relevant provisions of the Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_006",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 15,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "3",
    "ifc_provision": "For the purposes of this Performance Standard, cultural heritage refers to",
    "audit_question": "Has the client identified any forms of cultural heritage listed below?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_007",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 16,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "3",
    "ifc_provision": "(i) tangible forms of cultural heritage, such as tangible moveable or immovable objects, property, sites, structures, or groups of structures, having archaeological (prehistoric), paleontological, historical, cultural, artistic, and religious values;",
    "audit_question": "* tangible forms of cultural heritage, such as tangible moveable or immovable objects, property, sites, structures, or groups of structures, having archaeological (prehistoric), paleontological, historical, cultural, artistic, and religious values?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_008",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 17,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "3",
    "ifc_provision": "(ii) unique natural features or tangible objects that embody cultural values, such as sacred groves, rocks, lakes, and waterfalls; and",
    "audit_question": "* unique natural features or tangible objects that embody cultural values, such as sacred groves, rocks, lakes, and waterfalls?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_009",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 18,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "3",
    "ifc_provision": "(iii) certain instances of intangible forms of culture that are proposed to be used for commercial purposes, such as cultural knowledge, innovations, and practices of communities embodying traditional lifestyles.",
    "audit_question": "* certain instances of intangible forms of culture that are proposed to be used for commercial purposes, such as cultural knowledge, innovations, and practices of communities embodying traditional lifestyles?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_010",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 19,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "4",
    "ifc_provision": "Requirements with respect to tangible forms of cultural heritage are contained in paragraphs 6\u201316. For requirements with respect to specific instances of intangible forms of cultural heritage described in paragraph 3 (iii) see paragraph 16.",
    "audit_question": "Has the client fulfilled the requirements with respect to tangible forms of cultural heritage described in paragraphs 6-16 of this Performance Standard? In specific instances of intangible forms of cultural heritage, has the client met the requirements described in paragraph 16 of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_011",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 20,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "5",
    "ifc_provision": "The requirements of this Performance Standard apply to cultural heritage regardless of whether or not it has been legally protected or previously disturbed.",
    "audit_question": "Has the client applied the requirements of this Performance Standard to all cultural heritage affected by the project, regardless of whether or not it has been previously disturbed or legally protected?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_012",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 21,
    "performance_standard": "PS8",
    "section": "Scope of Application",
    "section_path": [
      "Scope of Application"
    ],
    "conceptual_group": "applicability_scope",
    "page": null,
    "paragraph": "5",
    "ifc_provision": "The requirements of this Performance Standard do not apply to cultural heritage of Indigenous Peoples; Performance Standard 7 describes those requirements.",
    "audit_question": "Where the cultural heritage of Indigenous Peoples is involved, has the client fulfilled the requirements of Performance Standard 7?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_013",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 24,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "6",
    "ifc_provision": "In addition to complying with applicable law on the protection of cultural heritage, including national law implementing the host country\u2019s obligations under the Convention Concerning the Protection of the World Cultural and Natural Heritage, the client will identify and protect cultural heritage by ensuring that internationally recognized practices for the protection, field-based study, and documentation of cultural heritage are implemented.",
    "audit_question": "Does the project comply with applicable national and international laws on the protection of cultural heritage? Does the client also implement internationally recognized practices to ensure the protection, field-based study, and documentation of cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_014",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 25,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "7",
    "ifc_provision": "Where the risk and identification process determines that there is a chance of impacts to cultural heritage, the client will retain competent professionals to assist in the identification and protection of cultural heritage.",
    "audit_question": "Has the client adequately identified the chance of impacts to cultural heritage? If so, does the client retain competent professionals to assist in the identification and protection of cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_015",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 26,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "7",
    "ifc_provision": "The removal of nonreplicable cultural heritage is subject to the additional requirements of paragraph 10 below.",
    "audit_question": "Where nonreplicable cultural heritage has been identified, has the client fulfilled the additional requirements of paragraph 10 of this Performance Standard in the process of its removal?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_016",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 27,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "7",
    "ifc_provision": "In the case of critical cultural heritage, the requirements of paragraphs 13\u201315 will apply.",
    "audit_question": "In cases of critical cultural heritage, has the client fulfilled the requirements of paragraphs 13-15 of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_017",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 29,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Chance Find Procedures",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Chance Find Procedures"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "8",
    "ifc_provision": "The client is responsible for siting and designing a project to avoid significant adverse impacts to cultural heritage.",
    "audit_question": "Is the project sited and designed to avoid significant adverse impacts to cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_018",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 30,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Chance Find Procedures",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Chance Find Procedures"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "8",
    "ifc_provision": "The environmental and social risks and impacts identification process should determine whether the proposed location of a project is in areas where cultural heritage is expected to be found, either during construction or operations.",
    "audit_question": "Has the client utilized the process of environmental and social risk and impact identification to determine the potential for encountering cultural heritage at the proposed project site\u2014during either construction or operations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_019",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 31,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Chance Find Procedures",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Chance Find Procedures"
    ],
    "conceptual_group": "policy_esms",
    "page": null,
    "paragraph": "8",
    "ifc_provision": "In such cases, as part of the client\u2019s ESMS, the client will develop provisions for managing chance finds [FN1] through a chance find procedure [FN2] which will be applied in the event that cultural heritage is subsequently discovered.",
    "audit_question": "Has the client developed a chance find procedure within the framework of the project's ESMS for the management of unexpectedly encountered cultural heritage? If so, has it being implemented subsequent to the environmental and social risks and impacts identification process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_020",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 34,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Chance Find Procedures",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Chance Find Procedures"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "8",
    "ifc_provision": "The client will not disturb any chance find further until an assessment by competent professionals is made and actions consistent with the requirements of this Performance Standard are identified.",
    "audit_question": "Has the project encountered any chance finds? If so, did the client employ competent professionals to assess the find before disturbing it and did the client identify actions consistent with the requirements of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_021",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 36,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Consultation",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Consultation"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "9",
    "ifc_provision": "Where a project may affect cultural heritage, the client will consult with Affected Communities within the host country who use, or have used within living memory, the cultural heritage for longstanding cultural purposes.",
    "audit_question": "Has the client consulted Affected Communities in instances where the project may affect cultural heritage that they use, or have used within living memory, for long-standing cultural purposes?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_022",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 37,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Consultation",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Consultation"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "9",
    "ifc_provision": "The client will consult with the Affected Communities to identify cultural heritage of importance, and to incorporate into the client\u2019s decision-making process the views of the Affected Communities on such cultural heritage.",
    "audit_question": "Has the client consulted Affected Communities to identify cultural heritage of importance? Have the views of Affected Communities on identified cultural heritage of importance been incorporated into the client's decision-making process?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_023",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 38,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Consultation",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Consultation"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "9",
    "ifc_provision": "Consultation will also involve the relevant national or local regulatory agencies that are entrusted with the protection of cultural heritage.",
    "audit_question": "Has the client's consultation on cultural heritage with Affected Communities involved the relevant national or local regulatory agencies?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_024",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 40,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Community Access",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Community Access"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "10",
    "ifc_provision": "Where the client\u2019s project site contains cultural heritage or prevents access to previously accessible cultural heritage sites being used by, or that have been used by, Affected Communities within living memory for long-standing cultural purposes, the client will, based on consultations under paragraph 9, allow continued access to the cultural site or will provide an alternative access route, subject to overriding health, safety, and security considerations.",
    "audit_question": "Where the project site contains cultural heritage or restricts access to cultural heritage sites that are or have been used by Affected Communities within living memory, does the client ensure continued access to the cultural site(s) based on consultations under paragraph 9 of this Performance Standard? If not, does the client provide an alternative access route in compliance with overriding health, safety, and security considerations?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_025",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 42,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "Where the client has encountered tangible cultural heritage that is replicable [FN3] and not critical, the client will apply mitigation measures that favor avoidance.",
    "audit_question": "Where tangible cultural heritage that is replicable and not critical is encountered, does the client apply mitigation measures favoring avoidance?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_026",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 44,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "Where avoidance is not feasible, the client will apply a mitigation hierarchy as follows:",
    "audit_question": "Where avoidance is not feasible, does the client apply a mitigation hierarchy to replicable and non-critical cultural heritage as follows?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_027",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 45,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "* Minimize adverse impacts and implement restoration measures, in situ, that ensure maintenance of the value and functionality of the cultural heritage, including maintaining or restoring any ecosystem processes [FN4] needed to support it;",
    "audit_question": "* Minimize adverse impacts and implement restoration measures, in situ, that ensure maintenance of the value and functionality of the cultural heritage, including maintaining or restoring any ecosystem processes needed to support it in a manner consistent with the requirements of Performance Standard 6?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_028",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 47,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "biodiversity_conservation",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "* Where restoration in situ is not possible, restore the functionality of the cultural heritage, in a different location, including the ecosystem processes needed to support it;",
    "audit_question": "* Where restoration in situ is not possible, restore the functionality of the cultural heritage, in a different location, including the ecosystem processes needed to support it?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_029",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 48,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "* The permanent removal of historical and archaeological artifacts and structures is carried out according to the principles of paragraphs 6 and 7 above; and",
    "audit_question": "* The permanent removal of historical and archaeological artifacts and structures is carried out according to the principles of paragraphs 6 and 7 of this Performance Standard?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_030",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 49,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Replicable Cultural Heritage"
    ],
    "conceptual_group": "community_health_safety",
    "page": null,
    "paragraph": "11",
    "ifc_provision": "* Only where minimization of adverse impacts and restoration to ensure maintenance of the value and functionality of the cultural heritage are demonstrably not feasible, and where the Affected Communities are using the tangible cultural heritage for long-standing cultural purposes, compensate for loss of that tangible cultural heritage.",
    "audit_question": "* Where minimization of adverse impacts and restoration to ensure maintenance of the value and functionality of the cultural heritage are demonstrably not feasible and where the Affected Communities are using the tangible cultural heritage for long-standing cultural purposes, does the client compensate for loss of tangible cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_031",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 51,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Non-Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Non-Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "12",
    "ifc_provision": "Most cultural heritage is best protected by preservation in its place, since removal is likely to result in irreparable damage or destruction of the cultural heritage. The client will not remove any nonreplicable cultural heritage, [FN5] unless all of the following conditions are met:",
    "audit_question": "Where the project involves the removal of any nonreplicable cultural heritage, does this removal meet all of the listed conditions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_032",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 53,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Non-Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Non-Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "12",
    "ifc_provision": "* There are no technically or financially feasible alternatives to removal;",
    "audit_question": "* There are no technically or financially feasible alternatives to removal?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_033",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 54,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Non-Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Non-Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "12",
    "ifc_provision": "* The overall benefits of the project conclusively outweigh the anticipated cultural heritage loss from removal; and",
    "audit_question": "* The overall benefits of the project conclusively outweigh the anticipated cultural heritage loss from removal?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_034",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 55,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Removal of Non-Replicable Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Removal of Non-Replicable Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "12",
    "ifc_provision": "* Any removal of cultural heritage is conducted using the best available technique.",
    "audit_question": "* Any removal of cultural heritage is conducted using the best available technique?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_035",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 57,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "13",
    "ifc_provision": "Critical cultural heritage consists of one or both of the following types of cultural heritage:",
    "audit_question": "Have any of the following types of critical cultural heritage been identified?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_036",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 58,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "13",
    "ifc_provision": "(i) the internationally recognized heritage of communities who use, or have used within living memory the cultural heritage for long-standing cultural purposes; or",
    "audit_question": "* the internationally recognized heritage of communities who use, or have used within living memory the cultural heritage for long-standing cultural purposes?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_037",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 59,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "13",
    "ifc_provision": "(ii) legally protected cultural heritage areas, including those proposed by host governments for such designation.",
    "audit_question": "* legally protected cultural heritage areas, including those proposed by host governments for such designation?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_038",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 60,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "community_health_safety",
    "page": null,
    "paragraph": "14",
    "ifc_provision": "The client should not remove, significantly alter, or damage critical cultural heritage.",
    "audit_question": "Has the client removed, significantly altered, or damaged critical cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_039",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 61,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "14",
    "ifc_provision": "In exceptional circumstances when impacts on critical cultural heritage are unavoidable, the client will use a process of Informed Consultation and Participation (ICP) of the Affected Communities as described in Performance Standard 1 and which uses a good faith negotiation process that results in a documented outcome.",
    "audit_question": "Where impacts on critical cultural heritage are unavoidable, has the client employed a process of Informed Consultation and Participation of Affected Communities in accordance with Performance Standard 1? Has the client also employed a good faith negotiation process with documented outcomes?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_040",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 62,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "14",
    "ifc_provision": "The client will retain external experts to assist in the assessment and protection of critical cultural heritage.",
    "audit_question": "Does the client retain external experts to assist in the assessment and protection of critical cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_041",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 63,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "15",
    "ifc_provision": "Legally protected cultural heritage areas [FN6] are important for the protection and conservation of cultural heritage, and additional measures are needed for any projects that would be permitted under the applicable national law in these areas.",
    "audit_question": "Does the client implement additional measures for the protection and conservation of cultural heritage at legally protected cultural heritage sites? If so, are these measures compliant with applicable national laws?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_042",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 65,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "15",
    "ifc_provision": "In circumstances where a proposed project is located within a legally protected area or a legally defined buffer zone, the client, in addition to the requirements for critical cultural heritage cited in paragraph 14 above, will meet the following requirements:",
    "audit_question": "Where the project is located within a legally protected area or legally defined buffer zone, does the client meet the requirements of paragraph 14 of this Performance Standard, as well as the requirements listed here?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_043",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 66,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "15",
    "ifc_provision": "* Comply with defined national or local cultural heritage regulations or the protected area management plans;",
    "audit_question": "* Compliance with defined national or local cultural heritage regulations or the protected area management plans?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_044",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 67,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "stakeholder_engagement",
    "page": null,
    "paragraph": "15",
    "ifc_provision": "* Consult the protected area sponsors and managers, local communities and other key stakeholders on the proposed project; and",
    "audit_question": "* Consultation with the protected area sponsors and managers, local communities and other key stakeholders on the proposed project?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_045",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 68,
    "performance_standard": "PS8",
    "section": "Requirements > Protection of Cultural Heritage in Project Design and Execution > Critical Cultural Heritage",
    "section_path": [
      "Requirements",
      "Protection of Cultural Heritage in Project Design and Execution",
      "Critical Cultural Heritage"
    ],
    "conceptual_group": "critical_habitat_protected_areas",
    "page": null,
    "paragraph": "15",
    "ifc_provision": "* Implement additional programs, as appropriate, to promote and enhance the conservation aims of the protected area.",
    "audit_question": "* Implementation of additional programs, as appropriate, to promote and enhance the conservation aims of the protected area?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_046",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 70,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "Where a project proposes to use the cultural heritage, including knowledge, innovations, or practices of local communities for commercial purposes, [FN7] the client will inform these communities of",
    "audit_question": "Has the client informed the relevant local communities of all of the below-listed points where cultural heritage will be used?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_047",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 72,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "(i) their rights under national law;",
    "audit_question": "* their rights under national law?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_048",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 73,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "(ii) the scope and nature of the proposed commercial development; and",
    "audit_question": "* the scope and nature of the proposed commercial development?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_049",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 74,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "(iii) the potential consequences of such development.",
    "audit_question": "* the potential consequences of such development?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_050",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 75,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "The client will not proceed with such commercialization unless it",
    "audit_question": "Has the client fulfilled the below-listed points before proceeding with commercialization of cultural heritage?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_051",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 76,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "(i) enters into a process of ICP as described in Performance Standard 1 and which uses a good faith negotiation process that results in a documented outcome and",
    "audit_question": "* entered into a process of ICP as described in Performance Standard 1 and which used a good faith negotiation process that resulted in a documented outcome?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  },
  {
    "diagnostic_id": "IFC_ME_PS8_052",
    "template_id": "ifc_ps_me_matrix_2012",
    "source_workbook": "IFC Performance Standards - M&E matrix template.xlsx",
    "source_sheet": "PS8",
    "source_row": 77,
    "performance_standard": "PS8",
    "section": "Requirements > Project's Use of Cultural Heritage",
    "section_path": [
      "Requirements",
      "Project's Use of Cultural Heritage"
    ],
    "conceptual_group": "cultural_heritage",
    "page": null,
    "paragraph": "16",
    "ifc_provision": "(ii) provides for fair and equitable sharing of benefits from commercialization of such knowledge, innovation, or practice, consistent with their customs and traditions.",
    "audit_question": "* provided for fair and equitable sharing of benefits from commercialization of such knowledge, innovation, or practice, consistent with their customs and traditions?",
    "response_fields": [
      "compliance_assessment",
      "relevant_documents",
      "supporting_evidence",
      "recommendation",
      "auxiliary_notes",
      "schedule_for_compliance",
      "reviewer_analysis",
      "specialist_review_required"
    ]
  }
];

