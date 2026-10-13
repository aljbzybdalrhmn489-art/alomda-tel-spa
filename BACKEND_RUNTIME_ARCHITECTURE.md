# BACKEND_RUNTIME_ARCHITECTURE — v1.0
## ALOMDA TEL · Phase 1A — أساس التشغيل المُنفَّذ فعليًا

**الحالة:** ✅ **IMPLEMENTED** — أساس تشغيل فقط · لا منطق مالي · لا قاعدة بيانات
**التاريخ:** 2026-09-07
**المراجع المُلزِمة:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md` · `BACKEND_TECHNICAL_DESIGN_v1.0.md` · `ARCHITECTURE_IMPLEMENTATION_GATE.md`
**SPA:** `spa_app-175.html` · SHA256 `7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1` — **لم يُمس في هذه المرحلة**

---

# 0. ما هذه الوثيقة وما ليست

هذه الوثيقة تصف **أساس التشغيل الموجود الآن كودًا** داخل `backend/`.

ليست وثيقة تصميم. التصميم في `BACKEND_TECHNICAL_DESIGN_v1.0.md` و`POSTGRESQL_LOGICAL_SCHEMA_v1.0.md` و`BACKEND_API_CONTRACT_v1.0.md` و`MIGRATION_DESIGN_v1.0.md`.

**قاعدة التعارض:** عند أي اختلاف بين هذه الوثيقة ووثيقة تصميم → **وثيقة التصميم تحسم، وهذه الوثيقة هي الخلل.**

كل ما يُذكر أدناه **تم التحقق منه بتشغيل الكود**. لا شيء هنا طموح أو مُفترض.

| موجود فعليًا | غير موجود إطلاقًا |
|---|---|
| Process bootstrap · HTTP transport · Request Context | أي قاعدة بيانات · أي SQL · أي migration |
| نموذج أخطاء · توليد معرّفات · Logging بتنقيح | أي Wallet · Journal Entry · Transaction |
| الوصول إلى الإعدادات · حدود الـModules | أي استدعاء Provider · Pricing · Commission |
| فاحص حدود معماري ثابت | أي مصادقة حقيقية · أي endpoint أعمال |

القسم 9 يعدّد الغائب صراحةً.

---

# 1. منصة التشغيل

| البند | القيمة | السبب |
|---|---|---|
| Runtime | **Node.js v24.20.0** | Type Stripping أصلي — لا مُحوِّل في مسار التشغيل |
| مدير الحزم | **npm 11.19.0** حصرًا | قفل واحد · خوارزمية حل واحدة (§23) |
| اللغة | **TypeScript 5.9.3** (مثبَّت) | 7.x كان قد صدر للتو؛ التثبيت يتجنّب major غير مُجرَّب تحت نظام مالي |
| مشغّل الاختبارات | **`node:test`** المدمج | صفر تبعية اختبار |
| HTTP | **`node:http`** المدمج | صفر تبعية إطار ويب |
| تبعيات إنتاجية | **صفر** | كل حزمة طرف ثالث في المسار المالي هي سطح هجوم سلسلة توريد مستقبلي |
| تبعيات تطويرية | **اثنتان** (`typescript` · `@types/node`) | فحص أنواع فقط — غير موجودة وقت التشغيل |

التشغيل يتم من مصدر TypeScript مباشرة:

```
node --experimental-strip-types src/main.ts
```

**نقطة معمارية:** Type Stripping يمحو الأنواع ولا يحوّل الصياغة. لذلك فُعِّل `erasableSyntaxOnly` (القسم 3): المُصرِّف يرفض أي بنية لا يستطيع Runtime محوها — فلا يمكن أن يفترق «يمر فحص الأنواع» عن «يعمل».

---

# 2. هيكل المشروع

```
backend/
├── package.json                     npm فقط · type: module · صفر تبعية إنتاجية
├── package-lock.json                قفل واحد
├── tsconfig.json                    strict + erasableSyntaxOnly
├── architecture-boundaries.json     ⚖️ قانون التبعيات القابل للقراءة آليًا
├── .env.example                     أسماء مفاتيح فقط — ولا قيمة واحدة
├── .gitignore                       node_modules/ · dist/ · .env
│
├── scripts/
│   ├── check-boundaries.mjs         فاحص الحدود (.mjs خام · يعمل بـnode وحده)
│   └── check-boundaries.d.mts       تصريحات أنواع — ليستورده الاختبار بلا any
│
├── src/
│   ├── main.ts                      نقطة دخول العملية + معالجة الإشارات
│   │
│   ├── app/                         ⭐ COMPOSITION ROOT — المنطقة الوحيدة العابرة للطبقات
│   │   ├── composition-root.ts      يربط التنفيذات الفعلية بالمنافذ
│   │   └── bootstrap.ts             مقبض التشغيل/الإيقاف
│   │
│   ├── interfaces/                  تكييف النقل (بلا منطق أعمال)
│   │   └── http/
│   │       ├── request-context-factory.ts
│   │       └── health-route.ts
│   │
│   ├── infrastructure/              تنفيذات المنافذ (Adapters)
│   │   ├── clock/                   system-clock.ts · fake-clock.ts
│   │   ├── config/                  env-config-provider.ts
│   │   ├── http/                    http-server.ts (منفذ) · node-http-server.ts (محوّل)
│   │   ├── id/                      uuid-v7.ts · uuid-v7-generator.ts
│   │   └── logging/                 structured-logger.ts · redaction.ts
│   │
│   ├── shared/                      ⭐ SHARED KERNEL — جذر التبعيات
│   │   ├── types/                   brand.ts · ids.ts · money.ts
│   │   ├── errors/                  error-code.ts · app-error.ts
│   │   ├── result/                  result.ts
│   │   ├── context/                 actor-context.ts · request-context.ts · audit-context.ts
│   │   └── ports/                   clock · id-generator · logger · config-provider
│   │                                repository · event-publisher · authorization
│   │
│   └── modules/                     16 module — تصريحات حدود فقط
│       ├── accounting/README.md     ⛔ صفر كود في أيٍّ منها في 1A
│       ├── identity/  security/  parties/  wallet/  transactions/
│       ├── provider/  pricing/  commission/  funding/  digital/
│       └── operations/  disputes/  reconciliation/  reporting/  notifications/
│
└── test/
    ├── shared/kernel.test.ts
    ├── infrastructure/runtime.test.ts
    ├── app/bootstrap.test.ts
    └── architecture/boundaries.test.ts
