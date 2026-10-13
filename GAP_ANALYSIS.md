# ALOMDA TEL — Requirements Baseline vs Current SPA
## Full Gap & Migration Analysis

**نوع الوثيقة:** تحليل معماري — لا تنفيذ، لا تعديل كود
**تاريخ التحليل:** سبتمبر 2026
**حالة `spa_app.html`:** لم يُعدَّل — SHA256 `b7e2b1d19601863518bf519c885c09e7348ff2d15f8ab8ea0cffe6733dd549b8`

---

# 0. تصحيحان جوهريان قبل أي تحليل

## 0.1 الملف المرفوع ليس "تطبيقًا منافسًا"

طُلب مني تحليل "ملف التطبيق المنافس الشامل". الملف المرفوع فعليًا هو:

> **مرجع متطلبات منظومة العمدة تل الموحد — Unified Requirements & Architecture Baseline v1.0**

وهو **وثيقتكم أنتم**، مبنية من **32 ملف مواصفات خاص بمشروعكم** (مذكورة بالاسم في القسم 32: أمان التطبيق، التسعير، العمولات، الكريمي والتغذية، الواي فاي، شجرة الحسابات والقيود… إلخ). الوثيقة تصرّح بذلك حرفيًا في القسم 1:

> "الغرض: جمع ملفات المواصفات المرفوعة في هذه الدورة في مرجع واحد متماسك"
> "قاعدة عدم التغيير: لم تتم في هذه الوثيقة مقارنة المتطلبات مع ملف SPA"

**لا يوجد في الملف أي ذكر لمنافس، ولا لقطات شاشة من تطبيق آخر، ولا تحليل سوق.**

**الأثر على التحليل:** كل سؤال في طلبكم بصيغة "ماذا يفعل المنافس؟ / ما الموجود لديه وغير موجود لدينا؟" أُعيد تأطيره إلى:
**"ماذا تتطلب وثيقة المتطلبات الموحدة؟ مقابل: ماذا ينفّذ الـSPA فعليًا؟"**

هذا في الواقع **أدق وأكثر فائدة** من مقارنة بمنافس، لأن المرجع يمثل ما التزمتم ببنائه فعلًا. لكن إن كان لديكم ملف منافس حقيقي (لقطات، APK، تحليل)، فهو **غير متوفر في المصادر الحالية** ويجب رفعه لتحليل منفصل.

## 0.2 ملف SPA المرفوع نسخة قديمة

رُفع معكم `spa_app-196.html` (34,952 سطرًا). النسخة الحالية في مساحة العمل 40,800 سطرًا. **الملف المرفوع لا يحتوي على أي من عمل Phase 8L إطلاقًا** (صفر إشارة لـ`CUSTOMER_GATEWAY_ACCOUNT_DIRECTORY`). اعتمدتُ النسخة الحالية العاملة كمصدر، لا المرفوعة.

---

# 1. الملخص التنفيذي للفجوة

الوثيقة تصف منظومة من **~11 نطاقًا كبيرًا**. الـSPA الحالي يغطي منها:

| التغطية | النسبة التقريبية | التفصيل |
|---|---|---|
| 🟢 مُنفَّذ ومتوافق مع المرجع | **~22%** | محاسبة القيد المزدوج، محفظة العميل حسب البوابة، دورة التغذية اليدوية، الكتالوج الأساسي، الدعم |
| 🟠 مُنفَّذ لكن يجب نقله للـBackend | **~18%** | كل المنطق المالي الموجود اليوم في المتصفح |
| 🔵 موجود جزئيًا ويحتاج توسعة كبيرة | **~15%** | التسعير، العمولات، المزوّدون، الصلاحيات |
| 🔴 غير موجود إطلاقًا | **~45%** | الهرمية، الائتمان/التأمين، المطابقة، النزاعات، الأمن الحقيقي، DR، الطوابير، FX، التقارير المالية |

**الخلاصة الحاسمة:** الـSPA هو **نموذج أولي ممتاز لمنطق الأعمال المالي الأساسي**، وليس ~50% من النظام النهائي. الـ1530 اختبارًا تثبت أن ما بُني **صحيح**، لا أنه **كافٍ**.

**أهم اكتشاف إيجابي:** الـSPA اتخذ ثلاثة قرارات معمارية **تفوق ما تقترحه بعض ملفات المصدر نفسها**، ويجب الحفاظ عليها بصرامة (تفصيلها في القسم 8).

---

# 2. المبدأ المركزي: أين يقف الـSPA من "قاعدة عدم وجود مصدرين للحقيقة"

الوثيقة (القسم 31) تضع قاعدة غير قابلة للتجاهل:

> "لا يوجد مصدر مالي ثانٍ ينافس دفتر الأستاذ المركزي. الرصيد المعروض يمكن أن يكون Projection/Cache، لكن قابل للمطابقة مع ledger."

**حالة الـSPA اليوم — مختلطة، وهذا أخطر تناقض داخلي في المشروع:**

