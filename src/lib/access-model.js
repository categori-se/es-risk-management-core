import {apiPaths} from "./platform-config.js";

export const deploymentRoles = {
  applicationSuperAdmin: "application_super_admin",
  platformAdmin: "PlatformAdmin",
  projectOwner: "ProjectOwner",
  reviewer: "Reviewer",
  viewer: "Viewer"
};

export const projectPermissions = ["view", "comment", "review", "write", "manage_access", "owner"];

const ownerExpandedPermissions = new Set(projectPermissions);
const identityIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/;
const explicitIdentityId = value => typeof value === "string" && identityIdPattern.test(value);
const activeProjectedUser = user => explicitIdentityId(user.user_id) && (user.status === undefined || user.status === "active");
const scopedGuestMembership = member => member.role === "guest" || String(member.role || "").startsWith("guest_");

export const workspaceRoles = {
  guest: "guest",
  viewer: "viewer",
  editor: "editor",
  administrator: "administrator",
  owner: "owner"
};

export const workspaceRoleCapabilities = {
  [workspaceRoles.guest]: ["view_workspace"],
  [workspaceRoles.viewer]: ["view_workspace", "view_project"],
  [workspaceRoles.editor]: ["view_workspace", "view_project", "comment", "write"],
  [workspaceRoles.administrator]: ["view_workspace", "view_project", "comment", "write", "invite_members", "create_project", "manage_access"],
  [workspaceRoles.owner]: ["view_workspace", "view_project", "comment", "write", "invite_members", "create_project", "manage_access", "manage_billing", "manage_workspace"]
};

export const teamScopeTypes = {
  account: "account",
  personalWorkspace: "personal_workspace",
  standalone: "standalone"
};

export const artifactOwnerTypes = {
  account: "account",
  team: "team",
  project: "project",
  userWorkspace: "user_workspace"
};

export const notificationEventTypes = {
  accountMemberAdded: "account_member_added",
  accountMemberAddFailed: "account_member_add_failed",
  teamMemberAdded: "team_member_added",
  teamMemberAddFailed: "team_member_add_failed",
  projectShared: "project_shared",
  projectAccessChanged: "project_access_changed",
  artifactCreated: "artifact_created"
};

export const monetizationPlans = {
  individual: {
    label: "Private",
    segment: "private",
    positioning: "Private subscriptions provide a private working area for individual review.",
    can_create_personal_projects: true,
    can_create_standalone_teams: true,
    can_invite_editors: false,
    max_private_projects: 3,
    monthly_compute_units: 80,
    storage_gb: 2,
    upgrade_target: "productive"
  },
  team: {
    label: "Productive",
    segment: "productive",
    positioning: "Productive spaces enable team collaboration and increase workspace compute and storage capacity.",
    can_create_personal_projects: true,
    can_create_standalone_teams: true,
    can_invite_editors: true,
    max_private_projects: 25,
    monthly_compute_units: 600,
    storage_gb: 50,
    upgrade_target: "powerful"
  },
  enterprise: {
    label: "Powerful",
    segment: "powerful",
    positioning: "Powerful workspaces add enterprise controls, higher capacity, additional features, and support.",
    can_create_personal_projects: true,
    can_create_standalone_teams: true,
    can_invite_editors: true,
    can_create_client_accounts: true,
    max_private_projects: null,
    monthly_compute_units: 5000,
    storage_gb: 500,
    upgrade_target: null
  }
};

export const aaronSuperAdminIdentity = {
  user_id: "user_aaron",
  cognito_sub: "347824f8-10e1-7084-5885-5ad00327cb12",
  email: "akdennis@gmail.com",
  name: "Aaron Dennis",
  deployment_roles: [deploymentRoles.applicationSuperAdmin],
  cognito_groups: [
    deploymentRoles.applicationSuperAdmin,
    deploymentRoles.platformAdmin,
    deploymentRoles.projectOwner
  ]
};

export const accountTypeLabels = {
  personal: "Personal workspace",
  client_org: "Client account",
  consulting_firm: "Consulting firm"
};

