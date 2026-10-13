# BACKEND_TECHNICAL_DESIGN — v1.0
## ALOMDA TEL · Phase 1 — Backend Implementation Blueprint (DESIGN ONLY)

**الحالة:** تصميم فقط — لا كود · لا قاعدة بيانات · لا migrations · لا SPA modifications
**المرجع المعماري النهائي:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` (ADR-101 → ADR-119)
**SPA المرجعي:** `spa_app-175.html` — SHA256 `7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1` — **لم يُمس في هذه المرحلة**
**التاريخ:** 2026-09-07

**قاعدة التعارض:** عند أي تعارض بين المصادر → **Architecture Freeze يحسم**. أي قرار غير محسوم فيه يُسجَّل `OPEN DECISION` **ولا يُبنى عليه تصميم نهائي**.
**قاعدة الاختراع:** صفر نسبة عمولة · صفر سعر · صفر تكلفة مزوّد · صفر سعر صرف · صفر بيانات بنكية · صفر بيانات اعتماد. كل قيمة غير موثقة توسم `UNKNOWN` / `CONFIGURATION` / `PLACEHOLDER`.

### الوثائق الشقيقة
| الملف | المحتوى |
|---|---|
| `POSTGRESQL_LOGICAL_SCHEMA_v1.0.md` | المخطط المنطقي جدولًا جدولًا |
| `BACKEND_API_CONTRACT_v1.0.md` | عقد الـAPI + نموذج الأخطاء |
| `MIGRATION_DESIGN_v1.0.md` | استراتيجية الترحيل من SPA |
| `BACKEND_DECISION_REGISTER.md` | سجل القرارات + مصفوفة التتبّع |

---

# 1. RUNTIME ARCHITECTURE

## 1.1 النمط المعتمد
**Modular Monolith + Workers** (ADR-119 · FROZEN).
- **عملية API واحدة** تحتوي كل الـModules بحدود صارمة.
- **عمليات Workers منفصلة** تشارك نفس قاعدة البيانات، ولا تشارك ذاكرة العملية.
- **ممنوع** Microservices الآن: النواة المالية تحتاج ذرية عبر النطاقات؛ Saga/تعويضات ترفع احتمال الفروق المالية، والحجم (~1.2 tps متوسطًا) لا يبرر التوزيع.

## 1.2 الطبقات
```
┌──────────────────────────────────────────────────────────────┐
│ API Layer            REST versioned · Auth · RBAC/ABAC ·      │
│                      Idempotency middleware · Rate limit      │
├──────────────────────────────────────────────────────────────┤
│ Application Services تنسيق فقط · حدود المعاملة · بلا منطق أعمال│
├──────────────────────────────────────────────────────────────┤
│ Domain Modules       D1…D14 · منطق الأعمال · Shared Kernel    │
├──────────────────────────────────────────────────────────────┤
│ Ports/Repositories   واجهات مجرّدة · لا SQL في الـDomain        │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure       PostgreSQL · Cache · Object Storage ·    │
│                      KMS · Provider Adapters · Notifiers      │
└──────────────────────────────────────────────────────────────┘
                              │  Outbox (نفس المعاملة)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Workers (عمليات مستقلة)                                       │
│  provider-execution · provider-status-poll · reconciliation   │
│  notifications · reports/export · settlement · projection-    │
│  rebuild · risk                                               │
└──────────────────────────────────────────────────────────────┘
```

## 1.3 لغة/منصة التشغيل
`PROJECT_HANDOFF §8` ينص على **«بناء Backend حقيقي (Node.js/PostgreSQL)»** — هذا المصدر الوحيد الذي يسمّي المنصة.
**القرار:** `PROPOSED` — Node.js + TypeScript + PostgreSQL. ليس `FROZEN` لأن Architecture Freeze لم يتناول اللغة.
> **`OPEN-BE-01`** — تثبيت المنصة واللغة رسميًا. لا يؤثر على أي قرار مالي، ويمكن حسمه في Phase 1A.

## 1.4 حدود المعاملة (Transaction Boundary) — غير قابلة للتفاوض
1. **لا استدعاء خارجي داخل معاملة قاعدة بيانات، أبدًا** (ADR-119). أي أثر خارجي يمرّ عبر Outbox.
2. المعاملة لا تتجاوز حدود قاعدة البيانات الواحدة.
3. عزل `READ COMMITTED` + أقفال صريحة (`FOR UPDATE` على المحافظ، `FOR UPDATE SKIP LOCKED` على الطابور/المخزون). **`SERIALIZABLE` مرفوض** — تكلفة بلا داعٍ عند هذا الحجم.
4. كل ما هو خارجي (مزوّد · بنك · SMS · WhatsApp) يُستدعى **بعد** الـCommit.

---

# 2. DOMAIN BOUNDARIES

## 2.1 مراجعة التقسيم المقترح (§3)
التقسيم المقترح في الطلب سليم في جوهره. **ثلاثة تعديلات مقترحة — لم تُطبَّق بصمت:**

### `ARCHITECTURAL PROPOSAL AP-01` — إبقاء Reconciliation منفصلًا عن Reporting
**المقترح:** `D14 Reconciliation / Reporting` مدمجان.
**الاقتراح:** فصلهما إلى `D14 Reconciliation` و`D15 Reporting`.
**السبب:** Reconciliation **يكتب** (`financial_discrepancies` · قيود تسوية · إغلاق الفترة) بينما Reporting **قراءة صرفة** (ADR-114/117). دمج كاتب مالي مع قارئ صرف داخل حد واحد يفقد أهم ضمانة في مصفوفة مصادر الحقيقة: «Reporting لا يكتب في أي نطاق».
**الحالة:** ✅ **ACCEPTED** (Phase 1.1 · §3 من التكليف) — مُعتمَد ومُطبَّق في هذه الوثيقة وفي المخطط وعقد الـAPI وسجل القرارات.

### `ARCHITECTURAL PROPOSAL AP-02` — فصل Notifications عن Operations
**المقترح:** الإشعارات ضمن `D12 Operations / Support`.
**الاقتراح:** `D16 Notifications` مستقل.
**السبب:** الإشعارات مستهلك Outbox عابر للنطاقات (معاملة · تغذية · عمولة · نزاع · أمن)، لا وظيفة داخل الدعم. وضعها في D12 يجبر كل نطاق آخر على الاعتماد على Operations — دورة اعتماد غير مبررة. `الرسائل النصية واتس اب.docx` يصفها كمحرك مستقل بـInbox/Outbox وDLR.
**الحالة:** ✅ **ACCEPTED** (Phase 1.1).

### `ARCHITECTURAL PROPOSAL AP-03` — `D11 Digital` يشمل WiFi كاستراتيجية
**المقترح:** `D11 Digital` منفصل، وWiFi غير مذكور.
**الاقتراح:** محرك تسليم رقمي **واحد** (`D11 Digital Fulfillment`) بـStrategies: `DirectId` · `PinPool` · `ApiPin` · `Manual` · `WifiVoucher`.
**السبب:** الاختلاف بينها في **كيفية الحصول على المنتَج** لا في دورة الحياة (حجز → تسليم → تسوية) وهي واحدة. `REVIEW_V2 §13` يصل لنفس النتيجة. §18 من طلبكم يقول صراحة: لا تكرر PIN Vault وSubscription PIN كنظامين.
WiFi يحتفظ بنطاق **إداري** خاص (شبكات · ملاك · تفويضات · تحصيل) داخل `D12 Operations`، بينما **بيع الكرت** يمرّ عبر D11.
**الحالة:** ✅ **ACCEPTED** (Phase 1.1).

### `ARCHITECTURAL PROPOSAL AP-04` — الأمن قبل المحافظ
**الاقتراح:** تنفيذ `1K Security/Audit` **قبل** `1E Wallet`.
**السبب:** لا حركة مالية ولا ترحيل أرصدة بلا `actor identity` + `authorization` + `audit context` + `correlation` + أساس Maker/Checker — وإلا فالترحيل غير قابل للمراجعة.
**شرط عدم الدوران (مُتحقَّق):** `D3 Security` **لا يعتمد على `D5 Wallet` ولا على `D4 Accounting`** لتنفيذ صلاحياته. يوفّر: الهوية · التفويض · سياق الفاعل · سياق التدقيق — ولا يقرأ رصيدًا ولا قيدًا.
**الاستثناء الوحيد:** `party_risk_metrics` (D3) تُغذّى من أحداث المعاملات والنزاعات — **عبر أحداث Outbox لا باستدعاء متزامن**، فلا تنشأ دورة.
**الحالة:** ✅ **ACCEPTED** (Phase 1.1 · §6 من التكليف) — الترتيب مُطبَّق في §30.

## 2.2 خريطة النطاقات النهائية (بعد المقترحات)
```
D1   Shared Kernel          Money · Currency · PartyRef · AccountRef · ClientRef
                            Result<T> · DomainEvent · Clock · IdGenerator(UUIDv7)
                            ◀ بلا منطق أعمال · بلا حالة · لا يعتمد على أحد

D2   Identity               parties · closure · KYC · limits · zones
D3   Security               auth · sessions · devices · RBAC/ABAC · SoD ·
                            Maker/Checker · risk
D4   Accounting             COA · journal · periods · FX · reversal   ◀ لا يستدعي أحدًا
D5   Wallet                 projections · holds · credit · insurance        → D4
D6   Funding                gateways · methods · claims · banks · webhooks   → D4,D5
D7   Catalog & Pricing      services · packages · zones · tiers · overrides
                            · FX · margin guard                             → D2
D8   Transaction            lifecycle · holds orchestration · outbox
     Orchestrator           · settlement                          → D4,D5,D7,D9
D9   Provider               adapters · routing · health · execution logs
                            ◀ لا يعرف D8 · يُستدعى ولا يستدعي
D10  Commission             policies · waterfall · accruals · settlement  → D4,D8
D11  Digital Fulfillment    inventory · PIN vault · strategies (incl. WiFi
                            voucher)                                       → D9
D12  Operations & Support   manual services · tickets · SLA · WiFi admin
D13  Disputes               dispute lifecycle · refund orchestration  → D4,D8,D10
D14  Reconciliation         4 layers · discrepancies · period close     → D4 (يكتب)
D15  Reporting              statements · TB · P&L · KPI · export  ◀ قراءة فقط
D16  Notifications          channels · templates · delivery · DLR   ◀ مستهلك Outbox
```

## 2.3 قواعد الحدود
| القاعدة | التفصيل |
|---|---|
| **الاتجاه نزولًا دائمًا** | D4 لا يستدعي أي نطاق. D1 لا يعتمد على شيء |
| **D9 لا يعرف D8** | يُستدعى، لا يستدعي. الرجوع عبر `ProviderExecutionCompleted` كحدث |
| **D15 قراءة فقط** | لا يكتب في أي جدول |
| **التواصل** | استدعاء مباشر نزولًا · `DomainEvent` صعودًا وعبر الحدود |
| **منع الدوران** | يُفرض بفحص ثابت في CI على مخطط الاستيراد بين المجلدات |
| **الوصول للبيانات** | كل نطاق يملك جداوله؛ **لا نطاق يقرأ جداول نطاق آخر مباشرة** — عبر Repository/Port فقط |

## 2.4 تصحيحات Phase 1.1 على قواعد الحدود

### C-01 · مكان فحص Maker/Checker — **تصحيح جوهري**
**التعارض المكتشَف:** `D4 Accounting` مُعرَّف بأنه «لا يستدعي أي نطاق»، لكن عكس قيد أو ترحيل يدوي يتطلب فحص موافقة من `D3 Security`. لو فحص D4 الموافقة لأصبح يستدعي D3 ⟹ **دورة**.
**التصحيح المعتمد:**
```
Application Service (طبقة التنسيق)
   1. يتحقق من الموافقة عبر D3   ← هنا فقط
   2. يفتح معاملة قاعدة البيانات
   3. يستدعي D4 بأمر مُصرَّح به مسبقًا (approval_request_id مُرفق كدليل)
```
**D4 لا يفحص صلاحية ولا موافقة إطلاقًا** — يستقبل أمرًا مُصرَّحًا به ويسجّل `approval_request_id` كبيانات إثبات فقط. **القاعدة تنطبق على كل نطاق مالي** (D5 · D6 · D10 · D14).

### C-02 · `party_risk_metrics` — اتجاه الاعتماد
`D3` يملك الجدول، لكنه **يُملأ من Worker يستهلك أحداث Outbox** من D8/D13. **لا استدعاء متزامن من D3 إلى D8.** الاتجاه: `D8 → (event) → D16/Worker → D3.write`.

### C-03 · ملكية الجداول العابرة
| الجدول | المالك المعتمد | السبب |
|---|---|---|
| `outbox_events` | **Platform (بنية تحتية · لا نطاق أعمال)** | يكتب فيه كل نطاق داخل معاملته؛ يقرؤه Worker واحد. جعله ملك نطاق واحد يخلق اعتمادًا وهميًا |
| `approval_requests` | **D3 Security** | يُقرأ من طبقة التنسيق فقط، لا من داخل النطاقات المالية |
| `financial_accounts` | **D6 Funding** *(كان D5)* | البنك/الصندوق مفهوم تغذية؛ D4 يستعمله بُعدًا فقط · D5 لا يملكه |
| `provider_webhook_events` | **D9 Provider** *(كان D6)* | حدث مزوّد لا حدث تغذية |
| `system_configuration` | **Platform** | قيم `CONFIGURATION` المشتركة — تغييرها المالي بـMaker/Checker |

---

# 3. الفصل الثلاثي الإلزامي (§4)

> هذا **أهم فصل في الوثيقة**. خلط أي اثنين منها يفسد كل تقرير مالي لاحق.

## A) Business Hierarchy — شجرة العلاقات التجارية
```
SUPER_ADMIN
   └── MASTER_AGENT
          └── AGENT
                 └── SUB_AGENT
                        └── POS
                               └── CUSTOMER
