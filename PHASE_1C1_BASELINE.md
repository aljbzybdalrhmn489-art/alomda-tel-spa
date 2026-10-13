# PHASE_1C1_BASELINE
## ALOMDA TEL · حالة المشروع قبل كتابة أي كود محاسبي

**التاريخ:** 2026-09-07
**المرحلة:** Phase 1C-1 — Chart of Accounts + Accounting Model
**المرجع الحاكم:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` **ADR-103** (COA · **FROZEN · غير قابل للتراجع**) · `BACKEND_TECHNICAL_DESIGN_v1.0.md §5` · `POSTGRESQL_LOGICAL_SCHEMA_v1.0.md §21 · §24`
**SPA:** `spa_app-175.html` · SHA256 `7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1`

---

# 1. خط الأساس المُقاس (§22)

## 1.1 Git
```
GIT NOT AVAILABLE — filesystem baseline used.
```
`git status` ⟹ `fatal: not a git repository`. مساحة العمل ليست مستودع Git، و**لن يُنشأ مستودع وهمي** لمجرد استيفاء البند (نفس قرار 1A §30). سلامة التغيير تُثبَت بجرد الملفات + بصمة SHA256 للـSPA.

## 1.2 القياسات قبل أي تعديل

| البند | القيمة |
|---|---|
| ملفات TypeScript في `src/` | **43** ملفًا · **2,491** سطرًا |
| ملفات الاختبار | **9** ملفات · **2,003** سطرًا |
| مجلدات Modules | 16 · **صفر سطر كود في أيٍّ منها** |
| `src/modules/accounting/` | **README فقط · صفر كود** |
| typecheck | ✅ **PASS** — exit 0 · صفر خطأ |
| build | ✅ **PASS** — exit 0 · 156 ملفًا في `dist/` |
| boundary check | ✅ **PASS** — 53 ملفًا · **0 مخالفة** |
| tests | ✅ **PASS** — **208/208** · 46 suite · 0 fail |
| SPA SHA256 | `7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1` |

---

# 2. الاستطلاع (§4)

## A. الملفات المحاسبية الموجودة
**لا يوجد أي ملف محاسبي.** `src/modules/accounting/` يحوي `README.md` وحده يُعلن:
- **يملك:** `currencies` · `fx_rates` · `chart_of_accounts` · `accounting_periods` · `journal_entries` · `journal_entry_lines`
- **قاعدة التبعية:** جذر شجرة التبعية المالية — **لا يستورد أي module آخر**. فحص Maker/Checker يتم في طبقة التطبيق **قبل** استدعاء المحاسبة (تصحيح C-01).

## B. أنواع قائمة قد تتعارض مع النموذج الجديد
**صفر تعارض.** لا يوجد `Account` ولا `AccountCode` ولا `JournalLine` ولا `Dimension` في أي مكان من الشجرة. النموذج الجديد يبدأ من الصفر ولا يدهس شيئًا.

## C. صادرات Money القائمة (Phase 1B — تُستهلك ولا تُكرَّر)
```
Money · money() · MoneyInput
WORKING_SCALE · NUMERIC_PRECISION · MAX_UNITS · MIN_UNITS
currencyMetadata · roundingScaleOf · allCurrencies
allocate · allocateAmounts · allocateEvenly
FX_RATE_SCALE · convertWithRate · ExplicitFxConversion · FxRate · FxConversionPort · FxRateProviderPort
MoneyEngine · moneyEngine · MoneyEnginePort
CURRENCY_CODES · CurrencyCode · isCurrencyCode · MoneyAmount · MoneyJson · CurrencyMetadata
```
⟹ المحاسبة **تستهلك** هذه ولا تُعيد تعريف عملة ولا منزلة ولا تقريبًا. حارس آلي سيفرض ذلك.

## D. رموز الأخطاء القائمة (20)
`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `IDEMPOTENCY_CONFLICT` · `INSUFFICIENT_FUNDS` · `INVALID_MONEY_AMOUNT` · `INVALID_CURRENCY` · `CURRENCY_MISMATCH` · `INVALID_PRECISION` · `PROVIDER_TIMEOUT` · `PROVIDER_UNKNOWN` · `PROVIDER_REJECTED` · `PRICE_EXPIRED` · `HOLD_NOT_FOUND` · `TRANSACTION_NOT_SETTLED` · `RECONCILIATION_REQUIRED` · `CONFIG_NOT_SET` · `INTERNAL_ERROR`

## E. الحدود المعمارية القائمة
منطقة `module` يجوز لها استيراد: `shared` · نفس الـmodule · external — **ولا `infrastructure`**.
وحافة محظورة بالاسم: `accounting → ` كل الـ15 modules الأخرى («Accounting جذر الشجرة · لا يستدعي أحدًا»).
⟹ الحظر المطلوب في §18 **مفروض آليًا سلفًا** ولا يحتاج قاعدة جديدة.

