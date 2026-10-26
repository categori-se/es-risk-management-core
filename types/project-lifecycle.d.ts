/**
 * Project lifecycle design contract. Root exchange matches the limited local business ledger.
 * Only LedgerEntities collections are writable. Other domain types are proposed or references
 * to existing authorities; they do not authorize new stores, source access or compliance findings.
 * Generated from schemas/project-lifecycle.schema.json; JSON Schema + semantic checks govern runtime.
 * ID, decimal, date, namespace, digest and relational constraints require runtime validation.
 */

export type ExtensionKey = `${string}:${string}`;

/** Stable opaque application identifier. New entities use UUIDs; retain exact legacy IDs. Never derive identity from name. */
export type ApplicationId = string;

/** Existing real-world identity UUID from project-identities.mjs. */
export type ProjectIdentityId = string;
export type CalendarDate = string;

/** Exact ISO UTC instant with milliseconds; distinguish when an event occurred, when it was assessed, and when it was recorded. */
export type Timestamp = string;
export type Text = string;
export type Sha256 = string;
export type Revision = number;

/** Ledger starts empty at revision zero; entity record revisions and audit sequence start at one. */
export type LedgerRevision = number;

/** Exact nonnegative base-10 value with at most 18 integer and 12 fractional digits, never binary floating point. */
export type Decimal = string;

/** Exact percentage from zero through 100, up to six decimal places. Aggregated percentage constraints require semantic validation. */
export type Percent = string;
export type Attestation = string;
export type SignedDecimal = string;
export type JsonValue = (null | boolean | string | number) | (ReadonlyArray<JsonValue>) | (Readonly<Record<string, JsonValue>>);

/** ISO 4217 code; no implicit exchange-rate conversion. Currency validity and minor units require registry validation. */
export interface Money {
  readonly amount: Decimal;
  readonly currency: string;
}

/** Namespaced institutional identifier or alias. An external identifier does not grant ownership or merge entities. */
export interface ExternalReference {
  readonly namespace: string;
  readonly value: string;
  readonly label?: string;
}

/** Locator into existing project resource/version authority. Verify project/resource/version closure and full-object SHA256 before use. The version remains owned by its existing authority; no file bytes, local paths, signed URLs or grants appear here. */
export interface ExactSourceVersion {
  readonly projectId: ApplicationId;
  readonly resourceId: ApplicationId;
  readonly versionId: ApplicationId;
  readonly sha256: Sha256;
}

/** Existing engagement-owned entity; type is determined by the referring field. A pinned revision may resolve the current row or its retained row.history under current access authority. Historical role/grant origin is not established by that lookup. Exact revisions are required for frozen assessment inputs; source hashes remain in existing evidence authority. */
export interface ExistingRecordReference {
  readonly engagementId: ApplicationId;
  readonly id: ApplicationId;
  readonly revision?: Revision;
}

/** Registered namespace + pinned schema version; validate payload against that registered schema. No executable code, secrets, transport credentials, authority overrides or alternate core relationships. */
export interface ExtensionValue {
  readonly schema: string;
  readonly schemaVersion: Revision;
  readonly value: JsonValue;
}
export type ExtensionMap = Readonly<Partial<Record<ExtensionKey, ExtensionValue>>>;
export interface Provenance {
  readonly kind: "human" | "import" | "extraction" | "ai";
  readonly actorId: ApplicationId;
  readonly at: Timestamp;
  readonly method?: Text;
  readonly model?: string;
  readonly promptSha256?: Sha256;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly reviewStatus: "unreviewed" | "verified" | "rejected";
  readonly reviewedBy?: ApplicationId;
  readonly reviewedAt?: Timestamp;
}

/** Business record metadata for proposed extension records. Existing engagement records retain their existing envelope and are referenced, not rewritten. */
export interface RecordEnvelope {
  readonly id: ApplicationId;
  readonly revision: Revision;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: ApplicationId;
  readonly updatedBy: ApplicationId;
  readonly effectiveFrom?: CalendarDate;
  readonly effectiveTo?: CalendarDate;
  readonly eventAt?: Timestamp;
  readonly recordedAt: Timestamp;
  readonly provenance: Provenance;
  readonly externalReferences: ReadonlyArray<ExternalReference>;
  readonly extensions: ExtensionMap;
}

/** References existing account project and explicit real-world identity link. No project title or parallel project authority. */
export interface ProjectBinding {
  readonly projectId: ApplicationId;
  readonly identityId: ProjectIdentityId;
}

/** Existing account custody UUID. Account selection in local mode is not remote multi-user authentication. */
export interface LedgerContext {
  readonly accountId: ProjectIdentityId;
}
export type LifecyclePhase = "origination" | "screening" | "due_diligence" | "appraisal" | "commitment" | "construction" | "operations" | "restructuring" | "exit" | "post_closure";

/** Physical or functional project component, optionally nested or an associated facility. Associated facilities are explicit relationships, never implicit shared ownership. */
export interface ProjectComponent extends RecordEnvelope {
  readonly projectId: ApplicationId;
  readonly name: string;
  readonly kind: "component" | "associated_facility" | "subcomponent";
  readonly parentComponentId?: ApplicationId;
  readonly associatedProjectId?: ApplicationId;
}

/** Spatially located operational or study area; detailed geometry remains a versioned spatial source. */
export interface Site extends RecordEnvelope {
  readonly projectId: ApplicationId;
  readonly name: string;
  readonly componentIds: ReadonlyArray<ApplicationId>;
  readonly countryCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly geometrySource?: ExactSourceVersion;
}

/** A time-bounded undertaking such as site clearing, construction, operation or decommissioning. Optional sectorProfileId links the existing application sector profile only after manual business verification; it is neither an institutional risk category nor a compliance/applicability conclusion. */
export interface Activity extends RecordEnvelope {
  readonly projectId: ApplicationId;
  readonly name: string;
  readonly kind: string;
  readonly componentId?: ApplicationId;
  readonly siteIds: ReadonlyArray<ApplicationId>;
  readonly sectorProfileId?: ApplicationId;
}

/** Named legal or institutional organization, including financiers, funds, intermediaries, operators and community bodies. Descriptive organization identity grants no account access. */
export interface Organization extends RecordEnvelope {
  readonly name: string;
  readonly kind: "company" | "government" | "dfi" | "bank" | "fund" | "financial_intermediary" | "cso" | "community" | "other";
  readonly legalName?: string;
}

/** Effective-dated business role linking an organization to explicit project, component, investment, facility or agreement scopes. Separate from professional assignment and access grants. */
export interface OrganizationRoleAssignment extends RecordEnvelope {
  readonly organizationId: ApplicationId;
  readonly role: "owner" | "sponsor" | "investor" | "lender" | "borrower" | "operator" | "contractor" | "guarantor" | "advisor" | "regulator" | "intermediary" | "fund_manager" | "other";
  readonly projectId?: ApplicationId;
  readonly componentId?: ApplicationId;
  readonly investmentId?: ApplicationId;
  readonly financialFacilityId?: ApplicationId;
  readonly agreementId?: ApplicationId;
}

/** Investor economic interest that may target an organization, fund or intermediary; allocations independently connect its amount to one or several project/component identities. */
export interface Investment extends RecordEnvelope {
  readonly name: string;
  readonly kind: "direct" | "fund" | "intermediary" | "subinvestment";
  readonly investorOrganizationId: ApplicationId;
  readonly investeeOrganizationId?: ApplicationId;
  readonly parentInvestmentId?: ApplicationId;
  readonly amount?: Money;
  readonly status: "proposed" | "approved" | "committed" | "active" | "exited" | "cancelled";
}

/** Contractual financing envelope distinct from Investment and from individual financial transactions; supports parent facilities and credit lines. */
export interface FinancialFacility extends RecordEnvelope {
  readonly name: string;
  readonly kind: "loan" | "equity" | "guarantee" | "grant" | "credit_line" | "fund_commitment" | "other";
  readonly borrowerOrganizationId: ApplicationId;
  readonly parentFacilityId?: ApplicationId;
  readonly agreementIds: ReadonlyArray<ApplicationId>;
  readonly commitment?: Money;
}

/** One dated financial commitment, flow or reversal; retains original money and currency without silently converting totals. */
export interface Transaction extends RecordEnvelope {
  readonly investmentId: ApplicationId;
  readonly financialFacilityId?: ApplicationId;
  readonly agreementId?: ApplicationId;
  readonly kind: "commitment" | "disbursement" | "repayment" | "equity_subscription" | "distribution" | "guarantee" | "fee" | "cancellation";
  readonly amount: Money;
  readonly transactionDate: CalendarDate;
  readonly status: "proposed" | "approved" | "executed" | "reversed";
}

/** Organization participation in a particular facility, permitting separate lenders and financiers with distinct roles, shares and commitments. */
export interface FinancingParticipant extends RecordEnvelope {
  readonly financialFacilityId: ApplicationId;
  readonly organizationId: ApplicationId;
  readonly role: "lender" | "investor" | "guarantor" | "agent" | "arranger" | "participant";
  readonly commitment?: Money;
  readonly sharePercent?: Percent;
}

/** Normalized many-to-many allocation of an Investment across projects and optionally components. Amount or share is explicit; unallocated balances and currency conversions remain visible. */
export interface InvestmentAllocation extends RecordEnvelope {
  readonly investmentId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly componentId?: ApplicationId;
  readonly amount?: Money;
  readonly sharePercent?: Percent;
}

/** Versioned contract connecting parties, projects and facilities; sourceVersions pin exact retained contract editions and amendments. */
export interface Agreement extends RecordEnvelope {
  readonly name: string;
  readonly kind: "financing" | "engagement" | "concession" | "guarantee" | "grant" | "other";
  readonly organizationIds: ReadonlyArray<ApplicationId>;
  readonly projectIds: ReadonlyArray<ApplicationId>;
  readonly financialFacilityIds: ReadonlyArray<ApplicationId>;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly signedOn?: CalendarDate;
  readonly status: "draft" | "signed" | "effective" | "amended" | "terminated";
}