```
- **أين تعيش:** `parties.parent_id` + `party_closure`
- **من يملكها:** الإدارة التجارية
- **معدل التغيير:** يوميًا (إنشاء · نقل · تعطيل)
- **العمق:** `max_hierarchy_depth` = **CONFIGURATION** (لا رقم ثابت — ADR-112)
- **أثرها على القوائم المالية:** **صفر**
- **استعمالها:** التسعير · شلال العمولة · عزل الصلاحيات والتقارير

## B) Chart of Accounts Hierarchy — التصنيف المحاسبي
```
L1 العنصر     ASSET · LIABILITY · EQUITY · REVENUE · EXPENSE       (5)
L2 المجموعة   الأصول المتداولة · التزامات المحافظ · …                (11)
L3 الحساب     PARTY-WALLET-LIABILITY · PROVIDER-BALANCE · …        (24 postable)
```
- **أين تعيش:** `chart_of_accounts.parent_id`
- **من يملكها:** المحاسبة حصرًا
- **معدل التغيير:** نادر جدًا + موافقة
- **العمق:** **3 مستويات هيكلية ثابتة** (ADR-103) بترميز 6 خانات
- **أثرها على القوائم:** هي القوائم نفسها

## C) Financial Dimensions — المحاور التحليلية على سطر القيد
```
party_type · party_id · gateway_id · provider_id · provider_account_id
· zone_id · service_id · financial_account_id
```
- **أين تعيش:** أعمدة على `journal_entry_lines`
- **من يملؤها:** المعاملة تلقائيًا
- **معدل التغيير:** كل قيد
- **أثرها على القوائم:** صفر — تؤثر على **التقارير التحليلية والسجلات الفرعية**

## القاعدة غير القابلة للكسر
```
لا يُنشأ حساب في شجرة الحسابات لأي طرف — عميل أو وكيل أو مزوّد أو بنك — أبدًا.
إضافة 10,000 وكيل = صفر حساب جديد.
رصيد أي طرف = تجميع سطور القيد بالبُعد party_id، لا حساب باسمه.
```
**ملاحظة تنفيذية:** `currency_code` **ليس بُعدًا** — هو خاصية جوهرية للمبلغ، ويشارك في قيد التوازن.

---

# 4. MONEY MODEL (ADR-101 · ADR-102 · FROZEN)

## 4.1 العملات
| الرمز | الاسم | المنطقة | `rounding_scale` | ISO |
|---|---|---|---|---|
| `YER` | ريال يمني (إصدار جديد) | SOUTH | **0** | ✅ |
| `YEO` | ريال يمني (إصدار قديم) | NORTH | **0** | ❌ رمز داخلي |
| `SAR` | ريال سعودي | SA | 2 | ✅ |
| `USD` | دولار أمريكي | — | 2 | ✅ |

## 4.2 الدقة — ثلاث طبقات
| الطبقة | الدقة | القاعدة |
|---|---|---|
| **التخزين** | `NUMERIC(20,4)` | لكل مبلغ بلا استثناء. **`FLOAT`/`DOUBLE`/`REAL` ممنوعة منعًا باتًا** |
| **الحساب الوسيط** | 4 منازل | كل النسب والتحويلات قبل أي تقريب |
| **الترحيل** | `currency.rounding_scale` | **كل مبلغ يصبح سطر قيد يُقرَّب أولًا** |

## 4.3 التقريب
- **`HALF_UP` مبتعدًا عن الصفر** (`0.5 → 1` · `−0.5 → −1`). `HALF_EVEN` **مرفوض**.
- **تقسيم مبلغ (شلال العمولة):** **Largest Remainder Allocation** — حساب بـ4 منازل → تقريب لأسفل → توزيع الباقي وحدةً وحدةً تنازليًا حسب الكسر المتبقي؛ فض التعادل: **الأعمق في الشجرة أولًا ثم `party_id` تصاعديًا**. يضمن `Σ الحصص = الإجمالي` بالضبط → **لا حاجة لحساب فروق في التقسيم**.
- **`ROUNDING-DIFFERENCE`** يُستخدم **حصرًا** في: (1) طرف عملة التقرير في القيد المزدوج العملة، (2) تسوية فروق المطابقة تحت العتبة.

## 4.4 ازدواج العملة على السطر
كل سطر قيد يحمل:
`currency_code` + `debit`/`credit` (عملة المعاملة) **و** `reporting_currency_code` + `reporting_debit`/`reporting_credit` + `fx_rate_id`.
- **توازن القيد يُفحص على عملة المعاملة لكل عملة على حدة.** طرف عملة التقرير قد لا يتوازن بعد التقريب → يُعالَج بـ`ROUNDING-DIFFERENCE`.

> **`OPEN-BE-02` — ما هي عملة التقرير الأساسية؟**
> `شجرة الحسابات والقيود.docx` يفرض «عملة التقرير الأساسية» **دون تسميتها**. اختيار `YER` أو `USD` يغيّر كل قيمة في ميزان المراجعة الموحّد وكل حساب FX Gain/Loss.
> **لا يُخترع.** الأعمدة مصمَّمة وجاهزة؛ القيمة `UNKNOWN`. **يمنع إصدار قوائم مالية موحّدة حتى يُحسم.** لا يمنع بناء D4.

## 4.5 ممنوعات
- ❌ `2.94` كسعر صرف تشغيلي — `PLACEHOLDER` ميت (تحقُّق: صفر مستدعٍ في SPA).
- ❌ أي سعر صرف `YEO ↔ YER` مخترع — يأتي من `fx_rates` ببيانات حقيقية (`UNKNOWN` اليوم).
- ❌ اعتبار `gateway` عملة. `zone` يحدد العملة؛ `gateway` بُعد.

## 4.6 خريطة الاعتماد على عملة التقرير (`OPEN-BE-02` · Phase 1.1)

> **لا default. لا اختيار من طرفي.** المطلوب هنا: تحديد **أين بالضبط** تُستعمل، وإثبات أن جهلها **لا يعطّل النواة**.

### ما يعتمد عليها — محجوب حتى تُحسم
| المكان | الأثر |
|---|---|
| `journal_entry_lines.reporting_currency_code` · `reporting_debit` · `reporting_credit` | الأعمدة **تُبنى وتبقى `NULL`** |
| `mv_trial_balance` **الموحّد** (عبر العملات) | لا يُصدر |
| `mv_profit_and_loss` · `mv_balance_sheet` | لا يُصدران |
| `FX-GAIN` / `FX-LOSS` | لا تُحتسب إعادة تقييم |
| `ROUNDING-DIFFERENCE` (طرف عملة التقرير) | لا يُستعمل |
| إقفال الفترة (`accounting_periods.close`) | **محجوب** — لا إقفال بلا قوائم |
| `CAPITAL` · `RETAINED-EARNINGS` | حسابات بعملة التقرير — لا ترحيل عليها |

### ما **لا** يعتمد عليها — يُبنى ويعمل بالكامل
| المكوّن | لماذا يعمل |
|---|---|
| Money Engine · التقريب · Largest Remainder | يعمل على عملة المعاملة |
| COA (24 حسابًا · 3 مستويات · 8 أبعاد) | لا علاقة له بعملة التقرير |
| `postJournalEntry` وتوازنه | **التوازن يُفحص على عملة المعاملة لكل عملة على حدة** |
| العكس بالأبعاد | يعمل |
| Wallet · Projection · Holds · Available | كلها بعملة المعاملة |
| Transactions · Idempotency · Outbox | تعمل |
| Provider · Pricing · Commission | تعمل بعملة المعاملة |
| **ميزان مراجعة لكل عملة على حدة** | ✅ **يُصدر ويعمل** — هو المطلوب أصلًا في ADR-117 |

### الآلية المصمَّمة
`system_configuration['accounting.reporting_currency']` — قيمة واحدة، `UNKNOWN` اليوم.
- تغييرها **بعد وجود قيود بعملة تقرير محسوبة** = **تغيير كاسر** يتطلب إعادة تقييم كل سطر.
- لذلك: **تُضبط مرة واحدة قبل إقفال أول فترة، وتصبح immutable بعدها** (يُفرض بقيد).
- حتى تُضبط: كل الترحيل يستمر بعملة المعاملة، وأعمدة عملة التقرير `NULL`.

**الحالة:** `OPEN` — **لم يُوضع أي default.**

---

# 5. CHART OF ACCOUNTS (ADR-103 · FROZEN)

## 5.1 الترميز
```
D  GG  AAA        6 خانات
│  │   └── الحساب المُرحَّل عليه (L3)
│  └────── المجموعة (L2)
└───────── العنصر (L1)
```
السعة 6 خانات تُبقي مساحة لـL4 مستقبلًا **دون** استخدامه الآن — إضافته لاحقًا **إضافية وغير كاسرة**.

## 5.2 الحسابات الـ24 المُرحَّل عليها
| الكود | الحساب | العنصر | الرصيد الطبيعي | الأبعاد المسموحة | سياسة العملة |
|---|---|---|---|---|---|
| 111100 | `CASH` | Asset | مدين | `zone_id`, `financial_account_id` | متعددة |
| 111200 | `BANK` | Asset | مدين | `financial_account_id` | متعددة |
| 111300 | `FUNDING-CLEARING` | Asset | مدين | `gateway_id` | متعددة |
| 112100 | `PROVIDER-BALANCE` | Asset | مدين | `provider_id`, `provider_account_id` | متعددة |
| 113100 | `CUSTOMER-RECEIVABLE` | Asset | مدين | `party_type`, `party_id` | متعددة |
| 113200 | `PARTY-RECEIVABLE` | Asset | مدين | `party_type`, `party_id` | متعددة |
| 113300 | `PROVIDER-COMMISSION-RECEIVABLE` | Asset | مدين | `provider_id` | متعددة |
| 113400 | `PAYMENT-PROVIDER-SETTLEMENT-RECEIVABLE` | Asset | مدين | `provider_id`, `gateway_id` | متعددة |
| 114100 | `VOUCHER-INVENTORY` | Asset | مدين | `service_id` | متعددة |
| 211100 | `PARTY-WALLET-LIABILITY` | Liability | دائن | `party_type`, `party_id` | متعددة |
| 211200 | `CUSTOMER-WALLET-LIABILITY` | Liability | دائن | `party_type`, `party_id`, `gateway_id` | متعددة |
| 211300 | `INSURANCE-GUARANTEE-LIABILITY` | Liability | دائن | `party_type`, `party_id` | متعددة |
| 212100 | `COMMISSION-PAYABLE` | Liability | دائن | `party_type`, `party_id` | متعددة |
| 212200 | `UNMATCHED-DEPOSITS` | Liability | دائن | `gateway_id`, `financial_account_id` | متعددة |
| 311100 | `CAPITAL` | Equity | دائن | — | عملة التقرير |
| 312100 | `RETAINED-EARNINGS` | Equity | دائن | — | عملة التقرير |
| 313100 | `OPENING-BALANCE-SUSPENSE` | Equity | كلاهما | `party_type`, `party_id` | متعددة |
| 411000 | `SERVICE-REVENUE` | Revenue | دائن | `service_id`, `zone_id` | متعددة |
| 412000 | `PROVIDER-COMMISSION-REVENUE` | Revenue | دائن | `provider_id` | متعددة |
| 419000 | `FX-GAIN` | Revenue | دائن | `currency` ضمني | عملة التقرير |
| 511000 | `PROVIDER-SERVICE-COST` | Expense | مدين | `provider_id`, `service_id` | متعددة |
| 512000 | `COMMISSION-EXPENSE` | Expense | مدين | `party_type`, `party_id` | متعددة |
| 513000 | `WIFI-OWNER-SHARE-EXPENSE` | Expense | مدين | `party_type`, `party_id`, `service_id` | متعددة |
| 519000 | `FX-LOSS` / `ROUNDING-DIFFERENCE` | Expense | مدين | — | عملة التقرير |

> **`OPEN-BE-03`** — `ROUNDING-DIFFERENCE` كحساب مستقل أم بُعد على `FX-LOSS`/`FX-GAIN`؟ **الأثر منخفض وقابل للتراجع**؛ التوصية: حساب مستقل (`519100`) لوضوح التقارير. **لا يمنع البناء.**

## 5.3 سلوك الحساب
| الخاصية | القاعدة |
|---|---|
| **postable** | `is_postable = true` **⟺** `level = 3` (يُفرض بقيد) |
| **normal balance** | مشتق من `element` — لا يُخزَّن مكررًا، يُحسب عند العرض |
| **الأبعاد** | لكل حساب `allowed_dimensions[]` — الترحيل ببُعد غير مسموح **يُرفض** |
| **الأبعاد الإلزامية** | لكل حساب `required_dimensions[]` — ترحيل على `PARTY-WALLET-LIABILITY` بلا `party_id` **يُرفض** |
| **system-controlled** | `is_system = true` لكل الحسابات الـ24 — **لا تُحذف ولا يُعاد ترميزها ولا تُعطَّل** من أي واجهة |
| **manual posting** | `allows_manual_posting` — الافتراضي `false`. القيد اليدوي مسموح فقط على حسابات مؤشَّرة، ودائمًا بـMaker/Checker |
| **العملة** | معظم الحسابات متعددة العملات؛ حسابات حقوق الملكية والفروقات بعملة التقرير |

---

# 6. ACCOUNTING CORE (D4)

## 6.1 القيد
```
journal_entry (رأس)
  ├── entry_number      متسلسل بشري · فريد
  ├── period_id         الفترة المحاسبية
  ├── source_type       إلزامي
  ├── source_id         إلزامي   ← UNIQUE(source_type, source_id)  [Idempotency L2]
  ├── status            POSTED | REVERSED
  ├── reversal_of_entry_id / reversed_by_entry_id
  ├── created_by · created_at
  └── journal_entry_lines[]  (≥ 2)
        ├── account_id            (postable فقط)
        ├── currency_code · debit · credit
        ├── reporting_currency_code · reporting_debit · reporting_credit · fx_rate_id
        ├── 8 dimensions
        └── line_order
```

## 6.2 قواعد الترحيل — تُفرض في قاعدة البيانات لا في الكود وحده
1. **بوابة واحدة** لإنشاء أي قيد. لا مسار ثانٍ.
2. `source_type` + `source_id` إلزاميان — قيد بلا مصدر مرفوض.
3. **التوازن لكل عملة معاملة على حدة** — لا تجميع عبر العملات. يُفرض بـTrigger على مستوى القيد كاملًا (Deferred Constraint).
4. كل سطر: `debit ≥ 0 AND credit ≥ 0 AND NOT(debit>0 AND credit>0) AND NOT(debit=0 AND credit=0)`.
5. **كل تحقق قبل أي كتابة** — قيد مرفوض لا يترك أثرًا جزئيًا.
6. **لقطات ثابتة** لرمز واسم الحساب على السطر (إعادة التسمية لا تغيّر التاريخ).
7. **ممنوع الترحيل في فترة `CLOSED`** — Trigger.
8. البُعد يجب أن يكون ضمن `allowed_dimensions` وأن يشمل `required_dimensions`.

## 6.3 العكس (Reversal) — العلاقة والقاعدة
```
Original Entry (POSTED)
        │  reverseJournalEntry
        ▼
