# ALOMDA_TEL_FINAL_ARCHITECTURE
## عقد المعمارية النهائي — المرجع المعتمد قبل PostgreSQL والـBackend

**الحالة:** DRAFT — بانتظار الاعتماد
**النطاق:** تصميم فقط — لم يُعدَّل أي ملف
**`spa_app.html`:** SHA256 `b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8` (بلا تغيير)
**الغرض:** أن يأخذها مهندس Backend ويبدأ التنفيذ منها وحدها

> **قاعدة الوثيقة:** كل حقيقة هنا عن الـSPA **مُتحقَّق منها بقراءة الكود**، لا بالنقل عن وثيقة سابقة. كل ما لم يُحسم يظهر صراحة كـ`OPEN DECISION`.

---

# القسم 1 — Architecture Reconciliation

## 1.1 ما اتفقت عليه كل المصادر

| المبدأ | المصدر | الحالة |
|---|---|---|
| دفتر الأستاذ مصدر الحقيقة المالية الوحيد | المتطلبات §31 · GAP · REVIEW_V2 · مُنفَّذ في SPA لمحفظة العميل | ✅ **مُثبَّت** |
| القيد المزدوج مع رفض ذري لغير المتوازن | كل المصادر | ✅ مُثبَّت |
| لا تعديل مالي — التصحيح بقيد عكسي | كل المصادر | ✅ مُثبَّت |
| Timeout ≠ Failure | المتطلبات §7 · SPA | ✅ مُثبَّت |
| Idempotency لكل عملية خارجية | كل المصادر | ✅ مُثبَّت كمبدأ |
| الأسرار خارج الكود | كل المصادر · SPA خالٍ منها | ✅ مُثبَّت |
| لا حركة مالية Offline | المتطلبات §21 · REVIEW_V2 | ✅ مُثبَّت |

## 1.2 ما اختلفت فيه المصادر

| الموضوع | التعارض | الحسم في هذه الوثيقة |
|---|---|---|
| عمق شجرة الحسابات | 5 مستويات مقابل 6 | **مرفوض كلاهما** — 3 مستويات + Dimensions (§5) |
| RPO | صفر مقابل <1 ثانية | `OPEN-14` — التوصية <5 ثوانٍ |
| تحديث المحافظ | أمثلة `UPDATE balance` في المصادر مقابل قاعدة الـLedger | **الـLedger يفوز** — المصادر نفسها تصفها بـ"أمثلة تعليمية" |
| تقنية الطابور | Redis/BullMQ مقابل RabbitMQ/Kafka | `OPEN-13` — التوصية Outbox+BullMQ |
| Microservices | مقترحة في مصادر، Monolith في أخرى | **Modular Monolith** (ADR-001) |
| مدة Access Token | 15 دقيقة مقابل ساعة | `OPEN-16` — التوصية 15 دقيقة |

## 1.3 ما كان خطأً وتم تصحيحه

| الخطأ | مصدره | التصحيح المُتحقَّق منه |
|---|---|---|
| "محرك العكس غير موجود" | GAP_ANALYSIS | ❌ **خطأ** — `reverseJournalEntry()` موجودة مع `reversalOfEntryId`/`reversedByEntryId` |
| "التغطية ~22%" | GAP_ANALYSIS | ❌ رقم انطباعي — استُبدل بمصفوفة نضج/مخاطرة |
| "قاعدة مطلقة: بلا queryStatus = ممنوع التنفيذ" | REVIEW_V2 | ❌ **مبالغة** — صُحِّحت إلى مصفوفة حسم الغموض (§10.4) |
| "agent.balance في مكان واحد" | ضمني في GAP | ❌ **الحقيقة: 7 مواقع كتابة مباشرة** (§7) |

## 1.4 ما لا يزال ناقصًا في كل المصادر

- سياسة عمولة رقمية حقيقية (كل الأرقام في المصادر "توضيحية")
- وثائق API لأي بنك/مزوّد
- بيانات 12 باقة تيليكوم
- سياسة انتهاء صلاحية الحجز (`hold expiry`) — لم تُذكر في أي مصدر
- سياسة الاحتفاظ بالبيانات (Retention) — غير مذكورة

---

# القسم 2 — المبادئ المعمارية غير القابلة للتفاوض

1. **قيد اليومية هو الحقيقة المالية الوحيدة.** كل رصيد Projection قابل لإعادة البناء الكاملة منه.
2. **لا كتابة مباشرة على أي رصيد.** كل تغيير يمر بقيد.
3. **السجلات المالية Append-only.** التصحيح بقيد عكسي حصرًا.
4. **لا استدعاء خارجي داخل معاملة قاعدة بيانات.** Outbox إلزامي.
5. **لا حركة مالية Offline.** العميل يعرض ويسوّد، لا ينفّذ.
6. **الحجز ليس قيدًا.** `wallet_holds` طبقة تشغيلية فوق الـLedger، لا بديل عنه.
7. **البُعد قبل الحساب.** التوسع بالـDimensions لا بتفريخ الحسابات.
8. **كل عملية خارجية لها `client_ref` فريد.**
9. **الغموض حالة أولى، لا استثناء.** `UNKNOWN` مُصمَّمة، لا مُعالَجة لاحقًا.
10. **الصلاحية خادمية.** إخفاء زر ليس أمنًا.

---

# القسم 3 — Domain Architecture

**القرار: Modular Monolith** (ADR-001).

**لماذا لا Microservices الآن:** النواة المالية تتطلب ذرية عبر النطاقات (حجز + قيد + حالة في معاملة واحدة). التوزيع يفرض Saga وتعويضات — أي **زيادة احتمال الفروق المالية**، وهو أخطر ما في هذا المشروع. الحجم المستهدف (100 ألف عملية/يوم ≈ 1.2/ثانية) لا يبرر التوزيع إطلاقًا.

**Workers عمليات مستقلة، وليست Microservices** — نفس قاعدة البيانات، نفس الكود، عملية تشغيل منفصلة لعزل الفشل فقط.

## 3.1 خريطة النطاقات

```
SHARED KERNEL (بلا منطق أعمال)
  Money · Currency · PartyRef · ClientRef · Result<T> · DomainEvent · Clock

D1  Identity & Hierarchy      → (لا شيء)
D2  Security & Access         → D1
D3  Accounting Core           → (لا شيء)          ★ لا يستدعي أحدًا إطلاقًا
D4  Wallet & Credit           → D3
D5  Funding & Gateways        → D3, D4
D6  Catalog & Pricing         → D1
D7  Transaction Orchestrator  → D3,D4,D6,D8,D9,D10
D8  Provider & Execution      → (لا شيء)          ★ يُستدعى، لا يستدعي
D9  Commission                → D3
D10 Digital Fulfillment       → D8
D11 WiFi                      → D8, D10
D12 Manual Services           → D4
D13 Support & Disputes        → (قراءة فقط من D7)
D14 Notifications             → (لا شيء)          ★ عبر Outbox فقط
D15 Reconciliation            → قراءة من الكل
D16 Reporting                 → قراءة من الكل
D17 Audit                     → (لا شيء)          ★ مكتوب إليه فقط
D18 Infrastructure/DR         → مستعرض
```

**منع الدوران:** الاتجاه نزولًا حصرًا. D3 وD8 وD14 وD17 **لا تستدعي أي نطاق**. التواصل العكسي بالأحداث فقط.

## 3.2 مسؤوليات مختارة (وما لا يحق لها)

