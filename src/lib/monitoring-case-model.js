import {normalizeFieldGeometry} from "./field-record-details.js";

// Pure format validation shared by browser encryption and repository custody.
// These context pins do not establish a user's permission to read a case.
export const monitoringCaseFieldGroups=Object.freeze(["identities","location","investigation"]);
export const monitoringCaseCryptoLimits=Object.freeze({plainBytes:256000,cipherBytes:256016,cipherBase64Bytes:4*Math.ceil(256016/3),passphraseCharacters:1024,iterations:210000});
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const identifier=value=>typeof value==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes("..");
const fail=message=>{throw Error(message);};
function fields(value,allowed,required=allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key))||required.some(key=>!Object.hasOwn(value,key)))fail("Protected case needs its exact supported fields.");}
function text(value){if(typeof value!=="string"||value.length>monitoringCaseCryptoLimits.plainBytes||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail("Protected case values must be bounded text.");return value;}
const base64=bytes=>{let result="";for(let offset=0;offset<bytes.length;offset+=32768)result+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(result);};

export function normalizeMonitoringCaseContext(context){
 const keys=["format","schemaVersion","accountId","projectId","engagementId","caseId","fieldGroup","payloadVersion"];fields(context,keys);
 if(context.format!=="esia-monitoring-case-context"||context.schemaVersion!==2||context.payloadVersion!==1||!["accountId","projectId","engagementId","caseId"].every(key=>identifier(context[key]))||!monitoringCaseFieldGroups.includes(context.fieldGroup))fail("Use the exact account, project, engagement, case and protected field context.");
 return Object.fromEntries(keys.map(key=>[key,context[key]]));
}

export function normalizeMonitoringCaseGroupPayload(payload,fieldGroup){
 if(fieldGroup==="identities"){fields(payload,["identities"]);return {identities:text(payload.identities)};}
 if(fieldGroup==="investigation"){fields(payload,["investigativeNotes"]);return {investigativeNotes:text(payload.investigativeNotes)};}
 if(fieldGroup==="location"){
  fields(payload,["protectedLocation","crs","geometry"],["protectedLocation"]);const result={protectedLocation:text(payload.protectedLocation)};
  if(Object.hasOwn(payload,"geometry")||Object.hasOwn(payload,"crs")){if(!payload.geometry||payload.crs!=="EPSG:4326")fail("Protected geometry requires its explicit WGS84 EPSG:4326 context.");result.crs="EPSG:4326";result.geometry=normalizeFieldGeometry(payload.geometry);}
  return result;
 }
 fail("Choose identities, location or investigation protection explicitly.");
}

// Callers own the returned bounded buffer and must zero it after use.
export function decodeMonitoringCaseBase64(value,{maximum,exactLength,minimum=0}={}){
 if(!Number.isInteger(maximum)||maximum<1||maximum>monitoringCaseCryptoLimits.cipherBytes||!Number.isInteger(minimum)||minimum<0||minimum>maximum||exactLength!==undefined&&(!Number.isInteger(exactLength)||exactLength<minimum||exactLength>maximum)||typeof value!=="string"||!value||value.length>4*Math.ceil(maximum/3)||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail("The protected case envelope has invalid bounded base64.");let decoded;
 try{decoded=Uint8Array.from(atob(value),character=>character.charCodeAt(0));if(decoded.length>maximum||decoded.length<minimum||exactLength!==undefined&&decoded.length!==exactLength||base64(decoded)!==value)fail("The protected case envelope has invalid byte lengths or encoding.");return decoded;}catch(error){decoded?.fill(0);throw error;}
}

export function validateMonitoringCaseGroupEnvelope(envelope,expectedContext){
 fields(envelope,["version","algorithm","kdf","iterations","context","salt","iv","ciphertext"]);
 if(envelope.version!==2||envelope.algorithm!=="AES-GCM"||envelope.kdf!=="PBKDF2-SHA256"||envelope.iterations!==monitoringCaseCryptoLimits.iterations)fail("Use the supported context-bound protected case encryption format.");
 const context=normalizeMonitoringCaseContext(envelope.context);
 if(expectedContext!==undefined){const expected=normalizeMonitoringCaseContext(expectedContext);if(Object.keys(context).some(key=>context[key]!==expected[key]))fail("This encrypted field belongs to another account, project, engagement, case or field group.");}
 const decoded=[];try{decoded.push(decodeMonitoringCaseBase64(envelope.salt,{maximum:16,exactLength:16}));decoded.push(decodeMonitoringCaseBase64(envelope.iv,{maximum:12,exactLength:12}));decoded.push(decodeMonitoringCaseBase64(envelope.ciphertext,{maximum:monitoringCaseCryptoLimits.cipherBytes,minimum:16}));}finally{decoded.forEach(value=>value.fill(0));}
 return structuredClone(envelope);
}
