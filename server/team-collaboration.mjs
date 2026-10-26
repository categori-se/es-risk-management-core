import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import {createWorkspaceParticipation, validateWorkspaceParticipation, resolveIdentityUser, externalIdentityKey} from "@categori/workspace-contracts";
import {record} from "./access-store.mjs";

// Teams are exact, app-owned collaboration groups. Their participation never
// enters the workspace roster; only an explicit resource Team grant uses it.
export function createTeamOperations({authenticate, memberWorkspace, get, commit, update, store, instant, iso, newId,
  expectedIssuer, verifyCurrentIdentity, fail, id, text}) {
  const hash = value => createHash("sha256").update(value).digest("hex");
  const roles = new Set(["team_admin", "member"]);
  const projection = (row, canManage = false) => ({...row.value, revision: row.revision, server_authoritative: true, can_manage: canManage});
  async function scope(auth, teamId, {inactive = false} = {}) {
    const team = await get(auth.ctx, `TEAM#${id(teamId)}`, "PROFILE");
    if (!team || team.value.team_id !== teamId || !["active", "archived"].includes(team.value.status) || (!inactive && team.value.status !== "active")) fail(404, "Team not available.");
    if (id(team.value.root_owner_user_id) !== team.value.root_admin_user_id || team.value.root_owner_user_id !== team.value.owner_user_id) fail(403, "Team root owner identity is inconsistent.");
    const workspace = await get(auth.ctx, `WORKSPACE#${id(team.value.workspace_id)}`, "PROFILE");
    const account = await get(auth.ctx, `ACCOUNT#${id(team.value.account_id)}`, "PROFILE");
    if (workspace?.value.identity?.workspace_id !== team.value.workspace_id || workspace.value.identity.status !== "active" ||
      workspace.value.account_id !== team.value.account_id || account?.value.account_id !== team.value.account_id ||
      account.value.workspace_id !== team.value.workspace_id || account.value.status !== "active") fail(403, "The Team's exact workspace/account is inactive.");
    return {team, workspace, account};
  }
  function validMember(row, team, userId, {active = true} = {}) {
    const value = row?.value, participation = value?.participation;
    return Boolean(value && row.pk === `TEAM#${team.team_id}` && row.sk === `MEMBER#${userId}` && validateWorkspaceParticipation(participation).length === 0 && value.team_id === team.team_id && value.user_id === userId && value.workspace_id === team.workspace_id &&
      value.account_id === team.account_id && ["owner", "team_admin", "member"].includes(value.role) && (value.role === "owner") === (userId === team.root_owner_user_id) &&
      ["active", "suspended", "revoked"].includes(value.status) && participation?.user_id === userId && participation.workspace_id === team.workspace_id &&
      participation.mode === "member" && participation.status === value.status && (!active || (value.status === "active" &&
      (participation.not_before === null || Date.parse(participation.not_before) <= instant().getTime()) &&
      (participation.expires_at === null || Date.parse(participation.expires_at) > instant().getTime()))));
  }
  async function authority(auth, teamId, options = {}) {
    const scoped = await scope(auth, teamId, options), {team, workspace} = scoped;
    await get(auth.ctx, team.pk, "MEMBER_SET");
    const member = await get(auth.ctx, team.pk, `MEMBER#${auth.userId}`);
    const workspaceMember = await get(auth.ctx, workspace.pk, `MEMBER#${auth.userId}`);
    const workspaceOwner = workspace.value.owner_user_id === auth.userId && workspaceMember?.value.identity?.user_id === auth.userId &&
      workspaceMember.value.identity.workspace_id === team.value.workspace_id && workspaceMember.value.identity.status === "active" && workspaceMember.value.identity.mode === "member" &&
      validateWorkspaceParticipation(workspaceMember.value.identity).length === 0 &&
      (workspaceMember.value.identity.not_before === null || Date.parse(workspaceMember.value.identity.not_before) <= instant().getTime()) &&
      (workspaceMember.value.identity.expires_at === null || Date.parse(workspaceMember.value.identity.expires_at) > instant().getTime());
    const accepted = validMember(member, team.value, auth.userId);
    const canManage = workspaceOwner || (accepted && ["owner", "team_admin"].includes(member.value.role));
    if (!(options.manage ? canManage : workspaceOwner || accepted)) fail(403, "Current exact Team membership with the requested authority is required.");
    return {...scoped, member, canManage, workspaceOwner};
  }
  async function memberProjection(auth, team, row) {
    const user = await get(auth.ctx, `USER#${row.value.user_id}`, "PROFILE");
    const {participation, ...value} = row.value;
    return {...value, name: user?.value.name || "ESIA user", expires_at: participation.expires_at, revision: row.revision, server_authoritative: true};
  }
  async function roster(auth, team, {ownOnly = false} = {}) {
    await get(auth.ctx, team.pk, "MEMBER_SET");
    const result = [];
    for (const hint of await store.list(team.pk, "MEMBER#")) {
      const row = await get(auth.ctx, hint.pk, hint.sk);
      if (ownOnly && row?.value.user_id !== auth.userId) continue;
      if (row && validMember(row, team.value, row.value.user_id, {active: false}) && row.sk === `MEMBER#${row.value.user_id}`) result.push(await memberProjection(auth, team, row));
    }
    return result;
  }
  async function parent(auth, workspaceId, teamId, parentId) {
    if (parentId === null) return;
    let current = id(parentId), seen = new Set([teamId]);
    for (let depth = 0; depth < 32; depth++) {
      if (seen.has(current)) fail(400, "Team metadata cannot contain a parent cycle.");
      seen.add(current);
      const {team} = await authority(auth, current);
      if (team.value.workspace_id !== workspaceId) fail(400, "Parent Team must have the exact same workspace.");
      if (team.value.parent_team_id === null) return;
      current = id(team.value.parent_team_id);
    }
    fail(400, "Team parent metadata exceeds its depth limit.");
  }
  async function teamRows(auth, query = {}) {
    const hints = [...await store.list(`USER#${auth.userId}`, "TEAM#")];
    const home = await get(auth.ctx, `USER#${auth.userId}`, "WORKSPACE");
    const workspaceIds = new Set([home?.value.workspace_id, query.workspace_id].filter(Boolean));
    for (const workspaceId of workspaceIds) {
      const workspace = await get(auth.ctx, `WORKSPACE#${id(workspaceId)}`, "PROFILE");
      if (workspace?.value.owner_user_id !== auth.userId) continue;
      await get(auth.ctx, workspace.pk, "TEAM_SET");
      hints.push(...await store.list(workspace.pk, "TEAM#"));
    }
    const result = [];
    for (const teamId of new Set(hints.map(row => row.value.team_id).filter(Boolean))) {
      try {
        const scoped = await authority(auth, teamId, {inactive: true});
        if ((!query.workspace_id || scoped.team.value.workspace_id === query.workspace_id) && (!query.account_id || scoped.team.value.account_id === query.account_id)) result.push(projection(scoped.team, scoped.canManage));
      } catch (error) { if (![403, 404].includes(error.statusCode)) throw error; }
    }
    return result;
  }
  async function createTeam(principal, body) {
    const auth = await authenticate(principal), workspaceId = id(body.workspace_id);
    const {workspace} = await memberWorkspace(auth, workspaceId, {owner: true});
    const teamId = body.team_id === undefined ? `team_${newId()}` : id(body.team_id);
    if (!teamId.startsWith("team_")) fail(400, "A Team request identifier must use the team_ prefix.");
    if (await get(auth.ctx, `TEAM#${teamId}`, "PROFILE")) fail(409, "Team request identifier already exists; read the Team before retrying.");
    const parentId = body.parent_team_id ?? null;
    await parent(auth, workspaceId, teamId, parentId);
    const team = record(`TEAM#${teamId}`, "PROFILE", {team_id: teamId, workspace_id: workspaceId, account_id: workspace.value.account_id,
      scope_type: "account", name: text(body.name), parent_team_id: parentId, status: "active", root_owner_user_id: auth.userId,
      root_admin_user_id: auth.userId, owner_user_id: auth.userId, created_by: auth.userId, created_at: iso()});
    const participation = createWorkspaceParticipation({participationId: `team_member_${newId()}`, workspaceId, userId: auth.userId});
    await commit(auth.ctx, [team, record(team.pk, `MEMBER#${auth.userId}`, {team_id: teamId, workspace_id: workspaceId, account_id: workspace.value.account_id,
      user_id: auth.userId, role: "owner", status: "active", participation, created_at: iso(), created_by: auth.userId}),
      record(workspace.pk, `TEAM#${teamId}`, {team_id: teamId}), record(`USER#${auth.userId}`, `TEAM#${teamId}`, {team_id: teamId})]);
    return {team: projection(team, true)};
  }
  async function team(principal, teamId, body) {
    const auth = await authenticate(principal), scoped = await authority(auth, teamId, {inactive: true, manage: Boolean(body)});
    if (!body) { await commit(auth.ctx); return {team: projection(scoped.team, scoped.canManage)}; }
    if (body.expected_revision !== scoped.team.revision) fail(409, "Team revision changed.");
    if (Object.keys(body).some(field => !["expected_revision", "name", "parent_team_id", "status"].includes(field))) fail(400, "Only Team metadata/lifecycle can be changed here.");
    const value = {...scoped.team.value};
    if (Object.hasOwn(body, "name")) value.name = text(body.name);
    if (Object.hasOwn(body, "status")) { if (!["active", "archived"].includes(body.status)) fail(400, "Team status must be active or archived."); value.status = body.status; }
    if (Object.hasOwn(body, "parent_team_id")) { await parent(auth, value.workspace_id, teamId, body.parent_team_id); value.parent_team_id = body.parent_team_id; }
    const changed = update(scoped.team, value);
    await commit(auth.ctx, [changed]); return {team: projection(changed, true)};
  }
  async function teamMembers(principal, teamId, body) {
    const auth = await authenticate(principal), scoped = await authority(auth, teamId, {manage: Boolean(body)});
    let team = scoped.team;
    if (body) {
      if (Object.hasOwn(body, "transfer_root_owner") && body.transfer_root_owner !== true) fail(400, "Root transfer must be explicitly true.");
      if (!["role", "status", "transfer_root_owner"].some(field => Object.hasOwn(body, field))) fail(400, "An explicit Team member change is required.");
      if (body.expected_team_revision !== team.revision) fail(409, "Team revision changed.");
      const targetId = id(body.user_id), member = await get(auth.ctx, team.pk, `MEMBER#${targetId}`);
      if (!validMember(member, team.value, targetId, {active: false}) || member.revision !== body.expected_revision) fail(409, "Exact Team member revision changed.");
      if (Object.keys(body).some(field => !["expected_team_revision", "user_id", "expected_revision", "role", "status", "transfer_root_owner"].includes(field))) fail(400, "Only Team member role or lifecycle can be changed here.");
      const writes = [], value = {...member.value};
      if (body.transfer_root_owner === true) {
        if (team.value.root_owner_user_id !== auth.userId || !validMember(scoped.member, team.value, auth.userId) || !validMember(member, team.value, targetId) || targetId === auth.userId || body.role || body.status) fail(403, "Root transfer requires the active current root and another active exact Team member.");
        await currentUser(auth, targetId);
        writes.push(update(scoped.member, {...scoped.member.value, role: "team_admin"}), update(member, {...member.value, role: "owner"}));
        team = update(team, {...team.value, root_owner_user_id: targetId, root_admin_user_id: targetId, owner_user_id: targetId});
        writes.push(team);
      } else {
        if (targetId === team.value.root_owner_user_id) fail(403, "Transfer the active root owner explicitly before changing that member.");
        if (Object.hasOwn(body, "role")) { if (!roles.has(body.role)) fail(400, "Team member role is invalid."); value.role = body.role; }
        if (Object.hasOwn(body, "status")) { if (!["active", "suspended", "revoked"].includes(body.status)) fail(400, "Team member lifecycle is invalid."); value.status = body.status;
          value.participation = {...value.participation, status: body.status, revision: value.participation.revision + 1}; }
        if (body.status === "active") await currentUser(auth, targetId);
        writes.push(update(member, value));
      }
      await commit(auth.ctx, writes);
      if (targetId === auth.userId && body.status && body.status !== "active") return {team_id: teamId, user_id: targetId, status: body.status, revision: member.revision + 1};
      // The write consumed this snapshot; reload before projecting the roster.
      return teamMembers(principal, teamId);
    }
    const members = await roster(auth, team, {ownOnly: !scoped.canManage}); await commit(auth.ctx);
    return {team: projection(team, scoped.canManage), members};
  }
  async function currentUser(auth, userId) {
    const user = await get(auth.ctx, `USER#${id(userId)}`, "PROFILE");
    if (user?.value.user_id !== userId || user.value.status !== "active" || user.value.identity?.status !== "active") fail(403, "Current Team participant User is inactive.");
    const principal = {...auth.principal, subject: user.value.cognito_sub};
    const linkId = `identity_${hash(externalIdentityKey({issuer: expectedIssuer, subject: principal.subject})).slice(0, 48)}`;
    const link = await get(auth.ctx, `IDENTITY#${linkId}`, "LINK");
    if (!link || link.value.user_id !== userId || link.value.issuer !== expectedIssuer || link.value.subject !== principal.subject || link.value.status !== "active") fail(403, "Current Team participant identity link is inactive.");
    const resolved = resolveIdentityUser({verifiedIdentity: {issuer: expectedIssuer, subject: principal.subject}, identityLinks: [link.value], users: [user.value.identity]});
    if (!resolved.allowed || resolved.user_id !== userId) fail(403, "Current Team participant identity does not resolve exactly.");
    auth.ctx.providerPrincipals.set(externalIdentityKey(principal), principal);
    const profile = await verifyCurrentIdentity(principal);
    if (profile?.active !== true || profile.subject !== principal.subject) fail(403, "Current Team participant provider account is inactive.");
    return {...auth, user, userId, link, principal};
  }
  function visibleInvitation(row) { const {token_sha256, ...value} = row.value; return {...value, revision: row.revision}; }
  function invitationRecipient(row, principal) { return row.value.recipient?.issuer === principal.issuer && row.value.recipient?.subject === principal.subject; }
  async function currentInvitation(auth, row) {
    if (row.value.kind !== "team" || row.value.status !== "pending" || !Number.isFinite(Date.parse(row.value.expires_at)) || Date.parse(row.value.expires_at) <= instant().getTime()) fail(409, "Team invitation is no longer pending.");
    const inviter = await currentUser(auth, row.value.created_by);
    const scoped = await authority(inviter, row.value.team_id, {manage: true});
    if (scoped.team.value.workspace_id !== row.value.workspace_id || scoped.team.value.account_id !== row.value.account_id || !roles.has(row.value.role)) fail(403, "Team invitation scope changed.");
    return scoped;
  }
  async function inviteTeam(principal, body) {
    const auth = await authenticate(principal), scoped = await authority(auth, body.team_id, {manage: true});
    if (body.configuration_revision !== scoped.team.revision) fail(409, "Team configuration changed.");
    if (!roles.has(body.role)) fail(400, "An explicit Team invitation role is required.");
    const recipient = body.recipient;
    if (!recipient || recipient.issuer !== expectedIssuer || Object.keys(recipient).some(field => !["issuer", "subject"].includes(field))) fail(400, "The recipient requires the exact configured issuer and subject.");
    externalIdentityKey(recipient);
    const expires = Date.parse(body.expires_at);
    if (!Number.isFinite(expires) || expires <= instant().getTime() || expires > instant().getTime() + 7 * 86400_000) fail(400, "Team invitations require a finite expiry within seven days.");
    const invitationId = `invite_team_${newId()}`, token = randomBytes(32).toString("base64url");
    const row = record(`INVITATION#${invitationId}`, "PROFILE", {kind: "team", invitation_id: invitationId, team_id: scoped.team.value.team_id,
      team_name: scoped.team.value.name, workspace_id: scoped.team.value.workspace_id, account_id: scoped.team.value.account_id,
      recipient, role: body.role, token_sha256: hash(token), expires_at: new Date(expires).toISOString(), status: "pending", created_by: auth.userId, created_at: iso()});
    await commit(auth.ctx, [row, record(`USER#${auth.userId}`, `INVITATION#${invitationId}`, {invitation_id: invitationId})]);
    return {invitation: visibleInvitation(row), token};
  }
  async function previewInvitation(principal, invitationId) {
    const auth = await authenticate(principal), row = await get(auth.ctx, `INVITATION#${id(invitationId)}`, "PROFILE");
    if (!row || row.value.kind !== "team") fail(404, "Team invitation unavailable.");
    if (!invitationRecipient(row, principal)) await authority(auth, row.value.team_id, {manage: true});
    const scoped = await currentInvitation(auth, row);
    await commit(auth.ctx); return {invitation: {...visibleInvitation(row), team_name: scoped.team.value.name}};
  }
  async function acceptTeam(auth, row, body) {
    if (!invitationRecipient(row, auth.principal)) fail(403, "Team invitation belongs to a different verified identity.");
    if (row.revision !== body.expected_revision) fail(409, "Team invitation revision changed.");
    if (typeof body.token !== "string" || body.token.length > 200 || !/^[a-f0-9]{64}$/.test(row.value.token_sha256) ||
      !timingSafeEqual(Buffer.from(hash(body.token)), Buffer.from(row.value.token_sha256))) fail(403, "Team invitation token invalid.");
    const scoped = await currentInvitation(auth, row), team = scoped.team;
    const existing = await get(auth.ctx, team.pk, `MEMBER#${auth.userId}`);
    // Joining cannot silently replace a role, reactivate a revoked member, or consume a second invitation.
    if (existing) fail(409, "An exact Team membership already exists; a Team administrator must review it.");
    const index = await get(auth.ctx, `USER#${auth.userId}`, `TEAM#${team.value.team_id}`);
    const participation = createWorkspaceParticipation({participationId: `team_member_${newId()}`, workspaceId: team.value.workspace_id,
      userId: auth.userId});
    await commit(auth.ctx, [update(row, {...row.value, status: "accepted", accepted_by: auth.userId, accepted_at: iso()}),
      record(team.pk, `MEMBER#${auth.userId}`, {team_id: team.value.team_id, workspace_id: team.value.workspace_id, account_id: team.value.account_id,
        user_id: auth.userId, role: row.value.role, status: "active", participation, created_by: row.value.created_by, created_at: iso(), invitation_id: row.value.invitation_id}),
      record(`USER#${auth.userId}`, `TEAM#${team.value.team_id}`, {team_id: team.value.team_id}, (index?.revision || 0) + 1)]);
    return {invitation_id: row.value.invitation_id, kind: "team", team_id: team.value.team_id, status: "accepted", revision: row.revision + 1};
  }
  async function revokeTeam(auth, row, body) {
    const scoped = await authority(auth, row.value.team_id, {manage: true, inactive: true});
    if (scoped.team.value.workspace_id !== row.value.workspace_id || scoped.team.value.account_id !== row.value.account_id) fail(403, "Team invitation scope changed.");
    if (row.revision !== body.expected_revision) fail(409, "Team invitation revision changed.");
    const writes = [update(row, {...row.value, status: "revoked", revoked_at: iso()})];
    if (row.value.accepted_by) {
      const member = await get(auth.ctx, scoped.team.pk, `MEMBER#${row.value.accepted_by}`);
      if (member?.value.invitation_id === row.value.invitation_id) {
        if (scoped.team.value.root_owner_user_id === member.value.user_id) fail(403, "Transfer the root owner before revoking this membership invitation.");
        writes.push(update(member, {...member.value, status: "revoked", participation: {...member.value.participation, status: "revoked", revision: member.value.participation.revision + 1}}));
      }
    }
    await commit(auth.ctx, writes); return {kind: "team", invitation_id: row.value.invitation_id, status: "revoked", revision: row.revision + 1};
  }
  async function resourceHints(auth, type) {
    const hints = [];
    for (const team of await teamRows(auth)) {
      if (team.status !== "active") continue;
      for (const hint of await store.list(`TEAM#${team.team_id}`, `RESOURCE#${type}#`)) hints.push(hint);
    }
    return hints;
  }
  return {scope, authority, validMember, teamRows, roster, resourceHints, createTeam, team, teamMembers, inviteTeam, previewInvitation, acceptTeam, revokeTeam,
    async listTeams(principal, query = {}) { const auth = await authenticate(principal), teams = await teamRows(auth, query); await commit(auth.ctx); return {teams}; }};
}