```

**الأحجام:** 36 ملف TypeScript (1,351 سطرًا) · 16 ملف README **بصفر كود** · 4 ملفات اختبار (692 سطرًا) · فاحص حدود (285 سطرًا).

---

# 3. إعداد TypeScript — ولماذا كل علم موجود

```jsonc
"strict": true,                          // الأساس
"exactOptionalPropertyTypes": true,      // { x?: string } لا يقبل undefined.
                                         //   يمنع «الحقل موجود لكنه فارغ» من أن
                                         //   يصير حالة مالية صامتة
"noUncheckedIndexedAccess": true,        // arr[i] هو T | undefined. في نظام مالي،
                                         //   الفهرسة غير المفحوصة مصنع NaN صامت
"noPropertyAccessFromIndexSignature": true,
"noImplicitOverride": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,      // السقوط في switch داخل آلة حالات =
                                         //   حالة معاملة خاطئة
"noUnusedLocals": true,
"noUnusedParameters": true,
"verbatimModuleSyntax": true,            // حذف الاستيراد صريح لا مُخمَّن
"isolatedModules": true,
"erasableSyntaxOnly": true,              // ⛔ يمنع enum وparameter properties
                                         //   لأن Type Stripping لا يستطيع إصدارها
"allowImportingTsExtensions": true,      // Node يحل المُعرِّف .ts الحقيقي
"rewriteRelativeImportExtensions": true, // ومع ذلك tsc يُصدر .js قابلًا للتشغيل
"declaration": true, "sourceMap": true
```

`erasableSyntaxOnly` له أثر معماري حقيقي: **لا يوجد `enum` واحد في هذا الكود.**
كل مفردات مغلقة تُعبَّر بـ `as const` + اتحاد مشتق + حارس نوع وقت التشغيل — أي أن كل مجموعة مغلقة (العملات · أنواع الأطراف · رموز الأخطاء · مستويات السجل) **قابلة للفحص وقت التشغيل** لا وقت الترجمة فقط.

---

# 4. اتجاه التبعيات (القانون)

```
                       ┌──────────────┐
                       │   main.ts    │  entrypoint
                       └──────┬───────┘
                              │ يُشغّل
                       ┌──────▼───────┐
                       │     app/     │  COMPOSITION ROOT
                       │  الطبقة      │  يجوز له استيراد كل طبقة
                       │  الوحيدة     │
                       │  التي تعرف   │
                       │  الجميع      │
                       └──┬───┬───┬───┘
              ┌───────────┘   │   └───────────┐
              ▼               ▼               ▼
       ┌────────────┐  ┌──────────────┐  ┌──────────┐
       │ interfaces │  │infrastructure│  │ modules  │
       └──────┬─────┘  └──────┬───────┘  └────┬─────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                       ┌──────────────┐
                       │   shared/    │  جذر التبعيات
                       │ لا يستورد    │  لا يستورد إلا نفسه
                       │ أحدًا        │
                       └──────────────┘
