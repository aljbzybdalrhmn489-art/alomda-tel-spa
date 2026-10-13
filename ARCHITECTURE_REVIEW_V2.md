# ARCHITECTURE_REVIEW_V2
## مراجعة معمارية نقدية ثانية — قبل بدء PostgreSQL / Backend

**الدور:** Architect مستقل يراجع عمله نقديًا
**النطاق:** مراجعة فقط — لم يُعدَّل أي ملف
**`spa_app.html`:** كما هو — SHA256 `b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8`
**`GAP_ANALYSIS.md`:** لم يُعدَّل (كما طُلب)

---

# 1. Executive Verdict

**الحكم: `GAP_ANALYSIS.md` صالح كأساس بنسبة ~80%، لكنه ليس كافيًا للبدء بحالته الحالية.**

ما صمد بعد المراجعة النقدية:
- تشخيص "مصدرَي الحقيقة" (`agent.balance`) — **صحيح ومؤكَّد بالكود**
- تشخيص غياب `HELD/RESERVED` — **صحيح ومؤكَّد** (فحصتُ 48 إشارة لكلمة "reserve" في الكود؛ **كلها تعليقات تقول "محجوز لمرحلة لاحقة"**، ولا يوجد أي آلية حجز فعلية)
- تشخيص غياب Audit Log — **صحيح** (`AdminAuditLogModuleHTML` مجرد `AdminPlaceholderBodyHTML`، شاشة فارغة)
- فصل Offline/Online — صحيح ومتوافق مع المرجع

ما سقط في المراجعة:
- **خطأ واقعي واحد مؤكَّد** (القسم 3.1)
- **9 متطلبات مفقودة** لم تُذكر إطلاقًا (القسم 2)
- **~35 حالة فشل/سباق** لم تُعالَج (القسم 7)
- **قرار معماري جوهري لم يُطرح**: Modular Monolith مقابل Microservices (القسم 5)
- **تقدير التغطية "~22%" غير مدعوم بمنهجية** — رقم انطباعي، ليس محسوبًا

**القرار:** يجب حسم **7 نقاط** (القسم 20) قبل كتابة أول جدول في PostgreSQL. بعدها، الأساس كافٍ.

---

# 2. MISSED REQUIREMENTS — ما فات GAP_ANALYSIS

استخرجتُها بتقاطع المرجع الموحد مع الـSPA الفعلي:

| # | المتطلب المفقود | المصدر | خطورته | القرار |
|---|---|---|---|---|
| **M-01** | **المندوب الميداني وإدارة الكاش** (القسم 27 من المرجع): تطبيق مندوب، استلام نقد من الوكيل عبر QR، عهدة المندوب، GPS/Device binding | المرجع §27 | متوسطة | 🔴 BUILD / ⚪ DEFER — **لم يُذكر إطلاقًا في GAP_ANALYSIS** |
| **M-02** | **Dual Control / Maker-Checker كنمط عام** — ذكرتُه كسطر واحد، لكنه في المرجع (§37) **ضابط مالي مستعرض** يجب أن يغلّف كل عملية فوق حد معيّن | المرجع §37 | **عالية** | 🔴 BUILD — كخدمة مستعرضة، لا ميزة في وحدة واحدة |
| **M-03** | **`financial_discrepancies` كآلية تلقائية** — ذكرتُه كجدول، لكن المرجع (§37) يفرض: "أي تعارض بين الرصيد الإسمي والمحسوب **يفتح discrepancy ولا يخفى**" — أي مهمة دورية إلزامية | المرجع §37 | **عالية** | 🔴 BUILD |
| **M-04** | **إغلاق مالي غير قابل لإعادة الفتح بلا صلاحية وأثر تدقيق** | المرجع §37 | عالية | 🔴 BUILD |
| **M-05** | **`agent_risk_metrics`** ككيان مستقل يغذّي قرارات الائتمان والاحتيال | المرجع §36 | متوسطة | 🔴 BUILD |
| **M-06** | **SMS Inbox/Outbox كمحرك مستقل** (DLR، retry، منع تكرار) — عالجتُه كقناة إشعار فقط، وهو في المرجع محرك كامل | المرجع §20، §36 | متوسطة | 🔵 EXPAND |
| **M-07** | **فصل الصلاحيات الوظيفي**: المرجع ينص أن SUPER ADMIN **"لا يفترض أن يرى أرصدة العملاء أو أسرارهم"** — مبدأ Segregation of Duties لم أتناوله إطلاقًا | المرجع §3 | **عالية** | 🔴 BUILD — يغيّر تصميم RBAC جذريًا |
| **M-08** | **عملة المعاملة ≠ عملة التقرير** كعمودين على كل سطر قيد — ذكرتُها عابرًا بلا أثر على التصميم | المرجع §5.3 | عالية | 🔴 BUILD |
| **M-09** | **Price Lock قصير المدى** للخدمات المقوَّمة بعملة أخرى أثناء وجود العملية في الطابور | المرجع §12 | **عالية** | 🔴 BUILD — يحل حالة "تغيّر السعر أثناء الطابور" |

