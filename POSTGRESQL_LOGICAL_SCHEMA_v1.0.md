# POSTGRESQL_LOGICAL_SCHEMA — v1.0
## ALOMDA TEL · مخطط منطقي (LOGICAL ONLY — لا SQL · لا migrations · لا CREATE TABLE)

**المرجع:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` + `BACKEND_TECHNICAL_DESIGN_v1.0.md`
**التاريخ:** 2026-09-07

---

# 0. الاصطلاحات العامة (تنطبق على كل جدول)

| البند | القاعدة |
|---|---|
| **المفتاح الأساسي** | `UUIDv7` لكل الكيانات — قابل للترتيب زمنيًا · لا `SERIAL` على أي كيان مالي |
| **المبالغ** | `NUMERIC(20,4)` بلا استثناء · **`FLOAT`/`DOUBLE`/`REAL` ممنوعة منعًا باتًا** |
| **العملة** | `VARCHAR(3)` + FK → `currencies` — **مع كل مبلغ دائمًا** |
| **التوقيت** | `timestamptz` حصرًا · UTC |
| **JSON** | `JSONB` |
| **Soft Delete** | **ممنوع على أي كيان مالي.** مسموح للكيانات المرجعية عبر `status` فقط |
| **الطوابع** | `created_at` · `created_by` على كل جدول · `updated_at` · `updated_by` على الجداول القابلة للتحديث فقط |
| **الترابط** | `correlation_id` على كل جدول يمثل حدثًا أو حركة |
| **العزل** | كل جدول يخص طرفًا يُستعلم عبر `party_closure` — لا استعلام بلا فحص شجري |
| **التقسيم** | يُصمَّم من البداية، يُفعَّل عند الحاجة |

### مفاتيح سياسة الجدول
`APPEND-ONLY` = تُمنع `UPDATE`/`DELETE` بـTrigger · `MUTABLE` = تحديث مسموح · `PROJECTION` = مشتق قابل لإعادة البناء · `REFERENCE` = بيانات مرجعية · `ARCHIVE` = قراءة فقط بلا كاتب

---

# D1 · SHARED (بلا جداول)
`Money` · `PartyRef` · `AccountRef` · `ClientRef` · `Result<T>` · `DomainEvent` · `Clock` · `IdGenerator` — أنواع في الكود، لا جداول.

---

# D2 · IDENTITY & HIERARCHY

### 1. `zones` — REFERENCE
**الغرض:** المنطقة الجغرافية/النقدية. **تحدد العملة الأساسية للطرف.**
| الحقل | ملاحظة |
|---|---|
| `id` PK · `code` (`NORTH`/`SOUTH`/`SA`) UQ · `name` | |
| `base_currency_code` FK → `currencies` | **NOT NULL** — علاقة 1:1 بالعملة |
| `is_active` | |
- **قيود:** `UNIQUE(code)`
- **السياسة:** REFERENCE · **الأثر:** `zone` كيان تسعير/عملة — **وليس `gateway`**

### 2. `parties` — MUTABLE
**الغرض:** كل كيان تجاري: مسؤول · موظف · موزع · وكيل · نقطة بيع · عميل · مالك شبكة.
| الحقل | ملاحظة |
|---|---|
| `id` PK · `parent_id` FK → self | الشجرة التجارية |
| `party_type` | `SUPER_ADMIN`·`ADMIN`·`MASTER_AGENT`·`AGENT`·`SUB_AGENT`·`POS`·`CUSTOMER`·`EMPLOYEE`·`NETWORK_OWNER` |
| `account_number` UQ · `display_name` · `phone` UQ | |
| `zone_id` FK | **`pricing_group_id` أُزيل** — `NF-02`: كان يخلق دورة اعتماد D2→D7→D2. الشريحة الآن في `party_pricing_assignments` (D7) مع تاريخ |
| `default_currency_code` FK | **NOT NULL** — مُدخَل ترحيل إلزامي (B-3) |
| `status` | `PENDING_VERIFICATION`·`ACTIVE`·`SUSPENDED`·`BLOCKED`·`CLOSING`·`CLOSED` |
| `kyc_status` · `created_at` · `updated_at` | |
- **قيود:** `CHECK(parent_id ≠ id)` · `UNIQUE(account_number)` · `UNIQUE(phone)`
- **🔴 لا يوجد عمود `balance`** — بأي اسم، بأي شكل (ADR-104)
- **فهارس:** `(parent_id)` · `(party_type, status)` · `(zone_id)`
- **التقسيم:** لا

### 3. `party_closure` — MUTABLE (تُدار بـTrigger)
**الغرض:** جدول الإغلاق الهرمي — استعلام سلف/نسل بخطوة واحدة.
| الحقل | ملاحظة |
|---|---|
| `ancestor_id` FK · `descendant_id` FK · `depth` | يشمل الصف الذاتي `depth = 0` |
- **قيود:** `PK(ancestor_id, descendant_id)` · `CHECK(depth >= 0)` · Trigger يمنع الحلقات ويفرض `max_hierarchy_depth` (`CONFIGURATION`)
- **فهارس:** `(descendant_id, depth)` — لاستعلام الأسلاف
- **الأثر:** **العزل الشجري الإلزامي** على كل استعلام يمسّ طرفًا

### 4. `party_financial_limits` — MUTABLE
| الحقل | ملاحظة |
|---|---|
| `party_id` PK · `currency_code` | |
| `max_single_txn` · `max_daily_amount` · `max_daily_count` | `CONFIGURATION` |
| `credit_limit` · `credit_due_days` · `is_credit_allowed` · `allow_negative` | |
| `approved_by` · `approved_at` | Maker/Checker |
- **قيود:** `PK(party_id, currency_code)` · `CHECK(credit_limit >= 0)`

### 5. `kyc_submissions` — APPEND-ONLY
`id` · `party_id` · `doc_type` · `file_ref` (تخزين كائنات) · `status` · `reviewed_by` · `reviewed_at` · `reason`
- **الملفات في Object Storage، لا في قاعدة البيانات.**

---

# D3 · SECURITY

### 6. `users` — MUTABLE
`id` · `party_id` FK · `login_identifier` UQ · `status` · `must_change_password` · `locked_until` · `failed_attempts`
- **قيود:** `UNIQUE(login_identifier)`

### 7. `credentials` — MUTABLE
`id` · `user_id` FK · `kind` (`PASSWORD`/`TRANSACTION_PIN`) · `hash` (**Argon2id**) · `algo_params` · `rotated_at`
- **🔴 لا كلمة مرور نصية · لا سرّ · لا مفتاح**

### 8. `sessions` — MUTABLE
`id` · `user_id` · `device_id` · `issued_at` · `expires_at` · `refresh_family_id` · `refresh_generation` · `revoked_at` · `revoke_reason` · `ip_address` · `reuse_detected_at`
- **الأثر:** كشف إعادة استخدام رمز التحديث ⟹ **إبطال كل جلسات الحساب** + حدث أمني
- **فهارس:** `(user_id, revoked_at)` · `(refresh_family_id)`

### 9. `trusted_devices` — MUTABLE
`id` · `user_id` · `device_key` · `label` · `approved_at` · `approved_via` · `revoked_at` · `last_seen_at`
- **⚠️ `device_key` = بيانات اعتماد مرتبطة بالجهاز/Attestation — لا IMEI ولا MAC**

### 10. `permissions` — REFERENCE
`id` · `code` UQ (`tx:execute`, `deposit:approve`, `pricing:override_margin`, …) · `module` · `description` · `is_financial`

### 11. `roles` — REFERENCE
`id` · `name` UQ · `description` · `is_system_role`

### 12. `role_permissions` — MUTABLE
`PK(role_id, permission_id)`

### 13. `user_roles` — MUTABLE
`PK(user_id, role_id)` · `granted_by` · `granted_at`

### 14. `user_permission_overrides` — MUTABLE
`PK(user_id, permission_id)` · `is_granted` · `granted_by` · `reason`
- **الأثر:** **المنع الصريح (`is_granted = false`) يتفوق على أي منح من الدور**

### 15. `access_constraints` — MUTABLE (ABAC)
`id` · `subject_kind` (`ROLE`/`USER`) · `subject_id` · `constraint_kind` (`IP`/`TIME_WINDOW`/`AMOUNT_THRESHOLD`/`DEVICE_BOUND`/`TREE_SCOPE`) · `value` JSONB · `is_active`

### 16. `approval_requests` — MUTABLE (Maker/Checker)
| الحقل | ملاحظة |
|---|---|
| `id` · `operation_kind` · `payload` JSONB · `payload_hash` | البصمة تمنع تبديل المحتوى بعد الموافقة |
| `maker_id` · `maker_at` · `checker_id` · `checker_at` | |
| `status` (`PENDING`/`APPROVED`/`REJECTED`/`EXPIRED`/`CONSUMED`) · `reason` | |
- **قيود:** **`CHECK(checker_id IS NULL OR checker_id <> maker_id)`** · `UNIQUE(payload_hash) WHERE status='PENDING'`
- **الأثر:** العملية الحساسة **لا تُنفَّذ** إلا بصف `APPROVED` مطابق للبصمة، ويصبح `CONSUMED` بعدها

### 17. `security_events` — APPEND-ONLY
`id` · `occurred_at` · `user_id` · `event_kind` · `severity` · `ip_address` · `device_id` · `metadata` JSONB · `correlation_id`

### 18. `party_risk_metrics` — PROJECTION
`party_id` · `window` · `txn_count` · `failure_rate` · `dispute_rate` · `velocity_score` · `computed_at`
- **الأثر:** عتبات `CONFIGURATION` — لا رقم ثابت (`OPEN-BE-11`)

---

# D4 · ACCOUNTING CORE

### 19. `currencies` — REFERENCE
| الحقل | ملاحظة |
|---|---|
| `code` PK (`YER`·`YEO`·`SAR`·`USD`) · `name` · `symbol` | |
| `rounding_scale` | **YER/YEO = 0 · SAR/USD = 2** |
| `is_iso` | `YEO = false` (رمز داخلي) |
| `status` | |
- **قيود:** `CHECK(rounding_scale BETWEEN 0 AND 6)`

### 20. `fx_rates` — APPEND-ONLY
`id` · `from_currency` · `to_currency` · `rate` `NUMERIC(20,8)` · `effective_from` · `source` · `created_by`
- **قيود:** `CHECK(rate > 0)` · `UNIQUE(from_currency, to_currency, effective_from)`
- **فهارس:** `(from_currency, to_currency, effective_from DESC)`
- **🔴 لا يُدرَج `2.94` ولا أي سعر مخترع** — `UNKNOWN` حتى تصل بيانات حقيقية

### 21. `chart_of_accounts` — REFERENCE (نادر التغيير + موافقة)
| الحقل | ملاحظة |
|---|---|
| `id` PK · `code` UQ (6 خانات) · `parent_id` FK → self | |
| `level` | `1` · `2` · `3` |
| `element` | `ASSET`·`LIABILITY`·`EQUITY`·`REVENUE`·`EXPENSE` |
| `is_postable` | **`CHECK(is_postable = (level = 3))`** |
| `allowed_dimensions` `TEXT[]` · `required_dimensions` `TEXT[]` | |
| `is_system` · `allows_manual_posting` · `is_active` | الـ24 كلها `is_system = true` |
- **الأثر:** **24 حسابًا مُرحَّلًا عليه فقط.** لا حساب لأي طرف — أبدًا

### 22. `accounting_periods` — MUTABLE (محكوم)
`id` · `code` · `starts_on` · `ends_on` · `status` (`OPEN`/`CLOSING`/`CLOSED`) · `closed_by` · `closed_at` · `reopened_by` · `reopen_reason`
- **قيود:** لا تداخل بين الفترات · **الإقفال مرفوض مع وجود `financial_discrepancies` بحالة `OPEN`/`INVESTIGATING`**

### 23. `journal_entries` — **APPEND-ONLY**
| الحقل | ملاحظة |
|---|---|
| `id` PK · `entry_number` UQ · `period_id` FK | |
| `source_type` · `source_id` | **إلزاميان** |
| `description` · `status` (`POSTED`/`REVERSED`) | |
| `reversal_of_entry_id` · `reversed_by_entry_id` | |
| `created_by` · `created_at` · `correlation_id` | |
- **قيود:** **`UNIQUE(source_type, source_id)`** [Idempotency L2] · **`UNIQUE(reversal_of_entry_id)`** (عكس واحد لكل قيد) · Trigger: توازن لكل عملة معاملة · Trigger: رفض الترحيل في فترة `CLOSED` · Trigger: رفض `UPDATE`/`DELETE` عدا حقلي الربط عبر إجراء واحد
- **التقسيم:** شهري على `created_at`

### 24. `journal_entry_lines` — **APPEND-ONLY**
| الحقل | ملاحظة |
|---|---|
| `id` PK · `journal_entry_id` FK · `line_order` | |
| `account_id` FK · `account_code` · `account_name` | لقطات ثابتة |
| `currency_code` · `debit` · `credit` | عملة المعاملة |
| `reporting_currency_code` · `reporting_debit` · `reporting_credit` · `fx_rate_id` | ازدواج العملة |
| **الأبعاد الثمانية:** `party_type` · `party_id` · `gateway_id` · `provider_id` · `provider_account_id` · `zone_id` · `service_id` · `financial_account_id` | |
| `description` | |
- **قيود:** `CHECK(debit >= 0 AND credit >= 0 AND NOT(debit > 0 AND credit > 0) AND NOT(debit = 0 AND credit = 0))` · Trigger: البُعد ضمن `allowed_dimensions` وشامل `required_dimensions`
- **فهارس حاسمة:**
  - `(account_id, party_type, party_id, currency_code)` — رصيد الطرف
  - `(account_id, party_type, party_id, gateway_id, currency_code)` — محفظة العميل حسب البوابة
  - `(account_id, provider_id, provider_account_id, currency_code)` — رصيد المزوّد
  - `(account_id, financial_account_id, currency_code)` — البنك/الصندوق
  - `(journal_entry_id, line_order)`
- **التقسيم:** شهري — **مُصمَّم من البداية**

---

# D5 · WALLET

### 25. `party_wallet_projection` — **PROJECTION**
| الحقل | ملاحظة |
|---|---|
| `party_id` · `currency_code` · `wallet_kind` (`MAIN`/`INSURANCE`/`COMMISSION`) | |
| `ledger_balance` · `held_amount` · `credit_limit` · `available_amount` | `credit_limit` افتراضه **`0`** في v1 (سياسة المنح `FUTURE`) |
| **`is_spendable`** | `NF-08`: `MAIN=true` · `INSURANCE=false` · `COMMISSION=false` |
| `last_journal_entry_id` · `rebuilt_at` · `updated_at` | |
- **قيود:** `PK(party_id, currency_code, wallet_kind)` · **الحجز مسموح فقط على `is_spendable = true`** (يُفرض في D5)
- **السياسة:** يُكتب **حصريًا** من محدِّث الـProjection **داخل نفس معاملة القيد** · **صفر مسار أعمال يكتب فيه** · **قابل لإعادة البناء الكامل**
- **الأثر:** القراءة السريعة منه؛ **قرار الحجز من الـLedger داخل قفل الصف**

### 26. `wallet_holds` — MUTABLE (حالة محكومة)
| الحقل | ملاحظة |
|---|---|
| `id` PK · `party_id` · `wallet_kind` · `currency_code` · `amount` | |
| `transaction_id` **UQ** | يمنع ازدواج الحجز |
| `status` (`ACTIVE`/`CAPTURED`/`RELEASED`/`EXPIRED`) · `reason` | |
| `created_at` · `released_at` · `release_reason` | |
| `expires_at` | **NULL إلزاميًا** بعد `QUEUED` |
- **قيود:** `CHECK(amount > 0)` · **`CHECK(expires_at IS NULL OR status = 'ACTIVE')`** · Trigger: `expires_at` يجب أن يكون `NULL` إذا كانت المعاملة تجاوزت `VALIDATED`
- **فهارس:** `(party_id, currency_code, status) WHERE status='ACTIVE'` (جزئي)
- **🔴 ليس قيدًا محاسبيًا** — لا يظهر في أي تقرير مالي إلا كإفصاح

### 27. `credit_limits` — MUTABLE
`party_id` · `currency_code` · `limit_amount` · `granted_by` · `approval_request_id` · `valid_from` · `valid_to`
- **قيود:** `PK(party_id, currency_code)` · تغييره يتطلب Maker/Checker

### 28. `financial_accounts` — MUTABLE
**الغرض:** الحساب البنكي/الصندوق الحقيقي. **بُعد على `BANK`/`CASH`، وليس حسابًا في COA.**
`id` · `name` · `kind` (`BANK`/`CASH`/`WALLET_GATEWAY`) · `institution_name` · `external_reference` · `zone_id` · `status`
- **🔴 لا `createAccount` تلقائي** — الحساب المحاسبي واحد (`BANK`/`CASH`) والتمييز بالبُعد (ADR-103)

### 29. `legacy_wallet_ledger` — **ARCHIVE**
**الغرض:** استيراد `WALLET_LEDGER` من الـSPA مرة واحدة، للأثر التدقيقي فقط.
`id` · `legacy_id` · `party_id` · `movement_type` · `before_balance` · `amount` · `after_balance` · `description` · `reference_id` · `source_module` · `legacy_timestamp` · `imported_at`
- **السياسة:** **قراءة فقط · بلا كاتب · لا يُستخدم في أي تقرير ولا كمصدر رصيد**

---

# D6 · FUNDING

### 30. `gateways` — REFERENCE
`id` · `code` · `name` · `gateway_type` (`NEUTRAL`/`NORTH`/`SOUTH`) · `default_currency_code` · `status` · `is_default`
- **الأثر:** **بُعد محاسبي — لا يملك رصيدًا ولا يحدد عملة الطرف**

### 31. `funding_methods` — REFERENCE
`id` · `gateway_id` · `code` · `name` · `institution_name` · `verification_mode` (`MANUAL`/`AUTOMATIC`) · `receipt_required` · `transaction_fields` JSONB · `receiving_financial_account_id` · `status`

### 32. `party_funding_links` — MUTABLE
`id` · `party_id` · `gateway_id` · `funding_method_id` · `external_account_reference` · `credential_ref` (**KMS فقط**) · `status`
- **قيود:** `UNIQUE(party_id, funding_method_id, external_account_reference)`

### 33. `funding_requests` — MUTABLE (حالة محكومة)
| الحقل | ملاحظة |
|---|---|
| `id` PK · `party_id` · `gateway_id` · `funding_method_id` · `financial_account_id` | |
| `claimed_amount` · `approved_amount` · `currency_code` | **الاثنان يُخزَّنان** |
| `transfer_reference` · `depositor_name` · `receipt_file_ref` · `receipt_hash` | |
| `status` (`SUBMITTED`/`UNDER_REVIEW`/`APPROVED`/`REJECTED`/`UNMATCHED`) | |
| `journal_entry_id` · `approval_request_id` · `reviewed_by` · `reviewed_at` · `reason` | |
- **قيود:** **`UNIQUE(receipt_hash)`** · **`UNIQUE(gateway_id, funding_method_id, transfer_reference)`** · `CHECK(approved_amount IS NULL OR approved_amount > 0)`
- **فهارس:** `(party_id, status)` · `(status, created_at)`

### 34. `bank_statement_lines` — APPEND-ONLY
`id` · `financial_account_id` · `statement_date` · `external_reference` · `amount` · `currency_code` · `raw_payload` JSONB · `matched_funding_request_id` · `match_status`
- **قيود:** `UNIQUE(financial_account_id, external_reference)`
- **الأثر:** مدخل طبقة المطابقة 3 — **ينتظر بيانات بنكية حقيقية (`OPEN-BE-09`)**

### 35. `provider_webhook_events` — **APPEND-ONLY**
`id` · `provider_id` · `provider_event_id` · `event_type` · `signature_valid` · `received_at` · `payload_redacted` JSONB · `processed_at` · `processing_result` · `nonce` · `sent_at_claimed`
- **قيود:** **`UNIQUE(provider_id, provider_event_id)`** [Idempotency L4]
- **الأثر:** `INSERT` أولًا → عند التعارض **ACK وتوقف** · رفض خارج نافذة `webhook_max_skew_seconds`
- **التقسيم:** شهري

---

# D7 · PRICING

### 36. `services` — REFERENCE
`id` · `code` · `name` · `service_family` (`TELECOM`/`GAMES`/`VOUCHER`/`SUBSCRIPTION`/`WIFI`/`MANUAL`/`BILL`) · `company_id` · `category_id` · `fulfillment_strategy` · `status` · `requires_hold`

### 37. `packages` — REFERENCE
`id` · `service_id` · `code` · `name` · `unit_kind` · `face_value` · `status` · `display_order`

### 38. `pricing_groups` — REFERENCE
`id` · `name` · `zone_id` · `tier_rank` · `description` · `is_active`
- **الأثر:** الشريحة (Gold/Silver/Standard مسمّيات مثال — **الفعلية `CONFIGURATION`**)

### 38.b `party_pricing_assignments` — MUTABLE *(جديد · `NF-02`)*
**الغرض:** ربط الطرف بشريحته السعرية **مع تاريخ** — بديل `parties.pricing_group_id` الذي كان يخلق دورة D2↔D7.
`id` · `party_id` FK · `pricing_group_id` FK · `valid_from` · `valid_to` · `assigned_by` · `approval_request_id` · `reason`
- **قيود:** تداخل ممنوع لنفس الطرف · شريحة نشطة واحدة في أي لحظة
- **المالك:** **D7** — الاتجاه أصبح `D7 → D2` فقط (لا عكس)
- **مكسب إضافي:** تاريخ الشرائح محفوظ · تغيير الشريحة أصبح حدثًا مُدقَّقًا لا تعديل حقل

### 39. `service_pricing` — MUTABLE (مُدقَّق)
`id` · `pricing_group_id` · `service_id` · `package_id` · `currency_code` · `retail_price` · `valid_from` · `valid_to` · `version` · `created_by`
- **قيود:** `UNIQUE(pricing_group_id, package_id, valid_from)`
- **🔴 كل القيم `UNKNOWN/CONFIGURATION`** — لا سعر مخترع

### 40. `pricing_overrides` — MUTABLE (مُدقَّق)
`id` · `party_id` · `service_id` · `package_id` · `price` · `currency_code` · `approval_request_id` · `valid_from` · `expires_at` · `created_by` · `reason`
- **الأثر:** أعلى أولوية — يتطلب صلاحية + تدقيق + انتهاء صلاحية

### 41. `pricing_change_logs` — APPEND-ONLY
`id` · `entity_kind` · `entity_id` · `before_data` · `after_data` · `actor` · `reason` · `at`

---

# D8 · TRANSACTIONS

### 42. `transactions` — MUTABLE (حالة محكومة)
| الحقل | ملاحظة |
|---|---|
| `id` PK · **`client_ref`** · `party_id` · `initiator_user_id` | |
| `request_hash` | يكشف إعادة إرسال بنفس المفتاح ومحتوى مختلف |
| `service_id` · `package_id` · `provider_mapping_id` · `target_identifier` | |
| `status` · `requires_hold` · `fulfillment_strategy` | |
| **حقول القفل الثمانية:** `locked_customer_price` · `locked_provider_cost` · `locked_cost_currency` · `locked_fx_rate` · `fx_rate_id` · `locked_currency` · `pricing_rule_version` · `commission_policy_version` | |
| `ancestor_chain_snapshot` JSONB | لقطة الأسلاف — **الشجرة اللاحقة لا تمسّها** |
| `settlement_journal_entry_id` FK → `journal_entries` | **`hold_id` أُزيل** — `NF-01`: كان يخلق دورة FK مع `wallet_holds.transaction_id`. الاتجاه الوحيد الآن `wallet_holds → transactions` |
| `version` · `correlation_id` · `created_at` · `settled_at` | |
- **قيود:** **`UNIQUE(party_id, client_ref)`** [Idempotency L1] · Trigger: الانتقالات المسموحة فقط
- **فهارس:** `(status) WHERE status IN ('QUEUED','PROCESSING','PENDING_PROVIDER','MANUAL_RESOLUTION')` (جزئي) · `(party_id, created_at DESC)` · `(client_ref)`
- **التقسيم:** شهري على `created_at`

### 43. `transaction_status_history` — **APPEND-ONLY**
`id` · `transaction_id` · `from_status` · `to_status` · `actor_kind` (`USER`/`WORKER`/`WEBHOOK`/`SYSTEM`) · `actor_id` · `reason` · `at` · `correlation_id`
- **الأثر:** **كل انتقال يكتب صفًا — بلا استثناء.** لا انتقال بلا سجل

### 44. `outbox_events` — MUTABLE (حالة) + محتوى ثابت
`id` · `aggregate_type` · `aggregate_id` · `event_type` · `payload` JSONB · `status` (`PENDING`/`IN_FLIGHT`/`DONE`/`DEAD`) · `attempts` · `next_attempt_at` · `last_error` · `correlation_id` · `created_at`
- **فهارس:** `(status, next_attempt_at) WHERE status='PENDING'` (جزئي)
- **الأثر:** `INSERT` **داخل نفس معاملة** تغيير الحالة · Worker يلتقط بـ`FOR UPDATE SKIP LOCKED` · Dead-letter بعد `max_attempts` + إنذار · **لا حذف** (أرشفة بالتقسيم)

---

# D9 · PROVIDERS

### 45. `providers` — REFERENCE
| الحقل | ملاحظة |
|---|---|
| `id` · `code` · `name` · `adapter_key` · `provider_kind` (`REAL`/`SIMULATOR`) | |
| `status` · `timeout_ms` · `max_retries` · `retry_backoff` | **تُقرأ وتُفرَض فعليًا** |
| `settlement_model` (`NET`/`GROSS_PLUS_COMMISSION`) | `CONFIGURATION` لكل مزوّد |
| **مصفوفة القدرات:** `can_query_status` · `sends_webhook` · `provides_settlement_file` · `has_contractual_timeout_rule` · `accepts_idempotency_key` · `can_cancel` · `can_get_balance` | |
- **قيود:** **مزوّد `provider_kind='SIMULATOR'` ممنوع من الربط بـ`provider_mappings` نشط في الإنتاج** · **مزوّد بلا أي قدرة حسم قاطعة ممنوع من التنفيذ الآلي** (`is_auto_execution_enabled` محسوب ومفروض)

### 46. `provider_accounts` — MUTABLE
`id` · `provider_id` · `name` · `account_identifier` · `gateway_id` · `currency_code` · `priority` · `low_balance_threshold` · `status`
- **🔴 لا يوجد عمود `balance`** — الرصيد من `PROVIDER-BALANCE` بالأبعاد (ADR-104)

### 47. `provider_credentials` — MUTABLE
`id` · `provider_account_id` · `credential_ref` (**مرجع KMS/Vault فقط**) · `rotated_at` · `rotated_by`
- **🔴 صفر سرّ في قاعدة البيانات · صفر سرّ في أي استجابة API**

### 48. `provider_mappings` — MUTABLE (مُدقَّق)
`id` · `service_id` · `package_id` · `provider_id` · `provider_account_id` · `gateway_id` · `provider_product_code` · `cost_amount` · `cost_currency` · `settlement_model` · `priority` · `is_primary` · `is_active` · `version`
- **قيود:** `UNIQUE(package_id, provider_id, gateway_id)`
- **الأثر:** **مصدر تكلفة المزوّد الوحيد** — لا تُشتق من سعر العميل أبدًا

### 49. `provider_health` — PROJECTION
`provider_id` · `window` · `success_rate` · `avg_latency_ms` · `p95_latency_ms` · `unknown_rate` · `circuit_state` (`CLOSED`/`OPEN`/`HALF_OPEN`) · `opened_at` · `computed_at`

### 50. `provider_executions` — **APPEND-ONLY**
| الحقل | ملاحظة |
|---|---|
| `id` · `transaction_id` · `provider_id` · `provider_account_id` | |
| **`provider_request_id`** · `adapter_key` · `operation` (`EXECUTE`/`QUERY`/`CANCEL`) · `attempt_no` | |
| `requested_at` · `sent_at` · `responded_at` · `duration_ms` · `timeout_ms` | |
| `status` (`SENT`/`SUCCESS`/`FAILED`/`UNKNOWN`/`TIMEOUT`) · `normalized_status` | 11 حالة معيارية |
| `provider_reference` · `provider_raw_code` · `error_class` | |
| `request_payload_redacted` · `response_payload_redacted` JSONB | **منقّحة إلزاميًا** |
| `correlation_id` | |
- **قيود:** **`UNIQUE(provider_id, provider_request_id, operation, attempt_no)`** [Idempotency L3]
- **الأثر:** صف `SENT` **يُكتب ويُلتزم قبل الاستدعاء** · انهيار بينهما ⟹ **استعلام لا إعادة**
- **🔴 صفر سرّ · صفر كود قسيمة في الحمولة**
- **التقسيم:** شهري

### 51. `provider_settlement_files` — APPEND-ONLY
`id` · `provider_id` · `period_start` · `period_end` · `file_ref` · `received_at` · `parsed_at` · `line_count` · `status`
- **الأثر:** مدخل طبقة المطابقة 2

---

# D10 · COMMISSION

### 52. `commission_policies` — MUTABLE (مُدقَّق)
`id` · `scope` (`GLOBAL`/`SERVICE`/`PACKAGE`/`CATEGORY`/`COMPANY`/`PARTY`/`PROVIDER`) · `scope_ref_id` · `beneficiary_level` · `rate_type` (`PERCENT`/`FIXED`) · `rate_value` · `currency_code` · `valid_from` · `valid_to` · `version` · `created_by`
- **🔴 كل `rate_value` = `UNKNOWN/CONFIGURATION`** — الأرقام في المصادر **توضيحية بنصها**

### 53. `commission_tiers` — MUTABLE
`id` · `policy_id` · `tier_name` · `volume_from` · `volume_to` · `rate_value` · `bonus_type` (`VOLUME`/`TARGET`/`TIERED`)
- **الأثر:** يستوعب أنواع العمولات المتقدمة — **قواعد التفعيل `OPEN-BE-08`**

### 54. `commission_accruals` — MUTABLE (حالة محكومة)
| الحقل | ملاحظة |
|---|---|
| `id` · `transaction_id` · `beneficiary_party_id` · `source_party_id` | |
| `tier_level` · `policy_id` · `policy_version` | |
| `amount` · `currency_code` | |
| `status` (`ACCRUED`/`HELD`/`SETTLED`/`PAID`/`REVERSED`) | |
| `accrual_journal_entry_id` · `settlement_journal_entry_id` · `reversal_journal_entry_id` | |
| **لقطات ثابتة:** `service_name` · `package_name` · `company_name` · `applied_rate_type` · `applied_rate_value` | |
- **قيود:** **`UNIQUE(transaction_id, beneficiary_party_id)`** · **لا استحقاق إلا داخل معاملة `SETTLED`**
- **فهارس:** `(beneficiary_party_id, status, created_at)`

### 55. `transaction_commission_lines` — **APPEND-ONLY**
`id` · `transaction_id` · `beneficiary_party_id` · `depth` · `pricing_group_id` · `computed_amount_raw` `NUMERIC(20,4)` · `allocated_amount` · `remainder_rank`
- **الأثر:** **لقطة الشلال + دليل Largest Remainder** — يُثبت أن `Σ allocated = الإجمالي`

### 56. `commission_settlements` — APPEND-ONLY
`id` · `party_id` · `period_start` · `period_end` · `currency_code` · `total_amount` · `accrual_ids` · `journal_entry_id` · `approval_request_id` · `created_by`

---

# D11 · DIGITAL FULFILLMENT

### 57. `inventory_pools` — REFERENCE
`id` · `service_id` · `package_id` · `pool_kind` (`PIN`/`VOUCHER`/`WIFI`/`GIFT_CARD`) · `name` · `status`
- **الأثر:** **محرك واحد** — لا PIN Vault منفصل ولا Subscription PIN منفصل (AP-03)

### 58. `inventory_batches` — MUTABLE
`id` · `pool_id` · `source` · `reference` · `quantity` · `unit_cost` · `cost_currency` · `purchase_journal_entry_id` · `received_at` · `notes`

### 59. `inventory_items` — MUTABLE (حالة محكومة)
| الحقل | ملاحظة |
|---|---|
| `id` · `pool_id` · `batch_id` · `serial_number` | |
| `secret_ciphertext` · `secret_kms_key_ref` · `secret_nonce` | **AES-256-GCM · المفتاح في KMS** |
| `status` (`AVAILABLE`/`LOCKED`/`SOLD`/`USED`/`EXPIRED`/`VOID`) | |
| `locked_by_transaction_id` · `locked_at` · `sold_at` · `delivered_at` · `expires_at` | |
- **قيود:** **`UNIQUE(locked_by_transaction_id) WHERE status IN ('LOCKED','SOLD')`** (جزئي) · `UNIQUE(pool_id, serial_number)`
- **فهارس:** **`(pool_id, expires_at) WHERE status='AVAILABLE'`** (جزئي) — للحجز الذري
- **الحجز:** `FOR UPDATE SKIP LOCKED LIMIT 1`
- **🔴 السرّ يُفك عند التسليم فقط · لا يظهر في أي سجل**

### 60. `fulfillment_records` — APPEND-ONLY
`id` · `transaction_id` · `strategy` (`DIRECT_ID`/`PIN_POOL`/`API_PIN`/`MANUAL`/`WIFI_VOUCHER`) · `inventory_item_id` · `recipient_identifier` · `delivery_channel` · `delivery_status` · `delivered_at`
- **🔴 يسجّل حدث التسليم — لا محتوى السرّ**

---

# D12 · OPERATIONS & SUPPORT (+ WiFi Admin)

### 61. `service_requests` — MUTABLE (حالة محكومة)
`id` · `transaction_id` · `party_id` · `service_id` · `request_code` UQ · `status` (`PENDING`/`ASSIGNED`/`PROCESSING`/`COMPLETED`/`REJECTED`/`CANCELLED`/`TIMED_OUT`) · `assigned_employee_id` · `priority` · `origin_channel` · `sla_due_at` · `description`
- **الأثر:** **لا خصم مالي نهائي قبل `COMPLETED`** — الحجز فقط

### 62. `service_request_history` — APPEND-ONLY
`id` · `service_request_id` · `from_status` · `to_status` · `actor_id` · `reason` · `at`

### 63. `service_request_offers` — MUTABLE
`id` · `service_request_id` · `employee_id` · `status` (`PENDING`/`CLAIMED`/`EXPIRED`/`SUPERSEDED`) · `expires_at`
- **قيود:** عرض نشط واحد لكل طلب (جزئي)

### 64. `support_tickets` — MUTABLE
`id` · `ticket_number` UQ · `party_id` · `transaction_id` · `category` · `priority` · `status` · `assigned_to` · `subject` · `sla_due_at` · `escalated_at` · `resolved_at`

### 65. `ticket_messages` — APPEND-ONLY (حذف منطقي للعرض فقط)
`id` · `ticket_id` · `sender_user_id` · `sender_role` · `body` · `attachment_file_ref` · `sent_at` · `deleted_for_user_ids`
- **المرفقات في Object Storage** — **لا Base64 في قاعدة البيانات**

### 66. `wifi_networks` — MUTABLE
`id` · `owner_party_id` · `name` · `zone_id` · `status` · `visibility` · `controller_kind` (`MIKROTIK`/`RADIUS`/`MANUAL`) · `controller_credential_ref` (**KMS**)

### 67. `wifi_profiles` — REFERENCE
`id` · `network_id` · `service_id` · `name` · `duration` · `speed_limit` · `status`

### 68. `wifi_assignments` — MUTABLE
`id` · `network_id` · `party_id` · `role` (`MANAGER`/`SELLER`/`COLLECTOR`) · `status`

### 69. `wifi_collections` — MUTABLE
`id` · `network_id` · `collector_party_id` · `amount` · `currency_code` · `status` · `journal_entry_id` · `reviewed_by` · `review_notes`

---

# D13 · DISPUTES

### 70. `disputes` — MUTABLE (حالة محكومة)
`id` · `transaction_id` · `opened_by_party_id` · `category` · `status` (`OPEN`/`INVESTIGATING`/`RESOLVED_REFUNDED`/`RESOLVED_REJECTED`) · `claimed_amount` · `resolution_journal_entry_id` · `approval_request_id` · `sla_due_at` · `resolved_by` · `resolution_reason`
- **الأثر:** الاسترداد **قيد عكسي** حصرًا + عكس العمولة + **Maker/Checker إلزامي**

### 71. `dispute_events` — APPEND-ONLY
`id` · `dispute_id` · `event_kind` · `actor_id` · `payload` · `at`

---

# D14 · RECONCILIATION

### 72. `reconciliation_sessions` — APPEND-ONLY
`id` · `layer` (`WALLET_LEDGER`/`TXN_PROVIDER`/`FUNDING_BANK`/`COMMISSION_LEDGER`) · `period_id` · `scope` JSONB · `started_at` · `finished_at` · `status` · `totals` JSONB · `started_by`

### 73. `reconciliation_items` — APPEND-ONLY
`id` · `session_id` · `left_ref` · `right_ref` · `left_amount` · `right_amount` · `currency_code` · `delta` · `match_status` (`MATCHED`/`MISSING_LEFT`/`MISSING_RIGHT`/`AMOUNT_DIFF`/`STATUS_DIFF`)

### 74. `financial_discrepancies` — MUTABLE (حالة محكومة)
`id` · `session_id` · `layer` · `subject_kind` · `subject_id` · `currency_code` · `delta` · `status` (`OPEN`/`INVESTIGATING`/`RESOLVED_AUTO`/`RESOLVED_MANUAL`/`WRITTEN_OFF`) · `adjustment_journal_entry_id` · `approval_request_id` · `opened_at` · `resolved_by` · `resolution_reason`
- **الأثر:** **`OPEN`/`INVESTIGATING` تمنع إقفال الفترة** · `WRITTEN_OFF` يتطلب Maker/Checker + قيد تسوية + سبب

---

# D15 · REPORTING

### 75. `export_jobs` — MUTABLE
`id` · `requested_by` · `report_kind` · `filters` JSONB · `format` · `status` · `file_ref` · `row_count` · `expires_at` · `correlation_id`
- **الأثر:** **Cursor/Streaming حصرًا** · رابط موقَّع محدود الصلاحية · التصدير حدث مُدقَّق

### 76. Materialized Views (ليست جداول)
`mv_trial_balance` (لكل عملة) · `mv_profit_and_loss` · `mv_balance_sheet` · `mv_service_profitability` · `mv_provider_performance` · `mv_commission_summary`
- **التحديث:** ليلي + عند الطلب · **قراءة فقط**

---

# D16 · NOTIFICATIONS

### 77. `notifications` — APPEND-ONLY
`id` · `recipient_party_id` · `channel` (`IN_APP`/`PUSH`/`SMS`/`WHATSAPP`/`TELEGRAM`/`EMAIL`) · `template_code` · `payload` JSONB · `source_event_id` · `created_at`
- **قيود:** `UNIQUE(source_event_id, recipient_party_id, channel)` — يمنع الإشعار المكرر

### 78. `notification_deliveries` — APPEND-ONLY
`id` · `notification_id` · `attempt_no` · `status` (`QUEUED`/`SENT`/`DELIVERED`/`FAILED`) · `provider_message_id` · `dlr_at` · `error`

---

# D3 · AUDIT (جدول عابر للنطاقات)

---

# PLATFORM (بنية تحتية — بلا نطاق أعمال · `NF-03` · C-03)

### 80. `tenants` — REFERENCE *(جديد · `Tenant-Ready` — التوصية فقط)*
`id` · `code` · `name` · `status`
- **v1: صف واحد `DEFAULT_TENANT`.** لا API ولا واجهة ولا منطق أعمال يعرف بوجوده.
- **يُنشأ فقط إن اعتُمدت توصية `Tenant-Ready, Single-Tenant-Deployed`** — `OPEN-BE-15` ما زال `OPEN`.

### 81. `system_configuration` — MUTABLE (مُدقَّق) *(جديد · `NF-03`)*
**الغرض:** المكان الوحيد لكل قيمة `CONFIGURATION` في التصميم (17 موضعًا على الأقل).
| الحقل | ملاحظة |
|---|---|
| `key` PK (`accounting.reporting_currency` · `pricing.min_margin` · `pricing.quote_ttl_seconds` · `pricing.slippage_tolerance_pct` · `commission.dispute_window_days` · `recon.auto_settle_threshold` · `webhook.max_skew_seconds` · `hierarchy.max_depth` · `security.access_token_ttl` · `risk.velocity_*` · `provider.circuit_*` · `retention.*` …) | |
| `value` · `value_type` · `scope` | |
| **`is_financial`** | **`true` ⟹ تغييره يتطلب Maker/Checker + قيد تدقيق** |
| `updated_by` · `updated_at` · `approval_request_id` | |
- **قيود:** `accounting.reporting_currency` **immutable بعد أول إقفال فترة** (Trigger) — راجع Design §4.6
- **🔴 لا قيمة افتراضية غير موثقة.** المفاتيح غير المحسومة تبقى `UNKNOWN` صراحةً

### 82. `outbox_events` — راجع D8 (المالك: **Platform**، لا نطاق أعمال · C-03)
> نُقلت ملكيته منطقيًا: يكتب فيه كل نطاق **داخل معاملته**، ويقرؤه Worker واحد. تعريفه الكامل في D8 §44.

---

### 79. `audit_log` — **APPEND-ONLY + HASH CHAIN**
| الحقل | ملاحظة |
|---|---|
| `id` (UUIDv7) · `occurred_at` · **`stream_key`** (`financial`/`security`/`application`) | سلاسل منفصلة |
| `actor_party_id` · `actor_user_id` · `actor_role` · `on_behalf_of_party_id` | |
| `action` · `resource_type` · `resource_id` | |
| `before_data` · `after_data` JSONB | |
| `request_id` · `correlation_id` · `client_ref` | |
| `ip_address` · `device_id` · `user_agent` | |
| `reason` | **إلزامي** للأفعال المالية اليدوية |
| `previous_hash` · `hash` | `SHA-256(previous_hash ‖ canonical_json(payload))` |
- **قيود:** Trigger يرفض `UPDATE`/`DELETE` **لأي دور** · `UNIQUE(stream_key, hash)`
- **فهارس:** `(stream_key, occurred_at DESC)` · `(resource_type, resource_id)` · `(correlation_id)` · `(actor_party_id, occurred_at DESC)`
- **التقسيم:** شهري
- **🔴 صفر سرّ · صفر كود قسيمة** — بصمة فقط

---

# سياسة الجداول — الملخص التنفيذي (§28)

## APPEND-ONLY (تُمنع `UPDATE`/`DELETE` بـTrigger) — **18 جدولًا**
`journal_entries`¹ · `journal_entry_lines` · `fx_rates` · `kyc_submissions` · `security_events` · `transaction_status_history` · `provider_executions` · `provider_webhook_events` · `provider_settlement_files` · `bank_statement_lines` · `transaction_commission_lines` · `commission_settlements` · `service_request_history` · `dispute_events` · `reconciliation_sessions` · `reconciliation_items` · `notifications` · `notification_deliveries` · `pricing_change_logs` · `fulfillment_records` · `audit_log`
> ¹ الاستثناء الوحيد: حقلا `status`/`reversed_by_entry_id` على رأس القيد، عبر إجراء واحد مُحكَم.

## PROJECTION (قابلة لإعادة البناء بالكامل) — **3**
`party_wallet_projection` · `provider_health` · `party_risk_metrics`
> **لا يكتب فيها منطق أعمال — فقط محدِّث الـProjection داخل معاملة القيد.**

## ARCHIVE (بلا كاتب) — **1**
`legacy_wallet_ledger`

## MUTABLE بحالة محكومة (كل انتقال يكتب سجلًا) — **10**
`transactions` · `wallet_holds` · `funding_requests` · `commission_accruals` · `inventory_items` · `service_requests` · `disputes` · `financial_discrepancies` · `accounting_periods` · `approval_requests`

## REFERENCE — الباقي
> **قاعدة عليا:** لا `UPDATE` ولا `DELETE` على أي تاريخ مالي، في أي جدول، لأي دور. التصحيح **REVERSAL** أو **ADJUSTMENT** حصرًا.

---

# التقسيم (Partitioning)
**مُصمَّم من البداية · مُفعَّل عند الحاجة — شهريًا:**
`journal_entry_lines` · `journal_entries` · `audit_log` · `provider_executions` · `provider_webhook_events` · `transactions` · `transaction_status_history` · `outbox_events` (أرشفة)

---

# العزل الهرمي / تعدد المستأجرين
- **العزل الهرمي:** إلزامي عبر `party_closure` على كل استعلام يمسّ طرفًا (تقارير · كشوف · قوائم · تسعير · تصدير).
- **تعدد المستأجرين:** **غير مذكور في أي مصدر** → `OPEN-BE-15` (ما زال `OPEN`).
  **التوصية (Phase 1.1 · Design §32):** نمط **`Tenant-Ready, Single-Tenant-Deployed`**:
  `tenants` بصف واحد · `tenant_id NOT NULL DEFAULT` على كل جدول أعمال · **كل قيد فريد وكل فهرس مركّب يبدأ بـ`tenant_id`** · `audit_log.stream_key` يتضمنه · طبقة وصول واحدة تحقنه · **لا API ولا منطق أعمال يعرف بوجوده**.
  التكلفة اليوم ≈ عمود + بادئة فهرس؛ تكلفة التأجيل بعد الإنتاج = إعادة بناء مالية وتدقيقية **غير قابلة للاسترداد في نطاق سلسلة التجزئة**.
  **قرار التعدد نفسه لكم — لم يُحسم.**

---

# الإحصاء
| البند | العدد |
|---|---|
| **الجداول المنطقية** | **82** *(79 + `party_pricing_assignments` + `system_configuration` + `tenants` المشروط)* |
| Materialized Views | 6 |
| APPEND-ONLY | 21 |
| PROJECTION | 3 |
| MUTABLE بحالة محكومة | 10 |
| ARCHIVE | 1 |
| حسابات COA المُرحَّل عليها | 24 |
| الأبعاد على سطر القيد | 8 |
| قيود Idempotency الفريدة | 4 |

---

**لم يُكتب SQL. لم يُنشأ جدول. لم تُنشأ migration. لم يُعدَّل SPA.**
**صفر سعر · صفر نسبة · صفر تكلفة · صفر سعر صرف · صفر بيانات بنكية أو اعتماد.**