```

القواعد كما يفرضها `architecture-boundaries.json` حرفيًا:

| المنطقة | يجوز لها استيراد | المبرر |
|---|---|---|
| `shared` | `shared` · external | لو استورد الـKernel أي module لورثت كل النطاقات ذلك الاختيار بالتعدّي وتوقف عن كونه مشتركًا |
| `module` | `shared` · نفس الـmodule · external | الـmodule يرى الـKernel ونفسه. المرور بين الـmodules عبر منافذ مُعلَنة في الـKernel — **لا استيراد مباشر**. **ولا يجوز لأي module استيراد `infrastructure`** |
| `infrastructure` | `shared` · `infrastructure` · external | الـAdapters تنفّذ المنافذ. لو استورد Adapter module أعمال لانعكس سهم التبعية |
| `interfaces` | `shared` · `infrastructure` · `interfaces` · external | تكييف نقل فقط |
| `app` | كل شيء | Composition Root هو المكان الوحيد المسموح له بمعرفة التنفيذات الفعلية. **وهذا بالضبط سبب** بقاء كل منطقة أخرى مفكوكة الارتباط |
| `entrypoint` | `app` · `shared` · external | `main.ts` يُشغّل التطبيق المُركَّب فقط |
| `test` | كل شيء + `scripts` | الاختبارات تراقب من الخارج · واختبار المعمارية يُشغّل الفاحص مباشرة |
| `script` | external · `script` | أدوات البناء/الفحص خارج رسم التبعيات |

## 4.1 الحواف المحظورة بالاسم بين الـModules

هذه ليست تفضيلات أسلوبية. كل حافة منها، لو سُمح بها، تُعيد إنتاج خلل محدَّد أغلقته مراحل التصميم:

| من ← إلى | ماذا يحدث لو سُمح |
|---|---|
| `provider` → `transactions` | تعود دورة التنسيق. **Provider يُستدعى ولا يستدعي.** النتائج تعود كأحداث |
| `security` → `accounting` · `wallet` | يكسر ترتيب البناء AP-04. Security يوفّر الهوية والتخويل وسياق التدقيق — **ولا يقرأ رصيدًا ولا قيدًا** |
| `accounting` → *(الـ15 الأخرى)* | **Accounting جذر شجرة التبعية المالية. لا يستدعي أحدًا.** فحص Maker/Checker يتم في **طبقة التطبيق قبل** استدعاء Accounting (تصحيح C-01) |
| `reporting` → *(الـ15 الأخرى)* | AP-01: التقارير للقراءة فقط. تقرأ عبر Query Models؛ واستيراد module قادر على الكتابة يعني أن تقريرًا يستطيع تعديل المال |
| `notifications` → *(الـ15 الأخرى)* | AP-02: الإشعارات مستهلك Outbox. استيراد Operations ينشئ Operations → Notifications → Operations |
| `pricing` → `wallet` | Pricing يحسب سعرًا. **لا يلمس رصيدًا** |
| `commission` → `wallet` | Commission يُراكم التزامًا عبر قيد محاسبي. **لا يكتب في محفظة مباشرة** |

---

# 5. الـShared Kernel

يحتوي **عقودًا وأنواع قيمة فقط**. لا I/O · لا قاعدة عمل · لا قيمة إعداد · لا حساب على المال.

## 5.1 `types/brand.ts` — التنميط الاسمي

```ts
declare const BRAND: unique symbol;
export type Brand<TBase, TBrand extends string> = TBase & { readonly [BRAND]: TBrand };
```

**سبب وجوده:** في الـSPA كان المعرّف والمبلغ كلاهما «قيمة»، وهكذا بالضبط ينتهي `partyId` في مكان `gatewayId`. مع الـBrands يصير `PartyId` و`TransactionId` نصّين وقت التشغيل و**غير متوافقين وقت الترجمة**.

## 5.2 `types/ids.ts`

موسومة: `Identifier` · `TenantId` · `PartyId` · `UserId` · `DeviceId` · `RequestId` · `CorrelationId` · `ClientRef` · `TransactionId` · `JournalEntryId` · `ProviderRequestId` · `ProviderEventId`.

`ClientRef` و`ProviderRequestId` و`ProviderEventId` أنواع **متمايزة عمدًا** — فهي ثلاث من **طبقات الـIdempotency الأربع المستقلة**، ويجب ألّا تكون قابلة للتبادل أبدًا.

وأيضًا: `PARTY_TYPES` (`as const`) · الاتحاد المشتق `PartyType` · `PartyRef` · الحارس `isPartyType()`.

## 5.3 `types/money.ts` — **أنواع فقط · صفر حساب**

يحتوي: `CURRENCY_CODES = ['YER','YEO','SAR','USD'] as const` · `isCurrencyCode()` · `MoneyAmount = Brand<string,'MoneyAmount'>` · `Money { amount, currency }` · شكل `CurrencyMetadata` · وواجهة `MoneyEnginePort` تُعلن `parse` / `roundForPosting` / `allocate` / `metadataFor`.

ثلاثة غيابات مقصودة:

1. **`MoneyAmount` نص موسوم، لا `number` أبدًا.** IEEE-754 لا يمثّل المال. استخدام `number` كمبلغ نطاقي محظور بـ§9.
2. **`MoneyEnginePort` بلا تنفيذ.** التقريب والتوزيع والصرف تخص Phase 1B. تنفيذها هنا يضع منطقًا ماليًا في 1A.
3. **`roundingScale` مُعلَن وغير مُعبَّأ · ولا عملة تقرير مُسمّاة.** `OPEN-BE-02` ما زال **OPEN**. أي قيمة افتراضية هنا تخترع قرارًا لا تتخذه وثائق المصدر. **واختبار يؤكد هذا الغياب** (القسم 10).

## 5.4 `errors/` — نموذج الأخطاء

16 رمز خطأ، لكلٍّ حالة HTTP وعلم قابلية إعادة المحاولة. تعيينان يحملان وزنًا معماريًا:

```
PROVIDER_TIMEOUT  →  HTTP 202  ·  retryable = false
PROVIDER_UNKNOWN  →  HTTP 202  ·  retryable = false
```

**202 وليس 4xx/5xx** — لأن `TIMEOUT ≠ FAILED` (ADR-107/109). النتيجة المجهولة من المزوّد **مقبولة ومعلّقة الحسم**، لا فاشلة. إرجاع 5xx يدعو المتصل لإعادة المحاولة، وإعادة المحاولة العمياء على مزوّد قد يكون نجح بالفعل هي الطريق الذي يُخصم به العميل مرتين. و`retryable = false` يقول ذلك داخل الحمولة نفسها.

`AppError.toClientPayload(correlationId)` **لا يُصدر stack ولا cause** — فقط `code` · `message` · `details` · `correlationId` · `retryable`. التفصيل الداخلي يبقى على الخادم، و`correlationId` هو الجسر.

## 5.5 `result/result.ts`

`Result<T> = { ok: true; value: T } | { ok: false; error: AppError }` مع `ok / err / isOk / isErr / unwrap / map`.
يُستخدم حيث يكون الفشل نتيجة **متوقَّعة** (البحث في الإعدادات اليوم · فحوص الرصيد ونتائج المزوّد لاحقًا)، ليكون الفشل المتوقَّع **قيمة** لا استثناءً مرميًّا.

## 5.6 `context/`

- `ActorContext` — من يتصرّف. كل الحقول اختيارية · و`ANONYMOUS_ACTOR` هي قيمة 1A لأن المصادقة تخص Phase 1K.
- `RequestContext` — `requestId` · `correlationId` · `tenantId` · `actor` · `receivedAt` · واختياريًا `ipAddress` · `userAgent` · `clientRef`.
- `AuditContext` + `auditContextFrom(ctx, at, reason?)` — الشكل الذي سيُلزَم كل كتابة مالية بحمله لاحقًا. **يحذف** الحقول الاختيارية الغائبة بدل ضبطها على `undefined` (يفرضه `exactOptionalPropertyTypes`)، فلا يمكن لسجل تدقيق أن يدّعي «الحقل موجود والقيمة مجهولة».

## 5.7 `ports/`

واجهات فقط · بلا تنفيذ داخل الـKernel:
`Clock` · `IdGenerator` · `Logger`/`LogFields`/`LOG_LEVELS` · `ConfigProvider` · `Repository<T,TId>`+`UnitOfWork` · `DomainEvent`/`EventPublisher`/`QueuePort` · `AuthorizationPort`/`ApprovalPort`.

`Repository` و`UnitOfWork` و`EventPublisher` و`QueuePort` و`AuthorizationPort` و`ApprovalPort` **بلا تنفيذ في 1A عمدًا**. وجودها يمنح كود 1B فما بعد عقدًا يُكتب في مواجهته، ويجعل إضافة PostgreSQL أو طابور لاحقًا **Adapter لا إعادة معمار**.

---

# 6. سياق الطلب · الربط · المعرّفات

## 6.1 المسار

```
طلب HTTP وارد
   │
   ▼
