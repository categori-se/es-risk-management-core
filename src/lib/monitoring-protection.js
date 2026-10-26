// One source protection closure for normal reports and general mission briefs.
// This is a disclosure projection, not an authorization or decryption service.
const revisions=record=>[record,...(Array.isArray(record?.history)?record.history:[])],hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),clone=value=>structuredClone(value);
export const monitoringCaseReferences=record=>record?.restricted?.schemaVersion===2?record.restricted:record?.restrictedProtection||{};
export const isProtectedMonitoringEvent=event=>revisions(event).some(row=>Boolean(row?.restricted||row?.restrictedOrigin||row?.restrictedProtection||row?.restrictedAvailable));

/** Protection follows exact original identity, including duplicate-byte
 * versions. It never follows similar quotation text from an unrelated source. */
export function protectedMonitoringSourceClosure(view){
 const events=(view.events||[]).filter(isProtectedMonitoringEvent),eventIds=new Set(events.map(row=>row.id)),directAssertionIds=new Set(events.flatMap(row=>revisions(row).flatMap(value=>value.assertionIds||[]))),versionIds=new Set(),sha256s=new Set();
 const captures=new Set(events.flatMap(row=>revisions(row).flatMap(value=>(monitoringCaseReferences(value).geometryBindings||[]).filter(ref=>ref.kind==='field_capture').map(ref=>ref.captureId))));
 for(const event of events)for(const row of revisions(event))for(const binding of monitoringCaseReferences(row).sourceBindings||[]){versionIds.add(binding.versionId);if(hash(binding.sha256))sha256s.add(binding.sha256);}
 const linked=record=>{const links=record.fieldCapture?.links;return captures.has(record.fieldCapture?.captureId)||(links?.grievanceIds||[]).some(id=>eventIds.has(id))||eventIds.has(links?.context?.grievanceId);};
 for(const assertion of view.assertions||[])if(revisions(assertion).some(linked))directAssertionIds.add(assertion.id);
 for(const assertion of view.assertions||[])if(directAssertionIds.has(assertion.id))for(const row of revisions(assertion)){if(row.versionId)versionIds.add(row.versionId);if(hash(row.sourceSha256))sha256s.add(row.sourceSha256);for(const pin of row.fieldCapture?[row.fieldCapture.manifest,...row.fieldCapture.media]:[]){versionIds.add(pin.versionId);if(hash(pin.sha256))sha256s.add(pin.sha256);}}
 const sources=(view.sourceVersions||[]).flatMap(revisions);
 for(const row of sources)if(versionIds.has(row.id)&&hash(row.sha256))sha256s.add(row.sha256);
 for(const row of sources)if(hash(row.sha256)&&sha256s.has(row.sha256))versionIds.add(row.id);
 return {eventIds,directAssertionIds,versionIds,sha256s};
}

/** Union across approved periods and source aliases. No later edit or unlink
 * releases a previously protected source, location or captured original. */
export function monitoringProtectionClosure(view){
 const views=[view,...(view.baselines||[])],closure={eventIds:new Set(),directAssertionIds:new Set(),versionIds:new Set(),sha256s:new Set(),missionPointIds:new Set(),missionIds:new Set(),indicatorIds:new Set(),measurementIds:new Set(),captureIds:new Set()};
 const combined=Object.fromEntries(['events','assertions','sourceVersions'].map(name=>[name,views.flatMap(current=>current[name]||[])])),part=protectedMonitoringSourceClosure(combined);for(const key of ['eventIds','directAssertionIds','versionIds','sha256s'])for(const value of part[key])closure[key].add(value);
 for(const current of views){
  for(const event of current.events||[])if(isProtectedMonitoringEvent(event))for(const record of revisions(event))for(const ref of monitoringCaseReferences(record).geometryBindings||[]){if(ref.kind==='mission_point')closure.missionPointIds.add(ref.pointId);if(ref.kind==='indicator')closure.indicatorIds.add(ref.indicatorId);if(ref.kind==='measurement')closure.measurementIds.add(ref.measurementId);if(ref.kind==='field_capture')closure.captureIds.add(ref.captureId);}
  for(const mission of current.missions||[])for(const row of revisions(mission))if((row.eventIds||[]).some(id=>closure.eventIds.has(id))){closure.missionIds.add(mission.id);const explicit=views.some(value=>(value.events||[]).some(event=>row.eventIds.includes(event.id)&&revisions(event).some(record=>(monitoringCaseReferences(record).geometryBindings||[]).some(ref=>ref.kind==='mission_point'&&ref.missionId===mission.id))));if(!explicit)for(const point of row.monitoringPoints||[])closure.missionPointIds.add(point.id);}
 }
 const sources=views.flatMap(current=>current.sourceVersions||[]).flatMap(revisions);
 for(const source of sources)if(closure.versionIds.has(source.id)&&hash(source.sha256))closure.sha256s.add(source.sha256);
 for(const source of sources)if(closure.sha256s.has(source.sha256))closure.versionIds.add(source.id);
 return closure;
}