/** Agreement obligation with its exact source passage and links to existing requirements and monitoring obligations. A covenant record does not make a compliance finding. */
export interface Covenant extends RecordEnvelope {
  readonly agreementId: ApplicationId;
  readonly title: string;
  readonly text: Text;
  readonly projectId?: ApplicationId;
  readonly componentIds: ReadonlyArray<ApplicationId>;
  readonly source?: ExactSourceVersion;
  readonly locator?: Text;
  readonly dueDate?: CalendarDate;
  readonly requirementRefs: ReadonlyArray<ExistingRecordReference>;
  readonly monitoringObligationRefs: ReadonlyArray<ExistingRecordReference>;
}

/** Structured scope overlay for an existing professional Engagement across project parts and periods. Existing mandates, roles and sources remain authoritative. */
export interface EngagementScope extends RecordEnvelope {
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly componentIds: ReadonlyArray<ApplicationId>;
  readonly siteIds: ReadonlyArray<ApplicationId>;
  readonly periodStart?: CalendarDate;
  readonly periodEnd?: CalendarDate;
  readonly description?: Text;
}

/** Explicit professional applicability decision for a pinned existing requirement/framework edition at project, component, financing, agreement and temporal scope. Never inherited through a crosswalk. */
export interface RequirementApplicability extends RecordEnvelope {
  readonly projectId: ApplicationId;
  readonly frameworkEditionId: ApplicationId;
  readonly requirementRef: ExistingRecordReference;
  readonly decision: "applicable" | "not_applicable" | "uncertain";
  readonly rationale: Text;
  readonly componentIds: ReadonlyArray<ApplicationId>;
  readonly investmentId?: ApplicationId;
  readonly financialFacilityId?: ApplicationId;
  readonly agreementId?: ApplicationId;
  readonly assessedAt: Timestamp;
  readonly assessedBy: ApplicationId;
}

/** Lifecycle stage or milestone referencing existing engagement, monitoring cycle, incident/event, action and approved baseline records. Does not copy observations, facts or compliance conclusions. */
export interface LifecycleEvent extends RecordEnvelope {
  readonly projectId: ApplicationId;
  readonly phase: LifecyclePhase;
  readonly status: "planned" | "in_progress" | "completed" | "cancelled";
  readonly title: string;
  readonly engagementId?: ApplicationId;
  readonly cycleId?: ApplicationId;
  readonly eventId?: ApplicationId;
  readonly actionId?: ApplicationId;
  readonly baselineId?: ApplicationId;
  readonly baselineSha256?: Sha256;
}

/** Only these 15 collections are writable in the limited local implementation. Other $defs are proposed design contracts and are not accepted as runtime collections. */
export interface LedgerEntities {
  readonly components: ReadonlyArray<ProjectComponent>;
  readonly sites: ReadonlyArray<Site>;
  readonly activities: ReadonlyArray<Activity>;
  readonly organizations: ReadonlyArray<Organization>;
  readonly roleAssignments: ReadonlyArray<OrganizationRoleAssignment>;
  readonly investments: ReadonlyArray<Investment>;
  readonly financialFacilities: ReadonlyArray<FinancialFacility>;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly financingParticipants: ReadonlyArray<FinancingParticipant>;
  readonly allocations: ReadonlyArray<InvestmentAllocation>;
  readonly agreements: ReadonlyArray<Agreement>;
  readonly covenants: ReadonlyArray<Covenant>;
  readonly engagementScopes: ReadonlyArray<EngagementScope>;
  readonly requirementApplicabilities: ReadonlyArray<RequirementApplicability>;
  readonly lifecycleEvents: ReadonlyArray<LifecycleEvent>;
}

/** Immutable business-context content only. Excludes recursive history, audit and approvals; never an approved E&S assessment or evidence/source access grant. */
export interface LedgerSnapshot {
  readonly context: LedgerContext;
  readonly revision: LedgerRevision;
  readonly projects: ReadonlyArray<ProjectBinding>;
  readonly entities: LedgerEntities;
  readonly extensions: ExtensionMap;
}
export interface LedgerHistoryEntry {
  readonly revision: LedgerRevision;
  readonly sha256: Sha256;
  readonly snapshot: LedgerSnapshot;
  readonly actorId: ApplicationId;
  readonly recordedAt: Timestamp;
}
export interface LedgerApprovalSnapshot {
  readonly id: ApplicationId;
  readonly revision: LedgerRevision;
  readonly sha256: Sha256;
  readonly snapshot: LedgerSnapshot;
  readonly approvedBy: ApplicationId;
  readonly approvedAt: Timestamp;
  readonly statement: Attestation;
}

/** Bounded command summary cryptographically binds the actual resulting ledger snapshot. Does not copy user proposal data or sensitive sources into audit. */
export interface LedgerAuditCommand {
  readonly type: "projects-set" | "upsert" | "verify" | "approve" | "batch";
  readonly collection?: "components" | "sites" | "activities" | "organizations" | "roleAssignments" | "investments" | "financialFacilities" | "transactions" | "financingParticipants" | "allocations" | "agreements" | "covenants" | "engagementScopes" | "requirementApplicabilities" | "lifecycleEvents";
  readonly recordId?: ApplicationId;
  readonly statement?: Attestation;
  readonly resultSha256: Sha256;
}
export interface LedgerAuditEvent {
  readonly id: ApplicationId;
  readonly sequence: Revision;
  readonly revision: Revision;
  readonly command: LedgerAuditCommand;
  readonly actorId: ApplicationId;
  readonly recordedAt: Timestamp;
  readonly previousSha256: (Sha256) | (null);
  readonly sha256: Sha256;
}

/** Additive account-owned business ledger. All projects, engagements, evidence and source versions resolve through existing authorities. JSON Schema verifies shape; runtime must enforce foreign keys, authorization, temporal order, decimal sums, CAS, complete histories, digest identity and graph closure. */
export interface ProjectLifecycleExchange {
  readonly format: "esia-project-lifecycle-exchange";
  readonly schemaVersion: 1;
  readonly context: LedgerContext;
  readonly revision: LedgerRevision;
  readonly projects: ReadonlyArray<ProjectBinding>;
  readonly entities: LedgerEntities;
  readonly history: ReadonlyArray<LedgerHistoryEntry>;
  readonly approvedSnapshots: ReadonlyArray<LedgerApprovalSnapshot>;
  readonly audit: ReadonlyArray<LedgerAuditEvent>;
  readonly extensions: ExtensionMap;
}

/** Adapter-compatible shared ResourceReference; always validate with workspace-contracts assertResourceReference. Descriptive reference only, never a transport or authorization grant. */
export interface AuthorityReference {
  readonly schema_version: 1;
  readonly authority: string;
  readonly resource_id: ApplicationId;
  readonly resource_type: ApplicationId;
  readonly workspace_id: ApplicationId;
  readonly version_id?: string;
}

/** Exact-version shared ResourceReference. Required for frozen source/requirement crosswalk and approved projection inputs. Current authorization remains external. */
export interface ImmutableAuthorityReference {
  readonly schema_version: 1;
  readonly authority: string;
  readonly resource_id: ApplicationId;
  readonly resource_type: ApplicationId;
  readonly workspace_id: ApplicationId;
  readonly version_id: string;
}
export interface DomainScope {
  readonly projectIds: ReadonlyArray<ApplicationId>;
  readonly componentIds: ReadonlyArray<ApplicationId>;
  readonly siteIds: ReadonlyArray<ApplicationId>;
  readonly investmentIds: ReadonlyArray<ApplicationId>;
  readonly financialFacilityIds: ReadonlyArray<ApplicationId>;
  readonly agreementIds: ReadonlyArray<ApplicationId>;
  readonly engagementIds: ReadonlyArray<ApplicationId>;
  readonly periodStart?: CalendarDate;
  readonly periodEnd?: CalendarDate;
}

/** Exact measurement value with explicit UCUM-compatible unit; units, detection limits and conversions are validated in discipline profiles. */
export interface Quantity {
  readonly value: SignedDecimal;
  readonly unit: string;
  readonly unitVocabulary?: string;
}
export interface Confidence {
  readonly level: "unknown" | "low" | "medium" | "high";
  readonly basis: Text;
  readonly limitations: ReadonlyArray<Text>;
}

/** Threshold uses its exact legal, permit or framework source and units. Temporal applicability and comparator bounds require semantic checks. */
export interface Threshold {
  readonly operator: "lt" | "lte" | "gt" | "gte" | "range" | "none";
  readonly value?: SignedDecimal;
  readonly lower?: SignedDecimal;
  readonly upper?: SignedDecimal;
  readonly unit?: string;
  readonly sourceVersion?: ExactSourceVersion;
  readonly locator?: string;
}

/** Exact passage in the existing retained original. OCR/extracted candidates must preserve derivative identity and original-page review in existing extraction binding. Quote hashing does not prove meaning or professional sufficiency. */
export interface SourcePassage {
  readonly sourceVersion: ExactSourceVersion;
  readonly locator: string;
  readonly quote: Text;
  readonly page?: number;
  readonly quoteSha256: Sha256;
  readonly extractionMethod?: string;
  readonly extractionVersion?: string;
  readonly rangeStart?: number;
  readonly rangeEnd?: number;
  readonly originalPageReviewRef?: ExistingRecordReference;
}

/** Projection of the existing real-world Project identity; business references never create a second project authority. */
export interface Project extends RecordEnvelope {
  readonly identityId: ProjectIdentityId;
  readonly reference: AuthorityReference;
  readonly accountProjectBindings: ReadonlyArray<ProjectBinding>;
}

/** Projection reference to existing contractual professional mandate, independent of financing and project identity. */
export interface Engagement extends RecordEnvelope {
  readonly reference: AuthorityReference;
  readonly projectId: ApplicationId;
  readonly scopeIds: ReadonlyArray<ApplicationId>;
  readonly deliverableIds: ReadonlyArray<ApplicationId>;
}

