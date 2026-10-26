import {createHash} from 'node:crypto';
import {stableJson} from '../src/lib/engagement-domain.js';
import {isProtectedMonitoringEvent,monitoringCaseReferences,protectedMonitoringSourceClosure} from '../src/lib/monitoring-protection.js';
import {createEngagementOriginArchiveContext} from './engagement-origin-archives.mjs';
import {engagementCaseGroups} from './engagement-case-access.mjs';

/** Derive a security registry from canonical content. Source protection is
 * cumulative across history and approved periods and follows byte aliases. */
export function collectEngagementCaseProtection({project,packages,originArchives=new Map()}={}){
 const context=createEngagementOriginArchiveContext(originArchives),origins=[...originArchives.keys()].map(sha=>context.read(sha)),currentViews=packages.flatMap(pack=>[{...pack.engagement,...pack.entities},...(pack.baselines||[])]),originViews=origins.flatMap(origin=>origin.packages.flatMap(pack=>[{...pack.engagement,...pack.entities},...(pack.baselines||[])])),all=[...currentViews,...originViews];
 const versions=[project,...origins.map(origin=>origin.project)].flatMap(value=>value.resources.flatMap(resource=>resource.versions)),sourceVersions=versions.map(row=>({...row})),assertions=all.flatMap(view=>view.assertions||[]),byCase=new Map(),bindings=[];
 for(const pack of packages)for(const view of [{...pack.engagement,...pack.entities},...(pack.baselines||[])])for(const event of view.events||[]){const inherited=event.origin?originViews.flatMap(row=>row.events||[]).filter(row=>row.id===event.origin.recordId):[];if(!isProtectedMonitoringEvent(event)&&!inherited.some(isProtectedMonitoringEvent))continue;const key=stableJson([pack.engagement.id,event.id]),prior=byCase.get(key)||{engagementId:pack.engagement.id,caseId:event.id,events:[]};prior.events.push(event,...inherited);byCase.set(key,prior);}
 for(const item of byCase.values()){
  const withoutBindings=event=>({...event,restricted:event.restricted?{...event.restricted,sourceBindings:[]}:undefined,restrictedProtection:event.restrictedProtection?{...event.restrictedProtection,sourceBindings:[]}:undefined}),combined={events:item.events,assertions,sourceVersions},closure=protectedMonitoringSourceClosure(combined),defaults=protectedMonitoringSourceClosure({...combined,events:item.events.map(event=>({...withoutBindings(event),history:(event.history||[]).map(withoutBindings)}))}),explicit=new Map();
  for(const event of item.events)for(const row of [event,...(event.history||[])])for(const source of monitoringCaseReferences(row).sourceBindings||[]){const groups=explicit.get(source.sha256)||new Set();for(const group of source.groups)groups.add(group);explicit.set(source.sha256,groups);}
  for(const sha256 of closure.sha256s){const versionIds=[...new Set(versions.filter(version=>version.sha256===sha256).map(version=>version.id))].sort(),groups=defaults.sha256s.has(sha256)?engagementCaseGroups:[...(explicit.get(sha256)||engagementCaseGroups)];if(versionIds.length)bindings.push({engagementId:item.engagementId,caseId:item.caseId,groups:[...groups].sort(),sourceSha256:sha256,versionIds});}
 }
 const caseIds=[...new Set([...byCase.values()].map(row=>row.caseId))].sort();bindings.sort((a,b)=>stableJson(a).localeCompare(stableJson(b)));return {caseIds,bindings,sha256:createHash('sha256').update(stableJson({caseIds,bindings})).digest('hex')};
}
