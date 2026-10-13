# BACKEND_API_CONTRACT — v1.0
## ALOMDA TEL · عقد الـAPI (CONTRACT ONLY — لا endpoints فعلية · لا كود)

**المرجع:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` + `BACKEND_TECHNICAL_DESIGN_v1.0.md`
**التاريخ:** 2026-09-07

---

# 0. القواعد العامة

| البند | القاعدة |
|---|---|
| **النمط** | REST · مُصدَّر بالإصدار (`/api/v1/…`) |
| **التمثيل** | JSON · UTF-8 · `Content-Type: application/json` |
| **المصادقة** | `Authorization: Bearer <access_token>` — كل شيء عدا `auth/login` و`auth/refresh` |
| **التفويض** | Deny-by-default → صلاحية الدور → **منع صريح يتفوق** → ABAC → SoD → Maker/Checker |
| **العزل الشجري** | **إلزامي على كل استجابة تمسّ طرفًا** — لا استثناء |
| **المبالغ** | دائمًا `{ "amount": "1234.5678", "currency": "YER" }` — **نص عشري لا Number** (منعًا لفقد الدقة في JSON) |
| **الوقت** | ISO-8601 UTC |
| **المعرّفات** | UUIDv7 نصية |
| **الترقيم** | `?cursor=&limit=` — Cursor-based · **لا OFFSET على أي جدول مالي** |
| **الترابط** | `X-Correlation-Id` (اختياري من العميل، يُولَّد إن غاب) · يُعاد في كل استجابة |
| **الإصدارات** | تغيير كاسر ⟹ `/v2`. الإضافة غير الكاسرة مسموحة داخل `/v1` |

## 0.1 الترويسات الموحّدة
| الترويسة | الاتجاه | الغرض |
|---|---|---|
| `Authorization` | ← | Bearer access token |
| `Idempotency-Key` | ← | **إلزامي** لكل عملية مُنشِئة لأثر مالي (= `client_ref`) |
| `X-Correlation-Id` | ↔ | التتبّع عبر الطبقات والـWorkers |
| `X-Device-Id` | ← | ربط الجهاز |
| `X-Transaction-Pin` | ← | للعمليات الحساسة فوق الحد |
| `X-Request-Id` | → | معرّف الطلب من الخادم |
| `X-RateLimit-*` | → | حدود المعدل — **غير منفَّذة حاليًا**؛ المنفَّذ فقط `Retry-After` على `429` |
| `Retry-After` | → | ثوانٍ حتى انتهاء نافذة المعدل (على `429` فقط) |

## 0.2 قاعدة Idempotency
```
كل POST يُنشئ أثرًا ماليًا يتطلب Idempotency-Key.
  • مفتاح جديد                      → تُنفَّذ العملية · تُخزَّن النتيجة
  • نفس المفتاح + نفس بصمة الطلب     → تُعاد النتيجة المخزَّنة حرفيًا · بلا تنفيذ · 200
  • نفس المفتاح + بصمة مختلفة        → 409 IDEMPOTENCY_CONFLICT · بلا تنفيذ
  • غياب المفتاح على عملية مالية     → 400 VALIDATION_ERROR
```

## 0.3 الغلاف الموحّد للاستجابة
```
نجاح:  { "data": { … }, "meta": { "correlation_id": "…", "as_of": "…" } }
فشل:   { "error": { "code": "…", "message": "…", "details": [ … ],
                    "correlation_id": "…", "retryable": false } }