/** Structured expected professional output; implementation initially maps existing engagement mandate deliverables and obligation/publication records. */
export interface Deliverable extends RecordEnvelope {
  readonly engagementRef: AuthorityReference;
  readonly title: string;
  readonly kind: "study" | "assessment" | "plan" | "monitoring_report" | "verification" | "other";
  readonly dueDate?: CalendarDate;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly approvalRefs: ReadonlyArray<ExistingRecordReference>;
  readonly status: "planned" | "draft" | "submitted" | "accepted" | "rejected" | "superseded";
}

/** Uncertain potential adverse environmental or social event or condition; preserve inherent and residual risk separately. */
export interface Risk extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly title: string;
  readonly discipline: ApplicationId;
  readonly cause?: Text;
  readonly consequence?: Text;
  readonly receptorIds: ReadonlyArray<ApplicationId>;
  readonly likelihood: "unknown" | "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
  readonly severity: "unknown" | "minor" | "moderate" | "major" | "critical";
  readonly inherentRating?: string;
  readonly residualRating?: string;
  readonly judgmentIds: ReadonlyArray<ApplicationId>;
  readonly measureIds: ReadonlyArray<ApplicationId>;
}

/** Expected or observed change to a receptor caused by an activity, distinguishing adverse and beneficial impacts. */
export interface Impact extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly activityId: ApplicationId;
  readonly receptorIds: ReadonlyArray<ApplicationId>;
  readonly riskId?: ApplicationId;
  readonly direction: "adverse" | "beneficial" | "mixed" | "unknown";
  readonly nature: "direct" | "indirect" | "cumulative" | "induced";
  readonly duration?: string;
  readonly reversibility?: string;
  readonly magnitude?: Quantity;
  readonly baselineConditionIds: ReadonlyArray<ApplicationId>;
  readonly observationIds: ReadonlyArray<ApplicationId>;
  readonly judgmentIds: ReadonlyArray<ApplicationId>;
}

/** Environmental or social receptor such as habitat, water body, workers, community or cultural asset; do not expose sensitive coordinates in public views. */
export interface Receptor extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly name: string;
  readonly kind: "air" | "water" | "soil" | "habitat" | "species" | "workers" | "community" | "cultural_asset" | "other";
  readonly stakeholderGroupId?: ApplicationId;
  readonly sensitivity: "unknown" | "low" | "medium" | "high" | "critical";
  readonly spatialFeatureRef?: AuthorityReference;
}

/** Affected or interested group with scoped vulnerability characterization; individual identities remain in restricted case storage. */
export interface StakeholderGroup extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly name: string;
  readonly kind: "community" | "workers" | "displaced_persons" | "indigenous_peoples" | "vulnerable_group" | "authority" | "other";
  readonly vulnerabilityFactors: ReadonlyArray<Text>;
  readonly receptorIds: ReadonlyArray<ApplicationId>;
  readonly restrictedRegisterRef?: AuthorityReference;
}

/** Dated, sourced description of a receptor before change; keep season, method and uncertainty explicit. */
export interface BaselineCondition extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly receptorId: ApplicationId;
  readonly indicatorId?: ApplicationId;
  readonly periodStart: CalendarDate;
  readonly periodEnd: CalendarDate;
  readonly value?: Quantity;
  readonly description: Text;
  readonly observationIds: ReadonlyArray<ApplicationId>;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly confidence: Confidence;
}

/** Versioned management instrument linking risks, requirements, measures, responsibilities and resources. */
export interface ManagementPlan extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly title: string;
  readonly kind: string;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly measureIds: ReadonlyArray<ApplicationId>;
  readonly requirementRefs: ReadonlyArray<ExistingRecordReference>;
  readonly ownerOrganizationId: ApplicationId;
  readonly budget?: Money;
  readonly status: "draft" | "approved" | "active" | "superseded" | "closed";
}

/** One mitigation or enhancement measure in the mitigation hierarchy with owner, schedule, budget and verification criteria. */
export interface ManagementMeasure extends RecordEnvelope {
  readonly planId: ApplicationId;
  readonly scope: DomainScope;
  readonly description: Text;
  readonly hierarchy: "avoid" | "minimize" | "restore" | "offset" | "enhance";
  readonly ownerOrganizationId: ApplicationId;
  readonly dueDate?: CalendarDate;
  readonly budget?: Money;
  readonly riskIds: ReadonlyArray<ApplicationId>;
  readonly impactIds: ReadonlyArray<ApplicationId>;
  readonly indicatorIds: ReadonlyArray<ApplicationId>;
  readonly verificationCriteria: Text;
  readonly actionRefs: ReadonlyArray<ExistingRecordReference>;
}

/** Versioned attributable institutional framework or statutory instrument, independent of report-template editions. */
export interface FrameworkEdition extends RecordEnvelope {
  readonly frameworkId: ApplicationId;
  readonly publisherOrganizationId: ApplicationId;
  readonly title: string;
  readonly edition: string;
  readonly publishedOn?: CalendarDate;
  readonly effectiveFrom?: CalendarDate;
  readonly effectiveTo?: CalendarDate;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly supersedesEditionId?: ApplicationId;
  readonly authorityStatus: "authoritative" | "draft" | "superseded" | "withdrawn";
}

/** Attributable requirement or explicitly labeled review prompt; existing retained catalogue definitions remain authoritative for current engagements. */
export interface Requirement extends RecordEnvelope {
  readonly frameworkEditionId: ApplicationId;
  readonly reference: AuthorityReference;
  readonly clause: string;
  readonly title: string;
  readonly text: Text;
  readonly textKind: "authoritative_text" | "review_prompt" | "paraphrase";
  readonly sourcePassages: ReadonlyArray<SourcePassage>;
  readonly parentRequirementId?: ApplicationId;
  readonly topicIds: ReadonlyArray<ApplicationId>;
}

/** Reviewed versioned mapping between exact requirement editions. Relationships describe meaning and never propagate applicability or compliance conclusions. */
export interface RequirementCrosswalk extends RecordEnvelope {
  readonly sourceRequirementRef: ImmutableAuthorityReference;
  readonly targetRequirementRef: ImmutableAuthorityReference;
  readonly relation: "equivalent" | "overlapping" | "broader" | "narrower" | "related" | "conflicting";
  readonly rationale: Text;
  readonly reviewedBy?: ApplicationId;
  readonly reviewedAt?: Timestamp;
  readonly reviewStatus: "draft" | "reviewed" | "rejected";
}

/** Study metadata and scope referencing existing original document editions; field methods and limitations are explicit. */
export interface Study extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly title: string;
  readonly discipline: ApplicationId;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly method: Text;
  readonly limitations: ReadonlyArray<Text>;
  readonly baselineConditionIds: ReadonlyArray<ApplicationId>;
  readonly observationIds: ReadonlyArray<ApplicationId>;
}

/** Reference projection of existing engagement assertion. A source statement and its reliability are separate from the project fact or assessor judgment it may support. */
export interface EvidenceAssertion extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly passage: SourcePassage;
  readonly classification: string;
  readonly reviewStatus: "unreviewed" | "verified" | "rejected";
  readonly supportingClaimIds: ReadonlyArray<ApplicationId>;
  readonly contradictingClaimIds: ReadonlyArray<ApplicationId>;
}

/** Directly recorded dated observation without a professional conclusion; retains original field/measurement evidence and QA state. */
export interface Observation extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly observedAt: Timestamp;
  readonly observerId: ApplicationId;
  readonly method: Text;
  readonly description: Text;
  readonly quantity?: Quantity;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly qaStatus: "unreviewed" | "accepted" | "qualified" | "rejected";
  readonly limitations: ReadonlyArray<Text>;
}

/** Attributable assessor interpretation using explicit evidence, contradictions, rubric and uncertainty. AI proposals cannot sign or establish a conclusion. */
export interface ProfessionalJudgment extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly question: Text;
  readonly rationale: Text;
  readonly assessedAt: Timestamp;
  readonly assessorId: ApplicationId;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly observationIds: ReadonlyArray<ApplicationId>;
  readonly contradictions: ReadonlyArray<Text>;
  readonly confidence: Confidence;
  readonly rubric?: string;
  readonly score?: SignedDecimal;
  readonly scale?: string;
  readonly sourceVersion?: ExactSourceVersion;
  readonly status: "candidate" | "reviewed" | "approved" | "rejected" | "superseded";
}

/** Scoped proposition explicitly established by an authorized human on retained evidence; retains disputed or corrected predecessor without erasure. */
export interface ProjectFact extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly predicate: string;
  readonly value: FactValue;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly observationIds: ReadonlyArray<ApplicationId>;
  readonly judgmentIds: ReadonlyArray<ApplicationId>;
  readonly status: "proposed" | "established" | "disputed" | "superseded";
  readonly establishedBy?: ApplicationId;
  readonly establishedAt?: Timestamp;
  readonly supersedesFactId?: ApplicationId;
  readonly basis: Text;
}

/** Typed environmental or social indicator definition. Thresholds and outcome targets retain source and period; cross-project aggregation requires comparable units and denominators. */
export interface Indicator extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly name: string;
  readonly discipline: ApplicationId;
  readonly unit: string;
  readonly method: Text;
  readonly frequency: string;
  readonly threshold?: Threshold;
  readonly disaggregationDimensions: ReadonlyArray<Text>;
  readonly denominatorDefinition?: Text;
  readonly existingIndicatorRef?: ExistingRecordReference;
}

/** Dated site and period value for an indicator with sampling method, worker class, uncertainty, QA and exact source evidence. */
export interface IndicatorMeasurement extends RecordEnvelope {
  readonly indicatorId: ApplicationId;
  readonly siteId?: ApplicationId;
  readonly periodStart: CalendarDate;
  readonly periodEnd: CalendarDate;
  readonly observedAt: Timestamp;
  readonly value: SignedDecimal;
  readonly unit: string;
  readonly workerClass: "direct" | "contracted" | "primary_supply" | "community" | "not_applicable";
  readonly denominator?: Quantity;
  readonly sampleSize?: number;
  readonly detectionLimit?: Quantity;
  readonly observationId?: ApplicationId;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly qaStatus: "unreviewed" | "accepted" | "qualified" | "rejected";
  readonly existingMeasurementRef?: ExistingRecordReference;
}

