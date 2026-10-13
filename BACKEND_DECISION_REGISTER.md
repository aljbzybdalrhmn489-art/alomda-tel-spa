# BACKEND_DECISION_REGISTER
## ALOMDA TEL · سجل قرارات الـBackend + مصفوفة التتبّع

**المرجع الحاكم:** `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0.md`
**التاريخ:** 2026-09-07

**قاعدة ملزمة:** **لم يُحوَّل أي `OPEN` إلى `FROZEN` من طرفي.** ما هو `FROZEN` هنا مصدره Architecture Freeze حصرًا؛ وما أضفتُه في هذه المرحلة `PROPOSED` أو `OPEN` أو `BACKEND-ONLY`.

### مفاتيح الحالة
| الحالة | المعنى |
|---|---|
| `FROZEN` | محسوم في Architecture Freeze — يُنفَّذ كما هو |
| `OPEN` | **غير محسوم** — لا يُبنى عليه تصميم نهائي |
| `PROPOSED` | اقتراح من هذه المرحلة — ينتظر موافقتكم |
| `BACKEND-ONLY` | قرار تنفيذي داخل الـBackend، لا يمسّ المعمارية المالية |
| `FUTURE` | مؤجل عمدًا خارج نطاق v1 |

---

# 1. القرارات الموروثة من Architecture Freeze

| ID | Decision | Source | Status | Reversible | Impact |
|---|---|---|---|---|---|
| **ADR-101** | عملتان مستقلتان `YER`(جنوب) و`YEO`(شمال) + `SAR` + `USD` · منزلة الريال = 0 · `zone` يحدد العملة · `gateway` بُعد | Freeze §D-01 | **FROZEN** | ❌ | كل عمود مبلغ · `currencies` · `zones` · `fx_rates` |
| **ADR-102** | تخزين `NUMERIC(20,4)` · حساب 4 منازل · ترحيل بمنزلة العملة · `HALF_UP` · Largest Remainder · `ROUNDING-DIFFERENCE` لعملة التقرير فقط | Freeze §D-02 | **FROZEN** | ❌ | كل حساب مالي · محرك العمولة |
| **ADR-103** | COA بثلاثة مستويات هيكلية · ترميز 6 خانات · 24 حسابًا مُرحَّلًا عليه · 8 أبعاد · **لا حساب لأي طرف** | Freeze §D-03 | **FROZEN** | ❌ | `chart_of_accounts` · `journal_entry_lines` · كل تقرير |
| **ADR-104** | الـLedger مصدر الحقيقة الوحيد · Strangler T0→T3 · القطع في T2 · `initialBalance` و`providerAccount.balance` مُلغيان · `WALLET_LEDGER` أرشيف | Freeze §D-04 | **FROZEN** | ❌ | `parties` · `party_wallet_projection` · الترحيل كله |
| **ADR-105** | الحجز **تشغيلي وليس قيدًا** · `Available = Ledger − Held + Credit` · «Reserved» مصطلح مُلغى · لا إفراج زمني للمعلّق | Freeze §D-05 | **FROZEN** | ⚠️ جزئيًا | `wallet_holds` · محرك المعاملة |
| **ADR-106** | **Commission Wallet وحده** · الهامش في التسعير · `COMMISSION-PAYABLE` التزام منفصل · Instant Margin مرفوض كآلية عمولة | Freeze §D-06 | **FROZEN** | ❌ | `commission_*` · محرك التسعير |
| **ADR-107** | آلة حالة المعاملة بـ11 حالة · `SUCCESS ≠ SETTLED` · `TIMEOUT ≠ FAILED` · انتقالات محظورة مفروضة | Freeze §D-07 | **FROZEN** | ⚠️ جزئيًا | `transactions` · `transaction_status_history` |
| **ADR-108** | **4 طبقات Idempotency · 4 مفاتيح · 4 جداول** · `SENT` قبل الاستدعاء · Replay Protection للـWebhook | Freeze §D-08 | **FROZEN** | ❌ | `transactions` · `journal_entries` · `provider_executions` · `provider_webhook_events` |
| **ADR-109** | 7 طرق حسم للغموض · 4 قاطعة · مزوّد بلا طريقة قاطعة = يدوي حصرًا · **ممنوع** Retry/Fallback/إفراج الحجز عند الغموض | Freeze §D-09 | **FROZEN** | ✅ | `providers` · محرك التنفيذ |
| **ADR-110** | `settlement_model ∈ {NET, GROSS_PLUS_COMMISSION}` · System Margin **مشتق لا حساب** · **العكس ينسخ كل الأبعاد** | Freeze §D-10 | **FROZEN** | ❌ | `provider_mappings` · `reverseJournalEntry` |
| **ADR-111** | 9 مراحل تسعير · الأخص يفوز · التكلفة لا تُشتق من السعر · **Margin Guard مرتين** · Price/FX Lock بـ8 حقول | Freeze §D-11 | **FROZEN** | ✅ | `service_pricing` · `transactions.locked_*` |
| **ADR-112** | `parent_id` + `party_closure` · عزل شجري على كل استعلام · لقطة أسلاف لكل معاملة · **منفصلة تمامًا عن COA** | Freeze §D-12 | **FROZEN** | ⚠️ جزئيًا | `parties` · `party_closure` · كل تقرير |
| **ADR-113** | Argon2id · RBAC+ABAC+SoD · Maker/Checker · 2FA · Device Binding · Refresh Rotation · Transaction PIN · **فرض خادمي حصري** | Freeze §D-13 | **FROZEN** | ✅ | كل نطاق D3 |
| **ADR-114** | 4 طبقات مطابقة · تسوية بقيد لا بتعديل · **لا إقفال مع فرق مفتوح** | Freeze §D-14 | **FROZEN** | ✅ | `reconciliation_*` · `accounting_periods` |
| **ADR-115** | Offline: عرض ومسودة فقط · **لا حالة `SUCCESS` محليًا** · الرصيد بختم زمني إلزامي | Freeze §D-15 | **FROZEN** | ✅ | عقد الـAPI · `as_of` |
| **ADR-116** | RPO متدرّج (≈0 للكتابات المالية · ≤30ث لغيرها) · RTO ≤30د · 99.9% · اختبار استرجاع ربع سنوي · **`RPO=0` شامل مرفوض** | Freeze §D-16 | **FROZEN** | ✅ | البنية التحتية |
| **ADR-117** | Trial Balance لكل عملة · MV للقوائم · تصدير Streaming · عزل شجري إلزامي | Freeze §D-17 | **FROZEN** | ✅ | D15 · `export_jobs` |
| **ADR-118** | تدقيق موحّد · append-only · **سلسلة تجزئة** · `reason` إلزامي · لا أسرار في السجل | Freeze §D-18 | **FROZEN** | ❌ | `audit_log` |
| **ADR-119** | **Modular Monolith** + Workers مستقلة · Outbox إلزامي · **ممنوع استدعاء خارجي داخل معاملة DB** | Freeze §A | **FROZEN** | ⚠️ جزئيًا | البنية كلها |

---

# 2. المقترحات المعمارية من هذه المرحلة

| ID | Proposal | Source | Status | Reversible | Impact |
|---|---|---|---|---|---|
| **AP-01** | فصل `Reconciliation` (D14) عن `Reporting` (D15) — الأول يكتب بصلاحية، والثاني **قراءة فقط بالنسبة لكل بيانات مالية** | Design §2.1 · Phase 1.1 §3 | ✅ **ACCEPTED** | ✅ | حدود الـModules · RBAC · API |
| **AP-02** | `Notifications` نطاق مستقل (D16) — **مستهلك Outbox** لا مالك منطق Operations · لا يعدّل حقيقة مالية | Design §2.1 · Phase 1.1 §4 | ✅ **ACCEPTED** | ✅ | حدود الـModules · لا دورة |
| **AP-03** | **Digital Delivery Engine** واحد بدورة حياة مشتركة + Strategy لكل نوع تسليم — بلا دمج مصطنع لقواعد الأعمال | Design §2.1 · REVIEW_V2 §13 · Phase 1.1 §5 | ✅ **ACCEPTED** | ⚠️ | `inventory_*` · D11 |
| **AP-04** | تنفيذ **1K (الأمن) قبل 1E (المحافظ)** · **مع إثبات عدم الدوران**: D3 لا يعتمد على D4 ولا D5 | Design §2.1 · §30 · Phase 1.1 §6 | ✅ **ACCEPTED** | ✅ | ترتيب التنفيذ |

## 2.1 تفاصيل الاعتماد (Phase 1.1)

**`AP-01` — الاستثناء الموثَّق الوحيد:** `D15 Reporting` يملك `export_jobs` (تتبّع مهام تشغيلي، **غير مالي**). لا صلاحية كتابة مالية · لا `POST/PUT/PATCH/DELETE` تحت `/reports` عدا `POST /exports` · أدوار `report:*` لا تحمل أي `*:write` مالي. (`NF-04`)

**`AP-02` — إثبات عدم الدورة:**
```
Domain Event → Outbox → Notification Worker → SMS/Push/WhatsApp/Telegram/In-App
D16 يقرأ Outbox ويكتب في جداوله فقط.
D16 لا يستدعي D12 ولا أي نطاق أعمال ⟹ لا مسار Operations → Notifications → Operations.
الإشعار داخل التطبيق يُقرأ عبر API من جداول D16 نفسها.
```

