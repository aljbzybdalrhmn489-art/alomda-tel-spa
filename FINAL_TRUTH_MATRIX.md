# FINAL_TRUTH_MATRIX
## PHASE 0-PRE — TRUTH RECONCILIATION

**النطاق:** قراءة وتحليل وتوثيق فقط · لا كود · لا Backend · لا DB · لا migration · لا refactor
**التاريخ:** 2026-09-07
**الأساس:** PROJECT_8_INITIAL_AUDIT (معتمد) + إعادة تحقق مستقلة من الكود + استخراج فعلي لنصوص DOCX
**الملف المفحوص:** `spa_app-175.html` — SHA256 `b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8` — 40,800 سطر — لم يُمس

**مفتاح التصنيف:** `[V]` VERIFIED FROM CODE · `[D]` DOCUMENTED REQUIREMENT · `[I]` INFERENCE · `[R]` RECOMMENDATION · `[O]` OPEN DECISION

---

# 1. VERIFY TEST FILES

## 1.1 نطاق البحث المنفَّذ

| النطاق | الأمر | النتيجة |
|---|---|---|
| مجلد المشروع كاملًا | `find . -type f` | **31 ملفًا** — 5 في الجذر + 26 DOCX. لا شيء غيرها |
| أنماط الاختبار داخل المشروع | `*.test.*` `*.spec.*` `test_*` `tests/` `package.json` `*playwright*` `*vitest*` `*jest*` `node_modules` `*.json` `*.js` | **صفر نتيجة** (عاد فقط 4 ملفات `.md`) |
| قرص `D:\` بعمق 4 | `test_*.js` `*.spec.js` `*.test.js` `package.json` `spa_app*.html` `playwright*` | نتيجتان فقط: `./alomda soft new/backend/package.json` · `./ALOMDA TEL/spa_app-175.html` |
| مجلد المستخدم بعمق 5–6 | `test_*.js` · `test_phase*` · `*omda*` · `spa_app*.html` | لا ملفات اختبار. 11 نسخة SPA في `Downloads` فقط |
| `Desktop` · `Documents` | جرد كامل | لا شيء ذو صلة |
| تقارير اختبار / Playwright artifacts / أي أثر لـ"1530" | بحث بالاسم والمحتوى | **صفر** |

## 1.2 الحكم الرسمي

```
TEST SUITE NOT PRESENT IN CURRENT WORKSPACE
```

`[V]` **لا يوجد أي ملف اختبار، ولا `package.json` للمشروع، ولا `node_modules`، ولا تقرير اختبار، ولا أي Playwright artifact في أي مسار يمكن الوصول إليه.**

`[V]` **الرقم 1530/1530 غير قابل للتحقق إطلاقًا.** لا يوجد framework، ولا طريقة تشغيل، ولا عدّ ممكن.

`[D]` `PROJECT_HANDOFF.md §6`: «1530/1530 اختبارًا ناجحًا عبر 41 ملف اختبار» + «Playwright Smoke Test… في كل مرحلة».
`[D]` `PROJECT_HANDOFF.md §9` يعدّها ضمن **"الملفات المسلَّمة"**: «41 ملف اختبار (`test_*.js`) — تُشغَّل عبر Node.js».

`[I]` كل ادعاءات صحة البناء في الوثائق الأربع تستند إلى دليل **غير موجود في مساحة العمل**.
`[R]` لم أُنشئ أي اختبار (ممنوع في هذه المرحلة).

## 1.3 اكتشاف جانبي موثَّق — نسخ SPA أخرى

`[V]` `C:\Users\Administrator\Downloads` يحوي 11 نسخة:

| الملف | البايت | الأسطر | التاريخ | SHA256 (16) |
|---|---|---|---|---|
| `spa_app.html` | 1,371,840 | 19,078 | 2026-07-09 | `e765c00e7d47eef5` |
| `spa_app (1..8).html` | 2.0–3.4 MB | 32,277–42,997 | 2026-07-26 → 08-20 | مختلفة |
| `spa_app-115.html` | 3,620,997 | **45,734** | 2026-08-31 | `4bb9461407ea05ad` |
| **`spa_app-175.html`** | **2,603,878** | **40,800** | **2026-09-06** | **`b7e2b1d196018635` ✅** |

`[V]` نسخة المشروع مطابقة بايت-ببايت لـ `Downloads/spa_app-175.html`.

`[V]` **`spa_app-115.html` ليس نسخة أحدث من ALOMDA TEL** رغم كِبَره — فحص علامات مميزة:

| العلامة | 115 | 175 |
|---|---|---|
| `WALLET_LEDGER` | **0** | 52 |
| `PROVIDER_DIRECTORY` | **0** | 33 |
| `SERVICE_REQUEST_DIRECTORY` | **0** | 59 |
| `CUSTOMER_GATEWAY_ACCOUNT_DIRECTORY` | **0** | 10 |
| `settlePackagePurchase` | **0** | 42 |
| `postJournalEntry` | 108 | 56 |

`[I]` `spa_app-115.html` تطبيق محاسبي مختلف تمامًا (على الأرجح مشروع `alomda soft`)، وليس إصدارًا من ALOMDA TEL. **لا تعارض إصدارات.**

`[V]` `D:\alomda soft new` مشروع منفصل بمستودع git خاص وBackend TypeScript، وHTML بصمته `e610df93…`، **وصفر مطابقات** لعلامات ALOMDA TEL. **ليس مصدرًا للاختبارات المفقودة.**

---

# 2. FIND ALL REQUIREMENTS DOCUMENTS

## 2.1 الحالة

```
REQUIREMENTS DOCX ACCESSIBLE — 26/26 EXTRACTED SUCCESSFULLY
```

`[V]` المجلد `D:\ALOMDA TEL\AlomdaTel DOCX` موجود داخل نطاق المشروع. استُخرج نص **كل** ملف عبر `unzip -p <f> word/document.xml` ثم تجريد وسوم XML — **قراءة فقط، لم يُعدَّل أي ملف.**

| # | الملف | أسطر النص |
|---|---|---|
| 01 | أمان التطبيق.docx | 73 |
| 02 | ادارة الامن السيبراني.docx | 69 |
| 03 | ادارة الشكاوي والبلاغات.docx | 129 |
| 04 | اشتراكات التطبيقات.docx | 101 |
| 05 | التأمينات للعملاء (1).docx | 117 |
| 06 | التأمينات للعملاء.docx | 117 |
| 07 | التسعير.docx | 127 |
| 08 | التطبيق في السعودية.docx | 121 |
| 09 | التقارير والكشوفات والمطابقة.docx | 296 |
| 10 | التقارير والمالية.docx | 36 |
| 11 | الحسابات اكمال.docx | 38 |
| 12 | الخدمات المضافة والواي فاي والانترنت الثابت.docx | 87 |
| 13 | الدعم الفني.docx | 82 |
| 14 | الرسائل النصية واتس اب (1).docx | 177 |
| 15 | الرسائل النصية واتس اب.docx | 177 |
| 16 | الصلاحيات.docx | 121 |
| 17 | العملاء والوكلاء.docx | 105 |
| 18 | العمولات.docx | 149 |
| 19 | المرحله 3- المزودين والربط.docx | 64 |
| 20 | الموظفين.docx | 121 |
| 21 | تحليل_فروقات_SPA_مقابل_مرجع_متطلبات_العمدة_تل_v1.0-2.docx | 505 |
| 22 | سلبيات وتحسينات لنظام العمده تل.docx | 30 |
| 23 | شجرة الحسابات والقيود.docx | 127 |
| 24 | شحن الالعاب والبطائق.docx | 228 |
| 25 | **مرجع_متطلبات_العمدة_تل_الموحد_v1.0.docx** | **702** |
| 26 | مرحله 8 - الهيكلية الهرميه - شجرة الحسابات - العمولات.docx | 104 |

`[V]` **تكرار مؤكَّد:** `التأمينات للعملاء.docx` == `(1)` (نفس SHA256 `f18a18ec914e4c72`) · `الرسائل النصية واتس اب.docx` == `(1)` (نفس SHA256 `04b119bb640ae8d4`).

`[V]` **26 ملفًا = 22 مواصفة فريدة + 2 نسخة مكررة + 2 وثيقة مشتقة** (المرجع الموحد + تحليل الفروقات).

## 2.2 اكتشاف حرج: 10 من 32 ملف مصدر مفقودة

`[V]` `مرجع_متطلبات_العمدة_تل_الموحد_v1.0.docx §32` يسرد **32 ملف مصدر** بنى عليها نفسه. المقارنة الآلية بين القائمة والملفات الموجودة:

**مصادر مذكورة في المرجع وغير موجودة في المشروع (10):**

```
 1. إدارة الأجهزة وأمن تسجيل الدخول.docx     <- مصدر FR-03, FR-04
 2. إكمال الباقات والسداد.docx                <- مصدر FR-18, FR-19
 3. الخدمات والباقيات اليدوية.docx             <- مصدر FR-24
 4. الربط البرمجي.docx                        <- مصدر FR-13, FR-14
 5. الكريمي والتغذية.docx                     <- مصدر FR-10
 6. الواي فاي.docx                            <- مصدر FR-23
 7. خطة التعافي من الكوارث.docx                <- مصدر FR-36
 8. سجلات التدقيق.docx                        <- مصدر FR-28
 9. ميزات مستقبلية للتطبيق.docx                <- مصدر Roadmap §28
