// SEMI-INTEGRATED test backend (NO database, NO production resources).
//
// Runs the REAL authentication chain (AuthenticationService login with Argon2id, RefreshService rotation + reuse detection, EdDSA tokens, SessionStore)
// over IN-MEMORY repositories, and the REAL commission report code — `createCommissionReportRoutes`, `CommissionReportService`, the real `NodeHttpServer` (CORS, routing,
// error mapping, envelope) and the real `RequestContextFactory` bearer-token chain — over an IN-MEMORY `CommissionReportReader`.
// Only the pieces that need PostgreSQL are replaced: the SQL reader and the user/credential/session stores. Wallet, catalog and transactions are
// minimal stubs so the SPA can reach its agent home screen. POST /__semi/advance-clock {ms} moves the SERVER clock forward (test harness only) so
// access-token / session expiry can be exercised for real.
//
// What this proves: SPA ⇄ real HTTP routes/service (query validation, agent isolation from the token, response shapes, error envelopes).
// What it does NOT prove: the SQL of the real reader, the real login, any persisted data. Those need an isolated PostgreSQL.
import { NodeHttpServer } from '../backend/src/infrastructure/http/node-http-server.ts';
import { StructuredLogger } from '../backend/src/infrastructure/logging/structured-logger.ts';
import { CommissionReportService } from '../backend/src/app/commission-report-service.ts';
import { createCommissionReportRoutes } from '../backend/src/interfaces/http/commission-report-routes.ts';
import { RequestContextFactory } from '../backend/src/interfaces/http/request-context-factory.ts';
import { generateKeyPairSync } from 'node:crypto';
import { createAuthRoutes } from '../backend/src/interfaces/http/auth-routes.ts';
import { AuthenticationService } from '../backend/src/app/authentication-service.ts';
import { RefreshService } from '../backend/src/app/refresh-service.ts';
import { SessionStore } from '../backend/src/modules/security/persistence/session-store.ts';
import { EdDsaTokenIssuer } from '../backend/src/infrastructure/crypto/eddsa-token-issuer.ts';
import { EdDsaTokenVerifier } from '../backend/src/infrastructure/crypto/eddsa-token-verifier.ts';
import { StaticSigningKeyProvider } from '../backend/src/infrastructure/crypto/static-signing-key-provider.ts';
import { Argon2idPasswordVerifier } from '../backend/src/infrastructure/crypto/argon2id-password-verifier.ts';
import { isRedactedField } from '../backend/src/infrastructure/logging/redaction.ts';
import { SensitiveValue } from '../backend/src/shared/security/secret.ts';
import { UserAccount } from '../backend/src/modules/security/domain/user-account.ts';
import { Credential } from '../backend/src/modules/security/domain/credential.ts';
import { toUserAccountRecord } from '../backend/src/modules/security/persistence/user-account-record-mapper.ts';
import { toCredentialRecord } from '../backend/src/modules/security/persistence/credential-record-mapper.ts';
import { ok, type Result } from '../backend/src/shared/result/result.ts';
import type { HttpRoute } from '../backend/src/infrastructure/http/http-server.ts';
import type { PartyRepository, PartyRecord } from '../backend/src/shared/ports/party-repository.ts';
import type { CommissionReportFilter, CommissionReportLine, CommissionReportLineDetail, CommissionReportReader, InactiveAgentCommissionLine } from '../backend/src/shared/ports/commission-report-reader.ts';

const PORT = Number(process.env.SEMI_PORT ?? 4000);
const SPA_ORIGIN = process.env.SEMI_SPA_ORIGIN ?? 'http://127.0.0.1:4173';
const AGENT_A = '11111111-1111-4111-8111-111111111111';
const AGENT_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
/** Accounts (login identifier -> party). The password is a test constant, not a secret. */
const PASSWORD = 'semi-password-not-a-secret';
const ACCOUNTS = [
  { login: '700000001', userId: '00000000-0000-7000-8000-0000000000a1', partyId: AGENT_A },
  { login: '700000002', userId: '00000000-0000-7000-8000-0000000000a2', partyId: AGENT_B },
  { login: '700000003', userId: '00000000-0000-7000-8000-0000000000a3', partyId: CUSTOMER },
];

const party = (id: string, partyType: string, displayName: string) => ({ id, parentId: null, partyType, accountNumber: `ACC-${id.slice(0, 4)}`, displayName, phone: '+000', zoneCode: 'NORTH', defaultCurrency: 'YER', status: 'ACTIVE' }) as unknown as PartyRecord;
const PARTIES = new Map<string, PartyRecord>([[AGENT_A, party(AGENT_A, 'AGENT', 'Agent A')], [AGENT_B, party(AGENT_B, 'AGENT', 'Agent B')], [CUSTOMER, party(CUSTOMER, 'CUSTOMER', 'A customer')]]);
const parties = { findById: async (id: string) => ok(PARTIES.get(String(id)) ?? null) } as unknown as PartyRepository;

