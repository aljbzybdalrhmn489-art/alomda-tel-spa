// REAL TRANSACTIONS V1 — E2E composition entry + seed (test infrastructure only).
//
// Starts the REAL, unmodified backend through its own `startApplication()` (the same
// bootstrap `src/main.ts` uses), with the ONE composition override the backend already
// exposes for tests: `transactionValidation.commissionCandidatePolicies`. The production
// composition passes an empty policy list (existing gap, intentionally NOT fixed here), so a
// real POST /transactions can only pass validation when a policy is supplied this way — exactly
// what the backend's own HTTP rig tests do.
//
// Before listening it seeds, idempotently, through the backend's own repositories (no backend
// source is modified), what a real MANUAL transaction needs for the bootstrap admin's party:
//   active MANUAL Service · pricing group + party assignment · service pricing (a cheap and an
//   unaffordable package) · global margin policy · YER<->SAR FX rates · default gateway ·
//   a funded MAIN/YER wallet position.
// The commission policy is passed in memory (there is no table or API for policies).
import { startApplication } from '../backend/src/app/bootstrap.ts';
import { EnvConfigProvider } from '../backend/src/infrastructure/config/env-config-provider.ts';
import { PostgresDatabase } from '../backend/src/infrastructure/db/database.ts';
import { PostgresUnitOfWork } from '../backend/src/infrastructure/db/pg-unit-of-work.ts';
import { UuidV7Generator } from '../backend/src/infrastructure/id/uuid-v7-generator.ts';
import { PostgresServiceRepository } from '../backend/src/infrastructure/db/pg-service-repository.ts';
import { PostgresPartyPricingAssignmentRepository } from '../backend/src/infrastructure/db/pg-party-pricing-assignment-repository.ts';
import { PostgresServicePricingRepository } from '../backend/src/infrastructure/db/pg-service-pricing-repository.ts';
import { PostgresMarginPolicyRepository } from '../backend/src/infrastructure/db/pg-margin-policy-repository.ts';
import { PostgresGatewayRepository } from '../backend/src/infrastructure/db/pg-gateway-repository.ts';
import { CommissionPolicy } from '../backend/src/modules/commission/domain/commission-policy.ts';

const tenantId = process.env['TENANT_ID'] ?? '';
const databaseUrl = process.env['DATABASE_URL'] ?? '';
if (tenantId === '' || databaseUrl === '') {
  process.stderr.write('e2e-main: TENANT_ID and DATABASE_URL are required.\n');
  process.exit(2);
}

export const E2E_TX_SERVICE_CODE = 'e2e-tx-manual';
export const E2E_TX_PACKAGE_CHEAP = 'e2e-pkg-cheap'; // 100 YER
export const E2E_TX_PACKAGE_EXPENSIVE = 'e2e-pkg-expensive'; // 50,000,000 YER (exceeds the funded balance)
const PRICING_GROUP_ID = '0192e2e0-0000-7000-8000-000000000001';
const VALID_FROM = new Date('2026-01-01T00:00:00Z');

