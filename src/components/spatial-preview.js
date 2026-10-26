const ns = 'http://www.w3.org/2000/svg';
const number = value => Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : '—';

/** Show an inert, offline derivative supplied by the guarded local original-preview API. */
export function mountSpatialPreview(root, preview, options = {}) {
  const document = root.ownerDocument, listeners = [];
  const node = (tag, text, className) => {const result = document.createElement(tag); if (text !== undefined) result.textContent = String(text); if (className) result.className = className; return result;};
  const listen = (target, event, callback) => {target.addEventListener(event, callback); listeners.push(() => target.removeEventListener(event, callback));};
  const editing = options.editing === true;
  const section = node('section', undefined, 'spatial-preview');
  section.append(node('h3', editing ? 'Map draft' : `${preview?.format || 'Spatial source'} preview`));
  const description = node('dl', undefined, 'spatial-preview-facts');
  const fact = (label, value) => {description.append(node('dt', label), node('dd', value));};
  fact('Coordinate reference', preview?.crs || 'Not established');
  if (preview?.crsOrigin) fact('CRS source', preview.crsOrigin);
  if (preview?.coordinateBasis) fact('Coordinate basis', preview.coordinateBasis);
  if (preview?.status === 'ready' || preview?.featureCount) {fact('Features', preview.featureCount); fact('Coordinates', preview.coordinateCount); fact('Geometry', Object.entries(preview.geometryTypes || {}).map(([key, value]) => `${key}: ${value}`).join('; ') || 'None');}
  if (Array.isArray(preview?.bounds) && preview.bounds.length === 4) fact(preview.geographic ? 'Extent (west, south, east, north)' : 'Extent (minimum X, Y, maximum X, Y)', preview.bounds.map(number).join(', '));
  for (const [key, value] of Object.entries(preview?.summary || {})) if (value !== undefined && value !== null) fact(key.replace(/([a-z])([A-Z])/g, '$1 $2'), Array.isArray(value) ? value.join(', ') : value);
  if (editing) {const details = node('details', undefined, 'spatial-editor-layer-details');details.append(node('summary', 'Layer information'), description);section.append(details);}
  else section.append(description);
  const warnings = node('ul', undefined, 'spatial-preview-warnings');
  for (const text of preview?.warnings || []) warnings.append(node('li', text));
  if (!editing && warnings.childNodes.length) section.append(warnings);
  section.append(node('p', editing ? 'Drag a vertex or edit its coordinates. Save explicitly to retain a new version.' : 'Offline preview. No basemap, external links or remote layers are loaded. The original file is unchanged.', 'spatial-preview-note'));
  root.replaceChildren(section);
  const features = preview?.features;
  if (preview?.status !== 'ready' || !Array.isArray(features) || features.length > 5000 || !Array.isArray(preview.bounds) || !preview.bounds.every(Number.isFinite)) return {dispose() {for (const stop of listeners) stop(); section.remove();}};

  const toolbar = node('div', undefined, 'spatial-preview-toolbar');
  const controls = new Map();
  for (const [action, label] of [['in', 'Zoom in'], ['out', 'Zoom out'], ['fit', 'Fit extent']]) {const button = node('button', label); button.type = 'button'; button.dataset.spatialAction = action; controls.set(action, button); toolbar.append(button);}
  toolbar.append(node('span', 'Drag to pan; use arrow keys or + / − when the graphic is focused.', 'spatial-preview-note'));
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('spatial-preview-canvas'); svg.setAttribute('viewBox', '0 0 1000 500'); svg.setAttribute('role', 'img'); svg.setAttribute('tabindex', '0'); svg.setAttribute('aria-label', `${preview.format} geometry preview. Drag to pan, use plus or minus to zoom, and zero to fit.`);
  if (typeof options.onVertexMove === 'function') {svg.setAttribute('role', 'group');svg.setAttribute('aria-label', `${preview.format} editable geometry. Drag vertex handles to edit; use coordinate controls for keyboard editing. Drag the background to pan, plus or minus to zoom, and zero to fit.`);}
  const title = document.createElementNS(ns, 'title'); title.textContent = 'Local geometry preview'; svg.append(title);
  const plot = document.createElementNS(ns, 'g'); svg.append(plot);
  const bounds = preview.bounds, spanX = bounds[2] - bounds[0], spanY = bounds[3] - bounds[1], scale = Math.min(920 / (spanX || 1), 420 / (spanY || 1)), centerX = bounds[0] + spanX / 2, centerY = bounds[1] + spanY / 2;
  const project = position => {if (!Array.isArray(position) || !position.slice(0, 2).every(Number.isFinite)) throw new Error('Invalid preview geometry.'); return [500 + (position[0] - centerX) * scale, 250 - (position[1] - centerY) * scale];};
  const groups = new Map(); let coordinates = 0;
  const pathFor = (positions, close = false) => positions.map((point, i) => {if (++coordinates > 100000) throw new Error('Preview coordinate limit exceeded.'); const [x, y] = project(point); return `${i ? 'L' : 'M'}${number(x)},${number(y)}`;}).join(' ') + (close ? ' Z' : '');
  function geometry(parent, data, depth = 0) {
    if (!data) return;
    if (depth > 8) throw new Error('Preview geometry nesting limit exceeded.');
    if (data.type === 'GeometryCollection') {data.geometries.forEach(child => geometry(parent, child, depth + 1)); return;}
    if (data.type === 'Point' || data.type === 'MultiPoint') {
      for (const point of data.type === 'Point' ? [data.coordinates] : data.coordinates) {
        if (++coordinates > 100000) throw new Error('Preview coordinate limit exceeded.');
        const [x, y] = project(point), circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', number(x)); circle.setAttribute('cy', number(y)); circle.setAttribute('r', '4'); parent.append(circle);
      }
      return;
    }
    const parts = data.type === 'LineString' ? [data.coordinates] : data.type === 'MultiLineString' || data.type === 'Polygon' ? data.coordinates : data.type === 'MultiPolygon' ? data.coordinates.flat() : null;
    if (!parts) throw new Error('Unsupported preview geometry.');
    const path = document.createElementNS(ns, 'path'), polygon = data.type === 'Polygon' || data.type === 'MultiPolygon';
    path.setAttribute('d', parts.map(part => pathFor(part, polygon)).join(' ')); path.setAttribute('fill-rule', 'evenodd'); path.classList.add(polygon ? 'spatial-preview-area' : 'spatial-preview-line'); parent.append(path);
  }
  try {
    features.forEach((feature, index) => {
      const group = document.createElementNS(ns, 'g'); group.dataset.spatialFeature = String(index); group.classList.add('spatial-preview-feature');
      const title = document.createElementNS(ns, 'title'); title.textContent = String(feature.name || `Feature ${index + 1}`); group.append(title); geometry(group, feature.geometry); plot.append(group); groups.set(String(index), group);
    });
  } catch (error) {section.append(node('p', error.message, 'spatial-preview-warning')); return {dispose() {for (const stop of listeners) stop(); section.remove();}};}
  const label = node('label', 'Feature details '), select = node('select'); select.dataset.spatialFeatureSelect = ''; select.setAttribute('aria-label', 'Spatial feature details');
  const blank = node('option', 'Choose a feature or click its geometry'); blank.value = ''; select.append(blank);
  features.forEach((feature, i) => {const option = node('option', `${i + 1}. ${feature.name || 'Feature'}`); option.value = String(i); select.append(option);});
  label.append(select);
  const details = node('div', undefined, 'spatial-preview-attributes'); details.setAttribute('aria-live', 'polite');
  function choose(value, notify = true) {
    if (notify && options.onFeatureSelect?.(value === '' ? null : Number(value)) === false) {select.value = String(options.selectedFeature ?? '');return;}
    for (const [key, group] of groups) group.classList.toggle('is-selected', key === value);
    select.value = value; details.replaceChildren();
    const feature = features[Number(value)];
    if (value === '' || !feature) return;
    details.append(node('h4', feature.name || 'Feature'));
    const properties = [...(feature.sourceId !== undefined ? [['Source feature ID', feature.sourceId]] : []), ...Object.entries(feature.properties || {})];
    if (!properties.length) {details.append(node('p', 'No feature attributes were included in this preview.')); return;}
    const table = node('table'), body = node('tbody');
    for (const [key, value] of properties.slice(0, 20)) {const row = node('tr'), heading = node('th', key); heading.scope = 'row'; row.append(heading, node('td', String(value).slice(0, 1000))); body.append(row);}
    table.append(body); details.append(table);
  }
  let view = Array.isArray(options.view) && options.view.length === 4 && options.view.every(Number.isFinite) && options.view[2] > 0 && options.view[3] > 0 ? [...options.view] : [0, 0, 1000, 500];
  const applyView = () => svg.setAttribute('viewBox', view.map(number).join(' '));
  applyView();
  // Browser CTM includes the viewBox, CSS size and SVG letterboxing. The
  // fallback uses the same xMidYMid meet transform for non-SVG test DOMs.
  function canvasPoint(event) {
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      try {
        const inverse = matrix.inverse(), x = event.clientX, y = event.clientY;
        return [inverse.a * x + inverse.c * y + inverse.e, inverse.b * x + inverse.d * y + inverse.f];
      } catch {return null;}
    }
    const rect = svg.getBoundingClientRect(), factor = Math.min(rect.width / view[2], rect.height / view[3]);
    if (!Number.isFinite(factor) || factor <= 0) return null;
    return [view[0] + (event.clientX - rect.left - (rect.width - view[2] * factor) / 2) / factor,
      view[1] + (event.clientY - rect.top - (rect.height - view[3] * factor) / 2) / factor];
  }
  const unproject = point => [centerX + (point[0] - 500) / scale, centerY - (point[1] - 250) / scale];
  const handles = new Map();
  if (typeof options.onVertexMove === 'function') for (const [index, vertex] of (options.vertices || []).entries()) {
    const [x, y] = project(vertex.position), handle = document.createElementNS(ns, 'circle');
    handle.classList.add('spatial-editor-vertex'); handle.classList.toggle('is-selected', index === options.selectedVertex);
    handle.dataset.spatialVertex = String(index);handle.setAttribute('cx', number(x));handle.setAttribute('cy', number(y));handle.setAttribute('r', '7');
    handle.setAttribute('tabindex', '0');handle.setAttribute('role', 'button');handle.setAttribute('aria-label', `Select vertex ${index + 1}; edit its coordinates in the vertex controls`);
    svg.append(handle);handles.set(index, handle);
    listen(handle, 'keydown', event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();event.stopPropagation();options.onVertexSelect?.(index);}});
  }
  function zoom(factor) {const width = Math.max(20, Math.min(10000, view[2] * factor)), height = width / 2; view = [view[0] + (view[2] - width) / 2, view[1] + (view[3] - height) / 2, width, height]; applyView();}
  listen(controls.get('in'), 'click', () => zoom(.7)); listen(controls.get('out'), 'click', () => zoom(1 / .7)); listen(controls.get('fit'), 'click', () => {view = [0, 0, 1000, 500]; applyView();});
  listen(select, 'change', () => choose(select.value));
  let drag;
  listen(svg, 'pointerdown', event => {
    if (event.button !== 0) return;
    const vertex = event.target.closest?.('[data-spatial-vertex]'), index = vertex ? Number(vertex.dataset.spatialVertex) : null;
    if (index !== null && options.canEditVertex?.() === false) return;
    drag = {x: event.clientX, y: event.clientY, point: canvasPoint(event), view: [...view], moved: false,
      feature: event.target.closest?.('[data-spatial-feature]')?.dataset.spatialFeature, vertex: index};
    if (index !== null) options.onVertexSelect?.(index);
    svg.setPointerCapture?.(event.pointerId);
  });
  listen(svg, 'pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const point = canvasPoint(event);if (!point) return;
    if (drag.vertex !== null) {
      drag.position = unproject(point);const handle = handles.get(drag.vertex);
      handle.setAttribute('cx', number(point[0]));handle.setAttribute('cy', number(point[1]));return;
    }
    if (!drag.point) return;
    // Evaluate movement against the original view, rather than a view already
    // translated by a prior move event.
    const prior = [...view];view = [...drag.view];applyView();const originalPoint = canvasPoint(event);view = prior;
    if (originalPoint) view = [drag.view[0] - originalPoint[0] + drag.point[0], drag.view[1] - originalPoint[1] + drag.point[1], drag.view[2], drag.view[3]];
    applyView();
  });
  listen(svg, 'pointerup', event => {
    const completed = drag;drag = null;
    try {svg.releasePointerCapture?.(event.pointerId);} catch {}
    if (completed?.vertex !== null && completed?.vertex !== undefined) {
      if (completed.moved && completed.position) options.onVertexMove?.(completed.vertex, completed.position);
    } else if (completed && !completed.moved && completed.feature !== undefined) choose(completed.feature);
  });
  listen(svg, 'pointercancel', () => {drag = null;for (const [index, handle] of handles) {const point = project(options.vertices[index].position);handle.setAttribute('cx', number(point[0]));handle.setAttribute('cy', number(point[1]));}});
  listen(svg, 'keydown', event => {
    const actions = {'+': () => zoom(.7), '=': () => zoom(.7), '-': () => zoom(1 / .7), '0': () => {view = [0, 0, 1000, 500]; applyView();}, ArrowLeft: () => {view[0] -= view[2] * .1; applyView();}, ArrowRight: () => {view[0] += view[2] * .1; applyView();}, ArrowUp: () => {view[1] -= view[3] * .1; applyView();}, ArrowDown: () => {view[1] += view[3] * .1; applyView();}};
    if (actions[event.key]) {event.preventDefault(); actions[event.key]();}
  });
  section.append(toolbar, svg, label, details);
  if (Number.isInteger(options.selectedFeature)) choose(String(options.selectedFeature), false);
  return {getView: () => [...view], dispose() {for (const stop of listeners) stop(); section.remove();}};
}