RequestContextFactory.fromIncoming(req)          [interfaces/http]
   │  requestId     ← يُولَّد هنا دائمًا (لا يستطيع المتصل تزويره)
   │  correlationId ← من ترويسة x-correlation-id إن وُجدت · وإلا يُولَّد
   │  tenantId      ← ثابت على مستوى النشر (REC-BE-15)
   │  actor         ← ANONYMOUS_ACTOR (المصادقة في Phase 1K)
   │  receivedAt    ← clock.now()  (محقون · لا Date.now() سطريًا)
   │  clientRef     ← ترويسة idempotency-key إن وُجدت
   ▼
HttpRequest { method, path, headers, context }   [شكل محايد تجاه النقل]
   ▼
معالج المسار
   ▼
استجابة + ترويسات: x-request-id · x-correlation-id
```

**`requestId` مقابل `correlationId`:** الإجراء التجاري الواحد يمتد عبر استدعاء API وصفّ Outbox وتنفيذ Worker أو أكثر. `correlationId` هو ما يربطها، ولذلك **يُقبل من المتصل**. أما `requestId` فيُعرّف طلب HTTP واحدًا و**يُولَّد على الخادم دائمًا**. اختبار يؤكد أن طلبين يتشاركان `correlationId` من المتصل يحصلان مع ذلك على `requestId` **مختلفين**.

`clientRef` يُلتقط من ترويسة `Idempotency-Key` **ولا يُعمل به في 1A** — لا مخزن Idempotency بعد. الوصلة موجودة ليكون للطبقة الأولى من طبقات الـIdempotency الأربع نقطة دخول مُعرَّفة.

## 6.2 UUIDv7 — `infrastructure/id/uuid-v7.ts`

مُنفَّذ داخليًا وفق RFC 9562. **ليس تبعية** — لأن توليد المعرّفات يقع تحت كل سجل مالي ويجب ألّا يكون سطح سلسلة توريد.

الخصائص، كلٌّ مُغطّاة باختبار:

- طابع زمني 48-bit بالميلي ثانية ⟹ المعرّفات **مرتّبة زمنيًا**، مما يبقي المفتاح الأساسي في B-tree **إلحاقيًا** بدل الكتابة العشوائية عبر الفهرس.
- خانة الإصدار `7` · بتّات النوع `10` (مُتحقَّق على 200 عيّنة).
- **عدّاد تصاعدي 12-bit** — المعرّفات المولَّدة داخل الميلي ثانية نفسها **تصاعدية تمامًا** (مُتحقَّق على 500 معرّف في ميلي ثانية واحدة ثابتة · كلها فريدة وبترتيب فرزها).
- **فيضان العدّاد يستعير الميلي ثانية التالية** بدل التصادم.
- **لا يعود للخلف أبدًا** عند رجوع ساعة الحائط (تصحيح NTP) — المولّد يحفظ علامته العليا. رجوع الساعة يجب ألّا يُنتج معرّفًا يسبق معرّفًا صادرًا بالفعل.
- 5,000 معرّف دفعة واحدة · صفر تصادم.

## 6.3 الساعة

`Clock` منفذ. `SystemClock` محوّل الإنتاج · و`FakeClock` حتمي ولا يتحرك **إلا بأمر** (`advanceMs` · `setTo`). و`now()` يُعيد **نسخة**، فلا يستطيع المتصل تعديل الساعة عبر نتيجته.

الوقت يدخل النظام من **وصلة واحدة فقط**. وهذا يهم لاحقًا: انتهاء الصلاحية وتواريخ القيمة ونوافذ التسوية يجب أن تكون قابلة للاختبار بلا انتظار وقت حقيقي.

---

# 7. السجلات · التنقيح · الإعدادات

## 7.1 السجل المُهيكل

كائن JSON واحد لكل سطر: `ts` · `level` · `module` · `event` + حقول المُتصل.
`child({...})` يربط سياقًا (مثل `correlationId`) لنطاق الطلب. والمصرف (sink) قابل للحقن، فتلتقط الاختبارات الخرج بلا لمس stdout.

## 7.2 التنقيح مفروض عند الـLogger لا عند نقطة الاستدعاء

`REDACTED_FIELD_PATTERNS` يغطي: password · secret · token · credential · authorization · apikey · privatekey · pin · otp · cvv · pan · cardnumber · iban · voucher · secretcode · seed · signature · hash.
المطابقة **غير حسّاسة لحالة الأحرف وبالتضمين الجزئي**، فيُلتقط `providerApiKey` و`transactionPin`.

`redactFields()` **يستبدل القيمة بـ`[REDACTED]` ويُبقي المفتاح** — فيبقى شكل السجل مستقرًا ويرى المشغّل أن الحقل كان موجودًا دون أن يرى قيمته.

**النقطة التصميمية:** قاعدة تعتمد على أن يتذكّر كل مطوّر مستقبلي ألّا يسجّل سرًّا **ليست ضابطًا**. هنا الـLogger يرفض مهما مرّر المتصل. واختبار يثبت أن تمرير `password` و`providerSecret` يُنتج سطرًا لا يحتوي أيًّا من القيمتين.

## 7.3 الإعدادات

`infrastructure/config/env-config-provider.ts` هو **الملف الوحيد في الكود كله الذي يقرأ `process.env`**.

تقسيم ثلاثي — والتقسيم نفسه هو المقصد:

| الفئة | السلوك عند عدم الضبط | السبب |
|---|---|---|
| `runtime()` | يرجع إلى افتراضي آمن (`httpPort` 3000 · `appEnv` development · `tenantId` default) | المنفذ بلا معنى مالي |
| `business(key)` | **`Err(CONFIG_NOT_SET)`** — ولا افتراضي أبدًا | القيمة التجارية الافتراضية **قاعدة عمل مخترعة**. `pricing.minMargin` بافتراضي `0` قرار سياسة صامت |
| `secretRef(key)` | **مرجع** (`kms://…`) · ولا قيمة أبدًا | ADR-113. المستودع يحمل أسماء لا أسرارًا |