**`AP-03` — حدود الدمج (بلا دمج مصطنع):**
| مشترك (محرك واحد) | منفصل (Strategy/قواعد خاصة) |
|---|---|
| دورة حياة المخزون: `AVAILABLE → LOCKED → SOLD → USED / EXPIRED / VOID` | قواعد المخزون لكل نوع (تجديد · صلاحية · دفعات) |
| الحجز الذري `FOR UPDATE SKIP LOCKED` + `UNIQUE(locked_by_transaction_id)` جزئي | قواعد التسليم (قناة · تنسيق · إيصال) |
| التشفير AES-256-GCM + فك عند التسليم فقط | قواعد المزوّد (استعلام مسبق · توليد لحظي · تحكّم MikroTik) |
| ربط المعاملة والتسوية | قواعد WiFi (شبكة · مالك · حصة · نافذة إلغاء) |
| `fulfillment_records` | `Subscription` (تجديد · انتهاء) — **`FUTURE`، لم يُصمَّم** |
**النتيجة المُتحقَّقة:** **نسخة واحدة فقط** من مفردات `AVAILABLE/LOCKED/USED/SOLD/EXPIRED` في كل المخطط — لا `pin_vault` ولا `subscription_pins` ولا `wifi_vouchers` كجداول مستقلة.

**`AP-04` — إثبات عدم الدورة:** `D3 Security` يعتمد على `1A` و`1D` فقط. لا يقرأ قيدًا ولا رصيدًا. فحص Maker/Checker يقع في **طبقة التنسيق قبل** استدعاء D4 (`C-01`). `party_risk_metrics` تُغذّى بالأحداث لا بالاستدعاء (`C-02`).

---

# 3. قرارات الـBackend الجديدة

| ID | Decision | Source | Status | Reversible | Impact |
|---|---|---|---|---|---|
| **OPEN-BE-01** | المنصة واللغة — `PROJECT_HANDOFF §8` يذكر Node.js/PostgreSQL؛ Architecture Freeze لم يتناولها | Design §1.3 | **OPEN** | ✅ | لا أثر مالي · يُحسم في 1A |
| **OPEN-BE-02** | **عملة التقرير الأساسية** — الوثائق تفرض «عملة تقرير» ولا تسمّيها | Design §4.4 | **OPEN** 🔴 | ❌ | كل قائمة مالية موحّدة · FX Gain/Loss · **B-2** |
| **OPEN-BE-03** | `ROUNDING-DIFFERENCE` حساب مستقل أم بُعد على FX | Design §5.2 | **OPEN** | ✅ | صف واحد في COA |
| **OPEN-BE-04** | طول الفترة المحاسبية والتقويم | Design §6.5 | **OPEN** | ✅ | `accounting_periods` — `CONFIGURATION` |
| **OPEN-BE-05** | نسبة السماح بالمكشوف مقابل التأمين — «80%» في المصدر **مثال لا سياسة** | Design §7.5 | **OPEN** | ✅ | `credit_limits` — `CONFIGURATION` |
| **OPEN-BE-06** | كل قيم التسعير: `MIN_MARGIN` · `quote_ttl` · `slippage_tolerance_pct` · أسعار الشرائح والخدمات | Design §13 | **OPEN** 🔴 | ✅ | **لا تشغيل للتسعير بلا بيانات** |
| **OPEN-BE-07** | **كل نسب العمولة** — الأرقام في المصادر توضيحية بنصها | Design §14 | **OPEN** 🔴 | ✅ | **لا تشغيل للعمولة بلا بيانات** |
| **OPEN-BE-08** | أنواع العمولات المتقدمة (مقطوعة · حوافز حجم · شرائح تصاعدية) — الجداول تستوعبها، قواعد التفعيل غير محسومة | Design §14.3 | **OPEN** | ✅ | `commission_tiers` |
| **OPEN-BE-09** | تكامل البنوك — `الكريمي والتغذية.docx` **مفقود**؛ لا API ولا حساب ولا بيانات اعتماد | Design §16.4 | **OPEN** 🔴 | ✅ | طبقة المطابقة 3 · التغذية التلقائية |
| **OPEN-BE-10** | بيانات WiFi/MikroTik — `الواي فاي.docx` **مفقود** | Design §18 | **OPEN** | ✅ | `wifi_networks` · `WifiVoucherStrategy` |
| **OPEN-BE-11** | عتبات الاحتيال — المصادر متعارضة (5/60ث مقابل 10/دقيقة) | Design §20 | **OPEN** | ✅ | `party_risk_metrics` — `CONFIGURATION` |
| **OPEN-BE-12** | مدة Access Token — المصادر متعارضة (15د مقابل 60د) | Design §21.2 | **OPEN** | ✅ | `sessions` — `CONFIGURATION` |
| **OPEN-BE-13** | منع `SUPER_ADMIN` من رؤية أرصدة العملاء — Freeze **يوصي بنعم** ويصنّفه محتاجًا لموافقة | Design §21.2 · Freeze §D-13 | **OPEN** | ✅ | RBAC seed · تجربة الإدارة |
| **OPEN-BE-14** | تقنية الطابور المساعدة (Redis/BullMQ) فوق Outbox | Design §24.3 | **PROPOSED** | ✅ | الأداء فقط — Outbox هو الضمان |
| **OPEN-BE-15** | **تعدد المستأجرين (Multi-tenancy)** — غير مذكور في أي مصدر | Schema §العزل | **OPEN** 🔴 | ❌ | **`B-5` أُغلق تنفيذيًا** باعتماد `REC-BE-15` — راجع `RAT-01` في §3.c. **قرار التعدد نفسه ما زال `OPEN`** |
| **OPEN-BE-16** | سياسة الاحتفاظ بالبيانات والأرشفة | Design §22.3 | **OPEN** | ✅ | التقسيم · الأرشفة |
| **BE-17** | REST مُصدَّر بالإصدار · JSON · المبالغ **نصًا لا Number** | API §0 | **PROPOSED** | ✅ | كل عقد API |
| **BE-18** | ترقيم بـCursor — **لا OFFSET على أي جدول مالي** | API §0 | **BACKEND-ONLY** | ✅ | الأداء والاتساق |
| **BE-19** | `READ COMMITTED` + أقفال صريحة · **`SERIALIZABLE` مرفوض** | Design §1.4 | **BACKEND-ONLY** | ✅ | التزامن |
| **BE-20** | UUIDv7 لكل المفاتيح · **لا `SERIAL` على أي كيان مالي** | Schema §0 | **BACKEND-ONLY** | ⚠️ | كل جدول |
| **BE-21** | التقسيم الشهري مُصمَّم من البداية · مُفعَّل عند الحاجة | Schema §التقسيم | **BACKEND-ONLY** | ✅ | 8 جداول |
| **BE-22** | مزوّد `SIMULATOR` **ممنوع** من الربط الإنتاجي — يُفرض بقيد | Design §11.6 | **PROPOSED** | ✅ | `providers` · `provider_mappings` |
| **BE-23** | تنقيح إلزامي (Redaction) لحمولات المزوّد والسجلات بقائمة حظر مركزية | Design §12 · §28.2 | **PROPOSED** | ✅ | `provider_executions` · السجلات |
| **BE-24** | فصل مجرى التدقيق المالي عن التطبيقي بسلسلتَي تجزئة منفصلتين | Design §22.3 | **PROPOSED** | ✅ | `audit_log.stream_key` |
| **BE-25** | تصدير WORM/SIEM: `RECOMMENDED` الآن · **`REQUIRED` قبل التشغيل بأموال العملاء** | Design §22.4 · Freeze §D-18 | **PROPOSED** | ✅ | البنية التحتية |
| **BE-26** | تسليم الخدمة اليدوية: **حجز فقط حتى `COMPLETED`** — لا خصم نهائي مسبق | Design §19.2 | **PROPOSED** | ⚠️ | يصحّح سلوك SPA الحالي |

---

# 3.b تصحيحات Phase 1.1 (NEW FINDINGS)