| Domain | المسؤولية | **لا يحق له** |
|---|---|---|
| **D3 Accounting** | COA · قيود · فترات · FX · عكس | ❌ معرفة ما هو "وكيل" أو "باقة" · ❌ استدعاء أي نطاق · ❌ اتخاذ قرار عمل |
| **D4 Wallet** | Projections · حجوزات · ائتمان · تأمين | ❌ تعديل رصيد بلا قيد · ❌ أن يصبح مصدر حقيقة |
| **D7 Orchestrator** | دورة حياة المعاملة · تنسيق | ❌ حساب سعر · ❌ ترحيل قيد بنفسه · ❌ استدعاء مزوّد مباشرة (عبر Outbox) |
| **D8 Provider** | Adapters · Routing · Health | ❌ معرفة المحاسبة · ❌ تعديل أي رصيد · ❌ تسريب البروتوكول للنواة |
| **D9 Commission** | سياسات · استحقاق · تسوية | ❌ الدفع بلا قيد · ❌ عمولة على معاملة فاشلة |
| **D14 Notifications** | إرسال | ❌ الدخول في معاملة مالية · ❌ منع نجاح عملية بفشله |
| **D17 Audit** | تسجيل | ❌ أن يُعدَّل أو يُحذف منه شيء |

---

# القسم 4 — Financial Concepts Map (منع الخلط)

| المفهوم | التعريف | المصدر | النوع المحاسبي |
|---|---|---|---|
| **Accounting Balance** | مجموع (دائن−مدين) لطرف/عملة/بُعد من `journal_entry_lines` | **الـLedger** | حسب الحساب |
| **Held Amount** | مجموع الحجوزات النشطة | `wallet_holds` | **ليس قيدًا** |
| **Available Balance** | `Accounting Balance − Active Holds + Credit Limit` | محسوب | مشتق |
| **Credit** | حد سحب مصرّح | `credit_limits` | لا يزيد الرصيد؛ يوسّع المتاح فقط |
| **Insurance/Guarantee** | مبلغ محجوز كضمان | حساب مستقل | التزام مقيَّد |
| **Commission Accrual** | عمولة مستحقة غير مدفوعة | Ledger + `commission_accruals` | التزام |
| **Provider Balance** | رصيد ممول لدى المزوّد | Ledger | **أصل** |
| **Gateway Balance** | ليس كيانًا! هو **بُعد** على رصيد العميل | Ledger + `gateway_id` | التزام |

> **تصحيح جوهري:** "Gateway Balance" في الوثائق السابقة أُسيء فهمه ككيان مستقل. الحقيقة المُنفَّذة في الـSPA (وهي الأصح): البوابة **بُعد على سطر القيد**، لا حساب ولا محفظة.

---

# القسم 5 — Chart of Accounts النهائي

## 5.1 قرار العمق: 3 مستويات + Dimensions

**رفض 4/5/6 مستويات.** السبب: كل المصادر تخلط بين **الهرمية التجارية** (وكيل رئيسي ← وكيل ← نقطة بيع) و**شجرة الحسابات**. بناء حساب لكل وكيل يعني آلاف الحسابات، تقارير مستحيلة، وشجرة تتغير كلما أُضيف وكيل.

**البديل:** 3 مستويات ثابتة + **أبعاد على سطر القيد**:

```
المستوى 1: النوع        (ASSET · LIABILITY · EQUITY · REVENUE · EXPENSE)
المستوى 2: المجموعة     (CURRENT-ASSETS · WALLET-LIABILITIES · …)
المستوى 3: الحساب       (AGENT-WALLET-LIABILITY · …)  ← يُرحَّل عليه
─────────────────────────────────────────────────────
الأبعاد على السطر: party_type · party_id · gateway_id ·
                   provider_id · zone_id · currency_code
```

**الفائدة:** إضافة 10,000 وكيل = صفر حساب جديد. رصيد أي وكيل = تجميع بالبُعد.

## 5.2 الحسابات المعتمدة

الـSPA يحتوي **12 حسابًا حقيقيًا مُتحقَّقًا منه**. الجدول يبيّن ما يُنقل كما هو وما يُضاف:

| الكود | النوع | الأبعاد | الحالة |
|---|---|---|---|
| `CASH` | Asset | zone | 🔴 BUILD |
| `BANK` | Asset | — | 🔴 BUILD |
| `FUNDING-CLEARING` | Asset | gateway | 🔴 BUILD — وسيط للتحويلات غير المطابقة |
| `PROVIDER-BALANCE` | Asset | provider, currency | 🟢 **KEEP** (موجود) |
| `CUSTOMER-RECEIVABLE` | Asset | party | 🟢 KEEP |
| `PROVIDER-COMMISSION-RECEIVABLE` | Asset | provider | 🟢 KEEP |
| `PAYMENT-PROVIDER-SETTLEMENT-RECEIVABLE` | Asset | provider | 🟢 KEEP |
| `CUSTOMER-WALLET-LIABILITY` | Liability | party, **gateway**, currency | 🟢 **KEEP** ★ |
| `AGENT-WALLET-LIABILITY` | Liability | party, currency | 🟢 KEEP |
| `MASTER-WALLET-LIABILITY` | Liability | party | 🔴 BUILD |
| `POS-WALLET-LIABILITY` | Liability | party | 🔴 BUILD |
| `INSURANCE-GUARANTEE-LIABILITY` | Liability | party | 🔴 BUILD |
| `COMMISSION-PAYABLE` | Liability | party | 🔴 BUILD |
| `UNMATCHED-DEPOSITS` | Liability | — | 🔴 BUILD |
| `SERVICE-REVENUE` | Revenue | zone, service | 🟢 KEEP |
| `CUSTOMER-SERVICE-REVENUE` | Revenue | — | 🟢 KEEP |
| `PROVIDER-COMMISSION-REVENUE` | Revenue | provider | 🟢 KEEP |
| `FX-GAIN` / `FX-LOSS` | Revenue/Expense | currency | 🔴 BUILD |
| `PROVIDER-SERVICE-COST` | Expense | provider, service | 🟢 KEEP |
| `COMMISSION-EXPENSE-AGENT` | Expense | party | 🟢 KEEP |
| `COMMISSION-EXPENSE-CUSTOMER` | Expense | party | 🟢 KEEP |
| `COMMISSION-EXPENSE-MASTER` / `-POS` | Expense | party | 🔴 BUILD |
| `WIFI-OWNER-SHARE-EXPENSE` | Expense | party | 🔴 BUILD |

> **`OPEN-05`:** هل تُفصل الإيرادات حسب عائلة الخدمة (اتصالات/ألعاب/واي فاي) كحسابات، أم بُعد `service_family`؟ **التوصية: بُعد** — تقارير أمرن بلا تضخيم الشجرة.

---

# القسم 6 — Wallet Architecture

## 6.1 المصفوفة

| المحفظة | النوع | مصدر الحقيقة | سالب؟ |
|---|---|---|---|
| Customer | Liability | Ledger + بُعد gateway | ❌ لا |
| Agent | Liability | Ledger | ✅ حتى حد الائتمان |
| Master Agent | Liability | Ledger | ✅ حتى الحد |
| POS | Liability | Ledger | ❌ لا |
| Insurance | Liability مقيَّد | Ledger | ❌ لا |
| Provider Balance | **Asset** | Ledger | ⚠️ سالب = تنبيه فوري |

## 6.2 المعادلة المعتمدة

```
Accounting Balance = Σ(credit) − Σ(debit)   [من الـLedger، بالأبعاد]
Active Holds       = Σ(wallet_holds WHERE status='ACTIVE')
Available          = Accounting Balance − Active Holds + Credit Limit
```

## 6.3 دورة الحجز

```
CREATE ──> ACTIVE ──┬──> CAPTURED   (نجاح: قيد + إغلاق الحجز، في معاملة واحدة)
                    ├──> RELEASED   (فشل مؤكد)
                    └──> EXPIRED    (سياسة زمنية — انظر التحذير)
```

**⚠️ تحذير حرج غير مذكور في أي مصدر:** انتهاء صلاحية الحجز **لا يجوز أن يكون زمنيًا بحتًا** لمعاملة `PENDING_PROVIDER`. إن أفرجنا عن الحجز ثم عاد المزوّد بنجاح، نكون قد سلّمنا خدمة بلا خصم.

**القاعدة:** الحجز يُفرَج عنه **بنتيجة مؤكدة فقط**. الحجوزات المعلّقة تُصعَّد بشريًا بعد مهلة، ولا تُفرَج آليًا.

