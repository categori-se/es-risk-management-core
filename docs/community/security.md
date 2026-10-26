# Community security boundaries

Essential authorization, audit records, vulnerability fixes and portable export belong to the Community core. This is the security model for the [documented profiles](architecture.md); it is not an independent assessment, certification or customer deployment approval.

## Trust and confidentiality

The local application serves one trusted computer owner. It binds to loopback and checks the exact Host/Origin. Other users on that OS instance can reach TCP loopback; file ownership alone does not isolate the API. Local account partitions and reviewer names do not authenticate mutually untrusted users. Use an accepted authenticated deployment or separate devices/VMs with independent storage and network boundaries when users need that separation.

A real-world project identity is business context, not a security boundary. Two clients working on that project retain separate mandates, evidence, findings, source rights and AI context. An explicit currently authorized grant is required for any cross-boundary sharing. A document hash proves integrity, not ownership, source permission or a right to reuse the content.

| Threat | Core protection | Acceptance or operator responsibility |
| --- | --- | --- |
| Another client's identifier supplied to an API | Account/workspace/resource checks; exact source and grant scope; foreign export denial | Verify the selected authenticated identity, storage and IAM configuration. Local partitions remain one owner's custody. |
| Stolen, forged or stale browser identity | Configured Gateway authorizer plus independent current-provider/User/grant checks | Accept actual JWT signatures, issuer/client, revocation and current provider behavior in the customer environment. |
| Stale or tampered originals | Immutable version/hash binding, exact source descriptors and current authorization before provider reads | Preserve object versioning/encryption/access policy and review external-source custody. |
| Retrieval or AI leaks across engagements | Scope-bound indexes, source authorization, task permissions, sensitivity and context/history checks | Approve provider/model, routing, retention, tools and budgets. Synthetic fixtures do not prove provider accuracy or retention behavior. |
| Source text treated as instructions | Draft-only model output, constrained task/tool boundary and explicit human review | Test representative adversarial inputs and inspect citations; no claim that prompt injection is universally solved. |
| Unauthorized approval or silent report changes | Review-role and revision checks; immutable approved baselines, issued files and audit history | Authenticate actual reviewers in a shared deployment. Local role labels alone are not independent sign-off. |
| Malicious authored content or links | Escaped metadata, constrained previews and explicit source operations | Retain browser/runtime updates and review permitted input formats and external processing. |
| Data loss or incomplete exit | Exact-source packages, explicit export/restore and version checks | Encrypt devices/backups, make a consistent stopped backup, test recovery and retain the prior release for rollback. |
| Compromised dependency or release | Pinned dependencies/bases, source inventories, scans, SBOM and source-bound runtime receipts | Verify the exact accepted artifact and independently trusted signer when configured; review findings and deployment changes. |

## Processing and operations

AI starts disabled. Core manual work needs no provider or categori.se service. Source custody, ordinary access, AI processing and redistribution are distinct permissions. A source-level restriction cannot be downgraded by a passage label. Optional native tools and providers declare their configuration and limits; an unavailable capability cannot silently select a paid fallback.

Keep application images separate from persistent client data. The Linux container uses a read-only image, a non-root runtime, dropped capabilities, bounded temporary storage and an explicit private data mount. Host networking preserves loopback checks but does not isolate the application from its host/operator. No idle consumer or schedule is created by this packaging.

The customer references require reviewed identity, origins, resource authority, immutable artifact/version, per-account storage, IAM, encryption, privileged access, logging and restore configuration. A parameterized template or passing local fixture is not a live customer acceptance result. The [authenticated profile](authenticated-profile.md) lists the deployment checks; [customer AWS guidance](customer-aws.md) describes its dedicated single-operator alternative.

## Evidence and release scope

`npm run test:installation` verifies the exact source inventory and a synthetic workflow, cross-account denial and fresh restore. The optional authenticated checker exercises the actual core with synthetic identity/object adapters. Container acceptance binds its image label to the source manifest and checks actual loopback listening, non-root runtime, account denial and persistence. These are implementation checks with explicit boundaries.

The private development pipeline also retains source/dependency/image scans, SBOMs, provenance, isolation/recovery test logs and evidence hashes. Scan results describe one source tree, image and vulnerability database; they do not clear unrelated bytes, full Git history or content rights. Private reports and operational identifiers are excluded from the source package.

Independent signing authority and release protections remain separate controls. This Apache-2.0 source preview is unsigned; a fingerprint or a public key shipped beside its own signature does not establish independent trust. Original institutional/client documents and research capture registries are excluded. Source publication supplies no independent security, accessibility or customer deployment acceptance.

Independent architecture/security review, practitioner usability and customer deployment acceptance remain unperformed unless their actual scope-specific evidence is supplied. Windows/macOS execution and VM-based container networking require separate acceptance. No SOC 2, regulatory, enterprise or professional-readiness claim follows from automated tests.

Use [SECURITY.md](../../SECURITY.md) for private vulnerability reporting. Keep real client information, credentials and identifying logs out of issues and discussions. Retain incident authority, contacts, privileged changes, backup/restore records and approved rollback targets with the deployment owner; this source package does not establish staffed incident response or a service-level commitment.