/** Measured social result against a specified baseline and affected group, without inferring causality from a trend. */
export interface SocialOutcome extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly stakeholderGroupId: ApplicationId;
  readonly baselineConditionId: ApplicationId;
  readonly indicatorId: ApplicationId;
  readonly measurementIds: ReadonlyArray<ApplicationId>;
  readonly assessedAt: Timestamp;
  readonly judgmentId?: ApplicationId;
  readonly attributionLimitations: ReadonlyArray<Text>;
}

/** Restricted case metadata with receipt, acknowledgment, response, appeal and closure; individual content is held by existing restricted case authority. */
export interface Grievance extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly existingEventRef: ExistingRecordReference;
  readonly receivedAt: Timestamp;
  readonly acknowledgedAt?: Timestamp;
  readonly respondedAt?: Timestamp;
  readonly closedAt?: Timestamp;
  readonly category: string;
  readonly status: "received" | "acknowledged" | "investigating" | "responded" | "appealed" | "closed" | "reopened";
  readonly restrictedCaseRef: AuthorityReference;
  readonly actionRefs: ReadonlyArray<ExistingRecordReference>;
}

/** Notice sent to a specifically identified recipient under a sourced reporting obligation; timestamps do not infer that another recipient was notified. */
export interface IncidentNotification extends RecordEnvelope {
  readonly recipientOrganizationId: ApplicationId;
  readonly awarenessAt?: Timestamp;
  readonly notifiedAt?: Timestamp;
  readonly dueAt?: Timestamp;
  readonly requirementRef?: AuthorityReference;
  readonly sourceVersion?: ExactSourceVersion;
  readonly status: "pending" | "sent" | "acknowledged" | "late" | "not_required";
}

/** Existing restricted E&S event with occurrence, awareness and per-recipient notification times; redacted public metadata never expose victims or sensitive geometry. */
export interface Incident extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly existingEventRef: ExistingRecordReference;
  readonly occurredAt: Timestamp;
  readonly awarenessAt: Timestamp;
  readonly notifications: ReadonlyArray<IncidentNotification>;
  readonly severity: "unknown" | "minor" | "moderate" | "major" | "fatal";
  readonly category: string;
  readonly restrictedCaseRef: AuthorityReference;
  readonly actionRefs: ReadonlyArray<ExistingRecordReference>;
}

/** Repeated or overlapping professional evaluation over an explicit scope and period with pinned requirement editions, sources and immutable approved baseline. */
export interface Assessment extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly engagementRef: AuthorityReference;
  readonly kind: "screening" | "due_diligence" | "appraisal" | "monitoring" | "verification" | "closure" | "post_closure";
  readonly assessmentDate: CalendarDate;
  readonly findingRefs: ReadonlyArray<ExistingRecordReference>;
  readonly requirementRefs: ReadonlyArray<AuthorityReference>;
  readonly sourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly baselineRef?: AuthorityReference;
  readonly baselineSha256?: Sha256;
  readonly supersedesAssessmentId?: ApplicationId;
}

/** Projection reference of existing engagement finding; applicability, evidence coverage, adequacy and performance remain distinct judgments. */
export interface AssessmentFinding extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly requirementRef: AuthorityReference;
  readonly applicability: "applicable" | "not_applicable" | "uncertain";
  readonly coverage: "complete" | "partial" | "missing" | "not_determined";
  readonly adequacy: "adequate" | "deficient" | "insufficient_evidence";
  readonly performance: "compliant" | "partially_compliant" | "noncompliant" | "undetermined" | "not_assessed";
  readonly supportingAssertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly contradictoryAssertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly judgmentId?: ApplicationId;
}

/** Projection/extension of existing action with responsible organization, linked deficiencies, deadlines, budget, dependencies and evidence-based verification. */
export interface CorrectiveAction extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly scope: DomainScope;
  readonly description: Text;
  readonly ownerOrganizationId: ApplicationId;
  readonly findingRefs: ReadonlyArray<ExistingRecordReference>;
  readonly commitmentIds: ReadonlyArray<ApplicationId>;
  readonly dueDate?: CalendarDate;
  readonly budget?: Money;
  readonly dependencyActionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly verificationCriteria: Text;
  readonly verificationRefs: ReadonlyArray<ExistingRecordReference>;
  readonly status: "open" | "in_progress" | "overdue" | "verified" | "closed" | "reopened" | "superseded";
}

/** Project promise arising from a plan, consultation or contract, independently tracked from the corrective action used to deliver it. */
export interface Commitment extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly description: Text;
  readonly ownerOrganizationId: ApplicationId;
  readonly sourcePassages: ReadonlyArray<SourcePassage>;
  readonly agreementId?: ApplicationId;
  readonly covenantId?: ApplicationId;
  readonly dueDate?: CalendarDate;
  readonly actionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly indicatorIds: ReadonlyArray<ApplicationId>;
  readonly status: "proposed" | "confirmed" | "active" | "fulfilled" | "waived" | "superseded";
}

/** Projection reference of existing independent verification against explicit criteria, retained closure evidence and authorized reviewer. */
export interface Verification extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly scope: DomainScope;
  readonly targetRef: AuthorityReference;
  readonly verifiedAt: Timestamp;
  readonly verifierId: ApplicationId;
  readonly criteria: Text;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly outcome: "not_verified" | "partly_verified" | "verified" | "inconclusive";
  readonly limitations: ReadonlyArray<Text>;
}

/** Existing authorized professional process decision tied to a fixed content revision/hash. Business-context approval is separately typed and does not imply assessment approval. */
export interface Approval extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly targetRef: AuthorityReference;
  readonly contentRevision: Revision;
  readonly contentSha256: Sha256;
  readonly decision: "approved" | "rejected" | "withdrawn";
  readonly actorId: ApplicationId;
  readonly decidedAt: Timestamp;
  readonly authorityBasis: Text;
  readonly statement: Text;
}

/** Existing monitoring program reusing its approved assessment baseline, requirements, indicators, actions and obligations. */
export interface MonitoringProgram extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly scope: DomainScope;
  readonly baselineRef: AuthorityReference;
  readonly baselineSha256: Sha256;
  readonly cycleRefs: ReadonlyArray<ExistingRecordReference>;
  readonly indicatorIds: ReadonlyArray<ApplicationId>;
  readonly obligationRefs: ReadonlyArray<ExistingRecordReference>;
}

/** Existing periodic supervision cycle; cycles can overlap but remain independently reviewed against exact periods and baseline snapshots. */
export interface MonitoringCycle extends RecordEnvelope {
  readonly reference: ExistingRecordReference;
  readonly programRef: ExistingRecordReference;
  readonly periodStart: CalendarDate;
  readonly periodEnd: CalendarDate;
  readonly dueDate?: CalendarDate;
  readonly submissionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly findingRefs: ReadonlyArray<ExistingRecordReference>;
  readonly baselineRef?: AuthorityReference;
}

/** Issued existing publication rendition or proposed template view of exact baseline content; rendering never becomes a second record authority. */
export interface Report extends RecordEnvelope {
  readonly publicationRef: ExistingRecordReference;
  readonly baselineRef: AuthorityReference;
  readonly baselineSha256: Sha256;
  readonly templateId: ApplicationId;
  readonly templateVersion: string;
  readonly renditionSource?: ExactSourceVersion;
  readonly mappingVersion: string;
  readonly unmappedFields: ReadonlyArray<Text>;
  readonly generatedAt: Timestamp;
}

/** Dated meaningful engagement and disclosure event retaining accessibility, SEP deviations, feedback and responses without publishing personal identities. */
export interface ConsultationEvent extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly occurredOn: CalendarDate;
  readonly methods: ReadonlyArray<Text>;
  readonly languages: ReadonlyArray<Text>;
  readonly stakeholderGroupIds: ReadonlyArray<ApplicationId>;
  readonly disclosedSourceVersions: ReadonlyArray<ExactSourceVersion>;
  readonly disclosureLocations: ReadonlyArray<Text>;
  readonly leadDays?: number;
  readonly sepDeviation: boolean;
  readonly deviationRationale?: Text;
  readonly feedback: Text;
  readonly response: Text;
  readonly commitmentIds: ReadonlyArray<ApplicationId>;
  readonly restrictedParticipantRegisterRef?: AuthorityReference;
}

/** Dated original-currency intermediary/fund exposure by product and sector, retaining estimated status and denominator before aggregation. */
export interface PortfolioExposure extends RecordEnvelope {
  readonly investmentId: ApplicationId;
  readonly product: string;
  readonly sector: ApplicationId;
  readonly amount: Money;
  readonly asOf: CalendarDate;
  readonly estimated: boolean;
  readonly denominator: Money;
  readonly riskCategory?: string;
  readonly screeningAssessmentRef?: AuthorityReference;
  readonly exclusionDecision: "not_screened" | "permitted" | "excluded" | "conditional" | "uncertain";
}

/** Eligibility and benefit owed under an exact approved resettlement/compensation instrument; personal roster stays restricted. */
export interface Entitlement extends RecordEnvelope {
  readonly scope: DomainScope;
  readonly stakeholderGroupId: ApplicationId;
  readonly planId: ApplicationId;
  readonly eligibilityBasis: Text;
  readonly benefitDescription: Text;
  readonly amount?: Money;
  readonly sourcePassage: SourcePassage;
  readonly restrictedBeneficiaryRef: AuthorityReference;
}

/** Scheduled and actual entitlement delivery with retained evidence and human verification; payment does not establish livelihood restoration. */
export interface EntitlementDelivery extends RecordEnvelope {
  readonly entitlementId: ApplicationId;
  readonly scheduledOn: CalendarDate;
  readonly deliveredOn?: CalendarDate;
  readonly amount?: Money;
  readonly assertionRefs: ReadonlyArray<ExistingRecordReference>;
  readonly verifiedBy?: ApplicationId;
  readonly verifiedAt?: Timestamp;
  readonly status: "scheduled" | "partial" | "delivered" | "disputed" | "verified";
}

