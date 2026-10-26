# Client onboarding and exit record

Use this preparation checklist for one agreed engagement and its exact deployment. It creates no service contract, authorization, accepted security review or professional approval. Keep completed records in the private client/deployment evidence location; only this empty instrument belongs in source control. The canonical engagement, source-rights register, grants, qualification decisions and issued outputs remain authoritative.

Create a private preparation packet from the application root:

```sh
node tools/prepare-consultancy-review.mjs --template /private/client-operations.json
node tools/prepare-consultancy-review.mjs --check /private/client-operations.json
node tools/prepare-consultancy-review.mjs --check /private/client-operations.json --require-evidence
```

The new file is created exclusively with mode 0600; an existing record is never overwritten. `--check` validates structure and reports pending items without reading referenced files. `--require-evidence` exits 2 while scope/checks are incomplete. Even a complete packet grants no acceptance. Each reported evidence item needs its private reference, exact SHA-256, observation time, observer reference, actual/synthetic label and observed result. A non-applicable item requires an owner and rationale. Completion alone does not establish that the evidence is adequate or the rationale acceptable.

Fill `scope` with the owning account/project/engagement, exact source commit, deployment profile and a secret-free configuration digest. Use the packet's stable check IDs; the [domain definitions](../../src/lib/consultancy-operations.js) list the required evidence questions. Never enter keys, passphrases, access tokens, personal case details or raw provider errors. A secret-manager/key identifier is a reference, not permission to retrieve it.

| Stage/check | Concrete record to retain |
| --- | --- |
| `mandate_rights` | Client and responsible practitioner; ToR; editions/applicability/exclusions; permitted originals/versions; separate rights for custody, AI, disclosure and handover; agreed deliverables, review/acceptance and retention. |
| `deployment_boundary` | Exact artifact/configuration and operator; trusted single computer owner or accepted authenticated profile; separate client boundaries even on the same physical project; denied cross-client reads/search/AI/export. |
| `onboarding_roles` | Verified identity reference, granted resources/actions, role, inviter/acceptance, expiry, support contact and client acknowledgement. Local reviewer labels cannot stand for separate authenticated users. |
| `protected_stakeholders` | Neutral case summary; explicitly permitted encrypted field groups/originals; passphrase custody; unauthorized detail/history/original/export denials; masking and reviewed disclosure. Do not place protected test content in ordinary logs. |
| `ai_retrieval` | AI disabled, or approved exact route/model/evaluation, source processing rights, sensitivity, retention, credentials and cost/stop rules; lexical/semantic/hybrid, context/history and export denial; revocation immediately before dispatch and output. |
| `key_custody` | Device/volume/backup encryption; responsible key custodian and separate protected recovery reference; vault master-key recovery/rotation or credential re-entry test; case-passphrase limitations. Never bundle key material with ciphertext or project exports. |
| `backup_recovery` | Consistent stopped backup, encrypted off-machine custody/cadence/expiry, recovery-key reference; actual fresh restore and exact originals/outputs; agreed and measured recovery time/data-loss window; rollback artifact and owner. |
| `revocation` | User/grant/token/provider identifiers, requested/effective times, owner and reason; denied current source/case/index/AI/history/issued-output/export after revocation; queued/in-flight work checked. Previously downloaded bytes cannot be recalled. |
| `retention_closeout` | Editable deliverables plus complete permitted source package; recipient and destination restore receipt; unresolved references; grants/credentials revoked; deletion or legal-hold decision for workspaces/caches/AI/backups; expiry/residual-copy limits and client acknowledgement. |
| `incident_response` | Decision owner/private incident contact and agreed notification route; deployment-specific threat review; independent assessment scope/findings/disposition; privileged/log access and exercise reference. |
| `technical_briefing` | Named recipient/date, exact version/profile, explained data flow/limits, questions/corrections, acknowledgement and outstanding decisions; use the [briefing](security-briefing.md). |
| `retrospective` / `longitudinal` | Real authorized comparison/later-period evidence and responsible independent review; synthetic rehearsals are separately labelled and cannot close professional acceptance. |

## Revocation and closeout sequence

1. Agree the exit scope, destination custodian, deliverables, retention/legal holds and effective access end. Freeze the exact approved baseline and source/output manifest.
2. Export under current source and protected-case permissions. Have the destination custodian restore to a fresh location and inspect exact originals, issued byte hashes and history. Record omissions or external dependencies explicitly.
3. Revoke the exact current grants, user/provider access and optional processing credentials through their existing authority. Inspect in-flight/uncertain processing and retention; do not replay a timed-out remote job automatically.
4. Test unauthorized original, protected case group/history, lexical/semantic/hybrid retrieval, AI context/history, report and export paths using sanitized fixtures in that deployment. Record actual times/results/configuration. Do not query real protected records just to demonstrate denial.
5. Apply the agreed workspace/cache/AI deletion or legal-hold decision and backup expiry. Record the residual-copy and provider-retention limits. Retain minimal lawful audit evidence. Obtain the separate client closeout decision; this checklist does not supply it.

Backup files alone do not recover AI credentials without the separately protected master key or re-entry, and application grants cannot revoke already disclosed bytes. Single-owner loopback does not isolate another user on the same OS host. A reference AWS template, current automated tests or a public synthetic demo cannot substitute for these deployment/client records.
