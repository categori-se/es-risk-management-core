import {inflateRawSync} from 'node:zlib';
import {JSDOM} from 'jsdom';

export const spatialPreviewLimits = Object.freeze({bytes: 16 * 1024 * 1024, expandedBytes: 32 * 1024 * 1024, entries: 128, features: 5000, coordinates: 100000, propertiesBytes: 512 * 1024});
const fail = message => Object.assign(new Error(message), {status: 422});
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const extension = filename => String(filename || '').toLowerCase().split('.').pop();
const decode = bytes => {try {return new TextDecoder('utf-8', {fatal: true}).decode(bytes);} catch {throw fail('This spatial text is not valid UTF-8. Convert a copy to UTF-8 for preview.');}};
const clean = (value, maximum = 1000) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, maximum);
const attributeText = (value, depth = 0) => {
  if (value === null) return 'null';
  if (typeof value !== 'object') return clean(value);
  if (depth >= 3) return Array.isArray(value) ? '[Array]' : '[Object]';
  const values = Array.isArray(value) ? value.slice(0, 10).map(item => attributeText(item, depth + 1)) : Object.entries(value).slice(0, 10).map(([key, item]) => `${clean(key, 80)}: ${attributeText(item, depth + 1)}`);
  return clean((Array.isArray(value) ? '[' : '{') + values.join(', ') + (Array.isArray(value) ? ']' : '}'));
};
const summary = (format, warnings = [], details = {}) => ({format, status: 'summary', crs: 'Not established', bounds: null, featureCount: 0, coordinateCount: 0, geometryTypes: {}, warnings, features: [], summary: details});

export function isSpatialSource({filename = '', mediaType = '', bytes} = {}) {
  const ext = extension(filename);
  if (/^(geojson|kml|kmz|gpx|shp|tif|tiff|gpkg|topojson|prj|dbf|shx|cpg)$/.test(ext)) return true;
  if (/geo\+json|vnd\.google-earth|gpx\+xml|geopackage|image\/tiff|x-shapefile/i.test(mediaType)) return true;
  if (ext === 'json' && bytes?.length <= spatialPreviewLimits.bytes) {
    try {const value = JSON.parse(decode(bytes)); return ['Feature', 'FeatureCollection', 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection', 'Topology'].includes(value?.type);} catch {return false;}
  }
  if (ext === 'zip' && bytes?.length >= 22 && bytes.length <= spatialPreviewLimits.bytes) {
    // Identify a spatial ZIP by its bounded directory, without inflating entries.
    const source = Buffer.from(bytes); let end = source.length - 22;
    while (end >= Math.max(0, source.length - 65557) && (source.readUInt32LE(end) !== 0x06054b50 || end + 22 + source.readUInt16LE(end + 20) !== source.length)) end--;
    if (end < Math.max(0, source.length - 65557)) return false;
    const count = source.readUInt16LE(end + 10); let offset = source.readUInt32LE(end + 16);
    if (count > spatialPreviewLimits.entries || offset > end) return false;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || source.readUInt32LE(offset) !== 0x02014b50) return false;
      const length = source.readUInt16LE(offset + 28), next = offset + 46 + length + source.readUInt16LE(offset + 30) + source.readUInt16LE(offset + 32);
      if (next > end) return false;
      if (/\.(shp|kml)$/i.test(source.subarray(offset + 46, offset + 46 + length).toString('utf8'))) return true;
      offset = next;
    }
  }
  return false;
}

