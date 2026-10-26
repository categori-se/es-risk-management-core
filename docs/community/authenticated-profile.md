# Optional authenticated Community profile

Essential authorization, resource grants, audit records and data export belong to the Community source. They are not a proprietary upgrade. The default local application and container remain a **single operating-system owner's** workspace: local account partitions and declared practitioner names do not authenticate mutually untrusted clients or users. Keep that listener on loopback.

The optional authenticated source profile retains the actual core `server/access-service.mjs`, `access-store.mjs`, `gateway-handler.mjs`, current identity checks, immutable source adapters and professional engagement interfaces. A parameterized customer AWS adapter supplies deployment-specific identity and storage; it does not introduce a second E&S record model. Optional configuration and operational work do not convert authorization code into a commercial-only capability.

## Boundaries and required configuration

| Layer | Responsibility |
| --- | --- |
| Gateway | Verify actual signed access tokens through the configured issuer/client; trusted authorizer claims are not arbitrary browser JSON. Restrict accepted origins and bound request sizes. |
| Identity and permissions | Resolve native User by exact issuer/subject; recheck current provider, User, link, workspace/account status and exact resource action. Display email, project name, practitioner role and organization label confer no grant. |
| Engagement | Use configured authenticated engagement operations for mandates, evidence, assessments and approvals. Both current access permission and the required professional role apply. Local role history must not be relabelled as authenticated sign-off. |
| Original storage | Bind each canonical owning account to its distinct private bucket; preserve exact immutable version/hash and use current authorization before and after provider reads. No arbitrary bucket/key in a browser request. |
| Sharing | Use explicit resource invitations/grants, exact recipients, expiries and revocation. Granting one document does not grant its project, sibling sources, writes or access administration. |
| Customer deployment | Supply identity pool/client/issuer, AWS region/account, resource authority, exact permitted origins, data/artifact stores, IAM and bounded service settings. Keep credentials outside source and project packages. |

The generic adapter and reference infrastructure are under `deploy/community/authenticated/`. They do not contain the maintainer's production pool, client, cloud account, historical object migration map or founder aliases. The customer supplies an **application resource authority** so new source references do not impersonate the maintainer's installation. Existing records keep their original authority; changing deployment is not permission to rewrite immutable references.

That exact configured authority governs original registration, engagement source projection, resource indexes/connections, field ingestion and newly issued review references. A foreign reference cannot override it. If you build a customer field interface from the optional source adapters, pass `resourceAuthority` from the same reviewed customer configuration; no uploaded receipt or browser account label supplies that value. Historical package verification compares its frozen references and exact retained bytes without changing their authority.

Canonical cross-application identity enrollment and the hosted native-rendering function are not configured in this generic profile. They fail closed when unavailable. Ordinary customer-native identity, core resource grants and manual assessment are separate capabilities. Source permissions, content rights, provider processing permission and public redistribution are also separate decisions.

Generic customer offline-copy preparation, reconciliation and renewal currently return HTTP 503 before object work. Their inspectable implementation still depends on deployment-specific issuer/frontend configuration that this generic profile has not qualified. Online authenticated engagement/source/review operations remain available. A customer's offline workflow needs its own configured adapter and acceptance; the local owner's device drafts are a different boundary.

## Local source acceptance

From the development checkout, build and install a fresh Community candidate using the [installation instructions](install.md). Exercise its actual editable core:

```sh
node tools/check-community-authenticated.mjs /absolute/path/to/community-candidate .build/open-core-evidence/community-authenticated.json
```

The optional authenticated profile needs its declared optional SDK/build dependencies installed (`npm ci --include=optional` in the candidate). The default local/container profile may omit them. The checker imports the candidate's core and customer entry, supplies isolated synthetic current-identity and object adapters, and runs the real Gateway/service rules. It checks explicit configuration and denial of anonymous customer publication routes, anonymous/forged/wrong-client/expired token-context rejection, separate native Users with the same display address, foreign project/original denial, exact document-only grants, no sibling/project/write access, revocation before object reads, provider suspension, origin restrictions, customer-qualified references and mutation audit.

`npm run build:authenticated` invokes `tools/build-community-authenticated.mjs` inside the candidate and retains the Node 24 handler, adjacent parser-worker closure and file-digest manifest in `.build/authenticated-api/`. It performs no upload or deployment. Review the exact immutable deployment object/version, Community source-tree hash and customer configuration against `deploy/community/authenticated/access-backend.cfn.json`; a successful local build does not supply customer deployment approval.

These fixtures represent a trusted authorizer boundary; they do **not** verify a real JWT signature, IAM policy, live Cognito tenant, S3 configuration, customer deployment or independent security assessment. The source manifest and receipt pin the actual files tested. A parameterized template and a successful bundle build remain reference evidence until a customer deployment passes its own acceptance.

## Deployment acceptance before client-facing use

Use the [customer AWS reference](customer-aws.md) and authenticated adapter documentation to select the intended topology and complete its configuration. The default dedicated loopback host is a different profile from an authenticated multi-user API; do not expose the local listener to achieve collaboration.

A customer security/deployment owner must accept actual token verification, configured origins, IAM and object encryption/versioning/public-access policy, per-account custody, negative cross-client retrieval/AI/export tests, privileged access, log minimization, restore/rollback and usage/stop limits. Review each optional institutional original, AI route and renderer separately. Store actual evidence privately and record its exact deployed source/configuration digest.

Customer-owned, dedicated and logically isolated hosting are deployment choices with different responsibilities and cost. Commercial implementation or support may maintain those choices; the application does not require a paid service to inspect or extend its core authorization. No service-level, enterprise, regulatory or certification claim follows from shipping this source profile.
