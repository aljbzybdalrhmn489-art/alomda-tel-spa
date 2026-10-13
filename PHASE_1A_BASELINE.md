# PHASE_1A_BASELINE
## ALOMDA TEL · حالة مساحة العمل قبل أي كتابة كود

**التاريخ:** 2026-09-07
**المرجع:** `ARCHITECTURE_IMPLEMENTATION_GATE.md` · `BACKEND_TECHNICAL_DESIGN_v1.0.md`

---

# 1. أسئلة ما قبل التنفيذ — إجابات مُتحقَّقة

| السؤال | الإجابة |
|---|---|
| هل يوجد Backend project أصلًا؟ | **لا** — صفر مجلد كود في مساحة العمل |
| هل يوجد `package.json`؟ | **لا** |
| هل يوجد `tsconfig`؟ | **لا** |
| هل يوجد source directory؟ | **لا** |
| هل يوجد test framework؟ | **لا** — مؤكَّد سابقًا: `TEST SUITE NOT PRESENT` |
| هل توجد config files؟ | **لا** |
| هل توجد CI files؟ | **لا** |
| هل توجد مشاريع أخرى داخل workspace؟ | **لا** داخل `D:\ALOMDA TEL`. يوجد مشروع منفصل تمامًا خارجها (`D:\alomda soft new`) — **ليس جزءًا من هذا المشروع ولن يُمس** |
| Runtime المتاح | **Node.js `v24.20.0`** |
| npm | **`11.19.0`** |
| pnpm | **غير متوفر** (`command not found`) |
| yarn | **غير متوفر** (`command not found`) |
| TypeScript | **غير مثبّت** — لا محليًا ولا عالميًا |
| Git | `git version 2.55.0.windows.5` — **لكن مساحة العمل ليست مستودع Git** (`fatal: not a git repository`) |

## 1.1 قدرات Runtime مُتحقَّق منها عمليًا
| القدرة | النتيجة |
|---|---|
| تشغيل TypeScript مباشرة (Type Stripping الأصلي في Node 24) | ✅ **يعمل** — `node probe.ts` نفّذ بلا أي أداة بناء |
| `node:test` (مشغّل الاختبارات المدمج) | ✅ **يعمل** |
| الوصول إلى سجل npm | ✅ **متاح** |
| `crypto.randomUUID()` | متاح — **لكنه UUIDv4 وليس v7** ⟹ UUIDv7 يُنفَّذ يدويًا بلا مكتبة |

---

# 2. حالة مساحة العمل

## 2.1 الملفات الموجودة (15 ملفًا + 26 DOCX)
```
ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md      ← مرجع معماري · لا يُمس
ALOMDA_TEL_FINAL_ARCHITECTURE.md            ← تاريخي · لا يُمس
ARCHITECTURE_IMPLEMENTATION_GATE.md         ← بوابة الاعتماد · لا تُمس
ARCHITECTURE_REVIEW_V2.md                   ← تاريخي · لا يُمس
BACKEND_API_CONTRACT_v1.0.md                ← تصميم · لا يُمس
BACKEND_DECISION_REGISTER.md                ← تصميم · لا يُمس
BACKEND_TECHNICAL_DESIGN_v1.0.md            ← تصميم · لا يُمس
FINAL_TRUTH_MATRIX.md                       ← لا يُمس
GAP_ANALYSIS.md                             ← لا يُمس
MIGRATION_DESIGN_v1.0.md                    ← تصميم · لا يُمس
POSTGRESQL_LOGICAL_SCHEMA_v1.0.md           ← تصميم · لا يُمس
PROJECT_HANDOFF.md                          ← لا يُمس
SPA_LOGIC_CORRECTION_AUDIT.md               ← لا يُمس
SPA_LOGIC_CORRECTION_REPORT.md              ← لا يُمس
spa_app-175.html                            ← ⛔ محظور مطلقًا
AlomdaTel DOCX/                             ← 26 وثيقة مصدر · لا تُمس
```

## 2.2 ملفات محظور المساس بها
```
⛔ spa_app-175.html
   SHA256 = 7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1
⛔ كل ملفات .md القائمة (مرجعية/تصميمية)
⛔ AlomdaTel DOCX/*
```
**لن يُحذف أو يُعدَّل أي ملف قائم في هذه المرحلة.**

## 2.3 Git
مساحة العمل **ليست مستودع Git**.
**القرار:** لن يُنشأ تاريخ Git جديد لأجل هذه المرحلة (§30 من التكليف). سلامة التغيير تُثبَت بـ:
- بصمة SHA256 للـSPA قبل/بعد
- جرد كامل للملفات المُنشأة/المعدَّلة/المحذوفة

---

# 3. التعارضات المكتشفة

| # | التعارض | القرار |
|---|---|---|
| **CB-1** | `OPEN-BE-01` (المنصة واللغة) ما زال `OPEN` في سجل القرارات، لكن التكليف يفترض TypeScript ضمنًا (§22) وينص `PROJECT_HANDOFF §8` على Node.js | **يُغلق `OPEN-BE-01` عمليًا بـ Node.js + TypeScript** بناءً على تعليمات هذه المرحلة. **لا يمسّ أي ADR مالي.** يُسجَّل ولا يُغيَّر أي قرار مجمَّد |
| **CB-2** | `B-1` (توقيع سجل ADR) و`B-5` (تعدد المستأجرين) كانا حاجزين أمام `1C` | **`B-5` مُغلَق** — التكليف يعتمد `TENANT-READY / SINGLE-TENANT-DEPLOYED` صراحةً. **`B-1` مُغلَق ضمنًا** باعتماد المراحل. `B-2`/`B-3`/`B-4` **ما زالت مفتوحة ولا تمنع 1A** |
| **CB-3** | التصميم يذكر «Lint» ضمن التحقق (§31) | **لا أداة lint في المشروع ولن تُضاف** (قاعدة أقل التبعيات). ستُسجَّل `NOT AVAILABLE` بصدق — بديلها فحص الحدود المعماري + `tsc --strict` |
| **CB-4** | `Repository<T>` و`QueuePort` مطلوبان كعقود (§24 · §25) بينما `POSTGRESQL_LOGICAL_SCHEMA` يصف جداول | **عقود فقط.** صفر SQL · صفر جدول · صفر تنفيذ تخزين |