قوائم: { "data": [ … ], "meta": { "next_cursor": "…", "has_more": true } }
```

---

# 1. ERROR MODEL (§33)

## 1.1 الأخطاء المعتمدة
| الرمز | HTTP | `retryable` | متى |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | ❌ | حقل ناقص/غير صالح · غياب `Idempotency-Key` · خرق الحد الأدنى للهامش (Margin Guard) — لا يوجد رمز `MARGIN_GUARD_VIOLATION` منفصل؛ راجع §1.3 |
| `UNAUTHORIZED` | 401 | ❌ | **الرمز نفسه** غائب/منتهٍ/مُبطَل/غير صالح، أو حساب غير موجود. لا يُستعمل أبدًا لعطل بنية تحتية (انظر `SERVICE_UNAVAILABLE`) |
| `FORBIDDEN` | 403 | ❌ | صلاحية ناقصة · منع صريح · خارج النطاق الشجري · SoD |
| `NOT_FOUND` | 404 | ❌ | المورد غير موجود أو خارج نطاق المستدعي |
| `IDEMPOTENCY_CONFLICT` | 409 | ❌ | نفس المفتاح بمحتوى مختلف |
| `CONFLICT` | 409 | ❌ | انتقال حالة غير مسموح (يشمل ما كان مُسمّى سابقًا `STATE_CONFLICT`) |
| `INSUFFICIENT_FUNDS` | 422 | ❌ | `Available` لا يكفي |
| `LIMIT_EXCEEDED` | 422 | ❌ | تجاوز حد يومي/عملية/ائتمان |
| `PRICE_EXPIRED` | 422 | ❌ | انتهت صلاحية العرض · **إعادة تسعير إلزامية** |
| `HOLD_NOT_FOUND` | 422 | ❌ | حجز غير موجود أو غير نشط |
| `TRANSACTION_NOT_SETTLED` | 422 | ❌ | عملية تفترض تسوية لم تتم |
| `SERVICE_UNAVAILABLE_FOR_ZONE` | 422 | ❌ | الخدمة غير متاحة لمنطقة المشتري |
| `PROVIDER_REJECTED` | 422 | ❌ | رفض قاطع من المزوّد |
| `PROVIDER_TIMEOUT` | 202 | ⚠️ | **ليست فشلًا** — المعاملة `PENDING_PROVIDER` · الحجز باقٍ |
| `PROVIDER_UNKNOWN` | 202 | ❌ | نتيجة غامضة · **ممنوع إعادة المحاولة** · تصعيد |
| `PROVIDER_UNAVAILABLE` | 503 | ✅ | القاطع مفتوح أو لا مزوّد مؤهل |
| `SERVICE_UNAVAILABLE` | 503 | ✅ | **تعذّر فحص الهوية بسبب فشل بنية تحتية** (مثل قاعدة البيانات أو مصدر الأدوار) — لم يُعالَج الطلب ولم يُنتَج أي أثر. **لا يعني انتهاء الجلسة**: العميل يحتفظ بالجلسة ولا يجدّدها ولا يُسجّل الخروج، ويعيد المحاولة لاحقًا (بنفس `Idempotency-Key` عند الإنشاء). الرسالة ثابتة بلا تفاصيل داخلية |
| `INVENTORY_UNAVAILABLE` | 422 | ⚠️ | لا مخزون متاح |
| `APPROVAL_REQUIRED` | 202 | ❌ | Maker/Checker — أُنشئ طلب موافقة |
| `APPROVAL_SELF_CHECK_FORBIDDEN` | 403 | ❌ | `maker == checker` |
| `RECONCILIATION_REQUIRED` | 409 | ❌ | إقفال فترة وفيها فرق مفتوح |
| `PERIOD_CLOSED` | 409 | ❌ | ترحيل في فترة مغلقة |
| `DUPLICATE_RECEIPT` | 409 | ❌ | `receipt_hash`/مرجع تحويل مستخدم |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | ❌ | توقيع فاسد أو خارج النافذة |
| `RATE_LIMITED` | 429 | ✅ | تجاوز معدل لكل عنوان مصدر (افتراضيًا: تسجيل الدخول 10 · التجديد 30 · الباقي 120 في الدقيقة، قابلة للتهيئة؛ `/health` مستثنى) — لم يُعالَج الطلب. تُرسَل الترويسة `Retry-After` (ثوانٍ). **لا يعني انتهاء الجلسة** |
| `INTERNAL_ERROR` | 500 | ✅ | خطأ غير متوقع — **لا تفاصيل داخلية للعميل** |
| `INVALID_MONEY_AMOUNT` | 400 | ❌ | مبلغ بصيغة غير صالحة (طبقة المال، ADR-102) |
| `INVALID_CURRENCY` | 400 | ❌ | رمز عملة غير صالح |
| `CURRENCY_MISMATCH` | 400 | ❌ | عملتان مختلفتان في عملية تشترط عملة واحدة |
| `INVALID_PRECISION` | 400 | ❌ | دقة عشرية تتجاوز المسموح للعملة |
| `INVALID_ACCOUNT_CODE` | 400 | ❌ | رمز حساب محاسبي غير صالح |
| `INVALID_COA_STRUCTURE` | 400 | ❌ | بنية دليل حسابات غير صالحة |
| `NON_POSTABLE_ACCOUNT` | 422 | ❌ | ترحيل على حساب غير قابل للترحيل |
| `INVALID_DIMENSION` | 400 | ❌ | بُعد محاسبي غير صالح |
| `JOURNAL_NOT_BALANCED` | 422 | ❌ | قيد غير متوازن لكل عملة (ADR-117) |
| `CONFIG_NOT_SET` | 500 | ❌ | إعداد مطلوب غير مضبوط في النشر — خطأ تشغيلي لا خطأ عميل؛ **لا تفاصيل داخلية للعميل** |

> **لا رمز خطأ يُضاف بلا حاجة مثبتة.** أي حالة جديدة تُصنَّف تحت رمز قائم أولًا.

## 1.2 قواعد ملزمة
1. **`PROVIDER_TIMEOUT` و`PROVIDER_UNKNOWN` ليستا فشلًا** — ترجعان `202` مع `transaction.status = PENDING_PROVIDER`. **العميل لا يعيد الإرسال بمفتاح جديد.**
2. لا يُسرَّب في أي خطأ: مسار داخلي · اسم جدول · استعلام · سرّ · بيانات طرف آخر.
3. `retryable: true` يعني **إعادة الإرسال بنفس `Idempotency-Key` آمنة**.
4. **التمييز بين الرمز السيئ وعطل البنية التحتية (قرار المالك 2026-10-14):** رمز لا يتحقق ⟹ `401 UNAUTHORIZED`؛ تعذّر إجراء الفحص ذاته ⟹ `503 SERVICE_UNAVAILABLE`؛ خطأ داخلي غير متوقع ⟹ `500 INTERNAL_ERROR`. عند تعذّر التحقق من الهوية **لا يُمنح الوصول** إلى أي مسار محمي. **تجديد الجلسة وتسجيل الخروج يحدثان عند `401` فقط**؛ لا يطلقهما `503` ولا `429`.
5. معرّف أو قيمة بصيغة غير صالحة (مثل معرّف ليس UUID في المسار) ⟹ `400 VALIDATION_ERROR` برسالة ثابتة، لا `500`. جسم الطلب الأكبر من الحد (1 MiB افتراضيًا) ⟹ HTTP `413` بالرمز `VALIDATION_ERROR` (لا رمز مستقل).

## 1.3 مواءمة العقد مع سلوك الـCore الفعلي (§15، قرار مُصادَق — Option A)
`STATE_CONFLICT` و`MARGIN_GUARD_VIOLATION` كانا في نسخة سابقة من هذا العقد كرمزين منفصلين، **قبل أن يُبنى الـCore فعليًا**. الـCore المبني والمُختبَر (`error-code.ts`, `TransactionValidationService`) لا يعرّف هذين الرمزين إطلاقًا — كل حالاتهما مصنَّفة بالفعل تحت رمزين قائمين:
- انتقال حالة غير مسموح (مثال: محاولة `validate()` على معاملة ليست `CREATED`) ⟹ `CONFLICT` · `409`.
- خرق الحد الأدنى للهامش (Margin Guard) ⟹ `VALIDATION_ERROR` · `400`.

> **تحديث 2026-10-14 (قرار المالك):** أُضيف إلى `error-code.ts` الرمزان `SERVICE_UNAVAILABLE` (503) و`RATE_LIMITED` (429)؛ هذا الأخير كان مدرجًا في هذا العقد دون أن يكون في الكود. الإضافة لحاجة مثبتة (اختبارات `auth-infrastructure-and-limits`)، وتنسيق الخطأ لم يتغير.

**هذا تعديل توثيقي فقط** — لا تغيير في `error-code.ts` ولا في `TransactionValidationService` ولا في أي سلوك مُختبَر مسبقًا. العقد يوافق الواقع المبني، لا العكس.

---

# 2. AUTHENTICATION — `/api/v1/auth`

| العملية | الغرض | Idempotency | التفويض |
|---|---|---|---|
| `POST /login` | مصادقة → access + refresh | ❌ | عام |
| `POST /refresh` | تدوير الرمز | ❌ | refresh صالح |
| `POST /logout` | إبطال الجلسة الحالية | ❌ | مصادق |
| `POST /logout-all` | إبطال كل جلسات الحساب | ❌ | مصادق |
| `POST /2fa/verify` | تحقق TOTP | ❌ | جلسة جزئية |
| `POST /devices/approve` | اعتماد جهاز جديد بـOTP | ❌ | مصادق |
| `GET /devices` · `DELETE /devices/{id}` | إدارة الأجهزة الموثوقة | ❌ | مصادق |
| `POST /transaction-pin` | ضبط/تغيير PIN المعاملات | ❌ | مصادق + 2FA |

**`POST /login`**
- **الطلب:** `{ login_identifier, password, device_key?, device_label? }`
- **الاستجابة:** `{ access_token, expires_in, refresh_token, requires_2fa, requires_device_approval, party: { id, party_type, display_name, zone, default_currency }, workspaces: [...] }`
- **قواعد:** كلمات المرور **Argon2id** · لا رسالة تكشف أي الحقلين خاطئ · `failed_attempts` + `locked_until` · **كشف إعادة استخدام refresh ⟹ إبطال كل الجلسات + حدث أمني**
- `OPEN-BE-12`: مدة الرمز `CONFIGURATION` (المصادر متعارضة: 15د/60د)

---

# 3. WALLET — `/api/v1/wallet`

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /balance` | رصيد الطرف الحالي | `wallet:read_own` |
| `GET /parties/{id}/balance` | رصيد طرف تابع | `wallet:read_subtree` + **عزل شجري** |
| `GET /statement` | كشف حساب مرقّم | `wallet:read_own` \| `read_subtree` |
| `GET /holds` | الحجوزات النشطة | `wallet:read_own` |
| `POST /transfer` | تحويل بين طرفين | `wallet:transfer` + **Idempotency** |
| `POST /adjust` | تعديل رصيد إداري | `wallet:adjust` + **Maker/Checker** + `reason` إلزامي |