/** Longitudinal livelihood result relative to baseline with subgroup disaggregation and attribution limitations. */
export interface LivelihoodOutcome extends RecordEnvelope {
  readonly stakeholderGroupId: ApplicationId;
  readonly baselineConditionId: ApplicationId;
  readonly indicatorId: ApplicationId;
  readonly measurementIds: ReadonlyArray<ApplicationId>;
  readonly assessedAt: Timestamp;
  readonly judgmentId?: ApplicationId;
  readonly attributionLimitations: ReadonlyArray<Text>;
}

/** Atomic typed fact value; scoped relationships remain explicit references/fields rather than arbitrary nested project graphs. Unknown values remain null with explicit status/basis. */
export type FactValue = (string | boolean | null) | (Quantity) | (Money) | (AuthorityReference);
export type LifecycleCollection = "components" | "sites" | "activities" | "organizations" | "roleAssignments" | "investments" | "financialFacilities" | "transactions" | "financingParticipants" | "allocations" | "agreements" | "covenants" | "engagementScopes" | "requirementApplicabilities" | "lifecycleEvents";

/** Proposal provenance only. Actor/time/review status and reviewer fields are server owned and forbidden in command inputs. */
export interface ProvenanceInput {
  readonly kind?: "human" | "import" | "extraction" | "ai";
  readonly method?: Text;
  readonly model?: string;
  readonly promptSha256?: Sha256;
  readonly sourceVersions?: ReadonlyArray<ExactSourceVersion>;
}
export interface ProposalEnvelope {
  readonly id?: ApplicationId;
  readonly effectiveFrom?: CalendarDate;
  readonly effectiveTo?: CalendarDate;
  readonly eventAt?: Timestamp;
  readonly provenance?: ProvenanceInput;
  readonly externalReferences?: ReadonlyArray<ExternalReference>;
  readonly extensions?: ExtensionMap;
}

/** Writable input for ProjectComponent. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type ProjectComponentProposal = (ProposalEnvelope) & ({ readonly projectId: ApplicationId; readonly name: string; readonly kind: "component" | "associated_facility" | "subcomponent"; readonly parentComponentId?: ApplicationId; readonly associatedProjectId?: ApplicationId });

/** Writable input for Site. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type SiteProposal = (ProposalEnvelope) & ({ readonly projectId: ApplicationId; readonly name: string; readonly componentIds: ReadonlyArray<ApplicationId>; readonly countryCode?: string; readonly latitude?: number; readonly longitude?: number; readonly geometrySource?: ExactSourceVersion }) & (unknown);

/** Writable input for Activity. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type ActivityProposal = (ProposalEnvelope) & ({ readonly projectId: ApplicationId; readonly name: string; readonly kind: string; readonly componentId?: ApplicationId; readonly siteIds: ReadonlyArray<ApplicationId>; readonly sectorProfileId?: ApplicationId });

/** Writable input for Organization. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type OrganizationProposal = (ProposalEnvelope) & ({ readonly name: string; readonly kind: "company" | "government" | "dfi" | "bank" | "fund" | "financial_intermediary" | "cso" | "community" | "other"; readonly legalName?: string });

/** Writable input for OrganizationRoleAssignment. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type OrganizationRoleAssignmentProposal = (ProposalEnvelope) & ({ readonly organizationId: ApplicationId; readonly role: "owner" | "sponsor" | "investor" | "lender" | "borrower" | "operator" | "contractor" | "guarantor" | "advisor" | "regulator" | "intermediary" | "fund_manager" | "other"; readonly projectId?: ApplicationId; readonly componentId?: ApplicationId; readonly investmentId?: ApplicationId; readonly financialFacilityId?: ApplicationId; readonly agreementId?: ApplicationId }) & ((unknown) | (unknown) | (unknown) | (unknown) | (unknown));

/** Writable input for Investment. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type InvestmentProposal = (ProposalEnvelope) & ({ readonly name: string; readonly kind: "direct" | "fund" | "intermediary" | "subinvestment"; readonly investorOrganizationId: ApplicationId; readonly investeeOrganizationId?: ApplicationId; readonly parentInvestmentId?: ApplicationId; readonly amount?: Money; readonly status: "proposed" | "approved" | "committed" | "active" | "exited" | "cancelled" });

/** Writable input for FinancialFacility. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type FinancialFacilityProposal = (ProposalEnvelope) & ({ readonly name: string; readonly kind: "loan" | "equity" | "guarantee" | "grant" | "credit_line" | "fund_commitment" | "other"; readonly borrowerOrganizationId: ApplicationId; readonly parentFacilityId?: ApplicationId; readonly agreementIds: ReadonlyArray<ApplicationId>; readonly commitment?: Money });

/** Writable input for Transaction. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type TransactionProposal = (ProposalEnvelope) & ({ readonly investmentId: ApplicationId; readonly financialFacilityId?: ApplicationId; readonly agreementId?: ApplicationId; readonly kind: "commitment" | "disbursement" | "repayment" | "equity_subscription" | "distribution" | "guarantee" | "fee" | "cancellation"; readonly amount: Money; readonly transactionDate: CalendarDate; readonly status: "proposed" | "approved" | "executed" | "reversed" });

/** Writable input for FinancingParticipant. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type FinancingParticipantProposal = (ProposalEnvelope) & ({ readonly financialFacilityId: ApplicationId; readonly organizationId: ApplicationId; readonly role: "lender" | "investor" | "guarantor" | "agent" | "arranger" | "participant"; readonly commitment?: Money; readonly sharePercent?: Percent });

/** Writable input for InvestmentAllocation. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type InvestmentAllocationProposal = (ProposalEnvelope) & ({ readonly investmentId: ApplicationId; readonly projectId: ApplicationId; readonly componentId?: ApplicationId; readonly amount?: Money; readonly sharePercent?: Percent }) & ((unknown) | (unknown));

/** Writable input for Agreement. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type AgreementProposal = (ProposalEnvelope) & ({ readonly name: string; readonly kind: "financing" | "engagement" | "concession" | "guarantee" | "grant" | "other"; readonly organizationIds: ReadonlyArray<ApplicationId>; readonly projectIds: ReadonlyArray<ApplicationId>; readonly financialFacilityIds: ReadonlyArray<ApplicationId>; readonly sourceVersions: ReadonlyArray<ExactSourceVersion>; readonly signedOn?: CalendarDate; readonly status: "draft" | "signed" | "effective" | "amended" | "terminated" });

/** Writable input for Covenant. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type CovenantProposal = (ProposalEnvelope) & ({ readonly agreementId: ApplicationId; readonly title: string; readonly text: Text; readonly projectId?: ApplicationId; readonly componentIds: ReadonlyArray<ApplicationId>; readonly source?: ExactSourceVersion; readonly locator?: Text; readonly dueDate?: CalendarDate; readonly requirementRefs: ReadonlyArray<ExistingRecordReference>; readonly monitoringObligationRefs: ReadonlyArray<ExistingRecordReference> }) & (unknown);

/** Writable input for EngagementScope. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type EngagementScopeProposal = (ProposalEnvelope) & ({ readonly engagementId: ApplicationId; readonly projectId: ApplicationId; readonly componentIds: ReadonlyArray<ApplicationId>; readonly siteIds: ReadonlyArray<ApplicationId>; readonly periodStart?: CalendarDate; readonly periodEnd?: CalendarDate; readonly description?: Text });

/** Writable input for RequirementApplicability. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type RequirementApplicabilityProposal = (ProposalEnvelope) & ({ readonly projectId: ApplicationId; readonly frameworkEditionId: ApplicationId; readonly requirementRef: ExistingRecordReference; readonly decision: "applicable" | "not_applicable" | "uncertain"; readonly rationale: Text; readonly componentIds: ReadonlyArray<ApplicationId>; readonly investmentId?: ApplicationId; readonly financialFacilityId?: ApplicationId; readonly agreementId?: ApplicationId; readonly assessedAt: Timestamp; readonly assessedBy: ApplicationId });

/** Writable input for LifecycleEvent. Server assigns revision, actor/time and unreviewed provenance; supplied ID updates only an existing same-collection record or creates an explicit stable ID. */
export type LifecycleEventProposal = (ProposalEnvelope) & ({ readonly projectId: ApplicationId; readonly phase: LifecyclePhase; readonly status: "planned" | "in_progress" | "completed" | "cancelled"; readonly title: string; readonly engagementId?: ApplicationId; readonly cycleId?: ApplicationId; readonly eventId?: ApplicationId; readonly actionId?: ApplicationId; readonly baselineId?: ApplicationId; readonly baselineSha256?: Sha256 }) & (unknown);
export type UpsertCommand = ({ readonly type: "upsert"; readonly collection: "components"; readonly records: ReadonlyArray<ProjectComponentProposal> }) | ({ readonly type: "upsert"; readonly collection: "sites"; readonly records: ReadonlyArray<SiteProposal> }) | ({ readonly type: "upsert"; readonly collection: "activities"; readonly records: ReadonlyArray<ActivityProposal> }) | ({ readonly type: "upsert"; readonly collection: "organizations"; readonly records: ReadonlyArray<OrganizationProposal> }) | ({ readonly type: "upsert"; readonly collection: "roleAssignments"; readonly records: ReadonlyArray<OrganizationRoleAssignmentProposal> }) | ({ readonly type: "upsert"; readonly collection: "investments"; readonly records: ReadonlyArray<InvestmentProposal> }) | ({ readonly type: "upsert"; readonly collection: "financialFacilities"; readonly records: ReadonlyArray<FinancialFacilityProposal> }) | ({ readonly type: "upsert"; readonly collection: "transactions"; readonly records: ReadonlyArray<TransactionProposal> }) | ({ readonly type: "upsert"; readonly collection: "financingParticipants"; readonly records: ReadonlyArray<FinancingParticipantProposal> }) | ({ readonly type: "upsert"; readonly collection: "allocations"; readonly records: ReadonlyArray<InvestmentAllocationProposal> }) | ({ readonly type: "upsert"; readonly collection: "agreements"; readonly records: ReadonlyArray<AgreementProposal> }) | ({ readonly type: "upsert"; readonly collection: "covenants"; readonly records: ReadonlyArray<CovenantProposal> }) | ({ readonly type: "upsert"; readonly collection: "engagementScopes"; readonly records: ReadonlyArray<EngagementScopeProposal> }) | ({ readonly type: "upsert"; readonly collection: "requirementApplicabilities"; readonly records: ReadonlyArray<RequirementApplicabilityProposal> }) | ({ readonly type: "upsert"; readonly collection: "lifecycleEvents"; readonly records: ReadonlyArray<LifecycleEventProposal> });
export interface ProjectSelectionCommand {
  readonly type: "projects-set";
  readonly projects: ReadonlyArray<ProjectBinding>;
}
export interface VerifyCommand {
  readonly type: "verify";
  readonly collection: LifecycleCollection;
  readonly id: ApplicationId;
  readonly statement: Attestation;
}
export interface ApproveCommand {
  readonly type: "approve";
  readonly statement: Attestation;
}