`accounting.reportingCurrency` **غائب عمدًا** عن `.env.example` ويُرجع `CONFIG_NOT_SET`. `OPEN-BE-02` مفتوح و1A **لا تغلقه**.

---

# 8. Composition Root والإقلاع

`app/composition-root.ts` هو **الملف الوحيد** المسموح له باستيراد كل طبقة.
يربط: `SystemClock` · `UuidV7Generator` · `EnvConfigProvider` · `StructuredLogger` · `NodeHttpServer` · `RequestContextFactory` — ويسجّل **مسارًا واحدًا فقط**.

```ts
composeApplication(overrides?) → Application            // يربط · ولا يستمع
startApplication(overrides?)   → RunningApplication     // { app, host, port, shutdown() }
```

كل تبعية قابلة للاستبدال، ولهذا **لا تحتاج حزمة الاختبارات إلى أي إطار Mocking**: الاختبار يمرّر `FakeClock` ومصرف سجل ملتقط مباشرة.

`main.ts` يُشغّل التطبيق ويسجّل معالجي `SIGINT`/`SIGTERM` اللذين يستدعيان `shutdown()` ثم يخرجان.

## 8.1 `GET /health` — المسار الوحيد

```json
{
  "data": { "status": "ok", "name": "alomda-tel-backend",
            "version": "0.1.0-phase1a", "environment": "…",
            "phase": "1A-runtime-foundation" },
  "meta": { "correlationId": "…", "asOf": "…" }
}
```