**التزامن:** `SELECT … FOR UPDATE` على صف المحفظة داخل المعاملة → فحص المتاح → إنشاء الحجز. `UNIQUE(transaction_id)` على الحجز يمنع الازدواج من Worker مكرر.

---

# القسم 7 — ترحيل `agent.balance` (مُتحقَّق منه بالكود)

## 7.1 المواقع الفعلية — 7 مواقع كتابة مباشرة

| السطر | الدالة | العملية |
|---|---|---|
| 7313 | `settleAgentCommissions()` | `agent.balance += totalAmount` |
| 9495 | `transferWalletFunds()` | `source.balance -= amount` |
| 9506 | `transferWalletFunds()` | `destination.balance += amount` |
| 26336 | `saveBalanceAdjust()` | تعديل إداري ±  |
| 40259 | `settlePackagePurchase()` | `agent.balance -= chargeAmount` |
| 40343 | `chargeAgentForManualService()` | `agent.balance -= product.price` |
| 40503 | `creditWifiNetworkOwnerForSale()` | `ownerEntity.balance += ownerRevenue` |

> الـSPA نفسه يعترف بالمشكلة في تعليق السطر 2412.

## 7.2 لماذا هو خطر

مصدر حقيقة ثانٍ ينافس الـLedger ← استحالة مطابقة موثوقة ← أي خلل يصبح غير قابل للكشف. ونقله كما هو = **دَين تقني دائم يستحيل التخلص منه لاحقًا**.

## 7.3 خطة الترحيل (Strangler Pattern)

| المرحلة | الإجراء | معيار الخروج |
|---|---|---|
| **T0** | بناء `AGENT-WALLET-LIABILITY` + Projection + مطابقة يومية | Projection تُبنى بالكامل من الـLedger |
| **T1** | تحويل الدوال السبع لترحيل قيد **بالتوازي** مع الكتابة القديمة | المصدران متطابقان 7 أيام متتالية |
| **T2** | **قطع الكتابة المباشرة** — `agent.balance` تصبح قراءة فقط | صفر كتابة مباشرة في الكود |
| **T3** | حذف الحقل نهائيًا | القراءة كلها من Projection |

**نقطة القطع:** T2 **قبل** بناء أي شيء جديد فوق محفظة الوكيل (العمولات الهرمية، الائتمان). البناء فوق حقل مُدان = مضاعفة الدَّين.

**التحدي الحقيقي:** 5 من 7 مسارات لا تملك مصدر عملة صريحًا (اكتشاف Phase 8i). **الحل الإلزامي:** كل مسار يجب أن يحدد عملته صراحة قبل T1 — لا ترحيل بعملة مُخمَّنة.

> **`OPEN-03`:** هل نُبقي `WALLET_LEDGER` (مسجّل تاريخي حالي) بعد الترحيل؟ **التوصية: RETIRE** — يصبح مكررًا لـ`journal_entry_lines`.

---

# القسم 8 — Transaction Lifecycle

## 8.1 آلة الحالات

```
CREATED ──> VALIDATED ──> HELD ──> QUEUED ──> PROCESSING
                                                  │
              ┌───────────────────────────────────┼──────────────────┐
              ↓                                   ↓                  ↓
           SUCCESS                             FAILED         PENDING_PROVIDER
              ↓                                   ↓                  │
           SETTLED                            RELEASED        ┌──────┴──────┐
              ↓                                   ↓           ↓             ↓
          RECONCILED                         RECONCILED    SUCCESS       UNKNOWN
                                                                            ↓
                                                                   MANUAL_RESOLUTION
```

**الانتقالات المسموحة حصرًا:** كل ما عدا ذلك يُرفض. **ممنوع:** `SUCCESS→FAILED` · `SETTLED→*` · `FAILED→SUCCESS` · أي قفزة تتخطى `HELD`.

**`UNKNOWN` حالة أولى** — لا فشل ولا نجاح. الحجز يبقى. تصعيد بشري إلزامي.

## 8.2 معالجة الحالات الحرجة

| الحالة | المعالجة |
|---|---|
| طلب مكرر من العميل | `UNIQUE(client_ref)` → إعادة النتيجة المحفوظة بلا تنفيذ |
| Worker مكرر | `FOR UPDATE SKIP LOCKED` + `WHERE status='QUEUED'` |
| Timeout | `PENDING_PROVIDER` — الحجز باقٍ |
| **نجاح المزوّد + انهيار Backend** | سجل `SENT` **قبل** الاستدعاء + Commit → Worker يجده معلقًا → **يستعلم، لا يعيد** |
| نجاح محفوظ + الرد لم يصل | إعادة الإرسال بنفس `client_ref` تُعيد النتيجة |
| رد متأخر بعد الحسم اليدوي | يُسجَّل + يفتح `discrepancy` |
| Refund | قيد عكسي + عكس عمولة — **لا حذف** |
| إغلاق حساب مع معلّقات | `CLOSING` → لا يكتمل حتى حسم كل المعلّقات |
| تغيّر السعر أثناء الطابور | `locked_price` — الطابور **لا يعيد التسعير أبدًا** |
| تغيّر سعر الصرف | `locked_fx_rate` |
| نفاد القسائم بعد الحجز | فشل + إفراج فوري |
| نفاد رصيد المزوّد | فشل مؤقت → إعادة توجيه (بشرط §11.2) |

---

# القسم 9 — Idempotency (مستويان منفصلان)

| المستوى | المفتاح | يمنع | الحالة في SPA |
|---|---|---|---|
| **Ledger** | `(source_type, source_id)` | قيدًا مزدوجًا | ✅ **موجود ويعمل** |
| **Execution** | `client_ref` (UUID من العميل) | **تنفيذًا خارجيًا مزدوجًا** | ❌ **مفقود تمامًا** |
| **Provider** | `provider_reference` | ازدواجًا لدى المزوّد | ❌ مفقود |
| **Replay** | `nonce + timestamp` | إعادة إرسال خبيثة | ❌ مفقود |

> **تصحيح صريح:** وجود `postJournalEntry` idempotent **لا يحل** ازدواج التنفيذ. المستويان مستقلان تمامًا. يمكن استدعاء المزوّد مرتين وينتج قيد واحد — وهذا **أسوأ** من قيدين، لأنه خسارة صامتة.

---

# القسم 10 — Provider Architecture

## 10.1 الكيانات

```
Provider ──┬── ProviderCredential   (مرجع KMS فقط — لا سرّ في DB)
           ├── ProviderAccount      (رصيد ممول = أصل)
           ├── ProviderMapping      (service × provider × cost × product_code × priority)
           ├── ProviderHealth       (نجاح · زمن · حالة القاطع)
           ├── ProviderCapability   ★ جديد: execute/queryStatus/cancel/getBalance/idempotency
           └── ProviderExecutionLog (append-only)
```

**`ProviderCapability` كيان مستقل** — لأن قرار التوجيه والفشل يعتمد عليه، ولا يجوز تخمينه.

## 10.2 عقد الـAdapter

```
execute(request)      → StandardResult        [إلزامي]
queryStatus(ref)      → StandardResult        [اختياري — يُعلَن]
cancel(ref)           → StandardResult        [اختياري]
getBalance()          → Money                 [اختياري]
```

البروتوكول (REST/SOAP/SMPP/USSD/GSM) **لا يتسرب للنواة إطلاقًا**.

## 10.3 مصفوفة حسم الغموض (تصحيح لـREVIEW_V2)

REVIEW_V2 قال "بلا queryStatus = ممنوع التنفيذ الآلي". **هذه مبالغة.** القاعدة الصحيحة:

| قدرة المزوّد | حسم الغموض | القرار |
|---|---|---|
| `queryStatus` | استعلام آلي | ✅ تنفيذ آلي كامل |
| idempotency لديه (بدون query) | إعادة إرسال آمنة | ✅ تنفيذ آلي |
| مطابقة يومية موثوقة فقط | حسم خلال 24 ساعة | ⚠️ مسموح **بحد مبلغ** + إفصاح للمستخدم |
| **لا شيء مما سبق** | لا حسم ممكن | ❌ **يدوي إلزامي — ممنوع التنفيذ الآلي** |

