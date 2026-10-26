# Categori Auth Client

This shared module is licensed under Apache-2.0; see LICENSE and NOTICE. Its application-specific adapters, credentials and hosted operation retain their own boundaries. GitHub source release does not publish an npm or Python registry package.

`@categori/app-auth-client` owns shared browser authorization-code/PKCE and session lifecycle behavior. Workspace Management is its initial maintenance owner; the package has no application, AI Studio, cloud SDK, branding or UI dependency. It accepts app-owned provider endpoints, public client ID, scopes, callback policy and distinct session/PKCE storage keys. The same version serves Workspace Management, ESIA, Docs Manager and Docs Repo through their existing provider adapters.

`createAuthClient` returns `loadAuthSession`, `beginSignIn`, `beginRegistration`, `beginPasswordReset`, `signOut`, `getStoredAuthSession`, `getAuthState` and `getAccessToken`. Registration/reset/logout endpoints are optional provider capabilities. App adapters retain their approved provider/client settings and any synchronous routing needed before starting a hosted flow. `resolveRedirectUri` and `resolveLogoutUri` support explicit local preview callbacks. The package accepts HTTPS provider endpoints and HTTPS or explicit HTTP loopback callback URLs; callback selection is trusted application configuration, not theme configuration.

The shared lifecycle binds callback completion to the initiating browser, storage, URL, PKCE record, prior stored session and client instance's current epoch. Sign-out, newer sign-in, changed storage, navigation and delayed token responses cannot silently replace newer state. Failed persistence may retain a display-only in-memory session, while `getStoredAuthSession` continues to require available browser storage. Sign-out tombstones old bytes when storage removal fails; these same-page checks are not cross-tab or database transactions.

Each app retains its own storage namespace, callback URL, provider client, login presentation and resource APIs. Sharing this module neither shares tokens between apps nor joins Users, organizations or clients. ESIA retains invitation-return handling in its adapter; its authenticated API independently enforces current identity and resource policy.

Docs Repo keeps its existing identity-token API profile and separate Entra provider
implementation. Its Cognito adapter requires durable callback persistence before
returning a usable session; its API adapter binds requests and awaited responses to
that current stored session. A display-only memory result supplies no API authority.

ID-token payloads are decoded for existing browser display fields, **not cryptographically verified by this package**. A displayed `authenticated` result is not a server authorization credential or proof of canonical User identity. Resource APIs must independently validate tokens and current identity/access state. The package does not perform provider discovery, global logout, account migration, a cross-app identity registry or grant evaluation.

Public-client PKCE uses random state/verifier bytes and `S256`; provider exchange requests reject redirects and omit ambient credentials. See [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) and [OAuth security guidance](https://www.rfc-editor.org/rfc/rfc9700.html). No client secret or production provider configuration is included here.

Provider-specific display claims stay configurable: `groupsClaim` defaults to `groups`; the existing Cognito adapters explicitly select `cognito:groups`. Group labels in browser state do not grant access. Logout's redirect parameter defaults to `post_logout_redirect_uri`; the Cognito adapters select `logout_uri`. Providers requiring additional logout credentials or protocol extensions need their own adapter work.

Version `0.1.0-alpha.5` is approved for an Apache-2.0 GitHub source release. Local consumption does not publish the package or deploy any app. Run `npm test` here; fixtures use synthetic providers and block external requests. Login colors, logos and CSS stay in each application pending a separate shared design-token extraction.

## Optional renewable access-token sessions

Identity-token sessions remain the default. Docs Manager explicitly opts into
`sessionMode: "access-token"` for its existing access/refresh-token records and
`refreshSession: true`. `getAuthState` supplies current display state, including
expired-but-refreshable records in that mode; it supplies no API authorization.
`getStoredAuthSession` returns only a fresh stored session. `getAccessToken` returns
only a current durable access token, renewing through the configured public-client
token endpoint when enabled. Concurrent requests for the same initiating session
share one renewal. An omitted replacement refresh token retains the original.

Sign-out/new sign-in, changed browser/storage or session bytes invalidate pending
renewal. Stale responses cannot store or return credentials or clear newer state.
Failed persistence tombstones matching old/attempted bytes; a display-only memory
session cannot authorize requests. These browser storage comparisons are not an
atomic cross-tab transaction and do not replace server authorization.

Optional `displayUser` retains app-owned decoded display fields. `pkceMaxAgeMs`
adds a finite transaction lifetime. `capturePkceContext` accepts small plain JSON
additional pending fields; generated state/verifier/callback/time fields take
precedence. `resolveCallbackHash` restores a validated app fragment only for the
matching callback, and `cleanupParameters` selects query keys to remove. Hooks
are synchronous trusted app configuration, separate from theme configuration.
Docs Manager retains its ten-minute transaction lifetime and sanitized invitation
fragment solely in browser pending state, never in provider URLs or token requests.
Existing identity-token adapters retain their callback and cleanup behavior.