Reversal Entry (POSTED)
   • debit ↔ credit مقلوبان
   • كل الأبعاد الثمانية منسوخة حرفيًا   ← إلزامي
   • currency + reporting currency + fx_rate_id منسوخة
   • source_type = "JOURNAL_ENTRY_REVERSAL" (افتراضي) · source_id = original.id
        │
        ▼
Original.status = REVERSED · reversed_by_entry_id = reversal.id
Reversal.reversal_of_entry_id = original.id
```
**القاعدة الحاكمة:** سطر العكس **يجب** أن يحمل نفس `party_type`/`party_id`/`gateway_id`/`provider_id`/… — وإلا لا يصل العكس إلى أي سجل فرعي، والخطأ **صامت** (القيد يتوازن والحساب الرقابي سليم).
> هذا هو `BUG-1` الذي أُصلح في Phase 0.5 داخل الـSPA — **يجب ألا يُعاد إنتاجه في الـBackend.** يُفرض باختبار عقد إلزامي (`ADR-110`).

**قيود إضافية:**
- **عكس واحد لكل قيد** — `UNIQUE(reversal_of_entry_id)`.
- عكس قيد سبق عكسه **مرفوض**.
- عكس قيد في فترة مغلقة **مرفوض** — يُعالَج بقيد تسوية في فترة مفتوحة.
- العكس فوق حد مبلغ `CONFIGURATION` → **Maker/Checker إلزامي** (ADR-113).

## 6.4 منع التعديل والحذف
| الجدول | السياسة |
|---|---|
| `journal_entries` · `journal_entry_lines` | **APPEND-ONLY** — Trigger يرفض `UPDATE`/`DELETE`. الاستثناء الوحيد: حقلا الربط `status`/`reversed_by_entry_id` على الرأس، عبر إجراء مُحكَم واحد |
| التصحيح | **REVERSAL** (إلغاء كامل) أو **ADJUSTMENT** (قيد تسوية جديد). **لا حذف، لا تعديل مبلغ** |
| الصلاحية | العكس والتسوية يتطلبان صلاحية + سبب نصي إلزامي + قيد تدقيق |

## 6.5 الفترات المحاسبية
`OPEN` → `CLOSING` → `CLOSED`
- لا ترحيل في فترة `CLOSED`.
- **لا إقفال وفيها فرق مطابقة مفتوح** (ADR-114).
- الإقفال: إقفال الحسابات المؤقتة (4 و5) → الصافي إلى `RETAINED-EARNINGS` → تدوير الأرصدة الدائمة.
- إعادة الفتح: صلاحية + Maker/Checker + قيد تدقيق.
> **`OPEN-BE-04`** — طول الفترة (شهرية/ربعية) والتقويم المستخدم. `CONFIGURATION` — لا يمنع البناء.

---

# 7. PARTY WALLET (D5 · ADR-104 · ADR-105)

## 7.1 مصدر الحقيقة
```
مصدر الحقيقة الوحيد لأي رصيد =  journal_entry_lines

❌ agent.balance            ❌ providerAccount.balance
❌ ownerEntity.balance      ❌ WALLET_LEDGER
```
كلها **لا تُنقل** كسلطة مالية. `WALLET_LEDGER` يُستورد أرشيفًا للقراءة فقط (`MIGRATION_DESIGN`).

## 7.2 المعادلة
```
Ledger Balance = Σ(credit) − Σ(debit)   على حساب المحفظة، مُرشَّحًا بالأبعاد والعملة
Held           = Σ(amount)              من wallet_holds حيث status = ACTIVE
Credit         = credit_limits.limit_amount  للطرف/العملة
Available      = Ledger Balance − Held + Credit
```
**«Reserved» مصطلح مُلغى** (ADR-105). الحجز المالي اسمه `HOLD`؛ حجز المخزون اسمه `INVENTORY_LOCK` — نطاق ومكانيزم مختلفان.

## 7.3 الـProjection
`party_wallet_projection` — جدول قابل للتحديث لكنه **Projection بحت**:
- يُكتب **فقط** من محدِّث الـProjection، **داخل نفس معاملة القيد** الذي سبّبه.
- **صفر مسار أعمال يكتب فيه مباشرة** — يُفرض بمراجعة معمارية + فحص CI.
- **قابل لإعادة البناء الكامل** من `journal_entry_lines` في أي لحظة (Worker مخصص).
- المطابقة اليومية (طبقة 1) تفتح `financial_discrepancy` تلقائيًا عند أي فرق.
- **القراءة السريعة تأتي منه؛ القرار المالي (الحجز) يأتي من الـLedger داخل قفل الصف.**

## 7.4 أنواع المحافظ
| النوع | الحساب الرقابي | سالب مسموح؟ |
|---|---|---|
| `MAIN` | `PARTY-WALLET-LIABILITY` | ✅ حتى `credit_limit` فقط |
| `MAIN` (عميل) | `CUSTOMER-WALLET-LIABILITY` + بُعد `gateway_id` | ❌ |
| `INSURANCE` | `INSURANCE-GUARANTEE-LIABILITY` | ❌ · غير قابل للإنفاق المباشر |
| `COMMISSION` | `COMMISSION-PAYABLE` | ❌ · غير قابل للإنفاق حتى التسوية |
| Provider | `PROVIDER-BALANCE` (أصل) | ⚠️ سالب = إنذار فوري |

## 7.5 التأمين والائتمان
- نقل من `MAIN` إلى `INSURANCE` = **قيد حقيقي** بين حسابين، لا تحوير حقل.
- `INSURANCE` **لا يُدرج في `Available`** للشراء — هو ضمان يوسّع `credit_limit` وفق سياسة.
- **فك التأمين** يتطلب: صفر معاملة معلّقة · صفر نزاع مفتوح · سداد كامل المكشوف · نافذة مراجعة (`CONFIGURATION`).
> **`OPEN-BE-05`** — نسبة السماح بالسحب على المكشوف مقابل التأمين. `التأمينات للعملاء.docx` يذكر «80%» **كمثال**؛ لا يُعتمد كسياسة. `CONFIGURATION`.

## 7.6 نموذج الائتمان في v1 — تصحيح Phase 1.1

**المعادلة `Available = Ledger − Held + Credit` مُجمَّدة (ADR-105) ولا تُمس.**
لكن **منح الائتمان لم يُحسم كسياسة** في أي مصدر. لذلك — **بلا اختراع**:

| البند | v1 |
|---|---|
| المعادلة | كما هي — **FROZEN** |
| `credit_limits.limit_amount` | **الافتراضي `0` لكل طرف** — الحد يُدخَل يدويًا فقط بـMaker/Checker |
| أثر ذلك على `Available` في v1 | `Available = Ledger − Held` فعليًا (لأن `Credit = 0`) |
| **دورة منح الائتمان** (تقييم · سقف · استحقاق · تحصيل · مكشوف مقابل تأمين) | **`FUTURE`** — لم تُصمَّم ولا تُبنى في v1 |
| `party_financial_limits.is_credit_allowed` | الافتراضي `false` |

**لم يُخترع نموذج ائتمان.** الجدول موجود لأن المعادلة المجمَّدة تتطلبه؛ السياسة `FUTURE`.

## 7.7 Party Currency — تصميم صريح (`B-3` · Phase 1.1)

> §9 من التكليف. كل بند أدناه إما **مُستنَد إلى ADR-101** أو **`OPEN` صراحةً**.

### أين تُخزَّن
| المستوى | الحقل | الطبيعة |
|---|---|---|
| العملة الافتراضية للطرف | `parties.default_currency_code` **NOT NULL** | مشتقة من `zones.base_currency_code` عند الإنشاء |
| المحفظة الفعلية | `party_wallet_projection(party_id, currency_code, wallet_kind)` | **المفتاح يتضمن العملة** ⟹ تعدد العملات مدعوم بنيويًا |
| الحقيقة المالية | `journal_entry_lines.currency_code` + بُعد `party_id` | **المصدر الوحيد** — الجدولان أعلاه مشتقان/مرجعيان |

### هل العملة immutable بعد وجود حركة؟
**نعم — قرار مشتق مباشرة من ADR-101 وADR-102، لا اختراع فيه.**
```
تغيير default_currency_code لطرف له أي سطر قيد
  ⟹ مرفوض (Trigger + قاعدة تطبيق)
السبب: الرصيد التاريخي مُقوَّم بعملة محددة؛ تغيير التسمية يعيد تفسير أرقام
       سابقة بأثر رجعي — وهو نوع من تعديل التاريخ المالي (ممنوع · ADR-118).
البديل المشروع: فتح محفظة بعملة أخرى (صف جديد في الـProjection) —
       لا تغيير للقديمة.
```

### ماذا يحدث عند محاولة التغيير
`VALIDATION_ERROR` مع سبب صريح `PARTY_CURRENCY_IMMUTABLE_AFTER_MOVEMENT`. لا مسار تجاوز، ولا حتى بـMaker/Checker — **لأن التصحيح الصحيح قيد تسوية، لا إعادة تسمية.**

### هل يمكن للطرف امتلاك أكثر من عملة؟
**نعم — بنيويًا.** ADR-101 ينص حرفيًا: «طرف يعمل في منطقتين = **محفظتان بعملتين**، لا محفظة واحدة بعملتين».
- التنفيذ: **Sub-wallets** = صفوف مستقلة في `party_wallet_projection` لكل `(currency_code, wallet_kind)`.
- كل محفظة لها `Ledger` و`Held` و`Available` مستقلة. **لا تجميع عبر العملات إطلاقًا.**
- التحويل بين محفظتَي الطرف نفسه = **معاملة صرف حقيقية** بقيد وسعر `fx_rates` — لا نقل داخلي صامت.

> **`OPEN-BE-17` (جديد · Phase 1.1) — هل يجوز للطرف الانتماء لأكثر من منطقة؟**
> ADR-101 يضع `party → zone` مفردة. تعدد المحافظ مدعوم بنيويًا، لكن **الشرط التجاري الذي يسمح بفتح محفظة بعملة ثانية غير محسوم في أي مصدر**.
> **لم أخترع قاعدة.** v1: محفظة واحدة بعملة المنطقة؛ فتح محفظة ثانية **مسار إداري معطَّل حتى تُحسم السياسة**.

### علاقة Gateway بالعملة — القاعدة المعكوسة الممنوعة
```
✅ الصحيح:   zone   →  يحدد  →  base_currency  →  عملة محفظة الطرف
✅ الصحيح:   gateway →  بُعد تحليلي على سطر القيد
❌ الممنوع:  gateway →  يحدد  →  currency
```
**`gateways.default_currency_code` موجود كـ«عملة العرض الافتراضية للبوابة» فقط** — **لا يُستعمل إطلاقًا لاشتقاق عملة طرف ولا عملة قيد.** عملة القيد تأتي دائمًا من عملة محفظة الطرف أو من عملة تكلفة المزوّد.
> **قاعدة فحص إلزامية في CI:** أي كود يقرأ `gateway.default_currency_code` لاشتقاق عملة قيد **يُرفض**.

---

# 8. HOLDS (D5)

## 8.1 الطبيعة
**الحجز عملية تشغيلية — وليس قيدًا محاسبيًا.**
| السبب | التفصيل |
|---|---|
| لا يغيّر ما ندين به | يبدّل ما يمكن إنفاقه، لا الالتزام نفسه |
| يفسد ميزان المراجعة | يتطلب حسابًا مقابلًا يجعل القوائم تابعة لحالة تشغيلية لحظية |
| يضاعف الكتابات | قيدان إضافيان لكل معاملة بلا معنى محاسبي |
| العرض الصحيح | `Held` يُعرض كإفصاح في كشف الحساب، لا كحركة |

## 8.2 الكيان
`wallet_holds`: `party_id` · `wallet_kind` · `amount` · `currency_code` · `transaction_id` (**UNIQUE**) · `status` · `reason` · `created_at` · `released_at` · `release_reason` · `expires_at` (شرطي).

## 8.3 دورة الحياة
```
ACTIVE ──┬──> CAPTURED   عند SETTLED — في نفس معاملة القيد
         ├──> RELEASED   عند FAILED نهائي مؤكد — في نفس المعاملة
         └──> EXPIRED    ⚠️ فقط للمعاملة التي لم تُرسل للمزوّد قط
```

## 8.4 دلالات انتهاء الصلاحية — قاعدة حرجة
```
معاملة في CREATED أو VALIDATED (لم تُرسل للمزوّد)
      → expires_at مسموح · إفراج آلي آمن · CONFIGURATION

معاملة في QUEUED / PROCESSING / PENDING_PROVIDER / MANUAL_RESOLUTION
      → expires_at = NULL إلزاميًا
      → لا إفراج آلي إطلاقًا، مهما طال الزمن
      → التصعيد البشري هو المخرج الوحيد
```
**السبب:** إفراج بمهلة ثم عودة المزوّد بالنجاح = خدمة سُلِّمت بلا خصم. **الإفراج بنتيجة مؤكدة فقط.**

## 8.5 التزامن
```
BEGIN
  SELECT … FROM party_wallet_projection WHERE party_id=? AND currency=? FOR UPDATE
  احسب Available من الـLedger (لا من الـProjection وحدها)
  إن كفى → INSERT wallet_holds (UNIQUE على transaction_id يمنع الازدواج)
COMMIT
```

---

# 9. TRANSACTION ENGINE (D8)

## 9.1 آلة الحالات (ADR-107 · FROZEN)
```
CREATED ──> VALIDATED ──┬──> EXPIRED            (لم تُرسل قط)
                        │
        requires_hold?  ├── true ──> HELD ──┐
                        └── false ──────────┴──> QUEUED ──> PROCESSING
                                                                │
              ┌─────────────────────────────────────────────────┼──────────────┐
              ▼                          ▼                                     ▼
          SUCCESS                     FAILED                          PENDING_PROVIDER
              │                    (نهائية · الحجز                            │
              ▼                     يُفرج في نفس المعاملة)      ┌──────────────┴────────┐
          SETTLED                                              ▼                       ▼
              │                                        SUCCESS / FAILED      MANUAL_RESOLUTION
              ▼                                        (بطريقة حسم قاطعة)            │
          REVERSED                                                          SUCCESS / FAILED