| ID | Finding | Source | Status | Reversible | Impact |
|---|---|---|---|---|---|
| **NF-01** | **دورة FK حقيقية** `transactions.hold_id` ↔ `wallet_holds.transaction_id` | Phase 1.1 §33 | ✅ **FIXED** | ✅ | حُذف `transactions.hold_id` |
| **NF-02** | **دورة اعتماد** `parties`(D2) → `pricing_groups`(D7) → `zones`(D2) | Phase 1.1 §33 | ✅ **FIXED** | ✅ | جدول جديد `party_pricing_assignments` (D7) + تاريخ الشرائح |
| **NF-03** | **لا جدول يحمل قيم `CONFIGURATION`** (17 موضعًا على الأقل) | Phase 1.1 §33 | ✅ **FIXED** | ✅ | جدول جديد `system_configuration` + Maker/Checker للمالي |
| **NF-04** | `export_jobs` مسار كتابة داخل نطاق «قراءة فقط» | Phase 1.1 §33 | ✅ **CLARIFIED** | ✅ | استثناء موثَّق: غير مالي · بلا صلاحية كتابة مالية |
| **NF-05** | ملكية `financial_accounts` مزدوجة (D5/D6) | Phase 1.1 §33 | ✅ **FIXED** | ✅ | المالك **D6 Funding** |
| **NF-06** | `provider_webhook_events` في نطاق خاطئ (D6) | Phase 1.1 §33 | ✅ **FIXED** | ✅ | المالك **D9 Provider** |
| **NF-07** | تسمية D7 غير متسقة بين الوثائق | Phase 1.1 §33 | ✅ **FIXED** | ✅ | **`D7 Catalog & Pricing`** موحّدة |
| **NF-08** | `party_wallet_projection` يوحي بإنفاق محافظ غير قابلة للإنفاق | Phase 1.1 §33 | ✅ **FIXED** | ✅ | عمود `is_spendable` + الحجز مقصور عليه |
| **NF-09** | `financial_action_logs` / `permission_change_logs` مذكوران في التجميد وغير موجودين | Phase 1.1 §33 | ✅ **DOCUMENTED** | ✅ | دمج مقصود كمجارٍ في `audit_log` — **ليس تعارضًا مع ADR** |
| **C-01** | **تعارض بنيوي:** D4 «لا يستدعي أحدًا» مقابل حاجته لفحص Maker/Checker | Phase 1.1 §2.4 | ✅ **FIXED** | ✅ | الفحص في **طبقة التنسيق قبل** D4 — D4 يستقبل أمرًا مُصرَّحًا به |
| **C-02** | اتجاه `party_risk_metrics` قد يوحي بدورة D3↔D8 | Phase 1.1 §2.4 | ✅ **CLARIFIED** | ✅ | تُغذّى بالأحداث لا بالاستدعاء |
| **C-03** | ملكية `outbox_events` · `approval_requests` · `system_configuration` | Phase 1.1 §2.4 | ✅ **FIXED** | ✅ | Platform / D3 / Platform |

## قرارات جديدة من Phase 1.1

| ID | Decision | Source | Status | Reversible | Impact |
|---|---|---|---|---|---|
| **BE-27** | **نموذج الائتمان في v1:** المعادلة `Available = Ledger − Held + Credit` مجمَّدة (ADR-105) لكن `credit_limit` **افتراضه 0** ودورة **منح** الائتمان `FUTURE` — **لم يُخترع نموذج ائتمان** | Design §7.6 · Phase 1.1 §11 | **PROPOSED** | ✅ | `credit_limits` · `party_financial_limits` |
| **BE-28** | **عملة الطرف immutable بعد أول حركة** — مشتق من ADR-101/118، لا اختراع. التصحيح بقيد تسوية لا بإعادة تسمية | Design §7.7 · Phase 1.1 §9 | **PROPOSED** | ❌ | `parties` · Trigger |
| **BE-29** | **تعدد عملات الطرف عبر Sub-wallets** (صفوف مستقلة في الـProjection) — منصوص عليه في ADR-101 | Design §7.7 | **FROZEN (مشتق)** | ❌ | `party_wallet_projection` |
| **BE-30** | **`gateway.default_currency_code` لا يُستعمل إطلاقًا لاشتقاق عملة قيد** — فحص CI إلزامي | Design §7.7 · Phase 1.1 §9 | **PROPOSED** | ✅ | كل مسار عملة |
| **BE-31** | **`accounting.reporting_currency` immutable بعد أول إقفال فترة** | Design §4.6 | **PROPOSED** | ❌ | `system_configuration` |
| **OPEN-BE-17** | **هل يجوز للطرف الانتماء لأكثر من منطقة (⟹ محفظة بعملة ثانية)؟** — ADR-101 يضع `party → zone` مفردة؛ الشرط التجاري **غير محسوم في أي مصدر** | Design §7.7 | **OPEN** | ✅ | v1: محفظة واحدة · فتح الثانية مسار معطَّل |
| **REC-BE-15** | **توصية `Tenant-Ready, Single-Tenant-Deployed`** — تحفظ الإمكانية بلا فرض التعدد | Design §32 · Phase 1.1 §7 | ✅ **ACCEPTED** (Phase 1C-4B.1) | ✅ | عمود + بادئة فهرس + `stream_key` |

> **`OPEN-BE-15` (تعدد المستأجرين) ما زال `OPEN`.** لم يُحوَّل إلى `FROZEN`. اعتماد `REC-BE-15` في Phase 1C-4B.1 أغلق الحاجز `B-5` **تنفيذيًا** ولم يحسم التعدد نفسه: البنية تصبح Tenant-Ready والتشغيل يبقى Single-Tenant. راجع `RAT-01` في §3.c.

---

# 3.c ترسيم معماري — Phase 1C-4B.1 (DOCUMENTATION ONLY)

**التاريخ:** 2026-09-08
**الطبيعة:** توثيق فقط. **لم يُعدَّل أي كود مصدري ولا أي migration ولا أي قاعدة بيانات** ضمن هذه المرحلة.
**المصدر:** تقرير `PHASE 1C-4B.1 — ARCHITECTURAL RATIFICATION REVIEW` (تحقيق للقراءة فقط) + قرار Project Owner.
**النطاق:** ترسيم القرارات المعلّقة التي كشفتها Phase 1C-4B. **ليست تنفيذًا لـ1C-5.**

| ID | القرار المُرسَّم | المصدر الحاكم | الحالة | Reversible | التنفيذ |
|---|---|---|---|---|---|
| **RAT-01** | **`B-5` مُغلق تنفيذيًا** باعتماد `REC-BE-15`: البنية **Tenant-Ready** · التشغيل **Single-Tenant-Deployed**. `tenant_id` يُعتبر جزءًا من تصميم كل بيانات مالية جديدة حتى لا يصبح إدخاله لاحقًا تغييرًا كاسرًا. **لا سلوك تعدد مستأجرين · لا عزل مستأجرين · لا Tenant domain · لا API/UI للإدارة** | Gate §D `B-5` · Design §32 · Phase 1.1 §7 | ✅ **ACCEPTED** | ✅ | **مؤجَّل إلى 1C-5** — لا migration في 1C-4B.1 |
| **RAT-02** | **W3 = OPTION D.** `journal_entry_lines` هو **المصدر المالي authoritative الوحيد**، ولا يجوز إنشاء مصدر مالي ثانٍ. الاعتماد طويل الأمد على `journal_entry_totals` يُستبدل بآلية **«Trigger: توازن لكل عملة معاملة»** المنصوص عليها في Schema §23 | Schema §23 · Freeze §قواعد الترحيل (3) · ADR-117 | ✅ **ACCEPTED** | ✅ | **مؤجَّل إلى 1C-5** بـmigration آمن — **لا حذف ولا تعديل schema الآن** |
| **RAT-03** | **W4.** كل سطر قيد تاريخي يجب أن يحمل **لقطة ثابتة** لهوية الحساب وقت الترحيل: `account_id` · `account_code` · `account_name`. الغرض: ألّا يؤدي جعل حساب `inactive` لاحقًا إلى فقدان قابلية قراءة التاريخ المحاسبي. **لا حقل إضافي غير هذه الثلاثة** | Freeze §قواعد الترحيل (5) «لقطات ثابتة لاسم ورمز الحساب على السطر» · Schema §24 | ✅ **ACCEPTED** | ❌ | **مؤجَّل إلى 1C-5** — لا migration الآن |
| **RAT-04** | **C-1.** أعمدة عملة التقرير — `reporting_currency_code` · `reporting_debit` · `reporting_credit` · `fx_rate_id` — **تُبنى في مرحلتها وتبقى `NULL`** إلى حين حسم `OPEN-BE-02`. **لا default · لا اختيار عملة · لا حساب عملة تقرير · لا قوائم موحّدة · لا FX reporting** | Design §4.6 «الأعمدة تُبنى وتبقى `NULL`» · Gate §D `B-2` · Freeze §قواعد الترحيل (9) | ✅ **ACCEPTED** | ✅ | **مؤجَّل إلى 1C-5** — لا migration الآن |
| **RAT-05** | **W5 = DEFERRED.** لا تُفرض الآن قاعدة عامة «`party_type` + `party_id` يجب أن يوجدا معًا» على كل سطر قيد، **ولا يُضاف `CHECK` في PostgreSQL**. السبب المُثبَت: الـDomain الحالي يقبل `party_id` بلا `party_type` (مثال `113200 PARTY-RECEIVABLE`)، وإضافة القيد الآن تجعل الـpersistence أشدّ صرامة من الـDomain. القاعدة المؤكدة حاليًا محصورة في **سطور العكس** | Freeze §D-10.5 · Freeze §قواعد الترحيل (7) · ADR-110 | ✅ **ACCEPTED (DEFERRED)** | ✅ | **مرحلة العكس / محرك القيود** |
| **RAT-06** | **W2 — بقية الحقول مؤجَّلة.** لا يُضاف الآن: `entry_number` · `period_id` · `status` · `reversal_of_entry_id` · `reversed_by_entry_id` · `created_by` · `correlation_id`. **ممنوع اختراع قيم `NULL` أو إضافة أعمدة لمجرد إكمال المخطط** | Freeze §D3 · Schema §23 · تقرير 1C-4B.1 §2 | ✅ **ACCEPTED (DEFERRED)** | ✅ | `entry_number` → الترحيل/متطلب محاسبي بشري · `period_id` → الفترات المحاسبية · `status`/روابط العكس → محرك العكس · `created_by` → Identity/Security (`1K`) · `correlation_id` → قرار سياق الطلب/API |
| **RAT-07** | **`chart_of_accounts` · `currencies` · `accounting_periods` لا تُنشأ الآن.** ومصدر الحقيقة النهائي لـ`allowed_dimensions` و`required_dimensions` — بين `frozen-chart-of-accounts.ts` وجداول المرجع المستقبلية — **لم يُحسم**، ويجب أن يدخل **تعريف Phase 1C-5 قبل تنفيذها** | Freeze §D3 · Schema §19/§21/§22 · ADR-103 | ⏸️ **DEFERRED + OPEN** | ✅ | تعريف 1C-5 |
| **RAT-08** | **C-7 / `B-1`.** لا يوجد في المستودع أي دليل على توقيع سجل ADR. يُسجَّل بوصفه **`UNVERIFIED`** ولم يُفترض أنه موقَّع، ولم يُنشأ أي توقيع | Freeze `:4` `FROZEN PENDING SIGN-OFF` · Freeze `:1413` · Freeze `:1469` · Gate §D `B-1` | 🔶 **UNVERIFIED** | — | يخص Project Owner |