**`GET /balance` — الاستجابة:**
```
{ "party_id": "...", "currency": "YER", "wallet_kind": "MAIN",
  "ledger_balance": "150000.0000",
  "held":           "20000.0000",
  "credit_limit":   "0.0000",
  "available":      "130000.0000",
  "as_of":          "2026-09-07T10:00:00Z",     ← ختم الخادم (ADR-115)
  "source":         "LEDGER_PROJECTION" }
```
**قواعد ملزمة:**
- `available = ledger_balance − held + credit_limit` (ADR-105)
- **`as_of` إلزامي** — العميل يعرض التقادم ولا يعدّل الرصيد محليًا أبدًا
- **لا يوجد endpoint يكتب رصيدًا** — كل تغيير أثر جانبي لقيد محاسبي
- `POST /adjust` **لا ينفّذ فورًا** فوق الحد → `202 APPROVAL_REQUIRED` مع `approval_request_id`

---

# 4. FUNDING — `/api/v1/funding`

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /methods` | وسائل التغذية للبوابة | مصادق |
| `POST /requests` | تقديم مطالبة تغذية | `funding:submit` + **Idempotency** |
| `GET /requests` · `GET /requests/{id}` | متابعة | `funding:read_own` \| `read_subtree` |
| `POST /requests/{id}/approve` | اعتماد | `deposit:approve` + **Maker/Checker** + **SoD** |
| `POST /requests/{id}/reject` | رفض | `deposit:approve` + `reason` إلزامي |
| `GET /unmatched` | مبالغ غير مطابقة | `funding:reconcile` |
| `POST /unmatched/{id}/claim` | ربط بمطالبة | `funding:reconcile` + Maker/Checker |

**`POST /requests`**
- **الطلب:** `{ funding_method_id, claimed_amount, currency, transfer_reference, depositor_name, receipt_file_ref? }`
- **قواعد:** `receipt_required` يُفرض خادميًا · `receipt_hash` يُحسب خادميًا · `DUPLICATE_RECEIPT` عند التكرار · **المرفق في Object Storage — لا Base64**
- **`approve`:** `approved_amount` قد يختلف عن المُدَّعى؛ **الاثنان يُخزَّنان** · القيد يُرحَّل بـ`source_id = funding_request_id` (Idempotency L2) · **من يعتمد ≠ من قدّم** (SoD)

**`POST /webhooks/providers/{provider_code}`** (عام · موقَّع)
- **قواعد:** تحقق `HMAC` → نافذة `webhook_max_skew_seconds` → `nonce` → `INSERT` بـ`UNIQUE(provider_id, provider_event_id)` → عند التعارض **`200 ACK` وتوقف** · خارج النافذة `401 WEBHOOK_SIGNATURE_INVALID` + حدث أمني · **المعالجة غير متزامنة عبر Outbox — الرد فوري دائمًا**

---

# 5. PRICING — `/api/v1/pricing`

| العملية | الغرض | التفويض |
|---|---|---|
| `POST /quote` | عرض سعر مُلزم مؤقتًا | `pricing:quote` |
| `GET /catalog` | الخدمات/الباقات المتاحة للطرف | مصادق |
| `GET /groups` · `POST /groups` | إدارة الشرائح | `pricing:manage` |
| `PUT /service-pricing` | تسعير الشريحة | `pricing:manage` + **Maker/Checker** |
| `POST /overrides` | تسعير استثنائي | `pricing:override` + **Maker/Checker** + `expires_at` |

**`POST /quote`**
- **الطلب:** `{ service_id, package_id, quantity?, target_identifier? }`
- **الاستجابة:**
```
{ "quote_id": "...", "customer_price": {...}, "provider_cost": {...},
  "fx_rate_id": "...|null", "commission_plan": [ { beneficiary_party_id, depth, amount } ],
  "system_margin": {...},
  "pricing_rule_version": n, "commission_policy_version": n,
  "expires_at": "..." }