**لا يُجري أي فحص قاعدة بيانات** — لا قاعدة بيانات أصلًا، ومِجَسّ حياة يعتمد على التخزين يُبلّغ عن النظام الفرعي الخطأ كغير سليم. ولا يكشف أي قيمة إعداد ولا مرجع سرّ ولا بيانات مستأجر.

كل مسار آخر يُرجع `404 NOT_FOUND` مُهيكلًا مع `retryable: false`.
واختبار يؤكد أن `/transactions` و`/wallet` و`/funding` و`/pricing` و`/providers` كلها تُرجع 404 — أي أنه **لم يظهر أي endpoint أعمال**.

---

# 9. الغائب عمدًا

| الغائب | يخص | لماذا ليس الآن |
|---|---|---|
| حساب المال · التقريب · التوزيع | Phase 1B | المنطق المالي خارج نطاق 1A |
| عملة التقرير | **OPEN-BE-02** | غير محسومة · والافتراضي يخترعها |
| PostgreSQL · SQL · migrations · أي عميل قاعدة بيانات | Phase 1C+ | محظور صراحةً في §2 |
| تنفيذات `Repository` / `UnitOfWork` | Phase 1C+ | عقود فقط حتى يوجد تخزين |
| Wallet · Accounting · Transactions · Provider · Pricing · Commission · Funding · Digital · WiFi · Reporting · Reconciliation | Phase 1B+ | تصريحات حدود فقط — 16 README بصفر كود |
| مصادقة/تخويل حقيقي | Phase 1K | `ANONYMOUS_ACTOR` + عقد `AuthorizationPort` يعلّمان الوصلة |
| Outbox · Queue · Workers | مراحل لاحقة | عقود `EventPublisher` / `QueuePort` فقط |
| Redis · RabbitMQ · Kafka · Docker · K8s | مراحل لاحقة | محظورة في 1A |
| تكامل مدير أسرار خارجي | مراحل لاحقة | تُعالَج **مراجع** الأسرار فقط |
| Rate limiting · CORS · إنهاء TLS | مراحل لاحقة | هموم الحافة لا أساس التشغيل |