10. وثيقة ملف مشروع العمده تل.docx             <- الوثيقة الأم للمشروع
```

`[V]` هذه العشرة **مصادر أولية**، والمرجع الموحد يلخّصها فقط. `[D]` المرجع نفسه يقرّ في §1: «لا تُعتبر الأمثلة… تصميمًا نهائيًا **ما لم يُعتمد لاحقًا**» — أي أن التفاصيل الملزمة تبقى في الملفات الأصلية.

`[R]` **الملفات المطلوب إضافتها إلى المشروع لإكمال المطابقة** = القائمة العشرة أعلاه حرفيًا.

`[V]` لاحظ خصوصًا: **`وثيقة ملف مشروع العمده تل.docx`** (الوثيقة الأم) و**`سجلات التدقيق.docx`** (FR-28) و**`إدارة الأجهزة وأمن تسجيل الدخول.docx`** (FR-03/FR-04) — وهي بالضبط النطاقات التي صنّفها التدقيق السابق "غير موجودة في الكود".

## 2.3 ما أثبته استخراج النصوص — مبادئ ملزِمة صريحة

`[D]` من `§31 مبادئ تصميم غير قابلة للتجاهل` (نص حرفي مستخرج):

1. «لا يوجد مصدر مالي ثانٍ ينافس دفتر الأستاذ المركزي.»
2. «الرصيد المعروض يمكن أن يكون Projection/Cache، لكن قابل للمطابقة مع ledger.»
3. «لا تعديل أو حذف للحركة المالية؛ التصحيح عبر reversal/adjustment event مع صلاحيات وموافقة.»
4. «كل معاملة خارجية لها idempotency/reference واضح.»
5. «**Timeout يختلف عن Failure** ويحتاج مسار Pending/Status Query.»
6. «الأمن صلاحيات خادمية Backend-side، وليس حماية واجهة المستخدم فقط.»
7. «الأسرار ومفاتيح المزودين لا تدخل في SPA أو Git أو سجلات التشغيل.»

`[D]` من `§30 التناقضات المفتوحة` (نص حرفي): «**Wallet direct updates** — أمثلة كثيرة تستخدم `UPDATE balance` → تُعتبر أمثلة تعليمية فقط، ويُفضّل ربط الأثر المالي بالـledger بحسب القاعدة المركزية.»

`[D]` من `§30`: «**شجرة الحسابات** — 5 مستويات في دليل مفصل، وحتى 6 مستويات في وثيقة المشروع → **قرار مفتوح؛ يجب تثبيت نموذج واحد**.»

`[V]` **تعارض جديد مُكتشَف:** `ALOMDA_TEL_FINAL_ARCHITECTURE §5.1` يقرّ «3 مستويات + Dimensions». `شجرة الحسابات والقيود.docx` ينص على **«5 مستويات مرنة»** بترميز عشري (`100000/110000/111000/111100`). `مرجع_متطلبات_الموحد §30` يسجّلها **قرارًا مفتوحًا بين 5 و6**. **ثلاث قيم مختلفة لعمق شجرة الحسابات.** (راجع C-13)

---

# 3. REQUIREMENT -> CODE RECONCILIATION

`[V]` المصفوفة مبنية على `مرجع_متطلبات_العمدة_تل_الموحد_v1.0.docx §34` (FR-01…FR-36) — **سجل المتطلبات الرسمي الوحيد في المصادر** — مقابل تحقق مباشر من الكود.

**كل صف له دليل من رقم سطر أو نتيجة grep. لا يوجد "يبدو موجودًا" ولا "حسب الوثيقة".**

| ID | المطلب | المصدر | التنفيذ الحالي في SPA | الدالة/المصفوفة | الحالة | الدليل | الفجوة | النطاق الهدف | إجراء الترحيل | الأولوية |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-01 | حسابات وأنواع و`parent_id` وحالة وحدود وتسعير | §34 · مرحله 8 | حسابات وأنواع وحالة فقط | `ACCOUNTS` 16983 · `AGENT_DIRECTORY` 4351 | **PARTIAL** | grep `parentAgentId` = 0 · لا `tier_id` · لا `creditLimit` | لا هرمية · لا حدود · لا شرائح | Identity | REBUILD | P1 |
| FR-02 | تسجيل + تحقق + اعتماد (KYC/OTP) | §34 | لا شيء | — | **NOT_IMPLEMENTED** | grep `otp\|kyc` = 0 | كامل | Identity | BUILD | P2 |
| FR-03 | Device Binding وإدارة الأجهزة | §34 · (المصدر مفقود) | لا شيء | `PurchaseContext.device="web"` 2588 ثابت | **NOT_IMPLEMENTED** | التعليق نفسه يكتب `// future` | كامل | Security | BUILD | P2 |
| FR-04 | Access/Refresh rotation · إبطال عن بُعد | §34 · (المصدر مفقود) | جلسة كائن في localStorage | `state.session` 17730 · `persistAuthState` 17314 | **NOT_IMPLEMENTED** | grep `refreshToken\|accessToken\|sessionExpiry\|lockout` = **0** | كامل | Security | REBUILD | P1 |
| FR-05 | RBAC/ABAC دقيق (دور/وقت/IP/شجرة) | §34 · الصلاحيات.docx | 8 مصفوفات صلاحيات في العميل | `PERMISSION_DIRECTORY` 4836 · `ROLE_PERMISSIONS` 4872 · `ADMIN_ACTION_PERMISSION_DIRECTORY` 10880 | **PARTIAL** | ثرية، لكن مفروضة في المتصفح فقط · لا شرط وقت/IP/شجرة | لا فرض خادمي · لا ABAC | Security | REBUILD (منطق يُنقل) | P1 |
| FR-06 | Main Wallet — رصيد تشغيل | §34 | `agent.balance` حقل مباشر | 4352 · `settlePackagePurchase` 40259 | **CONFLICT** | 8 مواقع كتابة مباشرة (§5) | مصدر حقيقة ثانٍ | Ledger | REBUILD | **P0** |
| FR-07 | Commission Wallet منفصلة | §34 · مرحله 8 | لا محفظة منفصلة — التسوية تُضاف إلى نفس `agent.balance` | `settleAgentCommissions` 7313 | **NOT_IMPLEMENTED** | grep `commission_balance\|commissionWallet` = 0 | فصل رأس المال عن الدخل | Wallet | BUILD | P2 |
| FR-08 | Insurance/Guarantee Wallet + حجز مشروط | §34 · التأمينات.docx | لا شيء | — | **NOT_IMPLEMENTED** | لا حساب ولا حقل ولا حجز | كامل | Wallet | BUILD | P3 |
| FR-09 | Customer Wallet برصيد وسجل وحدود | §34 | **مشتق بالكامل من الـLedger** | `getCustomerWalletBalance` 5669 · `getCustomerWalletStatement` 5708 | **IMPLEMENTED** | الرصيد = مجموع سطور القيود، لا حقل مخزَّن | لا حدود · يعطب عند العكس (§6) | Ledger | MIGRATE | P1 |
| FR-10 | تغذية يدوية/بنكية/محفظية/بوابات/داخلية | §34 · الكريمي (مفقود) | 9 وسائل + دورة اعتماد كاملة | `CUSTOMER_GATEWAY_FUNDING_METHOD_DIRECTORY` 5980 · `approveCustomerTopupRequest` 6495 | **PARTIAL** | يدوي حقيقي · تلقائي = adapter وهمي 6204 | لا تكامل بنكي | Funding | MIGRATE + BUILD | P1 |
| FR-11 | Pipeline: Initiated/Held/Queued/Processing/Success/Failed/Pending | §34 · §35 | **لا كيان معاملة إطلاقًا** | §9 | **NOT_IMPLEMENTED** | لا `TRANSACTION_DIRECTORY` · `PURCHASE_RECORD_STATUSES` = `completed\|failed` فقط 2658 | آلة الحالات كاملة | Transaction | BUILD | **P0** |
| FR-12 | Idempotency عبر reference/clientRef | §34 · §31 | Ledger فقط | `findExistingJournalEntryForSource` 5236 | **PARTIAL** | `referenceId` يُولَّد **بعد** رد المزوّد (`"PK"+Date.now()` 632) | لا `client_ref` قبل التنفيذ | Transaction | BUILD | **P0** |
| FR-13 | Routing حسب المنطقة/التكلفة/الهامش/الأولوية/الصحة | §34 · التسعير.docx | سياسة `ask/auto/reject` لحالة واحدة | `resolveExecutionOutcome` 3723 · `EXECUTION_ROUTING_POLICIES` 3679 | **PARTIAL** | تُقرأ فقط عند `requires_gateway_switch` · لا صحة · لا تكلفة · لا fallback | routing حقيقي | Provider | REBUILD | P1 |
| FR-14 | استعلام حالة العملية بعد timeout | §34 · §31 | **لا شيء** | — | **NOT_IMPLEMENTED** | `timeoutMs` بيانات فقط (§8) · لا `queryStatus` | كامل | Provider | BUILD | **P0** |
| FR-15 | Cost/Wholesale/Retail/Commission/Override/FX | §34 · التسعير.docx | محرك مبني + غير موصول | `computeSellingPrice` 3476 · `computeCustomerGatewayPrice` 3280 | **MOCK_ONLY** | `PRICING_RULE_DIRECTORY = []` 3423 · الشراء العادي يستخدم `pkg.price` مباشرة | لا شرائح · لا override · لا FX فعّال | Pricing | REBUILD | P1 |
| FR-16 | توزيع هرمي + تأجيل حتى النجاح + عكس عند refund | §34 · العمولات · مرحله 8 | مستويان فقط | `accrueCommissionForPurchase` 7149 · `settleAgentCommissions` 7300 | **PARTIAL** | التأجيل نعم · العكس لـ`pending` فقط 7241 بلا مستدعٍ حي · `COMMISSION_POLICY_DIRECTORY = []` 7024 | لا waterfall · لا refund | Commission | REBUILD | P1 |
| FR-17 | شحن مباشر | §34 · (إكمال الباقات مفقود) | شاشة كاملة **بلا أي أثر مالي** | `runRecharge` 40191 -> `mockExecuteRecharge` 359 | **MOCK_ONLY** | لا خصم · لا قيد · لا مزوّد (§4) | التنفيذ المالي كله | Execution | BUILD | **P0** |
| FR-18 | تفعيل الباقات والتسوية | §34 | 3 مسارات حقيقية | `runPackagePurchase` 40123 -> `settlePackagePurchase` 40257 | **PARTIAL** | تخصم وتسجّل — **بلا فحص كفاية رصيد** (§5) · تكلفة المزوّد لا تُسجَّل (§8) | حجز · فحص · تكلفة | Execution | MIGRATE + HARDEN | P1 |
| FR-19 | Bills: Inquiry ثم حجز/خصم ثم دفع | §34 | استعلام + "دفع" بلا خصم | `runPostpaidPayment` 40102 · `runLandlinePayment` 40051 | **MOCK_ONLY** | لا حجز · لا خصم · لا قيد (§4) | كامل | Execution | BUILD | **P0** |
| FR-20 | PIN vault + قفل ذري + تسليم آمن | §34 · شحن الالعاب.docx | مخزون أكواد بنص صريح | `WIFI_INVENTORY_CODE_DIRECTORY` 16601 · `transitionWifiInventoryCodeStatus` 16703 | **PARTIAL** | حالات available/sold/used/void موجودة · **لا تشفير** · لا قفل ذري | vault حقيقي | Digital | REBUILD | P2 |
| FR-21 | Player ID validation + direct top-up | §34 · شحن الالعاب.docx | حقول ديناميكية + تحقق شكلي | `validateCatalogPurchaseForm` 1862 · `INPUT_TEMPLATES` 1257 | **PARTIAL** | تحقق تنسيقي فقط · لا استعلام مزوّد | تحقق حقيقي | Digital | BUILD | P2 |
| FR-22 | API_PIN / DIRECT_TOPUP / MANUAL | §34 · اشتراكات.docx | `PRODUCT_TYPES` تحوي `Subscription` 1246 كوسم فقط | — | **NOT_IMPLEMENTED** | لا دورة اشتراك ولا تجديد | كامل | Catalog | BUILD | P3 |
| FR-23 | Wi-Fi: مخزون/MikroTik/طباعة/بيع | §34 · (الواي فاي مفقود) | شبكات + ملّاك + تفويضات + مخزون + بيع + تحصيل | `WIFI_NETWORK_DIRECTORY` 16214 · `purchaseWifiProduct` 40538 | **PARTIAL** | ناضج · **لا MikroTik** · لا طباعة · التسوية بلا قيد محاسبي (§5) | تكامل + محاسبة | WiFi | MIGRATE | P2 |
| FR-24 | Manual Services: Queue/Dispatch/Processing/Complete/Reject/Cancel | §34 · (المصدر مفقود) | **آلة حالات كاملة + توزيع + عروض بمهلة + تايملاين** | `SERVICE_REQUEST_STATE_TRANSITIONS` 10968 · `dispatchServiceRequest` 15128 | **IMPLEMENTED** | جدول انتقالات صريح · `canTransitionServiceRequest` 10978 · `SERVICE_REQUEST_TIMELINE` 11600 | لا شيء جوهري | Operations | **KEEP + MIGRATE** | P2 |
| FR-25 | Tickets/Chat/Attachments/SLA/Escalation | §34 · الدعم الفني.docx | محادثات + مرفقات + قراءة/حذف + تعيين | `SUPPORT_CONVERSATION_DIRECTORY` 13198 · `postSupportMessage` 13620 | **PARTIAL** | ناضج · مرفقات Data-URI 1MB 13247 · **لا SLA ولا تصعيد** | SLA/Escalation | Support | MIGRATE | P2 |
| FR-26 | نزاع: فتح/تحقيق/رفض/استرداد/تدقيق | §34 · الشكاوي.docx | **لا شيء** | — | **NOT_IMPLEMENTED** | grep `dispute` = 0 | كامل | Disputes | BUILD | P2 |
| FR-27 | مطابقة Provider/Bank/Wallet/GL | §34 · التقارير والمطابقة.docx | طبقة تشخيصية واحدة | `reconcileAgentWalletBalance` 8650 · `detectUnaccountedAgentWalletMovements` 8802 | **PARTIAL** | قراءة فقط · محفظة الوكيل فقط · لا بنك/مزوّد | 3 طبقات ناقصة | Reconciliation | BUILD (النواة تُنقل) | P2 |
| FR-28 | Immutable audit + forensic trail | §34 · (سجلات التدقيق مفقود) | 6 سجلات نشاط منفصلة | 4387 · 4745 · 7421 · 10076 · 11600 · 16858 | **PARTIAL** | لا نموذج موحّد · لا `actor` · لا سلسلة hash · **قابلة للتعديل من Console** | immutability | Audit | REBUILD | P1 |
| FR-29 | Push/In-app/WhatsApp/Telegram/SMS | §34 · الرسائل النصية.docx | إشعارات داخل التطبيق فقط | `APP_NOTIFICATION_DIRECTORY` 13936 · `CUSTOMER_NOTIFICATION_DIRECTORY` 11863 · `NOTIFICATION_DIRECTORY` 9265 | **PARTIAL** | 3 أنظمة إشعار متوازية · **لا قناة خارجية واحدة** | كل القنوات | Notifications | BUILD | P3 |
| FR-30 | Local staging + sync + fallback | §34 · §21 | **لا شيء** | — | **NOT_IMPLEMENTED** | grep `navigator.onLine` = **0** · لا SW · لا طابور | كامل | Offline | BUILD | P2 |
| FR-31 | Double-entry + periods + reversals + FX | §34 · شجرة الحسابات.docx | **محرك قيد مزدوج حقيقي ومُحكَم** | `postJournalEntry` 5291 · `reverseJournalEntry` 5477 | **PARTIAL** | القيد والتوازن والـIdempotency سليمة · **لا فترات · لا إقفال · لا FX · العكس معطوب (§6)** | periods/FX/إصلاح العكس | Ledger | **MIGRATE (الأصل الأثمن)** | **P0** |
| FR-32 | Statements/P&L/Liquidity/KPI/Exports | §34 · التقارير.docx | كشوف حساب + تقرير عمليات يومي | `getCustomerWalletStatement` 5708 · `getAgentWalletStatement` 8604 · `computeDailyOperationsReport` 15432 | **PARTIAL** | كشوف موجودة · **لا ميزان مراجعة · لا P&L · لا تصدير** | التقارير المالية | Reporting | BUILD | P2 |
| FR-33 | Shifts, limits, approvals, staff audit | §34 · الموظفين.docx | موظفون + سعة + توفر + ترقية سعة | `EMPLOYEE_DIRECTORY` 9579 · `applyEmployeeCapacityPromotion` 11426 | **PARTIAL** | تشغيلي ناضج · **لا ورديات · لا حدود مالية · لا موافقات** | SoD/limits | Staff | MIGRATE + BUILD | P2 |
| FR-34 | Fraud/velocity/risk/lockout | §34 · الامن السيبراني.docx | **لا شيء** | — | **NOT_IMPLEMENTED** | grep `lockout\|velocity\|fraud` = 0 | كامل | Security | BUILD | P2 |
| FR-35 | SAR/multi-currency · e-invoice/QR | §34 · السعودية.docx | 3 عملات في الدليل | `CURRENCY_DIRECTORY` 2775 | **PARTIAL** | معرّفة · **لا تحويل فعلي · لا فوترة** | FX + امتثال | Finance | BUILD | P3 |
| FR-36 | Backup/PITR/replication/failover | §34 · (خطة التعافي مفقود) | لا ينطبق (SPA بلا خادم) | — | **NOT_IMPLEMENTED** | — | كامل | Infra | BUILD | P3 |