---

# 3. INCORRECT DECISIONS — أخطاء في GAP_ANALYSIS يجب تصحيحها

## 3.1 خطأ واقعي مؤكَّد: محرك العكس (Reversal) موجود ولم يُنسب له حقه

**ما قلتُه:** "الاسترداد كحدث محاسبي عكسي ❌ غير موجود → 🔴 BUILD"

**الحقيقة في الكود:** `reverseJournalEntry(originalEntryId, {...})` **موجودة ومكتملة**، مع:
- `reversalOfEntryId` على القيد العكسي
- `reversedByEntryId` على القيد الأصلي
- هوية Idempotency مستقلة (`sourceType = "JOURNAL_ENTRY_REVERSAL"`)

**التصحيح:** 🟢 **KEEP + 🟠 MOVE** — المحرك المحاسبي للعكس **جاهز**. الناقص فعليًا هو **الطبقة التشغيلية فوقه** (نظام النزاعات، سياسة الاسترداد، عكس العمولة). هذا فرق جوهري: كنت سأطلب بناء ما هو مبني.

**الدرس:** GAP_ANALYSIS اعتمد على غياب *الميزة التشغيلية* واستنتج غياب *المحرك* — استنتاج غير مدعوم.

## 3.2 تقدير التغطية "~22%" غير منهجي

**المشكلة:** رقم انطباعي بلا وحدة قياس. "الأمن" وحدة واحدة و"محرك القيد المزدوج" وحدة واحدة، لكنهما ليسا متساويين في الحجم أو المخاطرة.

**التصحيح:** يُستبدل بمصفوفة مخاطرة:

| النواة | نضج SPA | مخاطرة النقل |
|---|---|---|
| المحرك المحاسبي | **عالٍ** | **منخفضة** — انقله كما هو |
| محفظة العميل/البوابات | **عالٍ** | **منخفضة** |
| التغذية اليدوية | **عالٍ** | منخفضة |
| محفظة الوكيل | متوسط | **عالية** — يحتاج تحويلًا |
| التسعير/العمولات | متوسط | متوسطة |
| المزوّدون | منخفض (محاكاة) | عالية |
| دورة المعاملة (حجز/طابور) | **معدوم** | **حرجة** |
| الأمن/التدقيق | معدوم | **حرجة** |

## 3.3 "Idempotency موجود" — دقيق جزئيًا فقط

**التصحيح:** `postJournalEntry` idempotent بمفتاح **خادمي** يمنع **القيد** المزدوج. لكنه **لا يمنع** تنفيذ **العملية** مرتين (استدعاء المزوّد مرتين). هما مستويان مختلفان تمامًا:
- **Ledger Idempotency** ✅ موجود
- **Execution Idempotency** ❌ مفقود ← يحتاج `client_ref` + قفل على مستوى المعاملة

## 3.4 لم أتناول Segregation of Duties إطلاقًا

مذكور في M-07 — يغيّر تصميم RBAC من "دور → صلاحيات" إلى **"دور → صلاحيات − محظورات صريحة"**، مع فصل: من يُنشئ ≠ من يعتمد ≠ من يراجع.

---

# 4. Final Domain Map

11 نطاقًا، بحدود صارمة:

```
┌─ SHARED KERNEL (بلا منطق أعمال) ─────────────────┐
│  Money · Currency · AccountRef · ClientRef       │
│  Result<T> · DomainEvent · Clock                 │
└──────────────────────────────────────────────────┘

D1  Identity & Hierarchy    (accounts, tree, KYC)
D2  Security & Access       (auth, sessions, devices, RBAC, fraud, audit)
D3  Accounting Core         (COA, journal, periods, FX, reversal)   ← لا يعتمد على أحد
D4  Wallet & Credit         (projections, holds, credit, insurance) → D3
D5  Funding & Gateways      (gateways, methods, claims, banks)      → D3, D4
D6  Catalog & Pricing       (services, packages, pricing, zones)    → D1
D7  Transaction Orchestrator(lifecycle, holds, queue, settlement)   → D3,D4,D6,D8
D8  Provider & Execution    (adapters, routing, health, logs)       → لا يعتمد على D7
D9  Commission              (policies, accruals, settlements)       → D3, D7
D10 Fulfillment             (vouchers, PINs, games, WiFi)           → D8
D11 Operations              (manual services, tickets, disputes, notifications)
D12 Reconciliation & Reporting                                      → قراءة فقط من الكل
```

