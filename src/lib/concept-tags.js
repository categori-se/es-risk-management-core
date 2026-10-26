// Classification vocabulary: these tags do not determine policy applicability.
export const conceptTags = Object.freeze([
  {id: "topic:resettlement", label: "Resettlement", kind: "topic", aliases: ["land acquisition"]},
  {id: "topic:livelihoods", label: "Livelihoods", kind: "topic", aliases: ["livelihood restoration"]},
  {id: "topic:engagement", label: "Engagement", kind: "topic", aliases: ["stakeholder engagement", "consultation"]},
  {id: "topic:biodiversity", label: "Biodiversity", kind: "topic", aliases: []},
  {id: "topic:labor", label: "Labor and human rights", kind: "topic", aliases: ["labour", "labor", "human rights"]},
  {id: "topic:safety", label: "Health and safety", kind: "topic", aliases: ["ohs", "health & safety"]},
  {id: "topic:pollution", label: "Pollution", kind: "topic", aliases: []},
  {id: "topic:climate", label: "Climate", kind: "topic", aliases: ["ghg", "carbon"]},
  {id: "framework:wb_esf", label: "World Bank ESF", kind: "framework", aliases: ["wbg esf", "wbg essf", "world bank essf", "wb esf"]},
  {id: "framework:ifc_ps_2012", label: "IFC PS 2012", kind: "framework", aliases: ["ifc ps2012", "ifc 2012"]},
  {id: "framework:ifc_ps_2006", label: "IFC PS 2006", kind: "framework", aliases: ["ifc 2006"]},
  {id: "framework:adb_esf", label: "ADB ESF 2024", kind: "framework", aliases: ["adb esf", "adb 2024"]},
  {id: "sector:energy", label: "Energy", kind: "sector", aliases: []},
  {id: "sector:health", label: "Health", kind: "sector", aliases: ["healthcare"]},
  {id: "sector:education", label: "Education", kind: "sector", aliases: []},
  {id: "sector:agriculture", label: "Agriculture", kind: "sector", aliases: []},
  {id: "sector:transport", label: "Transportation", kind: "sector", aliases: ["transport"]},
  {id: "place:usa", label: "USA", kind: "geography", aliases: ["united states", "united states of america", "us"]}
].map(tag => Object.freeze({...tag, aliases: Object.freeze(tag.aliases)})));

const key = value => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
const hash = value => {let result = 2166136261; for (const character of value) {result ^= character.codePointAt(0); result = Math.imul(result, 16777619);} return (result >>> 0).toString(16).padStart(8, "0");};
export function normalizeTags(values) {
  if (typeof values === "string") values = values.split(/[,;\n]/);
  if (!Array.isArray(values) || values.length > 50) throw new Error("Use up to 50 concept tags.");
  const result = new Map();
  for (const input of values) {
    const label = typeof input === "string" ? input.normalize("NFKC").trim().replace(/\s+/g, " ") : input?.label;
    if (!label) continue;
    if (typeof label !== "string" || label.length > 100 || /[\x00-\x1f]/.test(label)) throw new Error("Tag labels must be text of at most 100 characters.");
    const normalized = key(label);
    const known = conceptTags.find(tag => [tag.id, tag.label, ...tag.aliases].some(value => key(value) === normalized));
    const tag = known ? {id: known.id, label: known.label, kind: known.kind} : {id: `custom:${hash(normalized)}`, label, kind: "custom"};
    result.set(tag.id, tag);
  }
  return [...result.values()];
}