## 3.1 ملخص المصفوفة

| الحالة | العدد | النسبة |
|---|---|---|
| **IMPLEMENTED** | **2** (FR-09, FR-24) | 5.6% |
| **PARTIAL** | **17** | 47.2% |
| **MOCK_ONLY** | **3** (FR-15, FR-17, FR-19) | 8.3% |
| **NOT_IMPLEMENTED** | **13** | 36.1% |
| **CONFLICT** | **1** (FR-06) | 2.8% |
| UNKNOWN | 0 | — |

`[I]` **مقارنة بالتقدير الموثَّق:** `GAP_ANALYSIS §1` قدّر «~22% مُنفَّذ ومتوافق». المصفوفة المبنية على FR الرسمي تعطي **5.6% مكتمل + 47.2% جزئي**. الفرق ليس تناقضًا بالضرورة — التقدير القديم يخلط "مكتمل" بـ"جزئي" — لكن **رقم 22% غير قابل لإعادة الإنتاج من سجل FR**، وهو ما انتقده `ARCHITECTURE_REVIEW_V2 §3.2` نفسه بوصفه "غير منهجي". `[V]`

---

# 4. RE-CHECK THE FIVE FAKE SUCCESS PATHS

`[V]` **إعادة تحقق مستقلة كاملة — النتيجة مؤكَّدة بلا تغيير.**

| # | البند | `runRecharge` | `runWholesalePurchase` | `runPostpaidPayment` | `runLandlinePayment` | `runInternetManualPayment` |
|---|---|---|---|---|---|---|
| 1 | **entry function** | `runRecharge()` 40188 | `runWholesalePurchase()` 40063 | `runPostpaidPayment()` 40097 | `runLandlinePayment()` 40044 | `runInternetManualPayment()` 40153 |
| | الدالة الوهمية | `mockExecuteRecharge` 359 | `mockPurchaseWholesale` 679 | `mockPayPostpaidBill` 717 | `mockPayLandlineBill` 772 | `mockPayInternetManual` 536 |
| 2 | **success condition** | `Math.random() >= 0.25` | `Math.random() >= 0.25` | `Math.random() >= 0.25` | `Math.random() >= 0.25` | `Math.random() >= 0.25` |
| 3 | **provider call** | **لا شيء** — `setTimeout(1100)` | لا شيء | لا شيء | لا شيء | لا شيء |
| 4 | **wallet mutation** | **لا خصم** | لا خصم | لا خصم | لا خصم | لا خصم |
| 5 | **journal entry** | لا قيد | لا قيد | لا قيد | لا قيد | لا قيد |
| 6 | **commission** | لا استحقاق | لا | لا | لا | لا |
| 7 | **purchase record** | لا | لا | لا | لا | لا |
| 8 | **reference ID** | `"RC"+Date.now().slice(-8)` | `"WS"+…` | `"PP"+…` | `"LL"+…` | `"NM"+…` — **معروض للمستخدم، غير مخزَّن في أي مكان** |
| 9 | **final UI state** | `stage:"success"` + شاشة نجاح كاملة | `stage:"success"` | `stage:"success"` | `actionStatus:"success"` | `actionStatus:"success"` |
| | **الحكم** | **NO FINANCIAL EFFECT** | **NO FINANCIAL EFFECT** | **NO FINANCIAL EFFECT** | **NO FINANCIAL EFFECT** | **NO FINANCIAL EFFECT** |

## 4.1 الدليل الحاسم

`[V]` `grep -n "settlePackagePurchase("` يُرجع مواقع الاستدعاء الحية التالية فقط: 39684 (أرضي) · 40123 (جوال) · 40123 (إنترنت) · 39981 (كتالوج رقمي) · 40600 (واي فاي).
**لا أحد من الخمسة أعلاه ضمنها.**

`[V]` `grep -n "createPurchaseRecord("` يُرجع **استدعاءً واحدًا فقط**: سطر 40010 (الكتالوج الرقمي). **لا سجل مشتريات لأي من الخمسة، ولا حتى لمشتريات التيليكوم الحقيقية.**

`[V]` نص `mockExecuteRecharge` كاملًا (359–369) — لا استدعاء لأي شيء غير `setTimeout` و`Math.random`:

```javascript
function mockExecuteRecharge(phone, amount) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.25) reject(new Error("تعذّر تنفيذ عملية الشحن"));
      else resolve({ referenceId: "RC" + Date.now().toString().slice(-8), amount });
    }, 1100);
  });
}
```

## 4.2 المقارنة مع المسارات الحقيقية الثلاثة

`[V]` للتباين، `mockPurchasePackage` (589) **يستدعي فعلًا** `executeTelecomPackageProviderRequest` (629) -> `executePurchase` -> `ProviderRegistry.resolveAdapter`، ويرفض عند `pending` فلا تصل التسوية.

`[I]` **الأثر:** المسارات الخمسة تعرض للمستخدم شاشة نجاح برقم مرجعي، **بينما لم تحدث أي عملية ولم يُخصم أي مال ولم يُسجَّل أي شيء في أي مكان.** الرقم المرجعي يختفي بمجرد مغادرة الشاشة.

`[R]` **لم أُصلح أي منها.** التصنيف الرسمي: `MOCK_ONLY / NO FINANCIAL EFFECT`.

---

# 5. RE-CHECK ALL DIRECT BALANCE MUTATIONS

`[V]` **جرد شامل معاد التنفيذ** بأنماط: `.balance =` · `.balance +=` · `.balance -=` · `.balance++` · `.balance--` · `balance:` · `initialBalance` · `Balance =/+=/-=`.

