# Browser recovery

This shared module is licensed under Apache-2.0; see LICENSE and NOTICE. Its application-specific adapters, credentials and hosted operation retain their own boundaries. GitHub source release does not publish an npm or Python registry package.

`@categori/browser-recovery` is a newly authored shared package for maintaining bounded recovery snapshots in browser storage. Apps supply their own verified identity, deployment namespace, payload validation and lifecycle rules. The package performs no authentication, token verification, authorization, provider requests, domain processing or billing.

```js
import {createScopedRecoveryStore} from "@categori/browser-recovery";

const scope = {
  deployment: verifiedContext.deployment,
  issuer: verifiedContext.issuer,
  subject: verifiedContext.subject
};
const recovery = createScopedRecoveryStore({
  storage: () => window.sessionStorage,
  product: "lng0",
  maxBytes: 2 * 1024 * 1024,
  validatePayload: (payload) => validatePendingGeneration(payload),
  assertCurrent: (savedScope, resource) => currentContextMatches(savedScope, resource)
});

const saved = recovery.write(scope, "new", pendingGeneration);
const restored = recovery.read(scope, "new");
if (restored.ok && restored.status === "read") usePendingGeneration(restored.payload);
if (saved.ok) recovery.remove(scope, "new", saved.receipt);
```

`scope` contains exactly `deployment`, `issuer` and `subject`, with nonempty bounded strings. Product names contain up to 64 ASCII letters, digits, periods, underscores or hyphens and start with a letter or digit. Resource identifiers are exact strings up to 1,024 UTF-16 units; scope strings have the same bound. Identifiers reject leading/trailing whitespace, controls and unpaired UTF-16 surrogates. Every key includes the fixed product, all three scope fields and the resource. The version 1 envelope repeats that tuple and carries a fresh UUID revision. An envelope from another scope, product or resource is rejected even if copied under the current key. Deployment identifies the app's trusted deployment namespace; it does not create a business tenant or cross-app identity mapping.

`read(scope, resource)`, `write(scope, resource, payload)` and `remove(scope, resource, receipt)` are synchronous. Successful results have `ok: true` and one of these statuses:

| Status | Meaning |
| --- | --- |
| `read` | A validated fresh mutable `payload` copy and opaque `receipt` are available. |
| `written` | Storage accepted the snapshot; an opaque `receipt` is available. |
| `missing` | No snapshot exists under this exact key. |
| `removed` | The bytes still matched the receipt and removal completed. |
| `changed` | The bytes no longer matched the receipt; they remain untouched. |

Failures have `ok: false`, a status of `invalid`, `corrupt`, `oversize`, `unavailable` or `stale-context`, and a generic `reason`. Results contain no payload on failure. A storage getter, method getter, read, quota error or removal error produces an explicit failure, never a successful fallback to memory. If the context changes after a completed write or removal, the failure includes `written: true` or `removed: true` to describe the storage effect. A method that throws can have an unknown partial effect; callers must reconcile through a guarded read. Storage failures and corrupt/oversized snapshots are not automatically deleted.

The storage accessor runs inside a guard. Passing `storage: () => window.sessionStorage` allows browser property access failures to be reported. The caller supplies a pure synchronous `assertCurrent(scope, resource)` predicate, normally covering verified identity, expiry, active route, draft generation and disposal. Only exact `true` passes; exceptions, promises and other truthy values fail. Checks occur before and after accessors and storage operations, and after payload validation. Scope and resource are captured before these callbacks. An app must also check its captured lifecycle before applying a returned payload or committing asynchronous domain results.

Payloads are ordinary JSON: null, booleans, finite numbers, strings, dense arrays and plain objects. Unknown JSON fields and null values survive. Source objects and returned objects are independent snapshots. Accessors, cycles, class instances, functions, undefined, symbols, sparse arrays and hidden object properties are rejected; accessors and `toJSON` methods are never invoked. Domain validators receive a deeply frozen snapshot and must return exact synchronous `true`. The entire serialized envelope must fit `maxBytes`, an integer between 1 byte and 16 MiB. Preparation also bounds depth to 64 and the visited shape to 100,000 nodes/properties. Both UTF-8 bytes and JSON escaping count toward the final storage limit.

Receipts are opaque, private, nonserializable capabilities belonging to one store instance. Keep them in memory; do not log them or payloads. Reloading the app requires a fresh `read` receipt. Removal requires the correct tuple and compares the exact bytes associated with its read/write receipt. A newer write receives a different revision even when its payload is identical, so an older receipt cannot remove it. Browser Storage has no atomic compare-and-delete primitive: this check is best-effort for synchronous same-tab sessionStorage and cannot guarantee compare-and-delete against arbitrary external writers. Do not treat it as database CAS, cross-tab coordination, persistent identity authority or a retention guarantee.

The package does not enumerate storage or inspect old app keys. Legacy unscoped snapshots remain untouched and must not be automatically restored or migrated without independently established ownership. Publication, licensing and external redistribution have not been approved; version `0.1.0-alpha.1` remains private.

Run the local tests with `npm test` from this directory. Tests use an in-memory Storage stand-in and make no provider or network requests.