**قاعدة منع الدوران:** الاتجاه **دائمًا نزولًا**. `D3 Accounting` لا يستدعي أحدًا إطلاقًا. `D8 Provider` لا يعرف `D7` (يُستدعى، لا يستدعي). التواصل العكسي **بالأحداث فقط** (`ProviderExecutionCompleted` → يلتقطه D7).

---

# 5. Architecture Recommendation — قرار لم يُطرح في GAP_ANALYSIS

## Modular Monolith ✅ — وليس Microservices

**الأسباب:**

1. **النواة المالية تتطلب معاملات ذرية عبر النطاقات.** حجز الرصيد + القيد + تحديث الحالة يجب أن تكون في **DB Transaction واحدة**. مع Microservices تحتاج Saga + تعويضات — وهذا **يزيد احتمال الفروق المالية**، وهو أسوأ خطر في هذا المشروع تحديدًا.
2. **حجم الفريق والمشروع.** المرجع يستهدف 100,000 عملية/يوم ≈ **~1.2 عملية/ثانية**. هذا لا يبرر بنية موزّعة إطلاقًا.
3. **وثائق مشروعكم السابقة تنص على Modular Monolith** مع إمكانية الانتقال لاحقًا — والمرجع الموحد يعترف أن هذا **قرار مفتوح** (§30).

**التوصية النهائية:** Modular Monolith بحدود صارمة، مع **Workers منفصلة العمليات** (نفس قاعدة البيانات، عمليات مستقلة). هذا يعطي عزل الفشل دون تعقيد التوزيع.

**حدود المعاملة (Transaction Boundary):** لا تتجاوز أبدًا حدود قاعدة البيانات. كل ما هو خارجي (مزوّد، بنك، SMS) **خارج المعاملة دائمًا** — يُستدعى بعد الالتزام (Commit) عبر Outbox.

---

# 6. Final Source of Truth Map

| البيان | مصدر الحقيقة | النمط | ملاحظة |
|---|---|---|---|
| كل الأرصدة (عميل/وكيل/مزوّد/بوابة) | **`journal_entry_lines`** | Append-only | **مصدر واحد بلا استثناء** |
| الأرصدة المعروضة | `wallets` | **Projection** | يُعاد بناؤها من الـLedger؛ لا تُعدَّل يدويًا |
| الرصيد المحجوز | `wallet_holds` | Mutable + Lock | حجز ≠ قيد |
| حالة المعاملة | `transactions.status` | Mutable + History | |
| نتيجة المزوّد | **المزوّد الخارجي**، مُخزَّنة في `provider_execution_logs` | Append-only | النظام **يعكس** ولا **يقرر** |
| حالة القسيمة | `voucher_inventory` | Mutable + Row Lock | |
| التحويل البنكي | **البنك الخارجي** | مُطابَق داخليًا | |
| السعر المطبَّق | `transactions.locked_price` | **مُثبَّت لحظة الحجز** | يحل مشكلة تغيّر السعر |
| سعر الصرف المطبَّق | `transactions.locked_fx_rate` | مُثبَّت | |
| الجلسة/Cache | Redis | **ليس مصدر حقيقة مالية** | فقدانه لا يفقد مالًا |
| Cache العميل | الجهاز | **ليس مصدر حقيقة إطلاقًا** | |

---

# 7. Final Transaction Lifecycle — مع كل حالات الفشل

## 7.1 الدورة

```
CREATED ──(clientRef فريد)──> VALIDATED ──> HELD ──> QUEUED
                                                       ↓
                                                  PROCESSING
                                    ┌──────────────────┼──────────────────┐
                                    ↓                  ↓                  ↓
                                 SUCCESS            FAILED         PENDING_PROVIDER
                                    ↓                  ↓                  ↓
                                 SETTLED           RELEASED      (Worker يستعلم)
                                    ↓                  ↓            ↓        ↓
                              RECONCILED          RECONCILED    SUCCESS   FAILED
```

## 7.2 إجابات أسئلتكم المالية الحرجة

**س: هل يمكن أن يختلف Wallet عن GL؟**
نعم — إن بقيت `agent.balance` قابلة للتعديل المباشر. **الحل:** المحفظة Projection مُعاد بناؤها + مهمة مطابقة دورية تفتح `financial_discrepancy` تلقائيًا.

**س: هل يمكن الخصم مرتين؟**
نعم في التصميم الحالي (لا قفل). **الحل:** `UNIQUE(client_ref)` + `SELECT … FOR UPDATE` على المحفظة داخل معاملة.

**س: هل تُحسب العمولة مرتين؟**
نعم إن ارتبطت بمحاولة التنفيذ. **الحل:** `UNIQUE(transaction_id)` على `commission_accruals` — عمولة واحدة لكل معاملة بنيويًا.