export const sampleAccessAccounts = [
  {
    account_id: "acct_aaron_personal",
    name: "Aaron's Workspace",
    type: "personal",
    status: "active",
    data_classification: "confidential",
    default_project_visibility: "private",
    owner_user_id: "user_aaron",
    billing_plan: "individual",
    workspace_label: "Aaron's workspace",
    created_by: "user_aaron",
    created_at: "2026-05-31T00:00:00Z"
  }
];

export const accountTemplates = [
  {
    name: "DFC",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Energy",
    default_subteam_name: "Renewables"
  },
  {
    name: "ADB",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Sustainable Infrastructure",
    default_subteam_name: "Safeguards Review"
  },
  {
    name: "IFC",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Advisory",
    default_subteam_name: "E&S Specialists"
  },
  {
    name: "World Bank",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Environment and Social",
    default_subteam_name: "Regional Review"
  },
  {
    name: "Islamic Development Bank",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Infrastructure Safeguards",
    default_subteam_name: "Co-finance Review"
  },
  {
    name: "African Development Bank",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Integrated Safeguards",
    default_subteam_name: "Project Disclosure"
  },
  {
    name: "KfW",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Sustainability",
    default_subteam_name: "Co-lender Review"
  },
  {
    name: "BIC",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Accountability",
    default_subteam_name: "Source Monitoring"
  },
  {
    name: "Proparco",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "E&S Risk",
    default_subteam_name: "Co-lender Review"
  },
  {
    name: "EBRD",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Performance Requirements",
    default_subteam_name: "Project Review"
  },
  {
    name: "AIIB",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "Environmental and Social",
    default_subteam_name: "Co-finance Review"
  },
  {
    name: "EIB",
    type: "client_org",
    data_classification: "confidential",
    default_team_name: "E&S Standards",
    default_subteam_name: "Project Review"
  }
];

export const sampleAccountMembers = [
  {
    account_id: "acct_aaron_personal",
    user_id: "user_aaron",
    email: "akdennis@gmail.com",
    name: "Aaron Dennis",
    role: "owner",
    status: "active",
    permissions: ["manage_account", "manage_workspace", "create_project", "create_team", "invite_members", "share_project"],
    added_at: "2026-05-31T00:00:00Z"
  }
];

export const sampleTeams = [];
export const sampleTeamMembers = [];
export const sampleProjectGrants = [];
export const sampleAccessInvitations = [];

export const sampleSetupPreferences = {
  command_center_dismissed_by_user_id: {}
};

export const sampleNotificationPreferences = {
  user_aaron: createDefaultNotificationPreferences({userId: "user_aaron", email: "akdennis@gmail.com"})
};

export const apiContracts = [
  {
    method: "GET",
    path: "/api/session-context",
    enforces: "Returns user, deployment roles, personal workspace, account memberships, selected account, and effective capabilities."
  },
  {
    method: "GET/PATCH",
    path: "/api/me/workspace",
    enforces: "Reads or edits the caller-owned workspace label, defaults, and workspace-level preferences."
  },
  {
    method: "GET/POST",
    path: "/api/accounts",
    enforces: "Lists accessible accounts; application_super_admin may create client or consulting-firm accounts."
  },
  {
    method: "GET/POST",
    path: "/api/accounts/{account_id}/teams",
    enforces: "Lists or creates nested teams only for account admins or delegated team admins."
  },
  {
    method: "GET/POST",
    path: "/api/teams",
    enforces: "Lists or creates freestanding or personal-workspace teams; every freestanding team must keep one active root administrator."
  },
  {
    method: "GET/POST",
    path: "/api/invitations",
    enforces: "Creates scoped invitations for account, team, or project access."
  },
  {
    method: "GET/POST",
    path: "/api/projects",
    enforces: "Returns only projects where the caller has at least view; creates projects only in permitted accounts."
  },
  {
    method: "GET/PUT",
    path: "/api/projects/{project_id}/grants",
    enforces: "Reads or updates project grants only for users with manage_access or owner."
  },
  {
    method: "POST",
    path: "/api/permissions/effective",
    enforces: "Computes server-side permissions from account, team, and direct project grants."
  },
  {
    method: "POST",
    path: "/api/uploads/presign",
    enforces: "Issues a single-object or multipart presigned URL only when caller has write or owner."
  },
  {
    method: "POST",
    path: apiPaths.policyAuditPresign,
    enforces: "Issues exact-object presigned URLs for policy audit manifest, draft, applicability, requirement, diagnostic, rollup, and export JSON only when caller has review/write or owner."
  },
  {
    method: "GET/PUT",
    path: "/api/me/notifications",
    enforces: "Reads or updates per-user notification settings for account, team, project, and artifact events."
  },
  {
    method: "GET/POST",
    path: "/api/artifacts",
    enforces: "Creates or lists document artifacts only inside the caller's effective workspace, account, team, or project scope."
  }
];