function normalizeGeoJSON(input, {format = 'GeoJSON', crs = 'WGS 84 longitude / latitude (GeoJSON RFC 7946)', geographic = true, crsOrigin = 'GeoJSON RFC 7946 default assumption', warnings = [], details = {}} = {}) {
  const source = input?.type === 'FeatureCollection' ? input.features : [input?.type === 'Feature' ? input : {type: 'Feature', properties: {}, geometry: input}];
  if (!Array.isArray(source) || source.length > spatialPreviewLimits.features) throw fail(`Spatial preview supports up to ${spatialPreviewLimits.features.toLocaleString('en-US')} features.`);
  let pointCount = 0, propertyBytes = 0, omittedProperties = false, geometryCount = 0;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity], geometryTypes = Object.create(null);
  function point(value) {
    if (!Array.isArray(value) || value.length < 2 || value.length > 4 || value.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e15)) throw fail('Spatial coordinates must contain finite numeric values.');
    if (geographic && (Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90)) throw fail('Coordinates exceed longitude / latitude bounds. Convert a copy to WGS 84 or declare its source CRS before preview.');
    if (++pointCount > spatialPreviewLimits.coordinates) throw fail(`Spatial preview supports up to ${spatialPreviewLimits.coordinates.toLocaleString('en-US')} coordinates.`);
    bounds[0] = Math.min(bounds[0], value[0]); bounds[1] = Math.min(bounds[1], value[1]); bounds[2] = Math.max(bounds[2], value[0]); bounds[3] = Math.max(bounds[3], value[1]);
    return value.slice(0, 2);
  }
  function list(value, child, minimum = 0) {if (!Array.isArray(value) || value.length < minimum) throw fail('Invalid spatial coordinate structure.'); return value.map(child);}
  function geometry(value, depth = 0) {
    if (value === null) return null;
    if (!plain(value) || depth > 8 || ++geometryCount > 20000) throw fail('Invalid or excessively nested spatial geometry.');
    geometryTypes[value.type] = (geometryTypes[value.type] || 0) + 1;
    if (value.type === 'GeometryCollection') return {type: value.type, geometries: list(value.geometries, child => geometry(child, depth + 1))};
    const line = value => list(value, point), rings = value => list(value, line);
    const readers = {Point: point, MultiPoint: line, LineString: line, MultiLineString: rings, Polygon: rings, MultiPolygon: value => list(value, rings)};
    if (!Object.hasOwn(readers, value.type)) throw fail(`Unsupported spatial geometry type: ${clean(value.type, 80)}.`);
    return {type: value.type, coordinates: readers[value.type](value.coordinates)};
  }
  const features = source.map((feature, index) => {
    if (!plain(feature) || feature.type !== 'Feature') throw fail('Invalid GeoJSON feature.');
    const properties = {};
    if (plain(feature.properties)) for (const [key, raw] of Object.entries(feature.properties).slice(0, 20)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      const text = attributeText(raw);
      const cost = Buffer.byteLength(text) + Buffer.byteLength(key);
      if (propertyBytes + cost > spatialPreviewLimits.propertiesBytes) {omittedProperties = true; continue;}
      propertyBytes += cost; Object.defineProperty(properties, clean(key, 120), {value: text, enumerable: true, configurable: true});
    }
    return {id: index + 1, ...(typeof feature.id === 'string' || typeof feature.id === 'number' && Number.isFinite(feature.id) ? {sourceId: typeof feature.id === 'number' ? feature.id : clean(feature.id)} : {}), name: clean(feature.properties?.name ?? feature.properties?.title ?? feature.id ?? `Feature ${index + 1}`, 200), properties, geometry: geometry(feature.geometry)};
  });
  if (omittedProperties) warnings.push('Some attributes are omitted from the preview size budget; the original file is unchanged.');
  if (bounds[2] - bounds[0] > 180 && geographic) warnings.push('This extent crosses or approaches the antimeridian; the flat preview does not wrap longitude.');
  return {format, status: pointCount ? 'ready' : 'summary', crs, crsOrigin, geographic, coordinateBasis: geographic ? 'longitude / latitude, not reprojected' : 'source X / Y coordinates, not reprojected', bounds: pointCount ? bounds : null, featureCount: features.length, coordinateCount: pointCount, geometryTypes, warnings, features, summary: details};
}

