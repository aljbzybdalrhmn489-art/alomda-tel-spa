# SPA_LOGIC_CORRECTION_REPORT
## Phase 0.5 — SPA Logic Correction Before Backend

**المرجع الملزم:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` (ADR-101 → ADR-119)
**التاريخ:** 2026-09-07
**النطاق المنفَّذ:** تصحيح منطق SPA قائم فقط. **لا Backend · لا PostgreSQL · لا migrations · لا refactor شامل · لا T0/T1/T2.**

---

## A. SHA256 Before
```
b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8   spa_app-175.html   (40,800 سطر)
```

## B. SHA256 After
```
7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1   spa_app-175.html   (41,023 سطر)
```
**نعم — تغيّر SHA256.** الفرق +223 سطرًا، أغلبها تعليقات توثيق الإصلاح.

## C. Files Modified
| الملف | التغيير |
|---|---|
| `spa_app-175.html` | **الملف الوحيد المُعدَّل** — 13 تعديلًا منفصلًا |

## D. Files Created
| الملف | الغرض |
|---|---|
| `SPA_LOGIC_CORRECTION_AUDIT.md` | مراجعة ما قبل التعديل (إلزامية §2) — 15 مخالفة مصنَّفة |
| `SPA_LOGIC_CORRECTION_REPORT.md` | هذا التقرير |

**ملفات مؤقتة خارج المشروع** (في مجلد الجلسة المؤقت، ليست جزءًا من المستودع): `spa_script.js` · `spa_core.js` · `spa_final.js` · `spa_core2.js` · `stubs.js` · `test_phase05.js` · `t4.js` · `t_render.js`

## E. Files Deleted
**لا شيء.** لم يُحذف ولم يُعَد تسمية أي ملف.

---

## F. Exact Functions Modified

| # | الدالة / الرمز | نوع التغيير |
|---|---|---|
| 1 | `reverseJournalEntry()` | **FIX** — نسخ أبعاد السجل الفرعي |
| 2 | `settlePackagePurchase()` | **FIX** — حارس كفاية + إرجاع نتيجة |
| 3 | `isAgentBalanceSufficient()` | **NEW (helper استخراج)** — القاعدة المشتركة، من منطق قائم |
| 4 | `validateAgentBalanceForManualService()` | **MODIFY** — تستخدم الـhelper المشترك |
| 5 | `runPackagePurchase()` | **MODIFY** — يفشل بدل النجاح الكاذب |
| 6 | `runInternetPackagePurchase()` | **MODIFY** — نفس الشيء |
| 7 | `runLandlinePackagePurchase()` | **MODIFY** — نفس الشيء |
| 8 | `purchaseWifiProduct()` | **MODIFY** — يرفض قبل استهلاك المخزون |
| 9 | `settleDigitalCatalogPurchase()` | **MODIFY** — يجهض قبل أي محاسبة مزوّد |
| 10 | `handleGamePurchaseOutcome()` + مسارا التوجيه (3 مواقع) | **MODIFY** — يفشل بدل النجاح الكاذب |
| 11 | `saveAgentForm()` | **RETIRE** — الإنشاء بصفر دائمًا |
| 12 | `ADMIN_AGENT_FORM_FIELDS_ADD_ONLY` | **RETIRE** — حذف حقل «الرصيد الافتتاحي» |
| 13 | `creditWifiNetworkOwnerForSale()` | **RETIRE** — إيقاف تحوير الرصيد وكتابة الـLedger |
| 14 | `computeCustomerGatewayPrice()` | **FIX** — تقريب بعملة البوابة |
| 15 | `createFinancialAccount()` | **MODIFY** — منع إنشاء حساب COA تلقائي |
| 16 | `setProviderAccountBalance()` | **ANNOTATE** — وسم LEGACY (بلا تغيير سلوكي) |
| 17 | `GATEWAY_EXCHANGE_RATES` | **ANNOTATE** — وسم PLACEHOLDER · DEAD |
| 18 | `SimulationNoticeHTML()` + `SIMULATION_REFERENCE_LABEL` | **NEW (عرض فقط)** |
| 19 | `RechargeSuccessState()` · `WholesaleSuccessState()` · `PostpaidSuccessState()` · `InternetManualResultAreaHTML()` · `LandlineResultAreaHTML()` | **MODIFY** — تصحيح ادعاء النجاح المالي |

---

## G. Exact Bugs Fixed

### BUG-1 · القيد العكسي لا يصل إلى أي سجل فرعي — **CRITICAL**
`reverseJournalEntry()` كان ينسخ 5 حقول فقط من 13، مُسقِطًا `partyType` · `partyId` · `gatewayId`. و`postJournalEntry()` يعوّضها `null`. النتيجة: سطر العكس **لا يطابق أي مرشِّح طرف**، فلا يدخل رصيد عميل ولا وكيل ولا مزوّد، **ولا يظهر حتى في كشف الحساب** — بينما القيد متوازن والحساب الرقابي سليم. عطب صامت تمامًا.
**الإصلاح:** نسخ الأبعاد الثلاثة الموجودة فعليًا في شكل السطر. **لم تُخترع أبعاد غير موجودة.**
**مُثبَت بالاختبار:** رصيد 5,000 → عكس → **0** ✅ · سطرا العكس يحملان الأبعاد ✅ · العكس يظهر في الكشف ✅

### BUG-2 · خصم بلا فحص كفاية — رصيد سالب ممكن — **CRITICAL**
`settlePackagePurchase()` كان يخصم بلا أي فحص، ومستدعوه الخمسة لا يفحصون. الملف نفسه يفرض «لا يمكن أن يصبح الرصيد سالباً» في `saveBalanceAdjust` — **تعارض داخلي**.
**الإصلاح:** استخراج القاعدة القائمة في `isAgentBalanceSufficient()`؛ الدالة ترفض وتُرجع نتيجة بلا أي تحوير؛ **كل مستدعٍ (5 لـ`settlePackagePurchase` + 3 لـ`settleDigitalCatalogPurchase`) يعرض فشلًا** بدل شاشة نجاح لعملية لم تُدفَع. الواي فاي يرفض **قبل** تعليم أي كرت مباعًا.
**لم يُخترع حد ائتمان ولا سياسة سحب على المكشوف.**
**مُثبَت بالاختبار:** رصيد 100 وطلب 500 → رفض · الرصيد بقي 100 · **صفر** سطر في `WALLET_LEDGER` ✅

### BUG-3 · `initialBalance` ينشئ مالًا بلا قيد — **HIGH**
إنشاء وكيل كان يكتب `balance: Number(f.initialBalance) || 0` — مركز مالي غير صفري **بلا قيد وبلا سجل حركات**، من اللحظة الأولى.
**الإصلاح:** `balance: 0` دائمًا + حذف الحقل من نموذج الإدارة. مفتاح `initialBalance` بقي في شكل حالة النموذج فقط (لا يُقرأ كمال) لعدم كسر أي مسار.
**بيانات الوكلاء القائمة لم تُمس** — بيانات ترحيل (ADR-104).

### BUG-4 · تحوير رصيد بلا قيد محاسبي إطلاقًا — **HIGH**
`creditWifiNetworkOwnerForSale()` كان الموقع **الوحيد** في الملف الذي يزيد رصيدًا و يكتب في `WALLET_LEDGER` **دون أي `postJournalEntry`**، ويقرّب بمعامل ثابت بلا عملة.
**الإصلاح:** إيقاف التحوير وإيقاف كتابة الـLedger. تُرجع الأرقام المحسوبة مع `settled: false` و`currencyCode: null`. **لم يُخترع قيد بديل ولا عملة.** القيمة المُرجَعة مُهمَلة عند المستدعي الوحيد ← **صفر أثر على الواجهة**.

### BUG-5 · خمسة مسارات تدّعي نجاحًا ماليًا — **CRITICAL**
`runRecharge` · `runWholesalePurchase` · `runPostpaidPayment` · `runLandlinePayment` · `runInternetManualPayment` تُحسم بـ`Math.random()` داخل `setTimeout`، **بلا مزوّد ولا خصم ولا قيد ولا سجل مشتريات**، وتعرض «تم بنجاح» + رقم مرجع.
**الإصلاح (عرض فقط):** لافتة صريحة في الشاشات الخمس — «محاكاة — لم تُنفَّذ حركة مالية: لم يُخصم أي رصيد · لم يُنشأ أي قيد محاسبي · لم يُنفَّذ الطلب لدى أي مزوّد» — وعنوان «اكتملت المحاكاة» بدل «تم … بنجاح»، و«مرجع محاكاة» بدل «رقم المرجع». **لم يُبنَ تنفيذ حقيقي ولم تُدخَل أرقام جديدة.**
**مُثبَت بالاختبار:** الخمس تُنفَّذ بلا خطأ · **5/5** تحمل اللافتة · **0/5** تقول «رقم المرجع» ✅

### BUG-6 · تقريب ثابت في مسار له عملة معلومة — **MEDIUM**
`computeCustomerGatewayPrice()` كان يستخدم `Math.round(x*100)/100` رغم أن `gateway.defaultCurrencyCode` في النطاق.
**الإصلاح:** `roundToCurrencyDecimals(..., gateway.defaultCurrencyCode)`. **لم يُلمس أي موقع تقريب بلا عملة** (تخمين ممنوع).

### FIX-7 · إنشاء حساب COA لكل حساب مالي — **MEDIUM (كامن)**
`createFinancialAccount()` كان يُنشئ حساب أصول جديدًا («FA-…») لكل حساب مالي ← `BANK_1/BANK_2/…`، ضد ADR-103.
**الإصلاح:** `linkedAccountId` أصبح إلزاميًا؛ الإنشاء التلقائي مُغلق. **صفر أثر سلوكي** (صفر مستدعٍ · الدليل فارغ). **لم تُعَد شجرة الحسابات تصميمًا.**

---

## H. ADR لكل إصلاح

| الإصلاح | ADR |
|---|---|
| BUG-1 القيد العكسي | **ADR-110** (العكس ينسخ الأبعاد) · **ADR-103** (الأبعاد = السجل الفرعي) · D-10.5 |
| BUG-2 كفاية الرصيد | **ADR-105** (`Available` بوابة إلزامية) · ADR-107 (`HELD` قبل التنفيذ) |
| BUG-3 `initialBalance` | **ADR-104** (D-04.3 — RETIRE) |
| BUG-4 رصيد مالك الواي فاي | **ADR-104** (D-04.4) · **ADR-106** (الحصة عبر العمولة) · ADR-102 |
| BUG-5 مسارات المحاكاة | **ADR-115** (لا `SUCCESS` مالي محلي) · ADR-107 |
| BUG-6 التقريب | **ADR-102** |
| FIX-7 حساب COA لكل بنك | **ADR-103** (D-03) |
| وسم `providerAccount.balance` | **ADR-104** (D-04.5) |
| وسم `GATEWAY_EXCHANGE_RATES` | **ADR-101** (2.94 = PLACEHOLDER) |

---

## I. What Was NOT Modified

**لم يُمس إطلاقًا:** التصميم العام · التنقّل · الثيم · الهوية البصرية · شاشات الكتالوج الصحيحة · واجهة الدعم · مصفوفات الصلاحيات · شاشات الإدارة (عدا حقل واحد) · بذور الوكلاء (1,005,100 ر.ي — بيانات ترحيل) · `PersistenceStore` · نموذج الجلسة · محرك التوزيع والعمليات · دورة التغذية اليدوية · بيانات المزوّدين · `CURRENCY_DIRECTORY` · `COMMISSION_POLICY_DIRECTORY` (فارغ ويبقى).

**لم يُنشأ أي مصدر حقيقة مالي جديد** — لا محفظة جديدة، لا دفتر جديد، لا حساب عمولة جديد، لا قيد محلي مخترع.
**صفر قيمة مخترعة** — لا نسبة عمولة، لا سعر، لا تكلفة مزوّد، لا سعر صرف، لا حساب بنكي.

---

## J. What Remains Backend-only

| # | البند | لماذا لا يُنفَّذ في SPA |
|---|---|---|
| 1 | **قطع `agent.balance`** (6 مسارات كتابة حية) | ADR-104 يحدد القطع في **T2 داخل الـBackend**. تنفيذه هنا يكسر SPA بلا Projection. §4.1 يمنعه صراحة |
| 2 | **`WALLET_LEDGER` → `legacy_wallet_ledger`** | ADR-104 · أرشفة تخص الترحيل. لم تُضف كتابة جديدة؛ حُذفت الكتابة الوحيدة بلا قيد (الواي فاي) |
| 3 | **إسقاط `providerAccount.balance`** | ADR-104 · الحقل خامد (صفر مستدعٍ خارجي)؛ حذفه الآن يكسر شاشات إدارة تقرؤه |
| 4 | **Commission Wallet** (`COMMISSION-PAYABLE`) | ADR-106 · بناؤه في SPA = مصدر حقيقة ثالث (ممنوع §6). النسب `UNKNOWN` |
| 5 | **تقريب بلا عملة** (8 مواقع) | ADR-102 · لا مصدر عملة؛ `settleAgentCommissions` يقبل عملة لكن **مستدعيه الوحيد لا يمررها** — استبدال = تخمين |
| 6 | **فصل `YER` / `YEO`** | ADR-101 · يمسّ كل عمود مبلغ. §4.9 يمنع إعادة بناء محرك العملة الآن |
| 7 | **تكلفة المزوّد للتيليكوم/الواي فاي/اليدوية** | ADR-110 · يتطلب `settlement_model` + عملة، وكلاهما `UNKNOWN`. اختراع تكلفة ممنوع |
| 8 | **تنفيذ حقيقي للمسارات الخمس** | ADR-107 · يتطلب معاملة + حجز + مزوّد + تسوية |
| 9 | **آلة حالة المعاملة · Idempotency · Outbox · Offline · SoD · Audit موحّد · Hierarchy · Disputes** | كل نطاقات `BUILD` في القسم J من وثيقة التجميد |

---

## K. Remaining Known Violations

**مخالفات باقية عمدًا** — كلها معروفة، مخططة، ومحصورة:

| # | المخالفة | الحالة | الخطة |
|---|---|---|---|
| RV-1 | `agent.balance` مصدر حقيقة ثانٍ — **6 مواقع كتابة حية**: `settleAgentCommissions` · `transferWalletFunds`×2 · `saveBalanceAdjust` · `settlePackagePurchase` · `chargeAgentForManualService` | نشطة | ADR-104 · T2 |
| RV-2 | `WALLET_LEDGER` دفتر موازٍ — **6 مواقع كتابة** (كانت 7) | نشطة | ADR-104 · أرشفة |
| RV-3 | **8 مواقع تقريب ثابت** بلا عملة | نشطة | ADR-102 · BLOCKER-2 |
| RV-4 | نموذج العمولة القديم (`agent.balance += commission`) | نشطة | ADR-106 |
| RV-5 | `YER` واحدة تمثل المنطقتين + `YER_NEW`/`YER_OLD` في طبقة العرض فقط | نشطة | ADR-101 |
| RV-6 | تكلفة المزوّد غير مُسجَّلة إلا للكتالوج الرقمي | نشطة | ADR-110 |
| RV-7 | `providerAccount.balance` موجود كحقل (خامد · موسوم) | خامدة | ADR-104 |
| RV-8 | `GATEWAY_EXCHANGE_RATES = 2.94` موجود (**كود ميت · موسوم**) | غير تشغيلية | ADR-101 |
| RV-9 | بذور 4 وكلاء بـ1,005,100 ر.ي بلا قيد | بيانات | ADR-104 · Opening Balance |
| RV-10 | كلمات مرور نصية في `localStorage` · صفر فرض أمني خادمي | نشطة | ADR-113 · خارج نطاق هذه المرحلة |

> **لا يجوز وصف الـSPA بأنه «متوافق بالكامل».** هو **أقل مخالفة وأكثر صدقًا** مما كان، والمخالفات الباقية موثَّقة ومسندة إلى ADR.

---

## L. Test Results

### L.1 مجموعة اختبارات المشروع
```
TEST SUITE NOT PRESENT / NOT VERIFIABLE
```
`find` على المشروع كاملًا: **صفر** ملف `test_*.js` · صفر `*.spec.js` · صفر `*.test.js` · صفر `package.json`.
**لم يُشغَّل الادعاء «1530/1530» ولا يمكن التحقق منه.** لم تُخترع أي نتيجة.

### L.2 التحقق من الصياغة
```
node --check  (السكربت المستخرج، 40,934 سطرًا)  →  OK
```

### L.3 مجموعة تحقق Phase 0.5 (كُتبت لهذه المرحلة، خارج المشروع)
**37 تأكيدًا · 37 نجاح · 0 فشل**

| المجموعة | التأكيدات | النتيجة |
|---|---|---|
| **T1** `reverseJournalEntry` يحفظ الأبعاد | 10 | ✅ |
| **T2** `settlePackagePurchase` يرفض عند عدم الكفاية | 6 | ✅ |
| **T3** `isAgentBalanceSufficient` | 4 | ✅ |
| **T4** `creditWifiNetworkOwnerForSale` بلا تحوير (كود تنفيذي فقط) | 6 | ✅ |
| **T5** `createFinancialAccount` يرفض الإنشاء التلقائي | 1 | ✅ |
| **T6** `roundToCurrencyDecimals` يحترم YER=0 | 2 | ✅ |
| **T7** الشاشات الخمس المعدَّلة تُنفَّذ وتحمل اللافتة | 8 | ✅ |

**تفصيل T1 (أهم اختبار):**
```
post: Dr CUSTOMER-RECEIVABLE 5000 [customer/cus_test_1]
      Cr CUSTOMER-WALLET-LIABILITY 5000 [customer/cus_test_1, gateway=standard]