/** Only project selection and proposal upserts may be batched. Verification and business approval are separate explicit human decisions. */
export interface BatchCommand {
  readonly type: "batch";
  readonly commands: ReadonlyArray<(ProjectSelectionCommand) | (UpsertCommand)>;
}
export type LifecycleCommand = (ProjectSelectionCommand) | (UpsertCommand) | (VerifyCommand) | (ApproveCommand) | (BatchCommand);

/** Implemented trusted-local command envelope. actorId is local attribution, not an authenticated remote principal. CAS expectedRevision must equal current ledger revision. */
export interface LifecycleCommandRequest {
  readonly expectedRevision: LedgerRevision;
  readonly actorId: ApplicationId;
  readonly command: LifecycleCommand;
}

/** Implemented local restore. Only an empty same-account ledger or exact replay is accepted; divergent retained histories are not silently merged. Imported verification does not create this installation's local verification receipt. */
export interface LifecycleImportRequest {
  readonly expectedRevision: LedgerRevision;
  readonly actorId: ApplicationId;
  readonly exchange: ProjectLifecycleExchange;
}

/** Bounded original-currency leaf allocations; parent/intermediary and child exposure are not added twice. This is not the total legal commitment, a net asset value or a native institutional report. */
export interface PortfolioView {
  readonly investmentId: (ApplicationId) | (null);
  readonly leafInvestmentIds: ReadonlyArray<ApplicationId>;
  readonly projectIds: ReadonlyArray<ApplicationId>;
  readonly allocationIds: ReadonlyArray<ApplicationId>;
  readonly amounts: ReadonlyArray<Money>;
  readonly unpricedAllocationIds: ReadonlyArray<ApplicationId>;
  readonly meaning: Text;
  readonly asOf: CalendarDate;
}
export interface BusinessApprovalSummary {
  readonly id: ApplicationId;
  readonly approvedBy: ApplicationId;
  readonly approvedAt: Timestamp;
}

/** Implemented bounded report projection. asOf selects financial allocation effective date only; assessment context explicitly pins a retained approved baseline or current working review, with separate projection/dataset hashes. It does not reconstruct all past knowledge. Institutional output is a partial minimized field exchange, not a completed native template, professional acceptance or compliance conclusion. Exact current source references include provenance, agreement, covenant and geometry pins; source bytes remain in existing authority. */
export interface LifecycleReport {
  readonly format: "esia-project-lifecycle-report";
  readonly schemaVersion: 1;
  readonly view: "canonical" | "ifc" | "world_bank" | "adb" | "ebrd" | "eib" | "fmo";
  readonly revision: LedgerRevision;
  readonly accountId: ProjectIdentityId;
  readonly snapshotSha256: Sha256;
  readonly approval: (BusinessApprovalSummary) | (null);
  readonly projects: ReadonlyArray<ProjectBinding>;
  readonly portfolio: PortfolioView;
  readonly lifecycle: ReadonlyArray<LifecycleEvent>;
  readonly applicability: ReadonlyArray<RequirementApplicability>;
  readonly sourceVersionReferences: ReadonlyArray<ExactSourceVersion>;
  readonly notices: ReadonlyArray<Text>;
  readonly asOf: CalendarDate;
  readonly datasetSha256: Sha256;
  readonly temporalScope: ReportTemporalScope;
  readonly assessmentContexts: ReadonlyArray<AssessmentContextProjection>;
  readonly institutionView: InstitutionFieldExchange;
}

/** Installation-local import receipt stored separately from the imported ledger and existing assessment approval history. */
export interface RestoreReceipt {
  readonly id: ApplicationId;
  readonly actorId: ApplicationId;
  readonly recordedAt: Timestamp;
  readonly exchangeSha256: Sha256;
}
export interface LocalError {
  readonly error: Text;
}

/** PROPOSED only: optional future after-commit event/outbox contract. No event transport, hosted worker, queue consumer or recurring schedule is enabled. */
export interface LifecycleDomainEvent {
  readonly eventId: ApplicationId;
  readonly eventType: "lifecycle.record.created" | "lifecycle.record.revised" | "lifecycle.record.verified" | "lifecycle.context.approved" | "lifecycle.exchange.imported" | "lifecycle.authority_reference.invalidated";
  readonly eventSchemaVersion: 1;
  readonly accountRef: AuthorityReference;
  readonly projectRefs: ReadonlyArray<AuthorityReference>;
  readonly aggregateId: ApplicationId;
  readonly aggregateRevision: LedgerRevision;
  readonly occurredAt: Timestamp;
  readonly recordedAt: Timestamp;
  readonly actorRef: AuthorityReference;
  readonly correlationId: ApplicationId;
  readonly causationId?: ApplicationId;
  readonly changedEntityRefs: ReadonlyArray<AuthorityReference>;
  readonly contentSha256: Sha256;
}

/** Existing-authority read projection text, allowing an explicitly retained empty legacy value. Never interpreted as executable content. */
export type ProjectionText = string;
export type NonnegativeInteger = number;
export type ScalarProjectionValue = string | number | boolean;

/** asOf filters financial allocation validity only. Assessment input is an explicitly retained baseline or current working review; no full historical knowledge or bitemporal reconstruction is claimed. */
export interface ReportTemporalScope {
  readonly allocationEffectiveDate: CalendarDate;
  readonly assessmentSelection: "explicit_retained_baseline_or_current_review";
  readonly historicalKnowledgeReconstruction: false;
}
export interface AssessmentPeriodProjection {
  readonly id: ApplicationId;
  readonly programId: ApplicationId;
  readonly periodStart: CalendarDate;
  readonly periodEnd: CalendarDate;
}
export interface HistoricalRecordIdProjection {
  readonly cycles: ReadonlyArray<ApplicationId>;
  readonly findings: ReadonlyArray<ApplicationId>;
  readonly measurements: ReadonlyArray<ApplicationId>;
  readonly actions: ReadonlyArray<ApplicationId>;
  readonly events: ReadonlyArray<ApplicationId>;
}
export interface HistoricalCountProjection {
  readonly cycles: NonnegativeInteger;
  readonly findings: NonnegativeInteger;
  readonly measurements: NonnegativeInteger;
  readonly actions: NonnegativeInteger;
  readonly events: NonnegativeInteger;
}