let parser;
function xmlDocument(text, expected) {
  // Descriptions and comments stay inert. No DTD/entity declaration is accepted.
  const declarations = text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(declarations)) throw fail('XML declarations for DTDs or entities are not supported in spatial previews.');
  let tags = 0;
  for (let at = declarations.indexOf('<'); at !== -1; at = declarations.indexOf('<', at + 1)) if (declarations[at + 1] !== '/' && ++tags > 50000) throw fail('This spatial XML exceeds the 50,000-element preview limit.');
  parser ||= new (new JSDOM('').window.DOMParser)();
  const document = parser.parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName.toLowerCase() !== expected) throw fail(`Invalid ${expected.toUpperCase()} XML document.`);
  if (document.getElementsByTagName('*').length > 50000) throw fail('This spatial XML exceeds the element limit.');
  return document;
}
const descendants = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const childText = (node, name) => [...node.children].find(child => child.localName === name)?.textContent || '';
function parseKml(text) {
  const document = xmlDocument(text, 'kml'), warnings = [];
  if (descendants(document, 'NetworkLink').length) warnings.push('Network links are not loaded. Only geometry embedded in this file is shown.');
  if (['GroundOverlay', 'PhotoOverlay', 'Model', 'Track', 'MultiTrack'].some(name => descendants(document, name).length)) warnings.push('Raster overlays, tracks and 3D models are not rendered.');
  const placemarks = descendants(document, 'Placemark');
  if (placemarks.length > spatialPreviewLimits.features) throw fail('This KML exceeds the feature limit.');
  let points = 0;
  const coordinates = node => {
    const text = childText(node, 'coordinates').trim();
    if (!text) return [];
    const tokens = text.split(/\s+/);
    points += tokens.length;
    if (points > spatialPreviewLimits.coordinates) throw fail('This KML exceeds the coordinate limit.');
    return tokens.map(token => {const values = token.split(','); if (values.length < 2 || values.length > 3 || values.some(value => value.trim() === '' || !Number.isFinite(Number(value)))) throw fail('Invalid KML coordinates.'); return values.map(Number);});
  };
  function geometry(node, depth = 0) {
    if (depth > 8) throw fail('This KML geometry is excessively nested.');
    if (node.localName === 'Point') {const data = coordinates(node); if (data.length !== 1) throw fail('A KML Point must contain one coordinate.'); return {type: 'Point', coordinates: data[0]};}
    if (node.localName === 'LineString' || node.localName === 'LinearRing') return {type: 'LineString', coordinates: coordinates(node)};
    if (node.localName === 'Polygon') {const outer = descendants(node, 'outerBoundaryIs'), inner = descendants(node, 'innerBoundaryIs'); return {type: 'Polygon', coordinates: [...outer, ...inner].map(ring => coordinates(descendants(ring, 'LinearRing')[0] || ring))};}
    if (node.localName === 'MultiGeometry') return {type: 'GeometryCollection', geometries: [...node.children].map(child => geometry(child, depth + 1)).filter(Boolean)};
    return null;
  }
  const features = placemarks.map(mark => ({type: 'Feature', properties: {name: childText(mark, 'name'), description: childText(mark, 'description')}, geometry: [...mark.children].map(node => geometry(node)).find(Boolean) || null}));
  return normalizeGeoJSON({type: 'FeatureCollection', features}, {format: 'KML', crs: 'WGS 84 longitude / latitude (KML)', crsOrigin: 'KML format specification', warnings});
}
function parseGpx(text) {
  const document = xmlDocument(text, 'gpx'), features = [], warnings = ['Elevation and timestamps remain in the original; this preview shows two-dimensional geometry.'];
  let points = 0;
  const coordinate = node => {
    if (++points > spatialPreviewLimits.coordinates) throw fail('This GPX exceeds the coordinate limit.');
    const lat = node.getAttribute('lat'), lon = node.getAttribute('lon');
    if (lat === null || lon === null || lat.trim() === '' || lon.trim() === '' || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) throw fail('Invalid GPX coordinate.');
    return [Number(lon), Number(lat)];
  };
  const append = (node, geometry, fallback) => {features.push({type: 'Feature', properties: {name: childText(node, 'name') || fallback, description: childText(node, 'desc')}, geometry}); if (features.length > spatialPreviewLimits.features) throw fail('This GPX exceeds the feature limit.');};
  for (const node of descendants(document, 'wpt')) append(node, {type: 'Point', coordinates: coordinate(node)}, 'Waypoint');
  for (const node of descendants(document, 'rte')) append(node, {type: 'LineString', coordinates: descendants(node, 'rtept').map(coordinate)}, 'Route');
  for (const node of descendants(document, 'trk')) append(node, {type: 'MultiLineString', coordinates: descendants(node, 'trkseg').map(segment => descendants(segment, 'trkpt').map(coordinate))}, 'Track');
  return normalizeGeoJSON({type: 'FeatureCollection', features}, {format: 'GPX', crs: 'WGS 84 longitude / latitude (GPX)', crsOrigin: 'GPX format specification', warnings});
}