| الرصيد | المصدر الحالي في SPA | متوافق مع المرجع؟ |
|---|---|---|
| **Customer Wallet** | مشتق 100% من `JOURNAL_ENTRY_LINE_DIRECTORY` | ✅ **متوافق تمامًا** — لا حقل `balance` على العميل إطلاقًا |
| **Provider Balance** | مشتق من القيود | ✅ متوافق |
| **Agent Wallet** | حقل `agent.balance` يُعدَّل مباشرة (`agent.balance += x`) | ❌ **مخالف** |
| **Owner/WiFi balances** | `ownerEntity.balance += x` | ❌ **مخالف** |

**المشكلة → السبب → الأثر → الحل:**
- **المشكلة:** محفظة الوكيل مصدر حقيقة ثانٍ ينافس دفتر الأستاذ.
- **السبب:** بُنيت في Phase 8a قبل نضج المحرك المحاسبي؛ وتدقيق Phase 8i أثبت أن **5 من 7 مسارات حركة لا تملك مصدر عملة حقيقيًا**، فتعذّر التحويل حينها.
- **الأثر:** استحالة مطابقة (Reconciliation) موثوقة بين محافظ الوكلاء والـGL — وهو مطلب صريح (FR-27).
- **الحل عند الـBackend:** 🟠 **MOVE + 🟡 MODIFY** — تصبح `agent.balance` عمود Projection مُعاد حسابه من الـledger، مع Materialized View، و`financial_discrepancies` تُفتح تلقائيًا عند أي فرق. **هذا شرط قبول إلزامي للمرحلة 1 من الـBackend.**

---

# 3. Offline Browsing مقابل Online Execution — النقطة التي طلبتم التركيز عليها

الوثيقة (القسم 21) واضحة جدًا وتدعم موقفكم بالضبط:

> "الحالة المحلية تكون **staging/queue للطلب وليست Ledger ماليًا مستقلًا**."
> "يجب منع إعادة إرسال نفس العملية أثناء المزامنة باستخدام client reference/idempotency."

## 3.1 التصنيف الإلزامي

| الطبقة | ما يُسمح به Offline | التخزين | المصدر |
|---|---|---|---|
| **Catalog Read Model** | تصفح الخدمات، الباقات، الألعاب، الأسعار المعروضة، شبكات WiFi | Local Cache (TTL + version stamp) | نسخة من الـBackend، للقراءة فقط |
| **آخر رصيد معروف** | عرضه **مع ختم زمني صريح** ("آخر تحديث: قبل 3 ساعات") | Local Cache | Projection من الـBackend |
| **كشف حساب سابق** | تصفح ما سبق تحميله | Local Cache | للقراءة فقط |
| **مسودة طلب** | تعبئة النموذج، إرفاق الإيصال، حفظه كمسودة | Local Staging + `clientRef` | **ليس معاملة** |
| ⛔ **أي حركة مالية** | **ممنوع تمامًا** | — | Backend حصرًا |

## 3.2 القاعدة الحديدية

```
عرض / تصفح / مسودة        →  يعمل Offline
حجز رصيد / قيد / تنفيذ    →  Online فقط، بلا استثناء
```

**لا يجوز إطلاقًا:** خصم رصيد محليًا، إنشاء قيد محليًا، اعتبار طلب "ناجحًا" بلا رد Backend، أو مزامنة "أرصدة محلية" لاحقًا.

## 3.3 دورة الطلب المؤجل (Deferred Request) — التصميم المقترح

```
انقطاع الاتصال أثناء الإرسال
  ↓
حفظ الطلب محليًا: status = LOCAL_DRAFT + clientRef (UUID يُولَّد على الجهاز)
  ↓
⚠️ لا رصيد يتحرك — لا شيء يُعتبر منفَّذًا
  ↓
عودة الاتصال
  ↓
POST /transactions  { clientRef, ... }   ← Idempotency-Key = clientRef
  ↓
Backend: هل رأيتُ هذا الـclientRef من قبل؟
  ├─ نعم → أعِد النتيجة السابقة نفسها (لا تنفيذ ثانٍ)
  └─ لا  → نفّذ داخل DB Transaction
  ↓
الرد: SUCCESS / FAILED / PENDING
  ↓
تحديث الواجهة من رد الخادم فقط
```

**عناصر مطلوبة للبناء (كلها 🔴 BUILD):** `clientRef` من جانب العميل · كاشف اتصال (Connectivity Detector) · طابور مزامنة · Retry بتراجع أسّي · حالة `PENDING` مرئية للمستخدم · Worker لاستعلام الحالة · Reconciliation.

**الوضع الحالي:** الـSPA لا يملك أيًا من هذه العناصر — كل شيء متزامن ومحلي. **الفجوة كاملة.**

---

# 4. الجدول الرئيسي — تحليل الفجوة بالنطاقات

الأعمدة: **المطلب (المرجع) | الـSPA الحالي | الفرق الجوهري | القرار | Backend | DB | API**

## 4.1 الهوية والحسابات والهرمية