```
- **قواعد:** الحساب **خادمي حصرًا** · **Margin Guard يُفحص هنا** (`VALIDATION_ERROR` · 400 — راجع §1.3) · **`provider_cost` لا يُشتق من `customer_price` أبدًا** · العرض المنتهي ⟹ `PRICE_EXPIRED` عند الاستخدام
- 🔴 **كل القيم `UNKNOWN/CONFIGURATION`** حتى تُدخَل بيانات حقيقية (`OPEN-BE-06`)

---

# 6. TRANSACTIONS — `/api/v1/transactions`

| العملية | الغرض | التفويض |
|---|---|---|
| `POST /` | إنشاء وتنفيذ معاملة | `tx:execute` + **Idempotency إلزامي** |
| `GET /{id}` | حالة المعاملة | `tx:read_own` \| `read_subtree` |
| `GET /` | قائمة مرقّمة | نفس ما سبق |
| `GET /{id}/timeline` | تاريخ الحالات | `tx:read_*` |
| `POST /{id}/resolve` | حسم يدوي لمعاملة غامضة | `tx:manual_resolve` + **Maker/Checker** + دليل |
| `POST /{id}/cancel` | إلغاء قبل الإرسال فقط | `tx:cancel_manual` |

**`POST /` — الطلب:**
```
{ "client_ref": "uuid-v7",         ← = Idempotency-Key
  "quote_id": "...",
  "service_id": "...", "package_id": "...",
  "target_identifier": "...",
  "form_values": { ... } }
