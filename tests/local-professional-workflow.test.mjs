import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createLocalWorkspaceStore} from "../server/local-workspace-store.mjs";
import {createAccountWorkspace} from "../server/local-account-workspace.mjs";
import {buildGapReportModel} from "../server/gap-report-model.mjs";

test("unfamiliar non-infrastructure mandates retain action reviews and frozen reports through restart and fresh restore", t => {
  const root = mkdtempSync(join(tmpdir(), "esia-professional-")), stores = [];
  const open = directory => {const store = createLocalWorkspaceStore({directory});stores.push(store);return store;};
  t.after(() => {for (const store of stores) {try {store.close();} catch {}}rmSync(root, {recursive: true, force: true});});
  let store = open(join(root, "source"));
  for (const context of ["Private advisory assignment", "Corporate labor review"]) {
    let project = store.createProject({name: `${context} ${randomUUID()}`, client: "Synthetic private client", phase: "Monitoring", period: "2026-10"});
    for (const key of ["resources", "evidence", "assessments", "actions", "reports"]) assert.deepEqual(project[key], [], `${key} starts empty`);
    const apply = command => project = store.mutate(project.id, project.revision, command);
    apply({type: "intake", mode: "managed", title: "Synthetic contractual criterion", filename: "criterion.txt", mediaType: "text/plain",
      contentBase64: Buffer.from("Synthetic client protocol 2026, clause 1: retain a dated response timetable.").toString("base64")});
    const firstVersion = project.resources[0].versions[0];
    apply({type: "evidence", versionId: firstVersion.id, locator: "Line 1, client protocol clause 1", note: "Synthetic criterion and dated timetable reviewed manually; no real compliance claim."});
    const evidenceId = project.evidence[0].id;
    apply({type: "assessment", framework: {authority: "Synthetic private client", name: "Client protocol", edition: "2026 synthetic", clause: "1"},
      applicability: {decision: "applies", rationale: "Explicit synthetic mandate", scope: context, period: "2026-10"},
      conclusion: "gap", reviewer: "Practitioner A", rationale: "Synthetic response record lacks the required dates.", evidenceIds: [evidenceId]});
    apply({type: "action", assessmentId: project.assessments[0].id, description: "Record response dates", owner: "Client liaison", dueDate: "2026-11-01",
      status: "open", closureEvidence: "Dated timetable reviewed against clause 1", reviewer: "Practitioner A"});
    const actionId = project.actions[0].id;
    apply({type: "issue", title: "Open commitments", reviewer: "Practitioner A", presentation: {paperSize: "A4"}});
    const firstReport = structuredClone(project.reports[0]);
    const update = {type: "action-update", actionId, status: "closed", reviewer: "Practitioner B", updateNote: "Verified synthetic timetable", verification: "The cited fixture meets the recorded acceptance criteria."};
    for (const invalid of [update, {...update, reviewer: "", closureEvidenceIds: [evidenceId]}, {...update, closureEvidenceIds: ["foreign-evidence"]}]) {
      assert.throws(() => store.mutate(project.id, project.revision, invalid), error => error.status === 400);
      assert.equal(store.getProject(project.id).revision, project.revision);
    }
    const staleRevision = project.revision;
    apply({...update, closureEvidenceIds: [evidenceId]});
    assert.throws(() => store.mutate(project.id, staleRevision, {...update, closureEvidenceIds: [evidenceId]}), error => error.status === 409);
    assert.equal(project.actions[0].id, actionId);
    assert.equal(project.actions[0].history[0].status, "open");
    assert.equal(project.assessments[0].conclusion, "gap", "Action closure never changes the finding");
    assert.deepEqual(project.reports[0], firstReport);
    apply({type: "issue", title: "Closure review", reviewer: "Practitioner B", presentation: {paperSize: "A4"}});
    const closedReport = structuredClone(project.reports[1]);
    const model = buildGapReportModel(closedReport);
    assert.equal(model.summary.actions.closed, 1);
    assert.equal(model.actions[0].closureCitations[0].sha256, firstVersion.sha256);
    assert.match(closedReport.markdown, new RegExp(firstVersion.sha256));
    apply({type: "action-update", actionId, status: "in_progress", reviewer: "Practitioner B", updateNote: "Further monitoring requested", verification: ""});
    apply({type: "intake", mode: "managed", resourceId: project.resources[0].id, filename: "criterion.txt", mediaType: "text/plain", contentBase64: Buffer.from("A later source version.").toString("base64")});
    const pack = store.exportProject(project.id);
    assert.equal(pack.packageVersion, 8);
    assert.throws(() => open(join(root, randomUUID())).importProject({...pack, packageVersion: 4}), /version 8/);
    const bad = structuredClone(pack);bad.project.actions[0].history[0].description = "Rewritten commitment";
    assert.throws(() => open(join(root, randomUUID())).importProject(bad), /snapshot actions/);
    store.close();store = open(join(root, "source"));
    assert.deepEqual(store.getProject(project.id).reports[1], closedReport);
    const restored = open(join(root, randomUUID()));
    const imported = restored.importProject(pack);
    assert.deepEqual(imported, store.getProject(project.id));
    assert.equal(restored.readVersion(project.id, firstVersion.id).bytes.toString().startsWith("Synthetic client protocol"), true);
    assert.equal(buildGapReportModel(imported.reports[0]).summary.actions.open, 1);
    assert.equal(buildGapReportModel(imported.reports[1]).summary.actions.closed, 1);
  }
});

