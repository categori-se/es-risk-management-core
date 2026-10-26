// Full-source GeoJSON editing. Display projections never become saved source.
// Structural validity is checked; this is not survey, topology or CRS conversion.
export const geojsonEditLimits = Object.freeze({bytes: 2 * 1024 * 1024, features: 1000,
  positions: 20000, depth: 32, nodes: 200000});
const utf8 = new TextEncoder();
const own = (value, key) => Object.hasOwn(value, key);
const fail = message => {throw Object.assign(new Error(message), {status: 422, statusCode: 422});};
const put = (object, key, value) => Object.defineProperty(object, key, {value, enumerable: true, configurable: true, writable: true});
const samePosition = (a, b) => a.length === b.length && a.every((n, index) => n === b[index]);
const geometryTypes = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']);
const crsNames = new Set(['EPSG:4326', 'urn:ogc:def:crs:EPSG::4326', 'http://www.opengis.net/def/crs/EPSG/0/4326',
  'CRS84', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'http://www.opengis.net/def/crs/OGC/1.3/CRS84']);

function cloneJson(value, limits = geojsonEditLimits) {
  let nodes = 0;
  const ancestors = new Set();
  function visit(item, depth) {
    if (++nodes > limits.nodes || depth > limits.depth) fail('GeoJSON exceeds its structural size or depth limit.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number') {if (!Number.isFinite(item)) fail('GeoJSON values must contain finite numbers.'); return item;}
    if (!item || typeof item !== 'object') fail('GeoJSON must contain JSON data only.');
    if (ancestors.has(item)) fail('GeoJSON cannot contain cycles.');
    const array = Array.isArray(item);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail('GeoJSON objects must be plain JSON objects.');
    const keys = Reflect.ownKeys(item), result = array ? [] : {};
    if (array && keys.length !== item.length + 1) fail('GeoJSON arrays must be dense and have no extra fields.');
    ancestors.add(item);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const field = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || !field.enumerable || !own(field, 'value')) fail('GeoJSON fields must be ordinary enumerable data, without accessors or symbols.');
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length)) fail('GeoJSON arrays must contain indexed data only.');
      put(result, key, visit(field.value, depth + 1));
    }
    ancestors.delete(item);
    return result;
  }
  return visit(value, 0);
}

function encode(value) {
  if (Array.isArray(value)) return '[' + value.map(encode).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + encode(value[key])).join(',') + '}';
  return typeof value === 'number' && Object.is(value, -0) ? '-0' : JSON.stringify(value);
}

// Compare decimal values, not their notation. Refuse rounding of unknown JSON
// metadata (including large integer IDs) instead of changing it during parsing.
function decimal(token) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '');
  if (!digits) return match[1] ? '-0' : '0';
  let exponent = Number(match[4] || 0) - (match[3] || '').length;
  while (digits.endsWith('0')) {digits = digits.slice(0, -1); exponent++;}
  return match[1] + digits + 'e' + exponent;
}

function dataLimits(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('Invalid JSON parsing limits.');
  const optionKeys = Reflect.ownKeys(options);
  if (optionKeys.some(key => key !== 'maxBytes')) fail('Unknown JSON parsing limit.');
  const limit = Object.getOwnPropertyDescriptor(options, 'maxBytes');
  if (limit && (!limit.enumerable || !own(limit, 'value'))) fail('JSON parsing limits must be ordinary data.');
  const maxBytes = limit ? limit.value : geojsonEditLimits.bytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 3 * 1024 * 1024) fail('JSON byte limit must be an integer from 1 through 3 MiB.');
  const envelope = maxBytes > geojsonEditLimits.bytes;
  return {bytes:maxBytes, depth:geojsonEditLimits.depth + (envelope ? 4 : 0),
    nodes:geojsonEditLimits.nodes + (envelope ? 128 : 0),
    message:maxBytes === geojsonEditLimits.bytes ? 'GeoJSON exceeds the 2 MiB UTF-8 limit.' : 'JSON exceeds its configured UTF-8 byte limit.'};
}

