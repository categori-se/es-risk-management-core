import {isDeepStrictEqual} from 'node:util';

export const downloadChunkBytes = 512 * 1024;
const validVersion = value => typeof value === 'string' && value && value !== 'null' && value.length <= 500 && !/[\x00-\x1f\x7f]/.test(value);

// Selectors identify app resources. Neither URLs nor provider addresses are capabilities.
export function createMediatedDownloads({artifact, review, readObjectRange, storage, fail}) {
  return async (principal, body) => {
    const fields = ['kind', 'artifact_id', 'project_id', 'policy_review_id', 'edition_id', 'legacy', 'configuration_revision', 'version_id', 'sha256', 'size_bytes', 'offset', 'length'];
    if (!body || Object.keys(body).some(key => !fields.includes(key)) || !['document', 'review'].includes(body.kind) ||
        !Number.isSafeInteger(body.offset) || body.offset < 0 || !Number.isSafeInteger(body.length) || body.length < 1 || body.length > downloadChunkBytes ||
        !Number.isSafeInteger(body.size_bytes) || body.size_bytes < 1 || body.offset + body.length > body.size_bytes ||
        !validVersion(body.version_id) || !/^[a-f0-9]{64}$/.test(body.sha256)) fail(400, 'An exact bounded download range and immutable manifest are required.');
    const wrongFields = body.kind === 'document' ? ['project_id', 'policy_review_id', 'edition_id', 'legacy'] : ['artifact_id'];
    if (wrongFields.some(key => Object.hasOwn(body, key)) || Object.hasOwn(body, 'legacy') && body.legacy !== true ||
        Object.hasOwn(body, 'edition_id') && (typeof body.edition_id !== 'string' || !body.edition_id)) fail(400, 'The selector must identify one exact app resource.');
    const select = body.kind === 'document' ? () => artifact(principal, {artifact_id: body.artifact_id, configuration_revision: body.configuration_revision})
      : () => review(principal, {project_id: body.project_id, policy_review_id: body.policy_review_id, configuration_revision: body.configuration_revision,
        ...(body.edition_id ? {edition_id: body.edition_id} : {}), ...(body.legacy === true ? {legacy: true} : {})});
    const original = await select();
    if (original.version_id !== body.version_id || original.sha256 !== body.sha256 || original.size_bytes !== body.size_bytes) fail(409, 'The selected download manifest changed.');
    if (typeof readObjectRange !== 'function') fail(503, 'Authenticated private downloads are not configured.');
    const {bucket} = storage.forKey(original.key);
    const bytes = await readObjectRange({bucket, key: original.key, versionId: original.version_id, sizeBytes: original.size_bytes, offset: body.offset, length: body.length});
    // A provider response obtained before revocation must not escape after it.
    const current = await select();
    if (!isDeepStrictEqual(current, original)) fail(409, 'Download authority or resource configuration changed.');
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== body.length) fail(409, 'The provider returned an unexpected download range.');
    return {version_id: original.version_id, sha256: original.sha256, size_bytes: original.size_bytes, offset: body.offset, length: body.length,
      bytes_base64: Buffer.from(bytes).toString('base64')};
  };
}