**س: نجح المزوّد ثم انهار Backend قبل الحفظ؟**
**أخطر سيناريو مالي.** الحل الوحيد: **لا تستدعِ المزوّد بلا سجل مسبق.**
```
1. اكتب provider_execution_log (status=SENT) + COMMIT
2. استدعِ المزوّد
3. اكتب الرد + COMMIT
```
عند الانهيار بين 1 و3، الـWorker يجد `SENT` معلقًا ← **يستعلم، لا يعيد التنفيذ**. المزوّد بلا `queryStatus` = **لا يجوز التنفيذ الآلي معه إطلاقًا** (سياسة إلزامية).

**س: حُفظ النجاح ولم يصل الرد للعميل؟**
العميل يعيد الإرسال بنفس `client_ref` ← الخادم يُعيد **النتيجة المحفوظة** بلا تنفيذ.

**س: Timeout؟**
`PENDING_PROVIDER` — **ليس فشلًا**. يبقى الحجز قائمًا. Worker يستعلم بتراجع أسّي حتى حسم أو تصعيد بشري. **الحجز لا يُفرَج عنه بمهلة زمنية إطلاقًا** — فقط بنتيجة مؤكدة.

**س: Worker نفّذ نفس العملية مرتين؟**
`FOR UPDATE SKIP LOCKED` + فحص الحالة داخل المعاملة (`WHERE status='QUEUED'`). إن غيّرها worker آخر، الثاني لا يجد شيئًا.

**س: تغيّر السعر أثناء الطابور؟**
`locked_price` مُثبَّت لحظة الحجز. **الطابور لا يعيد التسعير أبدًا.** (هذا M-09)

**س: تغيّر سعر الصرف؟**
`locked_fx_rate` مُثبَّت مع السعر.

**س: أُغلق الحساب أثناء وجود Pending؟**
الإغلاق **لا يكتمل** مع وجود حجوزات — يصبح `CLOSING`، ويكتمل بعد حسم كل المعلّقات.

## 7.3 حالات إضافية لم تُعالَج

| الحالة | المعالجة |
|---|---|
| نجاح المزوّد + فشل النظام في الخصم | حجز مسبق يمنعها هيكليًا |
| نفاد رصيد المزوّد أثناء الطابور | فشل مؤقت → إعادة توجيه لمزوّد آخر |
| نفاد القسائم بعد الحجز المالي | فشل + إفراج فوري |
| انتهاء صلاحية القسيمة أثناء الحجز | إبطال + اختيار بديلة |
| تغيّر Provider Mapping أثناء التنفيذ | المعاملة تحمل `provider_id` مُثبَّتًا |
| Refund لمعاملة عمولتها مُسوّاة | عكس العمولة كقيد عكسي، لا حذف |
| إيصال مكرر بصورة مختلفة | `receipt_hash` + فحص المرجع البنكي |
| رفض ثم إعادة تقديم نفس الإيصال | المرجع البنكي UNIQUE عالميًا |
| انهيار Redis | الطابور في PostgreSQL (Outbox)، Redis للتسريع فقط |
| رد المزوّد بعد الحسم اليدوي | يُسجَّل ويفتح discrepancy |

---

# 8. Final PostgreSQL Architecture — مبادئ التدقيق

| المبدأ | القرار |
|---|---|
| **المال** | `NUMERIC(20,4)` — **`FLOAT` ممنوع منعًا باتًا** |
| **العملة** | `CHAR(3)` + FK لجدول العملات؛ مع كل مبلغ **دائمًا** |
| **المفاتيح** | UUID v7 (قابل للترتيب زمنيًا) |
| **Append-only** | `journal_entries`, `journal_entry_lines`, `audit_logs`, `provider_execution_logs`, `transaction_status_history` — تُمنع `UPDATE/DELETE` بـTrigger |
| **Mutable** | `transactions`, `wallet_holds`, `voucher_inventory` |
| **Projection** | `wallets` (قابلة لإعادة البناء بالكامل) |
| **Reference** | `currencies`, `gateways`, `services` |
| **Soft Delete** | للكيانات المرجعية فقط — **ممنوع على أي شيء مالي** |
| **Optimistic Locking** | عمود `version` على `transactions` |
| **Pessimistic Locking** | `FOR UPDATE` على المحافظ، `FOR UPDATE SKIP LOCKED` على الطابور والقسائم |
| **Isolation** | `READ COMMITTED` + أقفال صريحة (لا `SERIALIZABLE` — تكلفة بلا داعٍ هنا) |

**قيود حرجة:**
- `CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))`
- توازن القيد: Trigger على مستوى القيد كاملًا
- `UNIQUE(transactions.client_ref)`
- `UNIQUE(commission_accruals.transaction_id)`
- `UNIQUE(bank_deposit_claims.receipt_hash)`
- `UNIQUE(journal_entries.reference)`
- منع القيد في فترة مغلقة: Trigger