```

## 9.2 الفروق الجوهرية
```
SUCCESS  ≠  SETTLED
  SUCCESS = المزوّد أكّد التسليم (قد يصل عبر webhook/worker لاحقًا)
  SETTLED = القيود رُحِّلت + العمولة استُحقّت + الحجز أُغلق (معاملة DB واحدة قابلة لإعادة المحاولة)

TIMEOUT  ≠  FAILED
  TIMEOUT = PENDING_PROVIDER — الحجز باقٍ — لا إفراج — لا إعادة تنفيذ
```

## 9.3 الانتقالات المحظورة — تُفرض بـTrigger
```
SETTLED  → أي شيء عدا REVERSED
FAILED   → SUCCESS            (لا إحياء لمعاملة فاشلة)
SUCCESS  → FAILED
أي قفزة تتخطى HELD حين requires_hold = true
أي انتقال بلا صف في transaction_status_history
```

## 9.4 التسلسل التنفيذي
| # | الخطوة | ما يحدث | ما لا يحدث |
|---|---|---|---|
| 1 | `CREATED` | تسجيل `client_ref` · `UNIQUE(party_id, client_ref)` | لا استدعاء |
| 2 | `VALIDATED` | الطرف نشط · ضمن الحدود · الخدمة متاحة · **التسعير الكامل + Margin Guard** · تثبيت 8 حقول Lock | لا حجز بعد |
| 3 | `HELD` | `FOR UPDATE` على المحفظة → فحص `Available` → `INSERT wallet_holds` | **لا قيد محاسبي** |
| 4 | `QUEUED` | معاملة واحدة: تحديث الحالة + `INSERT outbox_events` | **لا استدعاء خارجي** |
| 5 | `PROCESSING` | Worker: `FOR UPDATE SKIP LOCKED` + `WHERE status='QUEUED'` → `INSERT provider_execution(status=SENT)` + **COMMIT** → ثم يستدعي المزوّد | — |
| 6 | الحسم | `SUCCESS` / `FAILED` / `PENDING_PROVIDER` | — |
| 7 | `SETTLED` | معاملة واحدة: القيود (1)(2)(3) + `hold → CAPTURED` + تحديث Projection + `outbox` إشعار | — |
| 8 | `REVERSED` | عبر D13 Disputes حصرًا · قيود عكسية بالأبعاد · عكس العمولة · Maker/Checker | لا حذف |

## 9.5 القيود المحاسبية عند `SETTLED` (نموذج `NET` · ADR-110)
```
(1)  Dr PARTY-WALLET-LIABILITY  [party=buyer]            locked_customer_price
         Cr SERVICE-REVENUE     [service, zone]                locked_customer_price
(2)  Dr PROVIDER-SERVICE-COST   [provider, service]      locked_provider_cost
         Cr PROVIDER-BALANCE    [provider, provider_account]   locked_provider_cost
(3)  Dr COMMISSION-EXPENSE      [party=each beneficiary] commission_plan[i]
         Cr COMMISSION-PAYABLE  [party=each beneficiary]       commission_plan[i]
```
**System Margin = Revenue − Cost − Σ Commission — رقم مشتق في قائمة الدخل، وليس حسابًا يُرحَّل عليه.**

نموذج `GROSS_PLUS_COMMISSION`: القيد (2) بالقيمة الكاملة + قيد `Dr PROVIDER-COMMISSION-RECEIVABLE / Cr PROVIDER-COMMISSION-REVENUE`. **الاقتصاد ذاته، توقيت نقدي مختلف.**

## 9.6 معاملات بلا حجز
`requires_hold = false` للاستعلامات (فحص رصيد · استعلام فاتورة · التحقق من Player ID). تسير `CREATED → VALIDATED → QUEUED → PROCESSING → SUCCESS/FAILED` بلا `HELD` وبلا قيد.

---

# 10. IDEMPOTENCY — أربع طبقات (ADR-108 · FROZEN)

| # | الطبقة | المفتاح | الجدول | القيد المنطقي | تمنع |
|---|---|---|---|---|---|
| **1** | Client Request | `client_ref` (UUIDv7 يولّده العميل **قبل** الإرسال) | `transactions` | `UNIQUE(party_id, client_ref)` | طلبًا مزدوجًا من العميل |
| **2** | Ledger | `(source_type, source_id)` | `journal_entries` | `UNIQUE(source_type, source_id)` | قيدًا مزدوجًا |
| **3** | Provider Execution | `provider_request_id` (= `transaction_id`) | `provider_executions` | `UNIQUE(provider_id, provider_request_id)` | **تنفيذًا خارجيًا مزدوجًا** |
| **4** | Webhook | `provider_event_id` من المزوّد | `provider_webhook_events` | `UNIQUE(provider_id, provider_event_id)` | معالجة إشعار مكرر |

## 10.1 سلوك الإعادة (Replay)
- **الطبقة 1:** طلب بنفس `client_ref` → **إرجاع النتيجة المخزَّنة كما هي** (نفس رمز الحالة، نفس الجسم) بلا أي تنفيذ. لا يُعتبر خطأ.
- **تعارض:** نفس `client_ref` بجسم طلب **مختلف** (بصمة `request_hash` مختلفة) → `IDEMPOTENCY_CONFLICT` (409). لا تنفيذ.
- **الطبقة 2:** استدعاء ترحيل ثانٍ لنفس المصدر → يُرجع القيد نفسه مع `duplicate: true`.
- **الطبقة 3:** `SENT` يُكتب ويُلتزم **قبل** الاستدعاء. انهيار بين الخطوتين → Worker يجد `SENT` معلقًا → **يستعلم، لا يعيد**.
- **الطبقة 4:** `INSERT` أولًا؛ عند تعارض المفتاح → **ACK فورًا وتوقف**، لا معالجة.

## 10.2 سلوك إعادة المحاولة (Retry)
| الحالة | إعادة المحاولة |
|---|---|
| `temporary_failure` · `retry_later` | ✅ مسموحة بتراجع أسّي · `max_retries` من إعداد المزوّد |
| `unknown` · `pending` | ❌ **ممنوعة قطعًا** |
| `failed` · `rejected` · `invalid_number` | ❌ لا معنى لها — رد قاطع |
| فشل شبكي قبل كتابة `SENT` | ✅ المعاملة لم تُرسل بعد — إعادة آمنة |
| فشل شبكي بعد كتابة `SENT` | ❌ → `PENDING_PROVIDER` → استعلام |

## 10.3 حماية إعادة الإرسال (Replay Protection) للـWebhook
طبقة مستقلة **فوق** الطبقة 4: تحقق توقيع `HMAC` + نافذة زمنية `webhook_max_skew_seconds` (`CONFIGURATION`) + `nonce`. خارج النافذة → **رفض بلا معالجة** + حدث أمني.

---

# 11. PROVIDER EXECUTION (D9)

## 11.1 عقد الـAdapter
```
execute(request)      → StandardExecutionResult      [إلزامي]
queryStatus(ref)      → StandardExecutionResult      [شرطي — §11.4]
cancel(ref)           → StandardExecutionResult      [اختياري]
getBalance(account)   → Money                        [اختياري]
validateTarget(input) → TargetInfo                   [اختياري — Player ID lookup]
reconcile(period)     → SettlementFile               [اختياري]
```
- **البروتوكول لا يتسرب إلى النواة إطلاقًا.** النواة تعرف `execute → StandardResult` فقط.
- **عائلات:** `Rest` · `Soap` · `Smpp` · `Ussd` · `GsmModem` (من `المرحله 3 — المزودين والربط.docx`).
- **لا يُفترض أن كل مزوّد يدعم كل شيء** — القدرات معلنة في `providers.capabilities`.

## 11.2 الحالات المعيارية (11 — تُنقل من الـSPA كما هي)
`pending` · `success` · `rejected` · `failed` · `requires_gateway_switch` · `temporary_failure` · `retry_later` · `invalid_number` · `insufficient_provider_balance` · `maintenance` · `unknown`

**قاعدة التطبيع:** أي كود غير معروف → **`unknown`**. ممنوع تحويله إلى `success` (خطر مالي) أو إلى `failed` (ادّعاء رفض مفهوم لم يحدث).
جدول ترجمة أكواد لكل مزوّد — إضافة مزوّد **لا تعدّل محرك التوجيه**.

## 11.3 مصفوفة القدرات (إلزامية لكل مزوّد)
`can_query_status` · `sends_webhook` · `provides_settlement_file` · `has_contractual_timeout_rule` · `accepts_idempotency_key` · `can_cancel` · `can_get_balance`

## 11.4 حسم الغموض (Unknown Outcome) — ADR-109
| # | الطريقة | قاطعة؟ | الشرط |
|---|---|---|---|
| 1 | `queryStatus` بمرجعنا | ✅ | المزوّد يوفر استعلامًا |
| 2 | Webhook/Callback متأخر | ✅ | توقيع متحقَّق + `provider_event_id` |
| 3 | ملف تسوية/كشف دوري | ✅ | مطابقة بالمرجع |
| 4 | قاعدة تعاقدية للمهلة | ✅ | **فقط** بنص عقدي صريح · `CONFIGURATION` لكل مزوّد · **ممنوعة كافتراض عام** |
| 5 | فرق رصيدنا لدى المزوّد | ⚠️ ظنّية | فقط عند تسلسل الطلبات — لا تصلح تحت التزامن |
| 6 | التحقق من المستفيد النهائي | ⚠️ ظنّية | فقط حيث الأثر مرصود وغير ملتبس |
| 7 | حسم بشري بتذكرة | ✅ | دليل مرفق + `MANUAL_RESOLUTION` + تدقيق |

**بوابة التفعيل:**
```
مزوّد بلا أي طريقة قاطعة (1 أو 2 أو 3 أو 4)
   ⟹ ممنوع من التنفيذ الآلي — يُوجَّه إلى مسار يدوي حصرًا
```

**ممنوع منعًا باتًا عند الغموض:**
- ❌ إعادة التنفيذ (Retry) — قد ينتج خصمًا مزدوجًا حقيقيًا.
- ❌ التوجيه لمزوّد بديل (Fallback) — قد ينتج تسليمًا مزدوجًا.
- ❌ اعتبار المهلة فشلًا بلا قاعدة تعاقدية.
- ❌ **الإفراج عن الحجز.**

**رد متأخر بعد الحسم اليدوي:** يُسجَّل، **لا يغيّر الحالة تلقائيًا**، ويفتح `financial_discrepancy`.

## 11.5 التوجيه
```
منطقة المشتري → الخدمة مربوطة؟ → المزوّد نشط؟ → Circuit CLOSED؟
→ رصيد المزوّد كافٍ للتكلفة؟ → الأولوية → التكلفة الأدنى
```
- **Circuit Breaker:** `CLOSED → OPEN → HALF_OPEN` — العتبات `CONFIGURATION`.
- **Fallback مسموح فقط عند رد قاطع بالفشل.**
- **فحص رصيد المزوّد قبل التوجيه** (`التسعير.docx`: `Gateway Balance >= Service Cost`).

## 11.6 المحاكيات (§31)
`mockProviderAdapterExecute` في الـSPA **ليس مزوّدًا**.
- `providers.provider_kind ∈ { REAL, SIMULATOR }`.
- **قيد إلزامي:** مزوّد `SIMULATOR` **لا يمكن ربطه بـ`provider_mapping` نشط في بيئة الإنتاج** — يُفرض بقيد بيئي + فحص عند التفعيل.
- المحاكي أداة اختبار وتطوير فقط، ولا يدخل أي مسار مالي إنتاجي.

---

# 12. PROVIDER REQUEST LOG (D9)

`provider_executions` — **APPEND-ONLY**:
`transaction_id` · `provider_id` · `provider_account_id` · `provider_request_id` · `adapter_key` · `operation` (`EXECUTE`/`QUERY`/`CANCEL`) · `requested_at` · `sent_at` · `responded_at` · `duration_ms` · `status` · `normalized_status` · `provider_reference` · `provider_raw_code` · `timeout_ms` · `attempt_no` · `request_payload_redacted` · `response_payload_redacted` · `error_class`

**قواعد:**
- `UNIQUE(provider_id, provider_request_id, operation, attempt_no)`.
- صف `SENT` **يُكتب ويُلتزم قبل** الاستدعاء.
- **الأسرار وأكواد القسائم لا تُسجَّل إطلاقًا** — تنقيح إلزامي (`redaction`) بقائمة حقول محظورة + بصمة `SHA-256` عند الحاجة للمقارنة.
- `provider_credentials` تحمل **مرجع KMS فقط** — لا سرّ في قاعدة البيانات ولا في أي سجل.

---

# 13. CATALOG & PRICING (D7 · ADR-111)

## 13.1 ترتيب الحسم
```
[0] Zone(buyer)   ─────────────▶ يحدد عملة البيع
[1] Provider Cost  ← من provider_mappings حصرًا · لا يُشتق من سعر العميل أبدًا
[2] Base Price (Service)
[3] Zone Adjustment
[4] Pricing Group / Tier (شريحة المشتري)
[5] Hierarchy Distribution (أسعار/عمولات كل سلف)
[6] Custom Override ← أعلى أولوية · صلاحية + تدقيق + انتهاء صلاحية
[7] FX Conversion   ← فقط إذا cost_currency ≠ sale_currency
[8] ═══ MARGIN GUARD ═══  بوابة إلزامية
[9] Customer Price + Commission Plan + System Margin (مشتق)
```
**الأخص يفوز:** `Override` > `Tier` > `Zone` > `Base`.

## 13.2 Margin Guard
```
Customer Price − Provider Cost(محوَّلة) − Σ(كل العمولات) ≥ MIN_MARGIN
```
- `MIN_MARGIN` = **CONFIGURATION** (الافتراض المقترح `0`). **لا رقم مخترع.**
- **يُفحص مرتين:** عند حفظ السياسة (يمنع تهيئة خاطئة) **و** عند `VALIDATED`/`HELD` (يمنع تنفيذ خاطئ).
- التجاوز: سياسة استثناء صريحة + صلاحية `pricing:override_margin` + Maker/Checker + قيد تدقيق.
- قاعدة إضافية (`مرحله 8.docx`): **لا يجوز لأي موزع تسعير شريحة تابعة تحت تكلفته الخاصة.**

## 13.3 القفل عند `HELD` — الحقول الثمانية
`locked_customer_price` · `locked_provider_cost` · `locked_cost_currency` · `locked_fx_rate` + `fx_rate_id` · `locked_currency` · `pricing_rule_version` · `commission_policy_version` · `ancestor_chain_snapshot`

**الطابور لا يعيد التسعير أبدًا.**

## 13.4 عرض السعر (Quote)
`quote_expires_at` = `CONFIGURATION`. إن تغيّر سعر الصرف بين العرض والتأكيد بأكثر من `slippage_tolerance_pct` (`CONFIGURATION`) → **إعادة تأكيد إلزامية** (`شحن الالعاب.docx`).

> **`OPEN-BE-06`** — كل قيمة تسعير: `MIN_MARGIN` · `quote_ttl` · `slippage_tolerance_pct` · أسعار الشرائح · أسعار الخدمات = **UNKNOWN / CONFIGURATION**. الجداول جاهزة؛ **لا يمكن تشغيل التسعير بلا بيانات حقيقية.**

---

# 14. COMMISSION (D10 · ADR-106)

## 14.1 الفصل النهائي
```
الهامش   = تسعير  (شريحة / تجاوز)         → يُخفّض ما يدفعه الطرف
العمولة  = التزام (COMMISSION-PAYABLE)     → يُضاف لما نَدين به للطرف

