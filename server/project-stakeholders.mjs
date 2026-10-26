const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/;
const custodyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
export const projectStakeholderRoles = Object.freeze(['owner', 'sponsor', 'investor', 'lender', 'contractor', 'operator', 'guarantor', 'advisor', 'regulator', 'community', 'other']);
const fail = message => {throw Object.assign(new Error(message), {status: 400});};
function fields(value, allowed) {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('The project lifecycle or stakeholder record contains unsupported fields.');}
function text(value, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x1f\x7f]/.test(value) || required && !value.trim()) fail('Project lifecycle and stakeholder text is missing, too long or contains control characters.');
  return value.trim();
}
function id(value) {if (typeof value !== 'string' || !idPattern.test(value)) fail('Use an exact lifecycle, stakeholder or source identifier.');return value;}
function year(value) {if (!Number.isSafeInteger(value) || value < 1700 || value > 2300) fail('Project years must be whole numbers from 1700 through 2300; omit an unknown year.');return value;}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?![\s\S])/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) || new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value) fail('Use an exact valid calendar date, or omit an unknown date.');
  year(Number(value.slice(0, 4)));return value;
}
function sources(value = []) {
  if (!Array.isArray(value) || value.length > 64) fail('A lifecycle or role may cite at most 64 unique source identifiers.');
  const result = value.map(id);if (new Set(result).size !== result.length) fail('Source identifiers must be unique within a lifecycle or role.');return result;
}
function years(value, result, from, to) {
  if (value[from] !== undefined) result[from] = year(value[from]);
  if (value[to] !== undefined) result[to] = year(value[to]);
  if (result[from] !== undefined && result[to] !== undefined && result[from] > result[to]) fail('The start year cannot follow the end year.');
}
function uniqueIds(items, label) {const ids = new Set();for (const item of items) {if (ids.has(item.id)) fail(`${label} identifiers must be unique.`);ids.add(item.id);}return ids;}

/** Private descriptive metadata only. Recorded roles, dates, source labels and
 * custody associations confer no access, financing commitment or current role.
 * Missing years/statuses stay missing; no present-day status is inferred. */
export function normalizeProjectStakeholders(value = {}) {
  fields(value, ['lifecycle', 'stakeholders']);const result = {};
  if (value.lifecycle !== undefined) {
    if (!Array.isArray(value.lifecycle) || value.lifecycle.length > 64) fail('A project may record at most 64 lifecycle phases or milestones.');
    result.lifecycle = value.lifecycle.map(item => {
      fields(item, ['id', 'label', 'startYear', 'endYear', 'date', 'status', 'dateBasis', 'sourceIds']);
      const phase = {id: id(item.id), label: text(item.label, 300, true), status: text(item.status, 100, true), sourceIds: sources(item.sourceIds)};
      years(item, phase, 'startYear', 'endYear');
      if (item.date !== undefined) phase.date = date(item.date);
      if (item.dateBasis !== undefined) phase.dateBasis = text(item.dateBasis, 2000);
      return phase;
    });
    uniqueIds(result.lifecycle, 'Lifecycle');
  }
  if (value.stakeholders !== undefined) {
    if (!Array.isArray(value.stakeholders) || value.stakeholders.length > 256) fail('A project may record at most 256 stakeholders.');
    const phaseIds = new Set((result.lifecycle || []).map(item => item.id));
    result.stakeholders = value.stakeholders.map(item => {
      fields(item, ['id', 'name', 'roles', 'accountCustodyIds']);
      if (!Array.isArray(item.roles) || item.roles.length > 16) fail('A stakeholder may record at most 16 roles.');
      const stakeholder = {id: id(item.id), name: text(item.name, 500, true), roles: item.roles.map(role => {
        fields(role, ['role', 'phaseId', 'fromYear', 'toYear', 'status', 'sourceIds', 'basis']);
        if (!projectStakeholderRoles.includes(role.role)) fail('Choose a known stakeholder role; describe additional qualifications in its basis.');
        const record = {role: role.role, sourceIds: sources(role.sourceIds)};years(role, record, 'fromYear', 'toYear');
        if (role.phaseId !== undefined) {record.phaseId = id(role.phaseId);if (!phaseIds.has(record.phaseId)) fail('A stakeholder role must refer to a recorded lifecycle phase.');}
        if (role.status !== undefined) record.status = text(role.status, 100, true);
        if (role.basis !== undefined) record.basis = text(role.basis, 2000);
        return record;
      })};
      if (item.accountCustodyIds !== undefined) {
        if (!Array.isArray(item.accountCustodyIds) || item.accountCustodyIds.length > 64 || item.accountCustodyIds.some(value => typeof value !== 'string' || !custodyPattern.test(value)) || new Set(item.accountCustodyIds).size !== item.accountCustodyIds.length) fail('Stakeholder account associations must contain at most 64 unique exact custody UUIDs.');
        stakeholder.accountCustodyIds = [...item.accountCustodyIds];
      }
      return stakeholder;
    });
    uniqueIds(result.stakeholders, 'Stakeholder');
  }
  return result;
}