const crcTable = Uint32Array.from({length: 256}, (_, n) => {for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n;});
function crc32(bytes) {let value = -1; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ -1) >>> 0;}
function unzip(bytes) {
  if (bytes.length < 22) throw fail('This ZIP archive is incomplete.');
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && (bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length)) end--;
  if (end < Math.max(0, bytes.length - 65557) || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw fail('This archive is incomplete or uses multiple ZIP volumes.');
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16), total = 0;
  const directoryStart = offset;
  if (count > spatialPreviewLimits.entries || bytes.readUInt16LE(end + 8) !== count || offset + size !== end) throw fail('This archive exceeds the ZIP directory limits.');
  const entries = new Map(), ranges = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw fail('Invalid ZIP directory.');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), crc = bytes.readUInt32LE(offset + 16), compressed = bytes.readUInt32LE(offset + 20), expanded = bytes.readUInt32LE(offset + 24), nameLength = bytes.readUInt16LE(offset + 28), local = bytes.readUInt32LE(offset + 42), mode = bytes.readUInt32LE(offset + 38) >>> 16;
    const next = offset + 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    if (next > end || flags & 1 || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000) throw fail('Encrypted files, symbolic links and this ZIP compression are not supported.');
    const name = decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!name || name.length > 512 || /[\\\x00-\x1f]/.test(name) || name.startsWith('/') || name.split('/').some(part => ['.', '..', '__proto__'].includes(part)) || entries.has(name.toLowerCase())) throw fail('This ZIP contains unsafe or duplicate entry names.');
    if (expanded > spatialPreviewLimits.bytes || (total += expanded) > spatialPreviewLimits.expandedBytes || expanded > Math.max(1024 * 1024, compressed * 200)) throw fail('This ZIP exceeds the expansion or compression-ratio limits.');
    if (local + 30 > directoryStart || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) throw fail('Invalid ZIP file header.');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28), finish = start + compressed;
    if (finish > directoryStart || start < local || !bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)).equals(bytes.subarray(offset + 46, offset + 46 + nameLength))) throw fail('Invalid ZIP entry range or name.');
    if (ranges.some(([a, b]) => local < b && finish > a)) throw fail('Overlapping ZIP entries are not supported.');
    ranges.push([local, finish]);
    let content;
    try {content = method === 0 ? bytes.subarray(start, finish) : inflateRawSync(bytes.subarray(start, finish), {maxOutputLength: spatialPreviewLimits.bytes});} catch {throw fail('A ZIP entry cannot be safely decompressed.');}
    if (content.length !== expanded || crc32(content) !== crc) throw fail('A ZIP entry failed its integrity check.');
    entries.set(name.toLowerCase(), {name, bytes: content}); offset = next;
  }
  if (offset !== end) throw fail('Invalid ZIP directory length.');
  return entries;
}