## 10.4 Routing

```
Zone → Availability (Circuit Breaker) → Capability → Balance → Priority → Cost → Margin Guard
```

**قاعدة Fallback الحرجة:** لا تحويل لمزوّد ثانٍ إلا إذا كان فشل الأول **مؤكدًا**. عند `UNKNOWN` أو `TIMEOUT` ← **ممنوع الـFallback منعًا باتًا** (خطر تنفيذ مزدوج). فقط `REJECTED`/`INSUFFICIENT_BALANCE`/`CIRCUIT_OPEN` تسمح به.

---

# القسم 11 — Pricing Engine

## 11.1 ترتيب الأولوية

```
Provider Cost (D8)
   ↓
Base Price (Service)
   ↓
Zone Adjustment
   ↓
Pricing Group / Tier
   ↓
Hierarchy Distribution
   ↓
Custom Override (بصلاحية + تدقيق)
   ↓
FX Conversion
   ↓
═══ MARGIN GUARD ═══   ← بوابة إلزامية
   ↓
Customer Price
```

**قاعدة Margin Guard:**
```
Customer Price − Provider Cost − Σ(All Commissions) ≥ MIN_MARGIN
```
تُفحص **مرتين**: عند حفظ السياسة (منع تهيئة خاطئة) وعند الحجز (منع تنفيذ خاطئ). التجاوز يحتاج سياسة صريحة + صلاحية + تسجيل تدقيق.

## 11.2 Price/FX Lock — ما يُثبَّت في المعاملة

| الحقل | السبب |
|---|---|
| `locked_customer_price` | العميل يدفع ما رآه |
| `locked_provider_cost` | ربحية دقيقة تاريخيًا |
| `locked_fx_rate` + `fx_rate_id` | إعادة إنتاج الحساب |
| `locked_currency` | لا تغيير بعد البدء |
| `pricing_rule_version` | تتبّع أي قاعدة طُبِّقت |
| `commission_policy_version` | العمولة لا تتغير بعد الحجز |

---

# القسم 12 — Commission Engine

## 12.1 الدورة

```
CALCULATED ──> PENDING ──> HELD ──> SETTLED ──> PAID
                  │                    │
                  └──> REVERSED <──────┘
```
`PENDING` عند نجاح المعاملة · `HELD` أثناء فترة النزاع · `PAID` بقيد فعلي.

## 12.2 مثال رقمي (توضيحي — لا سياسة معتمدة)

عملية بيع 1,000 وحدة، تكلفة المزوّد 950، عمولة المزوّد لنا 50:

```
سعر العميل            1,000
تكلفة المزوّد           (950)
عمولة المزوّد الواردة      50
─────────────────────────────
مجمّع العمولة القابل للتوزيع  100
   وكيل رئيسي  20%           (20)
   وكيل        30%           (30)
   نقطة بيع    10%           (10)
─────────────────────────────
صافي ربح النظام              40
```

القيود:
```
Dr AGENT-WALLET-LIABILITY      1,000   [party=agent]
    Cr SERVICE-REVENUE                  1,000
Dr PROVIDER-SERVICE-COST         950
    Cr PROVIDER-BALANCE                   950
Dr PROVIDER-COMMISSION-RECEIVABLE 50
    Cr PROVIDER-COMMISSION-REVENUE         50
Dr COMMISSION-EXPENSE-MASTER      20
Dr COMMISSION-EXPENSE-AGENT       30
Dr COMMISSION-EXPENSE-POS         10
    Cr COMMISSION-PAYABLE                  60
```

**ضمانات:** `UNIQUE(transaction_id)` على الاستحقاق · لا عمولة على معاملة فاشلة · Refund → عكس (لا حذف) · تغيّر الهرمية لا يؤثر على استحقاقات سابقة (الشجرة مُثبَّتة وقت المعاملة).

> **`OPEN-10`:** النسب أعلاه **توضيحية**. السياسة الحقيقية غير متوفرة في أي مصدر.

---

# القسم 13 — Funding & Gateways

## 13.1 فصل المفاهيم (منع الخلط)

| المفهوم | التعريف | مثال |
|---|---|---|
| **Gateway** | سياق رصيد العميل | شمال · جنوب |
| **Gateway Account** | حساب العميل داخل بوابة | حساب أحمد في الشمال |
| **Funding Method** | وسيلة التغذية (**عرض للعميل**) | بنك عدن · الكريمي |
| **Funding Account Link** | ربط العميل بالوسيلة | حساب أحمد لدى الكريمي |
| **Financial Account** | **حساب داخلي محاسبي** | حساب الشركة البنكي |
| **Provider** | منفّذ الخدمة | مزوّد شحن |

> **الخلط الأخطر:** `Funding Method ≠ Financial Account`. الأول ما يراه العميل، الثاني ما يُرحَّل عليه. **الـSPA يفصلهما بالفعل بشكل صحيح** (`receivingAccountInstructions` مقابل `receivingFinancialAccountId`) — يُحفَظ كما هو.

## 13.2 دورة التغذية

```
DRAFT → SUBMITTED → PENDING_REVIEW → APPROVED → POSTED
                          ↓
                      REJECTED (بلا قيد، بلا رصيد)
```

**الحماية:** `UNIQUE(bank_reference)` عالميًا · `UNIQUE(receipt_hash)` · `UNIQUE(webhook_event_id)` · التحويل غير المطابق → `UNMATCHED-DEPOSITS` (التزام) حتى المطابقة.

---

# القسم 14 — Digital Fulfillment

**محرك واحد بـStrategies** — لا ثلاثة محركات:

```
FulfillmentEngine
  ├── DirectIdStrategy   (تحقق من اللاعب ← شحن)
  ├── PinPoolStrategy    (حجز ذري ← تسليم)
  ├── ApiPinStrategy     (طلب PIN من المزوّد)
  ├── ManualStrategy     (طابور بشري)
  └── WifiVoucherStrategy(مخزون أو توليد)
```

**السبب:** الاختلاف في **كيفية الحصول على المُنتَج** فقط؛ دورة الحياة واحدة. خدمة جديدة = Strategy فقط.

**دورة القسيمة:** `AVAILABLE → LOCKED → DELIVERED → USED` · `EXPIRED` · `RELEASED`

**الحجز الذري:**
```sql
SELECT id FROM voucher_inventory
WHERE pool_id=$1 AND status='AVAILABLE' AND (expiry_at IS NULL OR expiry_at > now())
ORDER BY expiry_at NULLS LAST
FOR UPDATE SKIP LOCKED LIMIT 1;
```

**PIN:** مشفَّر في الراحة · **يُفك عند التسليم فقط** · **لا يُسجَّل في أي Log إطلاقًا** · مربوط بـ`transaction_id`.

**محاسبة المخزون:** القسيمة أصل عند الشراء، تتحول لتكلفة عند البيع.

---

# القسم 15 — WiFi

```
WifiNetwork ── Owner ── Profile ── Voucher
                                      ↓
                          MikrotikAdapter / RadiusAdapter  (خلف عقد D8)
                                      ↓
                     التسليم: طباعة · QR · SMS · (واتساب/تيليغرام لاحقًا)
```

**فصل إلزامي:** حصة المالك وعمولة الوكيل وربح النظام تُحسب في **D9 Commission**، لا في وحدة WiFi. بيانات MikroTik في KMS — **ليست جزءًا من الحقيقة المالية إطلاقًا**.

**إصلاح مطلوب:** `creditWifiNetworkOwnerForSale()` (السطر 40503) تكتب مباشرة على `ownerEntity.balance` ← تُحوَّل لقيد ضمن T1.

---

# القسم 16 — Manual Services

```
REQUEST → FREEZE(hold) → ASSIGNED → PROCESSING → COMPLETED (capture)
                                          ├────> REJECTED  (release)
                                          └────> CANCELLED (release)
```
مع: مشغّل · إثبات · سبب رفض · مهلة تصعيد · تدقيق كامل. **الأثر المالي عند الحسم فقط.**

---

# القسم 17 — Identity & Hierarchy