| المطلب | SPA الحالي | الفرق الجوهري | القرار | Backend/DB/API |
|---|---|---|---|---|
| هرمية كاملة: SUPER ADMIN → MASTER/DISTRIBUTOR → AGENT → SUB-AGENT → POS → CUSTOMER مع `parent_id` | أدوار مسطّحة: مدير/موظف/وكيل/عميل — **بلا `parent_id`، بلا شجرة** | **فجوة هيكلية جذرية.** الهرمية ليست صلاحيات فقط؛ تحدد التسعير والعمولات وحدود الائتمان وعزل التقارير | 🔴 **BUILD** | جدول `accounts` بـ`parent_id` + `ltree`/Closure Table · API شجرة · فهارس |
| MASTER/DISTRIBUTOR ينشئ وكلاء تحته ويوزّع أسعارًا ضمن حد التكلفة | غير موجود | فجوة كاملة | 🔴 BUILD | خدمة توزيع تسعير + Margin Guard |
| POS ككيان مستقل بكشف حساب خاص | غير موجود | فجوة كاملة | 🔴 BUILD | جدول + كشف |
| KYC (تسجيل → OTP → KYC → اعتماد → تفعيل) | غير موجود | فجوة كاملة | 🔴 BUILD | `kyc_submissions` + Workflow |
| هوية العميل/الوكيل المزدوجة (عميل + صلاحية وكيل) | ✅ منفَّذ بدقة (Phase 8h) — **بلا حساب دخول ثانٍ** | **الـSPA أنضج من المرجع هنا** | 🟢 **KEEP** | ينتقل كما هو |
| حساب مستقل لكل بوابة (`CUSTOMER_GATEWAY_ACCOUNT_DIRECTORY`) | ✅ منفَّذ | المرجع لا يفصّله بهذا الوضوح | 🟢 KEEP + 🟠 MOVE | جدول مستقل |

## 4.2 الأمن والصلاحيات

| المطلب | SPA الحالي | الفرق | القرار | Backend/DB/API |
|---|---|---|---|---|
| JWT + Access/Refresh Rotation + إبطال التوكن السابق | تسجيل دخول محلي بكلمة مرور **نصية صريحة** في الكود | **الأخطر أمنيًا.** مقبول لنموذج أولي، كارثي في الإنتاج | 🔴 BUILD + ⚫ **REMOVE** (كلمات المرور من الكود) | Argon2id + JWT + `refresh_tokens` |
| Device Binding + Fingerprinting + اعتماد جهاز جديد بـOTP | غير موجود | فجوة كاملة | 🔴 BUILD | `agent_trusted_devices` |
| Sessions خادمية + Remote Revocation | غير موجود | فجوة كاملة | 🔴 BUILD | `active_sessions` + Redis |
| 2FA / PIN للعمليات الحساسة / بيومتري | غير موجود | فجوة كاملة | 🔴 BUILD | — |
| RBAC دقيق + Overrides + Deny-by-default | RBAC أساسي موجود (`getAdminNavItemsForAccount`) | موجود لكنه **واجهي**، لا يحمي البيانات | 🔵 EXPAND + 🟠 MOVE | `permissions`/`roles`/`overrides` + فحص خادمي على كل Endpoint |
| قيود IP / وردية / حد مبلغ يومي | غير موجود | فجوة كاملة | 🔴 BUILD | — |
| Maker/Checker فوق حد مالي | غير موجود | فجوة كاملة | 🔴 BUILD | `approvals` |
| Replay Protection (nonce + timestamp) | غير موجود | فجوة كاملة | 🔴 BUILD | — |
| Rate Limiting | غير موجود | فجوة كاملة | 🔴 BUILD | Redis |
| Fraud/Velocity Engine | غير موجود | فجوة كاملة | 🔴 BUILD | Worker + `agent_risk_metrics` |
| أسرار المزودين خارج الكود (KMS/Vault) | ✅ **لا يوجد أي سرّ في الـSPA** (مؤكَّد بفحص أمني في 8L-2L) | الـSPA ملتزم بالمبدأ | 🟢 KEEP | KMS/Vault عند الـBackend |

## 4.3 المحاسبة

| المطلب | SPA الحالي | الفرق | القرار | Backend/DB/API |
|---|---|---|---|---|
| Double-Entry، Debit=Credit، رفض ذري | ✅ منفَّذ بدقة عبر `postJournalEntry()` | **متوافق تمامًا** | 🟢 KEEP + 🟠 MOVE | `journal_entries` + `journal_entry_lines` + CHECK constraint |
| قيود غير قابلة للتعديل؛ التصحيح بـReversal | ✅ المبدأ محترم (Append-only) | متوافق | 🟢 KEEP | منع UPDATE/DELETE على مستوى DB |
| شجرة حسابات هرمية (5 أو 6 مستويات — **تعارض مفتوح في المرجع**) | شجرة **مسطّحة** بلا `parent_id` | فجوة هيكلية + قرار معماري معلّق | 🔵 EXPAND | `accounts.parent_id` — **يحتاج حسم عدد المستويات** |
| Trial Balance / P&L / Balance Sheet / Cash Flow | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | Materialized Views |
| إغلاق الفترات (منع القيد في فترة مغلقة) | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | `accounting_periods` + فحص عند الترحيل |
| FX + Gain/Loss + إعادة تقييم | ❌ غير موجود (بنية أسعار الصرف موجودة، بلا FX محاسبي) | فجوة كاملة | 🔴 BUILD | `fx_rates` + قيود فروق |
| عملة المعاملة ≠ عملة التقرير | ❌ غير موجود | فجوة | 🔴 BUILD | عمودان منفصلان على السطر |