export function normalizeUserProfile(user = {}) {
  const email = String(user.email || "").toLowerCase();
  const authoritative = user.server_authoritative === true;
  const id = authoritative ? user.user_id : user.id || user.user_id || user.sub || user.cognito_sub || "";
  const groups = new Set(authoritative ? [...(user.deployment_roles || [])] : [...(user.groups || []), ...(user.cognito_groups || []), ...(user.deployment_roles || [])]);
  // This existing subject alias is a UI projection for this app's configured pool.
  // Email is contact data; token verification and issuer trust belong to the server boundary.
  const isAaron = !authoritative && id === aaronSuperAdminIdentity.cognito_sub;

  if (isAaron) {
    aaronSuperAdminIdentity.cognito_groups.forEach((group) => groups.add(group));
  }

  return {
    ...user,
    user_id: isAaron ? aaronSuperAdminIdentity.user_id : explicitIdentityId(user.user_id) ? user.user_id : explicitIdentityId(id) ? id : "",
    id,
    email,
    name: user.name || email || "Unknown user",
    groups: [...groups],
    deployment_roles: [...groups].filter((group) => group === deploymentRoles.applicationSuperAdmin)
  };
}

export function isApplicationSuperAdmin(user) {
  const normalized = normalizeUserProfile(user);
  return activeProjectedUser(normalized) && normalized.groups.includes(deploymentRoles.applicationSuperAdmin);
}

export function accountDisplayType(account) {
  return accountTypeLabels[account?.type] || "Account";
}

export function getAccessibleAccounts({user, accounts, accountMembers}) {
  const normalized = normalizeUserProfile(user);
  if (!activeProjectedUser(normalized)) return [];
  if (isApplicationSuperAdmin(normalized)) return accounts;

  const accountIds = new Set(
    accountMembers
      .filter((member) => memberMatchesUser(member, normalized) && !scopedGuestMembership(member))
      .map((member) => member.account_id)
  );

  return accounts.filter((account) => accountIds.has(account.account_id));
}

export function getTeamsForAccount(teams, accountId) {
  return teams.filter((team) => team.account_id === accountId);
}

export function getTeamsForPersonalWorkspace(teams, userId) {
  return teams.filter((team) => team.scope_type === teamScopeTypes.personalWorkspace && team.owner_user_id === userId);
}

export function getStandaloneTeamsForUser(teams, userId) {
  return teams.filter(
    (team) =>
      team.scope_type === teamScopeTypes.standalone &&
      (team.owner_user_id === userId || team.root_admin_user_id === userId || team.created_by === userId)
  );
}

export function getAccountMembers(accountMembers, accountId) {
  return accountMembers.filter((member) => member.account_id === accountId);
}

export function getProjectGrants(projectGrants, projectId) {
  return projectGrants.filter((grant) => grant.project_id === projectId);
}

