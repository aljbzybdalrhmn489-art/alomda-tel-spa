# SPA_LOGIC_CORRECTION_AUDIT
## Phase 0.5 — مراجعة ما قبل التعديل (لم يُعدَّل أي كود بعد)

**الملف:** `spa_app-175.html`
**SHA256 قبل أي تعديل:** `b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8`
**الأسطر:** 40,800
**المرجع الملزم:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` (ADR-101 → ADR-119)
**التاريخ:** 2026-09-07

> كل موقع أدناه أُعيد اكتشافه بالبحث عن الرموز والدوال في النسخة الحالية — **لم يُعتمد على رقم سطر قديم**.

---

## 0. الجرد الشامل لكل تحوير رصيد في الملف (§4.15)

`grep` كامل على: `.balance =` · `.balance +=` · `.balance -=` · `.balance++` · `.balance--` · `Object.assign(...balance...)` · `balance:` — النتائج مصنَّفة:

| # | السطر | الرمز | التصنيف | ملاحظة |
|---|---|---|---|---|
| 1 | 2165 | `a.balance = 0` في `loadPersistedProviderAccountDirectoryState` | **LEGACY / SAFE** | ترقية بيانات قديمة إلى صفر — لا يُنشئ مالًا |
| 2 | 2226 | `balance: 0` في `createProviderAccount` | **SAFE** | إنشاء بصفر |
| 3 | 2443 | `account.balance = amount` في `setProviderAccountBalance` | **FINANCIAL / LEGACY** | المسار الوحيد؛ `PROVIDER_ACCOUNT_DIRECTORY` فارغ ولا مستدعٍ حي |
| 4 | 2469 | `account.balance + delta` في `updateProviderAccountBalance` | **FINANCIAL / LEGACY** | لا يكتب بنفسه — يمرّ عبر (3) |
| 5 | 4352–4355 | `balance:` في بذور `AGENT_DIRECTORY` | **FINANCIAL / LEGACY DATA** | 1,005,100 ر.ي بلا قيد — بيانات ترحيل، لا تُحذف |
| 6 | 4970 | `balance: 0` في `ensureAgentCapabilityRecordForCustomer` | **SAFE** | إنشاء بصفر |
| 7 | 7313 | `agent.balance += totalAmount` — `settleAgentCommissions` | **FINANCIAL** | نموذج العمولة القديم |
| 8 | 9495 | `source.balance -= amount` — `transferWalletFunds` | **FINANCIAL** | مقترن بقيد + Ledger |
| 9 | 9506 | `destination.balance += amount` — `transferWalletFunds` | **FINANCIAL** | مقترن بقيد + Ledger |
| 10 | 21866 | `Object.assign(state.rechargeCabinet.mobile.balance, patch)` | **NON_FINANCIAL** | حالة شاشة استعلام الرصيد — لا تُمس |
| 11 | 21927 | `mobile.balance = {stage:…}` | **NON_FINANCIAL** | إعادة تعيين حالة UI — لا تُمس |
| 12 | 26219 | `balance: Number(f.initialBalance) \|\| 0` — إنشاء وكيل | **FINANCIAL** | 🔴 ينشئ رصيدًا صامتًا |
| 13 | 26336 | `agent.balance = ±amount` — `saveBalanceAdjust` | **FINANCIAL** | مقترن بقيد + Ledger + فحص سالب |
| 14 | 40259 | `agent.balance -= chargeAmount` — `settlePackagePurchase` | **FINANCIAL** | 🔴 بلا فحص كفاية |
| 15 | 40343 | `agent.balance -= product.price` — `chargeAgentForManualService` | **FINANCIAL** | مسبوق بفحص كفاية ✅ |
| 16 | 40503 | `ownerEntity.balance += ownerRevenue` — `creditWifiNetworkOwnerForSale` | **FINANCIAL** | 🔴 بلا أي قيد محاسبي |

**قراءات فقط (ليست تحويرًا):** 5887 · 6766 · 8652 · 8653 · 26939 · 27053 — تشخيص/عرض.
**لا مصادر مالية مخفية أخرى.** لا `setProperty` ولا تحويرات عبر مصفوفات ولا كتابة رصيد مباشرة إلى `localStorage`.

---

## 1. سجل المخالفات

### V-01 · `reverseJournalEntry()` يُسقط أبعاد السطر
| | |
|---|---|
| **الموقع** | `reverseJournalEntry` — كتلة `reversedLines` (السطر ~5490) |
| **الرمز** | `originalLines.map((l) => ({ accountId, currencyCode, debit, credit, description }))` |
| **المخالفة** | يُنسخ 5 حقول من 13. تُفقد `partyType` · `partyId` · `gatewayId`. `postJournalEntry` يعوّضها بـ`null`. |
| **لماذا مخالفة** | `getCustomerAccountLineTotals` / `getAgentWalletAccountLineTotals` / `getProviderAccountLineTotals` تُرشِّح إلزاميًا على `partyType`/`partyId`. سطر بـ`partyId: null` **لا يدخل رصيد أي طرف** ← العكس لا يصل إلى الـSubledger. |
| **ADR** | **ADR-110** (العكس ينسخ الأبعاد) · **ADR-103** (الأبعاد هي السجل الفرعي) · D-10.5 |
| **الخطورة** | 🔴 **CRITICAL** — صامت تمامًا: القيد يتوازن والتقرير الإجمالي سليم، والخطأ في رصيد الطرف فقط |
| **الحدّة اليوم** | كامنة — `grep` يؤكد **صفر مستدعٍ حي** |
| **الإجراء** | **FIX NOW** — نسخ الأبعاد الموجودة فعليًا في شكل السطر الحالي (`partyType`, `partyId`, `gatewayId`). **ممنوع اختراع أبعاد غير موجودة** (`providerId`/`zoneId`/`serviceId`/`financialAccountId` غير موجودة في شكل السطر الحالي) |
| **آمن داخل SPA؟** | ✅ نعم — تغيير محصور في دالة واحدة، بلا مستدعين |

### V-02 · لا فحص كفاية رصيد قبل الخصم
| | |
|---|---|
| **الموقع** | `settlePackagePurchase` (~40257) ومستدعوه: `runPackagePurchase` · `runInternetPackagePurchase` · `runLandlinePackagePurchase` · `purchaseWifiProduct` · `settleDigitalCatalogPurchase` |
| **المخالفة** | خصم مباشر بلا أي فحص. `grep "balance <\|balance >="` = **موقعان فقط** في الملف كله (`transferWalletFunds` 9488 · `validateAgentBalanceForManualService` 40320) |
| **لماذا مخالفة** | الكود نفسه يفرض «لا يمكن أن يصبح الرصيد سالباً» في `saveBalanceAdjust` (26331) — **تعارض داخلي**. و ADR-105 يعرّف `Available` كبوابة إلزامية قبل أي خصم |
| **ADR** | **ADR-105** · ADR-107 (خطوة `HELD` قبل التنفيذ) |
| **الخطورة** | 🔴 **CRITICAL** — نشط الآن |
| **الإجراء** | **FIX NOW** — فحص قبلي عند نقطة البدء + رفض دفاعي داخل `settlePackagePurchase` نفسها (تُرجع نتيجة، ولا تُحوِّر عند عدم الكفاية)، ومستدعوها يعرضون فشلًا بدل نجاح كاذب. **لا Credit Engine، ولا اختراع حد ائتمان** |
| **آمن داخل SPA؟** | ✅ نعم — يستخدم قاعدة موجودة أصلًا في الملف، بلا مفهوم جديد |

### V-03 · `initialBalance` ينشئ رصيدًا صامتًا
| | |
|---|---|
| **الموقع** | `saveAgentForm` وضع `add` (~26219) · حقل النموذج `af-initial-balance` (~25831) |
| **المخالفة** | `balance: Number(f.initialBalance) \|\| 0` — رصيد افتتاحي غير صفري **بلا قيد وبلا سجل حركات** |
| **لماذا مخالفة** | ADR-104/D-04.3: «إنشاء أي طرف يبدأ بصفر دائمًا. أي رصيد افتتاحي = عملية تغذية منفصلة بـMaker/Checker» |
| **ADR** | **ADR-104** |
| **الخطورة** | 🔴 **HIGH** — نشط · وهو الموقع الثامن الذي أغفلته `FINAL_ARCHITECTURE §7.1` |
| **الإجراء** | **RETIRE** — الإنشاء بصفر دائمًا + إزالة الحقل من النموذج. **بيانات الوكلاء القائمة لا تُمس** |
| **آمن داخل SPA؟** | ✅ نعم |

### V-04 · `ownerEntity.balance` يُعدَّل بلا أي قيد محاسبي
| | |
|---|---|
| **الموقع** | `creditWifiNetworkOwnerForSale` (~40485–40520)، مُستدعاة من `purchaseWifiProduct` (~40615) |
| **المخالفة** | `ownerEntity.balance += ownerRevenue` + `createWalletLedgerEntry` — **بلا `postJournalEntry` إطلاقًا**. الموقع الوحيد في الملف بهذا الوصف |
| **لماذا مخالفة** | ADR-104/D-04.4: حصة مالك الواي فاي التزام (`WIFI-OWNER-SHARE-EXPENSE` → `PARTY-WALLET-LIABILITY`)، وليست تحوير رصيد. والقيمة تُقرَّب بـ`Math.round(x*100)/100` بلا عملة |
| **ADR** | **ADR-104** · ADR-106 (الحصة عبر منطق العمولة) · ADR-102 |
| **الخطورة** | 🔴 **HIGH** — نشط |
| **الإجراء** | **RETIRE MUTATION** — إيقاف تحوير الرصيد وإيقاف الكتابة في `WALLET_LEDGER` لهذا المسار. **ممنوع اختراع قيد محلي بديل**. القيمة المُرجَعة **مُهمَلة أصلًا** عند المستدعي (تحقُّق مؤكَّد) فلا أثر على الواجهة |
| **آمن داخل SPA؟** | ✅ نعم — القيمة المُرجَعة غير مستهلكة |

### V-05 · خمسة مسارات تعرض «نجاحًا ماليًا» بلا أي أثر مالي
| | |
|---|---|
| **الموقع** | `runRecharge` · `runWholesalePurchase` · `runPostpaidPayment` · `runLandlinePayment` · `runInternetManualPayment` — وشاشاتها: `RechargeSuccessState` · `WholesaleSuccessState` · `PostpaidSuccessState` · `LandlineManualResultArea` · `InternetManualResultAreaHTML` |
| **المخالفة** | `Math.random() < 0.25` + `setTimeout` → «تم الشحن بنجاح» + **رقم مرجع** — بلا مزوّد، بلا خصم، بلا قيد، بلا سجل مشتريات. المؤشر الوحيد اليوم عبارة «(بيانات تجريبية)» بجانب الوقت فقط |
| **لماذا مخالفة** | ADR-115 (لا حالة `SUCCESS` تمثل حركة مالية بلا خادم) · ADR-107 (لا معاملة بلا `HELD`/تنفيذ/تسوية) |
| **ADR** | **ADR-115** · ADR-107 |
| **الخطورة** | 🔴 **CRITICAL** — ادعاء كاذب بالنجاح المالي أمام المستخدم |
| **الإجراء** | **MOCK → صريح** — لافتة محاكاة ظاهرة في كل شاشة نجاح من الخمس + إعادة تسمية «رقم المرجع» إلى «مرجع محاكاة». **ممنوع بناء تنفيذ حقيقي** |
| **آمن داخل SPA؟** | ✅ نعم — عرض فقط، بلا مساس بالتنقل أو التصميم |

### V-06 · تقريب ثابت في مسار تسعير له عملة معلومة
| | |
|---|---|
| **الموقع** | `computeCustomerGatewayPrice` (~3297): `Math.round(pkg.price * exchange.rate * 100) / 100` |
| **المخالفة** | منزلتان ثابتتان بينما `gateway.defaultCurrencyCode` متاح في نفس النطاق و`roundToCurrencyDecimals()` موجودة |
| **ADR** | **ADR-102** |
| **الخطورة** | 🟠 MEDIUM |
| **الإجراء** | **FIX NOW** — استبدال بـ`roundToCurrencyDecimals(..., gateway.defaultCurrencyCode)` |
| **آمن داخل SPA؟** | ✅ نعم — العملة متاحة يقينًا |

### V-07 · تقريب ثابت في مسارات بلا مصدر عملة
| | |
|---|---|
| **المواقع** | 7084 `calculateCommissionAmount` · 7137 `groupCommissionAccrualsByCompany` · 7192/7193 `accrueCommissionForPurchase` · 7307 `settleAgentCommissions` · 8500 `calculateManualServiceProfitBreakdown` · 9285/9346 إشعارات · 40499 `creditWifiNetworkOwnerForSale` |
| **المخالفة** | منزلتان ثابتتان مقابل `YER decimals: 0` |
| **لماذا لا تُصلَح الآن** | **لا عملة في النطاق.** `settleAgentCommissions(agentId, periodStart, periodEnd, currencyCode)` يقبل عملة، لكن **مستدعيه الوحيد (38559) لا يمررها**. استبدال التقريب بلا عملة = تخمين، و§4.8 يمنع تغيير سلوك مسار Legacy بلا ضمان ترحيل |
| **ADR** | ADR-102 |
| **الخطورة** | 🟠 MEDIUM (انحراف حتمي موثَّق كـE-06) |
| **الإجراء** | **BACKEND / MIGRATION** — يُوسَم في الكود كـLEGACY ويُرحَّل مع إعلان العملة (BLOCKER-2) |
| **آمن داخل SPA؟** | ❌ لا — يتطلب بيانات عملة غير متوفرة |

### V-08 · `GATEWAY_EXCHANGE_RATES.NORTH_TO_SOUTH = 2.94`
| | |
|---|---|
| **الموقع** | ثابت 407–409 · `convertNorthPriceToSouthGateway` (414) |
| **الحقيقة المُتحقَّقة** | `grep` = **صفر مستدعٍ**. الدالة **كود ميت**، والقيمة **غير تشغيلية اليوم** |
| **ADR** | **ADR-101** (2.94 = PLACEHOLDER · تُرحَّل إلى `fx_rates`) |
| **الخطورة** | 🟡 LOW |
| **الإجراء** | **MODIFY (توثيق فقط)** — وسم صريح `PLACEHOLDER / DEAD / DO NOT USE`. **لا حذف** (قد يُطلب في الترحيل)، ولا اختراع سعر `YEO ↔ YER` |
| **آمن داخل SPA؟** | ✅ نعم — تعليق فقط |

### V-09 · إنشاء حساب COA لكل Financial Account
| | |
|---|---|
| **الموقع** | `createFinancialAccount` (~7740): `createAccount({ code: "FA-…", name: "حساب مالي: "+name, type: ASSET })` عند غياب `linkedAccountId` |
| **الحقيقة المُتحقَّقة** | **صفر مستدعٍ حي** · `FINANCIAL_ACCOUNT_DIRECTORY = []` — السلوك **كامن ولم يُنفَّذ قط** |
| **لماذا مخالفة** | ADR-103/D-03: حساب `BANK` واحد + بُعد `financial_account_id`. لا `BANK_1/BANK_2/…` |
| **ADR** | **ADR-103** |
| **الخطورة** | 🟠 MEDIUM (كامنة) |
| **الإجراء** | **MODIFY** — جعل `linkedAccountId` إلزاميًا ورفض الإنشاء التلقائي. **صفر أثر سلوكي اليوم** ويمنع المخالفة من الوقوع. **لا إعادة بناء لشجرة الحسابات** |
| **آمن داخل SPA؟** | ✅ نعم — بلا مستدعين |

### V-10 · `providerAccount.balance` كحقل رصيد
| | |
|---|---|
| **الموقع** | `setProviderAccountBalance` (2443) · `updateProviderAccountBalance` (2465) |
| **الحقيقة المُتحقَّقة** | **صفر مستدعٍ حي** لأي منهما · `PROVIDER_ACCOUNT_DIRECTORY = []` |
| **ADR** | **ADR-104** (RETIRE) · ADR-103 |
| **الخطورة** | 🟠 MEDIUM (كامنة) |
| **الإجراء** | **MODIFY (توثيق فقط)** — وسم `LEGACY / NOT A SOURCE OF TRUTH`. **لا حذف** (ADR-104 يقضي بإسقاطه في الـBackend لا في SPA)، ولا بناء نظام رصيد مزوّد داخل SPA |
| **آمن داخل SPA؟** | ⚠️ التوثيق فقط آمن؛ الإسقاط الفعلي = BACKEND |

### V-11 · `agent.balance` كمصدر حقيقة (6 مسارات كتابة حية)
| | |
|---|---|
| **المواقع** | `settleAgentCommissions` · `transferWalletFunds` ×2 · `saveBalanceAdjust` · `settlePackagePurchase` · `chargeAgentForManualService` |
| **ADR** | **ADR-104** — القطع في **T2 داخل الـBackend**، لا في SPA |
| **الخطورة** | 🔴 CRITICAL (معروفة ومخططة) |
| **الإجراء** | **BACKEND ONLY** — §4.1 يمنع تنفيذ T0/T1/T2 داخل SPA. المطلوب هنا فقط: **عدم زيادة الدين** + وسم `LEGACY / TRANSITIONAL` |
| **آمن داخل SPA؟** | ❌ القطع غير آمن — يكسر SPA بلا Backend |

### V-12 · `WALLET_LEDGER` كدفتر موازٍ
| | |
|---|---|
| **الموقع** | `createWalletLedgerEntry` + 7 مواقع استدعاء |
| **ADR** | **ADR-104** — `RETIRE-AS-ARCHIVE` في الـBackend |
| **الإجراء** | **BACKEND ONLY** + وسم. الاستثناء الوحيد: **إزالة الكتابة الجديدة في مسار الواي فاي** (V-04) لأنها الوحيدة بلا قيد مقابل. **لا حذف بيانات، ولا كسر لـ`reconcile*` التي تقرأ منه** |

### V-13 · نموذج العمولة القديم (`agent.balance += commission`)
| | |
|---|---|
| **الموقع** | `settleAgentCommissions` (7313) |
| **ADR** | **ADR-106** — `COMMISSION-PAYABLE` منفصل، تسوية إلى المحفظة |
| **الإجراء** | **BACKEND ONLY** — بناء Commission Wallet داخل SPA = مصدر حقيقة ثالث (ممنوع §6). المطلوب: عدم ترسيخ النموذج القديم بمنطق جديد. **لا نسب مخترعة** — `COMMISSION_POLICY_DIRECTORY` فارغ ويبقى `UNKNOWN/CONFIGURATION` |

### V-14 · تكلفة المزوّد غير مُسجَّلة للتيليكوم/الواي فاي/الخدمات اليدوية
| | |
|---|---|
| **الموقع** | `postAutomaticProviderAccountingForPurchase` — مستدعٍ واحد فقط (`settleDigitalCatalogPurchase`) |
| **ADR** | **ADR-110** (`settlement_model`) |
| **الإجراء** | **BACKEND ONLY** — ربطها الآن يتطلب `settlement_model` وعملة، وكلاهما `UNKNOWN`. **ممنوع اختراع تكلفة**. `calculateManualServiceProfitBreakdown` تقرأ `product.cost` الحقيقي ولا تخترع — تبقى كما هي (عرض فقط) |

### V-15 · تناقض `YER` / `YER_NEW` / `YER_OLD`
| | |
|---|---|
| **المواقع** | `CURRENCY_DIRECTORY` (2776) يعرّف `YER` واحدة · `CURRENCY_LABEL` (22178) يعرّف `YER_NEW`/`YER_OLD` · `mockFetchBalance` (334) يُرجع `currency: "YER_NEW"` |
| **ADR** | **ADR-101** (`YER` + `YEO`) |
| **الإجراء** | **BACKEND / MIGRATION** — فصل العملتين يمسّ كل عمود مبلغ. §4.9 يمنع إعادة بناء محرك العملة الآن. المطلوب: وسم التناقض + منع منطق جديد يفترض أن `YER` تمثل المنطقتين. `mockFetchBalance` استعلام غير محاسبي — يبقى |

---

## 2. خلاصة القرارات قبل التنفيذ

| الإجراء | العناصر |
|---|---|
| **FIX NOW** | V-01 · V-02 · V-06 |
| **RETIRE** | V-03 · V-04 (التحوير) |
| **MOCK → صريح** | V-05 |
| **MODIFY (وسم/حارس بلا أثر سلوكي)** | V-08 · V-09 · V-10 |
| **BACKEND ONLY** | V-07 · V-11 · V-12 · V-13 · V-14 · V-15 |
| **لا يُمس** | التصميم · التنقل · الثيم · الكتالوج · الدعم · الصلاحيات · حالة UI للرصيد (10, 11) · بذور الوكلاء (5) |

**تعهّد النطاق:** لن يُنشأ أي مصدر حقيقة مالي جديد · لا Wallet جديد · لا Journal محلي مخترع · لا نسب/أسعار/تكاليف/أسعار صرف مخترعة · لا Backend · لا T0/T1/T2.

**التالي:** تنفيذ الإصلاحات المصنَّفة FIX/RETIRE/MODIFY فقط، ثم `SPA_LOGIC_CORRECTION_REPORT.md`.