```
SUPER_ADMIN · ADMIN · FINANCE · SUPPORT · OPERATOR   (موظفون)
MASTER_AGENT → AGENT → SUB_AGENT → POS               (شبكة، بـparent_id)
CUSTOMER                                              (نهائي)
```

**جدول `parties` موحد** بـ`parent_id` + `party_type` + `ltree` للاستعلام الشجري.
**العزل:** كل طرف يرى شجرته فقط. يُطبَّق **في الاستعلام (Row-Level)**، لا في الواجهة.

> **`OPEN-17`:** هل العميل يتبع وكيلًا (`parent_id`) أم مستقل؟ الـSPA يربطه بـ`linkedAgentId`. **التوصية:** علاقة تجارية اختيارية، لا هرمية مالية.

---

# القسم 18 — RBAC + SoD + Maker/Checker

**النموذج:** `Deny by default` → `Role grants` → **`Explicit denies (تتفوق على المنح)`** → قيود سياقية (IP/جهاز/وقت/حد مبلغ).

## 18.1 فصل الواجبات (SoD) — من أخطر ما فات التحليل السابق

المتطلبات §3 تنص: SUPER ADMIN **"لا يفترض أن يرى أرصدة العملاء أو أسرارهم"**.

| الفصل الإلزامي | لماذا |
|---|---|
| من يُنشئ ≠ من يعتمد | منع تمرير ذاتي |
| مدير النظام ≠ الوصول المالي | حماية بيانات العملاء |
| من يهيّئ التسعير ≠ من ينفّذ | منع تلاعب |
| من يعتمد التغذية ≠ من يقدّمها | منع احتيال |

> **`OPEN-11`:** هل SUPER_ADMIN يُمنع فعليًا من رؤية الأرصدة؟ **التوصية: نعم** — مع دور `FINANCE` منفصل. **يحتاج موافقتكم**، لأنه يغيّر تجربة الإدارة جذريًا.

## 18.2 Maker/Checker إلزامي لـ

اعتماد تغذية فوق حد · تعديل رصيد يدوي · تجاوز Margin Guard · تغيير حد ائتماني · عكس قيد · إغلاق فترة · تغيير تسعير · تسوية عمولات كبيرة.

---

# القسم 19 — Device & Session Security

```
User → Session → Device → IP → Risk Score → Permission → Transaction Auth
```
تسجيل جهاز + ربط · اعتماد جهاز جديد بـOTP · Refresh Rotation مع كشف إعادة الاستخدام · 2FA/TOTP · PIN للعمليات الحساسة · إبطال عن بُعد · حظر مؤقت · Rate Limiting · Replay Protection.

---

# القسم 20 — Audit Architecture

**السجلات:** `system_audit_logs` · `staff_audit_logs` · `financial_action_logs` · `provider_execution_logs` · `transaction_status_history` · `security_events`

**كلها Append-only** بـTrigger يمنع UPDATE/DELETE.
**Hash Chain:** `hash = SHA256(previous_hash || payload)` — أي عبث يكسر السلسلة.
**المحتوى:** actor · target · old/new (JSONB) · IP · UA · timestamp · hash · previous_hash.

> **`OPEN-20`:** تخزين خارجي (WORM/SIEM) الآن أم لاحقًا؟ **التوصية: تصدير دوري لاحقًا** — سلسلة التجزئة تكفي مبدئيًا.

---

# القسم 21 — Offline / Online

| الطبقة | Offline | الشرط |
|---|---|---|
| الكتالوج | ✅ | version stamp |
| آخر رصيد | ✅ | **ختم زمني إلزامي معروض** |
| كشوف سابقة | ✅ | للقراءة |
| مسودة + إيصال | ✅ | `client_ref` |
| ⛔ حركة مالية | **ممنوع** | — |

**منع الثقة الزائفة — 3 طبقات:**
1. **بيانيًا:** لا وجود لحالة `SUCCESS` محليًا. الحالات: `DRAFT` · `PENDING_SYNC` فقط.
2. **بصريًا:** المسودة بمظهر مختلف ("بانتظار الإرسال")، والرصيد دائمًا بختم "آخر تحديث…".
3. **بنيويًا:** الرصيد المعروض **لا يتغير محليًا أبدًا** — من رد الخادم حصرًا.

**Staleness:** أخضر <5 دقائق · أصفر <1 ساعة · أحمر >1 ساعة ("قد يكون قديمًا").

---

# القسم 22 — Outbox & Workers

**لماذا لا يُستدعى المزوّد داخل معاملة DB:** الاستدعاء قد يستغرق ثوانٍ ← يقفل الصفوف ويستنزف الاتصالات · لا يمكن التراجع عنه عند فشل الالتزام · انهيار الخادم يترك أثرًا خارجيًا بلا سجل داخلي.

```
BEGIN
  تحديث الحالة
  INSERT INTO outbox_events
COMMIT
   ↓
Worker يقرأ (FOR UPDATE SKIP LOCKED)
   ↓
سجل SENT + COMMIT   ← قبل الاستدعاء
   ↓
استدعاء المزوّد
   ↓
سجل النتيجة + COMMIT
```

**Workers:** تنفيذ · استعلام حالة · إشعارات · مطابقة · تقارير · احتيال · إعادة بناء Projections.

---

# القسم 23 — Reconciliation

| # | الطبقة | التكرار | عند الفرق |
|---|---|---|---|
| 1 | Wallet ↔ Ledger | **يومي + كل إقفال** | `financial_discrepancy` تلقائي |
| 2 | Transaction ↔ Provider | يومي | تصنيف + حسم |
| 3 | Funding ↔ Bank | يومي | UNMATCHED |
| 4 | Commission ↔ Ledger | يومي | فرق |
| 5 | Provider Balance ↔ المزوّد | يومي | فرق |
| 6 | Gateway ↔ خارجي | حسب التوفر | فرق |

**الدورة:** Detect → Classify → Resolve → **Adjust (قيد تسوية، لا تعديل)** → Audit → Close.

**التسوية الآلية مسموحة فقط:** فرق تقريب < عتبة · معاملة مطابقة بمرجع مؤكد.
**تحتاج موافقة بشرية:** أي فرق في المبلغ · معاملة مفقودة عند أي طرف · فرق يتجاوز العتبة.

**قاعدة:** لا تُغلق فترة وفيها فرق غير محسوم.

---

# القسم 24 — Reporting

| التقرير | الاستراتيجية |
|---|---|
| رصيد لحظي | Projection |
| كشوف (عميل/وكيل/مزوّد/بوابة) | Live Query + فهرس + ترقيم |
| Trial Balance · P&L · Balance Sheet | **Materialized View** (ليلي + عند الطلب) |
| الربحية · أداء المزوّدين | Materialized View |
| المطابقة · التغذية | Background Job |
| تصدير ضخم | **Cursor/Stream** — لا تحميل بالذاكرة |

كل تقرير: مصدر · عملة · فلاتر · نطاق زمني · **فحص صلاحية + عزل شجري إلزامي**.

---

# القسم 25 — Database Architecture (تصميم منطقي)

## 25.1 المعايير

| المعيار | القرار |
|---|---|
| المال | **`NUMERIC(20,4)`** — `FLOAT` ممنوع منعًا باتًا |
| العملة | `CHAR(3)` + FK — مع **كل** مبلغ |
| المفاتيح | **UUID v7** (قابل للترتيب زمنيًا، يقلل تشظي الفهارس) |
| العزل | `READ COMMITTED` + أقفال صريحة |
| التفاؤلي | `version` على `transactions` |
| التشاؤمي | `FOR UPDATE` (محافظ) · `SKIP LOCKED` (طوابير/قسائم) |
| Soft Delete | مرجعية فقط — **ممنوع على أي شيء مالي** |
| أعمدة التدقيق | `created_at` · `created_by` · `updated_at` · `updated_by` |

## 25.2 تصنيف الجداول