**فهارس:** `journal_entry_lines(party_type, party_id, gateway_id, currency_code)` · `transactions(status) WHERE status IN ('QUEUED','PROCESSING','PENDING_PROVIDER')` (جزئي) · `voucher_inventory(pool_id) WHERE status='AVAILABLE'` (جزئي)

**تقسيم (Partitioning):** `journal_entry_lines` و`audit_logs` و`provider_execution_logs` شهريًا — **مُصمَّم من البداية، مُفعَّل عند الحاجة**.

---

# 9. Final Backend Architecture

```
API (REST versioned) ── Auth ── RBAC ── Idempotency Middleware
        ↓
Application Services (تنسيق فقط، بلا منطق)
        ↓
Domain Services (D1…D12) ── Shared Kernel
        ↓
Repositories ── PostgreSQL
        ↓
Outbox ──> Workers (تنفيذ · استعلام حالة · إشعارات · مطابقة · تقارير · احتيال)
        ↓
Provider Adapters ──> خارجي
```

**Outbox Pattern إلزامي:** أي أثر خارجي (استدعاء مزوّد، SMS) يُكتب في `outbox_events` **داخل نفس معاملة** تغيير الحالة. Worker يقرأ ويرسل. يضمن: لا حدث ضائع، لا حدث بلا تغيير حالة.

---

# 10. Security Architecture

```
User → Session → Device → IP → Risk Score → Permission → Transaction Auth
```

- **Auth:** Argon2id · JWT قصير + Refresh Rotation مع كشف إعادة الاستخدام
- **RBAC + Segregation of Duties** (M-07): محظورات صريحة تتفوق على المنح
- **Maker/Checker** (M-02): خدمة مستعرضة فوق حد مبلغ مُهيَّأ
- **Device Binding** + اعتماد جهاز جديد بـOTP
- **Transaction PIN** للعمليات الحساسة
- **Replay:** nonce + timestamp + `client_ref`
- **Audit:** append-only + hash-chain (`hash`/`previous_hash`) + actor/target/old/new/IP/UA
- **الأسرار:** KMS/Vault — **صفر سرّ في قاعدة البيانات أو الكود**

---

# 11. Provider Architecture

```
Provider (الكيان)
  ├── ProviderCredential  → مرجع KMS فقط
  ├── ProviderAccount     → الرصيد الممول (أصل مالي)
  ├── ProviderMapping     → (service, provider, cost, product_code, priority)
  ├── ProviderHealth      → success rate, latency, circuit state
  └── ProviderAdapter     → execute | queryStatus | cancel | getBalance
         ├── RestAdapter · SoapAdapter · SmppAdapter · UssdAdapter · GsmModemAdapter
```

**العقد الموحد:** كل Adapter يُعيد **حالة معيارية** من قائمة النظام. **البروتوكول لا يتسرب إلى النواة إطلاقًا** — النواة تعرف `execute(request) → StandardResult` فقط.

**قاعدة إلزامية:** مزوّد بلا `queryStatus` **لا يُسمح له بالتنفيذ الآلي** — لأن Timeout معه يصبح غير قابل للحسم.

**Routing:** المنطقة → التوفر (Circuit Breaker) → رصيد كافٍ → الأولوية → التكلفة.
**Circuit Breaker:** CLOSED → OPEN (بعد فشل متتالٍ) → HALF_OPEN.

---

# 12. Pricing / Commission Architecture — منظومة واحدة

```
Provider Cost (D8)
   ↓
Base Price (Service)
   ↓
Zone Adjustment
   ↓
Pricing Group / Tier
   ↓
Hierarchy Distribution (Master → Sub → Agent → POS)
   ↓
Custom Override (بصلاحية)
   ↓
══ MARGIN GUARD ══  ← بوابة إلزامية
   ↓
Customer Price  +  Commission Split  +  System Margin
```

**قاعدة Margin Guard غير القابلة للتجاوز:**
```
Customer Price − Provider Cost − Σ(All Commissions) ≥ 0
```
تُفحص **مرتين**: عند حفظ سياسة التسعير (منع التهيئة الخاطئة)، وعند الحجز (منع التنفيذ الخاطئ). أي تجاوز يحتاج استثناءً مصرَّحًا **مُسجَّلًا في التدقيق**.

**دورة العمولة:** `PENDING` (عند النجاح) → `HELD` (فترة نزاع) → `SETTLED` → `REVERSED` (عند الاسترداد). العكس **قيد عكسي**، لا حذف.

---

# 13. Digital / WiFi Architecture

**القرار: محرك تسليم رقمي واحد (`Digital Fulfillment Engine`) بـStrategies — لا ثلاثة محركات.**