export function getEffectiveProjectPermissions({
  user,
  project,
  projectGrants = [],
  accountMembers = [],
  teamMembers = [],
  teams = []
}) {
  if (!project) return [];

  const normalized = normalizeUserProfile(user);
  if (!activeProjectedUser(normalized)) return [];
  const permissions = new Set();
  const grants = getProjectGrants(projectGrants, project.project_id);

  for (const grant of grants) {
    // Unversioned seeded grants predate lifecycle metadata. An explicitly
    // inactive grant must never regain access through a contact/ID match.
    if (grant.status !== undefined && grant.status !== "active") continue;
    if (!grantAppliesToUser({grant, user: normalized, accountMembers, teamMembers, teams})) continue;
    expandGrantedPermissions(grant.permissions || []).forEach((permission) => permissions.add(permission));
  }

  if (!project.restricted) {
    for (const member of accountMembers) {
      if (member.account_id !== project.account_id) continue;
      if (!memberMatchesUser(member, normalized) || scopedGuestMembership(member)) continue;
      if (member.permissions?.includes("manage_account")) permissions.add("view");
      if (member.permissions?.includes("create_project")) permissions.add("comment");
    }
  }

  return projectPermissions.filter((permission) => permissions.has(permission));
}

export function hasProjectPermission(access, permission) {
  return projectPermissions.includes(permission) && (access.includes(permission) || access.includes("owner"));
}

export function canCreateAccount(user) {
  return isApplicationSuperAdmin(user);
}

export function canCreateProjectInAccount({user, account, accountMembers}) {
  if (!account) return false;
  const normalized = normalizeUserProfile(user);
  if (!activeProjectedUser(normalized)) return false;
  if (isApplicationSuperAdmin(normalized) && account.type !== "personal") return true;
  return accountMembers.some(
    (member) =>
      member.account_id === account.account_id &&
      memberMatchesUser(member, normalized) &&
      !scopedGuestMembership(member) &&
      member.permissions?.includes("create_project")
  );
}

export function canManageAccount({user, account, accountMembers}) {
  if (!account) return false;
  const normalized = normalizeUserProfile(user);
  if (!activeProjectedUser(normalized)) return false;
  if (isApplicationSuperAdmin(normalized)) return true;
  return accountMembers.some(
    (member) =>
      member.account_id === account.account_id &&
      memberMatchesUser(member, normalized) &&
      !scopedGuestMembership(member) &&
      member.permissions?.includes("manage_account")
  );
}

export function getTeamOwnershipPrincipals({team, accountMembers = []}) {
  if (!team) {
    return {
      scope_type: teamScopeTypes.standalone,
      owner_user_ids: [],
      account_admin_user_ids: [],
      root_admin_user_id: null,
      requires_active_root_admin: true
    };
  }

  const scopeType = team.scope_type || (team.account_id ? teamScopeTypes.account : teamScopeTypes.standalone);
  const accountAdminUserIds =
    scopeType === teamScopeTypes.account
      ? accountMembers
          .filter(
            (member) =>
              member.account_id === team.account_id &&
              member.status === "active" &&
              !scopedGuestMembership(member) &&
              (member.role === "owner" || member.role === "account_admin" || member.permissions?.includes("manage_account"))
          )
          .map((member) => member.user_id)
          .filter(Boolean)
      : [];
  const rootAdminUserId = team.root_admin_user_id || team.owner_user_id || team.created_by || null;
  const ownerUserIds = new Set([rootAdminUserId, team.owner_user_id, team.created_by, ...accountAdminUserIds].filter(Boolean));

  return {
    scope_type: scopeType,
    owner_user_ids: [...ownerUserIds],
    account_admin_user_ids: accountAdminUserIds,
    root_admin_user_id: rootAdminUserId,
    requires_active_root_admin: scopeType !== teamScopeTypes.account
  };
}

export function canTransferTeamRootAdmin({team, actor, candidateUserId, teamMembers = []}) {
  const normalizedActor = normalizeUserProfile(actor);
  if (!activeProjectedUser(normalizedActor)) return false;
  const owners = getTeamOwnershipPrincipals({team});
  const actorCanTransfer = isApplicationSuperAdmin(normalizedActor) || owners.root_admin_user_id === normalizedActor.user_id;
  if (!actorCanTransfer || !candidateUserId) return false;

  return teamMembers.some(
    (member) =>
      member.team_id === team.team_id &&
      member.user_id === candidateUserId &&
      member.status === "active" &&
      (member.role === "team_admin" || member.role === "owner" || member.permissions?.includes("manage_team"))
  );
}

