// Additive field-record v1 extensions. Absence remains absence for historical
// captures; these checks run both in the browser and before repository custody.
export const additionalFieldLinks = Object.freeze({siteIds: "Monitoring point identifiers", observationIds: "Related field capture identifiers", requirementIds: "Engagement requirement identifiers", findingIds: "Engagement finding identifiers", grievanceIds: "Grievance event identifiers", commitmentIds: "Client obligation identifiers", monitoringObligationIds: "Monitoring obligation identifiers", engagementActionIds: "Engagement action identifiers"});
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed, label) => {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error(`${label} contains unsupported fields.`);};
const string = (value, label, max) => {if (typeof value !== "string" || value.length > max) throw Error(`${label} must be text of at most ${max} characters.`);return value;};
const identifier = (value, label) => {if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,192}$/.test(value)) throw Error(`${label} requires a valid record identifier.`);return value;};
const date = value => {if (value === null || value === "") return null;if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw Error("Commitment due date must be a valid calendar date.");return value;};
const list = (value, label, max) => {if (!Array.isArray(value) || value.length > max) throw Error(`${label} supports up to ${max} entries.`);return value;};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const fieldPointGeometry = point => point ? {type: "Point", coordinates: [point.longitude, point.latitude]} : null;

export function normalizeFieldGeometry(value) {
  if (value === null) return null;
  keys(value, ["type", "coordinates"], "Field geometry");
  let count = 0;
  const coordinate = item => {
    if (!Array.isArray(item) || item.length !== 2 || !item.every(Number.isFinite) || Math.abs(item[0]) > 180 || Math.abs(item[1]) > 90 || ++count > 256) throw Error("Use up to 256 finite WGS84 longitude/latitude coordinate pairs within valid bounds.");
    return [...item];
  };
  let coordinates;
  if (value.type === "Point") coordinates = coordinate(value.coordinates);
  else if (value.type === "LineString") {coordinates = list(value.coordinates, "Line coordinates", 256).map(coordinate);if (coordinates.length < 2 || new Set(coordinates.map(JSON.stringify)).size < 2) throw Error("A line needs at least two distinct coordinates.");}
  else if (value.type === "Polygon") {
    coordinates = list(value.coordinates, "Area rings", 8).map(ring => {const result = list(ring, "Area ring coordinates", 256).map(coordinate);if (result.length < 4 || !same(result[0], result.at(-1)) || new Set(result.slice(0,-1).map(JSON.stringify)).size < 3) throw Error("An area needs closed rings with at least three distinct vertices.");return result;});
    if (!coordinates.length) throw Error("An area needs an exterior ring.");
  } else throw Error("Choose a point, line or area geometry.");
  return {type: value.type, coordinates};
}

export function normalizeFieldSpatial(value) {
  keys(value, ["crs", "originalGeometry", "currentGeometry", "revisions"], "Field spatial history");
  if (value.crs !== "EPSG:4326") throw Error("Field geometry uses WGS84 EPSG:4326.");
  const originalGeometry = normalizeFieldGeometry(value.originalGeometry), currentGeometry = normalizeFieldGeometry(value.currentGeometry);
  const revisions = list(value.revisions, "Geometry revisions", 30).map(item => {
    keys(item, ["changedAt", "changedBy", "reason", "before", "after", "source", "accuracyMetres"], "Geometry revision");
    if (typeof item.changedAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(item.changedAt) || !Number.isFinite(Date.parse(item.changedAt))) throw Error("A geometry revision needs its recorded timestamp.");
    const changedBy = string(item.changedBy, "Geometry revision author", 1000), reason = string(item.reason, "Geometry correction reason", 2000);
    if (!changedBy.trim() || !reason.trim()) throw Error("Each geometry change needs attribution and a reason.");
    const metadata = {};
    if (Object.hasOwn(item, "source")) {if (!["device", "manual"].includes(item.source)) throw Error("Geometry source must identify device GPS or manual entry.");metadata.source = item.source;}
    if (Object.hasOwn(item, "accuracyMetres")) {if (item.accuracyMetres !== null && (!Number.isFinite(item.accuracyMetres) || item.accuracyMetres < 0)) throw Error("Geometry accuracy must be a non-negative metre value or explicitly unknown.");metadata.accuracyMetres = item.accuracyMetres;}
    return {changedAt: item.changedAt, changedBy, reason, before: normalizeFieldGeometry(item.before), after: normalizeFieldGeometry(item.after), ...metadata};
  });
  if (!originalGeometry || !revisions.length || !same(originalGeometry,revisions[0].before??revisions[0].after) || revisions.some((item, index) => same(item.before, item.after) || index > 0 && !same(item.before, revisions[index-1].after)) || !same(currentGeometry, revisions.at(-1).after)) throw Error("Retain the original geometry and every linked before/after revision through the current location.");
  return {crs: "EPSG:4326", originalGeometry, currentGeometry, revisions};
}