## F. الاختبارات القائمة
9 ملفات · 208 اختبارًا: Shared Kernel · Infrastructure · Bootstrap · Architecture boundaries · 5 ملفات لمحرك المال.

---

# 3. القرارات المجمَّدة المُستخرَجة

## 3.1 الترميز (ADR-103)
```
D  GG  AAA        6 خانات بالضبط
│  │   └── الحساب المُرحَّل عليه (L3)
│  └────── المجموعة (L2)
└───────── العنصر (L1)
```
`D` = رقم العنصر: `1`=ASSET · `2`=LIABILITY · `3`=EQUITY · `4`=REVENUE · `5`=EXPENSE.

## 3.2 العمق والأعداد (ADR-103 · مُستنتَج من المتطلبات لا مُفترَض)
| المستوى | الدور | العدد |
|---|---|---:|
| L1 — العنصر | فصل الميزانية عن قائمة الدخل | **5** |
| L2 — مجموعة القائمة | إصدار «الأصول المتداولة» كبنود قوائم | **11** |
| L3 — الحساب المُرحَّل عليه | كل واحد له دلالة ترحيل مختلفة | **24** |
| L4 — لكل طرف/مزوّد/بنك | ❌ **غير ضروري** — الأبعاد تحققه بتكلفة صفر | — |

## 3.3 القاعدة غير القابلة للكسر
```
لا يُنشأ حساب في شجرة الحسابات لأي طرف (وكيل/عميل/مزوّد/بنك) — أبدًا.
إضافة 10,000 وكيل = صفر حساب جديد.
```
**تصحيح موثَّق لسلوك SPA:** سطر 7740 يُنشئ حسابًا محاسبيًا لكل Financial Account ⟹ تضخّم غير محدود. البديل المجمَّد: حساب `BANK` **واحد** + بُعد `financial_account_id`.

## 3.4 الفصل الثلاثي الإلزامي
| | Business Hierarchy | COA Hierarchy | Dimensions |
|---|---|---|---|
| أين | `parties.parent_id` + `party_closure` | `chart_of_accounts.parent_id` | أعمدة على `journal_entry_lines` |
| العمق | حتى 5 (`CONFIGURATION`) | **3 ثابتة** | مسطحة |
| يؤثر على القوائم؟ | ❌ | ✅ | ❌ |

## 3.5 قيود المخطط (§21 · §24)
```
chart_of_accounts:
  code UQ (6 خانات) · parent_id FK→self · level ∈ {1,2,3}
  element ∈ {ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE}
  CHECK(is_postable = (level = 3))          ← الأهم
  allowed_dimensions TEXT[] · required_dimensions TEXT[]
  is_system · allows_manual_posting · is_active
  الـ24 كلها is_system = true

journal_entry_lines:
  CHECK(debit >= 0 AND credit >= 0
        AND NOT(debit > 0 AND credit > 0)
        AND NOT(debit = 0 AND credit = 0))   ← ⟹ المبلغ موجب دائمًا واتجاه واحد
  Trigger: البُعد ضمن allowed_dimensions وشامل required_dimensions
```

## 3.6 الأبعاد الثمانية (لا تُزاد ولا تُنقص)
`party_type` · `party_id` · `gateway_id` · `provider_id` · `provider_account_id` · `zone_id` · `service_id` · `financial_account_id`

> **`currency_code` ليس بُعدًا — هو خاصية جوهرية للمبلغ.** (نص ADR-103 حرفيًا)

---

# 4. التعارضات والفجوات المكتشفة قبل التنفيذ

| # | الاكتشاف | الحالة |
|---|---|---|
| **CB1C-1** | **أكواد المستوى الثاني (11 مجموعة) غير مُعدَّدة في أي وثيقة.** العدد `11` منصوص عليه، والأكواد لا | 🔶 **استنتاج موثَّق** — راجع §5 |
| **CB1C-2** | **سُلَّم الترميز التوضيحي في Freeze يعرض أربع درجات كود** (`100000 → 110000 → 111000 → 111100`) بينما العمق الهيكلي المجمَّد **ثلاثة**. الأعداد 5/11/24 **لا تتصالح** إلا بإسقاط الدرجة `110000` من البنية | 🔶 **يُبلَّغ ولا يُحسم من طرفي** |
| **CB1C-3** | **`required_dimensions` غير مُعدَّدة لأي حساب** عدا مثال واحد صريح: «ترحيل على `PARTY-WALLET-LIABILITY` بلا `party_id` **يُرفض**». أما `allowed_dimensions` فمُعدَّدة لكل الـ24 | 🔶 **يُنمذَج كثلاثي الحالة `UNSPECIFIED`** — لا يُخمَّن |
| **CB1C-4** | **أسماء مجموعات L2 غير موجودة** عدا واحدة في Freeze: `111000 = الصناديق والبنوك` | 🔶 `PLACEHOLDER` صريح |
| **CB1C-5** | 4 حسابات سياستها **«عملة التقرير»** (`CAPITAL` · `RETAINED-EARNINGS` · `FX-GAIN` · `FX-LOSS`) و`OPEN-BE-02` **ما زال OPEN** | ⛔ السياسة تُنمذَج · **والتحقق منها محجوب** |
| **CB1C-6** | `519000` مُسمّى في المصدر `FX-LOSS / ROUNDING-DIFFERENCE` · و`OPEN-BE-03` يسأل: حساب مستقل (`519100`) أم بُعد؟ | ⛔ **لا يُنشأ `519100`** · يُنسخ الاسم كما ورد |