## 3.c.1 التزامات مترتبة على `RAT-01` (تدخل نطاق 1C-5)

الجداول الثلاثة التي أنشأتها Phase 1C-4B — `journal_entries` · `journal_entry_lines` · `journal_entry_totals` — أُنشئت **بلا `tenant_id`**، لأن `RAT-01` لم يكن قد اتُّخذ بعد. يترتب على اعتماده:

1. **إضافة `tenant_id`** إلى الجداول المالية الثلاثة في 1C-5.
2. **إعادة تشكيل مفتاح ADR-108 طبقة 2:** القيد القائم `UNIQUE(source_type, source_id)` يصبح `UNIQUE(tenant_id, source_type, source_id)` وفق Design §1328 «كل قيد فريد يصبح مركّبًا».
3. **بادئة `tenant_id`** على فهارس العزل، وفق Design §1327.
4. **نافذة التنفيذ مفتوحة بلا تكلفة بيانات:** قاعدة الإنتاج `alomda_tel` **بلا أي جدول**، و`alomda_tel_test` تحمل بيانات اختبار فقط. التأجيل بعد 1C-5 يرفع التكلفة لأن 1C-5 تضيف مفاتيح أجنبية على هذه الجداول نفسها.

## 3.c.2 انحراف انتقالي مسجَّل (`RAT-02`)

`journal_entry_totals` **ما زال قائمًا** في المخطط الحالي رغم أن `RAT-02` يقرر عدم الاعتماد عليه طويل الأمد. هذا **انحراف انتقالي مقصود ومسجَّل**، سببه أن حذفه يتطلب migration آمنًا مؤجَّلًا إلى 1C-5. حتى ذلك الحين يوجد فعليًا **جدولان يحملان معلومة التوازن**: `journal_entry_lines` (authoritative) و`journal_entry_totals` (مشتق). لا يُبنى أي منطق جديد على الثاني.

## 3.c.3 تعارضات مسجَّلة — **لم تُحسم ولم تُفسَّر بصمت**

| ID | المصدر الأول | المصدر الثاني | التعارض | الحالة |
|---|---|---|---|---|
| **C-3** | `src/shared/types/ids.ts`: «`party_type` + `party_id` are always written together (ADR-103)» | `src/modules/accounting/reference/frozen-chart-of-accounts.ts`: «no source mandates it at account level (Freeze §D-10.5 mandates it on REVERSAL lines)» — ونصّ ADR-103 لا يذكر الاقتران | تعليقان في الكود ينسبان قاعدتين متعارضتين إلى ADR-103 | **OPEN** — `RAT-05` أجّل الفرض ولم يحسم النسبة |
| **C-4** | Schema §0: «`created_at` · `created_by` على كل جدول» · §23 يدرج `correlation_id` | Freeze §D3 `:1039` لا يدرج `correlation_id`؛ ولا يوفّر Domain الحالي (1C-3) أيًّا منهما | `journal_entries` يخالف اصطلاح §0 حاليًا | **OPEN** — `RAT-06` أجّلهما |
| **C-8** | هذا السجل §1: 19 ADR بحالة **`FROZEN`** | Freeze `:1413`: «كل ADR أدناه **`PROPOSED`** — لا شيء معتمد بلا توقيعكم» · Freeze `:4`: `FROZEN PENDING SIGN-OFF` | هل الـADRs **FROZEN** أم **PROPOSED**؟ | **OPEN** — مرتبط بـ`RAT-08`/`B-1` |
| **C-9** | Gate `:5`: «⏸️ AWAITING ARCHITECT SIGN-OFF — **لم يبدأ أي تنفيذ**» · Gate §الحكم: «IMPLEMENTATION: لم يبدأ» | الواقع: `1A` · `1B` · `1C-1` · `1C-2` · `1C-3` · `1C-4A` · `1C-4B` مُنفَّذة ومقبولة | نص البوابة قديم مقابل حالة التنفيذ الفعلية | **OPEN** — لم يُعدَّل نص التوقيع من طرفي |
| **C-10** | `RAT-03` يوجب لقطة `account_id` | `RAT-07` يؤجّل إنشاء `chart_of_accounts` | هل `account_id` **مفتاح أجنبي** إلى `chart_of_accounts` (Schema §24) أم **قيمة لقطة فقط** بلا FK؟ لم يُحسم | **OPEN** — يجب حسمه في تعريف 1C-5 |

**القرار المطلوب من Project Owner:** كل صف أعلاه يحتاج حسمًا صريحًا. لم يُحسم أي منها في هذه المرحلة، ولم يُعدَّل أي مصدر مجمَّد.

## 3.c.4 مراجعة نهائية قبل 1C-5 — `OLD → NEW → REASON`