ممنوع الدفع من الطريقين لنفس الطرف عن نفس المعاملة — يُفرض بفحص في محرك التسعير.
```
**«Instant Margin» ليس آلية عمولة** — يُعاد إنتاجه بضبط شريحة الطرف السعرية. النموذج الوحيد المعتمد هو **Commission Wallet**.

## 14.2 دورة الحياة
```
CALCULATED → ACCRUED → HELD → SETTLED → PAID
                 └───────┴───────┴────→ REVERSED
```
| الانتقال | الأثر المحاسبي |
|---|---|
| `ACCRUED` (عند `SETTLED` للمعاملة) | `Dr COMMISSION-EXPENSE [party] / Cr COMMISSION-PAYABLE [party]` |
| `HELD` | **لا قيد** — علامة حالة أثناء نافذة النزاع (`dispute_window_days` = `CONFIGURATION`) |
| `SETTLED` | `Dr COMMISSION-PAYABLE [party] / Cr PARTY-WALLET-LIABILITY [party]` |
| `PAID` | `Dr COMMISSION-PAYABLE [party] / Cr BANK [financial_account]` |
| `REVERSED` | قيد عكسي كامل بالأبعاد — **لا حذف** |

## 14.3 الشلال الهرمي
- يصعد من المنفّذ إلى الجذر بحد `max_hierarchy_depth`.
- يستخدم **`ancestor_chain_snapshot`** المثبَّت على المعاملة — **إعادة هيكلة الشجرة لاحقًا لا تمسّ استحقاقًا سابقًا**.
- **Largest Remainder Allocation** يضمن `Σ الحصص = المجمّع القابل للتوزيع` بالضبط.
- `UNIQUE(transaction_id, beneficiary_party_id)` — عمولة واحدة لكل (معاملة، مستفيد).
- **لا عمولة على معاملة لم تصل `SETTLED`.**
- استرداد بعد `PAID` → **مطالبة** (`Dr PARTY-RECEIVABLE / Cr COMMISSION-EXPENSE`)، لا خصم صامت.

> **`OPEN-BE-07`** — **كل نسب العمولة `UNKNOWN`.** الأرقام في `العمولات.docx` (2.5% · 1.5% · 0.3% · 0.2%) و`مرحله 8.docx` **توضيحية بنص الوثيقة نفسها**. جداول السياسات جاهزة؛ القيم `CONFIGURATION` تُدخل من الإدارة.
> **`OPEN-BE-08`** — أنواع العمولات المتقدمة (مقطوعة · حوافز حجم · شرائح تصاعدية) موصوفة في `العمولات.docx`. النموذج يستوعبها (`rate_type`, `tier` جداول)، لكن **قواعد التفعيل غير محسومة**. `PROPOSED` — تُبنى في مرحلة لاحقة.

---

# 15. HIERARCHY (D2 · ADR-112)

## 15.1 البنية
- `parties(id, parent_id, party_type, zone_id, pricing_group_id, status, default_currency_code)`
- `party_closure(ancestor_id, descendant_id, depth)` — يشمل الصف الذاتي `depth = 0`.
- التحديث بـTrigger عند الإدراج/النقل، **داخل نفس المعاملة**.
- منع الحلقات: `CHECK(parent_id ≠ id)` + رفض إدراج يجعل السلف من نسل نفسه.
- **`max_hierarchy_depth` = CONFIGURATION** — لا رقم ثابت.

## 15.2 الاستعلامات
| الاستعلام | الشكل |
|---|---|
| كل النسل | `closure WHERE ancestor_id = :me` |
| كل الأسلاف | `closure WHERE descendant_id = :me ORDER BY depth` |
| **العزل الشجري** | `EXISTS (SELECT 1 FROM party_closure WHERE ancestor_id = :caller AND descendant_id = :target)` |

**العزل إلزامي على:** التقارير · كشوف الحساب · قوائم الأطراف · التسعير · الصلاحيات · التصدير. **بلا استثناء.**

## 15.3 إعادة الإسناد
نقل الطرف بشجرته كاملة في معاملة واحدة (حذف صفوف الإغلاق القديمة + إدراج الجديدة). **الاستحقاقات التاريخية لا تتأثر** — لكل معاملة لقطة أسلافها.

## 15.4 اللقطات (Snapshots)
تُثبَّت وقت `VALIDATED`/`HELD`: `ancestor_chain_snapshot` (JSON: `[{party_id, party_type, depth, pricing_group_id}]`) على `transactions` وتُنسخ إلى `transaction_commission_lines`.

---

# 16. FUNDING (D6)

## 16.1 الأنواع
| النوع | المسار |
|---|---|
| **Customer Funding** | يدوي (سند + مرفق) · بوابة دفع · تحويل من وكيل |
| **Agent/Party Funding** | إيداع بنكي/نقدي بمراجعة · تحويل من السلف في الشجرة |
| **Bank Transfer** | مطالبة + مطابقة كشف البنك |
| **Wallet Gateway** | محفظة إلكترونية عبر Webhook |
| **Manual Verification** | مراجعة بشرية + Maker/Checker فوق حد |

## 16.2 دورة المطالبة
```
SUBMITTED → UNDER_REVIEW → APPROVED → POSTED
                        └→ REJECTED
                        └→ UNMATCHED  (وصل مال بلا مطالبة، أو العكس)
```
**القيد عند `POSTED`:**
```
Dr BANK | CASH | FUNDING-CLEARING  [financial_account, gateway]      approved_amount
    Cr PARTY-WALLET-LIABILITY | CUSTOMER-WALLET-LIABILITY [party, gateway]  approved_amount
```
`approved_amount` قد يختلف عن المبلغ المُدخَل من العميل — **يُخزَّن الاثنان.**

## 16.3 منع التكرار
| الآلية | القيد |
|---|---|
| مرجع التحويل | `UNIQUE(bank_id, transfer_reference)` |
| بصمة السند | `UNIQUE(receipt_hash)` — `SHA-256(رقم الحوالة + البنك + التاريخ + المبلغ)` (`التأمينات.docx`) |
| الإيداع الآلي | `UNIQUE(funding_method_id, external_transaction_id)` |
| القيد | طبقة Idempotency 2: `source_id = funding_request_id` |
| Webhook | طبقة 4 + HMAC + نافذة زمنية + nonce |

## 16.4 الأموال غير المطابقة
`UNMATCHED-DEPOSITS` (التزام) يستقبل مالًا وصل بلا مطالبة مؤكدة.
`UNCLAIMED → CLAIM_PENDING → MATCHED → REFUNDED` (`المرجع §6.1`).

> **`OPEN-BE-09`** — **لا يُخترع أي بنك ولا حساب ولا بيانات اعتماد ولا واجهة بنكية.** `الكريمي والتغذية.docx` **مفقود من مساحة العمل**. `FundingVerificationAdapter` يبقى محاكيًا حتى تصل وثيقة تكامل حقيقية. المطابقة (طبقة 3) مصمَّمة وتنتظر البيانات.

---

# 17. DIGITAL INVENTORY (D11 · AP-03)

## 17.1 محرك واحد بـStrategies
```
FulfillmentEngine
  ├── DirectIdStrategy    ألعاب: validateTarget → execute
  ├── PinPoolStrategy     مخزون محلي: claim → deliver
  ├── ApiPinStrategy      طلب PIN من المزوّد لحظيًا
  ├── ManualStrategy      طابور بشري (D12)
  └── WifiVoucherStrategy مخزون كروت أو توليد MikroTik/RADIUS
```
**لا يُبنى PIN Vault مستقل ولا Subscription PIN مستقل** — كلاهما `PinPoolStrategy` بنفس الجداول (§18 من طلبكم).

## 17.2 حالات المخزون
```
AVAILABLE ──> LOCKED ──> SOLD ──> USED
     │           │
     │           └──> AVAILABLE  (إفراج عند فشل المعاملة)
     └──> EXPIRED | VOID
```

## 17.3 الحجز الذري
```
BEGIN
  SELECT id FROM digital_inventory_items
   WHERE pool_id = ? AND status = 'AVAILABLE'
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY expires_at NULLS LAST
   FOR UPDATE SKIP LOCKED
   LIMIT 1
  UPDATE … SET status='LOCKED', locked_by_transaction_id=?, locked_at=now()
COMMIT
```
`UNIQUE(locked_by_transaction_id) WHERE status IN ('LOCKED','SOLD')` — يمنع بيع نفس الكود مرتين ويمنع معاملة واحدة من حجز كودين.

## 17.4 الأمن
- `secret_code` **مشفَّر AES-256-GCM** في الراحة، والمفتاح في KMS.
- **يُفك التشفير عند التسليم فقط**، بعد نجاح المعاملة.
- **لا يظهر في أي سجل** — لا تدقيق، لا سجل مزوّد، لا سجل تطبيق.
- التسليم عبر قناة محددة، مع تسجيل **حدث التسليم** لا المحتوى.

## 17.5 المحاسبة
شراء المخزون: `Dr VOUCHER-INVENTORY / Cr BANK|PROVIDER-BALANCE`.
البيع: القيد (2) في §9.5 يصبح `Dr PROVIDER-SERVICE-COST / Cr VOUCHER-INVENTORY` بتكلفة الوحدة المحفوظة.

---

# 18. WIFI (D11 بيعًا · D12 إدارةً)

| المكوّن | التصميم |
|---|---|
| `wifi_networks` | الشبكة · المالك (`party_id`) · الحالة · الظهور |
| `wifi_profiles` | ملف السرعة/المدة/السعر (يقابل Service/Package) |
| `wifi_vouchers` | **نفس `digital_inventory_items`** — `pool_kind = WIFI` (AP-03) |
| `wifi_assignments` | تفويض إدارة/بيع/تحصيل لأطراف |
| `wifi_collections` | تحصيل نقدي من المندوب/الوكيل مع مراجعة |
| MikroTik/RADIUS | **Provider Adapter** خلف نفس عقد §11 — `MikrotikAdapter` / `RadiusAdapter` |

**حصة المالك:** تُحسب في **D10 Commission**، لا داخل WiFi:
```
Dr WIFI-OWNER-SHARE-EXPENSE [party=owner, service] / Cr PARTY-WALLET-LIABILITY [party=owner]
```
**بيانات الاعتماد:** مرجع KMS فقط · **لا تصل الواجهة إطلاقًا** · لا تُسجَّل.
**نافذة الإلغاء/الاسترداد:** `CONFIGURATION`.
> **`OPEN-BE-10`** — `الواي فاي.docx` **مفقود من مساحة العمل**. لا تُخترع بيانات MikroTik ولا نموذج تسعير للشبكات.

---

# 19. MANUAL SERVICES (D12)

## 19.1 دورة الحياة
```
PENDING → PROCESSING → COMPLETED
            └────────→ REJECTED
            └────────→ CANCELLED
```
تُدار عبر آلة الحالات القائمة في الـSPA (`SERVICE_REQUEST_STATE_TRANSITIONS` + التوزيع + العروض بمهلة + التايملاين) — **أنضج جزء تشغيلي، يُنقل مفاهيميًا**.

## 19.2 القاعدة المالية الحاكمة
```
لا خصم مالي نهائي قبل تحقق النتيجة المطلوبة.

PENDING/PROCESSING → HOLD فقط (لا قيد)
COMPLETED          → SETTLED (القيود + التقاط الحجز)
REJECTED/CANCELLED → إفراج الحجز · صفر قيد
```
هذا يصحّح سلوك الـSPA الحالي (`chargeAgentForManualService` يخصم فورًا).

## 19.3 الربط بالمعاملة
كل طلب خدمة يدوية يحمل `transaction_id` — يمرّ بنفس آلة حالات §9 مع `fulfillment_strategy = MANUAL`. **لا مسار مالي موازٍ.**

---

# 20. DISPUTES (D13)

```
OPEN → INVESTIGATING → RESOLVED_REFUNDED | RESOLVED_REJECTED
```
- **الاسترداد = قيد عكسي** عبر D4، لا تعديل رصيد.
- عكس العمولة إجباري ومترابط (§14.2).
- **Maker/Checker إلزامي** على كل استرداد.
- SLA + تصعيد آلي (`الدعم الفني.docx`: حرج 15د/ساعة · عالٍ 30د/3س · متوسط 2س/12س · منخفض 6س/48س — **أرقام من المصدر**).
- `agent_risk_metrics` تتغذى من معدل النزاعات.
> **`OPEN-BE-11`** — عتبات الاحتيال متعارضة في المصادر (5/60ث مقابل 10/دقيقة) → **`CONFIGURATION`، لا ثابت** (`المرجع §30`).

---

# 21. SECURITY (D3 · ADR-113)

## 21.1 سلسلة الفرض — كلها خادمية
```
Request
 ├─ [1]  Authentication    Argon2id · JWT قصير · Refresh Rotation + كشف إعادة الاستخدام
 ├─ [2]  Session Validity  نشطة · غير مُبطَلة · ضمن نافذة الوردية
 ├─ [3]  Device Binding    جهاز موثوق وإلا OTP اعتماد
 ├─ [4]  Network Policy    ip_allowlist للأدوار الإدارية
 ├─ [5]  Idempotency       client_ref
 ├─ [6]  RBAC              Deny-by-default → منح الدور → منع صريح يتفوق
 ├─ [7]  ABAC              نافذة زمنية · حد مبلغ · عزل شجري
 ├─ [8]  SoD               هل هذا الدور مسموح له بهذا الفعل أصلًا؟
 ├─ [9]  Maker/Checker     فوق الحد → approval_requests (maker ≠ checker)
 ├─ [10] Transaction PIN   للعمليات الحساسة
 ├─ [11] Risk / Velocity   عتبات CONFIGURATION
 └─ [12] Audit             كل ما سبق بـrequest_id واحد