/** Native ordinary views are disclosure projections. Detail envelopes and raw
 * private evidence are delivered through independently authorized case routes. */
export function projectMonitoringDisclosure(view,{project,closure=monitoringProtectionClosure(view),hideSourcePins=false,includeInternalBibliography=false}={}){
 const hidePins=value=>{if(typeof value==='string')return closure.versionIds.has(value)?undefined:value;if(Array.isArray(value))return value.map(hidePins).filter(row=>row!==undefined);if(!value||typeof value!=='object')return value;if(closure.versionIds.has(value.id)||closure.versionIds.has(value.versionId)&&Object.keys(value).every(key=>['versionId','sha256','sourceSha256'].includes(key)))return;const output={};for(const [key,item]of Object.entries(value)){if(['sourceSha256','sha256'].includes(key)&&closure.sha256s.has(item))continue;if(key==='revisionRelation'&&(closure.versionIds.has(item?.sourceVersionId)||closure.sha256s.has(item?.sourceSha256)||closure.versionIds.has(item?.predecessor?.versionId)||closure.sha256s.has(item?.predecessor?.sha256)))continue;const safe=hidePins(item);if(safe!==undefined)output[key]=safe;}return output;};
 const spatialAssertionIds=new Set([view,...(view.baselines||[])].flatMap(current=>(current.assertions||[]).filter(row=>revisions(row).some(value=>isProtectedMonitoringAssertion(value,closure))).map(row=>row.id)));
 const safeRecord=(name,record,inheritedExternalPrivate=false)=>{
  const externalPrivate=name==='externalReferences'&&(inheritedExternalPrivate||revisions(record).some(row=>row.linkedOriginal&&isProtectedMonitoringSource(row.linkedOriginal,closure)||closure.sha256s.has(row.claimedSha256)));
  const result=clone(record);if(Array.isArray(record.history))result.history=record.history.map(row=>safeRecord(name,row,externalPrivate));
  if(externalPrivate){for(const key of ['externalURL','accessDetails','declaredMetadata','claimedSha256','registrationStatement','linkedOriginal','linkedBy','linkedAt','linkStatement'])delete result[key];result.title='Authorized case evidence';result.filename='withheld';result.restrictedAvailable=true;}
  if(name==='events'&&closure.eventIds.has(record.id)){for(const key of ['restricted','restrictedOrigin','restrictedProtection','restrictedSha256','immediateMeasures','notificationObligations','investigation','rootCause','response','escalation','closureStatement'])delete result[key];result.publicSummary='Sensitive case under review';result.restrictedAvailable=true;}
  if(name==='assertions'&&isProtectedMonitoringAssertion(record,closure)){for(const key of ['locator','quote','note','fieldCapture','extraction','provenance','topics'])delete result[key];result.locator='Authorized case evidence';result.quote='';result.restrictedAvailable=true;}
  if(['requirements','obligations','monitoringObligations'].includes(name)&&closure.versionIds.has(record.sourceVersionId)){for(const key of ['title','text','description','locator'])if(Object.hasOwn(result,key))result[key]=key==='title'?'Requirement with protected source evidence':'';if(result.sources)result.sources=[];result.restrictedAvailable=true;}
  if(name==='missions'){if(closure.missionIds.has(record.id)){result.locations=[];result.itinerary='';}result.monitoringPoints=(record.monitoringPoints||[]).map(point=>closure.missionPointIds.has(point.id)||(point.photoAssertionIds||[]).some(id=>spatialAssertionIds.has(id))?{id:point.id,label:'Protected monitoring location',photoAssertionIds:[],restrictedAvailable:true}:clone(point));}
  if(name==='indicators'&&closure.indicatorIds.has(record.id)||name==='measurements'&&(closure.measurementIds.has(record.id)||closure.indicatorIds.has(record.indicatorId)||(record.assertionIds||[]).some(id=>spatialAssertionIds.has(id)))){result.location='Protected monitoring location';if(name==='measurements')result.note='';}
  return result;
 };
 const result=clone(view);if(Array.isArray(view.sourceReviews))result.sourceReviews=view.sourceReviews.filter(record=>!(record.search?.sources||[record.review]).some(source=>source&&(closure.versionIds.has(source.versionId)||closure.sha256s.has(source.sourceSha256))));if(!includeInternalBibliography&&Array.isArray(view.bibliography))result.bibliography=view.bibliography.filter(row=>row.clientVisible===true).map(row=>({...Object.fromEntries(['id','resourceId','resourceVersionId','instrumentId','citation','locator','purpose','authorityKind','clientVisible'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,clone(row[key])])),history:[],rightsSnapshot:Object.fromEntries(['category','licenseUri','attribution'].filter(key=>row.rightsSnapshot?.[key]).map(key=>[key,row.rightsSnapshot[key]]))}));for(const name of ['events','assertions','requirements','obligations','monitoringObligations','missions','indicators','measurements','externalReferences'])if(Array.isArray(view[name]))result[name]=view[name].map(row=>safeRecord(name,row));
 if(Array.isArray(view.sourceVersions))result.sourceVersions=view.sourceVersions.map(source=>redactProtectedMonitoringSource(source,closure));
 if(Array.isArray(view.baselines))result.baselines=view.baselines.map(snapshot=>{const projected=projectMonitoringDisclosure(snapshot,{closure,includeInternalBibliography});return closure.eventIds.size||JSON.stringify(projected)!==JSON.stringify(snapshot)?{...projected,format:'esia-engagement-snapshot-projection',sourceSnapshotSha256:snapshot.sha256,projection:{format:'esia-monitoring-disclosure',schemaVersion:1}}:clone(snapshot);});
 if(project){const output=clone(project);output.resources=(project.resources||[]).map(resource=>{const versions=(resource.versions||[]).map(version=>isProtectedMonitoringSource(version,closure)?{...redactProtectedMonitoringSource(version,closure),restrictedAvailable:true}:clone(version)),metadataHistory=(resource.metadataHistory||[]).filter(row=>versions.some(version=>version.id===row.versionId&&!version.restrictedAvailable)&&!closure.versionIds.has(row.versionId));if(versions.some(version=>version.restrictedAvailable))return{id:resource.id,title:'Authorized case evidence',kind:resource.kind,mode:resource.mode,metadataHistory,versions};return{...resource,versions,metadataHistory};});return {view:hideSourcePins?hidePins(result):result,project:hideSourcePins?hidePins(output):output,closure};}
 return hideSourcePins?hidePins(result):result;
}
export function isProtectedMonitoringSource(source,closure){return closure.versionIds.has(source.id)||closure.versionIds.has(source.versionId)||hash(source.sha256)&&closure.sha256s.has(source.sha256);}
export function isProtectedMonitoringAssertion(assertion,closure){return closure.directAssertionIds.has(assertion.id)||closure.versionIds.has(assertion.versionId)||hash(assertion.sourceSha256)&&closure.sha256s.has(assertion.sourceSha256);}
export function redactProtectedMonitoringAssertion(assertion,closure){
 const history=Array.isArray(assertion.history)?assertion.history.map(row=>redactProtectedMonitoringAssertion(row,closure)):null;
 if(!isProtectedMonitoringAssertion(assertion,closure))return {...clone(assertion),...(history?{history}:{})};
 const safe=Object.fromEntries(['id','revision','versionId','sourceSha256','reviewStatus','requirementIds'].filter(key=>assertion[key]!==undefined).map(key=>[key,clone(assertion[key])]));
 return {...safe,locator:'Restricted source locator withheld',quote:'Restricted evidence quotation withheld',restrictedAvailable:true,...(history?{history}:{})};
}
export function redactProtectedMonitoringSource(source,closure){
 if(!isProtectedMonitoringSource(source,closure))return clone(source);
 return {...Object.fromEntries(['id','resourceId','sha256','size','mediaType','availability'].filter(key=>source[key]!==undefined).map(key=>[key,clone(source[key])])),title:'Restricted source metadata withheld',filename:'withheld'};
}
/** A general mission brief does not carry protected source records under its
 * different mission secret. Public current records retain redacted history. */
export function publicMonitoringAssertions(assertions,closure){return assertions.filter(row=>!isProtectedMonitoringAssertion(row,closure)).map(row=>redactProtectedMonitoringAssertion(row,closure));}