/** Bounded JSON-data parser rejects duplicate members and precision loss.
 * It is also used before parsing edit request envelopes or typed property data.
 * The trusted HTTP envelope may opt into at most 3 MiB. Its four wrapper levels
 * and 128 metadata nodes do not widen validateGeoJson's document limits.
 */
export function parseGeoJsonData(input, options = {}) {
  const limits = dataLimits(options);
  let text;
  if (typeof input === 'string') text = input;
  else if (input instanceof Uint8Array) {
    if (input.byteLength > limits.bytes) fail(limits.message);
    try {text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(input);} catch {fail('GeoJSON must be valid UTF-8.');}
  } else fail('Provide GeoJSON text or UTF-8 bytes.');
  if (utf8.encode(text).length > limits.bytes) fail(limits.message);
  let at = 0, nodes = 0;
  const space = () => {while (/[\x20\t\r\n]/.test(text[at] || '') && at < text.length) at++;};
  function string() {
    const start = at++;
    while (at < text.length) {
      const character = text[at++];
      if (character === '\\') {at++; continue;}
      if (character === '"') {try {return JSON.parse(text.slice(start, at));} catch {fail('Invalid GeoJSON string.');}}
    }
    fail('Unterminated GeoJSON string.');
  }
  function read(depth) {
    if (++nodes > limits.nodes || depth > limits.depth) fail('GeoJSON exceeds its structural size or depth limit.');
    space(); const token = text[at];
    if (token === '"') return string();
    if (token === '{') {
      at++; space(); const result = {}, keys = new Set();
      if (text[at] === '}') {at++; return result;}
      for (;;) {
        space(); if (text[at] !== '"') fail('GeoJSON object members need quoted names.');
        const key = string(); if (keys.has(key)) fail('Duplicate GeoJSON object member.'); keys.add(key);
        space(); if (text[at++] !== ':') fail('Invalid GeoJSON object member.');
        put(result, key, read(depth + 1)); space();
        const next = text[at++]; if (next === '}') return result; if (next !== ',') fail('Invalid GeoJSON object.');
      }
    }
    if (token === '[') {
      at++; space(); const result = [];
      if (text[at] === ']') {at++; return result;}
      for (;;) {result.push(read(depth + 1)); space(); const next = text[at++]; if (next === ']') return result; if (next !== ',') fail('Invalid GeoJSON array.');}
    }
    for (const [word, value] of [['null', null], ['true', true], ['false', false]]) if (text.startsWith(word, at)) {at += word.length; return value;}
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(at));
    if (!number) fail('Invalid GeoJSON value.');
    at += number[0].length; const value = Number(number[0]);
    if (!Number.isFinite(value) || decimal(number[0]) !== decimal(Object.is(value, -0) ? '-0' : JSON.stringify(value))) fail('GeoJSON numeric precision cannot be preserved.');
    return value;
  }
  const value = read(0); space(); if (at !== text.length) fail('Unexpected content after GeoJSON.');
  return value;
}

/** Stable JSON-data wire serialization, including negative zero. Never use a
 * display projection as input; validateGeoJson still owns document validation.
 */
export function serializeGeoJsonData(value, options = {}) {
  const limits = dataLimits(options), serialized = encode(cloneJson(value, limits)) + '\n';
  if (utf8.encode(serialized).length > limits.bytes) fail(limits.message);
  return serialized;
}

export function parseGeoJson(input) {return validateGeoJson(parseGeoJsonData(input));}