**التاريخ:** 2026-09-08 · **الطبيعة:** مراجعة معمارية (قراءة/تحليل) · **صفر كود · صفر migration · صفر قاعدة بيانات · صفر تعديل SPA.**
أُعيد تقييم `RAT-01`…`RAT-08` مقابل الـFreeze · Logical Schema · Technical Design · هذا السجل · البوابة · والوثائق التسع في `AlomdaTel DOCX\`.
**لم يُغلق أي قرار من طرفي.** ما هو `REVISED` أدناه **ينتظر تأكيد Project Owner**.

| ID | OLD DECISION | NEW DECISION | REASON | الحالة |
|---|---|---|---|---|
| `RAT-01` | `tenant_id` يُضاف في 1C-5 إلى الجداول الثلاثة | **مُثبَّت مع تدقيق:** يُضاف في 1C-5 · نوعه يطابق `RuntimeConfig.tenantId` القائم منذ 1A · **مصدره البنية التحتية لا النطاق** (المستودع يأخذه من الإعداد؛ `PostedJournalEntry` لا يتغيّر) · ومفتاح ADR-108 ط2 يصبح مركّبًا | مفهوم المستأجر **مُنفَّذ فعلًا** منذ 1A (`TENANT_ID` · `RuntimeConfig.tenantId` · `RequestContextFactory`)، فليس اختراعًا. والـtrigger القائم يمنع `UPDATE`، فالتعبئة اللاحقة على جدول مأهول ممتنعة. الإنتاج **بلا أي صف** الآن ⇒ هذه أرخص لحظة | ✅ **CONFIRMED (مُدقَّق)** |
| `RAT-02` | W3 = Option D — استبدال الاعتماد على `journal_entry_totals` بآلية Schema §23 | **مُثبَّت + تصحيح جوهري:** `CHECK(total_debit = total_credit)` **لا يتحقق من مطابقة الإجماليات للسطور** — هو فحص داخل الصف فقط. الآلية البديلة يجب أن تكون **`CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`** على `journal_entry_lines` تجمع لكل عملة عند `COMMIT` | الحماية المفترضة كانت أضعف مما وُصف: يمكن إدراج سطور مجموعها 100 وإجماليات تقول 50=50 ويمرّ القيد. كما أن الجدول **مُعلَّم append-only وهو مشتق في آن** — وهذا يناقض تعريف `PROJECTION` في Schema §0 («قابل لإعادة البناء») ويجعل الخيار C غير متسق مع التنفيذ الحالي | ✅ **CONFIRMED (مع تصحيح)** |
| `RAT-03` | لقطة ثابتة: `account_id` · `account_code` · `account_name` | **مُضيَّق:** `account_code` (قائم) + **`account_name`** فقط. **`account_id` يُسحب من القرار.** ويُضاف الشق الناقص: **قراءة التاريخ يجب ألّا تشترط أن يكون الحساب قابلًا للترحيل الآن** | Freeze §قواعد الترحيل (5) يوجب لقطة **«اسم ورمز الحساب»** — ولا يذكر معرّفًا. ولا يوجد في النطاق أي معرّف للحساب: لا نوع `AccountId` ولا حقل `id` على `Account`، و`ChartOfAccounts` مُفهرس بالكود. فإضافة `account_id` = **اختراع هوية بلا مصدر**. كما أن اللقطة وحدها **لا تحلّ W4**: الحلّ يكتمل بتعديل مسار إعادة البناء | 🔶 **REVISED — ينتظر تأكيد** |
| `RAT-04` | أعمدة عملة التقرير الأربعة تُبنى في 1C-5 وتبقى `NULL` | **مُقترح تغييره إلى التأجيل الكامل** إلى المرحلة التي تُنفَّذ فيها FX/التقارير ويوجد فيها `fx_rates` | الأعمدة **nullable**، وإضافتها لاحقًا `ALTER TABLE ADD COLUMN` بلا إعادة كتابة وبلا مساس بالـtrigger ⇒ **التكلفة صفر في الحالتين والحالة النهائية متطابقة**. و`fx_rate_id` سيكون مفتاحًا أجنبيًا إلى جدول غير موجود. **تنبيه:** هذا **انحراف عن Design §4.6 و`B-2`** («الأعمدة تُبنى وتبقى `NULL`») ⇒ **قرار Project Owner وحده** | 🔶 **REVISED — ينتظر تأكيد · انحراف عن مصدر أعلى** |
| `RAT-05` | W5 مؤجَّل إلى «مرحلة العكس / محرك القيود» | **مُثبَّت مع تصحيح المالك:** المالك هو **طبقة قاعدة الترحيل في المحاسبة**، والموعد الأقصى **قبل أن تستهلك المحفظة (1E) أرصدة الأطراف** — لا «مرحلة العكس» حصرًا | فهرس Freeze `:1042` لرصيد الطرف يبدأ بـ`party_type`؛ فاختلاطه بين صفوف تحمله وأخرى لا تحمله يمسّ **إسقاط المحفظة** لا العكس فقط. وقرار عدم إضافة `CHECK` الآن صحيح ومؤيَّد بـ`DATABASE_SCHEMA.md §22` | ✅ **CONFIRMED (مع تصحيح المالك)** |
| `RAT-06` | الحقول السبعة مؤجَّلة لمراحلها | **مُثبَّت** — بتصنيف صريح لكل حقل: `entry_number` LATER · `period_id` LATER (تابع لـ`accounting_periods`) · `status` + رابطا العكس LATER · `created_by` LATER (1K) · `correlation_id` LATER | لا يوفّر النطاق (1C-3) أيًّا منها، ولا تحتاجها سلامة 1C-5. `SECURITY.md §24` يفصل سجل التدقيق عن القيد صراحةً ⇒ إسناد الفاعل يخصّ `audit_log` لا `journal_entries` | ✅ **CONFIRMED** |
| `RAT-07` | الجداول الثلاثة لا تُنشأ الآن · ومصدر حقيقة الأبعاد يدخل تعريف 1C-5 | **مُقوّى:** يُوصى بعدم إنشاء `chart_of_accounts` ولا `currencies` ولا `accounting_periods` **في 1C-5 أيضًا** · ويُقترح **إعادة تسمية 1C-5** لأن نطاقها الحقيقي لم يعد «Reference Persistence» | `DATABASE_SCHEMA.md §12/§13/§14` ينهى صراحةً عن إنشائها بلا ضرورة مُثبتة؛ و`currencies` تُزدوج مع `currency-registry.ts` (خطر ADR-102)، و`chart_of_accounts` تُزدوج مع `frozen-chart-of-accounts.ts`، و`accounting_periods` محجوبة بـ`OPEN-BE-04` و`OPEN-BE-02` | 🔶 **REVISED — ينتظر تأكيد** |
| `RAT-08` | `B-1` = `UNVERIFIED` | **مُثبَّت** — ولا يمنع صلاحية `RAT-01`…`RAT-08` لأنها قرارات مالك مباشرة، لكنه يُبقي **تسويغاتها** مستندة إلى ADRs حالتها الشكلية غير مُتحقَّقة | لا دليل توقيع في المستودع، والـFreeze نفسه يصف ADRs بأنها `PROPOSED` | ✅ **CONFIRMED** |

### تعارضات إضافية اكتُشفت في هذه المراجعة

| ID | المصدر الأول | المصدر الثاني | الحالة |
|---|---|---|---|
| **C-11** | `Freeze:6` · `FINAL_ARCHITECTURE:6` · `REVIEW_V2:6` · `FINAL_TRUTH_MATRIX:7` → SHA256 `b7e2b1d1…d549b8` | `Gate:7` · `TECHNICAL_DESIGN:6` · `RUNTIME:7` · الوثائق التسع → `7ffa6517…11fc1` (وهي بصمة الملف الفعلي) | **مُفسَّر:** `SPA_LOGIC_CORRECTION_AUDIT.md:5` و`REPORT §A/B` يثبتان أن `b7e2…` هي بصمة **ما قبل التصحيح** و`7ffa…` **ما بعده** (+223 سطرًا). أي **انزياح إصدار لا تناقض**. يبقى مطلوبًا تعليق توضيحي في الـFreeze — **ولم أعدّله** |
| **C-12** | `DATABASE_SCHEMA.md §9` · `ARCHITECTURE.md §W3` · `CURRENT_STATUS.md §W3` (02:12): W3 ما زال `OPEN` | `§3.c` · `RAT-02` (02:06): W3 مُرسَّم | **مزامنة وثائق:** الوثائق التسع تصف حالة **ما قبل** الترسيم (`ROADMAP §13` يصف 1C-4B.1 بأنها `READY FOR RATIFICATION`). تحتاج تحديثًا بعد تأكيد المالك |
| **C-17** | `DATABASE_SCHEMA.md §21`: «Do not solve it by adding account snapshots, account names, or account IDs **without explicit architectural approval**» | `RAT-03` أوجب اللقطة الثلاثية | الموافقة الصريحة **مُنحت** في تكليف الترسيم؛ لكن المراجعة تُضيّق النطاق إلى `account_name` فقط — راجع `RAT-03` أعلاه |
| **C-18** | `ROADMAP.md §14`: نطاق 1C-5 = currencies · chart_of_accounts · periods · … | `RAT-01`/`RAT-03`/`RAT-04` أسندت التزامات مختلفة تمامًا إلى 1C-5 | **نطاق 1C-5 في الخارطة لم يعد مطابقًا** لما تفرضه القرارات — راجع `RAT-07` |
| **C-19** | `TESTING_STRATEGY.md §17`: اختبارات الاستمرارية يجب أن تتحقق من «journal totals» | `RAT-02` (Option D) يحذف جدول الإجماليات | البند يحتاج إعادة صياغة إلى «التحقق من قيد التوازن لكل عملة» بدل «جدول الإجماليات» |
| **C-20** | `ARCHITECTURE.md:9` و`DATABASE_SCHEMA.md` يحيلان إلى `PROJECT_OVERVIEW.md` | الموجود `PROJECT_OVERVIEW_UPDATED.md` فقط | إحالة إلى ملف غير موجود — **لم أُعد التسمية ولم أحذف** |

---

## 3.c.5 الترسيم النهائي — Phase 1C-4B.1 · **CLOSED**

**التاريخ:** 2026-09-08 · **القرار:** Project Owner · **الطبيعة:** توثيق فقط — صفر كود · صفر migration · صفر قاعدة بيانات · صفر SPA.
هذه هي **النسخة المعتمدة النهائية**. ما ورد في §3.c و§3.c.4 يُقرأ عبرها.

### القرارات النهائية

| ID | القرار النهائي المعتمد | الحالة |
|---|---|---|
| `FIN-01` **B-5 / Tenant** | `REC-BE-15` — Tenant-Ready · Single-Tenant-Deployed. **`tenant_id TEXT`** متوافق مع `RuntimeConfig.tenantId`. القيمة تدخل **من البنية التحتية/التشغيل حصرًا** ولا تُؤخذ من مُدخل مستخدم. لا سلوك تعدد · لا إدارة مستأجرين · لا عزل SaaS. **عقد نطاق القيد لا يتغيّر بسبب المستأجر** | ✅ **RATIFIED** |
| `FIN-02` **account_id** | **`DEFERRED`** — لا يُضاف في 1C-5، ولا يُنشأ `chart_of_accounts`، ولا يُولَّد UUID للحسابات، ولا يُخترع مصدر معرّف، ولا FK إلى جدول غير موجود. **ولا تُحذف الفكرة من التصميم المستقبلي**: تُعاد دراستها كاملة عند تنفيذ Account Lifecycle / COA Persistence | ✅ **RATIFIED** |
| `FIN-03` **لقطة الحساب** | `account_code` (قائم) + **`account_name`** (يُضاف في 1C-5). **لا حقول لقطة أخرى** | ✅ **RATIFIED** |
| `FIN-04` **القراءة التاريخية** | المبدأ معتمد: **Historical Read ≠ Current Posting Validation**. الخيار (i) `ChartOfAccounts.requireForHistoricalRead(code)` — **لكن التنفيذ مُعلَّق**: راجع `H-01` أدناه | ⏸️ **PRINCIPLE RATIFIED · IMPLEMENTATION HELD** |
| `FIN-05` **W3** | **`journal_entry_lines` = Financial Source of Truth.** `journal_entry_totals` ليس مصدرًا ماليًا مستقلًا ويُزال في 1C-5. البديل: `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` يتحقق أن مجموع المدين = مجموع الدائن **لكل عملة لكل قيد** عند نهاية المعاملة. لا فترة انتقالية بمصدرين | ✅ **RATIFIED** |
| `FIN-06` **عملة التقرير** | **`DEFERRED`** — لا تُضاف الأعمدة الأربعة في 1C-5. مُسجَّل كـ**`INTENTIONAL SCOPE CHANGE`**. راجع `H-02` | ✅ **RATIFIED · انحراف مُعلَن** |
| `FIN-07` **الجداول المرجعية** | لا `chart_of_accounts` ولا `currencies` ولا `accounting_periods` ولا `close_period` ولا دورة حياة فترة/حساب ولا استمرارية مرجع عملات في 1C-5 | ✅ **RATIFIED** |
| `FIN-08` **W5** | لا `CHECK` عام لاقتران `party_type + party_id`. قاعدة نسخ الأبعاد في العكس تبقى. **المالك: Accounting Posting Rule** لا محرك العكس وحده. يُحسم قبل أي مرحلة تستهلك أرصدة/إسقاطات محفظة الطرف | ✅ **RATIFIED** |
| `FIN-09` **W2** | `entry_number` · `period_id` · `status` · `reversal_of_entry_id` · `reversed_by_entry_id` · `created_by` · `correlation_id` = **LATER** · `account_name` = **1C-5 MUST** · `account_id` = **DEFERRED**. **لا يُضاف أي حقل `LATER` ولو nullable** | ✅ **RATIFIED** |
| `FIN-10` **اسم المرحلة** | **`PHASE 1C-5 — ACCOUNTING PERSISTENCE CORRECTIONS`** (وليس Accounting Reference Persistence) | ✅ **RATIFIED** |
| `FIN-11` **ADR sign-off** | الحالة `PROPOSED / FROZEN PENDING SIGN-OFF` تبقى موثقة كما هي. لا توقيع وهمي. قرارات `RAT`/`FIN` قرارات تشغيلية للمشروع **بشرط ألّا تتعارض مع الـFreeze؛ وعند التعارض: Freeze wins until explicitly amended** | ✅ **RATIFIED** |

### `OLD → NEW → REASON` — ما تغيّر عن `RAT-01`…`RAT-08`

| ID | OLD | NEW | REASON | الأثر على 1C-5 |
|---|---|---|---|---|
| `RAT-01` → `FIN-01` | `tenant_id` بنوع غير محدد | **`TEXT`** مطابق لـ`RuntimeConfig.tenantId` · المصدر البنية التحتية · idempotency تصبح tenant-aware | تجنّب تغيير عقد 1A إلى `UUID` · ومنع أخذ المستأجر من مُدخل المستخدم | `MUST A` + `MUST D` |
| `RAT-03` → `FIN-02` + `FIN-03` | لقطة ثلاثية تشمل `account_id` | لقطة `account_code` + `account_name` · و`account_id` = **`DEFERRED`** لا **`NOT NEEDED`** | لا مصدر لقيمة المعرّف اليوم، لكن Freeze §D3 وSchema §24 يحتفظان به في التصميم المستقبلي ⇒ التأجيل أدق من الإلغاء | `MUST B` |
| `RAT-03` → `FIN-04` | مسار القراءة التاريخية ضمن نفس القرار | مبدأ معتمد · **تنفيذه مُعلَّق** لاكتشاف أنه يتجاوز التغيير المتوقع | راجع `H-01` | **خارج نطاق 1C-5 حاليًا** |
| `RAT-04` → `FIN-06` | الأعمدة الأربعة تُبنى `NULL` في 1C-5 | **تأجيل كامل** · مُسجَّل `INTENTIONAL SCOPE CHANGE` | لا عملة تقرير مختارة · لا `fx_rates` · الأعمدة nullable تُضاف لاحقًا بلا تكلفة | **خارج النطاق** |
| `RAT-07` → `FIN-07` + `FIN-10` | «لا تُنشأ الآن» + سؤال سلطة الأبعاد مفتوح | لا تُنشأ في 1C-5 أيضًا · وإعادة تسمية المرحلة | منع مصدر حقيقة ثانٍ بجانب `frozen-chart-of-accounts.ts` و`currency-registry.ts` | يُقلّص نطاق 1C-5 إلى تصحيحات |

### نقاط أوقفتُها ولم أنفّذها — تحتاج قرارًا

| ID | النقطة | المشكلة المُثبتة | البديل المقترح |
|---|---|---|---|
| **H-01** | البند 4/15.E — القراءة التاريخية بالخيار (i) | **الخيار (i) وحده لا يكفي.** `AccountingLine.create` يرفض بشكل مستقل `!isLeaf \|\| !isPostable` ثم `!isActive`، و`buildLine` في 1C-2 ينادي `AccountingLine.create({ account: coa.requirePostable(...) })`. أي أن المسار يحتاج تعديل **ملفين مجمَّدين من 1C-1** (`chart-of-accounts.ts` **و** `accounting-line.ts`) لا ملفًا واحدًا | إخراج `E` من نطاق 1C-5 وتحويلها إلى قرار مستقل بين: (i-a) مسار بناء تاريخي على `AccountingLine` أيضًا · (i-b) القراءة التاريخية تُرجع `JournalEntryRecord` بلا تحويل لكائن نطاق · (i-c) نموذج قراءة منفصل. **الأثر التشغيلي للتأجيل = صفر** لأنه لا توجد آلية تعطيل حسابات اليوم |
| **H-02** | `FIN-06` مقابل الـFreeze | Design §4.6 و`B-2` يقولان «الأعمدة تُبنى وتبقى `NULL`» — وهذه وثيقة تصميم. لكن **Freeze §قواعد الترحيل (9)** («ازدواج العملة: كل سطر يحمل عملة المعاملة **و** عملة التقرير مع `fx_rate_id`») **داخل وثيقة التجميد نفسها**. وبند 13 يقول: *Freeze wins until explicitly amended* | التأجيل يُبقي المخطط **غير مطابق للقاعدة 9** لمدة أطول. مطلوب أحدهما: (أ) تعديل صريح للـFreeze، أو (ب) قبول مُعلَن بأن المخطط غير مطابق للقاعدة 9 حتى مرحلة FX. **لم أعدّل الـFreeze** |
| **H-03** | تصنيف خطأ الـtrigger المؤجَّل | `PostgresUnitOfWork` يحوّل أي فشل عند `COMMIT` إلى `AppError('INTERNAL_ERROR', 'Transaction commit failed.')`. فمخالفة توازن يرفعها trigger مؤجَّل ستظهر **`INTERNAL_ERROR`** لا `JOURNAL_NOT_BALANCED` | تعديل صغير في `pg-unit-of-work.ts` (ملف 1C-4A) لتمرير SQLSTATE، أو قبول التصنيف الخشن. **قرار مطلوب قبل كتابة الاختبارات** |

---

# 3.d قرارات Phase 1K — الأمن والتدقيق

## 3.d.1 استمرارية التدقيق — Phase 1K-9 · **CLOSED**

**التاريخ:** 2026-09-08 · **القرار:** Project Owner · **النطاق:** `audit_log` وحده.

| ID | القرار المعتمد | الحالة |
|---|---|---|
| `SEC-01` **`audit_log.target_id` = `TEXT`** | `Freeze §D-18` يكتب `target_type / target_id` كـ`text / UUID`. **يُعتمد `TEXT`.** السبب: الحفاظ على عقد `AuditRecord` المعتمد في **Phase 1K-4**، حيث `targetId: string` مبهم عمدًا — والهدف ليس مضمونًا أن يكون UUID: العقد والاختبارات المقبولة تتضمن معرّفات مثل **`'410100'`** (رمز حساب). عمود `UUID` كان سيرفض هذا السجل، **ورفض كتابة تدقيق يعني إمّا فعلًا يمضي بلا تدقيق أو تراجع معاملة كاملة**. النوع الأوسع يقبل كل UUID يسمح به النص المجمّد ولا يرفض شيئًا كان يقبله. **لا يُغيَّر `AuditRecord` إلى UUID، ولا يُعاد فتح 1K-4** | ✅ **RATIFIED** |
| `SEC-02` **الفاعل طرف لا مستخدم** | `actor_party_id` / `on_behalf_of_party_id` مفتاحان أجنبيان مركّبان إلى `parties (tenant_id, id)` كما يجمّد `§D-18`. **الأثر:** `audit_log` لا يعتمد على `users` إطلاقًا، وهو ما أتاح تنفيذه قبل حسم `users.status` | ✅ **RATIFIED** |
| `SEC-03` **`device_id` بلا مفتاح أجنبي** | `§D-18` يكتبه `FK · nullable`، و`trusted_devices` غير موجود وخارج النطاق. يُخزَّن `UUID` بلا قيد — نفس خيار `zone_code` في `FIN-07`: **يُضاف المفتاح عند إنشاء جدوله، ولا يُخترع جدول ليوجد مفتاح** | ✅ **RATIFIED** |
| `SEC-04` **`UNIQUE (tenant_id, stream_key, previous_hash)`** | مشتقّ مباشرةً من `§D-18`: «سلسلة تجزئة لكل مجرى». صفّان يدّعيان السلف نفسه = تفرّع لا سلسلة، وفحص دوري يقرأ فرعًا واحدًا سيعلن التاريخ سليمًا بينما الفرع الآخر بلا فحص. القيد يجعل التفرّع **غير قابل للكتابة** لا مجرد قابل للاكتشاف | ✅ **RATIFIED** |
| `SEC-05` **`requires_reason` لا يُخزَّن** | مُدخَل تحقّق لا واقعة مُسجَّلة: يقرّر هل يجوز لـ`create` رفض سجل بلا سبب، وهو **خارج الحمولة المُجزَّأة**، والالتزام حُسم لحظة الكتابة. تخزينه كان سيضيف عمودًا ليس في `§D-18` | ✅ **RATIFIED** |

**خارج نطاق 1K-9 بقرار:** التقسيم الشهري (`§D-18` يصممه ويُفعّله «عند الحاجة» — نفس قراءة 1C-4B لـ`journal_entry_lines`) · سياسة الاحتفاظ · تصدير WORM/SIEM الموقَّع لجذر السلسلة (`RECOMMENDED` الآن، `REQUIRED` قبل أموال العملاء الحقيقية) · وظيفة الفحص الدوري.

---

## 3.d.2 حالة هوية الدخول — `users.status` · **CLOSED**

**التاريخ:** 2026-09-08 · **القرار:** Project Owner · **الطبيعة:** حسم بوابة كانت معلّقة منذ **Phase 1K-6**.

**الفجوة التي سبق إثباتها:** `users.status` يظهر **مرة واحدة** في كل Project Knowledge — `POSTGRESQL_LOGICAL_SCHEMA §6` — **بلا أي تعداد قيم**، بينما تُعدَّد كل حالة أخرى في نفس الوثيقة (`§2` · `§16` · `§19` · `§22` · `§23`). ولا يوجد في أي مصدر: قاعدة تربط حالة المستخدم بـ`parties.status`، ولا فعل «تعطيل حساب مستخدم»، ولا ذكر للبند ضمن `SECURITY.md §68`. القيم `('ACTIVE','SUSPENDED','BLOCKED')` الواردة في `العملاء والوكلاء.docx` تخصّ جدول `users` **القديم الموحّد** الذي فكّكه `MIGRATION_DESIGN §94` إلى `parties` + `users`، ودلالتها انتقلت بالكامل إلى `parties.status`.

| ID | القرار المعتمد | الحالة |
|---|---|---|
| `SEC-06` **`users.status`** | `users.status` = **حالة هوية الدخول**، لا الحالة التجارية للطرف. القيم المعتمدة **حصرًا**: **`ACTIVE`** · **`DISABLED`** | ✅ **RATIFIED** |

### القواعد المُلزِمة

1. **`ACTIVE`** = هوية الدخول مفعّلة، ويمكنها اجتياز شرط حالة الهوية في المصادقة.
2. **`DISABLED`** = هوية الدخول معطّلة إداريًا، **ولا يجوز لها تسجيل الدخول**.
3. **لا `LOCKED`.** القفل المؤقت قائم أصلًا عبر `locked_until` + `failed_attempts` (مُنفَّذ في 1K-6). حالة ثالثة تعني آليتين لنفس المنع.
4. **لا إعادة استخدام لـ`parties.status`.**
5. `users.status` و`parties.status` **حالتان مستقلتان**.
6. **لا يُستنتج من `parties.status` أي أثر على المصادقة أو التفويض.** أثر حالة الطرف على الدخول **قرار منفصل** إن احتجناه لاحقًا.
7. **لا تُنشأ أي قيمة أخرى** لـ`users.status`.
8. المخطط يفرض **`NOT NULL` + `CHECK`** على القيمتين فقط.

### الأثر على 1K-6

`UserAccount` كان يترك `status` غائبًا عمدًا وموثّقًا كبند مفتوح («لا مصدر يُعدِّد قيمه»). `SEC-06` يرفع المانع، فيُستكمل الحقل بقيمه المعتمدة. **هذا استكمال لحقل مؤجَّل صراحةً، لا إعادة فتح لقرار مقبول:** `AUTHENTICATION_OUTCOMES` لا يتغيّر، وحساب `DISABLED` يُرفض بالنتيجة `FAILED` القائمة نفسها — إذ إن `BACKEND_API_CONTRACT §112` يمنع أي جواب يكشف أي الشرطين تخلّف، ونتيجة رابعة كانت ستصبح أداة تعداد حسابات.

---

## 3.d.3 استمرارية بيانات الاعتماد — `credentials` · **CLOSED**

**التاريخ:** 2026-09-08 · **القرار:** Project Owner · **الطبيعة:** حسم بوابتَي `§7`.

**الفجوتان المُثبتتان قبل الحسم:** `algo_params` يظهر **مرة واحدة** في Project Knowledge كلّه (`POSTGRESQL_LOGICAL_SCHEMA §7`) بلا نوع ولا بنية ولا قيم؛ و`§7` — وحده بين جداول المخطط — **بلا سطر «قيود»**، فلا فرادة معلنة.

| ID | القرار المعتمد | الحالة |
|---|---|---|
| `SEC-07` **`algo_params`** | **`JSONB NULL`** — metadata تشغيلية اختيارية فقط، وليس مصدر حقيقة | ✅ **RATIFIED** |
| `SEC-08` **الفرادة** | **`UNIQUE (tenant_id, user_id, kind)`** — لا يملك المستخدم أكثر من بيان اعتماد من النوع نفسه داخل المستأجر نفسه، وإلا صار اختيار الصحيح غامضًا | ✅ **RATIFIED** |

### قواعد `SEC-07` المُلزِمة

1. **`hash` هو مصدر الحقيقة الوحيد** لـArgon2id ومعاملات PHC والملح.
2. `algo_params` **metadata تشغيلية اختيارية** فقط.
3. **لا يحتوي** password أو PIN أو secret أو key أو salt أو pepper.
4. **لا يُكرَّر داخله** أي من معاملات Argon2id الموجودة أصلًا في PHC — `m` · `t` · `p` · الملح.
5. إذا لم توجد metadata إضافية فعلية **يبقى `NULL`**.
6. **لا تُخترع بنية داخلية** له ولا أسماء مفاتيح لم تذكرها الوثائق.
7. **لا يصير مصدر حقيقة بديلًا عن `hash`.**
8. حارس في طبقة التطبيق/الـmapper يمنع تمرير أسرار إليه، **مع اختبار** — ولا يُعتمد على `CHECK` SQL معقّد مبنيّ على بنية غير معتمدة.

### لماذا لم يُلغَ العمود رغم التكرار الظاهر

سلسلة PHC `$argon2id$v=19$m=…,t=…,p=…$salt$hash` تحمل المعاملات والملح داخلها، فكان الاحتمال أن يصير `algo_params` مصدر حقيقة ثانيًا — وهو ما رفضه `FIN-05` و`FIN-07` في سياقات أخرى. `SEC-07` يحسمها بالقاعدتين 1 و7: العمود يبقى كما يجمّده `§7`، لكنه **لا يُقرأ لاستخراج معامل**، والقاعدة 4 تمنع أن يحمل نسخة منه أصلًا.

---

## 3.d.4 استمرارية الجلسات — `sessions` · **CLOSED**

**التاريخ:** 2026-09-08 · **القرار:** Project Owner · **الطبيعة:** حسم بوابتَي `§8`.

**الفجوتان المُثبتتان قبل الحسم:** `§8` هو **الجدول الأمني الوحيد بلا سطر «قيود»** إطلاقًا — لا فرادة معلنة، مع أن نموذج 1K-5 المقبول يقوم على «الأحدث وحده حيّ»؛ و`§8` **لا يضع علامة `FK` على أي عمود**، بخلاف `§6` (`party_id FK`) و`§7` (`user_id FK`) و`Freeze §D-18` (`device_id | FK · nullable`) — أي أن الوثيقة تُعلّم المفاتيح حيث تقصدها.

| ID | القرار المعتمد | الحالة |
|---|---|---|
| `SEC-09` **فرادة الجيل** | **`UNIQUE (tenant_id, refresh_family_id, refresh_generation)`** — قيد صحّة يضمن أن كل جيل داخل العائلة والمستأجر فريد، فلا يصير تحديد الجلسة الحالية بأعلى `refresh_generation` غامضًا (عقد 1K-5) | ✅ **RATIFIED** |
| `SEC-10` **`sessions.device_id`** | **`UUID NULL` بلا مفتاح أجنبي** إلى `trusted_devices` في هذه المرحلة. `§8` لا يفرض FK عليه، وتصميم `trusted_devices` ودورة حياة ربط الجهاز ما زالا مفتوحين (`SECURITY.md §8` و§68). **قرار تأجيل للربط، لا إلغاء لـ`trusted_devices`** | ✅ **RATIFIED** |

### لماذا `SEC-10` قرار مستقل عن `SEC-03`

`SEC-03` نطاقه `audit_log.device_id` وحده، حيث كان `§D-18` يكتبه `FK` صراحةً فاحتاج الأمر استثناءً مُصدَّقًا. في `§8` **لا توجد علامة `FK` أصلًا**، فالتخزين بلا قيد لا يخالف نصًّا — لكن القرار يُسجَّل صراحةً بدل الاتّكاء على سابقة نطاقها مختلف.

### ما لا يُقيَّد في هذا الجدول، ولماذا

- **`revoke_reason`** — بلا `CHECK`. النطاق يُنتج قيمتين لأنهما نتيجتا الآلية (`REFRESH_ROTATED` · `REFRESH_REUSE_DETECTED`)، وأي سبب آخر يورّده المتصل. **القائمة غير مجمّدة.**
- **مدد الجلسة** — `OPEN-BE-12` يترك مدة Access Token مفتوحة (15د مقابل 60د). **لا `DEFAULT` ولا `INTERVAL` ولا حساب انتهاء في SQL**؛ المتصل يورّد `expires_at`.
- **`refresh_token_hash`** — `§8` لا يحمل عمود رمز إطلاقًا. توليد الرمز وصيغته وتجزئته بنية تحتية، **ولا عمود لها**.
- **`created_at` · `updated_at` · `last_seen_at`** — غير مذكورة في `§8`.
- **أثر `users.status = DISABLED` على جلسة قائمة** — **غير محسوم**، ولا قاعدة تُشتقّ منه.

---

# 4. الحالات الموروثة من Phase 0.5 (مغلقة — للتتبّع فقط)

| ID | ما حدث | الحالة |
|---|---|---|
| P05-1 | `reverseJournalEntry` أصبح ينسخ الأبعاد | ✅ مُصلَح في SPA · **يجب ألا يُعاد إنتاج الخلل في Backend** (ADR-110) |
| P05-2 | حارس كفاية الرصيد على 8 مواقع استدعاء | ✅ مُصلَح · يُستبدل بـ`Available` في Backend |
| P05-3 | `initialBalance` مُلغى | ✅ · **لا حقل رصيد افتتاحي في أي API** |
| P05-4 | `ownerEntity.balance` توقف تحويره | ✅ · يصبح `WIFI-OWNER-SHARE-EXPENSE` |
| P05-5 | 5 مسارات محاكاة أصبحت صريحة | ✅ · تُستبدل بتنفيذ حقيقي في 1G |
| P05-6 | `createFinancialAccount` لا ينشئ COA تلقائيًا | ✅ · يصبح `BANK` + بُعد |

---

# 5. TRACEABILITY MATRIX (§37)

| ADR | Domain | Database Entity | API | Worker | Accounting Effect | Audit | Reconciliation |
|---|---|---|---|---|---|---|---|
| **ADR-101** | D1 · D4 | `currencies` · `zones` · `fx_rates` | `GET /pricing/catalog` · كل استجابة مبلغ | — | عملة كل سطر قيد | `pricing_change_logs` | طبقة 1 لكل عملة |
| **ADR-102** | D1 · D4 · D10 | `currencies.rounding_scale` · `transaction_commission_lines` | `POST /pricing/quote` | `commission-settlement` | تقريب عند الترحيل · `ROUNDING-DIFFERENCE` | `financial` stream | فروق تقريب تحت العتبة |
| **ADR-103** | D4 | `chart_of_accounts` · `journal_entry_lines` (8 أبعاد) | `GET /accounting/accounts` | — | كل قيد | تغييرات COA | كل الطبقات بالبُعد |
| **ADR-104** | D5 | `party_wallet_projection` · `wallet_holds` · `legacy_wallet_ledger` · `parties` (**بلا balance**) | `GET /wallet/balance` | `projection-rebuild` | `PARTY-WALLET-LIABILITY` | كل تعديل رصيد | **طبقة 1** Wallet↔Ledger |
| **ADR-105** | D5 · D8 | `wallet_holds` · `credit_limits` | `GET /wallet/holds` · `POST /transactions` | `provider-status-poll` | **لا قيد للحجز** | إنشاء/إفراج الحجز | Held يُفصح ولا يُطابق |
| **ADR-106** | D10 | `commission_policies` · `commission_accruals` · `transaction_commission_lines` | `/commission/*` | `commission-settlement` | `COMMISSION-EXPENSE` → `COMMISSION-PAYABLE` | تسوية · عكس | **طبقة 4** Commission↔Ledger |
| **ADR-107** | D8 | `transactions` · `transaction_status_history` | `POST /transactions` · `GET /{id}` | `provider-execution` · `settlement` | القيود عند `SETTLED` فقط | كل انتقال حالة | طبقة 2 |
| **ADR-108** | D8 · D4 · D9 | `transactions.client_ref` · `journal_entries(source)` · `provider_executions` · `provider_webhook_events` | `Idempotency-Key` · `/webhooks/*` | `provider-execution` | قيد واحد لكل مصدر | تعارض Idempotency | طبقة 2 |
| **ADR-109** | D9 | `providers.capabilities` · `provider_executions` | `POST /transactions/{id}/resolve` | `provider-status-poll` | لا قيد حتى الحسم | حسم يدوي + دليل | **طبقة 2** Txn↔Provider |
| **ADR-110** | D9 · D4 | `provider_mappings.settlement_model` · `journal_entry_lines` | `PUT /providers/mappings` | `settlement` | القيود (1)(2)(3) · **العكس بالأبعاد** | عكس القيد | طبقة 2 |
| **ADR-111** | D7 | `service_pricing` · `pricing_overrides` · `transactions.locked_*` | `POST /pricing/quote` | — | `SERVICE-REVENUE` بالسعر المقفل | `pricing_change_logs` | ربحية |
| **ADR-112** | D2 | `parties` · `party_closure` · `ancestor_chain_snapshot` | كل استجابة تمسّ طرفًا | — | بُعد `party_id` | نقل شجري | عزل التقارير |
| **ADR-113** | D3 | `users` · `credentials` · `sessions` · `approval_requests` · `access_constraints` | كل endpoint | `risk` | يحكم من يرحّل | `security` stream | يحكم من يحسم الفروق |
| **ADR-114** | D14 | `reconciliation_*` · `financial_discrepancies` · `accounting_periods` | `/admin/reconciliation` | `reconciliation` | **قيد تسوية لا تعديل** | كل فرق وحسمه | **الطبقات الأربع** |
| **ADR-115** | API | `transactions.client_ref` | `as_of` في كل رصيد | — | لا أثر محلي | مزامنة المسودات | — |
| **ADR-116** | Infra | كل الجداول | — | كل الـWorkers | استرجاع idempotent بـ`client_ref` | استمرارية السلسلة | بعد الاسترجاع |
| **ADR-117** | D15 | MVs + `export_jobs` | `/reports/*` | `reports-export` | قراءة من الـLedger حصرًا | كل تصدير | تقارير المطابقة |
| **ADR-118** | D3 | `audit_log` (hash chain) | `GET /admin/audit` | — | كل حركة مالية مُدقَّقة | **هو نفسه** | فحص السلسلة |
| **ADR-119** | كل النطاقات | `outbox_events` | كل POST مالي | كل الـWorkers | **لا استدعاء داخل معاملة** | حدث Outbox | إعادة إرسال آمنة |

## 5.1 مسار تتبّع كامل — مثال حي
```
ADR-104 (الـLedger مصدر الحقيقة)
   → D5 Wallet
      → party_wallet_projection  (Projection · لا سلطة)
         ← يُكتب من محدِّث الـProjection داخل معاملة القيد
      → wallet_holds             (تشغيلي · لا قيد)
   → D8 Transaction
      → transactions.status = SETTLED
         → journal_entries + journal_entry_lines   [PARTY-WALLET-LIABILITY, party_id]
            → audit_log (stream=financial · reason · hash chain)
               → reconciliation طبقة 1: Projection ↔ Σ(credit−debit)
                  → فرق ⟹ financial_discrepancy (OPEN)
                     → يمنع accounting_periods.close
                        → يُحسم بقيد تسوية + Maker/Checker
                           → audit_log مرة أخرى
```

---

# 6. مصفوفة الحواجز

| # | Blocker | يمنع | لا يمنع | المطلوب |
|---|---|---|---|---|
| **B-1** | توقيع سجل ADR | بدء 1C وما بعده | 1A · 1B | موافقة على الثمانية غير القابلة للرجوع — 🔶 **`UNVERIFIED`** (`RAT-08`): لا دليل توقيع في المستودع |
| **B-2** | عملة التقرير (`OPEN-BE-02`) | إقفال أول فترة · القوائم الموحّدة | بناء 1B/1C (الأعمدة تُترك فارغة) | `YER` أو `USD` — **ما زال مفتوحًا** · الأعمدة تُبنى `NULL` بموجب `RAT-04` |
| **B-3** | إعلان عملة لكل طرف | **T1 · الأرصدة الافتتاحية** | 1A…1L | جدول (طرف ← عملة) |
| **B-4** | الامتثال السعودي | نطاق السعودية | النواة | رأي قانوني |
| **B-5** | تعدد المستأجرين (`OPEN-BE-15`) | **1C إن كان مطلوبًا** | لا شيء إن كان مستأجرًا واحدًا | ✅ **مُغلق تنفيذيًا** في Phase 1C-4B.1 باعتماد `REC-BE-15` (`RAT-01`) — و`OPEN-BE-15` نفسه ما زال `OPEN` |

> **`B-5` جديد في هذه المرحلة** — إضافة `tenant_id` بعد بناء المخطط تغيير كاسر لكل جدول وكل فهرس وكل استعلام عزل. **يجب حسمه قبل أول جدول.**
>
> **تحديث Phase 1C-4B.1:** `B-5` أُغلق تنفيذيًا باعتماد `REC-BE-15`. لكن Phase 1C-4B كانت قد أنشأت **أول ثلاثة جداول مالية بلا `tenant_id`** قبل هذا الاعتماد، فصار الإدخال التزامًا على 1C-5 لا شرطًا مسبقًا — راجع §3.c.1. **لم يُنفَّذ أي migration في 1C-4B.1.**

---

# 7. الخلاصة

| البند | العدد |
|---|---|
| قرارات `FROZEN` موروثة | **19** (ADR-101…119) |
| مقترحات معمارية `PROPOSED` | **4** (AP-01…04) |
| قرارات Backend جديدة | **26** (OPEN-BE-01…16 · BE-17…26) |
| منها `OPEN` | **16** — 5 منها حرجة 🔴 |
| منها `PROPOSED` | **8** |
| منها `BACKEND-ONLY` | **4** |
| حواجز | **5** (B-1…B-5) |
| صفوف مصفوفة التتبّع | **19** ADR × 8 أعمدة |

**لم يُحوَّل أي `OPEN` إلى `FROZEN`. لم يُخترع أي قرار غير مسنَد إلى مصدر.**
