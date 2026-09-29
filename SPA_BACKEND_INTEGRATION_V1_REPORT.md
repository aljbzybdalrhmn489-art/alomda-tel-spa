# SPA ↔ Backend Integration V1

This phase integrates the existing SPA (`spa_app-175.html`) with the existing
V1 backend (`backend/`), inside the scope PHASE: PROVIDER ADMIN +
AUTHORIZATION V1 already established (commit
`4e9ffaa0535bf8d29d4e6d53bdd43c9f1938c87a`). It does **not** rebuild the SPA,
does **not** change the backend's architecture, and does **not** introduce
True Multi-Tenant (deferred to V2, per `ADR-PROVIDER_ONBOARDING.md` §27).

**Out of scope, explicitly, for this phase** (see §15/§18/§30 below):
Agent/Wallet operations, Commission execution/settlement, a real Provider
Adapter, Kuraimi integration, True Multi-Tenant. None of this phase's claims
should be read as covering any of those.

---

## 1. Architecture

```
SPA (spa_app-175.html, single static file)
  → ApiClient (fetch wrapper, bearer token, error normalization)
    → Real ALOMDA TEL backend (Node/TypeScript, existing V1 API)
      → RequestContextFactory → AuthorizationService → ProviderOnboardingService
        → domain → repository → PostgreSQL
```

The SPA never talks to PostgreSQL or a Provider directly — every mutation
goes through the backend's own already-existing Admin HTTP API
(`provider-admin-routes.ts`), unchanged in its own business rules.

## 2. What is wired to the real backend (this phase's scope)

- **Authentication** — `POST /api/v1/auth/login`. The unified login screen
  tries the real backend FIRST; falls through to this SPA's own pre-existing
  mock `authenticateAccount()` only on a real 401 (wrong credentials) or a
  genuine network failure (backend unreachable) — preserving the
  Employee/Agent/Customer demo experience, which has no real backend
  equivalent yet.
- **Provider** — list / create / read / update / activate / deactivate.
- **ProviderAccount** — list / create / read / update / activate /
  deactivate / secretRef configuration (opaque reference only, never a raw
  secret — see §5).
- **ProviderMapping** — a NEW, additive admin screen (reached from the
  Provider Accounts workspace → "روابط المنتجات") wired to
  create/read/update/activate/deactivate. Deliberately separate from the
  SPA's own pre-existing Telecom Provider Mapping admin tab, which manages a
  different, pricing-domain-coupled concept and is left untouched (§14 of
  the phase directive: do not touch Accounting/Pricing architecture).

Every other module in the SPA (Agents, Employees, Customers, Telecom
Companies, WiFi, Games, Operations, Commissions, …) is unchanged — it keeps
using its own existing local/mock data, because no backend equivalent exists
for any of it yet.

## 3. Backend additions this integration genuinely required

Two small, mechanical backend additions were made — no architecture change,
no new business rule:

1. **CORS** (`src/infrastructure/http/node-http-server.ts`,
   `composition-root.ts`): a browser SPA is a different origin from the API
   by construction. `CORS_ALLOWED_ORIGINS` (comma-separated exact origins,
   `cors.allowedOrigins` through the same generic `ConfigProvider.business()`
   seam every other business value already uses) is opt-in — unset, the
   server's behavior is byte-for-byte identical to before this phase (no
   CORS header, ever). Never a wildcard; the `Origin` header is echoed back
   only when it exactly matches the configured allow-list.
2. **List endpoints** — `GET /api/v1/admin/providers`,
   `GET /api/v1/admin/provider-accounts?provider_id=`,
   `GET /api/v1/admin/provider-mappings?package_id=`. The Admin API had
   create/read-by-id/update/activate/deactivate for all three resources, but
   no way to list them — a genuine, simple, missing endpoint the SPA's own
   list screens require (`ProviderRepository.findAll()`,
   `ProviderMappingRepository.findByPackage()` — new repository methods,
   same pattern `ProviderAccountRepository.findByProvider()` already
   established; no new permission code, reusing `provider:read` /
   `provider_account:read` / `provider_mapping:read`).

## 4. Environment / configuration

The SPA ships as a single static HTML file with no build step. "Environment
configuration" for it means exactly one global, read before the SPA's own
script runs:

```html
<script>window.OMDA_API_BASE_URL = "https://api.your-environment.example";</script>
<script>/* the SPA's own script tag, unmodified, loaded after */</script>
```

Left unset, it defaults to `""` (same-origin) — a deployment that serves
this file from the same host/port as the API needs no configuration at all.
No production URL is hardcoded anywhere in the SPA file itself.