// ---- seed data, relative to the current UTC month so the SPA's default period always contains it ----
const now = new Date();
const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
const at = (day: number, hour: number) => new Date(monthStart + (day - 1) * 86_400_000 + hour * 3_600_000);
let counter = 0;
function line(agentId: string, status: 'ACCRUED' | 'EXPECTED', when: Date, amount: string, currencyCode = 'YER'): CommissionReportLine & { agentId: string } {
  counter += 1;
  const n = String(counter).padStart(12, '0');
  return {
    agentId, factId: `aaaaaaaa-aaaa-4aaa-8aaa-${n}`, status, transactionId: `bbbbbbbb-bbbb-4bbb-8bbb-${n}`, transactionStatus: status === 'ACCRUED' ? 'SETTLED' : 'VALIDATED',
    serviceId: 'svc-1', packageRef: 'pkg-1', amount, currencyCode, eventAt: when, factAt: when, policyId: 'p-1', policyVersion: 1, formulaType: 'PERCENTAGE', formulaParameters: { rate: '0.1' }, fxReferenceId: null,
  } as CommissionReportLine & { agentId: string };
}
const LINES = [
  line(AGENT_A, 'ACCRUED', at(1, 10), '30', 'YER'), line(AGENT_A, 'ACCRUED', at(1, 11), '50', 'YER'), line(AGENT_A, 'ACCRUED', at(1, 12), '20', 'YER'),
  line(AGENT_A, 'EXPECTED', at(1, 13), '40', 'YER'), line(AGENT_A, 'ACCRUED', at(1, 14), '0.16', 'SAR'), line(AGENT_A, 'ACCRUED', at(1, 15), '0.13', 'SAR'),
  line(AGENT_B, 'ACCRUED', at(1, 10), '999777', 'YER'), // must never reach agent A
];

const reader: CommissionReportReader = {
  async listLines(filter: CommissionReportFilter): Promise<Result<readonly CommissionReportLine[]>> {
    const rows = LINES.filter((l) => l.agentId === filter.agentId && l.eventAt >= filter.from && l.eventAt < filter.to)
      .filter((l) => filter.status === undefined || l.status === filter.status)
      .filter((l) => filter.currencyCode === undefined || l.currencyCode === filter.currencyCode)
      .sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime() || (a.factId < b.factId ? -1 : 1))
      .filter((l) => filter.after === undefined || l.eventAt.getTime() > filter.after.eventAt.getTime() || (l.eventAt.getTime() === filter.after.eventAt.getTime() && l.factId > filter.after.factId));
    return ok(rows.slice(0, filter.limit));
  },
  async findLine(agentId: string, factId: string): Promise<Result<CommissionReportLineDetail | null>> {
    const found = LINES.find((l) => l.agentId === agentId && l.factId === factId);
    return ok(found === undefined ? null : ({ ...found, distributionModel: 'SINGLE_RECIPIENT', basisType: 'CUSTOMER_PRICE', projectionFactId: null, fxReference: null } as CommissionReportLineDetail));
  },
  async listLinesOfInactiveAgents(): Promise<Result<readonly InactiveAgentCommissionLine[]>> { return ok([]); },
};

let clockOffsetMs = 0;
const clock = { now: () => new Date(Date.now() + clockOffsetMs) };
const ACCESS_TTL_MS = 900_000;
const SESSION_LIFETIME_MS = 3_600_000;
const service = new CommissionReportService({
  reader, parties,
  policySource: { loadCandidates: async () => ok([]) },
  assignmentSource: { resolveFor: async (partyId: string) => ok({ agentId: partyId, agentGroupIds: [], agentTierIds: [] }) },
  clock,
});