getCustomerWalletBalance = 5000            ✅
reverse → سطرا العكس يحملان partyType/partyId/gatewayId   ✅
getCustomerWalletBalance = 0               ✅  (قبل الإصلاح كانت تبقى 5000)
الكشف يعرض صفّين (الأصلي + العكس)          ✅
```

**ملاحظة منهجية:** تأكيدان في المحاولة الأولى لـT4 فشلا **بسبب خطأ في الاختبار لا في الكود** — كان يبحث نصيًا فيشمل التعليق الذي يقتبس الكود المُلغى حرفيًا. أُعيدت كتابته ليجرّد التعليقات ويفحص الكود التنفيذي فقط: **6/6 نجاح**.

**لم يُجرَ اختبار متصفح فعلي** (لا Playwright ولا Chromium في مساحة العمل). التحقق من الشاشات تمّ بتنفيذ دوال العرض الخمس في Node مع بدائل DOM دنيا.

---

## M. Static Scan Results
*(بتجريد التعليقات — كود تنفيذي فقط)*

| الفحص | قبل | بعد | النتيجة |
|---|---|---|---|
| `.balance` mutations (تنفيذي) | 10 | **9** | −1 (الواي فاي) |
| منها **مالية على طرف** | 7 | **6** | RV-1 |
| منها غير مالية / آمنة | 3 | 3 | `mobile.balance` UI · `a.balance=0` ترقية · `account.balance` خامد |
| `Math.round(x*100)/100` (تنفيذي) | 10 | **8** | −2 |
| `providerAccount.balance` (تنفيذي) | 0 | **0** | خامد |
| `ownerEntity.balance` (تنفيذي) | 3 | **1** | فحص نوع فقط — **صفر تحوير** |
| `initialBalance` (تنفيذي) | 4 | **3** | كلها `initialBalance: ""` — **صفر قراءة كمال** |
| `GATEWAY_EXCHANGE_RATES.` قراءة | 1 | 1 | داخل **دالة ميتة (0 مستدعٍ)** |
| `convertNorthPriceToSouthGateway()` مستدعون | 0 | **0** | كود ميت مؤكَّد |
| `createWalletLedgerEntry({` calls | 7 | **6** | −1 (الواي فاي) |
| `settlePackagePurchase()` مستدعون | 5 | 5 | **5/5 محروسون** ✅ |
| `settleDigitalCatalogPurchase()` مستدعون | 3 | 3 | **3/3 محروسون** ✅ |
| `SimulationNoticeHTML()` | — | **5** | الشاشات الخمس |
| `SIMULATION_REFERENCE_LABEL` | — | **5** | الخمس |
| `createFinancialAccount()` مستدعون | 0 | 0 | خامد + محروس |
| `YER_NEW` / `YER_OLD` | 2 / 1 | 2 / 1 | طبقة عرض/محاكاة فقط — RV-5 |

---

## N. Migration Impact

| الأثر | التفصيل |
|---|---|
| **إيجابي — يقلّل عمل الترحيل** | القيد العكسي أصبح صحيحًا → مسار `REVERSED` في الـBackend يُبنى على منطق سليم لا معطوب. الفحص الأمني للرصيد أصبح موجودًا → نمذجة `HELD` تجد سلوكًا متسقًا |
| **إيجابي — يوقف نمو الدين** | لا رصيد افتتاحي صامت جديد · لا حساب COA جديد لكل بنك · لا حركة مالية جديدة بلا قيد (الواي فاي) · موقعا تقريب أقل |
| **محايد — بيانات** | `WALLET_LEDGER` القائم وأرصدة الوكلاء ومحتويات `localStorage` **لم تُمس**؛ كلها مدخلات لخطوة Opening Balance في ADR-104 |
| **تحذير** | الوكلاء الجدد بعد هذا التغيير يبدأون بصفر. أي رصيد افتتاحي أثناء الفترة الانتقالية **يجب** أن يمرّ عبر «تعديل رصيد» (الذي يُنتج قيدًا) — لا عبر إنشاء الوكيل |
| **بلا أثر** | `BLOCKER-2` (إعلان عملة لكل طرف) لم يتغيّر — ما زال شرطًا لـT1 |

---

## NEW FINDINGS
*(اكتُشفت أثناء التنفيذ — لم يُبدأ إصلاحها تلقائيًا، §9)*

### NF-1 · الكتالوج الرقمي كان يعرض نجاحًا حتى بلا جلسة وكيل صالحة
- **الموقع:** `settleDigitalCatalogPurchase()` — `if (!agentEntity) return null;` والمستدعون الثلاثة **يتجاهلون القيمة المُرجَعة** ويعرضون شاشة نجاح.
- **الدليل:** الدالة موجودة بهذا الشكل قبل هذه المرحلة؛ ثلاثة مواقع استدعاء بلا فحص.
- **الأثر المعماري:** شراء يُعرض ناجحًا بلا أي تسوية — نفس عائلة BUG-2.
- **الإجراء:** **FIXED NOW** ضمن BUG-2 (المستدعون الثلاثة يفحصون الآن).

### NF-2 · `calculateManualServiceProfitBreakdown()` كود ميت + التكلفة صفر دائمًا
- **الموقع:** الدالة — **صفر مستدعٍ**. وكل صف في `PRODUCT_DIRECTORY` يحمل `cost: 0` (والكود يوثّق ذلك بنفسه).
- **الأثر:** لو استُدعيت لعرضت «الربح = السعر كاملًا». **غير معروضة لأي مستخدم اليوم.**
- **الإجراء:** **BACKEND** — الربحية تُحسب من `provider_mappings.cost` + `settlement_model` (ADR-110). **لم تُلمس ولم تُخترع تكلفة.**

### NF-3 · `updateProviderAccountBalance()` / `setProviderAccountBalance()` سلسلة خامدة بالكامل
- **الدليل:** المستدعي الوحيد لـ`setProviderAccountBalance` هو `updateProviderAccountBalance`، وهذا الأخير **بلا مستدعين**. `PROVIDER_ACCOUNT_DIRECTORY` فارغ.
- **الأثر:** المخالفة موجودة بنيويًا لكنها لم تُنفَّذ قط.
- **الإجراء:** **MIGRATION** — وُسمت `LEGACY · NOT A SOURCE OF TRUTH`؛ الإسقاط في ADR-104.

### NF-4 · `settleAgentCommissions()` يقبل عملة ولا يتلقاها
- **الدليل:** التوقيع `(agentId, periodStart, periodEnd, currencyCode)`، والمستدعي الوحيد يمرر **ثلاث وسائط فقط**.
- **الأثر:** يجعل الانحراف الحتمي (`agent.balance` بمنزلتين مقابل قيد بصفر منزلة) غير قابل للإصلاح داخل SPA — تأكيد مباشر لـ`BLOCKER-2`.
- **الإجراء:** **BACKEND / MIGRATION** — لم يُمرَّر أي رمز عملة مخترع.

---

## جدول التغييرات

| Issue | Before | Action | After | ADR |
|---|---|---|---|---|
| القيد العكسي يفقد الأبعاد | 5 حقول من 13 · العكس لا يصل لأي طرف | **FIX** | 8 حقول · الرصيد يعود 0 (مُثبَت) | ADR-110 |
| خصم بلا فحص كفاية | 0 من 5 مسارات تفحص | **FIX** | 5/5 + 3/3 محروسة · رفض بلا تحوير | ADR-105 |
| `initialBalance` | `Number(f.initialBalance) \|\| 0` + حقل في النموذج | **RETIRE** | `balance: 0` دائمًا · الحقل محذوف | ADR-104 |
| `ownerEntity.balance` | `+= ownerRevenue` + Ledger · بلا قيد | **RETIRE** | صفر تحوير · `settled: false` | ADR-104/106 |
| 5 مسارات محاكاة | «تم بنجاح» + رقم مرجع | **MOCK→صريح** | لافتة صريحة · «مرجع محاكاة» | ADR-115 |
| تقريب مسار التسعير | `*100/100` ثابت | **FIX** | `roundToCurrencyDecimals(gateway cur)` | ADR-102 |
| حساب COA لكل بنك | إنشاء تلقائي «FA-…» | **MODIFY** | `linkedAccountId` إلزامي | ADR-103 |
| `providerAccount.balance` | حقل بلا وسم | **ANNOTATE** | `LEGACY · NOT A SOURCE OF TRUTH` | ADR-104 |
| `2.94` | ثابت بلا وسم | **ANNOTATE** | `PLACEHOLDER · DEAD · DO NOT USE` | ADR-101 |
| `agent.balance` | 6 مسارات كتابة | **BACKEND ONLY** | 6 مسارات كتابة (لم تزد) | ADR-104 |
| `WALLET_LEDGER` | 7 مواقع كتابة | **BACKEND ONLY** (−1) | 6 مواقع · صفر جديدة | ADR-104 |
| تقريب بلا عملة | 8 مواقع | **BACKEND** | 8 مواقع (لم تُمس) | ADR-102 |
| نموذج العمولة | `agent.balance += commission` | **BACKEND ONLY** | كما هو · لم يُرسَّخ بمنطق جديد | ADR-106 |
| `YER` واحدة | تناقض عرض/دليل | **BACKEND** | كما هو · موثَّق | ADR-101 |
| تكلفة المزوّد | الكتالوج الرقمي فقط | **BACKEND** | كما هو · لم تُخترع تكلفة | ADR-110 |