```

## 21.2 تفاصيل
| المكوّن | القرار |
|---|---|
| كلمات المرور | **Argon2id** · معاملات `CONFIGURATION` |
| Refresh Rotation | إعادة استخدام رمز تحديث = **إبطال كل جلسات الحساب فورًا** + حدث أمني |
| Device Binding | **لا يُعتمد على IMEI/MAC** — بيانات اعتماد مرتبطة بالجهاز/Attestation |
| 2FA | TOTP إلزامي لكل حساب موظف؛ إلزامي لكل عملية مالية إدارية |
| Transaction PIN | منفصل عن كلمة المرور · Argon2id · فوق حد `CONFIGURATION` |
| **SoD** | 4 فصول: من يُنشئ ≠ من يعتمد · مدير النظام ≠ الوصول المالي · من يهيّئ التسعير ≠ من ينفّذ · من يعتمد التغذية ≠ من يقدّمها |
| **SUPER_ADMIN** | **لا يحصل تلقائيًا على أرصدة العملاء** — دور `FINANCE` منفصل (المرجع §3) |
| Maker/Checker | تغذية · تعديل رصيد · تجاوز Margin Guard · حد ائتماني · **عكس قيد** · إغلاق فترة · تغيير تسعير · تسوية عمولات كبيرة |
| الأسرار | **KMS/Vault حصرًا** — صفر سرّ في DB أو كود أو سجل |
| منع التصعيد | لا يعدّل مستخدم صلاحيات من هو أعلى منه هرميًا · لا يمنح موزع صلاحية لا يملكها |

> **`OPEN-BE-12`** — مدة Access Token: المصادر متعارضة (15 دقيقة مقابل ساعة — `المرجع §30`). `CONFIGURATION` · لا يمنع البناء.
> **`OPEN-BE-13`** — تفعيل منع `SUPER_ADMIN` من رؤية الأرصدة يغيّر تجربة الإدارة جذريًا. Architecture Freeze **يوصي بـنعم** ويصنّفه محتاجًا لموافقة. `OPEN`.

---

# 22. AUDIT (D3 · ADR-118)

## 22.1 المخطط الموحد
`audit_log`: `id (UUIDv7)` · `occurred_at` · `stream_key` · `actor_party_id` · `actor_role` · `on_behalf_of_party_id` · `action` · `resource_type` · `resource_id` · `before_data (JSONB)` · `after_data (JSONB)` · `request_id` · `correlation_id` · `client_ref` · `ip_address` · `device_id` · `user_agent` · `reason` · `previous_hash` · `hash`

## 22.2 القواعد
- **APPEND-ONLY** بـTrigger يرفض `UPDATE`/`DELETE` — **لا استثناء لأي دور**.
- **سلسلة تجزئة لكل `stream_key`**: `hash = SHA-256(previous_hash ‖ canonical_json(payload))`. أي عبث يكسر السلسلة ويُكتشف بفحص دوري.
- **`reason` إلزامي** لكل: تعديل رصيد يدوي · عكس قيد · تجاوز Margin Guard · منح/سحب صلاحية · تغيير حد ائتماني · إعادة فتح فترة.
- **الأسرار وأكواد القسائم لا تدخل التدقيق إطلاقًا** — بصمة فقط.

## 22.3 فصل التدقيق المالي عن التطبيقي
| المجرى | المحتوى | الاحتفاظ |
|---|---|---|
| `financial` | كل ما يمسّ المال (قيود · حجوزات · تسويات · موافقات) | طويل — `CONFIGURATION` |
| `security` | دخول · صلاحيات · أجهزة · أحداث خطر | طويل |
| `application` | تغييرات تشغيلية غير مالية | أقصر |
نفس الجدول ونفس المخطط، **سلاسل تجزئة منفصلة** — يمنع حجم السجل التطبيقي من إضعاف ضمان السجل المالي.

## 22.4 التخزين الخارجي (WORM/SIEM)
تصدير دوري موقَّع لجذر السلسلة.
**التصنيف (ADR-118 · وثيقة التجميد §D-18):** `RECOMMENDED` الآن · **`REQUIRED` قبل التشغيل الحقيقي بأموال العملاء**.

---

# 23. RECONCILIATION (D14 · ADR-114)

| # | الطبقة | تُقارن | التكرار | عند الفرق |
|---|---|---|---|---|
| **1** | Wallet ↔ Ledger | `party_wallet_projection` مقابل `Σ(credit−debit)` بالأبعاد | يومي + كل إقفال | `financial_discrepancy` **تلقائي** |
| **2** | Transaction ↔ Provider | `transactions` + `provider_executions` مقابل ملف/استعلام المزوّد | يومي | تصنيف: مفقود لدينا / مفقود لديه / فرق مبلغ / فرق حالة |
| **3** | Funding ↔ Bank | `funding_requests` مقابل كشف البنك | يومي | `UNMATCHED-DEPOSITS` |
| **4** | Commission ↔ Ledger | `commission_accruals` مقابل `COMMISSION-PAYABLE` بالبُعد | يومي | فرق يُصعَّد |

**الطبقتان 1 و4 تعملان من اليوم الأول** (بيانات داخلية). **2 و3 تنتظران بيانات خارجية `UNKNOWN`** — الآلية تُبنى وتنتظر.

## 23.1 الدورة وحالات الفرق
```
Detect → Classify → Resolve → Adjust (قيد تسوية، لا تعديل) → Audit → Close

discrepancy: OPEN → INVESTIGATING → RESOLVED_AUTO | RESOLVED_MANUAL | WRITTEN_OFF
```
- **التسوية الآلية مسموحة فقط** لفرق تقريب دون `auto_settle_threshold` (`CONFIGURATION`) أو مطابقة بمرجع مؤكد.
- **تحتاج موافقة بشرية:** أي فرق مبلغ · معاملة مفقودة عند أي طرف · فرق يتجاوز العتبة.
- `WRITTEN_OFF` يتطلب **Maker/Checker** + قيد تسوية + سبب.
- **سجلات المطابقة APPEND-ONLY.**
- **لا إقفال فترة وفيها `discrepancy` بحالة `OPEN` أو `INVESTIGATING`** — يُفرض عند الإقفال.

---

# 24. OUTBOX & WORKERS (ADR-119)

## 24.1 النمط
```
BEGIN
   تغيير الحالة / ترحيل القيد
   INSERT INTO outbox_events (...)
COMMIT
      │
      ▼
Worker: SELECT … FOR UPDATE SKIP LOCKED WHERE status='PENDING' AND next_attempt_at <= now()
      │
      ▼
BEGIN; INSERT provider_executions(status='SENT'); COMMIT;   ← قبل الاستدعاء
      │
      ▼
استدعاء المزوّد (خارج أي معاملة)
      │
      ▼
