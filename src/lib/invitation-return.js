const storageKey = "esia.invitation-return.v1";
const maxAge = 7 * 86400_000;
const exact = pattern => value => typeof value === "string" && pattern.test(value);
const invitationId = exact(/^invite_[A-Za-z0-9_.:-]{1,180}(?![\s\S])/);
const invitationToken = exact(/^[A-Za-z0-9_-]{43}(?![\s\S])/);
const resourceId = exact(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/);
const safeResourceId = value => resourceId(value) && !value.includes("..");
function kindOf(id) {return id.startsWith("invite_team_") ? "team" : id.startsWith("invite_engagement_") ? "engagement" : undefined;}
function valid(value, now) {
  return Boolean(value && invitationId(value.invitation_id) && invitationToken(value.token) &&
    Number.isSafeInteger(value.expected_revision) && value.expected_revision >= 1 &&
    Number.isFinite(value.saved_at) && value.saved_at <= now && value.saved_at > now - maxAge);
}
function handoff(value) {
  const kind = kindOf(value.invitation_id);
  return {invitation_id:value.invitation_id,token:value.token,expected_revision:value.expected_revision,saved_at:value.saved_at,...(kind?{kind}:{})};
}
export function invitationFromLocation(href, now = Date.now()) {
  try {
    const url = new URL(href), fragment = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.getAll("invitation").length !== 1 || fragment.getAll("invitation_token").length !== 1 || fragment.getAll("invitation_revision").length !== 1) return null;
    const value = {invitation_id: url.searchParams.get("invitation"), token: fragment.get("invitation_token"),
      expected_revision: Number(fragment.get("invitation_revision")), saved_at: now};
    return valid(value, now) ? handoff(value) : null;
  } catch {return null;}
}
export function rememberInvitationReturn(href, storage, now = Date.now()) {
  const value = invitationFromLocation(href, now);
  if (value) storage.setItem(storageKey, JSON.stringify(value));
  return value;
}
export function pendingInvitationReturn(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(storageKey);
    if (raw && raw.length <= 2048) {
      const value = JSON.parse(raw);
      if (valid(value, now)) return handoff(value);
    }
  } catch { /* Invalid browser handoffs never become access records. */ }
  storage.removeItem(storageKey); return null;
}
export function clearInvitationReturn(storage) { storage.removeItem(storageKey); }

/** Invitation secrets stay in the finite browser handoff, never navigation queries. */
export function invitationLocationWithoutSecret(href, {complete = false} = {}) {
  const url = new URL(href), fragment = new URLSearchParams(url.hash.slice(1));
  for (const name of ["invitation_token", "invitation_revision"]) {url.searchParams.delete(name);fragment.delete(name);}
  if (complete) url.searchParams.delete("invitation");
  url.hash = fragment.toString();
  return url.href;
}

export function engagementInvitationLink(invitation, token, origin) {
  if (!invitationId(invitation?.invitation_id) || kindOf(invitation.invitation_id) !== "engagement" ||
      invitation.resource_type !== "engagement" || !safeResourceId(invitation.resource_id) ||
      !Number.isSafeInteger(invitation.revision) || invitation.revision < 1 || !invitationToken(token)) throw new TypeError("The server did not return a complete engagement invitation.");
  const base = new URL(origin);
  if (base.href !== base.origin + "/" || base.username || base.password ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost","127.0.0.1"].includes(base.hostname)))) throw new TypeError("Use the configured application origin for an engagement invitation.");
  const url = new URL("/workspaces", base.origin);
  url.searchParams.set("invitation",invitation.invitation_id);
  url.hash = new URLSearchParams({invitation_token:token,invitation_revision:String(invitation.revision)}).toString();
  return url.href;
}

/** Preview identity is checked against the server-resolved signed-in recipient. */
export function assertEngagementInvitationPreview(invitation, pending, {issuer, subject} = {}) {
  if (pending?.kind !== "engagement" || invitation?.resource_type !== "engagement" ||
      invitation.invitation_id !== pending.invitation_id || kindOf(invitation.invitation_id) !== "engagement" ||
      ![invitation.resource_id,invitation.engagement_id,invitation.project_id,invitation.account_id].every(safeResourceId) ||
      invitation.engagement_id !== invitation.resource_id || typeof invitation.name !== "string" || !invitation.name.trim() || invitation.name.length > 2000 ||
      !["preparer","reviewer","approver","client"].includes(invitation.professional_role) ||
      !Array.isArray(invitation.permissions) || !invitation.permissions.length || invitation.permissions.length > 4 ||
      invitation.permissions.some(value=>!["view","comment","review","edit","write"].includes(value)) || !invitation.permissions.includes("view") ||
      !(invitation.professional_role === "preparer" ? invitation.permissions.some(value=>["edit","write"].includes(value)) : invitation.permissions.includes("review")) ||
      !["pending","accepted","revoked","expired"].includes(invitation.status) ||
      !Number.isSafeInteger(invitation.revision) || invitation.revision < 1 || !Number.isSafeInteger(invitation.configuration_revision) || invitation.configuration_revision < 1 ||
      !Number.isFinite(Date.parse(invitation.expires_at)) || !issuer || !subject ||
      invitation.recipient?.issuer !== issuer || invitation.recipient?.subject !== subject) throw new TypeError("The invitation does not match this signed-in recipient and engagement.");
  return invitation;
}

/** Only a fresh authenticated acceptance receipt selects the destination. */
export function engagementInvitationDestination(invitation, receipt) {
  const destination = receipt?.destination;
  if (invitation?.resource_type !== "engagement" || !invitationId(invitation.invitation_id) || kindOf(invitation.invitation_id) !== "engagement" ||
      !safeResourceId(invitation.resource_id) || !safeResourceId(invitation.account_id) || !safeResourceId(invitation.project_id) ||
      invitation.engagement_id !== invitation.resource_id || receipt?.invitation_id !== invitation.invitation_id || receipt.status !== "accepted" ||
      !Number.isSafeInteger(receipt.revision) || receipt.revision !== invitation.revision + (invitation.status === "accepted" ? 0 : 1) ||
      !destination || ![destination.account_id,destination.project_id,destination.engagement_id].every(safeResourceId) ||
      destination.account_id !== invitation.account_id || destination.project_id !== invitation.project_id || destination.engagement_id !== invitation.resource_id) throw new TypeError("The server did not confirm this exact engagement invitation destination.");
  return "/engagements?" + new URLSearchParams({mode:"authenticated",account:destination.account_id,project:destination.project_id,engagement:destination.engagement_id});
}