export function getAdministrativeNotificationRecipients({
  eventType,
  accountId,
  actorUserId,
  accountMembers,
  notificationPreferencesByUserId = {}
}) {
  const administrativeEvents = new Set([
    notificationEventTypes.accountMemberAdded,
    notificationEventTypes.accountMemberAddFailed,
    notificationEventTypes.teamMemberAdded,
    notificationEventTypes.teamMemberAddFailed
  ]);
  if (!administrativeEvents.has(eventType)) return [];

  return accountMembers
    .filter(
      (member) =>
        member.account_id === accountId &&
        member.status === "active" &&
        member.user_id !== actorUserId &&
        (member.role === "owner" || member.role === "account_admin" || member.permissions?.includes("manage_account"))
    )
    .filter((member) => notificationEnabled(notificationPreferencesByUserId[member.user_id], eventType))
    .map((member) => ({
      user_id: member.user_id,
      email: member.email,
      event_type: eventType,
      channels: enabledNotificationChannels(notificationPreferencesByUserId[member.user_id], eventType)
    }));
}

export function createClientAccountFromTemplate({template = accountTemplates[0], createdBy, now = new Date()}) {
  const slug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  return {
    account_id: `acct_${slug}`,
    name: template.name,
    type: template.type,
    status: "active",
    data_classification: template.data_classification,
    default_project_visibility: "restricted by default",
    ownership_model: "organization_administered",
    billing_plan: "enterprise",
    owner_user_id: createdBy,
    created_by: createdBy,
    created_at: now.toISOString()
  };
}

export function createTeam({
  accountId = null,
  workspaceId = null,
  scopeType = accountId ? teamScopeTypes.account : workspaceId ? teamScopeTypes.personalWorkspace : teamScopeTypes.standalone,
  name,
  parentTeamId = null,
  createdBy,
  rootAdminUserId = createdBy,
  now = new Date()
}) {
  return {
    team_id: `team_${stableSlug(`${accountId || workspaceId || "standalone"}_${name}_${now.getTime()}`)}`,
    account_id: accountId,
    workspace_id: workspaceId,
    scope_type: scopeType,
    parent_team_id: parentTeamId,
    name,
    status: "active",
    owner_user_id: scopeType === teamScopeTypes.account ? null : rootAdminUserId,
    root_admin_user_id: rootAdminUserId,
    created_by: createdBy,
    created_at: now.toISOString()
  };
}

export function createDocumentArtifactOwnership({
  artifactId,
  ownerType,
  ownerId,
  accountId = null,
  projectId = null,
  teamId = null,
  storageKey,
  classification = "confidential",
  createdBy,
  now = new Date()
}) {
  return {
    artifact_id: artifactId,
    owner_type: ownerType,
    owner_id: ownerId,
    account_id: accountId,
    project_id: projectId,
    team_id: teamId,
    storage_key: storageKey,
    classification,
    created_by: createdBy,
    created_at: now.toISOString()
  };
}

export function createProjectGrant({projectId, targetType, targetId, permissions, createdBy, note = "", now = new Date()}) {
  if (!["user", "account", "team"].includes(targetType) || !explicitIdentityId(targetId)) {
    throw new TypeError("A project grant requires an explicit target identifier; email-only invitations remain unresolved");
  }
  return {
    grant_id: `grant_${stableSlug(`${projectId}_${targetType}_${targetId}_${now.getTime()}`)}`,
    project_id: projectId,
    target_type: targetType,
    target_id: targetId,
    status: "active",
    permissions,
    source: "direct_project_grant",
    note,
    created_by: createdBy,
    created_at: now.toISOString()
  };
}