## 4.4 المحافظ والبوابات والتغذية

| المطلب | SPA الحالي | الفرق | القرار | Backend/DB/API |
|---|---|---|---|---|
| Customer Wallet كالتزام مشتق من الـLedger | ✅ منفَّذ بدقة | متوافق | 🟢 KEEP + 🟠 MOVE | Projection + View |
| عزل رصيد كل بوابة (`gatewayId` على سطر القيد) | ✅ منفَّذ (Phase 8L-2B.2) | **المرجع لا يذكر هذا الحل تحديدًا — الـSPA أدق** | 🟢 **KEEP** | عمود `gateway_id` + فهرس مركّب |
| Available vs **Held/Reserved** Balance | ❌ **لا يوجد مفهوم حجز إطلاقًا** | **فجوة حرجة.** بلا حجز، لا يمكن تنفيذ دورة `HELD → QUEUED → SUCCESS` | 🔴 **BUILD** | حسابات حجز + `SELECT FOR UPDATE` |
| Commission/Profit Wallet منفصلة | جزئي (عمولات موجودة، بلا محفظة منفصلة) | 🔵 EXPAND | 🔵 EXPAND | — |
| Insurance/Guarantee Wallet | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | — |
| Credit Limit / Overdraft مصرّح | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | `credit_limits` + فحص قبل الحجز |
| Multi-Currency Wallet | جزئي (العملة على القيد، بلا محافظ متعددة صريحة) | 🔵 EXPAND | 🔵 EXPAND | — |
| تغذية يدوية + إيصال + اعتماد | ✅ **منفَّذة بالكامل ومختبَرة** (8L-2M/2N/2O) | متوافق ومتقدم | 🟢 KEEP + 🟠 MOVE | `bank_deposit_claims` |
| منع تكرار السند بـ`transfer_reference` + `receipt_hash` | جزئي: `sourceId` يمنع التكرار المحاسبي، **لا يوجد hash للإيصال** | 🟡 MODIFY | 🟡 MODIFY | عمود `receipt_hash` + UNIQUE |
| صورة الإيصال | ✅ رفع + تحقق نوع + معاينة + حذف (Base64 محليًا) | يعمل للنموذج؛ **غير صالح للإنتاج** | 🟠 **MOVE** | Object Storage + مرجع فقط في DB |
| Webhooks بنكية + Idempotency بالمرجع البنكي | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | `webhook_events` |
| حالات التحويلات غير المعروفة (UNCLAIMED/CLAIM_PENDING/MATCHED/REFUNDED) | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | — |
| Bank Reconciliation | ❌ غير موجود | فجوة كاملة | 🔴 BUILD | `reconciliation_sessions` |
| OCR للإيصال | ❌ غير موجود | ⚪ FUTURE (المرجع نفسه يجعله اختياريًا) | ⚪ FUTURE | — |

## 4.5 دورة حياة المعاملة — **أخطر فجوة منفردة**

المرجع (القسم 7 + 35) يفرض:
```
INITIATED → HELD/RESERVED → QUEUED → PROCESSING → SUCCESS/FAILED
                                          ↓
                              SUSPENDED/PENDING_PROVIDER → RESOLVED
```

| المطلب | SPA الحالي | القرار |
|---|---|---|
| `INITIATED` | ضمني | 🔵 EXPAND |
| `HELD/RESERVED` (حجز مالي مؤقت) | ❌ **غير موجود** | 🔴 **BUILD** |
| `QUEUED` (طابور غير متزامن) | ❌ غير موجود — كل شيء متزامن | 🔴 **BUILD** |
| `PROCESSING` | جزئي | 🔵 EXPAND |
| `SUCCESS/FAILED` | ✅ موجود (11 حالة في `EXECUTION_RESPONSE_STATUSES`) | 🟢 KEEP |
| `SUSPENDED/PENDING_PROVIDER` | ✅ حالة `pending` موجودة، **بلا Worker يحسمها** | 🔵 EXPAND |
| **Timeout ≠ Failure** | ✅ المبدأ محترم (لا يُعتبر نجاحًا) | 🟢 KEEP |
| Status Query Worker | ❌ غير موجود | 🔴 BUILD |
| `Idempotency` بـ`clientRef` | ✅ موجود لكن **بمفتاح خادمي** (`sourceType+sourceId`)، لا `clientRef` من العميل | 🟡 **MODIFY** |
| Reconciliation بعد الحسم | ❌ غير موجود | 🔴 BUILD |

