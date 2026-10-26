import {AccessError} from "./access-service.mjs";

const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const apiId = /^[a-z0-9]{1,64}$/;
const stage = /^(?:\$default|[A-Za-z0-9_-]{1,128})$/;

// A recovery namespace describes one explicitly configured deployment/store generation.
// It does not enroll a business user or create any content permission.
export function esiaRecoveryDeployment(event, configuration) {
  if (!configuration || configuration.region !== "us-east-1" || typeof configuration.apiId !== "string" || !apiId.test(configuration.apiId) ||
      typeof configuration.stage !== "string" || !stage.test(configuration.stage) || typeof configuration.generation !== "string" || !uuidV4.test(configuration.generation)) {
    throw new AccessError(503, "ESIA recovery deployment is not configured.");
  }
  if (event?.requestContext?.apiId !== configuration.apiId || event?.requestContext?.stage !== configuration.stage) {
    throw new AccessError(401, "The request did not originate from the configured ESIA API and stage.");
  }
  return `aws:apigateway:${configuration.region}:${configuration.apiId}:${configuration.stage}:${configuration.generation}`;
}

export async function createEsiaRecoveryContext({event, configuration, principal, service, now = Date.now}) {
  const deployment = esiaRecoveryDeployment(event, configuration);
  // The existing session projection rechecks current provider and persisted app authority.
  // Never substitute JWT display fields or browser profile values for that projection.
  const context = await service.session(principal);
  if (esiaRecoveryDeployment(event, configuration) !== deployment) throw new AccessError(503, "ESIA recovery deployment changed while loading authority.");
  if (!Number.isFinite(principal.expiresAt) || principal.expiresAt <= now()) {
    throw new AccessError(401, "The ESIA access session expired while loading recovery authority.");
  }
  return {deployment, issuer: principal.issuer, subject: principal.subject, expiresAt: principal.expiresAt, context};
}