```
**الاستجابة (202 أو 200):**
```
{ "transaction_id": "...", "client_ref": "...",
  "status": "SETTLED | PENDING_PROVIDER | FAILED | MANUAL_RESOLUTION",
  "locked_customer_price": {...},
  "hold": { "id": "...", "status": "CAPTURED|ACTIVE|RELEASED" },
  "settlement": { "journal_entry_id": "...", "settled_at": "..." } | null,
  "provider": { "reference": "...", "normalized_status": "..." } | null,
  "fulfillment": { "delivery_status": "...", "secret_delivered": true } | null }
```
**قواعد ملزمة:**
1. **`client_ref` إلزامي** — تكراره يعيد النتيجة المخزَّنة (200) بلا تنفيذ.
2. `SUCCESS` **لا يُعرض للعميل كحالة نهائية** — الحالة المعروضة `SETTLED` أو `PENDING_PROVIDER`.
3. **`PROVIDER_TIMEOUT`/`PROVIDER_UNKNOWN` ⟹ `202` + `PENDING_PROVIDER`** — الحجز باقٍ · **لا إعادة تنفيذ** · العميل يستعلم بـ`GET /{id}`.
4. `INSUFFICIENT_FUNDS` قبل أي استدعاء خارجي.
5. **لا استدعاء خارجي داخل معاملة قاعدة البيانات** — دائمًا عبر Outbox.
6. **السرّ الرقمي (PIN/كود) يُعاد مرة واحدة** في استجابة النجاح ولا يُخزَّن في أي سجل.

---

# 7. PROVIDERS — `/api/v1/providers` (إداري)

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /` · `GET /{id}` | الدليل والقدرات | `provider:read` |
| `POST /` · `PATCH /{id}` | إدارة | `provider:manage` |
| `GET /{id}/health` | صحة/قاطع | `provider:read` |
| `GET /{id}/executions` | سجل التنفيذ | `provider:read_logs` |
| `POST /{id}/accounts` | حسابات المزوّد | `provider:manage` |
| `PUT /mappings` | ربط خدمة↔مزوّد↔تكلفة | `provider:manage` + **Maker/Checker** |
| `POST /{id}/settlement-files` | رفع ملف تسوية | `provider:reconcile` |