**التقييم:** الـSPA ينفّذ **طرفَي** الدورة (البداية والنتيجة) بشكل صحيح، لكنه **يفتقد وسطها بالكامل**: الحجز، الطابور، الحسم اللاحق. وهذا هو جوهر النظام المالي التشغيلي.

## 4.6 المزوّدون والتنفيذ

| المطلب | SPA الحالي | القرار |
|---|---|---|
| Provider Adapter Pattern (execute/query/checkStatus/cancel) | ✅ عقد `ProviderRegistry` موجود — **لكن `execute` فقط** | 🔵 EXPAND |
| REST/SOAP/SMPP/USSD/GSM Modem | ❌ لا شيء — 3 مزوّدين `simulator` فقط | 🔴 BUILD |
| Routing (منطقة/تكلفة/هامش/أولوية/صحة) | جزئي: أولوية + Fallback في البيانات، **بلا محرك توجيه** | 🔵 EXPAND |
| Provider Health / Circuit Breaker | ❌ غير موجود | 🔴 BUILD |
| Provider Balance كأصل مالي | ✅ منفَّذ محاسبيًا | 🟢 KEEP |
| تسجيل raw request/response | ❌ غير موجود | 🔴 BUILD |
| Provider Reconciliation | ❌ غير موجود | 🔴 BUILD |
| **Provider Mapping للباقات** | ⚠️ **2 من 14 باقة فقط** | 🔴 BUILD (**محجوب ببيانات حقيقية**) |

## 4.7 التسعير والعمولات

| المطلب | SPA الحالي | القرار |
|---|---|---|
| فصل Provider Cost عن Customer Price | ✅ **منفَّذ ومُثبَت بنيويًا** (8L-2J) | 🟢 KEEP |
| Zones (شمال/جنوب) | ✅ موجود عبر البوابات | 🟢 KEEP |
| Pricing Groups/Tiers (Standard/Silver/Gold/VIP) | ❌ غير موجود | 🔴 BUILD |
| أولوية: user override > tier > global | ❌ غير موجود | 🔴 BUILD |
| Margin Guard (منع البيع بخسارة) | ❌ غير موجود | 🔴 BUILD |
| `pricing_change_logs` | ❌ غير موجود | 🔴 BUILD |
| FX + Price Lock | جزئي (سلسلة صرف موجودة، بلا تثبيت) | 🔵 EXPAND |
| عمولة الوكيل | ✅ موجودة | 🟢 KEEP + 🟠 MOVE |
| **Waterfall هرمي** (Master→Sub→Agent→POS) | ❌ غير موجود | 🔴 BUILD |
| العمولة تُثبَت بعد النجاح وتُعكس عند Refund | جزئي | 🔵 EXPAND |
| Commission Reversal | ❌ غير موجود | 🔴 BUILD |

## 4.8 الكتالوج والمنتجات الرقمية

| المطلب | SPA الحالي | القرار |
|---|---|---|
| باقات تيليكوم | ✅ 14 باقة | 🟢 KEEP + 🟠 MOVE |
| كتالوج ألعاب | ✅ موجود | 🟢 KEEP |
| **Player ID Validation / Nickname Pre-fetch** | ❌ غير موجود | 🔴 BUILD |
| **PIN Vault مشفَّر + قفل ذري + فك تشفير عند التسليم فقط** | ❌ غير موجود | 🔴 **BUILD** (حرج) |
| فواتير (ADSL/FTTH/كهرباء) + Inquiry قبل الخصم | ❌ غير موجود | 🔴 BUILD |
| اشتراكات رقمية | ❌ غير موجود | 🔴 BUILD |
| WiFi: شبكات/ملاك/قسائم | ✅ موجود | 🟢 KEEP + 🟠 MOVE |
| MikroTik/RADIUS + توليد On-demand | ❌ غير موجود | 🔴 BUILD |
| فصل: حصة المالك / عمولة الوكيل / ربح النظام | جزئي | 🔵 EXPAND |
| خدمات يدوية + Dispatch | ✅ موجود | 🟢 KEEP + 🔵 EXPAND |

## 4.9 الدعم والنزاعات والإشعارات والتقارير