**لا تعارض مع أي ADR مجمَّد. لن يُعدَّل أي ADR.**

## 4.1 تفصيل CB1C-1 و CB1C-2 — كيف اشتُقّت مجموعات L2

الأكواد الـ24 المجمَّدة تفرض آباءها بحساب بسيط. المجموعة الوحيدة التي تُنتج **بالضبط 11** وتُغطّي الـ24 كلها:

```
111000 ← 111100 CASH · 111200 BANK · 111300 FUNDING-CLEARING                    (3)
112000 ← 112100 PROVIDER-BALANCE                                                 (1)
113000 ← 113100 · 113200 · 113300 · 113400                                       (4)
114000 ← 114100 VOUCHER-INVENTORY                                                (1)
211000 ← 211100 · 211200 · 211300                                                (3)
212000 ← 212100 COMMISSION-PAYABLE · 212200 UNMATCHED-DEPOSITS                   (2)
311000 ← 311100 CAPITAL                                                          (1)
312000 ← 312100 RETAINED-EARNINGS                                                (1)
313000 ← 313100 OPENING-BALANCE-SUSPENSE                                         (1)
410000 ← 411000 · 412000 · 419000                                                (3)
510000 ← 511000 · 512000 · 513000 · 519000                                       (4)
                                                                        ───────────
                                                        11 مجموعة  ·  24 حسابًا ✅
```

**ملاحظة حاسمة على حسابات الإيراد والمصروف:** أكواد `411000` … `519000` تنتهي بـ`000`، أي أن `AAA = 000` — وهو الشكل الذي يأخذه كود مجموعة تحت قاعدة `D GG AAA`. ومع ذلك **تُعدّدها الوثيقة صراحةً ضمن الـ24 حسابًا مُرحَّلًا عليه**.
⟹ **قاعدة «`AAA ≠ 000` تعني L3» غير صحيحة على الـ24 المجمَّدة، ولن تُفرَض.**
⟹ ما يُفرَض هو ما تنصّ عليه الوثائق فعلًا: `is_postable = (level = 3)` · و`D` = رقم العنصر لكل من الأب والابن · و`L1` كوده `D00000`.

**هذه استنتاجات تُعرَض للمهندس المعماري ولا تُقدَّم كقرار مجمَّد.**

---

# 5. خطة التنفيذ

| # | المخرَج | الحدود |
|---|---|---|
| 1 | `domain/account-code.ts` — `AccountCode` كـValue Object · 6 خانات · نصّي بحتًا | **لا `Number(code)` أبدًا** |
| 2 | `domain/account-element.ts` — العناصر الخمسة + الرصيد الطبيعي المشتق | **لا تصنيفات إضافية** |
| 3 | `domain/accounting-dimension.ts` — الأبعاد الثمانية + `DimensionSet` | **لا بُعد تاسع · ولا حذف بُعد** |
| 4 | `domain/account.ts` — `Account` ثابت لا يتغيّر | **لا حقل رصيد إطلاقًا** |
| 5 | `domain/chart-of-accounts.ts` — بناء الشجرة والتحقق: تكرار · دورة · مستوى · أب · postable | لا ترحيل · لا تخزين |
| 6 | `domain/accounting-line.ts` — العقد الهيكلي للسطر | **لا ترحيل · لا أرصدة · لا حساب** |
| 7 | `reference/frozen-chart-of-accounts.ts` — 5 عناصر + 11 مجموعة (مُستنتَجة) + 24 ورقة (مجمَّدة) | كل مُستنتَج **موسوم** |
| 8 | +4 رموز أخطاء | لا عائلة جديدة |
| 9 | اختبارات A→Q + حالات حدّية | لا اختبارات مسار سعيد فقط |
| 10 | حارس مصدر آلي للمحاسبة | يُوسَّع ولا يُضعَّف أي حارس قائم |

## 5.1 ما لن يُبنى — تعهّد صريح
```
✗ postJournalEntry · Journal Engine · General Ledger
✗ Trial Balance · P&L · Balance Sheet
✗ Wallet · Funding · Provider · Pricing · Commission · Transaction Orchestrator
✗ قاعدة بيانات · SQL · migration · ORM · repository
✗ HTTP endpoints · مصادقة · تخويل · تسوية · مطابقة
✗ أي رصيد على حساب أو طرف أو مزوّد
✗ سعر صرف · 2.94 · نسبة عمولة · 5% · عملة تقرير · ROUNDING-DIFFERENCE
```

---

**لم يُكتب أي كود محاسبي حتى هذه اللحظة.**
