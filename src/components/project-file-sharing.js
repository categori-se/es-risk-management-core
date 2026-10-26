const h = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const option = (value, label, selected = '', disabled = false) => `<option value="${h(value)}"${value === selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${h(label)}</option>`;
const marker = 'urn:esia:local-share';

/** Account-owned file references use the same exact versions as the document
 * library. The selected account is supplied by the parent's guarded request. */
export function mountProjectFileSharing(root, {getProject, getAccountId, request, onBusyChange, updated, openVersion, state = {}}) {
  const projectId = getProject()?.id, accountId = getAccountId(), boundary = `${accountId}:${projectId}`;
  if (state.boundary !== boundary) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {boundary, open: false, loaded: false, busy: false, accounts: [], identities: [], outgoing: [], incoming: [], draft: {versionId: '', destination: '', purpose: ''}, search: '', message: '', error: false});
  }
  let disposed = false;
  const sameBoundary = () => state.boundary === boundary && getAccountId() === accountId && getProject()?.id === projectId;
  const path = `/api/projects/${encodeURIComponent(projectId)}/shares`;
  const versions = () => (getProject()?.resources || []).flatMap(resource => resource.versions.map(version => ({resource, version})));
  const selectable = version => version.mode === 'managed' && version.availability === 'available' && version.externalReference?.authority !== marker;
  const account = () => state.accounts.find(item => item.id === accountId);
  const identity = () => state.identities.find(item => item.id === getProject()?.projectContext?.identity.id);
  function destinations() {
    return (identity()?.facets || []).flatMap(facet => {
      const owner = state.accounts.find(item => item.id === facet.accountId);
      return owner?.custodyId && !(facet.accountId === accountId && facet.projectId === projectId) ? [{key: `${facet.accountId}/${facet.projectId}`, facet, owner}] : [];
    });
  }
  const accountName = custodyId => state.accounts.find(item => item.custodyId === custodyId)?.name || `Account ${custodyId}`;
  function ownerName(owner) {
    if (owner.type === 'account') return accountName(owner.accountId);
    const name = state.identities.find(item => item.id === owner.identityId)?.name;
    return `Practitioner project records${name ? ` — ${name}` : ''}`;
  }
  function targetName(target) {
    const facet = state.identities.flatMap(item => item.facets || []).find(facet => facet.projectId === target.projectId && state.accounts.find(item => item.id === facet.accountId)?.custodyId === target.accountId);
    return `${accountName(target.accountId)}${facet ? ` — ${facet.transactionName}` : ` · project ${target.projectId}`}`;
  }
  const owned = share => share.owner.type === 'account' && share.owner.accountId === account()?.custodyId && share.owner.projectId === projectId;
  function versionOptions() {
    const search = state.search.trim().toLowerCase();
    return option('', 'Choose an exact original version', state.draft.versionId) + versions().filter(({resource, version}) => !search || [resource.title, version.effectiveMetadata?.title, version.filename, version.id, version.sha256].join(' ').toLowerCase().includes(search) || version.id === state.draft.versionId).map(({resource, version}) =>
      option(version.id, `${version.effectiveMetadata?.title || version.intakeMetadata?.title || resource.title} · ${version.filename} · ${version.sha256.slice(0, 12)}${selectable(version) ? '' : ' · unavailable for onward sharing'}`, state.draft.versionId, !selectable(version))).join('');
  }
  function pinMarkup() {
    const found = versions().find(item => item.version.id === state.draft.versionId);
    return found ? `<dl class="lw-details"><dt>Exact version</dt><dd><code>${h(found.version.id)}</code></dd><dt>SHA256</dt><dd><code>${h(found.version.sha256)}</code></dd><dt>File</dt><dd>${h(found.version.filename)} · ${h(found.version.mediaType)} · ${h(found.version.size)} bytes</dd></dl>` : '<p class="lw-small">Earlier versions remain separate choices. Registered references and unavailable files cannot be shared onward.</p>';
  }
  function card(share, direction) {
    const registered = versions().find(({version}) => version.externalReference?.authority === marker && version.externalReference.resource_id === share.id)?.version;
    const sourceHere = direction === 'outgoing' && versions().some(({version}) => version.id === share.sourceVersionId);
    const canOpen = sourceHere || registered;
    return `<article class="lw-record" data-share-record="${h(share.id)}" data-share-direction="${direction}"><h4>${h(share.title || share.filename)}</h4><p><strong>${h(share.status === 'active' ? 'Active reference' : 'Revoked reference')}</strong> · ${h(share.filename)}</p>
      <dl class="lw-details"><dt>File owner</dt><dd>${h(ownerName(share.owner))}</dd><dt>Destination</dt><dd>${h(targetName(share.target))}</dd><dt>Allowed purpose</dt><dd>${h(share.purpose)}</dd><dt>Permission</dt><dd>Read this exact version by reference. No managed copy or onward sharing.</dd><dt>Source version</dt><dd><code>${h(share.sourceVersionId)}</code></dd><dt>SHA256</dt><dd><code>${h(share.sha256)}</code></dd></dl>
      <details><summary>Reference identity and dates</summary><p class="lw-small">Grant <code>${h(share.id)}</code> · revision ${h(share.revision)}<br>Created ${h(share.createdAt)}${share.revokedAt ? `<br>Revoked ${h(share.revokedAt)}` : ''}<br>Owner project <code>${h(share.sourceProjectId)}</code>${registered ? `<br>Registered version <code>${h(registered.id)}</code>` : ''}</p></details>
      <div class="lw-actions">${canOpen && openVersion ? `<button type="button" data-share-action="open-version" data-version-id="${h(sourceHere ? share.sourceVersionId : registered.id)}">Find ${sourceHere ? 'source' : 'registered file'} in documents</button>` : ''}${direction === 'outgoing' && owned(share) && share.status === 'active' ? `<button type="button" data-share-action="revoke" data-share-id="${h(share.id)}">Revoke reference</button>` : ''}${direction === 'incoming' && share.status === 'active' && (!registered || registered.availability !== 'available') ? `<button type="button" data-share-action="register" data-share-id="${h(share.id)}">Register reference in this review</button>` : ''}</div></article>`;
  }
  function render() {
    if (disposed) return;
    if (!sameBoundary()) {root.textContent = 'Open the account and project used by these sharing controls.';return;}
    const choices = destinations(), context = getProject()?.projectContext;
    root.innerHTML = `<header><h2>File sharing</h2><p>Choose a retained source version and a client review. Sharing registers a read-only reference; the owning project keeps the original.</p></header>
      <details data-sharing-disclosure${state.open ? ' open' : ''}><summary>Share file references and review permissions</summary><p class="lw-small">No files are shared automatically. Revocation stops future service reads; it cannot recall bytes someone already read.</p>
      <p data-share-status role="${state.error ? 'alert' : 'status'}" aria-live="polite"${state.error ? ' class="lw-error"' : ''}>${h(state.message || (state.loaded ? 'Choose an exact source and a destination review.' : 'Open these controls to load sharing records.'))}</p>
      <div class="lw-actions"><button type="button" data-share-action="refresh">Refresh sharing records</button></div>
      ${state.loaded ? `${!context ? '<p class="lw-note">Link this account review to its real-world project identity before selecting another review as a destination.</p>' : ''}
      <form data-share-form class="lw-form lw-grid"><label><span>Find a file version</span><input type="search" data-share-search value="${h(state.search)}" placeholder="Title, filename, version ID or hash"></label><label><span>Exact source version</span><select name="versionId" required>${versionOptions()}</select></label><div class="lw-wide" data-share-source-pin>${pinMarkup()}</div>
      <label class="lw-wide"><span>Destination review for ${h(context?.identity.name || 'this project')}</span><select name="destination" required>${option('', choices.length ? 'Choose another account review' : 'No other linked review is available', state.draft.destination)}${choices.map(item => option(item.key, `${item.owner.name} — ${item.facet.transactionName}`, state.draft.destination)).join('')}</select></label>
      <label class="lw-wide"><span>Allowed purpose</span><textarea name="purpose" maxlength="2000" rows="3" required placeholder="Describe why this exact version is needed in the destination review.">${h(state.draft.purpose)}</textarea></label><button type="submit"${!choices.length || !versions().some(({version}) => selectable(version)) ? ' disabled data-share-unavailable' : ''}>Share and register reference</button></form>
      <section aria-label="Outgoing file references"><h3>Shared from this account review</h3>${state.outgoing.map(share => card(share, 'outgoing')).join('') || '<p>No outgoing file references.</p>'}</section>
      <section aria-label="Incoming file references"><h3>Shared with this account review</h3>${state.incoming.map(share => card(share, 'incoming')).join('') || '<p>No incoming file references.</p>'}</section>` : ''}</details>`;
    for (const control of root.querySelectorAll('button,input,textarea,select')) control.disabled = state.busy || control.hasAttribute('data-share-unavailable');
  }
  function notify() {state._render?.();state._onBusyChange?.(state.busy);}
  async function refresh() {
    const results = await Promise.all([request('/api/storage-accounts'), request('/api/project-directory'), request(`${path}?direction=outgoing`), request(`${path}?direction=incoming`)]);
    if (state.boundary !== boundary || !sameBoundary()) return;
    state.accounts = results[0];state.identities = results[1].identities;state.outgoing = results[2].shares;state.incoming = results[3].shares;state.loaded = true;
  }
  async function run(work) {
    if (state.busy || !sameBoundary()) return;
    state.busy = true;state.error = false;notify();
    try {await work();}
    catch (error) {if (state.boundary === boundary) {state.message = error.message || 'File sharing could not be updated.';state.error = true;}}
    finally {if (state.boundary === boundary) {state.busy = false;notify();}}
  }
  const onInput = event => {
    if (!event.target.closest('[data-share-form]')) return;event.stopPropagation();
    if (event.target.matches('[data-share-search]')) {
      state.search = event.target.value;root.querySelector('select[name="versionId"]').innerHTML = versionOptions();
    } else if (Object.hasOwn(state.draft, event.target.name)) state.draft[event.target.name] = event.target.value;
  };
  const onChange = event => {
    if (!event.target.closest('[data-share-form]')) return;event.stopPropagation();
    if (Object.hasOwn(state.draft, event.target.name)) state.draft[event.target.name] = event.target.value;
    if (event.target.name === 'versionId') root.querySelector('[data-share-source-pin]').innerHTML = pinMarkup();
  };
  const onToggle = event => {
    if (!event.target.matches('[data-sharing-disclosure]')) return;
    state.open = event.target.open;
    if (state.open && !state.loaded && !state.busy) void run(refresh);
  };
  const onSubmit = event => {
    if (!event.target.matches('[data-share-form]')) return;event.preventDefault();event.stopPropagation();
    const form = event.target, data = new root.ownerDocument.defaultView.FormData(form);
    const draft = {versionId: String(data.get('versionId') || ''), destination: String(data.get('destination') || ''), purpose: String(data.get('purpose') || '').trim()};state.draft = draft;
    void run(async () => {
      const source = versions().find(({version}) => version.id === draft.versionId), choice = destinations().find(item => item.key === draft.destination);
      if (!source || !selectable(source.version)) throw new Error('Choose an available managed original version.');
      if (!choice) throw new Error('Choose a linked destination review for this project.');
      if (!draft.purpose || draft.purpose.length > 2000) throw new Error('Record the allowed purpose, up to 2000 characters.');
      await request(path, {method: 'POST', body: {versionId: draft.versionId, target: {accountId: choice.owner.custodyId, projectId: choice.facet.projectId}, purpose: draft.purpose}});
      if (state.boundary !== boundary) return;
      state.draft = {versionId: '', destination: '', purpose: ''};state.message = `Exact file reference registered in ${choice.owner.name}. The original stays in this account.`;
      if (sameBoundary()) {try {await refresh();} catch {state.message += ' Refresh sharing records to update the listing.';}}
    });
  };
  const onClick = event => {
    const button = event.target.closest('[data-share-action]');if (!button) return;event.preventDefault();event.stopPropagation();
    const action = button.dataset.shareAction;
    if (action === 'open-version') {if (!state.busy) openVersion?.(button.dataset.versionId);return;}
    void run(async () => {
      if (action === 'refresh') {await refresh();if (sameBoundary()) state.message = 'File sharing records refreshed.';return;}
      const shareId = button.dataset.shareId;
      if (action === 'revoke') {
        const share = state.outgoing.find(item => item.id === shareId);
        if (!share || !owned(share) || share.status !== 'active') throw new Error('Only the owning account review can revoke this reference.');
        await request(`${path}/${encodeURIComponent(share.id)}/revoke`, {method: 'POST', body: {expectedRevision: share.revision}});
        if (state.boundary !== boundary) return;state.message = 'Reference revoked. The destination can no longer read this original through the local service.';
      } else if (action === 'register') {
        const share = state.incoming.find(item => item.id === shareId);if (!share || share.status !== 'active') throw new Error('This incoming reference is unavailable.');
        await request(`${path}/${encodeURIComponent(share.id)}/register`, {method: 'POST', body: {expectedRevision: getProject().revision}});
        if (state.boundary !== boundary) return;state.message = 'The exact shared reference is registered in this review.';
        if (sameBoundary()) await updated?.(projectId, accountId);
      }
      if (sameBoundary()) {try {await refresh();} catch {state.message += ' Refresh sharing records to update the listing.';}}
    });
  };
  state._render = render;state._onBusyChange = onBusyChange;
  root.addEventListener('input', onInput);root.addEventListener('change', onChange);root.addEventListener('click', onClick);root.addEventListener('submit', onSubmit);root.addEventListener('toggle', onToggle, true);
  render();onBusyChange?.(state.busy);
  const ready = state.open && !state.loaded && !state.busy ? run(refresh) : Promise.resolve();
  return {ready, refresh: () => run(refresh), hasDraft: () => Boolean(state.draft.versionId || state.draft.destination || state.draft.purpose), hasPendingWork: () => state.busy,
    dispose() {disposed = true;root.removeEventListener('input', onInput);root.removeEventListener('change', onChange);root.removeEventListener('click', onClick);root.removeEventListener('submit', onSubmit);root.removeEventListener('toggle', onToggle, true);if (state._render === render) {delete state._render;delete state._onBusyChange;}if (!state.busy) onBusyChange?.(false);}};
}