test("legacy action IDs and frozen reports survive explicit migration; changed registered bytes cannot verify closure", t => {
  const directory = mkdtempSync(join(tmpdir(), "esia-action-legacy-"));
  const workspace = createAccountWorkspace({directory});
  const restoreDirectory = mkdtempSync(join(tmpdir(), "esia-action-restore-"));
  const restored = createAccountWorkspace({directory: restoreDirectory});
  t.after(() => {workspace.close();restored.close();rmSync(directory, {recursive:true,force:true});rmSync(restoreDirectory, {recursive:true,force:true});});
  const store = workspace.forAccount("local-default"), path = join(directory, "registered.txt");
  writeFileSync(path, "Exact synthetic original");
  let p = store.createProject({name: randomUUID(), client: "Private client", phase: "Monitoring", period: "2026"});
  const apply = command => p = store.mutate(p.id, p.revision, command);
  apply({type:"intake",mode:"registered",path,title:"Field record",mediaType:"text/plain"});
  apply({type:"evidence",versionId:p.resources[0].versions[0].id,locator:"Line 1",note:"Exact original"});
  apply({type:"assessment",framework:{authority:"Client",name:"Protocol",edition:"2026",clause:"1"},applicability:{decision:"applies",rationale:"Mandate",scope:"Corporate review",period:"2026"},conclusion:"insufficient_evidence",reviewer:"A",rationale:"More records needed",evidenceIds:[]});
  apply({type:"action",assessmentId:p.assessments[0].id,description:"Collect records",owner:"Client",dueDate:"2026-12-01",status:"open",closureEvidence:"Verified record"});
  apply({type:"issue",title:"Legacy report",reviewer:"A"});
  const report = structuredClone(p.reports[0]), id = p.actions[0].id;
  const closure = {type:"action-update",actionId:id,status:"closed",reviewer:"B",updateNote:"Verified",verification:"Exact original reviewed",closureEvidenceIds:[p.evidence[0].id]};
  writeFileSync(path, "Changed content at the same path");
  assert.throws(() => store.mutate(p.id,p.revision,closure), error => error.status === 409);
  writeFileSync(path, "Exact synthetic original");apply(closure);
  assert.deepEqual(p.reports[0], report);
  assert.equal(p.actions[0].history[0].revision, undefined, "Legacy reviewer/time are never invented");
  const pack = store.exportProject(p.id);
  assert.equal(pack.recordPackageVersion, 8);
  const imported = restored.restorePackage(pack).project;
  assert.equal(imported.actions[0].id,id);
  assert.deepEqual(imported.reports[0],report);
});