function crs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.type !== 'name' ||
      !value.properties || typeof value.properties !== 'object' || Array.isArray(value.properties) ||
      !crsNames.has(value.properties.name) || Object.keys(value).some(key => !['type', 'properties'].includes(key)) ||
      Object.keys(value.properties).some(key => key !== 'name')) fail('Only explicit WGS84 CRS84 or EPSG:4326 declarations can be edited; no reprojection is performed.');
}
function stats() {return {positions: [], geometryTypes: Object.create(null), count: 0};}
function checkBBox(object, positions) {
  if (!own(object, 'bbox')) return;
  const bbox = object.bbox;
  if (!Array.isArray(bbox) || ![4, 6].includes(bbox.length) || !bbox.every(Number.isFinite)) fail('GeoJSON bbox must contain four or six finite numbers.');
  const dimensions = bbox.length / 2;
  if (!positions.length || dimensions === 3 && positions.some(position => position.length !== 3)) fail('This bounding box has no compatible coordinate extent.');
  for (let axis = 0; axis < dimensions; axis++) {
    if (axis > 0 && bbox[axis] > bbox[axis + dimensions] || axis === 0 && (Math.abs(bbox[axis]) > 180 || Math.abs(bbox[axis + dimensions]) > 180) ||
        axis === 1 && (Math.abs(bbox[axis]) > 90 || Math.abs(bbox[axis + dimensions]) > 90)) fail('GeoJSON bbox is outside its coordinate bounds.');
    for (const position of positions) if (axis === 0 && bbox[0] > bbox[dimensions]
      ? position[axis] > bbox[dimensions] && position[axis] < bbox[0]
      : position[axis] < bbox[axis] || position[axis] > bbox[axis + dimensions]) fail('GeoJSON bbox does not contain its coordinates.');
  }
}
function inspect(document, {boxes = true} = {}) {
  const result = stats();
  function geometry(value) {
    if (value === null) return [];
    if (!value || typeof value !== 'object' || Array.isArray(value) || !geometryTypes.has(value.type)) fail('Unsupported GeoJSON geometry.');
    if (own(value, 'crs')) crs(value.crs);
    result.geometryTypes[value.type] = (result.geometryTypes[value.type] || 0) + 1;
    const positions = [];
    const position = item => {
      if (!Array.isArray(item) || ![2, 3].includes(item.length) || !item.every(Number.isFinite) || Math.abs(item[0]) > 180 || Math.abs(item[1]) > 90) fail('Use finite 2D or 3D longitude/latitude positions within valid geographic bounds.');
      if (++result.count > geojsonEditLimits.positions) fail('GeoJSON exceeds 20,000 positions.');
      positions.push(item); result.positions.push(item);
    };
    const list = (items, action, minimum = 0) => {if (!Array.isArray(items) || items.length < minimum) fail('Invalid GeoJSON coordinate structure.'); for (const item of items) action(item);};
    const line = points => {list(points, position, 2); if (new Set(points.map(point => encode(point))).size < 2) fail('A line needs two distinct positions.');};
    const ring = points => {list(points, position, 4); if (!samePosition(points[0], points.at(-1)) || new Set(points.slice(0, -1).map(point => encode(point))).size < 3) fail('Polygon rings must be closed and contain three distinct vertices.');};
    const polygon = rings => list(rings, ring, 1);
    if (value.type === 'GeometryCollection') {
      if (own(value, 'coordinates')) fail('GeometryCollection cannot also contain coordinates.');
      list(value.geometries, child => {if (child === null) fail('GeometryCollection members must be geometry objects.'); positions.push(...geometry(child));});
    } else {
      if (own(value, 'geometries')) fail('Coordinate geometry cannot also contain geometries.');
      const readers = {Point: position, MultiPoint: points => list(points, position), LineString: line,
        MultiLineString: lines => list(lines, line), Polygon: polygon, MultiPolygon: polygons => list(polygons, polygon)};
      readers[value.type](value.coordinates);
    }
    if (boxes) checkBBox(value, positions); return positions;
  }
  function feature(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.type !== 'Feature' || !own(value, 'geometry') ||
        !own(value, 'properties') || value.properties !== null && (typeof value.properties !== 'object' || Array.isArray(value.properties))) fail('GeoJSON Features need geometry and an object or null properties member.');
    if (own(value, 'id') && !['string', 'number'].includes(typeof value.id)) fail('GeoJSON feature IDs must be strings or numbers.');
    if (own(value, 'crs')) crs(value.crs);
    const positions = geometry(value.geometry); if (boxes) checkBBox(value, positions); return positions;
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('GeoJSON must be an object.');
  if (own(document, 'crs')) crs(document.crs);
  if (document.type === 'FeatureCollection') {
    if (!Array.isArray(document.features) || document.features.length > geojsonEditLimits.features) fail('GeoJSON exceeds 1,000 features or has an invalid collection.');
    const positions = document.features.flatMap(feature); if (boxes) checkBBox(document, positions);
  } else if (document.type === 'Feature') feature(document);
  else geometry(document);
  return result;
}