## 5.1 الجدول الكامل — 11 موقع كتابة

| File | Line | Function | Entity | Balance Field | Operation | Journal Entry? | Wallet Ledger? | Source of Truth? | Target Replacement |
|---|---|---|---|---|---|---|---|---|---|
| spa_app-175.html | 7313 | `settleAgentCommissions()` | Agent | `agent.balance` | `+= totalAmount` | نعم `postAgentCommissionSettlementAccounting` 8966 | نعم COMMISSION | **ثانٍ** | `AGENT-WALLET-LIABILITY` + Projection |
| spa_app-175.html | 9495 | `transferWalletFunds()` | Agent (مصدر) | `source.balance` | `-= amount` | نعم `postAgentTransferAccounting` 8918 | نعم TRANSFER_OUT | ثانٍ | نفس ما سبق |
| spa_app-175.html | 9506 | `transferWalletFunds()` | Agent (وجهة) | `destination.balance` | `+= amount` | نعم نفس القيد | نعم TRANSFER_IN | ثانٍ | نفس ما سبق |
| spa_app-175.html | 26336 | `saveBalanceAdjust()` | Agent | `agent.balance` | `= ±amount` | نعم `postAgentBalanceAdjustmentAccounting` 9135 | نعم TOPUP/DEDUCTION | ثانٍ | قيد + Maker/Checker |
| spa_app-175.html | 40259 | `settlePackagePurchase()` | Agent | `agent.balance` | `-= chargeAmount` | **مشروط** — `postAgentPurchaseRevenueAccounting` 9069 يعود `skipped:"no_currency"` عند غياب العملة | نعم PURCHASE_DEBIT | ثانٍ | قيد إلزامي + حجز |
| spa_app-175.html | 40343 | `chargeAgentForManualService()` | Agent | `agent.balance` | `-= product.price` | مشروط (نفس السبب) | نعم PURCHASE_DEBIT | ثانٍ | نفس ما سبق |
| spa_app-175.html | 40503 | `creditWifiNetworkOwnerForSale()` | Agent (مالك شبكة) | `ownerEntity.balance` | `+= ownerRevenue` | **لا قيد إطلاقًا** | نعم PROVIDER_SETTLEMENT | ثانٍ | قيد إلزامي |
| spa_app-175.html | **26219** | `saveAgentForm()` (وضع add) | Agent | `balance: Number(f.initialBalance)` | **إنشاء برصيد افتتاحي** | **لا** | **لا** | **انحراف فوري** | قيد افتتاحي إلزامي |
| spa_app-175.html | **4970** | `ensureAgentCapabilityRecordForCustomer()` | Agent (من عميل) | `balance: 0` | إنشاء بصفر | لا | لا | غير ضار (صفر) | لا شيء |
| spa_app-175.html | **2443** | `setProviderAccountBalance()` | ProviderAccount | `account.balance` | `= amount` | **لا** | **لا سجل حركات إطلاقًا** | **الأسوأ** | حساب أصل + قيود |
| spa_app-175.html | **2165** | `loadPersistedProviderAccountDirectoryState()` | ProviderAccount | `a.balance` | `= 0` (ترقية بيانات قديمة) | لا | لا | غير ضار | — |

`[V]` **مسارات مساعدة:** `updateProviderAccountBalance()` (2465) لا يكتب بنفسه — يمرّ عبر `setProviderAccountBalance()`. `createProviderAccount()` (2215) يُنشئ بـ`balance: 0` (2226).

`[V]` **بذور بيانات:** 4 وكلاء في `AGENT_DIRECTORY` (4352–4355) بأرصدة افتتاحية 128,500 · 342,100 · 15,200 · 519,300 — **بلا أي قيد أو سجل حركات**. مجموعها **1,005,100 ر.ي** كرصيد التزام غير مُقيَّد.

## 5.2 التحقق الخاص المطلوب

| الحقل | الحكم | الدليل |
|---|---|---|
| **`agent.balance`** | **مصدر حقيقة ثانٍ مؤكَّد — 7 مواقع تعديل + 1 موقع إنشاء = 8** | جدول 5.1 |
| **`providerAccount.balance`** | **أسوأ من `agent.balance`** — مسار كتابة واحد مُحكَم لكن **بلا سجل حركات، وبلا أي قيد، وبلا قبل/بعد**. الكود يعترف صراحة (تعليق 2405–2418) | 2443 |
| **`ownerEntity.balance`** | **الوحيد الذي يُعدَّل بلا قيد محاسبي على الإطلاق** — `WALLET_LEDGER` فقط | 40503 |
| **`initialBalance`** | **مؤكَّد: ينشئ رصيدًا غير صفري بلا قيد وبلا سجل** — مغفول في `FINAL_ARCHITECTURE §7.1` | 25831 (حقل النموذج) -> 26219 (الكتابة) |

## 5.3 غياب فحص الكفاية — مؤكَّد

`[V]` `grep "balance <\|balance >="` يُرجع **موقعين فقط** في كامل الملف:

- 9488 — `transferWalletFunds()`: `if (amount > source.balance)`
- 40320 — `validateAgentBalanceForManualService()`: `if (agent.balance < sellingPrice)`

`[V]` `settlePackagePurchase()` (40257) **لا يفحص شيئًا** — ومستدعوه الخمسة (باقات جوال/إنترنت/أرضي · واي فاي 40600 · كتالوج رقمي 39981) **لا يفحصون أيضًا**.
`[V]` وفي المقابل `saveBalanceAdjust()` (26330) يفرض صراحةً «لا يمكن أن يصبح الرصيد سالباً». **تعارض داخلي مؤكَّد في الكود نفسه.**

---

# 6. REVERSE JOURNAL BUG

`[V]` **تحقق مستقل مكتمل.**

## 6.1 حقول السطر الأصلي (كما ينشئها `postJournalEntry` 5424–5440)

```
id · journalEntryId · accountId · accountCode · accountName · currencyCode ·
debit · credit · description · partyType · partyId · gatewayId · lineOrder
```

**13 حقلًا.**

## 6.2 ما يُنسخ إلى سطر العكس (`reverseJournalEntry` 5490–5496)

```javascript
const reversedLines = originalLines.map((l) => ({
  accountId:    l.accountId,
  currencyCode: l.currencyCode,
  debit:        l.credit,     // مقلوب — صحيح
  credit:       l.debit,      // مقلوب — صحيح
  description:  l.description,
}));
```

**5 حقول فقط.**

## 6.3 ما يُفقد

| الحقل | المصير | الأثر |
|---|---|---|
| **`partyType`** | يصبح `null` عبر `raw.partyType \|\| null` (5411) | **قاتل** |
| **`partyId`** | يصبح `null` | **قاتل** |
| **`gatewayId`** | يصبح `null` (5423) | **قاتل** |
| `accountCode` / `accountName` | يُعاد اشتقاقهما من الحساب | لا ضرر |
| `lineOrder` | يُعاد ترقيمه | لا ضرر |

## 6.4 الأثر لكل طرف — إثبات مباشر

`[V]` كل قارئ رصيد يُرشِّح **إلزاميًا** على `partyType`/`partyId`:

| الطرف | الدالة | السطر | شرط الترشيح |
|---|---|---|---|
| **Customer** | `getCustomerAccountLineTotals` | 5654 | `if (line.partyType !== "customer" \|\| line.partyId !== customerId) return;` |
| **Agent** | `getAgentWalletAccountLineTotals` | 8557 | نفس النمط بـ`"agent"` |
| **Provider** | `getProviderAccountLineTotals` | 6662 | نفس النمط بـ`"provider"` |
| **Gateway** | `getCustomerAccountLineTotals` | 5655 | `if (gatewayId !== undefined && line.gatewayId !== gatewayId) return;` |

`[I]` **النتيجة الحتمية:** سطر العكس بـ`partyId: null` **لا يُطابِق أي مرشِّح**، فلا يدخل في حساب أي رصيد.

**السيناريو الملموس:** تغذية عميل بـ10,000 -> `getCustomerWalletBalance` = 10,000 -> عكس القيد -> القيد الأصلي `status:"reversed"`، القيد العكسي مُرحَّل ومتوازن، **`getCustomerWalletBalance` تبقى 10,000**. العميل يحتفظ بمال أُلغي.

`[V]` **الأسوأ:** الخلل **غير مرئي في التقارير الإجمالية** — مجموع الحساب على مستوى الـControl Account يعود صحيحًا (المدين = الدائن)؛ **الخطأ في الـSubledger فقط**، أي في رصيد الطرف الفردي.

`[V]` **`getCustomerWalletStatement`** (5708) يرشّح بنفس الشرط -> **القيد العكسي لا يظهر حتى في كشف الحساب.** المستخدم لا يرى شيئًا يدلّه على وقوع عكس.

## 6.5 هل توجد أي طريقة أخرى تصلح هذا حاليًا؟

`[V]` **لا.**

- لا يوجد أي كود آخر يُعيد ربط سطور العكس بالطرف.
- `reverseJournalEntry` هو **المسار الوحيد المصرَّح به** للتصحيح (لا `UPDATE`/`DELETE` على القيود).
- `grep "reverseJournalEntry("` = **التعريف (5477) + 5 تعليقات فقط. صفر مستدعٍ حي.**

`[I]` **الخلل كامن وليس نشطًا اليوم** — لأن لا مسار إلغاء/استرداد موصول بأي واجهة. **لكنه ينفجر في اللحظة الأولى التي يُبنى فيها Refund/Reversal فوقه.**

## 6.6 التصنيف

```
CRITICAL PRE-BACKEND MIGRATION BUG
```

`[V]` **مدعوم بالأدلة أعلاه بالكامل.** يستوفي المعيار: صامت · يفسد بيانات مالية · لا يمكن اكتشافه بالتقارير الإجمالية · يقع في المسار الوحيد المصرَّح به للتصحيح · **ونقله كما هو إلى PostgreSQL ينقل الخلل معه.**

`[R]` **لم أُصلحه.**

---

# 7. CURRENCY PRECISION

## 7.1 الجرد الكامل لمواقع التقريب