**قواعد ملزمة:**
- **لا يُعاد أي سرّ ولا `credential_ref` في أي استجابة.**
- حمولات الطلب/الاستجابة في `GET /executions` **منقّحة** — لا سرّ ولا كود قسيمة.
- **مزوّد `SIMULATOR` مرفوض في ربط إنتاجي** (`VALIDATION_ERROR`).
- **مزوّد بلا أي قدرة حسم قاطعة مرفوض للتنفيذ الآلي** (`VALIDATION_ERROR` عند التفعيل).

---

# 8. COMMISSION — `/api/v1/commission`

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /accruals` | الاستحقاقات | `commission:read_own` \| `read_subtree` |
| `GET /summary` | ملخص بالفترة/المستوى | نفس ما سبق |
| `POST /settle` | تسوية إلى المحفظة | `commission:settle` + **Maker/Checker** فوق الحد |
| `POST /payout` | صرف بنكي | `commission:payout` + **Maker/Checker** |
| `GET /policies` · `PUT /policies` | السياسات | `commission:manage` + **Maker/Checker** |

**قواعد:** لا استحقاق إلا لمعاملة `SETTLED` · `UNIQUE(transaction_id, beneficiary_party_id)` · العكس **قيد عكسي** لا حذف · استرداد بعد `PAID` ⟹ مطالبة.
🔴 **كل النسب `UNKNOWN/CONFIGURATION`** (`OPEN-BE-07`).

---

# 9. ACCOUNTING — `/api/v1/accounting` (مالية/تدقيق فقط)

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /accounts` | شجرة الحسابات | `accounting:read` |
| `GET /entries` · `GET /entries/{id}` | القيود وسطورها | `accounting:read` |
| `POST /entries/{id}/reverse` | عكس قيد | `accounting:reverse` + **Maker/Checker** + `reason` |
| `POST /entries/manual` | قيد يدوي | `accounting:manual_post` + **Maker/Checker** |
| `GET /periods` · `POST /periods/{id}/close` | إدارة الفترات | `accounting:close_period` + **Maker/Checker** |
| `POST /periods/{id}/reopen` | إعادة فتح | `accounting:reopen_period` + **Maker/Checker** + `reason` |

**قواعد ملزمة:**
- **لا `PUT` ولا `DELETE` على أي قيد أو سطر — إطلاقًا.**
- العكس **ينسخ كل الأبعاد** (ADR-110) — يُغطَّى باختبار عقد.
- `POST /periods/{id}/close` يفشل بـ`RECONCILIATION_REQUIRED` مع وجود `financial_discrepancy` مفتوح.
- الترحيل في فترة مغلقة ⟹ `PERIOD_CLOSED`.
- **`SUPER_ADMIN` لا يصل إلى أرصدة العملاء** عبر هذه المجموعة — دور `FINANCE` منفصل (`OPEN-BE-13`).

---

# 10. REPORTS — `/api/v1/reports`