```
FulfillmentEngine
  ├── DirectIdStrategy   (ألعاب: validate → topup)
  ├── PinPoolStrategy    (بطاقات/قسائم: claim → deliver)
  ├── ApiPinStrategy     (طلب PIN من المزوّد)
  ├── ManualStrategy     (طابور بشري)
  └── WifiVoucherStrategy(مخزون أو توليد MikroTik/RADIUS)
```

**السبب:** الاختلاف بينها في **كيفية الحصول على المُنتَج**، لا في دورة الحياة (حجز → تسليم → تسوية) — وهي واحدة. محرك واحد يعني: خدمة مستقبلية = Strategy جديدة فقط.

**قفل المخزون الذري:**
```sql
SELECT id FROM voucher_inventory
WHERE pool_id = $1 AND status = 'AVAILABLE'
ORDER BY expiry_at NULLS LAST
FOR UPDATE SKIP LOCKED LIMIT 1;
```
**PIN:** مشفَّر في الراحة، **يُفك عند التسليم فقط**، لا يُسجَّل في أي Log إطلاقًا.

**WiFi:** `WifiDomain` (شبكات/ملاك/بروفايلات) منفصل عن `MikrotikAdapter`/`RadiusAdapter` (خلف نفس واجهة Provider Adapter) — الاقتصاد (حصة المالك / عمولة الوكيل / ربح النظام) يُحسب في `D9 Commission`، لا في وحدة WiFi.

---

# 14. Offline / Online Architecture

| الطبقة | Offline | التخزين |
|---|---|---|
| الكتالوج | ✅ قراءة | Cache + version stamp |
| آخر رصيد | ✅ **بختم زمني إلزامي** | Cache |
| كشوف سابقة | ✅ | Cache |
| مسودة طلب + إيصال | ✅ | Local Staging + `client_ref` |
| ⛔ أي حركة مالية | **ممنوع** | — |

**منع اعتبار العملية ناجحة Offline — ثلاث طبقات:**
1. **بيانيًا:** لا توجد حالة `SUCCESS` محليًا. الحالات المحلية: `DRAFT` / `PENDING_SYNC` فقط.
2. **بصريًا:** المسودة تظهر بلون/أيقونة مختلفة صراحة ("بانتظار الإرسال")، والرصيد يظهر دائمًا بختم "آخر تحديث…".
3. **بنيويًا:** الرصيد المعروض **لا يتغير محليًا أبدًا** — يتحدث فقط من رد الخادم.

**المزامنة:** عند عودة الاتصال → إرسال بـ`client_ref` → الخادم يحسم → الواجهة تعكس رد الخادم حصرًا.

---

# 15. Reconciliation Architecture

| الطبقة | المقارنة | التكرار | عند الفرق |
|---|---|---|---|
| Wallet ↔ Ledger | Projection مقابل مجموع القيود | **يومي + عند كل إقفال** | `financial_discrepancy` تلقائي (M-03) |
| Transactions ↔ Provider | سجلاتنا مقابل سجل المزوّد | يومي | تصنيف + حسم |
| Funding ↔ Bank | مطالبات مقابل كشف البنك | يومي | UNCLAIMED/MATCHED |
| Commission ↔ Ledger | استحقاقات مقابل القيود | يومي | فرق |

**الدورة:** Detect → Classify → Resolve (آلي/يدوي) → Adjust (**قيد تسوية، لا تعديل**) → Audit → Close.
**قاعدة:** لا تُغلق فترة مالية وفيها فرق غير محسوم.

---

# 16. Reporting Architecture

| التقرير | الاستراتيجية |
|---|---|
| رصيد لحظي | Projection (فوري) |
| كشف حساب | Live Query + فهرس + ترقيم |
| Trial Balance / P&L / Balance Sheet | **Materialized View** (تحديث ليلي + عند الطلب) |
| الربحية حسب الخدمة | Materialized View |
| أداء المزوّدين | Materialized View |
| المطابقة | Background Job |
| تصدير ضخم | **Streaming/Cursor** — لا تحميل في الذاكرة |

كل تقرير يحمل: المصدر · العملة · الفلاتر · النطاق الزمني · **فحص صلاحية إلزامي (عزل حسب الفرع)**.

---

# 17. DR / HA — مراجعة نقدية للأرقام

**الحكم: `RPO = 0` غير واقعي وغير مبرر لهذا المشروع.**

- `RPO = 0` يتطلب **Synchronous Replication** ← يضاعف زمن كل كتابة، ويجعل توقف النسخة الثانوية **يوقف النظام كله**. لمنصة بـ~1.2 عملية/ثانية، هذا ثمن باهظ بلا مقابل.
- المرجع نفسه يعترف بالتعارض (§30: "أقل من ثانية، وفي ملف آخر صفر").