export function validateGeoJson(value) {
  const document = cloneJson(value);
  if (utf8.encode(encode(document) + '\n').length > geojsonEditLimits.bytes) fail('GeoJSON exceeds the 2 MiB UTF-8 limit.');
  inspect(document); return document;
}
export function serializeGeoJson(value) {return encode(validateGeoJson(value)) + '\n';}
function features(document) {return document.type === 'FeatureCollection' ? document.features : document.type === 'Feature' ? [document] : [{type: 'Feature', properties: {}, geometry: document}];}
export function geoJsonFeatures(value) {return features(validateGeoJson(value));}
function selected(document, index) {
  const list = features(document);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) fail('Select an existing GeoJSON feature.');
  return list[index];
}
function vertices(geometry, path = [], result = []) {
  if (geometry === null) return result;
  if (geometry.type === 'GeometryCollection') geometry.geometries.forEach((child, index) => vertices(child, [...path, 'geometries', index], result));
  else {
    const walk = (coordinates, at) => {
      if (typeof coordinates[0] === 'number') result.push({path: at, position: [...coordinates]});
      else coordinates.forEach((child, index) => walk(child, [...at, index]));
    };
    walk(geometry.coordinates, [...path, 'coordinates']);
  }
  return result;
}
export function geoJsonVertices(value, index) {const document = validateGeoJson(value);return vertices(selected(document, index).geometry);}

function refreshBoxes(document, changedIndex = null, vertexPath = null) {
  function box(object, positions) {
    if (!own(object, 'bbox')) return;
    const dimensions = object.bbox.length / 2;
    if (!positions.length || dimensions === 3 && positions.some(position => position.length !== 3)) fail('The retained bbox has no compatible extent after this edit.');
    object.bbox = [...Array(dimensions)].map((_, axis) => Math.min(...positions.map(point => point[axis])))
      .concat([...Array(dimensions)].map((_, axis) => Math.max(...positions.map(point => point[axis]))));
  }
  function geometry(value, path = [], refresh = true) {
    if (value === null) return [];
    const affected = refresh && (vertexPath === null || path.every((part, at) => vertexPath[at] === part));
    const points = value.type === 'GeometryCollection' ? value.geometries.flatMap((child, index) => geometry(child, [...path, 'geometries', index], affected)) : vertices(value).map(item => item.position);
    if (affected) box(value, points); return points;
  }
  const feature = (value, index) => {const affected = changedIndex !== null && index === changedIndex, points = geometry(value.geometry, [], affected);if (affected) box(value, points);return points;};
  if (document.type === 'FeatureCollection') box(document, document.features.flatMap(feature));
  else if (document.type === 'Feature') feature(document, 0); else geometry(document);
  return validateGeoJson(document);
}

