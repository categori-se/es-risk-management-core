export const appUrls = {
  productionOrigin: "https://community.invalid",
  archiveEvidenceOrigin: "https://archive.invalid",
  docsManagerEvidenceOrigin: "https://documents.invalid"
};

export const authDomains = {
  hostedUi: ""
};

export const localPreviewPorts = [3000, 3001, 3002];

export const localPreviewRedirectUris = localPreviewPorts.flatMap((port) => [
  `http://localhost:${port}/`,
  `http://127.0.0.1:${port}/`
]);

export const storageBuckets = {
  publicFrontend: ""
};

export const apiPaths = {
  policyAuditPresign: "/api/policy-audits/presign"
};

// Display helper only. Actual hosted storage is resolved by the authorized
// backend from immutable account IDs, never a browser-maintained bucket map.
export function projectStoragePrefix({accountId, projectId, bucket}) {
  const logical = `tenants/${safeStorageSegment(accountId)}/projects/${safeStorageSegment(projectId)}/`;
  if (bucket === undefined || bucket === null || bucket === "") return `Storage mapping pending: ${logical}`;
  if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9](?![\s\S])/.test(bucket)) throw new TypeError("An explicit reviewed storage bucket is required.");
  return `s3://${bucket}/${logical}`;
}

function safeStorageSegment(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_.=-]/g, "_");
}