| النوع | الجداول |
|---|---|
| **Append-only** | `journal_entries` · `journal_entry_lines` · `*_audit_logs` · `provider_execution_logs` · `transaction_status_history` · `outbox_events` |
| **Mutable** | `transactions` · `wallet_holds` · `voucher_inventory` · `funding_requests` · `tickets` |
| **Projection** | `wallets` (قابلة لإعادة البناء 100%) · `provider_health` |
| **Reference** | `currencies` · `gateways` · `chart_of_accounts` · `services` |

## 25.3 جداول مختارة

**`journal_entry_lines`** (قلب النظام)
PK `id` · FK `journal_entry_id`, `account_id` · `party_type`, `party_id`, **`gateway_id`**, `provider_id`, `zone_id` · `currency_code`, `debit NUMERIC(20,4)`, `credit NUMERIC(20,4)`
CHECK: `debit>=0 AND credit>=0 AND NOT(debit>0 AND credit>0)`
IDX: `(party_type, party_id, gateway_id, currency_code)`
**Partition:** شهريًا

**`transactions`**
`client_ref` **UNIQUE** · `status` · `version` · `locked_customer_price` · `locked_provider_cost` · `locked_fx_rate` · `pricing_rule_version` · `commission_policy_version` · `provider_id`
IDX جزئي: `(status) WHERE status IN ('QUEUED','PROCESSING','PENDING_PROVIDER')`

**`wallet_holds`** — `UNIQUE(transaction_id)` · `status` · `amount` · `currency_code`
**`commission_accruals`** — `UNIQUE(transaction_id, beneficiary_party_id)`
**`funding_requests`** — `UNIQUE(bank_reference)` · `UNIQUE(receipt_hash)`
**`voucher_inventory`** — IDX جزئي `(pool_id) WHERE status='AVAILABLE'` · PIN مشفَّر
**`outbox_events`** — `status` · `attempts` · `next_retry_at`

---

# القسم 26 — Source of Truth Matrix

| البيان | مصدر الحقيقة | Projection/Cache | من يكتب |
|---|---|---|---|
| رصيد العميل | `journal_entry_lines` | `wallets` | D3 فقط |
| رصيد الوكيل | `journal_entry_lines` | `wallets` | D3 فقط |
| رصيد المزوّد | `journal_entry_lines` | `wallets` | D3 فقط |
| رصيد البوابة | `journal_entry_lines` + بُعد | — | D3 فقط |
| الحجوزات | `wallet_holds` | — | D4 فقط |
| العمولة | `journal_entry_lines` | `commission_accruals` | D9 → D3 |
| حالة المعاملة | `transactions` | — | D7 فقط |
| نتيجة المزوّد | **المزوّد الخارجي** | `provider_execution_logs` | D8 فقط |
| حالة القسيمة | `voucher_inventory` | — | D10 فقط |
| التسعير | `service_pricing` | Cache | D6 فقط |
| التحويل البنكي | **البنك** | `funding_requests` | D5 فقط |
| التدقيق | `*_audit_logs` | — | **الكل يكتب، لا أحد يعدّل** |
| الجلسة | Redis | — | D2 — **ليس مصدر حقيقة مالية** |

---

# القسم 27 — SPA Migration Map

| كيان/دالة في SPA | الدور | المشكلة | Domain | الوجهة | القرار |
|---|---|---|---|---|---|
| `JOURNAL_ENTRY_DIRECTORY` | رؤوس القيود | ذاكرة | D3 | `journal_entries` | 🟢 **KEEP** |
| `JOURNAL_ENTRY_LINE_DIRECTORY` | أسطر + بُعد بوابة | ذاكرة | D3 | `journal_entry_lines` | 🟢 **KEEP** ★ |
| `CHART_OF_ACCOUNTS` | 12 حسابًا مسطّحًا | بلا هرمية | D3 | `chart_of_accounts` | 🔵 EXPAND (3 مستويات) |
| `postJournalEntry()` | الترحيل | متزامن محلي | D3 | `AccountingService.post()` | 🟢 KEEP |
| `reverseJournalEntry()` | العكس | — | D3 | `AccountingService.reverse()` | 🟢 **KEEP** ★ |
| `CUSTOMER_DIRECTORY` | العملاء | بلا هرمية/KYC | D1 | `parties` | 🔵 EXPAND |
| `AGENT_DIRECTORY` | وكلاء + `balance` | **مصدر حقيقة ثانٍ** | D1+D4 | `parties` + `wallets` | 🟡 **MODIFY** |
| `WALLET_LEDGER` | سجل تاريخي | مكرر للـLedger | D4 | — | ⚫ **RETIRE** |
| `GATEWAY_DIRECTORY` | البوابات | — | D5 | `gateways` | 🟢 KEEP |
| `CUSTOMER_GATEWAY_ACCOUNT_DIRECTORY` | حساب/بوابة | — | D5 | `customer_gateway_accounts` | 🟢 KEEP |
| `CUSTOMER_GATEWAY_FUNDING_METHOD_DIRECTORY` | وسائل التغذية | — | D5 | `funding_methods` | 🟢 KEEP ★ |
| `CUSTOMER_GATEWAY_FUNDING_ACCOUNT_DIRECTORY` | ربط العميل | — | D5 | `funding_account_links` | 🟢 KEEP |
| `CUSTOMER_TOPUP_REQUEST_DIRECTORY` | طلبات التغذية | بلا hash | D5 | `funding_requests` | 🔵 EXPAND |
| `approve/rejectCustomerTopupRequest()` | الاعتماد | بلا Maker/Checker | D5 | `FundingService` | 🔵 EXPAND |
| `recordVerifiedExternalCustomerTransfer()` | ترحيل التغذية | — | D5 | `FundingService` | 🟢 KEEP |
| `PROVIDER_DIRECTORY` | 3 محاكاة | لا مزوّد حقيقي | D8 | `providers` | 🔵 EXPAND |
| `TELECOM_PROVIDER_MAPPING_DIRECTORY` | 3 روابط | 2/14 باقة | D8 | `provider_mappings` | 🔵 EXPAND |
| `ProviderRegistry` | عقد Adapter | `execute` فقط | D8 | `ProviderAdapterRegistry` | 🔵 EXPAND |
| `EXECUTION_RESPONSE_STATUSES` | 11 حالة | — | D8 | Enum | 🟢 KEEP ★ |
| `executeTelecomPackageProviderRequest()` | تنفيذ موحّد | متزامن | D7+D8 | Orchestrator + Outbox | 🔵 EXPAND |
| `PRODUCT_DIRECTORY` | 14 باقة | — | D6 | `services`/`packages` | 🟢 KEEP |
| `computeCustomerGatewayPrice()` | التسعير | بلا شرائح/حارس | D6 | `PricingService` | 🔵 EXPAND ★ |
| `COMMISSION_POLICY/ACCRUAL/SETTLEMENT_DIRECTORY` | العمولات | بلا هرمية | D9 | 3 جداول | 🔵 EXPAND |
| `settleAgentCommissions()` | تسوية | **كتابة مباشرة** | D9 | `CommissionService` | 🟡 MODIFY |
| `transferWalletFunds()` | تحويل | **كتابة مباشرة ×2** | D4 | قيد | 🟡 MODIFY |
| `saveBalanceAdjust()` | تعديل إداري | **كتابة مباشرة** | D4 | قيد + Maker/Checker | 🟡 MODIFY |
| `settlePackagePurchase()` | خصم شراء | **كتابة مباشرة** | D7 | قيد | 🟡 MODIFY |
| `chargeAgentForManualService()` | خصم يدوي | **كتابة مباشرة** | D12 | قيد | 🟡 MODIFY |
| `creditWifiNetworkOwnerForSale()` | حصة المالك | **كتابة مباشرة** | D11+D9 | قيد | 🟡 MODIFY |
| بنية الدعم | تذاكر | بلا SLA | D13 | `tickets` | 🔵 EXPAND |
| `NOTIFICATION_DIRECTORY` | إشعارات | داخل التطبيق فقط | D14 | `notifications` + Outbox | 🔵 EXPAND |
| `localStorage` | التخزين | **ليس قاعدة بيانات** | — | PostgreSQL | ⚫ **RETIRE** |
| كلمات المرور النصية | الدخول | **خطر أمني** | D2 | Argon2id | ⚫ **RETIRE** |
| `attachmentDataUrl` (Base64) | الإيصالات | يفجّر التخزين | D5 | Object Storage | 🟡 MODIFY |