export function updateGeoJsonVertex(value, index, path, position) {
  const document = validateGeoJson(value), feature = selected(document, index);
  path = cloneJson(path); position = cloneJson(position);
  if (!Array.isArray(path) || !vertices(feature.geometry).some(item => encode(item.path) === encode(path))) fail('Select an existing GeoJSON vertex path.');
  if (!Array.isArray(position) || ![2, 3].includes(position.length) || !position.every(Number.isFinite)) fail('Use a finite 2D or 3D replacement position.');
  let parent = feature.geometry;
  for (const key of path.slice(0, -1)) parent = parent[key];
  const key = path.at(-1), before = parent[key], next = position.length === 2 && before.length === 3 ? [...position, before[2]] : [...position];
  const aliases = [];
  function rings(geometry, prefix = []) {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') geometry.geometries.forEach((child, at) => rings(child, [...prefix, 'geometries', at]));
    const lists = geometry.type === 'Polygon' ? geometry.coordinates.map((ring, at) => ({ring, path:[...prefix, 'coordinates', at]})) :
      geometry.type === 'MultiPolygon' ? geometry.coordinates.flatMap((polygon, at) => polygon.map((ring, ringIndex) => ({ring, path:[...prefix, 'coordinates', at, ringIndex]}))) : [];
    for (const item of lists) if (encode(path.slice(0, -1)) === encode(item.path) && [0, item.ring.length - 1].includes(key)) aliases.push(item.ring);
  }
  rings(feature.geometry); parent[key] = next;
  for (const ring of aliases) {ring[0] = [...next]; ring[ring.length - 1] = [...next];}
  return refreshBoxes(document, index, path);
}
export function replaceGeoJsonProperties(value, index, properties) {
  const document = validateGeoJson(value);
  if (!['Feature', 'FeatureCollection'].includes(document.type)) fail('Bare geometry has no Feature properties to replace.');
  selected(document, index).properties = cloneJson(properties);
  return validateGeoJson(document);
}
export function addGeoJsonFeature(value, input = {}) {
  const fields = cloneJson(input);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !own(fields, 'geometry') || Object.keys(fields).some(key => !['geometry', 'properties'].includes(key))) fail('Add a feature using geometry and optional properties only.');
  const geometry = fields.geometry, properties = own(fields, 'properties') ? fields.properties : {};
  let document = validateGeoJson(value);
  const addition = validateGeoJson({type:'Feature', geometry, properties});
  if (document.type !== 'FeatureCollection') document = {type:'FeatureCollection', features:features(document)};
  document.features.push(addition); return refreshBoxes(document);
}
export function removeGeoJsonFeature(value, index) {
  let document = validateGeoJson(value); selected(document, index);
  if (document.type === 'FeatureCollection') document.features.splice(index, 1);
  else if (document.type === 'Feature') document.geometry = null;
  else {
    if (own(document, 'bbox')) fail('The retained bbox has no compatible extent after removing this geometry.');
    const {type, coordinates, geometries, ...foreign} = document;
    document = {...foreign, type:'Feature', properties:{}, geometry:null};
  }
  return refreshBoxes(document, document.type === 'Feature' ? 0 : null);
}
export function spatialEditPreview(value) {
  const document = validateGeoJson(value), summary = inspect(document), list = features(document);
  const display = item => typeof item === 'object' ? encode(item) : String(item);
  const xy = geometry => {
    if (geometry === null) return null;
    if (geometry.type === 'GeometryCollection') {
      const flatten = child => child?.type === 'GeometryCollection' ? child.geometries.flatMap(flatten) : [xy(child)];
      return {type:'GeometryCollection', geometries:geometry.geometries.flatMap(flatten)};
    }
    const coordinates = item => typeof item[0] === 'number' ? item.slice(0, 2) : item.map(coordinates);
    return {type:geometry.type, coordinates:coordinates(geometry.coordinates)};
  };
  const positions = summary.positions, bounds = positions.length ? [Math.min(...positions.map(point => point[0])), Math.min(...positions.map(point => point[1])), Math.max(...positions.map(point => point[0])), Math.max(...positions.map(point => point[1]))] : null;
  return {format:'GeoJSON', status:positions.length ? 'ready' : 'summary', crs:'WGS 84 longitude / latitude', crsOrigin:own(document, 'crs') ? 'Explicit supported legacy declaration' : 'GeoJSON RFC 7946', geographic:true,
    coordinateBasis:'longitude / latitude, not reprojected', bounds, featureCount:list.length, coordinateCount:positions.length,
    geometryTypes:{...summary.geometryTypes}, warnings:['Structural checks do not establish topology, survey accuracy or rights to use these features.'],
    features:list.map((feature, index) => ({id:index + 1, ...(own(feature, 'id') ? {sourceId:feature.id} : {}), name:display(feature.properties?.name ?? feature.properties?.title ?? feature.id ?? `Feature ${index + 1}`),
      properties:feature.properties === null ? {} : Object.fromEntries(Object.entries(feature.properties || {}).map(([key, item]) => [key, display(item)])), geometry:xy(feature.geometry)})), summary:{}};
}