function parseDbf(bytes, count, encoding) {
  if (bytes.length < 33) throw fail('The shapefile attribute table is incomplete.');
  const records = bytes.readUInt32LE(4), header = bytes.readUInt16LE(8), length = bytes.readUInt16LE(10);
  if (records !== count || header < 33 || header > bytes.length || length < 1 || header + records * length > bytes.length) throw fail('The shapefile attribute table does not match its geometry.');
  const fields = []; let position = 1;
  for (let offset = 32; offset < header - 1; offset += 32) {
    if (bytes[offset] === 13) break;
    if (offset + 32 > header) throw fail('Invalid shapefile attribute header.');
    const name = bytes.subarray(offset, offset + 11).toString('ascii').replace(/\0.*$/, ''), width = bytes[offset + 16];
    if (!width || position + width > length) throw fail('Invalid shapefile attribute width.');
    fields.push({name, offset: position, width}); position += width;
  }
  let decoder; try {decoder = new TextDecoder(encoding);} catch {decoder = new TextDecoder('windows-1252');}
  return Array.from({length: records}, (_, index) => {
    const properties = {}; const start = header + index * length;
    if (bytes[start] === 42) properties._deleted = 'Marked deleted in source attribute table';
    for (const field of fields.slice(0, 20)) if (!['__proto__', 'constructor', 'prototype'].includes(field.name)) Object.defineProperty(properties, field.name, {value: decoder.decode(bytes.subarray(start + field.offset, start + field.offset + field.width)).trim(), enumerable: true});
    return properties;
  });
}
function parseShapefile(bytes, {prj = '', dbf, cpg = ''} = {}) {
  if (bytes.length < 100 || bytes.readInt32BE(0) !== 9994 || bytes.readInt32LE(28) !== 1000 || bytes.readInt32BE(24) * 2 !== bytes.length) throw fail('Invalid or truncated shapefile header.');
  const features = [], warnings = [], polygon = new Set(); let points = 0;
  if ([11, 13, 15, 18, 21, 23, 25, 28].includes(bytes.readInt32LE(32))) warnings.push('Z coordinates and M measures are not rendered; the preview shows two-dimensional geometry.');
  for (let offset = 100; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw fail('Truncated shapefile record.');
    const length = bytes.readInt32BE(offset + 4) * 2, end = offset + 8 + length, type = bytes.readInt32LE(offset + 8), base = offset + 12;
    if (length < 4 || end > bytes.length) throw fail('Invalid shapefile record length.');
    let geometry = null;
    const readPoints = (start, count) => {
      if (count < 0 || start + count * 16 > end || (points += count) > spatialPreviewLimits.coordinates) throw fail('Invalid shapefile point count or preview coordinate limit exceeded.');
      return Array.from({length: count}, (_, i) => [bytes.readDoubleLE(start + i * 16), bytes.readDoubleLE(start + i * 16 + 8)]);
    };
    if ([1, 11, 21].includes(type)) geometry = {type: 'Point', coordinates: readPoints(base, 1)[0]};
    else if ([3, 5, 13, 15, 23, 25].includes(type)) {
      if (base + 40 > end) throw fail('Incomplete shapefile parts.');
      const partCount = bytes.readInt32LE(base + 32), pointCount = bytes.readInt32LE(base + 36), partsStart = base + 40, pointsStart = partsStart + partCount * 4;
      if (partCount < 1 || pointCount < 1 || partCount > pointCount || pointsStart > end) throw fail('Invalid shapefile part count.');
      const starts = Array.from({length: partCount}, (_, i) => bytes.readInt32LE(partsStart + i * 4));
      if (starts[0] !== 0 || starts.some((value, i) => value < 0 || value >= pointCount || i && value <= starts[i - 1])) throw fail('Invalid shapefile part offset.');
      const coordinates = readPoints(pointsStart, pointCount), parts = starts.map((start, i) => coordinates.slice(start, starts[i + 1] ?? pointCount));
      geometry = {type: 'MultiLineString', coordinates: parts};
      if (type % 10 === 5) polygon.add(type);
    } else if ([8, 18, 28].includes(type)) {
      if (base + 36 > end) throw fail('Incomplete shapefile multipoint record.');
      geometry = {type: 'MultiPoint', coordinates: readPoints(base + 36, bytes.readInt32LE(base + 32))};
    } else if (type !== 0) throw fail(`Shapefile shape type ${type} is not supported in this preview.`);
    features.push({type: 'Feature', properties: {record: features.length + 1}, geometry});
    if (features.length > spatialPreviewLimits.features) throw fail('This shapefile exceeds the feature limit.');
    offset = end;
  }
  const geographic = !!prj && !/PROJCS|PROJCRS|PROJECTEDCRS/i.test(prj) && /WGS[_ ]?(?:19)?84|WGS[_ ]?1984|World_Geodetic_System_1984/i.test(prj);
  const crs = geographic ? 'WGS 84 longitude / latitude (.prj declaration; not independently verified)' : prj ? `Source CRS; schematic coordinates, no reprojection. ${clean(prj, 320)}` : 'Unknown source CRS; schematic coordinates only, no reprojection';
  if (!geographic) warnings.push('Spatial reference is unverified or projected. Position and units cannot be compared with other sources in this preview.');
  if (polygon.size) warnings.push('Shapefile polygons are shown as ring outlines; outer rings and holes are not classified.');
  if (dbf) {
    const encoding = /^(65001|utf-?8)$/i.test(cpg.trim()) ? 'utf-8' : 'windows-1252';
    const attributes = parseDbf(dbf, features.length, encoding);
    features.forEach((feature, i) => {feature.properties = {...feature.properties, ...attributes[i]};});
    warnings.push(`Attribute text decoded as ${encoding}; the original table remains authoritative.`);
  } else warnings.push('No matching .dbf attribute table is available.');
  return normalizeGeoJSON({type: 'FeatureCollection', features}, {format: 'Shapefile', crs, geographic, crsOrigin: prj ? '.prj sidecar declaration' : 'No CRS declaration available', warnings, details: {attributeTable: !!dbf, projectionFile: !!prj, polygonRendering: polygon.size ? 'Ring outlines' : undefined}});
}
function tiffSummary(bytes) {
  if (bytes.length < 8 || !['II', 'MM'].includes(bytes.subarray(0, 2).toString('ascii'))) throw fail('Invalid TIFF header.');
  const little = bytes[0] === 73, u16 = offset => little ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset), u32 = offset => little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  if (u16(2) === 43) return summary('BigTIFF', ['Raster rendering and BigTIFF metadata are not supported. Open the original in a GIS.']);
  if (u16(2) !== 42) throw fail('Invalid TIFF version.');
  const offset = u32(4);
  if (offset + 2 > bytes.length) throw fail('Incomplete TIFF directory.');
  const count = u16(offset); if (count > 512 || offset + 2 + count * 12 + 4 > bytes.length) throw fail('Invalid or excessive TIFF directory.');
  const details = {}, tags = new Map();
  for (let i = 0; i < count; i++) {
    const item = offset + 2 + i * 12, tag = u16(item), type = u16(item + 2), length = u32(item + 4), width = ({1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 12: 8})[type];
    if (!width || length > 65536) continue;
    const start = length * width <= 4 ? item + 8 : u32(item + 8);
    if (start + length * width > bytes.length) throw fail('A TIFF metadata field lies outside the file.');
    tags.set(tag, {type, length, start});
    if ([256, 257, 258, 259, 277, 322, 323].includes(tag) && [3, 4].includes(type) && length) details[({256: 'width', 257: 'height', 258: 'bitsPerSample', 259: 'compressionCode', 277: 'samplesPerPixel', 322: 'tileWidth', 323: 'tileHeight'})[tag]] = type === 3 ? u16(start) : u32(start);
  }
  details.georeferencingTags = [33550, 33922, 34264, 34735].filter(tag => tags.has(tag));
  const key = tags.get(34735);
  if (key?.type === 3 && key.length >= 4) {
    const entries = u16(key.start + 6);
    if (entries * 4 + 4 <= key.length) for (let i = 0; i < entries; i++) {
      const at = key.start + 8 + i * 8, id = u16(at), location = u16(at + 2), value = u16(at + 6);
      if ([2048, 3072].includes(id) && location === 0 && value !== 32767) details.declaredEpsg = value;
    }
  }
  const result = summary(details.georeferencingTags.length ? 'GeoTIFF / TIFF' : 'TIFF', ['Raster pixels are not rendered. Metadata covers the first image directory only; open the original in a GIS for analysis.'], details);
  if (details.declaredEpsg) result.crs = `EPSG:${details.declaredEpsg} (declared in GeoTIFF keys; not transformed)`;
  return result;
}