---

# 10. استراتيجية الاختبار

`node:test` + `node:assert/strict`. **68 اختبارًا في 4 ملفات · كلها ناجحة.**
**بلا أي إطار Mocking** — عكس التبعية يجعله غير ضروري.

| الملف | ما يُثبته |
|---|---|
| `test/shared/kernel.test.ts` | مجموعة العملات هي الأربع المجمَّدة بالضبط · **لا عملة تقرير مُعلَنة** (يُتحقق بقراءة المصدر، فأي افتراضي مستقبلي **يكسر البناء**) · كل رمز خطأ في عقد الـAPI موجود · Provider timeout يُعيَّن على 202 وغير قابل لإعادة المحاولة · `toClientPayload` لا يسرّب stack ولا cause · دلالات `Result` · سياق التدقيق يحذف الاختياري الغائب |
| `test/infrastructure/runtime.test.ts` | حتمية الساعة وعدم قابليتها للتعديل · UUIDv7: الإصدار/النوع/التصاعدية/رجوع الساعة/الفرادة بالجملة · التنقيح يلتقط التضمين الجزئي بلا حساسية حالة ولا يُصدر سرًّا · ترشيح مستوى السجل وسياق الابن · الإعدادات تُرجع `CONFIG_NOT_SET` للمفاتيح التجارية غير المضبوطة و**مرجعًا** للأسرار |
| `test/app/bootstrap.test.ts` | التطبيق يُقلع ويربط منفذًا · `/health` يُرجع 200 **بلا أي قاعدة بيانات** · ترويسات الطلب والربط مختومة على الاستجابة · `correlationId` من المتصل ينتقل من الطرف للطرف بينما تبقى معرّفات الطلب فريدة · الساعة المحقونة تُستخدم فعلًا · المسارات المجهولة تُرجع `NOT_FOUND` مُهيكلًا · **لا وجود لأي مسار أعمال** |
| `test/architecture/boundaries.test.ts` | **الفاحص نفسه يعمل** — كل حافة محظورة تُعاد إنتاجها في مشروع مؤقت ويُؤكَّد التقاطها · والحواف المسموحة يُؤكَّد عدم الإبلاغ عنها · والمشروع الحقيقي بصفر مخالفات · و**أن أكثر من 20 ملفًا فُحص فعلًا** |

التأكيد الأخير مقصود: **فاحص حدود لا يفحص شيئًا يُبلّغ «صفر مخالفات» — وهي أخطر نتيجة خضراء ممكنة.**

---

# 11. الفرض المعماري الثابت

`scripts/check-boundaries.mjs` — 285 سطرًا · صفر تبعية · يعمل بـ`node` وحده (لا يحتاج منظومة TypeScript، **فلا يستطيع بناء معطوب أن يُعطّل الفرض المعماري بصمت**).

كيف يعمل:

