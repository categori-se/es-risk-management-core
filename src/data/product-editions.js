// Generated from product-editions.json; source SHA256 6f1ea01b5a3eb187b59f4e797a97959b5105beb4073d239c37568f25a4a9fb1c.
// Regenerate with node tools/build-product-catalog.mjs.
export default {
  "schemaVersion": 1,
  "product": "E&S Review",
  "reviewDate": "2026-10-25",
  "status": "proposed_packaging_current_capabilities_separately_identified",
  "licensing": {
    "application": "Application-owned E&S Risk Management Core Community source is licensed under Apache-2.0; third-party components retain their notices.",
    "proposal": "Apache-2.0 selected by the repository owner for the Community export.",
    "publication": "Selective source export for categori-se/es-risk-management-core; private history, client originals and research capture registries are excluded."
  },
  "principles": [
    "Manual professional work must remain useful without a managed service or AI.",
    "Essential access control, audit history, vulnerability fixes and portable data belong in Community.",
    "Commercial services use the same core project and evidence records.",
    "Source rights, professional acceptance and deployment acceptance require their own evidence."
  ],
  "editions": [
    {
      "id": "community",
      "name": "Community",
      "audience": "Practitioners, researchers and teams operating their own installation",
      "availability": "Apache-2.0 Community source preview for local evaluation; professional and deployment acceptance remain separate",
      "operation": "User-operated local or supported self-hosted installation",
      "pricing": "Open-source application core; optional services and infrastructure have separate costs"
    },
    {
      "id": "professional",
      "name": "Professional Hosted",
      "audience": "Individual consultants and small consulting teams",
      "availability": "Proposed managed service; an existing hosted application does not establish an accepted subscription or service commitment",
      "operation": "Managed workspaces, updates, backups, configured assistance and support subject to pilot acceptance",
      "pricing": "Scope and usage review before a quote; no public subscription price or AI allowance"
    },
    {
      "id": "enterprise",
      "name": "Enterprise Private Deployment",
      "audience": "Institutions and clients requiring governed infrastructure and integration",
      "availability": "Proposed implementation and support service; deployment-specific security and operational acceptance required",
      "operation": "Dedicated or customer-controlled infrastructure with agreed identity, residency, retention and support scope",
      "pricing": "Deployment, implementation, support and usage scoped individually"
    }
  ],
  "features": [
    {
      "id": "projects",
      "name": "Projects, organizations and financing context",
      "community": "Included",
      "professional": "Same core",
      "enterprise": "Same core; optional institutional integration",
      "implementation": "local",
      "evidence": [
        "server/project-lifecycle-store.mjs",
        "tests/project-lifecycle-http.test.mjs"
      ],
      "limits": "Lifecycle financing workspace is local; hosted lifecycle APIs remain future work."
    },
    {
      "id": "evidence",
      "name": "Versioned documents, citations and evidence custody",
      "community": "Included",
      "professional": "Same core; proposed managed storage",
      "enterprise": "Same core; deployment-specific storage policies",
      "implementation": "local_and_authenticated",
      "evidence": [
        "server/engagement-sources.mjs",
        "server/source-intake.mjs",
        "tests/engagement-retained-source-proof.test.mjs"
      ],
      "limits": "A reference alone does not preserve bytes. Current permissions and source rights govern retrieval, processing and redistribution."
    },
    {
      "id": "requirements",
      "name": "Public standards references and applicable requirements",
      "community": "Included",
      "professional": "Optional maintained specialist packages",
      "enterprise": "Optional institution-specific profiles",
      "implementation": "partial",
      "evidence": [
        "src/lib/framework-register.js",
        "docs/template-readiness-20261023.md"
      ],
      "limits": "Some originals, interpretations and institutional mappings remain unqualified; public availability is not a redistribution licence."
    },
    {
      "id": "manual-assessment",
      "name": "Manual screening, due diligence and monitoring",
      "community": "Included",
      "professional": "Same core",
      "enterprise": "Same core; optional configured governance",
      "implementation": "local_and_authenticated",
      "evidence": [
        "server/engagement-engine.mjs",
        "server/engagement-monitoring.mjs",
        "tests/engagement-complete-browser.mjs"
      ],
      "limits": "Professional conclusions and approval require authorized human review."
    },
    {
      "id": "gap-actions",
      "name": "Gap analysis and corrective-action registers",
      "community": "Included",
      "professional": "Same core",
      "enterprise": "Same core; optional integration",
      "implementation": "local_and_authenticated",
      "evidence": [
        "src/lib/engagement-domain.js",
        "server/engagement-action-reviewer.mjs",
        "tests/engagement-action-reviewer.test.mjs"
      ],
      "limits": "Draft, reviewed finding, verified closure and approved baseline remain distinct."
    },
    {
      "id": "reports",
      "name": "Basic reports, matrices and action-plan exports",
      "community": "Included",
      "professional": "Same core; optional maintained templates",
      "enterprise": "Same core; optional institution-specific templates",
      "implementation": "partial",
      "evidence": [
        "server/engagement-renditions.mjs",
        "server/client-template-studio.mjs",
        "docs/client-template-studio-operations-20261023.md"
      ],
      "limits": "Format availability depends on installed tools; institutional forms require exact originals, rights and mapping review. Hosted native Office/PDF rendering is unavailable."
    },
    {
      "id": "portable-data",
      "name": "Project export, backup and restoration",
      "community": "Included",
      "professional": "Same core; proposed managed recovery service",
      "enterprise": "Same core; agreed retention and recovery objectives",
      "implementation": "local_and_authenticated",
      "evidence": [
        "server/engagement-handover.mjs",
        "server/engagement-successor.mjs",
        "tests/local-professional-workflow.test.mjs"
      ],
      "limits": "Explicit backup and handover are supported; automatic synchronization is unavailable. Exported permission claims do not create new grants."
    },
    {
      "id": "security",
      "name": "Basic access control, audit and security fixes",
      "community": "Included; deployment-appropriate controls",
      "professional": "Same controls plus proposed managed operations",
      "enterprise": "Same controls plus optional enterprise governance",
      "implementation": "local_and_authenticated",
      "evidence": [
        "server/access-service.mjs",
        "server/gateway-handler.mjs",
        "tests/access-api.test.mjs"
      ],
      "limits": "Local accounts partition one computer owner's data and are not separate authenticated users. Remote collaboration requires the authenticated authority path."
    },
    {
      "id": "ai-interfaces",
      "name": "Open interfaces for compatible AI providers",
      "community": "Included; optional user configuration",
      "professional": "Proposed managed routes and allowances",
      "enterprise": "Proposed governed private routes and integrations",
      "implementation": "partial",
      "evidence": [
        "server/es-ai-gateway.mjs",
        "server/es-ai-providers.mjs",
        "src/lib/es-ai-contracts.js"
      ],
      "limits": "No default paid dispatch or fallback. Model accuracy and professional usefulness are not established by structural tests."
    },
    {
      "id": "installation",
      "name": "Local and self-hosted installation",
      "community": "Included within documented deployment profiles",
      "professional": "Proposed managed installation and upgrades",
      "enterprise": "Proposed customer-controlled installation and support",
      "implementation": "local",
      "evidence": [
        "tools/build-local-product.mjs",
        "docs/independent-product-workflow.md"
      ],
      "limits": "Installed manual workflows need no categori.se service. Public source licensing and platform-specific deployment acceptance remain separate gates."
    },
    {
      "id": "managed-operations",
      "name": "Managed storage, backups, updates and technical support",
      "community": "Operator responsibility; core tools included",
      "professional": "Proposed service",
      "enterprise": "Proposed scoped service agreement",
      "implementation": "planned",
      "evidence": [],
      "limits": "No staffed support window, recovery commitment or subscription is promised before an accepted pilot."
    },
    {
      "id": "advanced-orchestration",
      "name": "Advanced AI orchestration and larger processing capacity",
      "community": "Users may extend open interfaces",
      "professional": "Proposed maintained service",
      "enterprise": "Proposed private integration",
      "implementation": "planned",
      "evidence": [],
      "limits": "Capacity requires costed limits, explicit provider permissions, durable usage accounting and acceptance."
    },
    {
      "id": "enterprise-controls",
      "name": "SSO, residency, dedicated processing and enterprise integration",
      "community": "Core authorization and export remain included",
      "professional": "By separately accepted scope",
      "enterprise": "Proposed deployment-specific implementation",
      "implementation": "planned",
      "evidence": [],
      "limits": "Existing Cognito login is not proof of customer SSO integration, a residency commitment or an independently accepted enterprise service."
    }
  ],
  "acceptance": "Software tests establish their stated technical scope. Independent practitioner, security and deployment acceptance remain separate; no certification or regulatory readiness is claimed."
};
