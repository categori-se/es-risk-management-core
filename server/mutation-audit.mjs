import {randomUUID, createHash} from "node:crypto";
import {isIP} from "node:net";
import {record} from "./access-store.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const secretKey = /(?:password|secret|credential|authorization|access.?token|id.?token|refresh.?token|acceptance.?token|(^|_)token$|signed.?url|put_url|get_url)/i;
const secretText = /(?:\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|AWSAccessKeyId)=)/i;
function safe(value, depth = 0) {
  if (depth > 32) return "[redacted:depth]";
  if (typeof value === "string") return secretText.test(value) ? "[redacted]" : value.length > 4096 ? {redacted: "bounded_text", sha256: hash(value)} : value;
  if (Array.isArray(value)) return value.slice(0, 500).map(item => safe(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name,
    secretKey.test(name) && !/(?:sha256|digest)$/.test(name) ? "[redacted]" : safe(item, depth + 1)]));
  return value;
}
function state(row) {
  if (!row) return null;
  const cleaned = {revision: row.revision, value: safe(row.value)};
  const serialized = JSON.stringify(cleaned);
  // Audit records describe state transitions without copying unbounded private content into logs.
  return Buffer.byteLength(serialized) <= 6000 ? cleaned : {revision: row.revision, redacted: "bounded_state", sha256: hash(serialized)};
}
export function gatewayAuditContext(event) {
  const http = event?.requestContext?.http;
  const ip = typeof http?.sourceIp === "string" && isIP(http.sourceIp) ? http.sourceIp : null;
  const agent = typeof http?.userAgent === "string" ? http.userAgent.slice(0, 512) : null;
  const requestId = typeof event?.requestContext?.requestId === "string" ? event.requestContext.requestId.slice(0, 200) : null;
  return Object.freeze({ip, user_agent: agent === null ? null : safe(agent), request_id: requestId,
    method: typeof http?.method === "string" ? http.method.slice(0, 10) : null,
    path: typeof event?.rawPath === "string" ? safe(event.rawPath.slice(0, 500)) : null});
}
export function createMutationAudit({principal, userId, reads, values, timestamp, eventId = randomUUID()}) {
  if (!principal?.issuer || !principal.subject || !userId || !Array.isArray(values) || !values.length) throw new Error("A current server actor and committed mutations are required for audit.");
  const changes = values.map(after => {
    const before = reads.get(JSON.stringify([after.pk, after.sk]))?.row || null;
    return {pk: after.pk, sk: after.sk, before: state(before), after: state(after)};
  });
  const primary = values.find(row => row.value?.resource) || values.find(row => row.sk === "PROFILE") || values[0];
  const resource = primary.value.resource;
  const workspaceId = resource?.workspace_id || primary.value.workspace_id || primary.value.identity?.workspace_id || null;
  const target = resource ? {resource_type: resource.resource_type, resource_id: resource.resource_id, workspace_id: workspaceId}
    : {resource_type: primary.pk.split("#")[0].toLowerCase(), resource_id: primary.pk.slice(primary.pk.indexOf("#") + 1), workspace_id: workspaceId};
  const request = principal.request || {ip: null, user_agent: null, request_id: null, method: null, path: null};
  const value = {object_type: "audit_event", schema_version: 1, audit_event_id: `audit_${eventId}`, actor: {issuer: principal.issuer, subject: principal.subject, user_id: userId},
    target_resource: target, before: changes.map(change => ({pk: change.pk, sk: change.sk, state: change.before})),
    after: changes.map(change => ({pk: change.pk, sk: change.sk, state: change.after})), timestamp, ip: request.ip, user_agent: safe(request.user_agent),
    request_id: safe(request.request_id), method: request.method, path: safe(request.path)};
  if (Buffer.byteLength(JSON.stringify(value)) > 100_000) throw new Error("Mutation audit exceeds bounded transaction metadata");
  return record(`AUDIT#${workspaceId || `USER:${userId}`}`, `${timestamp}#${value.audit_event_id}`, value);
}