1. يمشي على `src/` و`test/` و`scripts/` جامعًا ملفات `.ts` / `.mts`.
2. يجرّد **التعليقات** و**القوالب النصية (template literals)** قبل التحليل، فلا يُعدّ استيراد معلَّق تبعيةً، ولا يُخلط نصّ اختبار يُضمِّن كودًا داخل backticks باستيراد حقيقي.
3. يطابق **7 صيغ استيراد**: `import … from` · `import type … from` · `import '…'` المجرّد · `export … from` · `export type … from` · `import('…')` الديناميكي · `require('…')`.
4. يحل المُعرِّفات النسبية مقابل جذر المشروع ويصنّف الطرفين إلى مناطق (ملتقطًا اسم الـmodule لـ`src/modules/<name>/`).
5. يفرض قائمة السماح لكل منطقة، ثم الحواف المحظورة بالاسم.
6. يُبلّغ عن الملف والمُعرِّف والمنطقة المصدر والهدف **والسبب الإنساني** للقاعدة.
7. يخرج بقيمة غير صفرية عند أي مخالفة.

ويُبلّغ أيضًا عن أي استيراد يهرب خارج جذر المشروع.

**هذه هي آلية الفرض. التعليقات والأعراف ليست آلية فرض.**
`architecture-boundaries.json` هو القانون القابل للقراءة آليًا · ومصدر حقيقته `ARCHITECTURE_IMPLEMENTATION_GATE.md` القسم F (مصفوفة تبعية النطاقات).

**النتيجة الحالية: 41 ملفًا مفحوصًا · صفر مخالفة.**

---

# 12. الأوامر

```bash
npm run check:boundaries   # فحص الحدود المعمارية
npm run typecheck          # tsc --noEmit
npm test                   # node:test
npm run build              # tsc → dist/
npm run verify             # الحدود ← الأنواع ← الاختبارات
npm start                  # node --experimental-strip-types src/main.ts
```

`npm run verify` يُشغّل فحص الحدود **أولًا** عمدًا: المخالفة المعمارية فشل تصميمي ويجب الإبلاغ عنها قبل أخطاء الأنواع.

---

# 13. حدود هذا الأساس المعروفة

1. **لا أداة Lint.** لم يُثبَّت ESLint (تقليل التبعيات · §23). `tsc` بوضع strict الكامل + فاحص الحدود يغطيان أصناف الخلل المهمة هنا، لكن فحص الأسلوب **NOT AVAILABLE** بصدق.
2. **الإيقاف الرشيق عبر إشارات POSIX غير مُتحقَّق منه على Windows.** `shutdown()` مُتحقَّق منه داخل العملية باختبار الإقلاع؛ أما الإيقاف المُطلَق بـ`SIGTERM` فغير قابل للرصد على Windows Server ويُسجَّل **NOT VERIFIABLE على هذه المنصة**.
3. **فاحص الحدود قائم على regex لا على مُحلِّل TypeScript كامل.** يجرّد التعليقات والقوالب النصية لتفادي الإيجابيات الكاذبة الشائعة. والقالب النصي المتداخل داخل `${}` قد ينهي التجريد مبكرًا — وهذا يكلّف **إيجابية كاذبة، لا سلبية كاذبة أبدًا**. مُحاز عمدًا نحو الإفراط في الإبلاغ.
4. **`clientRef` يُلتقط ولا يُفرَض.** لا مخزن Idempotency بعد.
5. **لا تحليل لجسم الطلب ولا طبقة تحقق.** `/health` لا يأخذ مدخلات. كلاهما يصل مع أول endpoint يقبل مدخلًا.
6. **`tenantId` ثابت نشر.** TENANT-READY / SINGLE-TENANT-DEPLOYED (REC-BE-15). لا منطق عزل مستأجرين · و`OPEN-BE-15` ما زال **OPEN**.

---

# 14. بيان الجاهزية

هذا **أساس تشغيل**. ليس Backend · ولا نظامًا ماليًا · ولا API.

ما يوفّره لـ**Phase 1B — Money + Currency**:

- مكان لتنفيذ `MoneyEnginePort` — الواجهة مُعلَنة بالفعل، و`MoneyAmount` نص موسوم لا `number`.
- مفردات عملات مجمَّدة سلفًا على `['YER','YEO','SAR','USD']` مع حارس وقت تشغيل، وشكل `CurrencyMetadata` بانتظار تعبئة `roundingScale` من مصدر محسوم.
- نموذج أخطاء يميّز **النتيجة المجهولة عن الفشل** من الآن.
- نوع `Result` ليكون فشل تحليل المبلغ **قيمة لا استثناءً**.
- وصلة ساعة لجعل تواريخ القيمة والصلاحية قابلة للاختبار.
- فاحص حدود **يُفشل البناء لحظة وضع منطق المال في الطبقة الخطأ**.

**يمكن بناء Phase 1B فوق هذا الأساس بلا تغيير معماري.**