| السطر | الموقع | الصيغة | يحترم دقة العملة؟ |
|---|---|---|---|
| 5180–5185 | `roundToCurrencyDecimals()` | `Math.pow(10, currency.decimals)` مع fallback = 2 | **نعم — الدالة المرجعية** |
| 3499–3500 | `computeSellingPrice()` | `Math.pow(10, decimals)` من `findCurrencyByCode` | نعم |
| 415 | `convertNorthPriceToSouthGateway()` | `Math.round(x * 2.94)` | صحيح مصادفةً لـYER(0) · ثابت مبرمج متروك |
| **3297** | `computeCustomerGatewayPrice()` | `Math.round(x * rate * 100) / 100` | **لا — منزلتان ثابتتان** |
| **7084** | `calculateCommissionAmount()` | `Math.round(x * (v/100) * 100) / 100` | **لا** |
| **7137** | `groupCommissionAccrualsByCompany()` | `* 100) / 100` | لا |
| **7192** | `accrueCommissionForPurchase()` — `agentShare` | `* 100) / 100` | **لا** |
| **7193** | `accrueCommissionForPurchase()` — `customerShare` | `* 100) / 100` | **لا** |
| **7307** | `settleAgentCommissions()` — `totalAmount` | `* 100) / 100` | **لا — وهذا ما يُضاف إلى `agent.balance`** |
| **8500** | `calculateManualServiceProfitBreakdown()` | `* 100) / 100` | لا |
| **9285 / 9346** | إشعارات العمولة اليومية | `* 100) / 100` | لا |
| **40499** | `creditWifiNetworkOwnerForSale()` — `ownerRevenue` | `* 100) / 100` | **لا — وهذا ما يُضاف إلى `ownerEntity.balance`** |

`[V]` **الحصيلة: 9 مواقع مالية تستخدم منزلتين ثابتتين، متجاوزةً `roundToCurrencyDecimals()` القائمة والصحيحة.**

## 7.2 التناقض المؤكَّد

`[V]` `CURRENCY_DIRECTORY` 2776: `{ code: "YER", decimals: 0 }` — **الريال اليمني بلا كسور.**
`[V]` `postJournalEntry` 5439 يُقرِّب كل سطر عبر `roundToCurrencyDecimals(debit, "YER")` -> **عدد صحيح.**
`[V]` `settleAgentCommissions` 7307 يحسب `totalAmount` بمنزلتين -> يُضيفه إلى `agent.balance` (7313) -> **رقم بكسور** -> ثم يُمرّره إلى `postAgentCommissionSettlementAccounting` الذي **يُقرِّبه إلى صحيح** في القيد.

`[I]` **النتيجة الرياضية:** `agent.balance` و`AGENT-WALLET-LIABILITY` **يتباعدان بقيمة كسرية في كل تسوية عمولة**، حتى لو كان كل شيء آخر سليمًا. هذا انحراف **بنيوي وحتمي، لا احتمالي.**

`[V]` `reconcileAgentWalletBalance()` (8650) — أداة كشف الانحراف — **ستُبلّغ عن `driftType` غير `"none"` بسبب هذا وحده**، ما يُغرِق أي مطابقة مستقبلية بضجيج.

## 7.3 التصنيف

```
DESIGN CONFLICT  (وليس BUG منفردًا، وليس قاعدة عمل مقصودة)
```

**التبرير بالأدلة:**

- `[V]` **ليس BUG بسيطًا** — الكود يملك الحل الصحيح (`roundToCurrencyDecimals`) ويستخدمه في الطبقة المحاسبية باستمرار؛ الطبقة التجارية ببساطة لا تستدعيه. هذا **عدم اتساق معماري بين طبقتين**، لا خطأ في سطر.
- `[V]` **ليس قاعدة عمل مقصودة** — لا وثيقة واحدة من الـ26 تنص على أن العمولة تُحسب بدقة مختلفة عن العملة. `شجرة الحسابات والقيود.docx` يستخدم `NUMERIC(15, 2)` لكل الحقول، وأمثلته بأرقام صحيحة (40 · 80 · 1,960 · 2,000).
- `[V]` **تعارض مصدري صريح:** الـSPA يقرّ YER بـ`decimals: 0` · وثيقة شجرة الحسابات تفرض `NUMERIC(15,2)` · وثيقة التسعير تفرض `NUMERIC(12,2)` وتفصل `YER_OLD`/`YER_NEW` كعملتين مستقلتين — **بينما الـSPA يعرّف YER واحدة فقط.**

## 7.4 القرار غير المحسوم

`[O]` **لا أحسم السياسة التجارية.** الأسئلة المفتوحة الثلاثة، **كلها لكم:**

| # | السؤال | لماذا يجب حسمه قبل أول جدول |
|---|---|---|
| **OPEN-CUR-1** | هل YER فعلًا بلا كسور، أم بمنزلتين؟ | يحدد نوع كل عمود مالي |
| **OPEN-CUR-2** | هل `YER_OLD` و`YER_NEW` عملتان مستقلتان (كما تفرض `التسعير.docx`) أم عملة واحدة ببوابتين (كما ينفّذ الـSPA)؟ | يحدد بنية `currencies` و`fx_rates` بالكامل |
| **OPEN-CUR-3** | كيف تُعالَج كسور العمولة عند التقريب لعملة صفرية — bankers rounding؟ حساب فروق تقريب؟ ترحيل الكسر؟ | يحدد ما إذا كان يلزم حساب `Rounding Difference` في COA |

`[V]` **`ALOMDA_TEL_FINAL_ARCHITECTURE §35` صنّف `OPEN-02` (تمثيل المال) بأنه "لا رجعة فيه". هذا القسم يقدّم الدليل الرقمي على أن ذلك التصنيف صحيح.**

---

# 8. PROVIDER COST ACCOUNTING

`[V]` **التحقق:** `grep "postAutomaticProviderAccountingForPurchase("` -> **التعريف (8194) + استدعاء واحد فقط (39999)**، داخل `settleDigitalCatalogPurchase()`.

## 8.1 المصفوفة لكل نوع

| البند | **Telecom** | **WiFi** | **Digital Catalog** | **Manual Services** |
|---|---|---|---|---|
| مسار التسوية | `settlePackagePurchase` 40257 | `purchaseWifiProduct` 40538 -> `settlePackagePurchase` | `settleDigitalCatalogPurchase` 39953 | `chargeAgentForManualService` 40339 |
| **Provider Cost مسجَّل؟** | **لا** | لا | **نعم** (8215) | لا |
| **Provider Balance مستهلك؟** | **لا** — `consumeProviderBalance` غير مستدعى | لا | نعم `consumeProviderBalance` 8215 | لا |
| **Provider Commission؟** | لا | لا | نعم `accrueProviderCommission` 8231 | لا |
| **Journal Entry (إيراد)؟** | **مشروط** — `postAgentPurchaseRevenueAccounting` 9069 يعيد `skipped:"no_currency"` عند `!currencyCode` | مشروط (و`product.currencyCode` **دائمًا `null`** في صفوف الواي فاي) | مشروط عبر `resolveCatalogPackageCurrencyCode` 9201 | مشروط |
| **Customer Revenue؟** | لا كيان عميل في المسار | لا | `customerId` **لا يُمرَّر أبدًا** (الكود يوثّق ذلك 8250–8256) | لا |
| **Customer Commission؟** | لا | لا | `accrueCustomerCommission` مبنية (8346) **وغير مستدعاة فعليًا** | لا |
| **System Margin محسوب؟** | **لا — التكلفة مفقودة، فالهامش = السعر كاملًا** | لا | نعم (سعر − تكلفة) | `calculateManualServiceProfitBreakdown` 8494 **عرض فقط، لا قيد** |
| **Purchase Record؟** | لا | `createWifiPurchaseDeliveryRecord` (سجل موازٍ) | `createPurchaseRecord` 40010 | لا |

## 8.2 الدليل الحاسم على الخسارة المحاسبية

`[V]` `TELECOM_PROVIDER_MAPPING_DIRECTORY` (15896–15913) يحمل تكاليف حقيقية:

```
tpm_001 -> pkg_012 · providerCost: 1500 YER
tpm_002 -> pkg_004 · providerCost: 5000 YER
tpm_003 -> pkg_004 · providerCost: 5300 YER
```

`[V]` `executeTelecomPackageProviderRequest` (15737) **يُرجع `mapping` فعلًا** ضمن نتيجته (`Object.assign({}, outcome, { mapping })` 15792).
`[V]` لكن `mockPurchasePackage` يمرّر `providerMapping: outcome.mapping` في نتيجة `resolve` (634) — **و`runPackagePurchase` (40123) لا يقرؤه ولا يُمرّره لأي دالة محاسبية.**

`[I]` **النتيجة:** الربط يعرف تكلفته (1,500 ر.ي)، والتنفيذ يمرّر الربط، **ولا شيء يستهلكه.** كل بيع تيليكوم يُسجَّل كإيراد كامل بلا تكلفة، ورصيد المزوّد لا ينقص أبدًا.

`[V]` **هذا يخالف مباشرةً** مثال `شجرة الحسابات والقيود.docx` الذي يفرض في قيد السداد الواحد:
`Cr رصيد المزوّد – يمن موبايل (112100) 2,000` — أي **نقص أصل المزوّد إلزاميًا في كل عملية.**

`[R]` لم أُصلح شيئًا.

---

# 9. TRANSACTION REALITY CHECK

`[V]` **بحث مستقل بالأنماط، لا بأسماء التقرير السابق.**

| النمط المبحوث | النتيجة الخام | التقييم |
|---|---|---|
| `TRANSACTION_DIRECTORY` | 7 مطابقات — **كلها `CUSTOMER_GATEWAY_FUNDING_TRANSACTION_DIRECTORY`** (6240–6377) | سجل تغذية، **ليس كيان معاملة مالية** |
| `transactionStatus` / `transaction_status` | **0** | غير موجود |
| `transactionHistory` | **0** | غير موجود |
| `reservedBalance` / `reserved_balance` | **0** | غير موجود |
| `holdAmount` / `heldAmount` | **0** | غير موجود |
| `reservation` | 2 مطابقة — 19226 و39326، **كلاهما تعليق عن استعادة تركيز DOM** | لا علاقة مالية |
| `idempotencyKey` / `idempotency_key` | **0** | غير موجود |
| `clientRef` / `clientReference` | **0** | غير موجود |
| `pendingTransaction` | **0** | غير موجود |
| `transactionId` | 9 مطابقات — حقل في `PurchaseResult` (2622) يُملأ بـ`"TXN"+Date.now()` (4197) **عند النجاح فقط**، غير مخزَّن في أي directory | معرّف عابر |

## 9.1 الخلاصة

`[V]` **مؤكَّد بشكل مستقل: لا يوجد كيان معاملة مالية في الـSPA.**

`[V]` الحالة الدائمة الوحيدة للمشتريات هي `PURCHASE_RECORD_DIRECTORY` بـ`PURCHASE_RECORD_STATUSES` (2658) = **قيمتان فقط**: `completed` · `failed`. **لا `pending`، لا `held`، لا `unknown`، لا `reversed`** — ولا حتى مصفوفة انتقالات.

`[V]` `status: "pending"` موجود في 10 مواقع، **ولا واحد منها معاملة مالية**: عقد `PurchaseResult` (2626) · نتيجة عابرة (4211) · طلب تغذية (6449) · استحقاق عمولة (7218) · تسوية بوابة دفع (7964) · عرض طلب خدمة (12850) · تحصيل واي فاي (16735/16768) · حالة واجهة (36364).