**البديل الموصى به:**

| المؤشر | التوصية | السبب |
|---|---|---|
| RPO | **< 5 ثوانٍ** (نسخ غير متزامن + WAL مستمر) | خسارة قصوى = ثوانٍ من المعاملات، **كلها قابلة للاسترجاع من `client_ref`** |
| RTO | **< 30 دقيقة** (تبديل يدوي مُختبَر) | التبديل الآلي يخلق خطر Split-Brain أكبر من الفائدة |
| الإتاحة | **99.9%** | 99.99% = ~52 دقيقة/سنة، يتطلب استثمارًا لا يبرره الحجم |

**الأهم من الأرقام:** WAL + PITR + نسخ خارجية غير قابلة للتعديل + **اختبار استرجاع فعلي دوري** + Idempotent Replay. نسخة احتياطية غير مُختبَرة = لا نسخة.

---

# 18. ALOMDA ADVANTAGES — تفوّق حقيقي، لا زيادة ميزات

| # | التحسين | المشكلة | لماذا أفضل | التكلفة | القرار |
|---|---|---|---|---|---|
| **A-1** | **بُعد `gateway_id` على سطر القيد** | عزل أرصدة بوابات تشترك بنفس العملة | حساب تحكم **واحد** بدل تفجير شجرة الحسابات؛ مطابقة أسهل. **مبني ومختبَر في SPA** | صفر (موجود) | 🟢 KEEP |
| **A-2** | **صفر رصيد مخزَّن قابل للتعديل** | مصدر حقيقة ثانٍ | كل الأرصدة Projections قابلة لإعادة البناء — **الفروق تصبح مستحيلة بنيويًا، لا مُكتشَفة لاحقًا** | متوسطة | 🔵 EXPAND |
| **A-3** | **`verification_unavailable` كسلوك صادق** | أنظمة تلفّق نجاحًا | رفض بنيوي لتزوير النتائج. **مبني في SPA** | صفر | 🟢 KEEP |
| **A-4** | **البنية المدفوعة بالبيانات** | كل مؤسسة جديدة = كود جديد | إضافة بنك/محفظة = **بيانات فقط**، مُثبَت اختباريًا | صفر | 🟢 KEEP |
| **A-5** | **Price Lock + FX Lock عند الحجز** | تغيّر السعر أثناء الطابور | العميل يدفع ما رآه. المرجع لا يعالجها | منخفضة | 🔴 BUILD |
| **A-6** | **إلزام `queryStatus` قبل السماح بالتنفيذ الآلي** | Timeout غير قابل للحسم | يمنع فئة كاملة من الأموال الضائعة. **لا يوجد في المرجع** | منخفضة | 🔴 BUILD |
| **A-7** | **مطابقة يومية تلقائية تفتح Discrepancy** | فروق تُكتشف متأخرة | كشف خلال 24 ساعة بدل شهور | متوسطة | 🔴 BUILD |
| **A-8** | **Margin Guard على مستويين** (تهيئة + تنفيذ) | بيع بخسارة | يمنع الخطأ **قبل** حدوثه، لا يكتشفه بعده | منخفضة | 🔴 BUILD |
| **A-9** | **Outbox Pattern** | حدث ضائع/مكرر | ضمان رياضي: لا أثر خارجي بلا تغيير حالة | متوسطة | 🔴 BUILD |
| **A-10** | **ختم زمني إلزامي على كل رصيد معروض Offline** | ثقة زائفة برصيد قديم | صدق واجهة يمنع قرارات خاطئة | منخفضة | 🔴 BUILD |
| **A-11** | **محرك تسليم رقمي واحد بـStrategies** | 3 محركات متوازية | خدمة جديدة = Strategy فقط | منخفضة | 🔴 BUILD |

---

# 19. Overengineering to Avoid

| العنصر | القرار | السبب |
|---|---|---|
| Microservices الآن | ⚫ **REMOVE** | يزيد خطر الفروق المالية؛ الحجم لا يبرره |
| Kafka | ⚫ REMOVE | PostgreSQL Outbox + Redis كافيان تمامًا لهذا الحجم |
| `RPO = 0` | 🟡 **SIMPLIFY** | تكلفة هائلة بلا مقابل (§17) |
| AI / التنبؤ / Credit Score | ⚪ **DEFER** | قبل اكتمال النواة المالية = خطأ فادح |
| Open Banking / SoftPOS / تحويلات دولية | ⚪ DEFER | Roadmap 2027-2028 |
| OCR للإيصالات | ⚪ DEFER | المرجع نفسه يجعله اختياريًا |
| SMS/USSD Fallback للمعاملات | 🟡 SIMPLIFY | المرجع يصفه "legacy/fallback"؛ يُبنى عند إثبات الحاجة |
| عشرات أنواع المحافظ | 🟡 SIMPLIFY | ابدأ بـ4: Main · Commission · Insurance · Customer |
| شجرة حسابات 6 مستويات | 🟡 SIMPLIFY | **4 مستويات كافية**؛ العمق الزائد يعقّد التقارير بلا فائدة |
| Microservice DB لكل نطاق | ⚫ REMOVE | يكسر ذرية المعاملات المالية |