| العملية | الغرض | التفويض |
|---|---|---|
| `GET /trial-balance` | ميزان مراجعة **لكل عملة** | `report:financial` |
| `GET /profit-and-loss` | قائمة الدخل | `report:financial` |
| `GET /balance-sheet` | الميزانية | `report:financial` |
| `GET /liquidity` | النقد والأرصدة لدى المزوّدين | `report:financial` |
| `GET /party-statement` | كشف حساب طرف | `report:party` + **عزل شجري** |
| `GET /provider-statement` | كشف مزوّد | `report:provider` |
| `GET /commission` | تقارير العمولة | `report:commission` |
| `GET /profitability` | الربحية بالبُعد | `report:financial` |
| `GET /kpi` | مؤشرات تشغيلية | `report:kpi` |
| `POST /exports` · `GET /exports/{id}` | تصدير غير متزامن | `report:export` |

**قواعد ملزمة:**
- **المصدر `journal_entry_lines` أو Projection مشتقة منه — لا شيء غيره.**
- ميزان المراجعة **لكل عملة على حدة** — لا تجميع عبر العملات.
- **التصدير Cursor/Streaming حصرًا** — `POST /exports` يعيد `202` + `job_id` · النتيجة رابط موقَّع محدود الصلاحية.
- **كل تصدير حدث مُدقَّق** (من · متى · الفلاتر · عدد الصفوف).
- 🔴 القوائم المالية الموحّدة **محجوبة حتى حسم عملة التقرير** (`OPEN-BE-02` / `B-2`). **ميزان المراجعة لكل عملة على حدة يعمل بلا انتظار.**

## 10.1 قاعدة «Reporting قراءة فقط» — تعريف دقيق (Phase 1.1 · `AP-01` · `NF-04`)
```
D15 Reporting  ⟹  READ-ONLY بالنسبة لكل بيانات مالية، بلا استثناء.

✅ يملك:  export_jobs فقط — جدول تتبّع مهام تشغيلي، غير مالي
❌ لا يملك أي صلاحية كتابة على: journal_entries · journal_entry_lines ·
   party_wallet_projection · wallet_holds · transactions · commission_* ·
   funding_requests · financial_discrepancies · accounting_periods
❌ لا يوجد أي endpoint تحت /reports بأسلوب POST/PUT/PATCH/DELETE
   عدا POST /exports (إنشاء مهمة تصدير — لا أثر مالي)
❌ لا FK من export_jobs إلى أي جدول مالي بغرض الكتابة
```
**الفرض:** أدوار `report:*` **لا تحمل ولن تحمل** أي صلاحية `*:write` مالية. يُفحص في مصفوفة الاعتماد (Gate §F) وفي بذور RBAC.

## 10.2 الفصل عن Reconciliation (`AP-01`)
| | `D14 Reconciliation` | `D15 Reporting` |
|---|---|---|
| يكتشف الفروق | ✅ | ❌ |
| يسجّل `financial_discrepancy` | ✅ | ❌ |
| يقترح/ينفّذ قيد تسوية | ✅ **بصلاحية + Maker/Checker** | ❌ |
| يتحكم بإقفال الفترة | ✅ | ❌ |
| يقرأ الـLedger | ✅ | ✅ |
| يكتب أي شيء مالي | ✅ محكوم | **❌ مطلقًا** |
| مسار الـAPI | `/api/v1/admin/reconciliation/*` | `/api/v1/reports/*` |

---

# 11. SUPPORT & OPERATIONS — `/api/v1/support` · `/api/v1/operations`

| العملية | الغرض | التفويض |
|---|---|---|
| `POST /tickets` · `GET /tickets` · `POST /tickets/{id}/messages` | التذاكر والمحادثات | `support:*` |
| `POST /tickets/{id}/escalate` | تصعيد | `support:escalate` |
| `POST /service-requests` | طلب خدمة يدوية | `manual:submit` + **Idempotency** |
| `POST /service-requests/{id}/claim` · `/complete` · `/reject` | دورة التنفيذ | `operations:*` |
| `POST /disputes` · `POST /disputes/{id}/resolve` | النزاعات | `dispute:*` + **Maker/Checker** على الاسترداد |

**قواعد:** **لا خصم مالي نهائي قبل `COMPLETED`** — الحجز فقط · الاسترداد **قيد عكسي** حصرًا · المرفقات في Object Storage.

---

# 12. ADMIN — `/api/v1/admin`