// ---- the REAL authentication chain over in-memory stores ----
const keys = generateKeyPairSync('ed25519');
const signingKeys = new StaticSigningKeyProvider({
  privateKey: SensitiveValue.of(keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()),
  verificationPublicKeys: [keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()],
});
const tokenIssuer = new EdDsaTokenIssuer({ signingKeys });
const tokenVerifier = new EdDsaTokenVerifier({ signingKeys });
const hasher = new Argon2idPasswordVerifier();
const userRows = new Map<string, any>();
const credentialRows: any[] = [];
const sessionRows = new Map<string, any>();
const sequenceIds = { generate: () => crypto.randomUUID() as never };
for (const account of ACCOUNTS) {
  userRows.set(account.userId, toUserAccountRecord(UserAccount.create({ id: account.userId as never, partyId: account.partyId as never, loginIdentifier: account.login })));
  const hashed = await hasher.hash(SensitiveValue.of(PASSWORD));
  if (!hashed.ok) throw hashed.error;
  credentialRows.push(toCredentialRecord(Credential.create({ id: crypto.randomUUID(), userId: account.userId as never, kind: 'PASSWORD', hash: hashed.value }), isRedactedField));
}
const users = {
  save: async (r: any) => { userRows.set(String(r.id), r); return ok(undefined); },
  findById: async (id: string) => ok(userRows.get(String(id)) ?? null),
  findByLoginIdentifier: async (login: string) => ok([...userRows.values()].find((r) => r.loginIdentifier === login) ?? null),
};
const credentials = {
  save: async (r: any) => { credentialRows.push(r); return ok(undefined); },
  findById: async (id: string) => ok(credentialRows.find((r) => r.id === id) ?? null),
  findByUserAndKind: async (userId: string, kind: string) => ok(credentialRows.find((r) => String(r.userId) === String(userId) && r.kind === kind) ?? null),
};
const sessionRepository = {
  save: async (r: any) => { sessionRows.set(r.id, r); return ok(undefined); },
  saveAll: async (list: readonly any[]) => { for (const r of list) sessionRows.set(r.id, r); return ok(undefined); },
  findById: async (id: string) => ok(sessionRows.get(id) ?? null),
  findByUser: async (userId: string) => ok([...sessionRows.values()].filter((r) => String(r.userId) === String(userId))),
  findByFamily: async (family: string) => ok([...sessionRows.values()].filter((r) => r.refreshFamilyId === family)),
};
const sessions = new SessionStore({ repository: sessionRepository as never });
const authentication = new AuthenticationService({
  users: users as never, credentials: credentials as never, passwordVerifier: hasher, sessions, tokenIssuer, clock, ids: sequenceIds,
  lockoutPolicy: { maxFailedAttempts: 5, lockDurationMs: 900_000 }, sessionLifetimeMs: SESSION_LIFETIME_MS, accessTokenTtlMs: ACCESS_TTL_MS,
});
const refresh = new RefreshService({ sessions, tokenVerifier, tokenIssuer, clock, ids: sequenceIds, sessionLifetimeMs: SESSION_LIFETIME_MS, accessTokenTtlMs: ACCESS_TTL_MS });

// ---- the REAL request-context factory over the same verifier / account store ----
const contexts = new RequestContextFactory({ clock, idGenerator: sequenceIds, tenantId: 'tenant-semi', tokenVerifier, userAccounts: users as never, userRoles: { roleNamesOf: async () => ok([]) } as never });

const envelope = (data: unknown, meta: Record<string, unknown> = {}) => ({ status: 200, body: { data, meta: { correlationId: 'semi', ...meta } } });
const stubs: HttpRoute[] = [
  { method: 'POST', path: '/__semi/advance-clock', handler: async (req) => {
      const ms = Number((req.body as { ms?: number } | undefined)?.ms ?? 0);
      clockOffsetMs += Number.isFinite(ms) ? ms : 0;
      return envelope({ offset_ms: clockOffsetMs });
    } },
  { method: 'GET', path: '/api/v1/wallet/balance', handler: async (req) => envelope({ party_id: req.context.actor.partyId, currency: 'YER', wallet_kind: 'MAIN', ledger_balance: '100.0000', held: '0.0000', credit_limit: '0.0000', available: '100.0000', source: 'LEDGER_PROJECTION' }) },
  { method: 'GET', path: '/api/v1/transactions', handler: async () => envelope([], { nextCursor: null }) },
  { method: 'GET', path: '/api/v1/catalog', handler: async () => envelope([]) },
  { method: 'GET', path: '/health', handler: async () => ({ status: 200, body: { status: 'ok' } }) },
];
const authRoutes = createAuthRoutes({ authentication, refresh, accessTokenTtlMs: ACCESS_TTL_MS, clock });

const server = new NodeHttpServer({
  host: '127.0.0.1', port: PORT, logger: new StructuredLogger({ module: 'semi', minLevel: 'error', sink: () => {} }),
  corsAllowedOrigins: [SPA_ORIGIN],
  buildContext: (req) => contexts.fromIncoming(req) as never,
});
for (const route of [...stubs, ...authRoutes, ...createCommissionReportRoutes({ reports: service, clock })]) server.register(route);
const { host, port } = await server.listen();
process.stdout.write(`semi-integrated backend listening on http://${host}:${port}\n`);
process.on('SIGTERM', () => { void server.close().then(() => process.exit(0)); });
process.on('SIGINT', () => { void server.close().then(() => process.exit(0)); });