`[D]` `مرجع_متطلبات_الموحد §35` يفرض: `INITIATED -> HELD/RESERVED -> QUEUED -> PROCESSING -> SUCCESS/FAILED أو SUSPENDED/PENDING_PROVIDER -> RESOLVED`.
`[V]` **صفر من هذه الحالات مُخزَّن في أي مكان.**

`[V]` **المفارقة الموثَّقة:** آلة الحالات الوحيدة الكاملة في التطبيق — `SERVICE_REQUEST_STATE_TRANSITIONS` (10968) مع `canTransitionServiceRequest()` (10978) و`transitionServiceRequestStatus()` (11035) و`SERVICE_REQUEST_TIMELINE` (11600) — **مبنية للطلبات التشغيلية، لا للمال.** `[R]` هي **النموذج الصحيح الجاهز** الذي يجب أن تُبنى عليه آلة حالة المعاملة المالية.

---

# 10. SECURITY REALITY CHECK

`[V]` **الفصل الصارم بين "منفَّذ" و"إعداد/توثيق فقط".**

| المجال | منفَّذ فعليًا | إعداد/توثيق فقط | غير موجود | الدليل |
|---|---|---|---|---|
| **passwords** | مقارنة نصية `a.password === pass` | — | hashing · salt · سياسة تعقيد · تدوير | `authenticateAccount` 17064 · `grep crypto.subtle` = **0** · `grep bcrypt\|sha256` = 0 |
| **localStorage auth** | `ACCOUNTS` كاملًا (بكلمات المرور) + `session` مُخزَّنان | — | تشفير · نطاق · انتهاء | `persistAuthState` 17314–17318 |
| **sessions** | كائن يُستعاد بالكامل عند الإقلاع | — | رمز · انتهاء · تجديد · إبطال عن بُعد | `Object.assign(state.session, savedSession)` 17341 · `grep refreshToken\|accessToken\|sessionExpiry` = **0** |
| **permissions** | 8 مصفوفات + دوال فحص، **مفروضة في المتصفح** | — | فرض خادمي · ABAC · نطاق شجري | `PERMISSION_DIRECTORY` 4836 · `employeeHasAdminActionPermission` 10915 |
| **roles** | 4 أدوار · `role` يُكتب حصريًا من `authenticateAccount` | — | — | 17070 — **نقطة قوة بنيوية حقيقية** |
| **2FA** | — | — | **كليًا** | `grep 2fa\|two-factor` = **0** |
| **OTP** | — | — | **كليًا** | `grep otp` = **0** |
| **devices** | — | `PurchaseContext.device = "web"` ثابت + `// future` | نعم | 2588 |
| **audit** | 6 سجلات نشاط + تايملاين + `OPERATION_EVENT_DIRECTORY` | — | نموذج موحّد · `actor` · سلسلة hash · immutability | 4387 · 4745 · 7421 · 10076 · 11600 · 11764 · 16858 |
| **secrets** | **صفر سرّ في 40,800 سطر** · `resolveProviderCredential()` stub يرفض دائمًا | `PROVIDER_CREDENTIAL_INFRASTRUCTURE_STATUS` (4 متطلبات موثّقة) | — | 2334–2385 — **الأنظف** |
| **attachments** | Data-URI ≤1MB · صور فقط · تحقق MIME من المتصفح | تعليق يوثّق حدود localStorage | فحص محتوى · تحكم وصول · تخزين خادمي | `SUPPORT_ATTACHMENT_MAX_BYTES` 13247 · `validateSupportAttachmentFile` 13254 |
| **SoD / Maker-Checker** | — | — | **كليًا** | `saveBalanceAdjust` 26320 — مسؤول واحد يعدّل أي رصيد بأي مبلغ بلا موافقة ثانية |
| **XSS** | `escapeHtml()` مُعرَّفة | — | تغطية غير مكتملة | `grep escapeHtml(` = **7** مقابل `grep innerHTML` = **26** · `[O]` يحتاج فحصًا مخصصًا |
| **التخزين ككل** | — | — | فشل صامت | **72 مفتاح `PersistenceStore`** · `save()` يبتلع الاستثناء ويُرجع `false` (4291–4297) · **صفر مستدعٍ يفحص القيمة المُرجَعة** |

`[V]` **تأكيد رقمي مستقل:** عدد مفاتيح `PersistenceStore.save` الفريدة = **72** — مطابق تمامًا لما ذكرته `تحليل_فروقات_SPA…docx` («72 مفتاح PersistenceStore صريحًا»). **تقاطع أدلة مستقل يؤكد صحة تلك الوثيقة.**

`[D]` `مرجع_متطلبات_الموحد §31`: «الأمن صلاحيات خادمية Backend-side، وليس حماية واجهة المستخدم فقط.»
`[V]` **الـSPA على النقيض تمامًا اليوم — وهذا متوقّع لنموذج أولي، لكنه يعني أن نطاق الأمن كله `BUILD` لا `MIGRATE`.**

---

# 11. FINAL TRUTH MATRIX

## A. VERIFIED FACTS

| # | الحقيقة | الدليل |
|---|---|---|
| A-01 | `spa_app-175.html` · 40,800 سطر · 2,603,878 بايت · SHA256 مطابق | `sha256sum` |
| A-02 | `<script>` واحد · نطاق عام واحد · لا modules | tag count = 1 |
| A-03 | **72** مفتاح `PersistenceStore` على `localStorage` ببادئة `omda_tel_` | جرد المفاتيح |
| A-04 | `postJournalEntry()` بوابة وحيدة · توازن لكل عملة · تحقق قبل mutation · sourceType/sourceId إلزاميان | 5291–5455 |
| A-05 | Idempotency الـLedger على `(sourceType, sourceId)` **موجود ويعمل** — مسح خطي في الذاكرة | 5236 · 5311 |
| A-06 | **8** مواقع كتابة على `agent.balance` (7 تعديل + 1 إنشاء) | §5.1 |
| A-07 | `providerAccount.balance` يُكتب بلا قيد وبلا سجل حركات | 2443 |
| A-08 | `ownerEntity.balance` يُكتب بلا قيد محاسبي | 40503 |
| A-09 | **5** مسارات "نجاح" بلا أي أثر مالي | §4 |
| A-10 | `reverseJournalEntry()` يُسقط `partyType`/`partyId`/`gatewayId` · **صفر مستدعٍ حي** | 5490–5496 |
| A-11 | **صفر** فحص كفاية رصيد في 5 مسارات خصم من أصل 7 | grep = موقعان فقط |
| A-12 | **صفر** كيان معاملة مالية · `PURCHASE_RECORD_STATUSES` = قيمتان | §9 |
| A-13 | **صفر** `client_ref` · المعرّف يُولَّد بعد رد المزوّد | 632 |
| A-14 | `timeoutMs`/`retryPolicy` بيانات إعداد **لا تُقرأ في أي مسار تنفيذ** | 2063 · 28788 · 28815 |
| A-15 | تكلفة المزوّد تُسجَّل **للكتالوج الرقمي فقط** | استدعاء واحد 39999 |
| A-16 | 3 ربوط مزوّد تغطي **2 من 14** باقة تيليكوم | 15896 |
| A-17 | كلمات مرور نصية صريحة محفوظة في `localStorage` | 16983 · 17315 |
| A-18 | **صفر** 2FA · OTP · device · session expiry · lockout | grep = 0 لكل منها |
| A-19 | **صفر** سرّ مزوّد في الملف · stub يرفض دائمًا | 2334–2385 |
| A-20 | **صفر** `navigator.onLine` · لا SW · لا طابور | grep = 0 |
| A-21 | **9** مواقع مالية تقرّب بمنزلتين متجاوزةً `roundToCurrencyDecimals` | §7.1 |
| A-22 | YER معرَّفة بـ`decimals: 0` | 2776 |
| A-23 | 4 وكلاء ببذور أرصدة مجموعها 1,005,100 ر.ي بلا أي قيد | 4352–4355 |
| A-24 | `TEST SUITE NOT PRESENT IN CURRENT WORKSPACE` | §1 |
| A-25 | **10 من 32** ملف مصدر مفقودة من المشروع | §2.2 |
| A-26 | `spa_app-115.html` تطبيق مختلف، ليس إصدارًا أحدث | §1.3 |
| A-27 | آلة حالات طلبات الخدمة **كاملة ومنضبطة** — الأنضج في التطبيق | 10968–11110 |
| A-28 | محفظة العميل ورصيد المزوّد والحساب المالي **مشتقة بالكامل من الـLedger** | 5669 · 6680 · 7799 |

## B. DOCUMENTED REQUIREMENTS

`[D]` **المصدر الرسمي:** `مرجع_متطلبات_العمدة_تل_الموحد_v1.0.docx §34` — **FR-01 … FR-36** (المصفوفة الكاملة في §3).

`[D]` **المبادئ الملزِمة §31** — 12 مبدأً، أهمها: لا مصدر مالي ثانٍ · الرصيد Projection قابل للمطابقة · لا حذف/تعديل مالي · idempotency لكل استدعاء خارجي · **Timeout ≠ Failure** · الأمن خادمي · لا أسرار في SPA.

`[D]` **دورة المعاملة §35:** `INITIATED -> HELD/RESERVED -> QUEUED -> PROCESSING -> SUCCESS/FAILED أو SUSPENDED/PENDING_PROVIDER -> RESOLVED`.

`[D]` **الهرمية (مرحله 8):** 4 مستويات (`SUPER_ADMIN/MASTER/AGENT/POS`) · `parent_id` + `user_tree_closure` · **Waterfall commission** · شرائح Gold/Silver/Standard · `custom_price_overrides` بأولوية 3 مستويات · **شرط الهامش الموجب** · `LOCKED_COMMISSION` عند التعليق · عزل هرمي.

`[D]` **شجرة الحسابات (شجرة الحسابات والقيود.docx):** **5 مستويات** ترميز عشري · `NUMERIC(15,2)` · قيود عكسية حصرًا · إقفال فترات · FX Gain/Loss · `verify_ledger_integrity()` دوري.

`[D]` **التسعير (التسعير.docx):** `zones` بـ`YER_OLD`/`YER_NEW` **كعملتين مستقلتين** · `pricing_groups` · `service_pricing` بـ Cost/Wholesale/Retail/Commission · `payment_gateways` برصيد وأولوية · **فحص `Gateway Balance >= Service Cost` قبل التوجيه**.

## C. DOCUMENT / CODE CONFLICTS