| المطلب | SPA الحالي | القرار |
|---|---|---|
| Tickets/Chat/Attachments | ✅ موجود | 🟢 KEEP + 🟠 MOVE |
| SLA + تصعيد آلي | ❌ غير موجود | 🔴 BUILD |
| **نظام النزاعات** (OPEN→INVESTIGATING→RESOLVED_REFUNDED/REJECTED) | ❌ **غير موجود إطلاقًا** | 🔴 **BUILD** |
| الاسترداد كحدث محاسبي عكسي | ❌ غير موجود | 🔴 BUILD |
| إشعارات داخل التطبيق | ✅ موجود | 🟢 KEEP |
| Push/SMS/WhatsApp/Telegram + Queue + Retry + DLR | ❌ غير موجود | 🔴 BUILD |
| كشف حساب العميل/الوكيل | ✅ كشف بوابة العميل منفَّذ | 🟢 KEEP + 🔵 EXPAND |
| P&L / Trial Balance / Liquidity / Profitability | ❌ غير موجود | 🔴 BUILD |
| Provider Performance | جزئي (تصنيف تغطية فقط) | 🔵 EXPAND |
| تصدير PDF/Excel + Streaming | ❌ غير موجود | 🔴 BUILD |
| **كل طبقات المطابقة الأربع** | ❌ غير موجود | 🔴 BUILD |
| `financial_discrepancies` | ❌ غير موجود | 🔴 **BUILD** (حرج) |

## 4.10 التدقيق والبنية التحتية

| المطلب | SPA الحالي | القرار |
|---|---|---|
| Audit Log شامل (actor/target/old/new/IP/UA/timestamp) | ❌ **غير موجود إطلاقًا** | 🔴 **BUILD** (حرج — FR-28) |
| Hash-chain (SHA-256) لإثبات عدم العبث | ❌ غير موجود | 🔴 BUILD |
| WORM / سجل خارجي / SIEM | ❌ غير موجود | 🔴 BUILD |
| PostgreSQL + ACID + Row Locking | ❌ `localStorage` فقط | 🟠 **MOVE** |
| Redis / Queue / Workers | ❌ غير موجود | 🔴 BUILD |
| Backup/WAL/PITR/Replication/DR/HA | ❌ غير موجود | 🔴 BUILD |
| Monitoring/Logging/Tracing | ❌ غير موجود | 🔴 BUILD |
| Partitioning / Materialized Views | ❌ غير موجود | 🔴 BUILD |

---

# 5. Source of Truth — المصفوفة الإلزامية

| البيان | المصدر النهائي المعتمد | الحالة في SPA | الإجراء |
|---|---|---|---|
| **Customer Balance** | **Journal Ledger** (مشتق) | ✅ مطابق | 🟢 نقل كما هو |
| **Agent Balance** | **Journal Ledger** (مشتق) | ❌ حقل مباشر | 🟡 **تحويل إلزامي** |
| **Provider Balance** | **Journal Ledger** | ✅ مطابق | 🟢 نقل |
| **Gateway Balance** | **Journal Ledger** + بُعد `gateway_id` | ✅ مطابق | 🟢 نقل |
| **Commission** | **Journal Ledger** (Accrual) | جزئي | 🔵 توسعة |
| **Provider Cost** | `provider_mapping` (PostgreSQL) | ✅ مطابق | 🟢 نقل |
| **Customer Price** | Pricing Engine (PostgreSQL) | ✅ مطابق | 🔵 توسعة |
| **Transaction Status** | **PostgreSQL**، مُحدَّثة من رد المزوّد | جزئي | 🔵 توسعة |
| **Voucher Status** | **PostgreSQL** + Row Lock | ❌ غير موجود | 🔴 بناء |
| **Inventory** | **PostgreSQL** | ❌ غير موجود | 🔴 بناء |
| **Bank Transfer** | **البنك الخارجي**، يُطابَق داخليًا | ❌ غير موجود | 🔴 بناء |
| Session/Cache | Redis (**ليس مصدر حقيقة مالية**) | ❌ | 🔴 بناء |
| Local Cache | **ليس مصدر حقيقة إطلاقًا** | ⚠️ حاليًا هو المصدر الوحيد! | 🟠 نقل كامل |

---

# 6. العمليات التي يجب أن تكون داخل DB Transaction (ذرية إلزاميًا)

1. **حجز الرصيد** (`SELECT … FOR UPDATE` على المحفظة) + إنشاء `HELD`
2. **ترحيل أي قيد** (رأس + كل الأسطر) — نجاح كامل أو تراجع كامل
3. **اعتماد تغذية يدوية**: تحديث الطلب + القيد + تحديث Projection
4. **حجز قسيمة/PIN** (`FOR UPDATE SKIP LOCKED`) — منع بيع القسيمة مرتين
5. **تسوية معاملة** (Commit الحجز + قيد + عمولة)
6. **الاسترداد/العكس** (قيد عكسي + عكس عمولة + تحديث حالة)
7. **تسوية العمولات**
8. **إغلاق فترة محاسبية**

**تحتاج Queue/Worker (لا تكون متزامنة):** استدعاء المزوّد · استعلام حالة بعد Timeout · الإشعارات · المطابقة · التقارير الثقيلة · فحص الاحتيال · إعادة احتساب Projections.

---

# 7. نموذج PostgreSQL المقترح (تصميم فقط — لا إنشاء)

**الهوية:** `accounts` (بـ`parent_id` + `account_type` + `pricing_group_id` + `zone_id` + `status`) · `roles` · `permissions` · `user_roles` · `permission_overrides` · `trusted_devices` · `active_sessions` · `kyc_submissions`