---

# 20. القرارات السبعة الواجب حسمها قبل أول جدول

| # | القرار | التوصية |
|---|---|---|
| **1** | Modular Monolith أم Microservices؟ | **Modular Monolith** (§5) |
| **2** | متى تتحول `agent.balance` إلى Projection؟ | **المرحلة 1، قبل بناء أي شيء فوقها** |
| **3** | عمق شجرة الحسابات | **4 مستويات** |
| **4** | RPO/RTO | **RPO<5s / RTO<30min / 99.9%** (§17) |
| **5** | تقنية الطابور | **PostgreSQL Outbox + Redis/BullMQ** |
| **6** | تمثيل المال | **`NUMERIC(20,4)`** — قرار غير قابل للتراجع لاحقًا |
| **7** | Segregation of Duties في RBAC | **نعم** (M-07) — يغيّر التصميم جذريًا |

---

# 21. Final Implementation Order

| # | المرحلة | معيار القبول |
|---|---|---|
| **0** | القرارات السبعة + هيكل المشروع + Shared Kernel | كل قرار موثَّق كـADR |
| **1** | PostgreSQL + Accounting Core + Audit | Trial Balance متوازن · القيود append-only بـTrigger · صفر تعديل مالي بلا أثر |
| **2** | Auth + RBAC + SoD + Sessions/Devices | صفر كلمة مرور في الكود · كل Endpoint محمي · SoD مُطبَّق |
| **3** | نقل Wallet + **تحويل `agent.balance`** + Holds | مجموع المحافظ = التزامات GL · مطابقة يومية عاملة |
| **4** | الهرمية + KYC | شجرة عاملة · عزل التقارير |
| **5** | دورة المعاملة: `client_ref` + Hold + Outbox + Workers | لا خصم بلا حجز · Timeout→Pending→حسم · لا تنفيذ مزدوج تحت الضغط |
| **6** | Provider Adapter + Routing + Health | مزوّد حقيقي واحد يعمل + سجل raw + استعلام حالة |
| **7** | Pricing + Commission + Margin Guard | Waterfall صحيح · استحالة بيع بخسارة · عكس عمولة عند الاسترداد |
| **8** | Fulfillment (قسائم/ألعاب/WiFi) | قفل ذري مُثبَت تحت تنفيذ متزامن |
| **9** | Funding + Bank Reconciliation | منع إيصال مكرر · مطابقة بنكية |
| **10** | Disputes + Tickets + Notifications | استرداد كقيد عكسي حصرًا |
| **11** | Reporting + 4 طبقات مطابقة | P&L صحيح · كشف تلقائي للفروق |
| **12** | DR/HA/Monitoring | **اختبار استرجاع فعلي ناجح** |

---

# 22. الحكم النهائي

**هل الأساس كافٍ لبدء PostgreSQL + Backend؟**

**نعم — بشرط حسم القرارات السبعة أولًا (§20).**

**ما يجب الاستفادة منه بالكامل:** المحرك المحاسبي بالقيد المزدوج، **محرك العكس (الذي أخطأ GAP_ANALYSIS في اعتباره مفقودًا)**، محفظة العميل المشتقة، بُعد البوابة، دورة التغذية اليدوية، البنية المدفوعة بالبيانات، فصل السعر عن التكلفة. هذه **منطق أعمال مُثبَت باختبارات** — تُنقل، لا يُعاد اختراعها.

**ما يجب عدم نقله:** `localStorage` كمخزن، كلمات المرور النصية، `agent.balance` كحقل قابل للتعديل، أي منطق مالي في المتصفح، صور Base64.

**التحذير الأهم:** الخطر الأكبر ليس في بناء الجديد، بل في **نقل `agent.balance` كما هي** — عندها يصبح مصدر الحقيقة الثاني دَينًا تقنيًا دائمًا يستحيل التخلص منه لاحقًا.

**ما لا يزال محجوبًا خارجيًا (لا يمنع البدء):** وثائق API البنوك · بيانات 12 باقة تيليكوم · أرقام الحسابات الحقيقية · بيانات MikroTik. المراحل 0–5 و7 و11 **لا تعتمد على أي منها**.

---

**لم يُعدَّل أي ملف. `GAP_ANALYSIS.md` كما هو. `spa_app.html` كما هو.**