function grantAppliesToUser({grant, user, accountMembers, teamMembers, teams}) {
  if (grant.target_type === "user") {
    return explicitIdentityId(grant.target_id) && grant.target_id === user.user_id;
  }

  if (grant.target_type === "account") {
    return accountMembers.some((member) => member.account_id === grant.target_id && !scopedGuestMembership(member) && memberMatchesUser(member, user));
  }

  if (grant.target_type === "team") {
    return teamMembers.some((member) => !scopedGuestMembership(member) && memberMatchesUser(member, user) && teamScopesOverlap(member.team_id, grant.target_id, teams));
  }

  return false;
}

function teamScopesOverlap(memberTeamId, grantTeamId, teams) {
  return (
    memberTeamId === grantTeamId ||
    isAncestorTeam({ancestorTeamId: memberTeamId, descendantTeamId: grantTeamId, teams}) ||
    isAncestorTeam({ancestorTeamId: grantTeamId, descendantTeamId: memberTeamId, teams})
  );
}

function isAncestorTeam({ancestorTeamId, descendantTeamId, teams}) {
  let current = teams.find((team) => team.team_id === descendantTeamId);
  while (current?.parent_team_id) {
    if (current.parent_team_id === ancestorTeamId) return true;
    current = teams.find((team) => team.team_id === current.parent_team_id);
  }
  return false;
}

export function memberMatchesUser(member, user) {
  const normalized = normalizeUserProfile(user);
  return activeProjectedUser(normalized) && member?.status === "active" &&
    explicitIdentityId(member.user_id) && member.user_id === normalized.user_id;
}

// A migration report, not an identity linker. A reviewer must bind unresolved
// contact-only records to verified issuer/subject mappings before reissuing access.
export function identifyUnresolvedAccessSubjects({projectGrants = [], accountMembers = [], teamMembers = []} = {}) {
  const issues = [];
  for (const [collection, rows] of Object.entries({projectGrants, accountMembers, teamMembers})) {
    rows.forEach((record, index) => {
      if (collection === "projectGrants" && record.target_type !== "user") return;
      const value = collection === "projectGrants" ? record.target_id : record.user_id;
      if (explicitIdentityId(value)) return;
      const contact = collection === "projectGrants" ? record.target_email : record.email;
      issues.push({collection, index, record_id: record.grant_id || record.membership_id || null,
        reason: contact ? "unresolved_email_identity" : "unresolved_user_identifier"});
    });
  }
  return issues;
}

function expandGrantedPermissions(permissions) {
  const expanded = new Set();
  for (const permission of permissions) {
    if (permission === "owner") {
      ownerExpandedPermissions.forEach((item) => expanded.add(item));
    } else {
      expanded.add(permission);
    }
  }
  return expanded;
}

export function createDefaultNotificationPreferences({userId, email = "", now = new Date()}) {
  return {
    user_id: userId,
    email,
    channels: {in_app: true, email: true},
    events: {
      [notificationEventTypes.accountMemberAdded]: {enabled: true, channels: {in_app: true, email: true}},
      [notificationEventTypes.accountMemberAddFailed]: {enabled: true, channels: {in_app: true, email: true}},
      [notificationEventTypes.teamMemberAdded]: {enabled: true, channels: {in_app: true, email: true}},
      [notificationEventTypes.teamMemberAddFailed]: {enabled: true, channels: {in_app: true, email: true}},
      [notificationEventTypes.projectShared]: {enabled: true, channels: {in_app: true, email: false}},
      [notificationEventTypes.projectAccessChanged]: {enabled: true, channels: {in_app: true, email: true}},
      [notificationEventTypes.artifactCreated]: {enabled: false, channels: {in_app: true, email: false}}
    },
    updated_at: now.toISOString()
  };
}

export function notificationEnabled(preferences, eventType) {
  if (!preferences) return true;
  return preferences.events?.[eventType]?.enabled !== false;
}

function enabledNotificationChannels(preferences, eventType) {
  const eventChannels = preferences?.events?.[eventType]?.channels || {};
  const globalChannels = preferences?.channels || {in_app: true, email: true};
  return Object.entries({...globalChannels, ...eventChannels})
    .filter(([, enabled]) => enabled)
    .map(([channel]) => channel);
}

function stableSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}