BEGIN; تسجيل النتيجة + تحديث الحالة + outbox جديد إن لزم; COMMIT;
```
**ضمان:** لا أثر خارجي بلا تغيير حالة، ولا تغيير حالة بلا إمكانية إعادة إرسال الأثر.

## 24.2 الـWorkers
| Worker | المهمة | التكرار |
|---|---|---|
| `provider-execution` | تنفيذ المعاملات المطابورة | مستمر |
| `provider-status-poll` | استعلام `PENDING_PROVIDER` بتراجع أسّي | مستمر |
| `settlement` | تحويل `SUCCESS → SETTLED` (قابل لإعادة المحاولة) | مستمر |
| `reconciliation` | الطبقات الأربع | يومي/مجدول |
| `notifications` | استهلاك أحداث الإشعار | مستمر |
| `reports-export` | تصدير ضخم بـCursor | عند الطلب |
| `projection-rebuild` | إعادة بناء `party_wallet_projection` | مجدول + عند الطلب |
| `risk` | مؤشرات المخاطر والسرعة | مجدول |
| `commission-settlement` | نقل `ACCRUED/HELD → SETTLED` بعد نافذة النزاع | مجدول |

## 24.3 خصائص الـOutbox
`aggregate_type` · `aggregate_id` · `event_type` · `payload` · `status` (`PENDING`/`IN_FLIGHT`/`DONE`/`DEAD`) · `attempts` · `next_attempt_at` · `last_error` · `available_after`.
**Dead-letter** بعد `max_attempts` (`CONFIGURATION`) + إنذار. **لا حذف** — الأرشفة بالتقسيم.

> **`OPEN-BE-14`** — تقنية الطابور المساعدة (Redis/BullMQ) لتسريع الالتقاط. Architecture Freeze يوصي بها ضمن `OPEN-13`. **الـOutbox في PostgreSQL هو الضمان؛ Redis تحسين اختياري.** `PROPOSED`.

---

# 25. OFFLINE (ADR-115)

| مسموح | ممنوع |
|---|---|
| تصفح الكتالوج (بختم إصدار) | ❌ أي حركة مالية تُعتبر حقيقة |
| آخر رصيد معروف **بختم زمني إلزامي** | ❌ وجود حالة `SUCCESS` محليًا |
| كشوف سابقة (قراءة) | ❌ حالة `FAILED` محليًا |
| مسودة طلب + مرفق (`DRAFT`/`PENDING_SYNC` + `client_ref`) | ❌ تغيير الرصيد المعروض محليًا |
| | ❌ حساب سعر أو عمولة نهائي محليًا |
| | ❌ قرار صلاحية محلي |

**ثلاث طبقات منع:** بيانيًا (لا `SUCCESS` في مفردات العميل) · بصريًا (مظهر مختلف + ختم «آخر تحديث») · بنيويًا (الرصيد يتحدث من رد الخادم حصرًا).
**الرصيد `server stamped`:** كل رد رصيد يحمل `as_of` من الخادم + `staleness` محسوبة على العميل. عتبات: أخضر <5د · أصفر <1س · أحمر >1س (`CONFIGURATION`).
**المزامنة:** `client_ref` → الخادم يحسم (طبقة 1) → الواجهة تعكس رد الخادم حصرًا.

---

# 26. REPORTING (D15 · ADR-117)

**كل تقرير مصدره `journal_entry_lines` أو Projection مشتقة منه. صفر تقرير من `agent.balance` أو `WALLET_LEDGER`.**

| التقرير | الاستراتيجية | ملاحظات |
|---|---|---|
| **Trial Balance** | Materialized View (ليلي + عند الطلب) | **لكل عملة على حدة** — لا تجميع عبر العملات |
| **P&L** | MV | يُظهر System Margin كسطر مشتق |
| **Balance Sheet** | MV | يوازن حتميًا إن توازن TB |
| **Cash / Liquidity** | Live + MV يومية | يشمل رصيدنا لدى كل مزوّد |
| **Agent/Party Statements** | Live Query + فهرس + ترقيم | أعمدة إفصاح: `Ledger` · `Held` · `Available` · `Credit` · `Commission` |
| **Provider Statements** | Live Query | أساس المطابقة (طبقة 2) |
| **Commission Reports** | Live + MV | حسب المستوى الهرمي والفترة والحالة |
| **Reconciliation Reports** | Background Job | الفروق المفتوحة تمنع الإقفال |
| **Profitability** | MV | `Revenue − Cost − Commission` بالبُعد |
| **Executive KPIs** | MV | نجاح · زمن تنفيذ · SLA · معدل الغموض · سيولة |

**التصدير:** `Cursor/Streaming` حصرًا. **ممنوع تحميل مجموعة نتائج كاملة في الذاكرة.** تصدير غير متزامن عبر `export_jobs` → ملف في تخزين كائنات برابط موقَّع محدود الصلاحية.
**كل تقرير:** فحص صلاحية + **عزل شجري إلزامي** + وسم (المصدر · العملة · الفلاتر · النطاق · هوية الطالب) + قيد تدقيق للتصدير.

---

# 27. CONCURRENCY (§29)

| الخطر | الآلية |
|---|---|
| **Double spend** | `FOR UPDATE` على صف المحفظة + حساب `Available` داخل القفل + `UNIQUE(wallet_holds.transaction_id)` |
| **Double topup** | `UNIQUE(bank_id, transfer_reference)` + `UNIQUE(receipt_hash)` + Idempotency L2 على القيد |
| **Double commission** | `UNIQUE(transaction_id, beneficiary_party_id)` + العمولة تُستحق حصريًا داخل معاملة `SETTLED` |
| **Duplicate provider execution** | `UNIQUE(provider_id, provider_request_id)` + كتابة `SENT` قبل الاستدعاء + `FOR UPDATE SKIP LOCKED` + `WHERE status='QUEUED'` |
| **Duplicate webhook** | `UNIQUE(provider_id, provider_event_id)` — `INSERT` أولًا، عند التعارض ACK وتوقف |
| **Voucher race** | `FOR UPDATE SKIP LOCKED LIMIT 1` + `UNIQUE(locked_by_transaction_id)` جزئي |
| **Wallet hold race** | نفس قفل الصف أعلاه — لا قراءة-ثم-كتابة بلا قفل |
| **Double settlement** | `UNIQUE(source_type, source_id)` على القيد + انتقال `SUCCESS→SETTLED` بشرط الحالة في نفس `UPDATE` |
| **Lost update على المعاملة** | عمود `version` (قفل متفائل) |
| **Projection drift** | التحديث داخل نفس معاملة القيد + مطابقة يومية |

**العزل:** `READ COMMITTED` + أقفال صريحة. **`SERIALIZABLE` مرفوض.**

---

# 28. OBSERVABILITY (§34)

## 28.1 المعرّفات المترابطة
```
correlation_id   ← يُولَّد عند حافة الـAPI ويرافق كل شيء عبر الطبقات والـWorkers
request_id       ← لكل طلب HTTP
client_ref       ← من العميل · يربط إعادة الإرسال بالنتيجة
transaction_id   ← الكيان المالي
provider_request_id ← الاستدعاء الخارجي
journal_entry_id ← الأثر المحاسبي
```
**كل حدث outbox وكل صف تدقيق وكل سجل مزوّد يحمل `correlation_id`.**

## 28.2 السجلات المنظمة
JSON منظم · مستويات · **تنقيح إلزامي** لكل حقل حساس (كلمات مرور · رموز · PIN · أكواد قسائم · بيانات اعتماد) بقائمة حظر مركزية.

## 28.3 المقاييس
معدل المعاملات · توزيع الحالات · زمن استجابة المزوّد (p50/p95/p99) · نسبة `unknown` · عمق الطابور · عمر أقدم `PENDING_PROVIDER` · عدد `discrepancy` المفتوحة · انحراف الـProjection · معدل فشل الدخول.

## 28.4 التتبّع (Traces)
API → Application → Domain → Repository → Provider Adapter. **حدود المعاملة تظهر كمقاطع صريحة** لكشف أي استدعاء خارجي داخل معاملة.

## 28.5 الإنذارات
| الإنذار | الشدة |
|---|---|
| `PENDING_PROVIDER` يتجاوز عتبة زمنية | 🔴 حرج |
| `financial_discrepancy` جديد | 🔴 حرج |
| رصيد مزوّد سالب | 🔴 حرج |
| انحراف Projection ≠ 0 | 🔴 حرج |
| Outbox dead-letter | 🟠 عالٍ |
| Circuit Breaker `OPEN` | 🟠 عالٍ |
| كشف إعادة استخدام Refresh Token | 🔴 حرج |
| فشل سلسلة تجزئة التدقيق | 🔴 حرج |

---

# 29. المراجعة الذاتية للتصميم (§40)

| # | السؤال | الحكم | الضمانة في التصميم |
|---|---|---|---|
| 1 | إنشاء رصيد بدون Journal؟ | ❌ مستحيل | `party_wallet_projection` يُكتب حصريًا من محدِّث الـProjection داخل معاملة القيد · لا API لكتابة رصيد · `initialBalance` مُلغى · الأرصدة الافتتاحية عبر `OPENING-BALANCE-SUSPENSE` |
| 2 | خصم بدون Accounting؟ | ❌ مستحيل | لا مسار خصم إلا `SETTLED` الذي يُرحّل القيود؛ الحجز لا يخصم |
| 3 | عكس Journal بدون dimensions؟ | ❌ مستحيل | §6.3 يفرض نسخ الأبعاد + اختبار عقد إلزامي (ADR-110) |
| 4 | تنفيذ Provider مرتين؟ | ❌ مستحيل | Idempotency L3 + `SENT` قبل الاستدعاء + `SKIP LOCKED` + شرط الحالة |
| 5 | اعتبار timeout فشلًا؟ | ❌ ممنوع | `TIMEOUT → PENDING_PROVIDER` · الاستثناء الوحيد قاعدة تعاقدية صريحة لكل مزوّد |
| 6 | تحرير Hold رغم غموض المزوّد؟ | ❌ مستحيل | `expires_at = NULL` إلزاميًا بعد `QUEUED` (§8.4) |
| 7 | حساب Commission من Customer Price؟ | ❌ ممنوع | العمولة من `commission_policies` + الشلال؛ Margin Guard يفصل الهامش عن العمولة (§14.1) |
| 8 | إنشاء COA لكل party؟ | ❌ مستحيل | 24 حسابًا `is_system` · لا API لإنشاء حساب · الطرف بُعد لا حساب |
| 9 | `agent.balance` مصدر حقيقة؟ | ❌ غير موجود | لا عمود رصيد على `parties` في المخطط |
| 10 | `providerAccount.balance` مصدر حقيقة؟ | ❌ غير موجود | لا عمود رصيد على `provider_accounts` |
| 11 | `WALLET_LEDGER` مصدر حقيقة؟ | ❌ لا | يُستورد `legacy_wallet_ledger` للقراءة فقط · بلا كاتب · بلا استعمال في أي تقرير |
| 12 | تعديل financial movement؟ | ❌ مستحيل | Trigger APPEND-ONLY |
| 13 | حذف financial movement؟ | ❌ مستحيل | Trigger APPEND-ONLY · لا Soft Delete على أي كيان مالي |
| 14 | نجاح مالي من Offline؟ | ❌ مستحيل | لا حالة `SUCCESS` في مفردات العميل · الحسم خادمي عبر `client_ref` |
| 15 | Provider Secret في الواجهة؟ | ❌ مستحيل | مرجع KMS فقط · لا حقل سرّ في أي استجابة API |
| 16 | تجاوز Maker/Checker؟ | ❌ مستحيل | `CHECK(maker_id ≠ checker_id)` + العملية لا تُنفَّذ إلا بصف موافقة مطابق للبصمة |
| 17 | بيع قسيمة مرتين؟ | ❌ مستحيل | `FOR UPDATE SKIP LOCKED` + `UNIQUE(locked_by_transaction_id)` جزئي |
| 18 | إغلاق فترة مع فرق مفتوح؟ | ❌ مستحيل | فحص إلزامي عند الإقفال (§23.1) |

**نتيجة المراجعة: صفر ثغرة من الثمانية عشر. لم يُحتَج إلى تحويل أي بند إلى `OPEN`.**

---

# 30. ترتيب التنفيذ والاعتماديات (§39)

| Phase | المحتوى | يعتمد على | معيار الخروج |
|---|---|---|---|
| **1A** Runtime Foundation | هيكل المشروع · Shared Kernel · حدود الـModules · فحص الدوران في CI · Correlation | — | فحص CI يرفض أي استيراد يكسر الحدود |
| **1B** Money + Currency | `Money` · `currencies` · `fx_rates` · التقريب · Largest Remainder | 1A | اختبارات تقريب وتقسيم تمرّ 100% |
| **1C** COA + Accounting Core | 24 حسابًا · القيد · الأبعاد · العكس · الفترات · Triggers | 1B | ميزان مراجعة متوازن · العكس يحفظ الأبعاد · Append-only مفروض |
| **1D** Parties + Dimensions | `parties` · `party_closure` · العزل الشجري · `zones` | 1A | استعلام عزل شجري مُثبَت |
| **1K** Security / RBAC / Audit ★ | Argon2id · جلسات · أجهزة · SoD · Maker/Checker · سلسلة التجزئة | 1A, 1D | كل Endpoint محمي · صفر سرّ في الكود · سلسلة سليمة · **سياق الفاعل متاح لكل حركة** |
| **1E** Wallet + Holds | Projection · `wallet_holds` · `Available` · إعادة البناء | 1C, 1D, **1K** | مجموع المحافظ = رصيد الحساب الرقابي · مطابقة طبقة 1 تعمل |
| **1F** Transaction + Idempotency | آلة الحالات · 4 طبقات · Outbox · Workers | 1E | صفر ازدواج تحت ضغط متزامن |
| **1G** Provider Adapter | العقد · التطبيع · السجل · التوجيه · الغموض | 1F | مزوّد محاكٍ يمرّ كل حالات الغموض · صفر إعادة تنفيذ على `unknown` |
| **1H** Pricing + Commission | التسعير · القفل · Margin Guard · الشلال | 1D, 1F | استحالة بيع بخسارة · `Σ` الشلال = الإجمالي |
| **1I** Funding | مطالبات · مطابقة · Webhook · Maker/Checker | 1E | منع تكرار السند مُثبَت |
| **1J** Digital / WiFi / Manual | محرك تسليم واحد بـStrategies · القفل الذري | 1F, 1G | صفر بيع مزدوج تحت تزامن |
| **1L** Reconciliation / Reports | 4 طبقات · فروق · إقفال · تقارير · تصدير | 1C…1J | كشف تلقائي للفروق · لا إقفال مع فرق |
| **1M** Migration | استخراج · تطبيع · أرصدة افتتاحية · T0→T3 | كل ما سبق | تطابق 7 أيام · صفر كتابة مباشرة |

**★ AP-04 مُعتمَد (Phase 1.1):** الترتيب النهائي هو
```
1A Runtime → 1B Money → 1C Accounting → 1D Parties → 1K Security/Audit → 1E Wallet → 1F Transaction → …
```
**المسار الحرج:** `1A → 1B → 1C → 1D → 1K → 1E → 1F` — كل ما بعده متفرّع.
**إثبات عدم الدوران:** `1K` يعتمد على `1A` و`1D` فقط (هوية · شجرة). **لا يعتمد على `1C` ولا `1E`** — لا يقرأ قيدًا ولا رصيدًا لتنفيذ صلاحياته (راجع §2.4 · C-01 و C-02).

---

# 31. BLOCKERS · RISKS · OPEN · SAFE TO IMPLEMENT (§38)

## 31.1 BLOCKERS BEFORE IMPLEMENTATION
| # | Blocker | يمنع | المطلوب |
|---|---|---|---|
| **B-1** | **توقيع سجل ADR** (ADR-101…119) | **إعلان التجميد وبدء 1C** | موافقة صريحة على الثمانية غير القابلة للرجوع (101·102·103·104·106·108·110·118) |
| **B-2** | **عملة التقرير الأساسية** (`OPEN-BE-02`) | **إصدار قوائم مالية موحّدة** — لا يمنع بناء 1B/1C | تحديد `YER` أو `USD` |
| **B-3** | **إعلان عملة لكل طرف** | **1M (الأرصدة الافتتاحية)** — لا يمنع 1A…1L | جدول (طرف ← عملة) · `CONFIGURATION` |
| **B-4** | **الامتثال التنظيمي السعودي** | **نطاق السعودية فقط** — لا يمنع النواة | رأي قانوني (ZATCA/VAT/فوترة) |

## 31.2 NON-BLOCKING RISKS
| # | الخطر | التخفيف |
|---|---|---|
| R-1 | **10 من 32 وثيقة مصدر مفقودة** — منها `الربط البرمجي` · `سجلات التدقيق` · `إدارة الأجهزة` · `الواي فاي` · `الكريمي والتغذية` · **الوثيقة الأم** | صُمِّمت نطاقاتها من المرجع الموحد؛ يُنصح برفعها بالتوازي مع 1A |
| R-2 | **`TEST SUITE NOT PRESENT`** — 41 ملفًا و1530 اختبارًا مذكورة كمُسلَّمة وغير موجودة | مجموعة اختبارات تعاقدية جديدة **إلزامية في 1C** |
| R-3 | نسب العمولة · أسعار الخدمات · تكاليف المزوّدين · حسابات الاستلام | `UNKNOWN` — الجداول جاهزة ولا تمنع بناء المخطط |
| R-4 | لا مزوّد حقيقي واحد اليوم (3 محاكيات فقط) | 1G يُختبر بالمحاكي؛ التكامل الحقيقي مرحلة لاحقة |
| R-5 | لا واجهة بنكية حقيقية | طبقة المطابقة 3 تُبنى وتنتظر |

## 31.3 OPEN DECISIONS (لم يُحوَّل أي منها إلى FROZEN)
`OPEN-BE-01` المنصة/اللغة · `OPEN-BE-02` **عملة التقرير** · `OPEN-BE-03` حساب فروق التقريب · `OPEN-BE-04` طول الفترة · `OPEN-BE-05` نسبة المكشوف مقابل التأمين · `OPEN-BE-06` قيم التسعير · `OPEN-BE-07` نسب العمولة · `OPEN-BE-08` أنواع العمولات المتقدمة · `OPEN-BE-09` تكامل البنوك · `OPEN-BE-10` بيانات WiFi/MikroTik · `OPEN-BE-11` عتبات الاحتيال · `OPEN-BE-12` مدة Access Token · `OPEN-BE-13` منع SUPER_ADMIN من الأرصدة · `OPEN-BE-14` تقنية الطابور المساعدة · `OPEN-BE-15` تعدد المستأجرين (Multi-tenancy) — **غير مذكور في أي مصدر؛ يُفترض مستأجر واحد ولا يُبنى عليه** · `OPEN-BE-16` سياسة الاحتفاظ بالبيانات (`المرجع` لا يحددها)
+ المقترحات المعمارية: `AP-01` · `AP-02` · `AP-03`

## 31.4 SAFE TO IMPLEMENT — يمكن البدء فورًا بعد B-1
✅ **1A** Runtime Foundation — لا يعتمد على أي `OPEN`
✅ **1B** Money + Currency — العملات الأربع ودقتها `FROZEN`
✅ **1C** COA + Accounting Core — الـ24 حسابًا والقواعد `FROZEN` · **باستثناء** أعمدة عملة التقرير التي تُبنى وتُترك فارغة حتى `B-2`
✅ **1D** Parties + Dimensions — `FROZEN` (العمق `CONFIGURATION`)
✅ **1E** Wallet + Holds — `FROZEN`
✅ **1F** Transaction + Idempotency — `FROZEN`
✅ **1K** Security / Audit — `FROZEN` (باستثناء `OPEN-BE-12/13` وهما إعداد لا بنية)

⚠️ **1G** Provider — البنية آمنة؛ **لا تكامل حقيقي** (R-4)
⚠️ **1H** Pricing/Commission — المحرك آمن؛ **لا بيانات** (`OPEN-BE-06/07`)
⚠️ **1I** Funding — الآلية آمنة؛ **لا بنك** (`OPEN-BE-09`)
⛔ **1M** Migration — محجوبة بـ`B-3`

---

# 32. MULTI-TENANCY IMPACT ANALYSIS (`OPEN-BE-15` · Phase 1.1)

> **تحليل فقط. لا قرار.** المصادر **لا تذكر تعدد المستأجرين إطلاقًا** — لا في المرجع الموحد ولا في أي من الوثائق الـ26. `MISSING SOURCE`.

## A) لو كان النظام Single Tenant
| البند | الأثر |
|---|---|
| المخطط | كما هو الآن — 81 جدولًا بلا عمود إضافي |
| الفريدة | `UNIQUE(account_number)` · `UNIQUE(phone)` · `UNIQUE(login_identifier)` · `UNIQUE(entry_number)` — **عالمية وصحيحة** |
| العزل | `party_closure` وحده كافٍ — الموزع لا يرى غير شجرته |
| COA | نسخة واحدة من الـ24 حسابًا |
| الفترات المحاسبية | تقويم واحد · إقفال واحد |
| التقارير | ميزان مراجعة واحد لكل عملة |
| الأداء | أبسط · فهارس أضيق |
| **الخطر** | لو ظهرت حاجة تعدد لاحقًا ⟹ **تغيير كاسر لكل جدول وفهرس واستعلام** |

## B) لو كان النظام Multi Tenant
| البند | الأثر |
|---|---|
| المخطط | `tenant_id` على **كل جدول تقريبًا** (باستثناء `currencies` وربما `chart_of_accounts` النموذجية) |
| الفريدة | **كل قيد فريد يصبح مركّبًا:** `UNIQUE(tenant_id, account_number)` · `(tenant_id, source_type, source_id)` · `(tenant_id, party_id, client_ref)` · `(tenant_id, provider_id, provider_request_id)` · `(tenant_id, receipt_hash)` … |
| الفهارس | كل فهرس يبدأ بـ`tenant_id` — وإلا تسرّب أداء وتسرّب بيانات |
| COA | **نسخة لكل مستأجر** أو نموذج مشترك + تخصيص — قرار محاسبي بذاته |
| الفترات | تقويم وإقفال **لكل مستأجر** |
| العزل | طبقتان: `tenant_id` **ثم** `party_closure`. **إغفال إحداهما = تسريب بيانات مالية** |
| التدقيق | سلسلة التجزئة **لكل مستأجر** (`stream_key` يتضمن `tenant_id`) وإلا اختلطت السلاسل |
| المطابقة | فروق وإقفال لكل مستأجر |
| Outbox/Workers | التقاط مُقسَّم لمنع احتكار مستأجر للطابور |
| الترحيل | `MIGRATION_DESIGN` كله يحتاج بُعد مستأجر |
| **الخطر** | تعقيد دائم في كل استعلام؛ خطأ واحد في `WHERE tenant_id` = كارثة تسريب |

## C) تكلفة إضافة `tenant_id` لاحقًا
| المرحلة | التكلفة |
|---|---|
| **قبل 1C** (لا بيانات) | 🟢 **منخفضة** — تعديل مخطط منطقي فقط |
| **بعد 1C وقبل الإنتاج** | 🟠 **متوسطة-عالية** — إعادة بناء كل قيد فريد وكل فهرس · إعادة كتابة كل استعلام عزل · إعادة توليد سلسلة التجزئة |
| **بعد الإنتاج** | 🔴 **باهظة جدًا** — ترحيل بيانات حية · إعادة حساب كل مفتاح فريد · **سلسلة التجزئة التاريخية لا يمكن إعادة تقسيمها بأثر رجعي** ⟹ فقدان ضمان عدم العبث للفترة السابقة |

**الخلاصة:** التكلفة تتضاعف عند كل حدّ. **بعد الإنتاج تصبح غير قابلة للاسترداد في نطاق التدقيق.**

## D) هل توجد طريقة تحفظ الإمكانية بلا فرض تعدد الآن؟ — **نعم**

**النمط المقترح: `Tenant-Ready, Single-Tenant-Deployed`**

| # | الإجراء | التكلفة الآن | ما يشتريه |
|---|---|---|---|
| 1 | **`tenants` جدول موجود بصف واحد** (`DEFAULT_TENANT`) | صف واحد | مرجع موجود من اليوم الأول |
| 2 | **`tenant_id NOT NULL DEFAULT <default>` على كل جدول أعمال** | عمود واحد لكل جدول · **صفر تغيير في الاستعلامات اليوم** | لا حاجة لـALTER لاحقًا |
| 3 | **كل قيد فريد يبدأ بـ`tenant_id`** منذ الآن | صفر أثر عند مستأجر واحد | لا إعادة بناء لأي فريد لاحقًا |
| 4 | **كل فهرس مركّب يبدأ بـ`tenant_id`** | صفر أثر عمليًا | لا إعادة فهرسة لاحقًا |
| 5 | **`stream_key` في `audit_log` يتضمن `tenant_id` منذ الآن** | صفر | **يحفظ ضمان سلسلة التجزئة التاريخية** — أهم مكسب |
| 6 | **طبقة وصول واحدة تحقن `tenant_id`** تلقائيًا | تصميم بسيط | تفعيل التعدد لاحقًا = تفعيل الحقن، لا إعادة كتابة |
| 7 | **لا API ولا واجهة ولا منطق أعمال يعرف بوجود المستأجر** | صفر | **لا يُفرض التعدد** — النظام يبقى Single Tenant سلوكيًا |

**النتيجة:** تكلفة اليوم ≈ **عمود + بادئة فهرس**؛ تكلفة التأجيل بعد الإنتاج = **إعادة بناء مالية وتدقيقية**.

## التوصية (وليست قرارًا)
> **`RECOMMENDATION`:** اعتماد **`Tenant-Ready, Single-Tenant-Deployed`** — يُغلق `B-5` كحاجز تنفيذي **دون** أن يحسم `OPEN-BE-15` ودون فرض تعدد المستأجرين.
>
> **`OPEN-BE-15` يبقى `OPEN`.** لم يُحوَّل إلى `FROZEN`. القرار النهائي (هل النظام متعدد فعلًا؟) يبقى لكم؛ التصميم فقط لا يُغلق الباب.

---

# 33. CROSS-DOMAIN CONSISTENCY REVIEW — النتائج (Phase 1.1)

راجعتُ الـ79 جدولًا الأصلية بحثًا عن: دورة FK · دورة اعتماد · ازدواج مصدر حقيقة · بيانات قابلة للانحراف · جدول بمالكَين · مسار كتابة للتقارير · تجاوز نطاق مالي.

## NEW FINDINGS

### `NF-01` · **دورة مفاتيح أجنبية حقيقية** — `transactions` ↔ `wallet_holds`
- **الدليل:** `transactions.hold_id → wallet_holds.id` **و** `wallet_holds.transaction_id → transactions.id`.
- **الأثر:** إدراج مستحيل بلا تأجيل قيود · حذف/أرشفة معقّدة · ازدواج مرجعي قابل للانحراف.
- **التصحيح المعتمد:** **حذف `transactions.hold_id`.** الاتجاه الوحيد `wallet_holds.transaction_id` (فريد أصلًا). الحجز يُقرأ بالاستعلام.
- **الحالة:** ✅ **FIXED** في المخطط.

### `NF-02` · **دورة اعتماد بين النطاقات عبر FK** — `parties`(D2) → `pricing_groups`(D7) → `zones`(D2)
- **الدليل:** `parties.pricing_group_id` يجعل نطاق الهوية يعتمد على نطاق التسعير، بينما التسعير يعتمد على المناطق (D2).
- **الأثر:** دورة D2 ↔ D7 · وتغيير الشريحة يصبح تعديلًا على `parties` بلا تاريخ.
- **التصحيح المعتمد:** **إزالة `parties.pricing_group_id`** وإنشاء **`party_pricing_assignments`** (D7): `party_id · pricing_group_id · valid_from · valid_to · assigned_by`. الاتجاه يصبح `D7 → D2` فقط. **مكسب إضافي:** تاريخ الشرائح محفوظ.
- **الحالة:** ✅ **FIXED** (+1 جدول).

### `NF-03` · **لا جدول يحمل قيم `CONFIGURATION`**
- **الدليل:** التصميم يستعمل `CONFIGURATION` في **17 موضعًا** على الأقل (`MIN_MARGIN` · `quote_ttl` · `slippage` · `dispute_window_days` · `auto_settle_threshold` · `webhook_max_skew_seconds` · `max_hierarchy_depth` · `reporting_currency` · عتبات الاحتيال · مدة الرمز · عتبات القاطع …) **ولا جدول يخزّنها**.
- **الأثر:** إما ثوابت مبعثرة في الكود (غير قابلة للتدقيق) أو قيم مخترعة — كلاهما مرفوض.
- **التصحيح المعتمد:** **`system_configuration`** (Platform): `key · value · value_type · scope · is_financial · updated_by · approval_request_id`. **تغيير أي مفتاح `is_financial = true` يتطلب Maker/Checker + قيد تدقيق.**
- **الحالة:** ✅ **FIXED** (+1 جدول).

### `NF-04` · **`export_jobs` مسار كتابة داخل نطاق «قراءة فقط»**
- **الدليل:** `D15 Reporting` مُعرَّف READ-ONLY، لكنه يملك `export_jobs` وهو MUTABLE.
- **التصحيح المعتمد:** تعريف دقيق مكتوب في العقد: **«Reporting قراءة فقط بالنسبة للبيانات المالية»**؛ يملك جدول تتبّع مهامه فقط، **بلا أي FK يكتب في جدول مالي، وبلا أي صلاحية كتابة مالية**. يُفرض بمصفوفة الاعتماد (§27 من الـGate).
- **الحالة:** ✅ **CLARIFIED** (استثناء موثَّق صراحة).

### `NF-05` · **ملكية `financial_accounts` مزدوجة**
- **الدليل:** موضوع تحت D5 Wallet بينما يستعمله D6 Funding كوجهة تحصيل وD4 كبُعد.
- **التصحيح المعتمد:** **المالك D6 Funding** · D4 يستعمله بُعدًا · D5 لا يملكه.
- **الحالة:** ✅ **FIXED**.

### `NF-06` · **`provider_webhook_events` في نطاق خاطئ**
- **الدليل:** موضوع تحت D6 Funding مع أنه حدث مزوّد (Idempotency L4) يخدم D8/D9 أيضًا.
- **التصحيح المعتمد:** **المالك D9 Provider**.
- **الحالة:** ✅ **FIXED**.

### `NF-07` · **تسمية D7 غير متسقة**
- **الدليل:** `Catalog & Pricing` في وثيقة التجميد · `Pricing` في تصميم Phase 1 · بينما `services`/`packages` تعيش فيه.
- **التصحيح المعتمد:** **`D7 Catalog & Pricing`** في كل الوثائق.
- **الحالة:** ✅ **FIXED**.

### `NF-08` · **`party_wallet_projection` يوحي بإنفاق محافظ غير قابلة للإنفاق**
- **الدليل:** `wallet_kind ∈ {MAIN, INSURANCE, COMMISSION}` وكلها تحمل `available_amount`.
- **الأثر:** خطر منطقي بأن يُحسب `Available` لمحفظة عمولة أو تأمين ويُصرف منها.
- **التصحيح المعتمد:** عمود **`is_spendable`** (`MAIN=true` · `INSURANCE=false` · `COMMISSION=false`) + **قاعدة: الحجز مسموح فقط على `is_spendable = true`** يُفرض بقيد.
- **الحالة:** ✅ **FIXED**.

### `NF-09` · **جداول تدقيق مذكورة في التجميد وغير موجودة في المخطط**
- **الدليل:** التجميد §D-18 يسمّي `financial_action_logs` و`permission_change_logs`؛ المخطط لا يحتويهما.
- **القرار:** **دمج مقصود** — كلاهما مُحقَّق كـ**مجرى داخل `audit_log`** (`stream_key = financial` / `security`) بنفس المخطط وسلسلة تجزئة مستقلة، وهو ما تسمح به §D-18 نفسها («مجارٍ متخصصة تشترك في نفس المخطط»). `pricing_change_logs` و`provider_executions` و`transaction_status_history` **تبقى جداول مستقلة** لأن لها حقولًا خاصة.
- **الحالة:** ✅ **DOCUMENTED** — ليس تعارضًا مع ADR مجمَّد.

## ما لم يُوجَد (فحص سلبي مؤكَّد)
| الفحص | النتيجة |
|---|---|
| `Provider` يعدّل `Accounting` مباشرة | ❌ غير موجود — D9 لا يملك أي كتابة محاسبية |
| `Pricing` يعدّل `Wallet` | ❌ غير موجود — D7 لا يملك أي جدول محفظة |
| `Commission` يعدّل `Wallet` مباشرة | ❌ غير موجود — يمرّ بقيد D4 حصرًا |
| `Reconciliation` يعدّل الحقيقة المالية صامتًا | ❌ — التصحيح **قيد تسوية** بـMaker/Checker + `financial_discrepancies` |
| `Reporting` يكتب ماليًا | ❌ — راجع NF-04 |
| ازدواج مصدر حقيقة | ❌ — كل رصيد من `journal_entry_lines`؛ الـProjection مشتقة قابلة لإعادة البناء |
| بيانات قابلة للانحراف بلا كاشف | ❌ — الـProjection الوحيدة المالية تُطابَق يوميًا (طبقة 1) |
| دورة FK أخرى | ❌ — فُحصت كل مفاتيح `journal_entries` · `funding_requests` · `commission_accruals` · `disputes` · `inventory_items` · `fulfillment_records`: كلها اتجاه واحد |

## قاعدة تصميمية مُثبَّتة
> **`journal_entries.source_type/source_id` نصّان وليسا مفتاحًا أجنبيًا — عمدًا.**
> جعلهما FK إلى `transactions` (أو `funding_requests` أو غيرهما) يخلق دورة (`transactions.settlement_journal_entry_id → journal_entries`) ويمنع التعددية (مصادر مختلفة لأنواع مختلفة). الربط منطقي ومُفهرَس، لا مرجعي.

---

# 34. الحكم على اكتمال التصميم

**التصميم يغطي كل ما طلبته الفقرات 1–34 من هذه المهمة، ويجيب على الأسئلة الثمانية عشر في §40 بصفر ثغرة.**

**لا أكتب «Architecture Complete»** — وهذا مقصود:
- المعمارية **مُجمَّدة تصميميًا** لكنها **لم تُعتمَد بتوقيع** (`B-1`).
- **قرار مالي واحد جوهري ما زال `UNKNOWN`**: عملة التقرير الأساسية (`B-2`) — بدونه لا قوائم مالية موحّدة.
- **10 وثائق مصدر مفقودة** قد تحمل متطلبات إلزامية في خمسة نطاقات.

**الصياغة الدقيقة:**
> **Backend Blueprint جاهز للتنفيذ في المراحل 1A · 1B · 1C · 1D · 1E · 1F · 1K فور توقيع سجل ADR.**
> باقي المراحل مصمَّمة بالكامل وتنتظر **بيانات**، لا تصميمًا.

---

**لم يُعدَّل `spa_app-175.html` ولا أي ملف SPA. لم يُكتب كود. لم تُنشأ قاعدة بيانات ولا migrations ولا endpoints.**
**صفر نسبة عمولة أو سعر أو تكلفة أو سعر صرف أو بيانات بنكية أو بيانات اعتماد مخترعة.**
