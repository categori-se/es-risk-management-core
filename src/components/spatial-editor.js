import {mountSpatialPreview} from './spatial-preview.js';
import {validateGeoJson, parseGeoJsonData, serializeGeoJsonData, serializeGeoJson, geoJsonFeatures, geoJsonVertices, updateGeoJsonVertex,
  replaceGeoJsonProperties, spatialEditPreview, addGeoJsonFeature, removeGeoJsonFeature} from '../lib/geojson-editing.js';

const editors = new WeakMap();
let sequence = 0;
const hash = /^[a-f0-9]{64}$/;
const clone = value => structuredClone(value);
const display = value => value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);

/** Local source authoring. The caller fixes account/project routing and owns
 * the HTTP operation; this component never fetches a URL or changes an original. */
export function openSpatialEditor({document = globalThis.document, styleSource, title = 'GeoJSON layer', loadContext, save, onClose, onSaved, onBusyChange,requestId} = {}) {
  if (!document?.body || typeof loadContext !== 'function' || typeof save !== 'function') throw new TypeError('A GeoJSON editor requires fixed local context and save callbacks.');
  if(requestId!==undefined&&!(typeof requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId)))throw TypeError('Use an exact owner-bound edit request UUID.');
  const previous = editors.get(document), restoreTarget = previous?.restoreTarget || document.activeElement;
  if (previous && !previous.close({restore:false})) return previous.api;
  const window = document.defaultView, Controller = window.AbortController || globalThis.AbortController, lifetime = new Controller();
  let closed = false, loading = true, saving = false, completed = false, epoch = 0, context, original, draft, baseline, selected = 0, vertexIndex = 0;
  let preview, view, history = [], pendingRequest = null, pendingFields = false, pendingGroup = '', statement = '', closeChoice = false, deleteChoice = false, resetChoice = false, addType = '';
  const id = `spatial-editor-${++sequence}`, listeners = [], background = [];
  const make = (tag, text, className) => {const item = document.createElement(tag);if (text !== undefined) item.textContent = text;if (className) item.className = className;return item;};
  const listen = (target, name, callback) => {target.addEventListener(name, callback);listeners.push(() => target.removeEventListener(name, callback));};
  const button = (label, action) => {const item = make('button', label);item.type = 'button';item.dataset.spatialEditAction = action;return item;};
  const field = (label, input) => {const wrapper = make('label', label);wrapper.append(input);return wrapper;};
  const input = (name, type = 'text') => {const item = make('input');item.name = name;item.type = type;return item;};
  const overlay = make('div', undefined, 'se-overlay'), dialog = make('section', undefined, 'spatial-editor');dialog.dataset.spatialEditor = '';
  dialog.setAttribute('role', 'dialog');dialog.setAttribute('aria-modal', 'true');dialog.setAttribute('aria-labelledby', `${id}-title`);dialog.setAttribute('aria-describedby', `${id}-purpose`);dialog.tabIndex = -1;
  const presentationSource = styleSource?.nodeType === 1 ? styleSource : restoreTarget;
  const themed = presentationSource?.closest?.('[data-theme], [data-app-theme]') || document.body, theme = themed.dataset.theme || themed.dataset.appTheme;if (theme) overlay.dataset.theme = theme;
  const inherited = window.getComputedStyle(presentationSource?.nodeType === 1 ? presentationSource : themed);
  for (const name of ['--lw-ink','--lw-muted','--lw-surface','--lw-raised','--lw-line','--lw-border','--lw-accent','--lw-danger','--app-text','--app-text-muted','--app-surface','--app-surface-raised','--app-border','--app-accent','--app-danger']) {const value = inherited.getPropertyValue(name).trim();if (value) overlay.style.setProperty(name, value);}
  if (inherited.fontFamily) overlay.style.setProperty('--se-font-family', inherited.fontFamily);
  const header = make('header', undefined, 'se-header'), heading = make('h2', String(title).slice(0, 2000));heading.id = `${id}-title`;
  const closeButton = button('Close editor', 'close');header.append(heading, closeButton);
  const purpose = make('p', 'Edit this local GeoJSON layer and save a new version. Existing originals and citations stay attached to their exact versions.', 'se-note');purpose.id = `${id}-purpose`;
  const identity = make('p', 'Loading the exact local source…', 'se-identity'), status = make('p', 'Loading edit context…', 'se-status'), errorBox = make('p', '', 'se-error');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');errorBox.setAttribute('role', 'alert');errorBox.hidden = true;
  const sourceDetails = make('details', undefined, 'se-source-details');sourceDetails.append(make('summary', 'Source version'), identity);
  const content = make('div', undefined, 'se-content'), mapHost = make('div', undefined, 'se-map'), inspector = make('aside', undefined, 'se-inspector');inspector.setAttribute('aria-label', 'Layer editing controls');
  const layerHeading = make('h3', 'Current layer'), featureSelect = make('select');featureSelect.name = 'feature';featureSelect.setAttribute('aria-label', 'Current feature');
  const layerInfo = make('p', '', 'se-note'), vertexSelect = make('select');vertexSelect.name = 'vertex';vertexSelect.setAttribute('aria-label', 'Current vertex');
  const longitude = input('longitude', 'number'), latitude = input('latitude', 'number'), altitude = input('altitude', 'number');
  for (const item of [longitude, latitude, altitude]) item.step = 'any';
  const positionBox = make('fieldset'), positionLegend = make('legend', 'Vertex coordinates');positionBox.append(positionLegend, field('Vertex', vertexSelect), field('Longitude / X', longitude), field('Latitude / Y', latitude), field('Altitude / Z', altitude), button('Apply coordinates', 'apply-position'));
  const properties = make('textarea');properties.name = 'properties';properties.rows = 8;properties.spellcheck = false;properties.setAttribute('aria-describedby', `${id}-properties-note`);
  const propertyNote = make('p', 'JSON values retain their types. Text, numbers, booleans, arrays, objects and null remain data; links and markup do not run.', 'se-note');propertyNote.id = `${id}-properties-note`;
  const propertiesBox = make('fieldset'), propertiesLegend = make('legend', 'Feature properties');propertiesBox.append(propertiesLegend, field('Properties as JSON', properties), propertyNote, button('Apply properties', 'apply-properties'));
  const addBox = make('fieldset'), addLegend = make('legend', 'Add a feature'), addButtons = make('div', undefined, 'se-actions');addButtons.append(button('Add point', 'add-point'), button('Add line', 'add-line'), button('Add polygon', 'add-polygon'));addBox.append(addLegend, addButtons);
  const addForm = make('div', undefined, 'se-add-form'), addInstructions = make('p', '', 'se-note'), addCoordinates = make('textarea'), addProperties = make('textarea');addCoordinates.name = 'new-coordinates';addCoordinates.rows = 4;addProperties.name = 'new-properties';addProperties.rows = 3;addProperties.value = '{}';
  addForm.hidden = true;addForm.append(addInstructions, field('Coordinates as JSON', addCoordinates), field('New feature properties as JSON', addProperties), button('Add this feature', 'confirm-add'), button('Cancel addition', 'cancel-add'));addBox.append(addForm);
  const editActions = make('div', undefined, 'se-actions');editActions.append(button('Delete selected feature', 'delete'), button('Undo last edit', 'undo'), button('Reset draft', 'reset'));
  const deleteBox = make('div', undefined, 'se-choice');deleteBox.hidden = true;deleteBox.append(make('p', 'Delete the selected feature from this draft? The retained original stays unchanged.'), button('Delete feature from draft', 'confirm-delete'), button('Keep feature', 'cancel-delete'));
  const resetBox = make('div', undefined, 'se-choice');resetBox.hidden = true;resetBox.append(make('p', 'Reset all draft edits to the loaded original?'), button('Reset to original', 'confirm-reset'), button('Keep draft', 'cancel-reset'));
  inspector.append(layerHeading, field('Feature', featureSelect), layerInfo, positionBox, propertiesBox, addBox, editActions, deleteBox, resetBox);content.append(mapHost, inspector);content.hidden = true;
  const footer = make('footer', undefined, 'se-footer'), statementInput = make('textarea');statementInput.name = 'statement';statementInput.rows = 2;statementInput.maxLength = 2000;
  const saveButton = button('Save new version', 'save');footer.append(field('Describe this change (required)', statementInput), saveButton);footer.hidden = true;
  const discardBox = make('div', undefined, 'se-choice se-close-choice');discardBox.hidden = true;discardBox.setAttribute('role', 'group');discardBox.setAttribute('aria-label', 'Unsaved draft');discardBox.append(make('p', 'This editor has unsaved work. Discard it and close, or keep editing? Closing a pending save cannot undo a version already saved by the server.'), button('Discard draft and close', 'discard'), button('Keep editing', 'keep-editing'));
  dialog.append(header, purpose, sourceDetails, status, errorBox, content, footer, discardBox);overlay.append(dialog);document.body.append(overlay);
  for (const element of [...document.body.children]) if (element !== overlay) {background.push({element, inert:element.getAttribute('inert'), hidden:element.getAttribute('aria-hidden')});element.setAttribute('inert', '');element.setAttribute('aria-hidden', 'true');}
  const bodyClass = document.body.classList.contains('se-modal-open');document.body.classList.add('se-modal-open');closeButton.focus();
  const working = () => !closed && (loading || saving);
  const hasDraft = () => !closed && !completed && Boolean(draft && (serializeGeoJson(draft) !== baseline || pendingFields || statement.trim() || addType));
  const setError = message => {errorBox.textContent = String(message || '').slice(0, 4000);errorBox.hidden = !message;};
  function busyChanged() {onBusyChange?.(working());dialog.setAttribute('aria-busy', String(working()));}
  function controls() {
    const blocked = working() || completed;
    for (const item of [...content.querySelectorAll('input,select,textarea,button'), statementInput]) item.disabled = blocked;
    saveButton.disabled = blocked || !draft || !hasDraft();
    dialog.querySelector('[data-spatial-edit-action="undo"]').disabled = blocked || pendingFields || !history.length;
    dialog.querySelector('[data-spatial-edit-action="delete"]').disabled = blocked || !geoJsonFeatures(draft || {type:'FeatureCollection',features:[]}).length;
    if (!blocked) {for (const item of positionBox.querySelectorAll('input,select,button')) item.disabled = !vertices().length || pendingGroup === 'properties';altitude.disabled = pendingGroup === 'properties' || !vertices()[vertexIndex] || vertices()[vertexIndex].position.length < 3;for (const item of propertiesBox.querySelectorAll('textarea,button')) item.disabled = pendingGroup === 'position' || !draft || !['Feature','FeatureCollection'].includes(draft.type) || !features()[selected];}
    deleteBox.hidden = !deleteChoice;resetBox.hidden = !resetChoice;discardBox.hidden = !closeChoice;addForm.hidden = !addType;
  }
  const features = () => draft ? geoJsonFeatures(draft) : [];
  const vertices = () => draft && features()[selected] ? geoJsonVertices(draft, selected) : [];
  function updateVertexFields() {
    const list = vertices();vertexIndex = Math.min(vertexIndex, Math.max(0, list.length - 1));vertexSelect.replaceChildren();
    list.forEach((vertex, index) => {const option = make('option', `${index + 1}. ${vertex.path.join(' / ')}`);option.value = String(index);vertexSelect.append(option);});vertexSelect.value = String(vertexIndex);
    const position = list[vertexIndex]?.position || [];longitude.value = position[0] === undefined ? '' : serializeGeoJsonData(position[0]).trimEnd();latitude.value = position[1] === undefined ? '' : serializeGeoJsonData(position[1]).trimEnd();altitude.value = position[2] === undefined ? '' : serializeGeoJsonData(position[2]).trimEnd();
    for (const handle of mapHost.querySelectorAll('[data-spatial-vertex]')) {handle.dataset.spatialVertexHandle = '';handle.classList.toggle('is-selected', Number(handle.dataset.spatialVertex) === vertexIndex);}
  }
  function render() {
    if (!draft || closed) return;
    const list = features();selected = Math.min(selected, Math.max(0, list.length - 1));featureSelect.replaceChildren();
    list.forEach((feature, index) => {const option = make('option', `${index + 1}. ${display(feature.properties?.name ?? feature.properties?.title ?? feature.id ?? feature.geometry?.type ?? 'Empty geometry')}`);option.value = String(index);featureSelect.append(option);});featureSelect.value = String(selected);
    layerInfo.textContent = `${list.length} feature${list.length === 1 ? '' : 's'} · ${list[selected]?.geometry?.type || 'No geometry'}${list[selected]?.id !== undefined ? ` · ID ${String(list[selected].id)}` : ''}`;
    properties.value = serializeGeoJsonData(list[selected]?.properties ?? null).trimEnd();view = preview?.getView?.() || view;preview?.dispose();
    preview = mountSpatialPreview(mapHost, spatialEditPreview(draft), {editing:true,view, selectedFeature:list.length ? selected : undefined, selectedVertex:vertexIndex, vertices:vertices(),canEditVertex:() => !closed && !working() && !completed && !pendingFields,
      onFeatureSelect:index => {if (index === null || saving || completed) return false;if (pendingFields) {setError('Apply the coordinate or property fields before selecting another feature.');return false;}selected = index;vertexIndex = 0;deleteChoice = false;render();return true;},
      onVertexSelect:index => {if (saving || completed) return;if (pendingFields) {setError('Apply the coordinate or property fields before selecting another vertex.');return;}vertexIndex = index;updateVertexFields();controls();},
      onVertexMove:(index, position) => {if (closed || saving || completed || pendingFields) return;attempt(() => change(updateGeoJsonVertex(draft, selected, vertices()[index].path, position), 'Moved vertex. Review coordinates before saving.'));}});
    updateVertexFields();controls();
  }
  function change(next, message) {
    const validated = validateGeoJson(next);if (serializeGeoJson(validated) === serializeGeoJson(draft)) return;
    history.push(clone(draft));if (history.length > 30) history.shift();draft = validated;pendingFields = false;pendingGroup = '';deleteChoice = false;resetChoice = false;setError('');status.textContent = message || 'Draft changed. Save a new version to retain this edit.';render();
  }
  function attempt(action) {try {action();return true;} catch (error) {setError(error.message || 'This change is invalid.');return false;}}
  const numeric = (item, label) => {let value;try {value = parseGeoJsonData(item.value);} catch (error) {throw Error(`${label}: ${error.message}`);}if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`${label} must be a finite JSON number.`);return value;};
  function applyPosition() {
    const vertex = vertices()[vertexIndex];if (!vertex) throw Error('Select a vertex to edit.');
    const position = [numeric(longitude, 'Longitude / X'), numeric(latitude, 'Latitude / Y')];if (vertex.position.length === 3) position.push(numeric(altitude, 'Altitude / Z'));
    change(updateGeoJsonVertex(draft, selected, vertex.path, position), 'Coordinates applied to the draft.');pendingFields = false;pendingGroup = '';render();
  }
  function applyProperties() {change(replaceGeoJsonProperties(draft, selected, parseGeoJsonData(properties.value)), 'Properties applied to the draft.');pendingFields = false;pendingGroup = '';render();}
  async function saveDraft() {
    if (closed || working() || completed || !draft) return false;
    if (pendingFields || addType) {setError('Apply or cancel the pending field changes before saving.');return false;}
    if (!statement.trim()) {setError('Describe the change before saving a new version.');statementInput.focus();return false;}
    if (serializeGeoJson(draft) === baseline) {setError('Change the layer before saving a new version.');return false;}
    const validated = validateGeoJson(draft), fingerprint = serializeGeoJson(validated) + '\n' + statement.trim();
    if (!pendingRequest || pendingRequest.fingerprint !== fingerprint) pendingRequest = {fingerprint, payload:{schemaVersion:1,resourceId:context.resourceId,baseVersionId:context.baseVersionId,baseSha256:context.baseSha256,requestId:requestId||window.crypto.randomUUID(),geojson:validated,statement:statement.trim()}};
    const request = pendingRequest, generation = ++epoch;saving = true;setError('');status.textContent = 'Saving a new version…';controls();busyChanged();
    try {
      const result = await save(clone(request.payload), {expectedRevision:context.baseProjectRevision, signal:lifetime.signal});
      if (closed || epoch !== generation) return false;
      const receipt = result?.receipt;
      if (!result?.project || result.project.id !== context.projectId || !Number.isSafeInteger(result.project.revision) || result.project.revision <= context.baseProjectRevision ||
          receipt?.format !== 'esia-source-edit-receipt' || receipt.schemaVersion !== 1 || receipt.projectId !== context.projectId || receipt.resourceId !== context.resourceId ||
          receipt.baseVersionId !== context.baseVersionId || receipt.baseSha256 !== context.baseSha256 || receipt.requestId !== request.payload.requestId ||
          typeof receipt.versionId !== 'string' || !receipt.versionId || receipt.versionId === context.baseVersionId || typeof receipt.sha256 !== 'string' || !hash.test(receipt.sha256) || receipt.projectRevision !== context.baseProjectRevision + 1) throw Error('The save acknowledgement does not identify this exact edit and its new retained version. Retry the exact save to check its receipt.');
      completed = true;pendingFields = false;history = [];status.textContent = `Saved new version ${result.receipt.versionId}. Close this editor to inspect the saved version or start another edit.`;setError('');
      onSaved?.(result);return true;
    } catch (error) {if (!closed && epoch === generation) {setError(error.message || 'The save could not be confirmed.');status.textContent = Number(error.status || error.statusCode) === 409 ? 'The source or project changed. Your draft is retained. Close and reopen the current source before starting a new edit.' : 'Save was not confirmed. Your draft is retained; retrying unchanged work sends the same request identity.';}return false;}
    finally {if (!closed && epoch === generation) {saving = false;controls();busyChanged();}}
  }
  function close({force = false, restore = true} = {}) {
    if (closed) return false;
    if (!force && (hasDraft() || saving)) {closeChoice = true;controls();dialog.querySelector('[data-spatial-edit-action="keep-editing"]').focus();return false;}
    closed = true;epoch++;lifetime.abort();preview?.dispose();for (const stop of listeners) stop();overlay.remove();
    for (const {element,inert,hidden} of background) {if (inert === null) element.removeAttribute('inert');else element.setAttribute('inert', inert);if (hidden === null) element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden', hidden);}
    if (!bodyClass) document.body.classList.remove('se-modal-open');if (editors.get(document)?.overlay === overlay) editors.delete(document);
    if (restore && restoreTarget?.isConnected) restoreTarget.focus();onBusyChange?.(false);onClose?.();return true;
  }
  listen(overlay, 'click', event => {
    if (event.target === overlay) {close();return;}
    const action = event.target.closest?.('[data-spatial-edit-action]')?.dataset.spatialEditAction;if (!action || closed) return;
    if (action === 'close') {close();return;}if (action === 'discard') {close({force:true});return;}if (action === 'keep-editing') {closeChoice = false;controls();closeButton.focus();return;}
    if (working() || completed) return;
    attempt(() => {
      if (action === 'save') {void saveDraft();return;}
      if (action === 'apply-position') applyPosition();
      else if (action === 'apply-properties') applyProperties();
      else if (action === 'undo') {if (history.length) {draft = history.pop();pendingFields = false;pendingGroup = '';setError('');status.textContent = 'Undid the last draft edit.';render();}}
      else if (action === 'reset') {resetChoice = true;controls();}
      else if (action === 'confirm-reset') {draft = clone(original);history = [];pendingFields = false;pendingGroup = '';pendingRequest = null;statement = '';statementInput.value = '';addType = '';resetChoice = false;setError('');status.textContent = 'Draft reset to the loaded original.';render();}
      else if (action === 'cancel-reset') {resetChoice = false;controls();}
      else if (action === 'delete') {if (pendingFields) throw Error('Apply pending fields before deleting a feature.');deleteChoice = true;controls();}
      else if (action === 'cancel-delete') {deleteChoice = false;controls();}
      else if (action === 'confirm-delete') change(removeGeoJsonFeature(draft, selected), 'Feature removed from the draft.');
      else if (['add-point','add-line','add-polygon'].includes(action)) {if (pendingFields) throw Error('Apply pending fields before adding a feature.');addType = {'add-point':'Point','add-line':'LineString','add-polygon':'Polygon'}[action];addInstructions.textContent = addType === 'Point' ? 'Enter one position [longitude, latitude] (optional third altitude).' : addType === 'LineString' ? 'Enter an array of at least two positions [[longitude, latitude], …].' : 'Enter an array of closed rings [[[longitude, latitude], …]]. Each ring needs at least four positions with equal first and last positions.';addCoordinates.value = '';addProperties.value = '{}';controls();addCoordinates.focus();}
      else if (action === 'cancel-add') {addType = '';controls();}
      else if (action === 'confirm-add') {const next = addGeoJsonFeature(draft, {geometry:{type:addType,coordinates:parseGeoJsonData(addCoordinates.value)},properties:parseGeoJsonData(addProperties.value)});addType = '';selected = geoJsonFeatures(next).length - 1;vertexIndex = 0;change(next, 'New feature added to the draft.');}
    });
  });
  for (const item of [longitude, latitude, altitude, properties]) listen(item, 'input', () => {pendingFields = true;pendingGroup = item === properties ? 'properties' : 'position';status.textContent = 'Field changes are pending. Apply them before saving or selecting another feature.';controls();});
  listen(statementInput, 'input', () => {statement = statementInput.value;controls();});
  listen(featureSelect, 'change', () => {if (pendingFields) {featureSelect.value = String(selected);setError('Apply pending fields before selecting another feature.');return;}selected = Number(featureSelect.value);vertexIndex = 0;deleteChoice = false;render();});
  listen(vertexSelect, 'change', () => {if (pendingFields) {vertexSelect.value = String(vertexIndex);setError('Apply pending fields before selecting another vertex.');return;}vertexIndex = Number(vertexSelect.value);updateVertexFields();controls();});
  listen(document, 'keydown', event => {
    if (closed) return;if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();close();return;}if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(item => item.tabIndex >= 0 && !item.disabled && !item.closest('[hidden]'));
    const first = items[0], last = items.at(-1);if (!first) {event.preventDefault();dialog.focus();}else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {event.preventDefault();last.focus();}else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {event.preventDefault();first.focus();}
  });
  listen(document, 'focusin', event => {if (!closed && !dialog.contains(event.target)) closeButton.focus();});
  busyChanged();
  const ready = (async () => {
    const generation = ++epoch;
    try {
      const value = await loadContext({signal:lifetime.signal});if (closed || generation !== epoch) return false;
      if (value?.format !== 'esia-geojson-edit-context' || value.schemaVersion !== 1 || !['projectId','resourceId','baseVersionId'].every(key => typeof value[key] === 'string' && value[key]) || typeof value.baseSha256 !== 'string' || !hash.test(value.baseSha256) || !Number.isSafeInteger(value.baseProjectRevision) || value.baseProjectRevision < 1) throw Error('The local edit context has an invalid exact source identity.');
      context = clone(value);original = validateGeoJson(value.geojson);draft = clone(original);baseline = serializeGeoJson(original);
      identity.textContent = `Project ${context.projectId} · Base version ${context.baseVersionId} · SHA256 ${context.baseSha256} · Project revision ${context.baseProjectRevision}`;
      content.hidden = false;footer.hidden = false;status.textContent = 'Select a feature and vertex. Drag a vertex handle or apply coordinate and property edits; save explicitly to retain a new version.';render();return true;
    } catch (error) {if (!closed && generation === epoch) {setError(error.message || 'This source could not be opened for editing.');status.textContent = 'The original is unchanged. Close the editor and reopen its document record.';}return false;}
    finally {if (!closed && generation === epoch) {loading = false;controls();busyChanged();}}
  })();
  const api = {ready, close, dispose:() => close({force:true}), hasDraft, hasPendingWork:working, save:saveDraft};
  editors.set(document, {overlay,restoreTarget,close,api});return api;
}