/** Offline, bounded preview derivative. The caller supplies account-checked, checksum-verified original bytes. */
async function spatialPreview(value, {filename = '', mediaType = ''} = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  if (!bytes.length || bytes.length > spatialPreviewLimits.bytes) throw fail('Spatial preview supports non-empty files up to 16 MiB.');
  const ext = extension(filename);
  if (ext === 'gpkg') {
    if (bytes.length < 100 || bytes.subarray(0, 16).toString('ascii') !== 'SQLite format 3\0') throw fail('Invalid GeoPackage / SQLite header.');
    return summary('GeoPackage', ['GeoPackage layers are not queried or rendered here. Open the original in a GIS, or export a layer as GeoJSON for preview.'], {container: 'SQLite', bytes: bytes.length});
  }
  if (['tif', 'tiff'].includes(ext) || /image\/tiff/i.test(mediaType)) return tiffSummary(bytes);
  if (ext === 'shp') return parseShapefile(bytes);
  if (['zip', 'kmz'].includes(ext)) {
    const entries = unzip(bytes), kml = [...entries.values()].filter(entry => /\.kml$/i.test(entry.name)), shp = [...entries.values()].filter(entry => /\.shp$/i.test(entry.name));
    if (kml.length && !shp.length) {
      if (kml.length !== 1) return summary('KMZ / ZIP', ['This archive contains several KML documents. Extract the desired document for preview.'], {documents: kml.map(entry => entry.name)});
      const result = parseKml(decode(kml[0].bytes)); result.format = 'KMZ'; result.summary = {document: kml[0].name, archiveEntries: entries.size}; return result;
    }
    if (shp.length === 1 && !kml.length) {
      const stem = shp[0].name.toLowerCase().replace(/\.shp$/, '');
      const result = parseShapefile(shp[0].bytes, {prj: entries.has(stem + '.prj') ? decode(entries.get(stem + '.prj').bytes) : '', dbf: entries.get(stem + '.dbf')?.bytes, cpg: entries.has(stem + '.cpg') ? decode(entries.get(stem + '.cpg').bytes) : ''});
      result.format = 'Zipped Shapefile'; result.summary = {...result.summary, layer: shp[0].name, archiveEntries: entries.size}; return result;
    }
    return summary('Spatial ZIP', [shp.length > 1 ? 'This archive contains several shapefile layers. Extract one complete layer for preview.' : 'No single supported KML or shapefile layer was found.'], {layers: [...shp, ...kml].map(entry => entry.name), archiveEntries: entries.size});
  }
  if (ext === 'kml' || /vnd\.google-earth\.kml/i.test(mediaType)) return parseKml(decode(bytes));
  if (ext === 'gpx' || /gpx\+xml/i.test(mediaType)) return parseGpx(decode(bytes));
  if (['geojson', 'json', 'topojson'].includes(ext) || /geo\+json/i.test(mediaType)) {
    let data; try {data = JSON.parse(decode(bytes));} catch (error) {if (error.status) throw error; throw fail('Invalid spatial JSON.');}
    if (data?.type === 'Topology') return summary('TopoJSON', ['TopoJSON topology is not decoded in this preview. Export a GeoJSON copy for preview.']);
    const sourceCrs = data?.crs;
    const geographic = !sourceCrs || /(?:CRS84|EPSG(?::|::|\/0\/|\/)?4326)(?!\d)/i.test(JSON.stringify(sourceCrs));
    return normalizeGeoJSON(data, {geographic, crsOrigin: sourceCrs ? 'GeoJSON crs member declaration' : 'GeoJSON RFC 7946 default assumption', crs: sourceCrs ? `Source CRS declaration: ${clean(JSON.stringify(sourceCrs), 320)}${geographic ? '' : '; schematic coordinates, no reprojection'}` : undefined, warnings: geographic ? [] : ['This source declares a different CRS. Preview is schematic; no reprojection or coordinate comparison is performed.']});
  }
  return {...summary(ext.toUpperCase() || 'Spatial source', ['This component is preserved with the original. Upload a complete zipped shapefile or a GeoJSON copy to preview geometry.']), status: 'unsupported'};
}

export async function buildSpatialPreview(value, options = {}) {
  const result = await spatialPreview(value, options);
  return {...result, parserVersion: 'esia-spatial-preview/1', limits: spatialPreviewLimits};
}