/** Exact source baseline is verified before authorized disclosure/period filtering. projectionSha256 identifies the resulting projection and is never relabeled as the original approved baseline hash. */
export interface AssessmentContextProjection {
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly mode: "approved_baseline" | "working_review";
  readonly approvalStatus: "approved_source_projection" | "current_unapproved";
  readonly baselineId?: ApplicationId;
  readonly baselineSha256?: Sha256;
  readonly revision?: Revision;
  readonly selectedCycleId: (ApplicationId) | (null);
  readonly selectedCycleIds: ReadonlyArray<ApplicationId>;
  readonly programIds: ReadonlyArray<ApplicationId>;
  readonly periods: ReadonlyArray<AssessmentPeriodProjection>;
  readonly selection: ProjectionText;
  readonly historicalRecordIds: HistoricalRecordIdProjection;
  readonly historicalCounts: HistoricalCountProjection;
  readonly projectionSha256: Sha256;
}
export interface InstitutionProjectProjection {
  readonly entity: "Project";
  readonly id: ApplicationId;
  readonly identityId: ProjectIdentityId;
  readonly name?: ProjectionText;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionProjectComponentProjection {
  readonly entity: "ProjectComponent";
  readonly id: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly name?: string;
  readonly kind?: "component" | "associated_facility" | "subcomponent";
  readonly parentComponentId?: ApplicationId;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionSiteProjection {
  readonly entity: "Site";
  readonly id: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly name?: string;
  readonly countryCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionActivityProjection {
  readonly entity: "Activity";
  readonly id: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly name?: string;
  readonly kind?: string;
  readonly componentId?: ApplicationId;
  readonly sectorProfileId?: ApplicationId;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionOrganizationProjection {
  readonly entity: "Organization";
  readonly id: ApplicationId;
  readonly name?: string;
  readonly kind?: "company" | "government" | "dfi" | "bank" | "fund" | "financial_intermediary" | "cso" | "community" | "other";
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionOrganizationRoleAssignmentProjection {
  readonly entity: "OrganizationRoleAssignment";
  readonly id: ApplicationId;
  readonly organizationId?: ApplicationId;
  readonly role?: "owner" | "sponsor" | "investor" | "lender" | "borrower" | "operator" | "contractor" | "guarantor" | "advisor" | "regulator" | "intermediary" | "fund_manager" | "other";
  readonly projectId?: ApplicationId;
  readonly componentId?: ApplicationId;
  readonly investmentId?: ApplicationId;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionLifecycleEventProjection {
  readonly entity: "LifecycleEvent";
  readonly id: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly phase?: LifecyclePhase;
  readonly status?: "planned" | "in_progress" | "completed" | "cancelled";
  readonly title?: string;
  readonly eventAt?: Timestamp;
  readonly engagementId?: ApplicationId;
  readonly cycleId?: ApplicationId;
  readonly eventId?: ApplicationId;
  readonly actionId?: ApplicationId;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionEngagementScopeProjection {
  readonly entity: "EngagementScope";
  readonly id: ApplicationId;
  readonly engagementId?: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly periodStart?: CalendarDate;
  readonly periodEnd?: CalendarDate;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionRequirementApplicabilityProjection {
  readonly entity: "RequirementApplicability";
  readonly id: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly frameworkEditionId?: ApplicationId;
  readonly decision?: "applicable" | "not_applicable" | "uncertain";
  readonly assessedAt?: Timestamp;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionAgreementProjection {
  readonly entity: "Agreement";
  readonly id: ApplicationId;
  readonly name?: string;
  readonly kind?: "financing" | "engagement" | "concession" | "guarantee" | "grant" | "other";
  readonly status?: "draft" | "signed" | "effective" | "amended" | "terminated";
  readonly signedOn?: CalendarDate;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionCovenantProjection {
  readonly entity: "Covenant";
  readonly id: ApplicationId;
  readonly agreementId?: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly title?: string;
  readonly dueDate?: CalendarDate;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionInvestmentProjection {
  readonly entity: "Investment";
  readonly id: ApplicationId;
  readonly name?: string;
  readonly kind?: "direct" | "fund" | "intermediary" | "subinvestment";
  readonly status?: "proposed" | "approved" | "committed" | "active" | "exited" | "cancelled";
  readonly parentInvestmentId?: ApplicationId;
  readonly amount?: Money;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionFinancialFacilityProjection {
  readonly entity: "FinancialFacility";
  readonly id: ApplicationId;
  readonly name?: string;
  readonly kind?: "loan" | "equity" | "guarantee" | "grant" | "credit_line" | "fund_commitment" | "other";
  readonly borrowerOrganizationId?: ApplicationId;
  readonly commitment?: Money;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionTransactionProjection {
  readonly entity: "Transaction";
  readonly id: ApplicationId;
  readonly investmentId?: ApplicationId;
  readonly kind?: "commitment" | "disbursement" | "repayment" | "equity_subscription" | "distribution" | "guarantee" | "fee" | "cancellation";
  readonly transactionDate?: CalendarDate;
  readonly status?: "proposed" | "approved" | "executed" | "reversed";
  readonly amount?: Money;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionFinancingParticipantProjection {
  readonly entity: "FinancingParticipant";
  readonly id: ApplicationId;
  readonly financialFacilityId?: ApplicationId;
  readonly organizationId?: ApplicationId;
  readonly role?: "lender" | "investor" | "guarantor" | "agent" | "arranger" | "participant";
  readonly commitment?: Money;
}

/** Whitelisted business-context projection; absent fields are not inferred. */
export interface InstitutionInvestmentAllocationProjection {
  readonly entity: "InvestmentAllocation";
  readonly id: ApplicationId;
  readonly investmentId?: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly componentId?: ApplicationId;
  readonly amount?: Money;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionMonitoringCycleProjection {
  readonly entity: "MonitoringCycle";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly programId?: ProjectionText;
  readonly periodStart?: ProjectionText;
  readonly periodEnd?: ProjectionText;
  readonly dueDate?: ProjectionText;
  readonly status?: ProjectionText;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionIndicatorProjection {
  readonly entity: "Indicator";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly name?: ProjectionText;
  readonly topic?: ProjectionText;
  readonly unit?: ProjectionText;
  readonly method?: ProjectionText;
  readonly frequency?: ProjectionText;
  readonly location?: ProjectionText;
  readonly requirementIds?: ReadonlyArray<ApplicationId>;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionIndicatorMeasurementProjection {
  readonly entity: "IndicatorMeasurement";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly indicatorId?: ProjectionText;
  readonly cycleId?: ProjectionText;
  readonly value?: number;
  readonly unit?: ProjectionText;
  readonly method?: ProjectionText;
  readonly location?: ProjectionText;
  readonly lab?: ProjectionText;
  readonly observedAt?: ProjectionText;
  readonly periodStart?: ProjectionText;
  readonly periodEnd?: ProjectionText;
  readonly dataQuality?: ProjectionText;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionCorrectiveActionProjection {
  readonly entity: "CorrectiveAction";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly cycleId?: ProjectionText;
  readonly status?: ProjectionText;
  readonly dueDate?: ProjectionText;
  readonly priority?: ProjectionText;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionMonitoringObligationProjection {
  readonly entity: "MonitoringObligation";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly programId?: ProjectionText;
  readonly title?: ProjectionText;
  readonly frequency?: ProjectionText;
  readonly dueDate?: ProjectionText;
  readonly status?: ProjectionText;
  readonly trigger?: ProjectionText;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionEventProjection {
  readonly entity: "Event";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly kind?: ProjectionText;
  readonly status?: ProjectionText;
  readonly severity?: ProjectionText;
  readonly occurredAt?: ProjectionText;
  readonly receivedAt?: ProjectionText;
  readonly cycleId?: ProjectionText;
  readonly restrictedDetailsOmitted?: boolean;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionRequirementProjection {
  readonly entity: "Requirement";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly frameworkId?: ProjectionText;
  readonly edition?: ProjectionText;
  readonly standard?: ProjectionText;
  readonly clause?: ProjectionText;
}

/** Whitelisted existing engagement read projection. Narratives, source quotes, restricted case bodies/ciphertext, arbitrary extensions and personal identities are excluded. */
export interface InstitutionAssessmentFindingProjection {
  readonly entity: "AssessmentFinding";
  readonly id: ApplicationId;
  readonly engagementId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly requirementId?: ProjectionText;
  readonly cycleId?: ProjectionText;
  readonly applicability?: ProjectionText;
  readonly coverage?: ProjectionText;
  readonly adequacy?: ProjectionText;
  readonly performance?: ProjectionText;
  readonly implementation?: ProjectionText;
  readonly effectiveness?: ProjectionText;
  readonly evidenceSufficiency?: ProjectionText;
  readonly riskSignificance?: ProjectionText;
  readonly residualRisk?: ProjectionText;
  readonly riskTrajectory?: ProjectionText;
  readonly frameworkId?: string | null;
}
export type InstitutionCanonicalRecord = (InstitutionProjectProjection) | (InstitutionProjectComponentProjection) | (InstitutionSiteProjection) | (InstitutionActivityProjection) | (InstitutionOrganizationProjection) | (InstitutionOrganizationRoleAssignmentProjection) | (InstitutionLifecycleEventProjection) | (InstitutionEngagementScopeProjection) | (InstitutionRequirementApplicabilityProjection) | (InstitutionAgreementProjection) | (InstitutionCovenantProjection) | (InstitutionInvestmentProjection) | (InstitutionFinancialFacilityProjection) | (InstitutionTransactionProjection) | (InstitutionFinancingParticipantProjection) | (InstitutionInvestmentAllocationProjection) | (InstitutionMonitoringCycleProjection) | (InstitutionIndicatorProjection) | (InstitutionIndicatorMeasurementProjection) | (InstitutionCorrectiveActionProjection) | (InstitutionMonitoringObligationProjection) | (InstitutionEventProjection) | (InstitutionRequirementProjection) | (InstitutionAssessmentFindingProjection);
export interface ResolvedNamespaceAlias {
  readonly namespace: ProjectionText;
  readonly value: ProjectionText;
}
export interface ResolvedPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly coordinateSystem: "EPSG:4326";
}
export interface ResolvedPeriod {
  readonly periodStart: CalendarDate;
  readonly periodEnd: CalendarDate;
}
export interface ResolvedIndicatorValue {
  readonly name: ProjectionText;
  readonly unit?: ProjectionText;
  readonly method?: ProjectionText;
  readonly frequency?: ProjectionText;
  readonly location?: ProjectionText;
}
export interface ResolvedMeasurementValue {
  readonly value: number;
  readonly unit?: ProjectionText;
  readonly method?: ProjectionText;
  readonly location?: ProjectionText;
  readonly lab?: ProjectionText;
  readonly observedAt?: ProjectionText;
  readonly periodStart?: ProjectionText;
  readonly periodEnd?: ProjectionText;
  readonly dataQuality?: ProjectionText;
}
export interface ResolvedEventValue {
  readonly id: ApplicationId;
  readonly kind: ProjectionText;
  readonly status?: ProjectionText;
  readonly severity?: ProjectionText;
  readonly occurredAt?: ProjectionText;
  readonly receivedAt?: ProjectionText;
  readonly restrictedDetailsOmitted?: boolean;
}
export interface ResolvedMonitoringObligationValue {
  readonly title: ProjectionText;
  readonly frequency?: ProjectionText;
  readonly dueDate?: ProjectionText;
  readonly status?: ProjectionText;
  readonly trigger?: ProjectionText;
}
export interface ResolvedApplicabilityValue {
  readonly frameworkEditionId: ApplicationId;
  readonly decision: "applicable" | "not_applicable" | "uncertain";
  readonly requirementRef: ExistingRecordReference;
  readonly assessedAt?: Timestamp;
  readonly effectiveFrom?: CalendarDate;
  readonly effectiveTo?: CalendarDate;
}
export type InstitutionFieldValue = (ScalarProjectionValue) | (Money) | (ResolvedNamespaceAlias) | (ResolvedPoint) | (ResolvedPeriod) | (ResolvedIndicatorValue) | (ResolvedMeasurementValue) | (ResolvedEventValue) | (ResolvedMonitoringObligationValue) | (ResolvedApplicabilityValue);
export interface InstitutionResolvedValue {
  readonly entity: ProjectionText;
  readonly recordId: ApplicationId;
  readonly value: InstitutionFieldValue;
  readonly engagementId?: ApplicationId;
  readonly projectId?: ApplicationId;
  readonly cycleId?: ApplicationId;
  readonly indicatorId?: ApplicationId;
  readonly investmentId?: ApplicationId;
  readonly financialFacilityId?: ApplicationId;
  readonly agreementId?: ApplicationId;
  readonly sourceCollection?: LifecycleCollection;
}
export interface InstitutionResolvedField {
  readonly id: ProjectionText;
  readonly institution: ProjectionText;
  readonly family: ProjectionText;
  readonly sourceId: ProjectionText;
  readonly templateId: ProjectionText;
  readonly templateType: ProjectionText;
  readonly section: ProjectionText;
  readonly field: ProjectionText;
  readonly sourceLocator: ProjectionText;
  readonly officialUrl: ProjectionText;
  readonly sourceEdition: ProjectionText;
  readonly fieldLabelMode: ProjectionText;
  readonly canonicalEntity: ProjectionText;
  readonly attribute: ProjectionText;
  readonly transformation: ProjectionText;
  readonly validation: ProjectionText;
  readonly mappingStatus: ProjectionText;
  readonly gapId: ProjectionText;
  readonly limitation: ProjectionText;
  readonly professionalReview: ProjectionText;
  readonly assertsCompliance: ProjectionText;
  readonly canonicalContractStatus: ProjectionText;
  readonly mappingMode: ProjectionText;
  readonly additionalCanonicalPaths: ProjectionText;
  readonly mappingExecution: ProjectionText;
  readonly canonicalPath: string | null;
  readonly status: "resolved" | "partially_resolved" | "unresolved";
  readonly values: ReadonlyArray<InstitutionResolvedValue>;
  readonly resolutionNote?: ProjectionText;
  readonly complianceEstablished: false;
}
export interface InstitutionUnresolvedField {
  readonly id: ApplicationId;
  readonly canonicalPath: string | null;
  readonly reason?: ProjectionText;
}
export interface InstitutionCoverage {
  readonly total: NonnegativeInteger;
  readonly resolved: NonnegativeInteger;
  readonly partiallyResolved: NonnegativeInteger;
  readonly unresolved: NonnegativeInteger;
}
export interface InstitutionMappingCatalog {
  readonly schemaVersion: Revision;
  readonly verifiedAt: CalendarDate;
  readonly sourceRegister: ProjectionText;
  readonly coverageSource: ProjectionText;
}

/** Descriptive references to existing repository custody artifacts; no new bytes, source rights or current access grant are implied. */
export interface InstitutionSourceCustody {
  readonly register: ProjectionText;
  readonly sourceVersionId: ApplicationId;
  readonly reportedMasterSha256: Sha256;
  readonly retainedAnnex: ProjectionText;
  readonly annexSha256: Sha256;
  readonly fidelityReceipt: ProjectionText;
  readonly professionalAcceptance: boolean;
}
export interface InstitutionSource {
  readonly edition: ProjectionText;
  readonly family: ProjectionText;
  readonly id: ProjectionText;
  readonly locator: ProjectionText;
  readonly notes: ProjectionText;
  readonly officialUrl: ProjectionText;
  readonly publicationDate: string | null;
  readonly publisher: ProjectionText;
  readonly retainedBytesAcquiredInThisReview: boolean;
  readonly rightsReview: ProjectionText;
  readonly sourceType: ProjectionText;
  readonly title: ProjectionText;
  readonly verificationMethod: ProjectionText;
  readonly verifiedAt: ProjectionText;
  readonly adoptedAt?: ProjectionText;
  readonly dateNote?: ProjectionText;
  readonly effectiveAt?: ProjectionText;
  readonly landingUrl?: ProjectionText;
  readonly officialInstitutionUrl?: ProjectionText;
  readonly verificationLimit?: ProjectionText;
  readonly existingCustody?: InstitutionSourceCustody;
}
export interface InstitutionTemplate {
  readonly id: ProjectionText;
  readonly family: ProjectionText;
  readonly sourceId: ProjectionText;
  readonly kind: ProjectionText;
  readonly extent: ProjectionText;
  readonly nativeOriginal: ProjectionText;
  readonly editionApplicability: ProjectionText;
}
export type PerformanceCounts = Readonly<Record<string, NonnegativeInteger>>;
export interface UnassessedRequirementProjection {
  readonly engagementId: ApplicationId;
  readonly requirementId: ApplicationId;
}
export interface FrameworkAssessmentStatus {
  readonly frameworkId: ApplicationId;
  readonly requirementIds: ReadonlyArray<ApplicationId>;
  readonly findingIds: ReadonlyArray<ApplicationId>;
  readonly performanceCounts: PerformanceCounts;
  readonly unassessedRequirements: ReadonlyArray<UnassessedRequirementProjection>;
  readonly unknownPerformanceFindingIds: ReadonlyArray<ApplicationId>;
  readonly meaning: ProjectionText;
}
export interface SectorExposureGroup {
  readonly sectorProfileId: ApplicationId;
  readonly sectorName: ProjectionText;
  readonly allocationIds: ReadonlyArray<ApplicationId>;
  readonly projectIds: ReadonlyArray<ApplicationId>;
  readonly leafInvestmentIds: ReadonlyArray<ApplicationId>;
  readonly amounts: ReadonlyArray<Money>;
}
export interface SectorExposureCoverage {
  readonly status: "partial" | "complete";
  readonly asOf?: CalendarDate;
  readonly groups: ReadonlyArray<SectorExposureGroup>;
  readonly unknownAllocationIds: ReadonlyArray<ApplicationId>;
  readonly mixedAllocationIds: ReadonlyArray<ApplicationId>;
  readonly unpricedAllocationIds: ReadonlyArray<ApplicationId>;
  readonly unknownLeafInvestmentIds: ReadonlyArray<ApplicationId>;
  readonly meaning: ProjectionText;
}
export interface RecordedRiskDimensions {
  readonly findingId: ApplicationId;
  readonly requirementId?: ApplicationId;
  readonly engagementId?: ApplicationId;
  readonly cycleId?: ApplicationId;
  readonly riskSignificance?: ProjectionText;
  readonly residualRisk?: ProjectionText;
  readonly riskTrajectory?: ProjectionText;
}
export interface PortfolioFrameworkStatus {
  readonly frameworkId: ApplicationId;
  readonly requirementIds: ReadonlyArray<ApplicationId>;
  readonly findingIds: ReadonlyArray<ApplicationId>;
  readonly performanceCounts: PerformanceCounts;
  readonly unassessedRequirementIds: ReadonlyArray<ApplicationId>;
  readonly unknownPerformanceFindingIds: ReadonlyArray<ApplicationId>;
  readonly recordedRiskDimensions: ReadonlyArray<RecordedRiskDimensions>;
}
export interface PortfolioMonitoringCounts {
  readonly cycles: NonnegativeInteger;
  readonly measurements: NonnegativeInteger;
  readonly actions: NonnegativeInteger;
  readonly openActions: NonnegativeInteger;
  readonly incidents: NonnegativeInteger;
  readonly grievances: NonnegativeInteger;
}
export interface PortfolioMonitoringRow {
  readonly investmentId: ApplicationId;
  readonly projectId: ApplicationId;
  readonly allocationIds: ReadonlyArray<ApplicationId>;
  readonly counts: PortfolioMonitoringCounts;
  readonly frameworks: ReadonlyArray<PortfolioFrameworkStatus>;
  readonly monitoringStatus: "recorded_current_period" | "not_recorded";
}
export interface PortfolioMonitoringProjection {
  readonly rows: ReadonlyArray<PortfolioMonitoringRow>;
  readonly meaning: ProjectionText;
}

/** Minimized read-only partial field exchange from one explicitly selected authorized dataset. Preserves canonical IDs and dataset hash; all complianceEstablished flags remain false. Institutional forms, signatures, source quotes and case bodies are not generated. */
export interface InstitutionFieldExchange {
  readonly format: "esia-project-lifecycle-institution-field-exchange";
  readonly schemaVersion: 1;
  readonly view: "canonical" | "ifc" | "world_bank" | "adb" | "ebrd" | "eib" | "fmo";
  readonly datasetSha256: Sha256;
  readonly mappingCatalog: InstitutionMappingCatalog;
  readonly coverageStatus: "partial";
  readonly outputKind: "json_field_exchange";
  readonly professionalAcceptance: "unrecorded";
  readonly complianceEstablished: false;
  readonly asOf?: CalendarDate;
  readonly canonicalRecords: ReadonlyArray<InstitutionCanonicalRecord>;
  readonly portfolio: PortfolioView;
  readonly assessmentStatusByFramework: ReadonlyArray<FrameworkAssessmentStatus>;
  readonly sectorCoverage: SectorExposureCoverage;
  readonly portfolioMonitoring: PortfolioMonitoringProjection;
  readonly fields: ReadonlyArray<InstitutionResolvedField>;
  readonly unresolvedFields: ReadonlyArray<InstitutionUnresolvedField>;
  readonly coverage: InstitutionCoverage;
  readonly sources: ReadonlyArray<InstitutionSource>;
  readonly templates: ReadonlyArray<InstitutionTemplate>;
  readonly notices: ReadonlyArray<ProjectionText>;
}

export type LifecycleRecord = LedgerEntities[LifecycleCollection][number];
export type LifecycleEntityName = "ProjectComponent" | "Site" | "Activity" | "Organization" | "OrganizationRoleAssignment" | "Investment" | "FinancialFacility" | "Transaction" | "FinancingParticipant" | "InvestmentAllocation" | "Agreement" | "Covenant" | "EngagementScope" | "RequirementApplicability" | "LifecycleEvent" | "Project" | "Engagement" | "Deliverable" | "Risk" | "Impact" | "Receptor" | "StakeholderGroup" | "BaselineCondition" | "ManagementPlan" | "ManagementMeasure" | "FrameworkEdition" | "Requirement" | "RequirementCrosswalk" | "Study" | "EvidenceAssertion" | "Observation" | "ProfessionalJudgment" | "ProjectFact" | "Indicator" | "IndicatorMeasurement" | "SocialOutcome" | "Grievance" | "IncidentNotification" | "Incident" | "Assessment" | "AssessmentFinding" | "CorrectiveAction" | "Commitment" | "Verification" | "Approval" | "MonitoringProgram" | "MonitoringCycle" | "Report" | "ConsultationEvent" | "PortfolioExposure" | "Entitlement" | "EntitlementDelivery" | "LivelihoodOutcome";