**المحاسبة:** `chart_of_accounts` (بـ`parent_id`) · `journal_entries` (بـ`reference` UNIQUE + `period_id`) · `journal_entry_lines` (بـ`party_type`/`party_id`/**`gateway_id`**/`currency_code`/`debit`/`credit`) · `accounting_periods` · `fx_rates`

**المحافظ:** `wallets` (بـ`available`/`held` كـProjection) · `wallet_holds` · `credit_limits`

**البوابات والتغذية:** `gateways` · `customer_gateway_accounts` · `funding_methods` · `funding_account_links` · `bank_deposit_claims` (بـ`receipt_hash` UNIQUE) · `webhook_events`

**المعاملات:** `transactions` (بـ`client_ref` **UNIQUE** + `status` + `held_amount`) · `transaction_status_history` · `provider_execution_logs`

**الكتالوج والتسعير:** `services` · `packages` · `pricing_groups` · `zones` · `service_pricing` · `pricing_change_logs`

**المزوّدون:** `providers` · `provider_mappings` · `provider_credentials` (مرجع KMS فقط) · `provider_health`

**العمولات:** `commission_policies` · `commission_accruals` · `commission_settlements`

**المخزون:** `voucher_inventory` (بـ`status` + `locked_by` + PIN مشفَّر) · `wifi_vouchers`

**التشغيل:** `manual_service_requests` · `support_tickets` · `transaction_disputes` · `notifications`

**الرقابة:** `audit_logs` (بـ`hash`/`previous_hash`) · `reconciliation_sessions` · `financial_discrepancies` · `agent_risk_metrics`

**فهارس حرجة:** `journal_entry_lines(party_type, party_id, gateway_id, currency_code)` · `transactions(client_ref)` UNIQUE · `voucher_inventory(status)` WHERE available.

---

# 8. ما يجب الاحتفاظ به بصرامة — نقاط تفوّق الـSPA

هذه قرارات في الـSPA **أدق مما تصفه بعض ملفات المصدر**، ويجب ألا تُفقَد:

1. **بُعد `gateway_id` على سطر القيد** (Phase 8L-2B.2) — يحل مشكلة عزل الأرصدة عند تطابق العملة، بحساب تحكم **واحد**، دون تفجير شجرة الحسابات. المرجع لا يقترح حلًا بهذه الدقة.
2. **محفظة العميل مشتقة 100% من الـLedger منذ اليوم الأول** — بلا حقل `balance` إطلاقًا. المرجع نفسه يعترف (القسم 30) أن ملفات المصدر مليئة بأمثلة `UPDATE balance` ويصفها بـ"أمثلة تعليمية فقط".
3. **الفصل الصريح: `Funding Method` ≠ `Financial Account`** — وسيلة العرض للعميل مقابل الحساب المحاسبي المستلم. المرجع يخلط بينهما أحيانًا.
4. **رفض التزوير:** `verification_unavailable` كسلوك إنتاجي صادق بدل تلفيق نجاح.
5. **البنية المدفوعة بالبيانات (Metadata-Driven)** — إضافة مؤسسة مالية جديدة = بيانات فقط، بلا كود. مُثبَت اختباريًا.
6. **`Timeout ≠ Success`** — محترم في نموذج الحالات.

---

# 9. قائمة التغييرات المصنَّفة

**🟢 KEEP (نقل كما هو):** محرك القيد المزدوج · محفظة العميل المشتقة · بُعد البوابة · عزل البوابات · دورة التغذية اليدوية · فصل السعر عن التكلفة · هوية العميل/الوكيل المزدوجة · وسائل التغذية المدفوعة ببيانات · حالات التنفيذ الـ11

**🟡 MODIFY:** `agent.balance` → مشتق من الـLedger · Idempotency → `clientRef` من العميل · منع تكرار الإيصال → `receipt_hash` · شجرة الحسابات → هرمية

**🔵 EXPAND:** RBAC → خادمي دقيق · Provider Adapter → query/cancel · التسعير → مجموعات/شرائح · العمولات → Waterfall · كشوف الحساب → تقارير مالية كاملة · الخدمات اليدوية → SLA

**🟠 MOVE TO BACKEND (الأكبر حجمًا):** **كل** منطق الأعمال · كل الأرصدة · كل القيود · كل التحقق من الصلاحيات · كل البيانات من `localStorage` → PostgreSQL · صور الإيصالات → Object Storage

**🔴 BUILD (من الصفر):** الهرمية · KYC · Device Binding/Sessions/2FA · Fraud Engine · Audit Log · حجز الرصيد (`HELD`) · Queue/Workers · Status Query Worker · الائتمان/التأمين · PIN Vault · Player ID Validation · الفواتير · MikroTik/RADIUS · النزاعات · Notification Engine · كل طبقات المطابقة · التقارير المالية · FX · إغلاق الفترات · DR/HA/Backup · Monitoring

**⚫ REMOVE:** كلمات المرور النصية من الكود · `localStorage` كمخزن مالي · Base64 للإيصالات · أي منطق مالي في المتصفح