async function seed(): Promise<void> {
  const database = new PostgresDatabase({ connectionString: databaseUrl, config: new EnvConfigProvider().database() });
  const unitOfWork = new PostgresUnitOfWork(database);
  const ids = new UuidV7Generator();
  const count = async (sql: string, params: readonly unknown[]): Promise<number> => {
    const result = await database.query(sql, params);
    return Number(result.rows[0]?.['n']);
  };

  try {
    const admin = await database.query(
      `SELECT u.party_id, p.zone_code FROM users u JOIN parties p ON p.tenant_id = u.tenant_id AND p.id = u.party_id WHERE u.tenant_id = $1 AND u.login_identifier = $2`,
      [tenantId, 'admin'],
    );
    const adminRow = admin.rows[0];
    if (adminRow === undefined) throw new Error('bootstrap admin not found for tenant ' + tenantId + ' (bootstrap:admin must run first)');
    const partyId = String(adminRow['party_id']);
    const zoneCode = String(adminRow['zone_code']);

    // MANUAL Service (ACTIVE; requires_hold true as the Service Authority CHECK demands).
    if ((await count(`SELECT count(*)::int AS n FROM services WHERE tenant_id = $1 AND code = $2`, [tenantId, E2E_TX_SERVICE_CODE])) === 0) {
      const services = new PostgresServiceRepository({ database, tenantId });
      const saved = await services.save({
        id: String(ids.generate()) as never, code: E2E_TX_SERVICE_CODE, name: 'E2E Transaction MANUAL Service',
        fulfillmentStrategy: 'MANUAL', requiresHold: true, status: 'ACTIVE',
        createdAt: VALID_FROM, createdBy: null, updatedAt: VALID_FROM, updatedBy: null,
      });
      if (!saved.ok) throw new Error('seed service: ' + saved.error.message);
    }

    // Pricing group + the admin party's assignment.
    await database.query(
      `INSERT INTO pricing_groups (tenant_id, id, name, zone_id, tier_rank, is_active) VALUES ($1, $2, 'E2E Standard', $3, 0, true) ON CONFLICT DO NOTHING`,
      [tenantId, PRICING_GROUP_ID, zoneCode],
    );
    if ((await count(`SELECT count(*)::int AS n FROM party_pricing_assignments WHERE tenant_id = $1 AND party_id = $2`, [tenantId, partyId])) === 0) {
      const assignments = new PostgresPartyPricingAssignmentRepository({ database, unitOfWork, tenantId });
      const assigned = await assignments.assign({
        id: String(ids.generate()), partyId: partyId as never, pricingGroupId: PRICING_GROUP_ID, validFrom: VALID_FROM, validTo: null, assignedBy: null, approvalRequestId: null, reason: null,
      });
      if (!assigned.ok) throw new Error('seed assignment: ' + assigned.error.message);
    }

    // Service pricing: one affordable package, one that can never be afforded (insufficient funds).
    const servicePricing = new PostgresServicePricingRepository({ database, unitOfWork, tenantId });
    for (const [packageId, price] of [[E2E_TX_PACKAGE_CHEAP, '100.0000'], [E2E_TX_PACKAGE_EXPENSIVE, '50000000.0000']] as const) {
      if ((await count(`SELECT count(*)::int AS n FROM service_pricing WHERE tenant_id = $1 AND package_id = $2`, [tenantId, packageId])) > 0) continue;
      const created = await servicePricing.createVersion({
        pricingGroupId: PRICING_GROUP_ID, serviceId: E2E_TX_SERVICE_CODE, packageId, currencyCode: 'YER', retailPrice: price, validFrom: VALID_FROM, validTo: null, version: 1, createdBy: null,
      });
      if (!created.ok) throw new Error('seed service pricing: ' + created.error.message);
    }

    // Global margin policy, FX rates (price is YER, the margin bridge goes through SAR), default gateway.
    if ((await count(`SELECT count(*)::int AS n FROM margin_policies WHERE tenant_id = $1`, [tenantId])) === 0) {
      const margin = new PostgresMarginPolicyRepository({ database, unitOfWork, tenantId });
      const saved = await margin.createVersion({
        id: 'unused', scope: 'GLOBAL', serviceId: null, fixedMinimumAmount: '0.0200', fixedMinimumCurrency: 'SAR',
        percentageMinimum: '0.0100', validFrom: VALID_FROM, validTo: null, version: 1, createdBy: null,
      });
      if (!saved.ok) throw new Error('seed margin policy: ' + saved.error.message);
    }
    if ((await count(`SELECT count(*)::int AS n FROM fx_rates WHERE tenant_id = $1`, [tenantId])) === 0) {
      await database.query(`INSERT INTO fx_rates (tenant_id, id, from_currency, to_currency, rate, effective_from, source) VALUES ($1, $2, 'YER', 'SAR', 0.02000000, $3, 'e2e')`, [tenantId, String(ids.generate()), VALID_FROM]);
      await database.query(`INSERT INTO fx_rates (tenant_id, id, from_currency, to_currency, rate, effective_from, source) VALUES ($1, $2, 'SAR', 'YER', 50.00000000, $3, 'e2e')`, [tenantId, String(ids.generate()), VALID_FROM]);
    }
    if ((await count(`SELECT count(*)::int AS n FROM gateways WHERE tenant_id = $1 AND is_default = true`, [tenantId])) === 0) {
      const gateways = new PostgresGatewayRepository({ database, tenantId });
      const saved = await gateways.save({ id: String(ids.generate()) as never, code: 'e2e-gw', name: 'E2E Gateway', gatewayType: 'NEUTRAL', defaultCurrencyCode: 'SAR', status: 'test-fixture', isDefault: true });
      if (!saved.ok) throw new Error('seed gateway: ' + saved.error.message);
    }

    // Wallet funding: the projection row the backend's own tests insert directly (no top-up API exists).
    await database.query(
      `INSERT INTO party_wallet_projection (tenant_id, party_id, currency_code, wallet_kind, ledger_balance, held_amount, credit_limit)
       VALUES ($1, $2, 'YER', 'MAIN', 1000000, 0, 0)
       ON CONFLICT (tenant_id, party_id, currency_code, wallet_kind) DO UPDATE SET ledger_balance = 1000000`,
      [tenantId, partyId],
    );
  } finally {
    await database.close();
  }
}

await seed();

const commissionPolicy = CommissionPolicy.create({
  id: 'e2e-commission-policy' as never,
  version: 1,
  scope: {},
  basisType: 'CUSTOMER_PRICE',
  formulaType: 'PERCENTAGE',
  formulaParameters: { rate: '0.1' },
  fundingSource: 'COMPANY_SUPPORTED',
  distributionModel: 'SIMULTANEOUS_WEIGHTED_SPLIT',
  weightParameters: { recipients: [{ hierarchyDepth: 0, weight: '1.0' }] },
  allowsCompanyRetention: false,
  currency: 'YER',
  validFrom: VALID_FROM,
});

const running = await startApplication({ transactionValidation: { commissionCandidatePolicies: [commissionPolicy] } });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void running.shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