---

# القسم 28 — نقاط قوة SPA (تُحفَظ ولا يُعاد تصميمها)

1. **بُعد `gateway_id` على سطر القيد** — يعزل أرصدة بوابات تشترك بنفس العملة، بحساب تحكم واحد. **لا يوجد في أي مصدر آخر.**
2. **محفظة العميل مشتقة 100%** — بلا حقل `balance` إطلاقًا.
3. **`reverseJournalEntry()`** بربط ثنائي وIdempotency مستقلة.
4. **فصل `Funding Method` عن `Financial Account`** — المصادر تخلط بينهما.
5. **`verification_unavailable`** — رفض بنيوي لتلفيق النجاح.
6. **البنية المدفوعة بالبيانات** — مؤسسة جديدة = بيانات فقط (مُثبَت اختباريًا).
7. **11 حالة تنفيذ** مع `Timeout ≠ Success`.
8. **فصل سعر العميل عن تكلفة المزوّد** — مُثبَت بنيويًا.

---

# القسم 29 — Technical Debt

## MUST FIX BEFORE PRODUCTION
1. `agent.balance` — 7 مواقع كتابة مباشرة
2. كلمات المرور النصية
3. `localStorage` كمخزن مالي
4. غياب Execution Idempotency
5. غياب الحجز (`HELD`)
6. غياب Audit Log فعلي
7. غياب فحص صلاحية خادمي
8. صور Base64
9. غياب Outbox
10. `WALLET_LEDGER` كمصدر ثانٍ محتمل

## CAN BE MIGRATED GRADUALLY
شجرة الحسابات المسطّحة · بنية التسعير · بنية العمولة · عقد الـAdapter · الإشعارات

## SAFE TO KEEP TEMPORARILY
مزوّدو المحاكاة (بعلَم `is_simulator`) · `receivingFinancialAccountId = null` (يرفض بصدق) · 12 باقة بلا mapping

## SHOULD RETIRE
`localStorage` · كلمات المرور النصية · `WALLET_LEDGER` · Base64 · فحص الصلاحية الواجهي

---

# القسم 30 — DR / HA

**تحليل اقتصادي لـ`RPO=0`:** يتطلب نسخًا متزامنًا ← كل كتابة تنتظر النسخة الثانوية ← زمن مضاعف · توقف الثانوية **يوقف النظام كله** · تكلفة بنية مضاعفة. لمنصة بـ~1.2 عملية/ثانية، **الثمن لا يبرره العائد**.

| المؤشر | المصادر | **التوصية للمرحلة 1** | المبرر |
|---|---|---|---|
| RPO | 0 أو <1s | **< 5 ثوانٍ** | الخسارة القصوى = ثوانٍ، **وكلها قابلة للاسترجاع من `client_ref`** |
| RTO | <5 دقائق | **< 30 دقيقة** | التبديل الآلي يخلق خطر Split-Brain أكبر من فائدته |
| الإتاحة | 99.99% | **99.9%** | الفرق ≈ 44 دقيقة/سنة بتكلفة مضاعفة |

**غير قابل للتفاوض:** WAL مستمر · PITR · نسخ خارجية غير قابلة للتعديل · **اختبار استرجاع فعلي دوري** · Idempotent Replay.

> **`OPEN-14`:** يحتاج موافقتكم — رفض صريح لأرقام واردة في مصادركم.

---

# القسم 31 — ما لا يُبنى الآن

| العنصر | التصنيف | السبب |
|---|---|---|
| Microservices | **Later** | يزيد خطر الفروق المالية |
| Kafka | **Later** | Outbox+Redis كافيان |
| `RPO=0` | **Later** | تكلفة بلا مقابل |
| AI / تنبؤ / Credit Score | **Future** | قبل اكتمال النواة = خطأ فادح |
| Open Banking · SoftPOS · تحويلات دولية | **Future** | Roadmap 2027-28 |
| OCR | **Later** | المصادر نفسها تجعله اختياريًا |
| SMS/USSD للمعاملات | **Later** | "legacy/fallback" في المصادر |
| المندوب الميداني | **Later** | نطاق مستقل |
| شجرة حسابات 6 مستويات | **Never** | Dimensions أفضل |

**لم يُحذف أي متطلب** — أُعيد ترتيبه زمنيًا فقط.

---

# القسم 32 — OPEN DECISIONS

| # | القرار | التوصية | أثر DB | أثر Backend | موافقة؟ |
|---|---|---|---|---|---|
| **OPEN-01** | Monolith أم Microservices | **Modular Monolith** | مخطط واحد | وحدات | ✅ **نعم** |
| **OPEN-02** | تمثيل المال | **`NUMERIC(20,4)`** | **لا رجعة فيه** | Money type | ✅ **نعم — حرج** |
| **OPEN-03** | مصير `WALLET_LEDGER` | RETIRE | جدول أقل | — | ✅ نعم |
| **OPEN-04** | توقيت قطع `agent.balance` | **المرحلة 3، قبل أي بناء فوقها** | Projection | Strangler | ✅ **نعم — حرج** |
| **OPEN-05** | تفصيل الإيرادات: حساب أم بُعد | **بُعد** | أبعاد | تجميع | ✅ نعم |
| **OPEN-06** | عمق COA | **3 + Dimensions** | `parent_id` | — | ✅ نعم |
| **OPEN-10** | نسب العمولة | **غير متوفرة** | جداول جاهزة | — | ✅ **نعم — بيانات مطلوبة منكم** |
| **OPEN-11** | SoD: هل يُمنع SUPER_ADMIN من الأرصدة؟ | **نعم + دور FINANCE** | denies | فحص | ✅ **نعم — يغيّر تجربة الإدارة** |
| **OPEN-13** | تقنية الطابور | **Outbox + BullMQ** | `outbox_events` | Workers | ✅ نعم |
| **OPEN-14** | RPO/RTO | **<5s / <30min / 99.9%** | نسخ | — | ✅ **نعم — رفض لأرقام مصادركم** |
| **OPEN-16** | مدة Access Token | 15 دقيقة | — | — | ⚪ لا |
| **OPEN-17** | العميل يتبع وكيلًا؟ | علاقة تجارية لا هرمية | `parent_id` | عزل | ✅ نعم |
| **OPEN-18** | مهلة الحجز | **لا انتهاء آلي للمعلّق — تصعيد بشري** | `expires_at` | Worker | ✅ **نعم — حرج ماليًا** |
| **OPEN-19** | سياسة الاحتفاظ بالبيانات | غير محددة في أي مصدر | تقسيم | أرشفة | ✅ نعم |
| **OPEN-20** | تخزين تدقيق خارجي | لاحقًا | — | تصدير | ⚪ لا |

---

# القسم 33 — Architecture Decision Records