| المجموعة | العمليات | التفويض |
|---|---|---|
| Parties | إنشاء · تعديل · نقل شجري · تعليق | `user:*` + عزل شجري |
| Limits & Credit | حدود · سقف ائتمان | `credit:override_limit` + **Maker/Checker** |
| Roles & Permissions | أدوار · صلاحيات · منع صريح | `rbac:manage` + **منع تصعيد الرتبة** |
| Approvals | صندوق Maker/Checker · اعتماد/رفض | `approval:check` + **`maker ≠ checker`** |
| Reconciliation | تشغيل · فروق · حسم | `recon:*` + Maker/Checker على `WRITTEN_OFF` |
| Audit | استعراض السجل · فحص سلسلة التجزئة | `audit:read` |
| Config | `GET /config` · `PUT /config/{key}` — كل قيم `CONFIGURATION` من `system_configuration` | `config:read` / `config:manage` + **Maker/Checker إلزامي لكل مفتاح `is_financial = true`** |

**قواعد `PUT /config/{key}` (Phase 1.1 · `NF-03`):**
- `accounting.reporting_currency` — **قابل للضبط مرة واحدة فقط**؛ بعد أول إقفال فترة يُرفض بـ`CONFLICT` · 409 (راجع §1.3).
- كل مفتاح `is_financial` (`pricing.min_margin` · `recon.auto_settle_threshold` · `commission.dispute_window_days` …) يمرّ بـ`approval_requests`.
- **لا endpoint يُرجع قيمة افتراضية مخترعة** — مفتاح غير مضبوط يُرجع `null` مع `status: "UNKNOWN"`.

**قواعد:**
- **إنشاء طرف يبدأ بصفر دائمًا** — **لا حقل رصيد افتتاحي في أي طلب** (ADR-104).
- **لا endpoint لإنشاء حساب COA** — الـ24 `is_system`.
- تغيير أي إعداد مالي (`MIN_MARGIN` · العتبات · المهلات) **مُدقَّق** ويتطلب Maker/Checker.

---

# 13. مصفوفة Idempotency للعمليات

| العملية | تتطلب `Idempotency-Key`؟ | الطبقة |
|---|---|---|
| `POST /transactions` | ✅ **إلزامي** | L1 → L3 |
| `POST /funding/requests` | ✅ | L1 + `receipt_hash` |
| `POST /funding/requests/{id}/approve` | ✅ | L2 (`source_id`) |
| `POST /wallet/transfer` | ✅ | L1 + L2 |
| `POST /wallet/adjust` | ✅ | L2 |
| `POST /commission/settle` · `/payout` | ✅ | L2 |
| `POST /accounting/entries/{id}/reverse` | ✅ | L2 |
| `POST /service-requests` | ✅ | L1 |
| `POST /disputes/{id}/resolve` | ✅ | L2 |
| `POST /webhooks/providers/*` | ⚙️ ضمنيًا | **L4** (`provider_event_id`) |
| كل `GET` | ❌ | — |

---

# 14. ما لا يوجد في هذا العقد — عمدًا

| غير موجود | السبب |
|---|---|
| endpoint يكتب رصيدًا مباشرة | ADR-104 — الرصيد أثر جانبي للقيد |
| endpoint ينشئ حسابًا في COA | ADR-103 — 24 حسابًا `is_system` |
| حقل رصيد افتتاحي في إنشاء طرف | ADR-104 — الإنشاء بصفر |
| `PUT`/`DELETE` على قيد أو سطر | ADR-118 — Append-only |
| إرجاع أي سرّ مزوّد أو `credential_ref` | ADR-113 — KMS فقط |
| endpoint يفرج عن حجز لمعاملة غامضة | ADR-109 — الإفراج بنتيجة مؤكدة فقط |
| إعادة تنفيذ على `unknown` | ADR-109 |
| endpoint يحسب سعرًا في العميل | ADR-111 — الحساب خادمي |
| مسار مالي بديل لأي وحدة (WiFi/يدوية/رقمية) | AP-03 — محرك واحد |

---

**لم يُنشأ endpoint فعلي. لم يُكتب كود. لم يُعدَّل SPA.**
**صفر سعر · صفر نسبة · صفر بيانات اعتماد أو بنك أو مزوّد مخترعة.**