**🟣 MERGE:** المزوّدون المحاكون → سجل مزوّدين موحد بعلَم `is_simulator` · مسارات التغذية اليدوية/الآلية → جدول معاملات واحد باختلاف `verification_mode`

**⚪ FUTURE:** OCR · AI/التنبؤ · Open Banking · SoftPOS · التحويلات الدولية · SMS/USSD Fallback

---

# 10. خريطة التحول

```
Current SPA (40,800 سطر — منطق أعمال مُثبَت باختبارات)
    ↓  استخراج منطق الأعمال (لا إعادة اختراعه)
Domain Services (Accounting · Wallet · Funding · Pricing · Commission · Execution)
    ↓
PostgreSQL (مصدر الحقيقة الوحيد + ACID + Row Locking)
    ↓
Backend API (REST versioned + Auth + RBAC خادمي + Idempotency)
    ↓
Queues / Workers (تنفيذ · استعلام حالة · إشعارات · مطابقة)
    ↓
Provider Adapters (REST/SOAP/GSM/USSD)
    ↓
External Banks / Providers
    ↓
Flutter / Web Client  ← عرض + مسودات + Cache فقط
```

**يبقى في العميل:** العرض · تصفح الكتالوج المخزَّن · مسودات الطلبات · `clientRef` · كاشف الاتصال · آخر رصيد معروف بختم زمني.
**يصبح خادميًا:** **كل شيء آخر بلا استثناء.**

---

# 11. مراحل التنفيذ المقترحة ومعايير القبول

| # | المرحلة | معيار القبول |
|---|---|---|
| **0** | الأساس: PostgreSQL + Auth حقيقي + RBAC خادمي + Audit Log | صفر كلمة مرور في الكود · كل Endpoint يفحص الصلاحية · كل فعل حساس مُسجَّل |
| **1** | نقل النواة المالية: القيود + محافظ مشتقة + **تحويل `agent.balance`** | مطابقة تامة: مجموع المحافظ = التزامات الـGL · صفر مصدر حقيقة ثانٍ |
| **2** | الهرمية + KYC + Device/Sessions | شجرة عاملة · عزل التقارير حسب الفرع |
| **3** | دورة المعاملة الكاملة: `HELD` + Queue + Workers + `clientRef` | لا خصم بلا حجز · Timeout → Pending → حسم بـWorker · لا تنفيذ مزدوج |
| **4** | التسعير والعمولات الهرمية | Waterfall صحيح · Margin Guard فعّال · عكس العمولة عند الاسترداد |
| **5** | تكامل مزوّد حقيقي واحد | تنفيذ حقيقي مع سجل raw + مطابقة |
| **6** | المطابقة + التقارير المالية | 4 طبقات مطابقة · Trial Balance متوازن · اكتشاف تلقائي للفروق |
| **7** | النزاعات + الإشعارات + SLA | استرداد كحدث محاسبي عكسي فقط |
| **8** | DR/HA/Monitoring | اختبار استرجاع ناجح · RPO/RTO مُثبَتان |

---

# 12. القرارات المعلّقة التي تحتاج حسمكم

من الوثيقة نفسها (القسم 30) + من هذا التحليل:

1. **عمق شجرة الحسابات:** 5 أم 6 مستويات؟ (تعارض داخل المصادر)
2. **RPO:** أقل من ثانية أم صفر؟ (تعارض داخل المصادر)
3. **مدة Access Token:** 15 دقيقة أم ساعة؟
4. **تقنية الطابور:** BullMQ/Redis أم RabbitMQ/Kafka؟
5. **Microservices أم Modular Monolith؟** (المرجع لا يحسمه؛ وثائق مشروعكم السابقة تميل لـModular Monolith)
6. **متى تُحوَّل `agent.balance`؟** توصيتي: المرحلة 1، قبل بناء أي شيء فوقها
7. **حدود الاحتيال والنزاعات:** سياسات قابلة للتهيئة، لا ثوابت
8. **الامتثال السعودي (ZATCA/VAT/KYC-AML):** يحتاج تحققًا قانونيًا خارجيًا — **غير محسوم في المصادر**

---

# 13. البيانات غير المتوفرة (لم أخترع شيئًا)

- **ملف تطبيق منافس حقيقي** — غير متوفر في المصادر الحالية
- **وثائق API لأي بنك/محفظة** (بنك عدن، القطيبي، الكريمي) — غير متوفرة
- **بيانات مزوّدي التيليكوم** (هوية، تكلفة، كود منتج) لـ12 باقة — غير متوفرة
- **أرقام حسابات الاستلام الحقيقية** — غير متوفرة
- **بيانات MikroTik/RADIUS** — غير متوفرة
- **نسب العمولات الفعلية** — المرجع يصرّح أن الأمثلة توضيحية لا سياسات

---

**لم يُعدَّل أي ملف في هذا التحليل.** `spa_app.html` كما هو بالضبط.