| ADR | العنوان | القرار | الحالة |
|---|---|---|---|
| **001** | Modular Monolith | وحدات بحدود صارمة + Workers مستقلة. **البديل المرفوض:** Microservices — يكسر ذرية المعاملات المالية ويزيد خطر الفروق | **PROPOSED** |
| **002** | الـLedger مصدر الحقيقة | كل رصيد Projection قابل لإعادة البناء. **البديل المرفوض:** أرصدة مخزّنة — يخلق مصدرين | **PROPOSED** |
| **003** | ترحيل `agent.balance` | Strangler على 4 مراحل، القطع في T2 قبل أي بناء فوقها | **PROPOSED** |
| **004** | Wallet Holds | طبقة تشغيلية منفصلة عن الـLedger. `Available = Ledger − Holds + Credit` | **PROPOSED** |
| **005** | بنية COA | 3 مستويات + Dimensions. **البديل المرفوض:** 5–6 مستويات — يخلط الهرمية التجارية بالمحاسبية | **PROPOSED** |
| **006** | Idempotency | مستويان منفصلان: Ledger (`source_id`) وExecution (`client_ref`) | **PROPOSED** |
| **007** | Provider Unknown Outcome | مصفوفة قدرات؛ لا Fallback عند الغموض؛ يدوي عند انعدام آلية الحسم | **PROPOSED** |
| **008** | Outbox | كل أثر خارجي عبر Outbox. **ممنوع** الاستدعاء داخل معاملة DB | **PROPOSED** |
| **009** | Price/FX Lock | تثبيت 6 حقول عند الحجز؛ الطابور لا يعيد التسعير | **PROPOSED** |
| **010** | دورة العمولة | CALCULATED→PENDING→HELD→SETTLED→PAID / REVERSED؛ عمولة واحدة لكل معاملة بقيد فريد | **PROPOSED** |
| **011** | RBAC + SoD | Deny-by-default + منع صريح يتفوق + Maker/Checker | **PROPOSED** |
| **012** | قواعد Offline | عرض ومسودة فقط؛ لا حالة `SUCCESS` محلية إطلاقًا | **PROPOSED** |
| **013** | تقنية الطابور | PostgreSQL Outbox + BullMQ. **البديل المرفوض:** Kafka — تعقيد بلا حاجة | **PROPOSED** |
| **014** | RPO/RTO | <5s / <30min / 99.9%. **رفض `RPO=0`** بتحليل اقتصادي | **PROPOSED** |
| **015** | تمثيل المال | `NUMERIC(20,4)` + `CHAR(3)`. **`FLOAT` ممنوع** | **PROPOSED** |

**كل الـADRs بحالة `PROPOSED` — لا شيء معتمد بلا موافقتكم.**

---

# القسم 34 — Implementation Order

| Phase | المتطلب المسبق | المخرجات | المخاطر | معيار الخروج |
|---|---|---|---|---|
| **0** Architecture Freeze | — | اعتماد ADRs + حسم OPEN | تغيير لاحق مكلف | كل ADR `APPROVED` |
| **1** PostgreSQL + Accounting | P0 | COA · قيود · فترات · عكس · تدقيق | خطأ في نموذج المال | Trial Balance متوازن · append-only بـTrigger |
| **2** Auth + RBAC + SoD | P1 | Argon2id · JWT · جلسات · أجهزة · SoD | ثغرة أمنية | صفر كلمة مرور بالكود · كل Endpoint محمي |
| **3** Wallet + Holds + **قطع `agent.balance`** | P1,P2 | Projections · حجوزات · ائتمان | **الأخطر** | مجموع المحافظ = التزامات GL · صفر كتابة مباشرة |
| **4** Hierarchy + KYC | P2 | شجرة · عزل · حدود | تعقيد الاستعلام | عزل شجري مُثبَت |
| **5** Transactions + Outbox + Workers | P3 | `client_ref` · آلة حالات · طابور | تنفيذ مزدوج | صفر ازدواج تحت ضغط متزامن |
| **6** Providers | P5 | Adapters · Routing · Health | بلا بيانات حقيقية | مزوّد واحد حقيقي يعمل |
| **7** Pricing + Commission | P3,P5 | شرائح · Waterfall · Margin Guard | هامش سالب | استحالة بيع بخسارة |
| **8** Fulfillment + WiFi | P5,P6 | محرك موحّد · قفل ذري | بيع مزدوج للقسيمة | قفل مُثبَت تحت تزامن |
| **9** Funding + Banks | P3,P5 | تغذية · webhooks · مطابقة بنكية | إيصال مكرر | منع الازدواج مُثبَت |
| **10** Support + Disputes + Notifications | P5 | تذاكر · نزاعات · إشعارات | — | استرداد كقيد عكسي حصرًا |
| **11** Reconciliation + Reports | P1–P9 | 6 طبقات · تقارير مالية | فروق غير مكتشفة | كشف تلقائي عامل |
| **12** DR/HA/Monitoring | الكل | نسخ · PITR · مراقبة | نسخة غير مُختبَرة | **استرجاع فعلي ناجح** |

**تعديل مقترح على الترتيب:** الأمن (P2) **قبل** المحافظ (P3) — لأن ترحيل الأرصدة بلا تدقيق وصلاحيات يعني ترحيلًا غير قابل للمراجعة.

---

# القسم 35 — FINAL READINESS CHECK

| المجال | الحالة | الدليل | Open |
|---|---|---|---|
| مصدر الحقيقة المالية | ✅ محسوم | §26 · ADR-002 | — |
| ازدواج مصدر الحقيقة | ⚠️ **قائم** | `agent.balance` ×7 مُتحقَّق | OPEN-04 |
| كل نطاق له مالك | ✅ | §3 — 18 نطاقًا | — |
| دوران التبعيات | ✅ منتفٍ | §3.1 | — |
| Idempotency لكل استدعاء خارجي | ✅ مُصمَّم | §9 · ADR-006 | — |
| تغيير مالي خارج الـLedger | ⚠️ **قائم في SPA** | §7 | OPEN-04 |
| كل حالة لها سجل تاريخي | ✅ | `transaction_status_history` | — |
| الأسرار مُدارة | ✅ | KMS · SPA خالٍ | — |
| صلاحية مالية بلا SoD | ✅ مُعالَج | §18 | OPEN-11 |
| تمثيل المال | ✅ | ADR-015 | OPEN-02 |
| الحجز | ✅ مُصمَّم | §6.3 | OPEN-18 |
| Outbox | ✅ | ADR-008 | — |
| المطابقة (6 طبقات) | ✅ | §23 | — |
| Offline | ✅ | §21 · ADR-012 | — |
| DR/HA | ⚠️ رفض لأرقام المصادر | §30 | OPEN-14 |
| بيانات المزوّدين | ❌ **محجوب خارجيًا** | 2/14 باقة | خارج سيطرتنا |
| APIs البنوك | ❌ **محجوب خارجيًا** | لا وثائق | خارج سيطرتنا |
| نسب العمولة | ❌ غير متوفرة | المصادر "توضيحية" | OPEN-10 |

## التحقق الذاتي

- ✅ كل متطلب في FR-01…FR-36 مغطى أو مصنَّف Later/Future
- ✅ لا نطاق بلا مالك
- ✅ لا رصيد بمصدرين **في التصميم المستهدف** (الازدواج الحالي مُشخَّص بخطة قطع)
- ✅ لا استدعاء خارجي بلا Idempotency + مطابقة
- ✅ لا تغيير مالي خارج الـLedger في التصميم
- ✅ لا حالة بلا سجل تاريخي
- ✅ لا سرّ بلا إدارة مفاتيح
- ✅ لا صلاحية مالية بلا SoD/موافقة
- ⚠️ **ما أضفتُه ولم يكن في المصادر** (مُعلَن صراحة): مصفوفة قدرات المزوّد (§10.3) · قاعدة منع Fallback عند الغموض (§10.4) · تحذير مهلة الحجز (§6.3) · Staleness levels (§21) · UUID v7 · `ProviderCapability` ككيان. **كلها اجتهاد معماري مبني على تحليل حالات الفشل، وتحتاج موافقتكم.**

---

# الحكم النهائي

**المعمارية جاهزة للانتقال إلى تصميم PostgreSQL — بشرط اعتماد `OPEN-02` و`OPEN-04` و`OPEN-06` أولًا.**

هذه الثلاثة تحديدًا **لا رجعة فيها**: تمثيل المال يدخل في كل جدول مالي · قطع `agent.balance` يجب أن يسبق أي بناء فوقها · بنية COA تحدد كل قيد لاحق. الباقي يمكن حسمه أثناء التنفيذ.

**ما هو محجوب خارجيًا (لا يمنع البدء):** بيانات المزوّدين · APIs البنوك · نسب العمولة. **المراحل 0–5 و7 و11 و12 لا تعتمد على أي منها.**

---

**لم يُعدَّل أي ملف. `spa_app.html` و`GAP_ANALYSIS.md` و`ARCHITECTURE_REVIEW_V2.md` كما هي.**