The backend's own configuration is unchanged except for the new, optional
`CORS_ALLOWED_ORIGINS` env var (see §3).

## 5. Security

- The access token is stored in `state.session`, persisted through the SAME
  `PersistenceStore`/localStorage mechanism this SPA already used for its
  own session state (which already persisted plaintext mock passwords —
  not a new class of risk). The refresh token is kept **in memory only**,
  never persisted — a disclosed tradeoff: a hard reload of a real-backend
  session survives only until the access token's own configured lifetime
  elapses, after which re-login is required. Production hardening
  (httpOnly/secure cookie transport, refresh rotation UI) is real future
  work, out of this integration's minimal-correction scope.
- `secretRef` is configured through its own dedicated dialog
  (`POST .../secret-ref`), sent once, never re-displayed. Every DTO the
  backend returns reports `secret_configured: boolean` only — the SPA never
  receives the real value back, so there is nothing for it to leak. Proven
  directly by the E2E suite (§7): after configuring a secret, the raw value
  is asserted absent from the page's own HTML content.
- No client-supplied `tenant_id` exists anywhere in the SPA's new code — the
  backend's own `RuntimeConfig.tenantId` is the only tenant context used,
  matching V1 Single-Tenant Deployment exactly.
- 401 from any real-backend call clears the session and returns to the
  login screen (`handleApiUnauthorized()`). 403 shows a Forbidden message
  without logging the user out. SPA-side permission checks
  (`currentAccountHasAdminActionPermission`) remain UX-only, exactly as this
  SPA's own pre-existing architecture already required — the backend is the
  real, independently-enforced boundary.

## 6. Known, disclosed UI/data limitations

- `Provider.code`/`adapter_key` have no dedicated form field — generated
  automatically (matching this SPA's own pre-existing "adapterKey defaults
  to its own generated id" precedent for the mock Provider create path).
- `retry_backoff`/`settlement_model`/`capabilities` have no UI field yet;
  sent as safe, disclosed defaults (`"none"` / `"NET"` / all-`false`).
- `Provider.type`/`Provider.notes` are cosmetic, client-only fields with no
  backend equivalent — preserved locally across a list refresh, never sent
  to or read from the backend.
- No concrete Provider adapter exists in this deployment (unchanged,
  disclosed placeholder from the prior phase) — Provider activation
  therefore legitimately fails the V1 Readiness Gate until a real adapter
  is registered in a future phase. The SPA shows this honestly (the actual
  backend error), never a fake success.
- Provider/ProviderAccount status is shown as the real backend vocabulary
  (`DRAFT`/`ACTIVE`/`INACTIVE`), not collapsed into "available"/"not
  available" — `ACTIVE` is labeled "administratively enabled," never implying
  a live-connectivity guarantee.

## 7. Testing

- **Backend**: typecheck / architecture boundaries / no-DB suite / real
  PostgreSQL suite — all unaffected by this phase's additions, run twice
  after this phase's own changes: **2723/2723 pass, 0 failures, both runs.**
- **SPA**: no separate unit-test framework exists for the single-file SPA;
  syntax-checked via Node's `Function` constructor and, more importantly,
  via real browser execution (Playwright) — a syntax error caused by an
  earlier draft (a literal `</script>` substring inside a comment, which
  the HTML parser — not the JS parser — treats as the real closing tag) was
  caught exactly this way and fixed.
- **E2E** (`e2e/`, Playwright): a new, minimal project
  (`@playwright/test`, Chromium only) that starts BOTH the real backend
  (migrated + bootstrapped + started, exactly as an operator would) and a
  tiny static file server for the SPA, then drives a real browser through:
  login (real backend), Provider create/edit/activate (honest Readiness
  Gate failure), reload persistence, ProviderAccount create + secretRef
  configuration (value never appears on the page), ProviderMapping
  create/activate/deactivate, logout, and a genuine unauthenticated 401
  against the real backend. **2/2 tests pass, run twice for stability.**
  Run it yourself:
  ```
  cd e2e
  npm install
  npx playwright install chromium
  # from a shell where DATABASE_URL_TEST is set (never echoed):
  npx playwright test
  ```
  The suite runs against a dedicated tenant (`e2e-spa-integration`) in the
  shared test database — it never touches any other test's own data.

## 8. Documentation scope statement

This phase integrates the existing SPA with the existing V1 backend. It does
**not** claim: Agent/Wallet operations complete, Commission
execution/settlement complete, Kuraimi integration complete, or Provider
execution complete. Those remain explicitly out of scope, tracked for a
future phase. True Multi-Tenant remains deferred to V2.