| # | التعارض | الوثيقة | الكود | الحكم |
|---|---|---|---|---|
| C-01 | اسم الملف | كل الوثائق: `spa_app.html` | الفعلي: `spa_app-175.html` | تسمية · المحتوى مطابق |
| C-02 | ملفات الاختبار | `PROJECT_HANDOFF §6/§9`: 41 ملف · 1530 اختبار · "مُسلَّمة" | **صفر** | **دليل غير موجود** |
| C-03 | مواقع `agent.balance` | `FINAL_ARCH §7.1`: **7** | **8** (يفوته 26219) | خطة T0–T3 ناقصة |
| C-04 | `UNKNOWN` | `§8.1`: «حالة أولى — الحجز يبقى — تصعيد بشري» | `resolveExecutionOutcome` 3745 -> `reject` | تعارض مباشر |
| C-05 | «الأسرار مُدارة» | `§35` | صحيح للمزوّدين · كلمات مرور نصية في localStorage | ناقص |
| C-06 | «لا تغيير مالي خارج الـLedger» | `§35` تحفّظ على `agent.balance` فقط | **5 مسارات خارج المال كله** | غير مكتشف |
| C-07 | «~22% منفَّذ» | `GAP §1` | من FR: 5.6% مكتمل + 47.2% جزئي | غير قابل لإعادة الإنتاج |
| C-08 | القيد العكسي | لم تُذكر في أي وثيقة | يُسقط 3 حقول طرف | **CRITICAL BUG** |
| C-09 | فحص كفاية الرصيد | لم يُذكر · والكود يفرضه في 26331 | غائب في 5 مسارات خصم | تعارض داخلي |
| C-10 | Timeout/Retry | واجهة إدارة تُحرّرهما | لا تُقرآن في التنفيذ | وعد كاذب |
| C-11 | عمق شجرة الحسابات | `FINAL_ARCH §5.1`: 3 مستويات | مسطّح + Dimensions | تعارض |
| C-12 | تكلفة المزوّد | `شجرة الحسابات.docx`: `Cr رصيد المزوّد` إلزامي في كل سداد | كتالوج رقمي فقط | تعارض |
| **C-13** | **عمق COA — ثلاث قيم** | `شجرة الحسابات.docx` = **5** · `مرجع §30` = **5 أو 6 (قرار مفتوح)** · `FINAL_ARCH §5.1` = **3** | مسطّح | **جديد — يجب حسمه (`OPEN-06`)** |
| **C-14** | **عملة الشمال/الجنوب** | `التسعير.docx`: `YER_OLD`/`YER_NEW` **عملتان مستقلتان** بـ`zones` | `CURRENCY_DIRECTORY`: **YER واحدة** · التمييز عبر `gatewayType` | **جديد — يغيّر بنية العملات وFX** |
| **C-15** | **دقة العملة** | `شجرة الحسابات.docx`: `NUMERIC(15,2)` · `التسعير.docx`: `NUMERIC(12,2)` | `YER decimals: 0` + 9 مواقع بمنزلتين | **جديد — انحراف حتمي** |
| **C-16** | **10 مصادر مفقودة** | `مرجع §32` يبني على 32 ملفًا | 22 مواصفة فريدة موجودة | **جديد — مطابقة غير مكتملة بنيويًا** |
| **C-17** | **آلية العمولة** | `مرحله 8`: خياران — **Instant Margin** أو **Commission Wallet** | نموذج ثالث: accrual ثم تسوية إلى **نفس** `agent.balance` | **جديد — لا محفظة عمولات منفصلة (FR-07)** |

## D. MISSED REQUIREMENTS

`[V]` **13 متطلبًا بحالة `NOT_IMPLEMENTED`** من سجل FR الرسمي:
`FR-02` KYC/OTP · `FR-03` Device Binding · `FR-04` Sessions/Rotation · `FR-07` Commission Wallet · `FR-08` Insurance Wallet · `FR-11` Transaction Pipeline · `FR-14` Provider Status Query · `FR-22` Subscriptions · `FR-26` Disputes · `FR-30` Offline · `FR-34` Fraud/Lockout · `FR-36` DR/HA · (+`FR-01` هرمية ضمن PARTIAL لكن الشجرة نفسها معدومة)

`[D]` **إضافات من المصادر المستخرجة لم يذكرها أي تدقيق سابق:**

- `user_tree_closure` — جدول الإغلاق الهرمي (مرحله 8)
- **شرط الهامش الموجب** — رفض تسعير شريحة فرعية دون تكلفة الشريحة الأعلى (مرحله 8)
- **`LOCKED_COMMISSION`** — تجميد العمولة أثناء `SUSPENDED` (مرحله 8)
- **إقفال الفترات + ترحيل الأرصدة الافتتاحية** (شجرة الحسابات.docx)
- **حساب FX Gain/Loss** (شجرة الحسابات.docx)
- **`verify_ledger_integrity()` دوري** (شجرة الحسابات.docx)
- **فحص `Gateway Balance >= Service Cost` قبل التوجيه** (التسعير.docx)
- **`receipt_hash` لمنع تكرار السند** (مرجع §6.2) — الـSPA يمنع التكرار بـ`externalTransactionId` فقط، لا بـhash الصورة
- **حالات التحويلات المجهولة** `UNCLAIMED/CLAIM_PENDING/MATCHED/REFUNDED` (مرجع §6.1)

## E. CURRENT BUGS

| # | الخلل | التصنيف | الحدّة الحالية | الحدّة عند البناء فوقه |
|---|---|---|---|---|
| **E-01** | `reverseJournalEntry()` يُسقط `partyType`/`partyId`/`gatewayId` | **CRITICAL PRE-BACKEND MIGRATION BUG** | كامن (صفر مستدعٍ) | **كارثي وصامت** |
| **E-02** | لا فحص كفاية رصيد في `settlePackagePurchase` ومستدعيه الخمسة | **CRITICAL** | نشط — رصيد سالب ممكن الآن | كارثي |
| **E-03** | `initialBalance` ينشئ رصيدًا بلا قيد وبلا سجل | **HIGH** | نشط | انحراف دائم |
| **E-04** | `ownerEntity.balance` يُعدَّل بلا قيد محاسبي | **HIGH** | نشط | انحراف دائم |
| **E-05** | `providerAccount.balance` بلا سجل حركات إطلاقًا | **HIGH** | كامن (المصفوفة فارغة) | لا مطابقة ممكنة |
| **E-06** | تقريب العمولة بمنزلتين مقابل YER صفرية | **HIGH** | نشط — انحراف حتمي | ضجيج مطابقة دائم |
| **E-07** | `PersistenceStore.save()` يفشل صامتًا · صفر فاحص للقيمة المُرجَعة | **HIGH** | نشط — فقدان قيود عند امتلاء التخزين | — |
| **E-08** | `unknown` يُعامَل كرفض | **MEDIUM** | كامن (لا مزوّد حقيقي) | إنكار عملية ناجحة |
| **E-09** | تكلفة المزوّد غير مُسجَّلة للتيليكوم/الواي فاي/الخدمات اليدوية | **MEDIUM** | نشط — تقارير ربحية خاطئة | — |
| **E-10** | `escapeHtml` 7 مواقع مقابل 26 `innerHTML` | **UNKNOWN** | `[O]` يحتاج فحصًا مخصصًا | — |

## F. CURRENT MOCKS

| المكوّن | الحالة | الدليل |
|---|---|---|
| `mockExecuteRecharge` · `mockPurchaseWholesale` · `mockPayPostpaidBill` · `mockPayLandlineBill` · `mockPayInternetManual` | **MOCK_ONLY — NO FINANCIAL EFFECT** | §4 |
| `mockFetchBalance` · `mockCheckPostpaidBill` · `mockCheckLandlineBill` · `mockCheckInternetBalance` | MOCK — استعلامات، لا أثر مالي مطلوب أصلًا | 328 · 702 · 756 · 525 |
| `mockProviderAdapterExecute` | MOCK حتمي (بلا عشوائية) — 3 مزوّدين يشيرون إليه | 1952 · `ProviderRegistry._adapters` 2548 |
| `FundingVerificationAdapter` | MOCK — `FundingVerificationTestControl` | 6195 · 6204 |
| `resolveProviderCredential` | **STUB مقصود يرفض دائمًا** | 2379 |
| `MOCK_CONTACTS` · `MOCK_WHOLESALE_DENOMINATIONS` · `MOCK_OPERATIONS` | بيانات عرض | 387 · 660 · 4250 |
| `GATEWAY_EXCHANGE_RATES.NORTH_TO_SOUTH = 2.94` | ثابت مبرمج متروك | 407 |
| **محركات مبنية بلا بيانات** | `PRICING_RULE_DIRECTORY` · `COMMISSION_POLICY_DIRECTORY` · `COMMERCIAL_RULE_DIRECTORY` · `PROVIDER_ACCOUNT_DIRECTORY` · `FINANCIAL_ACCOUNT_DIRECTORY` · `CATEGORY_COMMERCIAL_PROFILE_DIRECTORY` — **كلها `[]`** | 3423 · 7024 · 2996 · 2134 · 7684 · 2947 |

## G. CURRENT FINANCIAL SOURCE-OF-TRUTH VIOLATIONS

`[D]` القاعدة (مرجع §31): «لا يوجد مصدر مالي ثانٍ ينافس دفتر الأستاذ المركزي.»

| # | المخالفة | الشدة |
|---|---|---|
| **G-01** | `agent.balance` — حقل مباشر · 8 مواقع كتابة · **هو ما تعرضه كل الواجهات** بينما `getAgentWalletBalance()` المحاسبية غير موصولة بأي شاشة | حرجة جدًا |
| **G-02** | `WALLET_LEDGER` — **دفتر ثالث** بـ`beforeBalance`/`afterBalance` خاص به، موازٍ للـJournal | حرجة |
| **G-03** | `providerAccount.balance` — حقل مباشر **بلا سجل حركات وبلا قيد**، والكود يعترف بذلك | حرجة جدًا |
| **G-04** | `ownerEntity.balance` (واي فاي) — يُعدَّل بـ`WALLET_LEDGER` فقط، **بلا قيد** | حرجة |
| **G-05** | `initialBalance` — رصيد افتتاحي بلا أي أثر محاسبي | حرجة |
| **G-06** | بذور 4 وكلاء بـ1,005,100 ر.ي بلا قيد افتتاحي | عالية |
| **G-07** | انحراف التقريب الحتمي بين `agent.balance` (منزلتان) و`AGENT-WALLET-LIABILITY` (صفر منزلة) | عالية |
| **G-08** | 5 مسارات مالية **خارج كل الدفاتر معًا** | حرجة جدًا |
| **G-09** | القيد العكسي لا يصل إلى subledger أي طرف | حرجة جدًا |

## H. MIGRATION TARGET