export function reviseFieldGeometry(record, geometry, {reason, changedBy, changedAt, source = "manual", accuracyMetres = null}) {
  const after = normalizeFieldGeometry(geometry), previous = record.details?.spatial ? normalizeFieldSpatial(record.details.spatial) : null;
  const before = previous ? previous.currentGeometry : fieldPointGeometry(record.location?.current);
  if (same(before, after)) throw Error("The current geometry is unchanged.");
  if (before && !reason?.trim()) throw Error("Add a reason before correcting or clearing the current location.");
  const originalGeometry = previous?.originalGeometry || before || after;
  return normalizeFieldSpatial({crs: "EPSG:4326", originalGeometry, currentGeometry: after, revisions: [...(previous?.revisions || []), {changedAt, changedBy: changedBy?.trim() || "Unattributed draft", reason: reason?.trim() || "Initial manually recorded location.", before, after, source, accuracyMetres}]});
}

export function normalizeAdditionalFieldLinks(value) {
  const output = {};
  for (const name of Object.keys(additionalFieldLinks)) if (Object.hasOwn(value, name)) {
    const entries = list(value[name], additionalFieldLinks[name], 30).map(item => identifier(item, additionalFieldLinks[name]));
    if (new Set(entries).size !== entries.length) throw Error(`${additionalFieldLinks[name]} must be distinct.`);
    output[name] = entries;
  }
  if (Object.values(output).reduce((sum, entries) => sum + entries.length, 0) > 100) throw Error("A capture supports up to 100 additional linked records.");
  return output;
}

export function normalizeFieldDetails(value) {
  if (value === undefined) return undefined;
  keys(value, ["schemaVersion", "consultation", "measurement", "successor", "spatial"], "Field details");
  if (value.schemaVersion !== 1) throw Error("Use field detail schema version 1.");
  const result = {schemaVersion: 1};
  if (Object.hasOwn(value, "spatial")) result.spatial = normalizeFieldSpatial(value.spatial);
  if (Object.hasOwn(value, "consultation")) {
    const source = value.consultation;keys(source, ["purpose", "method", "participantContext", "issues", "commitments"], "Consultation details");
    result.consultation = {purpose: string(source.purpose, "Consultation purpose", 2000), method: string(source.method, "Consultation method", 2000), participantContext: string(source.participantContext, "Deidentified participant context", 4000),
      issues: list(source.issues, "Consultation issues", 30).map(issue => string(issue, "Consultation issue", 2000)),
      commitments: list(source.commitments, "Consultation commitments", 20).map(item => {keys(item, ["description", "owner", "dueDate"], "Consultation commitment");return {description: string(item.description, "Commitment description", 2000), owner: string(item.owner, "Commitment owner", 500), dueDate: date(item.dueDate)};})};
  }
  if (Object.hasOwn(value, "measurement")) {
    const source = value.measurement;keys(source, ["value", "unit", "method", "instrument", "conditions", "takenAt"], "Measurement details");
    if (source.value !== null && !Number.isFinite(source.value)) throw Error("Measurement value must be a finite number or blank for an incomplete draft.");
    if (source.takenAt !== null && (typeof source.takenAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(source.takenAt) || !Number.isFinite(Date.parse(source.takenAt)))) throw Error("Measurement time must be an ISO timestamp or blank.");
    result.measurement = {value: source.value, unit: string(source.unit, "Measurement unit", 200), method: string(source.method, "Measurement method", 2000), instrument: string(source.instrument, "Measurement instrument", 1000), conditions: string(source.conditions, "Measurement conditions", 4000), takenAt: source.takenAt};
  }
  if (Object.hasOwn(value, "successor")) {
    const source = value.successor;keys(source, ["captureId", "reason", "sourceRecordSha256", "sourceVersionId", "pinKind"], "Prior retained capture");
    const reason = string(source.reason, "Successor reason", 2000);
    if (!reason.trim() || source.pinKind !== "retained_manifest" || typeof source.sourceRecordSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sourceRecordSha256)) throw Error("A successor requires a reason and the exact retained manifest SHA256.");
    result.successor = {captureId: identifier(source.captureId, "Prior capture"), reason, sourceRecordSha256: source.sourceRecordSha256, sourceVersionId: identifier(source.sourceVersionId, "Prior manifest version"), pinKind: "retained_manifest"};
  }
  return result;
}