**لا تعارض مع أي ADR مجمَّد.**

---

# 4. القرارات التقنية لهذه المرحلة

| # | القرار | السبب |
|---|---|---|
| **T-1** | مدير الحزم: **npm** حصرًا | الوحيد المتاح (لا pnpm ولا yarn) · قفل واحد فقط `package-lock.json` |
| **T-2** | مسار المشروع: **`D:\ALOMDA TEL\backend\`** | يفصل الكود عن وثائق الجذر · لا يقترب من SPA |
| **T-3** | اللغة: **TypeScript `strict`** | §22 من التكليف |
| **T-4** | التشغيل: **Node 24 Native Type Stripping** — بلا خطوة بناء للتطوير | صفر تبعية تشغيل · تحقُّق عملي أعلاه |
| **T-5** | البناء: **`tsc`** (إصدار مثبَّت `5.9.3`) للتحقق من الأنواع وإصدار `dist/` | إصدار TypeScript 7.x جديد جدًا — **يُثبَّت 5.9.3 للاستقرار** |
| **T-6** | الاختبارات: **`node:test` المدمج** | صفر تبعية · متحقَّق منه عمليًا |
| **T-7** | خادم HTTP: **`node:http` المدمج** | لا Express ولا Fastify — الحاجة الوحيدة `GET /health` |
| **T-8** | فحص الحدود المعمارية: **سكربت داخلي بلا تبعيات** | لا يُعتمد على تعليقات · يفحص `import` فعليًا |
| **T-9** | UUIDv7: **تنفيذ داخلي** | Node لا يوفّره · تجنّب تبعية |
| **T-10** | التبعيات الإنتاجية: **صفر** · التطويرية: **اثنتان** (`typescript` · `@types/node`) | «أبقِ dependencies أقل ما يمكن» |

---

# 5. خطة التنفيذ

| # | المخرَج | الحدود |
|---|---|---|
| 1 | هيكل المشروع + `package.json` + `tsconfig.json` + `.gitignore` + `.env.example` | لا أسرار حقيقية |
| 2 | **Shared Kernel**: الأنواع (`Identifier` · `MoneyAmount` · `CurrencyCode` · `PartyRef` · `TenantId` · `RequestId` · `CorrelationId` · `TransactionId` · `ProviderRequestId`) · `Result` · نموذج الأخطاء · المنافذ (`Clock` · `IdGenerator` · `Logger` · `ConfigProvider` · `EventPublisher`/`OutboxPort` · `Repository` · `AuthorizationPort`) · سياقات (`RequestContext` · `ActorContext` · `AuditContext`) | **لا منطق أعمال · لا حساب مالي** |
| 3 | **Infrastructure**: `SystemClock` · `FakeClock` · `UuidV7Generator` · `StructuredLogger` (بتنقيح) · `EnvConfigProvider` · `NodeHttpServer` | تنفيذ تقني بحت |
| 4 | **Modules**: 16 مجلد حدود بـ`README` **بلا كود** | **صفر منطق أعمال وهمي** |
| 5 | **App**: `composition-root` · `bootstrap` | نقطة التركيب الوحيدة |
| 6 | **Interfaces/HTTP**: `GET /health` · middleware سياق الطلب · مُخطِّط الأخطاء | لا endpoint أعمال |
| 7 | **CI Checks**: `architecture-boundaries.json` + فاحص الاستيراد | يفشل عند أي كسر |
| 8 | **Tests**: Shared Kernel · الأخطاء · الساعة · مولّد المعرّفات · الإعداد · الإقلاع · **فحص الحدود** | حقيقية وقابلة للتشغيل |
| 9 | التحقق: typecheck · build · tests · boundary check · startup · `/health` | ما لا يتوفر يُسجَّل `NOT AVAILABLE` |
| 10 | `BACKEND_RUNTIME_ARCHITECTURE.md` + `PHASE_1A_IMPLEMENTATION_REPORT.md` | توثيق |

## 5.1 ما لن يُبنى في هذه المرحلة — تعهّد صريح
```
✗ أي جدول أو SQL أو migration            ✗ Wallet · Holds · Accounting · Journal · COA
✗ Transactions · Provider · Pricing       ✗ Commission · Funding · Digital · WiFi
✗ Reconciliation · Reports · Notifications delivery
✗ مصادقة حقيقية · JWT · TOTP · Argon2     ✗ Redis · Queue · Outbox table
✗ أي endpoint أعمال                       ✗ أي قاعدة عمل جديدة
✗ عملة تقرير افتراضية                     ✗ أي قاعدة تعدد مستأجرين في منطق الأعمال
```

---

**لم يُكتب أي كود حتى هذه اللحظة. الملف التالي المُنشأ سيكون أول ملف مشروع.**