| المصدر الحالي | الهدف | الإجراء |
|---|---|---|
| `postJournalEntry` + قواعده | `journal_entries` + `journal_entry_lines` + CHECK constraints + معاملة ذرية | **MIGRATE — الأصل الأثمن** |
| `partyType`/`partyId`/`gatewayId` على السطر | أعمدة أبعاد + فهارس | **MIGRATE — قرار ممتاز** |
| `getCustomerWalletBalance` / `getProviderBalance` / `getFinancialAccountBalance` | Views أو Materialized Views | **MIGRATE** |
| `agent.balance` + `WALLET_LEDGER` | `AGENT-WALLET-LIABILITY` + Projection قابلة للمطابقة | **REBUILD FINANCIAL PATH** |
| `providerAccount.balance` | حساب أصل + قيود | **REBUILD** |
| دورة التغذية اليدوية | `funding_requests` + `receipt_hash` + مطابقة | **MIGRATE + HARDEN** |
| `EXECUTION_RESPONSE_STATUSES` (11) + `ExecutionResponseCodeRegistry` | enum + جدول ترجمة لكل مزوّد | **MIGRATE** |
| `PurchaseContext/Request/Result/Strategy` | عقد خدمة التنفيذ | **MIGRATE** |
| `SERVICE_REQUEST_STATE_TRANSITIONS` + Timeline + Dispatch | **قالب آلة حالة المعاملة المالية** | **KEEP + استخدمه نموذجًا** |
| الدعم والمحادثات | `conversations` + `messages` + تخزين ملفات | **MIGRATE** |
| فصل Workspace عن Role | نموذج الهوية | **MIGRATE** |
| `resolveCommissionPolicy` | محرك سياسات خادمي + Waterfall | **REBUILD AUTHORITY** |
| `reconcile*` التشخيصية | Reconciliation Layer (4 طبقات) | **MIGRATE + EXTEND** |
| 8 مصفوفات صلاحيات | RBAC/ABAC خادمي | **REBUILD (المنطق يُنقل)** |
| 6 سجلات نشاط | `audit_log` موحّد immutable | **REBUILD** |
| 72 مفتاح localStorage | PostgreSQL + cache محدود | **MIGRATE** |
| المسارات الخمسة الوهمية | — | **BUILD من الصفر** |
| Transaction · Idempotency · Reservation · Outbox · Workers · Offline · Security · Hierarchy · Disputes · FX · Price Lock · Fallback · Timeout/Retry · DR | — | **BUILD** |

## I. OPEN DECISIONS

`[O]` **لم أحسم أيًا منها. كلها لكم.**

| ID | القرار | لماذا لا رجعة فيه |
|---|---|---|
| `OPEN-02` | **تمثيل المال** — YER بكم منزلة؟ (§7.3 · C-15) | يدخل في نوع كل عمود مالي |
| `OPEN-CUR-2` | **`YER_OLD`/`YER_NEW`: عملتان أم واحدة ببوابتين؟** (C-14) | يحدد بنية `currencies` و`fx_rates` |
| `OPEN-CUR-3` | معالجة كسور التقريب — هل يلزم حساب فروق تقريب في COA؟ | يضيف حسابًا للشجرة |
| `OPEN-04` | **قطع `agent.balance`** — متى وكيف؟ (8 مواقع لا 7) | يجب أن يسبق أي بناء فوق المحفظة |
| `OPEN-06` | **عمق شجرة الحسابات: 3 أم 5 أم 6؟** (C-13) | يحدد كل قيد لاحق |
| `OPEN-COM-1` | **آلية العمولة: Instant Margin أم Commission Wallet منفصلة؟** (C-17 · FR-07) | يحدد بنية المحافظ |
| `OPEN-COM-2` | نسب العمولة الفعلية — المصادر "توضيحية" | لا يمنع البدء |
| `OPEN-03` | مصير `WALLET_LEDGER` بعد الترحيل — RETIRE؟ | — |
| `OPEN-BUG-1` | **إصلاح `reverseJournalEntry` في الـSPA أم في الـBackend مباشرة؟** | — |
| `OPEN-TST-1` | **الاختبارات الـ41: تُحضَر أم يُحذف الادعاء؟** | يحدد ما إذا كان لدينا أي دليل جودة |
| `OPEN-DOC-1` | **المصادر العشرة المفقودة: تُرفَع أم يُمضى بدونها؟** | يحدد اكتمال المطابقة |
| `OPEN-11` | تفاصيل SoD | — |
| `OPEN-18` | مهلة الحجز | — |

## J. BLOCKERS FOR ARCHITECTURE FREEZE

راجع القسم 13.

---

# 12. ما أُنجز وما لم يُنجز في هذه المرحلة

`[V]` **أُنجز:** البحث الشامل عن الاختبارات (5 نطاقات) · استخراج نص 26 DOCX كاملة · مصفوفة FR-01…FR-36 مقابل الكود بأدلة أسطر · إعادة تحقق مستقلة من المسارات الخمسة · جرد شامل لـ11 موقع كتابة رصيد · إثبات حقلي لخلل القيد العكسي · جرد 12 موقع تقريب · مصفوفة تكلفة المزوّد لأربعة أنواع · بحث مستقل عن كيان المعاملة · فصل الأمن المنفَّذ عن الموثَّق · هذا الملف.

`[V]` **لم يُنجز عمدًا (ممنوع):** لا تعديل على `spa_app-175.html` · لا إصلاح ولا اختبار ولا Backend ولا DB ولا migration ولا refactor · لا حسم لأي `OPEN DECISION`.

`[V]` **الملف الوحيد المُنشأ:** `FINAL_TRUTH_MATRIX.md`. لم يُحذف أو يُعاد تسمية أي ملف.

---

# 13. FINAL QUESTION

## هل بعد هذه المرحلة أصبح لدينا دليل كافٍ لتجميد Architecture؟

**لا. لكن العدد انخفض من 6 إلى 3.**

`[V]` **حُسم في هذه المرحلة (لم تعد Blockers):**

| كان | الحالة الآن |
|---|---|
| ~~B-01 المسارات الخمسة~~ | **مُوثَّقة نهائيًا** بمصفوفة 9 نقاط لكل مسار — أصبحت **معطى معروفًا** يُصنَّف `BUILD`، لا مجهولًا |
| ~~B-02 ملفات الاختبار~~ | **الحقيقة مثبتة رسميًا:** `TEST SUITE NOT PRESENT`. لم تعد سؤالًا مفتوحًا — أصبحت **قرارًا** (`OPEN-TST-1`) |
| ~~B-03 مطابقة DOCX~~ | **أُنجزت جزئيًا** — 22 مواصفة من 32 · FR-01…FR-36 مطابَقة بالكامل. تبقّت 10 مصادر ← تحوّلت إلى `OPEN-DOC-1`، لا Blocker |

`[V]` **ما بقي بالضبط — 3 Blockers فقط، كلها قرارات لكم لا أعمال لي:**

```
BLOCKER 1 — OPEN-02 + OPEN-CUR-2 : تمثيل المال والعملات
  الدليل : YER decimals=0 (سطر 2776) مقابل 9 مواقع مالية تقرّب بمنزلتين
           (7084 · 7137 · 7192 · 7193 · 7307 · 8500 · 9285 · 9346 · 40499)
           + التسعير.docx يفرض YER_OLD و YER_NEW كعملتين مستقلتين
           بينما CURRENCY_DIRECTORY يعرّف YER واحدة.
  لماذا يمنع : نوع كل عمود مالي وبنية جدولي currencies/fx_rates تتحدد بهذا.
               الانحراف بين agent.balance و AGENT-WALLET-LIABILITY حتمي رياضيًا
               وليس احتماليًا، وسيُغرق أي مطابقة مستقبلية بضجيج.

BLOCKER 2 — OPEN-06 : عمق شجرة الحسابات
  الدليل : ثلاث قيم متعارضة موثَّقة —
           شجرة الحسابات والقيود.docx      = 5 مستويات (ترميز عشري 100000/110000/111000/111100)
           مرجع_متطلبات_الموحد §30         = "5 أو 6 — قرار مفتوح؛ يجب تثبيت نموذج واحد"
           ALOMDA_TEL_FINAL_ARCHITECTURE §5.1 = 3 مستويات + Dimensions
           الكود الفعلي                    = مسطّح + parentAccountId اختياري + Dimensions
  لماذا يمنع : كل قيد لاحق، وكل تقرير، وكل ميزان مراجعة يُبنى على هذا الترميز.

BLOCKER 3 — OPEN-04 : نقطة قطع agent.balance (8 مواقع، لا 7)
  الدليل : جدول §5.1 — 7 مواقع تعديل + الموقع الثامن (سطر 26219، initialBalance)
           المغفول في FINAL_ARCHITECTURE §7.1، إضافة إلى providerAccount.balance
           (2443، بلا سجل حركات إطلاقًا) و ownerEntity.balance (40503، بلا قيد).
  لماذا يمنع : FINAL_ARCHITECTURE §35 نفسه يقرّ "يجب أن يسبق أي بناء فوقها".
               وخطة T0–T3 الحالية ناقصة موقعًا واحدًا على الأقل، فاعتمادها كما هي
               يعني ترحيلًا غير مكتمل بحكم التصميم.
```

`[V]` **ما لم أُدرجه Blocker رغم خطورته — وسبب ذلك:**

| البند | لماذا ليس Blocker |
|---|---|
| `reverseJournalEntry` (E-01) | خلل **كامن بصفر مستدعٍ حي**. لا يمنع تجميد المعمارية — يمنع بناء Refund. **يُدرَج في خطة التنفيذ كأولوية P0، لا كشرط تجميد.** |
| فحص كفاية الرصيد (E-02) | خلل في الـSPA. المعمارية المستهدفة تحلّه بنيويًا عبر `HELD`. **يُوثَّق ولا يُجمَّد لأجله.** |
| المصادر العشرة المفقودة | تؤثر على **تفاصيل** FR-03/04/10/13/14/23/24/28/36، لا على القرارات الثلاثة أعلاه. **يمكن رفعها بالتوازي مع Phase 0.** |
| الاختبارات الـ41 | أصبحت حقيقة موثَّقة وقرارًا (`OPEN-TST-1`)، لا مجهولًا. **لا تُغيّر أي قرار معماري.** |
| المسارات الخمسة | موثَّقة بالكامل ومصنَّفة `BUILD`. **معطى معروف، لا حاجز.** |

## الخلاصة

`[V]` **الثلاثة المتبقية كلها قرارات تخصكم وحدكم، ولا يوجد فيها عمل تحليلي متبقٍّ عليّ.**
كل واحد منها مدعوم بأدلة رقمية من الكود ومن المصادر، ومصنَّف أصلًا في `ALOMDA_TEL_FINAL_ARCHITECTURE §35` بأنه **"لا رجعة فيه"**.

`[R]` **بمجرد اعتماد `OPEN-02` + `OPEN-CUR-2` و`OPEN-06` و`OPEN-04` — يصبح Architecture Freeze مبرَّرًا بالأدلة.**

---

**لم يُعدَّل `spa_app-175.html`. لم يُعدَّل أي ملف من ملفات المشروع. لم يُحذف أو يُعاد تسمية شيء.**
**الملف الوحيد المُنشأ: `FINAL_TRUTH_MATRIX.md`.**
**لا كود · لا إصلاحات · لا Backend · لا PostgreSQL · لا migrations · لا refactor.**
