# ARCHITECTURE_IMPLEMENTATION_GATE
## ALOMDA TEL · بوابة اعتماد التصميم قبل التنفيذ (Phase 1.1)

**الغرض:** بوابة توقيع واحدة. ما يُعتمَد هنا يُبنى؛ وما يبقى مفتوحًا **لا يُبنى عليه**.
**الحالة:** ⏸️ **AWAITING ARCHITECT SIGN-OFF** — لم يبدأ أي تنفيذ.
**التاريخ:** 2026-09-07
**SPA:** `spa_app-175.html` · SHA256 `7ffa6517e7171fb9dee3507998f274ea87c7ee07c41a8d3f8a146fdca1211fc1` — **لم يُمس**

---

# A. FROZEN DECISIONS

19 قرارًا مجمَّدًا من `ALOMDA_TEL_ARCHITECTURE_FREEZE_v1.0` — **لم يُغيَّر أي منها في Phase 1.1، ولم يُكتشف أي تعارض داخلي معها.**

| ADR | الجوهر | لا رجعة؟ |
|---|---|---|
| **101** | `YER`(جنوب) · `YEO`(شمال) · `SAR` · `USD` · الريال 0 منزلة · **zone يحدد العملة · gateway بُعد** | ❌ |
| **102** | تخزين `NUMERIC(20,4)` · حساب 4 منازل · ترحيل بمنزلة العملة · `HALF_UP` · Largest Remainder | ❌ |
| **103** | COA 3 مستويات · 6 خانات · **24 حسابًا مُرحَّلًا عليه** · 8 أبعاد · **لا حساب لأي طرف** | ❌ |
| **104** | **الـLedger مصدر الحقيقة الوحيد** · T0→T3 · `initialBalance` و`providerAccount.balance` مُلغيان · `WALLET_LEDGER` أرشيف | ❌ |
| **105** | الحجز **تشغيلي لا قيد** · `Available = Ledger − Held + Credit` · «Reserved» مُلغى · لا إفراج زمني للمعلّق | ⚠️ |
| **106** | **Commission Wallet وحده** · الهامش في التسعير · `COMMISSION-PAYABLE` التزام منفصل | ❌ |
| **107** | 11 حالة · **`SUCCESS ≠ SETTLED`** · **`TIMEOUT ≠ FAILED`** · انتقالات محظورة مفروضة | ⚠️ |
| **108** | **4 طبقات Idempotency · 4 مفاتيح · 4 جداول** · `SENT` قبل الاستدعاء | ❌ |
| **109** | 7 طرق حسم · 4 قاطعة · **ممنوع Retry/Fallback/إفراج عند الغموض** | ✅ |
| **110** | `settlement_model` · **System Margin مشتق لا حساب** · **العكس ينسخ كل الأبعاد** | ❌ |
| **111** | 9 مراحل تسعير · **Margin Guard مرتين** · Price/FX Lock بـ8 حقول | ✅ |
| **112** | `parent_id` + `party_closure` · عزل شجري إلزامي · لقطة أسلاف · **منفصلة عن COA** | ⚠️ |
| **113** | Argon2id · RBAC+ABAC+SoD · Maker/Checker · 2FA · **فرض خادمي حصري** | ✅ |
| **114** | 4 طبقات مطابقة · **تسوية بقيد لا بتعديل** · **لا إقفال مع فرق مفتوح** | ✅ |
| **115** | Offline: عرض ومسودة · **لا `SUCCESS` محليًا** · رصيد بختم زمني | ✅ |
| **116** | RPO متدرّج (≈0 للمالي) · RTO ≤30د · 99.9% · اختبار استرجاع ربع سنوي | ✅ |
| **117** | Trial Balance **لكل عملة** · MV للقوائم · تصدير Streaming · عزل شجري | ✅ |
| **118** | تدقيق موحّد **append-only + سلسلة تجزئة** · `reason` إلزامي · لا أسرار | ❌ |
| **119** | **Modular Monolith** + Workers · **Outbox إلزامي** · لا استدعاء خارجي داخل معاملة DB | ⚠️ |

> **`CONFLICT WITH FROZEN ADR` = لا شيء.** فُحصت كل قرارات Phase 1.1 مقابل الـ19؛ **صفر تعارض**. التصحيحات كلها إما تنفيذية (مكان الفحص · ملكية جدول) أو اكتشافات مخطط (دورة FK) — **لا تمسّ جوهر أي ADR**.

---

# B. OPEN DECISIONS

**17 قرارًا مفتوحًا — لم يُحوَّل أي منها إلى `FROZEN`، ولم يُوضع لأي منها default غير موثق.**

| ID | القرار | حرج؟ | يمنع |
|---|---|---|---|
| `OPEN-BE-02` | **عملة التقرير الأساسية** | 🔴 | القوائم الموحّدة · FX · إقفال الفترة — **لا يمنع النواة** |
| `OPEN-BE-15` | **تعدد المستأجرين** | 🔴 | ✅ **أُغلق تنفيذيًا** في Phase 1C-4B.1 باعتماد `REC-BE-15` (`RAT-01`) — **والقرار نفسه ما زال `OPEN`** |
| `OPEN-BE-06` | كل قيم التسعير | 🔴 | تشغيل التسعير — لا يمنع بناءه |
| `OPEN-BE-07` | كل نسب العمولة | 🔴 | تشغيل العمولة — لا يمنع بناءها |
| `OPEN-BE-09` | تكامل البنوك (`الكريمي والتغذية.docx` **MISSING SOURCE**) | 🔴 | التغذية التلقائية · مطابقة طبقة 3 |
| `OPEN-BE-17` | **هل يجوز للطرف الانتماء لأكثر من منطقة؟** *(جديد)* | 🟠 | فتح محفظة بعملة ثانية |
| `OPEN-BE-01` | المنصة واللغة | 🟡 | لا شيء ماليًا |
| `OPEN-BE-03` | `ROUNDING-DIFFERENCE` حساب أم بُعد | 🟡 | صف واحد في COA |
| `OPEN-BE-04` | طول الفترة والتقويم | 🟡 | — |
| `OPEN-BE-05` | نسبة المكشوف مقابل التأمين | 🟡 | — |
| `OPEN-BE-08` | أنواع العمولات المتقدمة | 🟡 | — |
| `OPEN-BE-10` | بيانات WiFi/MikroTik (`الواي فاي.docx` **MISSING SOURCE**) | 🟡 | تكامل WiFi |
| `OPEN-BE-11` | عتبات الاحتيال (المصادر متعارضة) | 🟡 | — |
| `OPEN-BE-12` | مدة Access Token (المصادر متعارضة) | 🟡 | — |
| `OPEN-BE-13` | منع `SUPER_ADMIN` من أرصدة العملاء | 🟠 | بذور RBAC |
| `OPEN-BE-14` | تقنية الطابور المساعدة | 🟡 | الأداء فقط |
| `OPEN-BE-16` | سياسة الاحتفاظ بالبيانات | 🟡 | الأرشفة |

---

# C. ACCEPTED ARCHITECTURAL PROPOSALS

| ID | القرار | الحالة | الأثر المُطبَّق |
|---|---|---|---|
| **AP-01** | فصل `D14 Reconciliation` عن `D15 Reporting` | ✅ **ACCEPTED** | Reporting **قراءة فقط ماليًا** · استثناء واحد موثَّق (`export_jobs`) · مسارا API منفصلان · أدوار `report:*` بلا أي `*:write` مالي |
| **AP-02** | `D16 Notifications` نطاق مستقل · **مستهلك Outbox** | ✅ **ACCEPTED** | `Event → Outbox → Worker → قناة` · **لا مسار `Operations → Notifications → Operations`** · لا تعديل حقيقة مالية |
| **AP-03** | **Digital Delivery Engine** واحد + Strategy لكل نوع | ✅ **ACCEPTED** | **نسخة واحدة** من `AVAILABLE/LOCKED/USED/SOLD/EXPIRED` في المخطط كله · لا `pin_vault` ولا `subscription_pins` ولا `wifi_vouchers` كجداول · القواعد المختلفة تبقى منفصلة |
| **AP-04** | `1K Security` **قبل** `1E Wallet` | ✅ **ACCEPTED** | الترتيب `1A→1B→1C→1D→1K→1E→1F` · **إثبات عدم الدوران:** D3 لا يعتمد على D4 ولا D5 |
| **REC-BE-15** | `Tenant-Ready, Single-Tenant-Deployed` | ✅ **ACCEPTED** (Phase 1C-4B.1 · `RAT-01`) | البنية **Tenant-Ready** · التشغيل **Single-Tenant** · `tenant_id` يدخل تصميم كل بيانات مالية جديدة · **لا سلوك تعدد ولا عزل مستأجرين ولا Tenant domain ولا API/UI** · `OPEN-BE-15` ما زال مفتوحًا |

---

# D. BLOCKERS

| # | الحاجز | يمنع | لا يمنع | المطلوب | المسؤول |
|---|---|---|---|---|---|
| **B-1** | **توقيع سجل ADR** (101…119) | بدء `1C` وما بعده | `1A` · `1B` | موافقة على الـ8 غير القابلة للرجوع — 🔶 **`UNVERIFIED`** (`RAT-08`): لا دليل توقيع في المستودع | **أنتم** |
| **B-2** | **عملة التقرير** (`OPEN-BE-02`) | إقفال أول فترة · القوائم الموحّدة · FX | بناء `1B`/`1C` (الأعمدة تُبنى فارغة) · **ميزان مراجعة لكل عملة يعمل** | `YER` أو `YEO` أو `SAR` أو `USD` | **أنتم** |
| **B-3** | **إعلان عملة لكل طرف** | `1M` · `T1` · الأرصدة الافتتاحية | `1A`…`1L` | جدول (طرف ← عملة) | **أنتم** (بيانات) |
| **B-4** | **الامتثال السعودي** | نطاق السعودية (FR-35) | النواة | رأي قانوني (ZATCA/VAT) | خارجي |
| **B-5** | **تعدد المستأجرين** (`OPEN-BE-15`) | `1C` **إن رُفضت** `REC-BE-15` | لا شيء **إن اعتُمدت** `REC-BE-15` | ✅ **مُغلق تنفيذيًا** — `REC-BE-15` اعتُمدت في Phase 1C-4B.1 (`RAT-01`) | **أنتم** |

> **`B-5` قابل للإغلاق التنفيذي فورًا** باعتماد `REC-BE-15` — بتكلفة عمود وبادئة فهرس، ودون حسم `OPEN-BE-15`.
>
> **تم — Phase 1C-4B.1 (2026-09-08):** `REC-BE-15` اعتُمدت و`B-5` أُغلق تنفيذيًا. **لكن الإغلاق جاء بعد إنشاء أول ثلاثة جداول مالية**، فصار إدخال `tenant_id` التزامًا على 1C-5 — راجع `D.1` أدناه و§3.c.1 من `BACKEND_DECISION_REGISTER.md`.

---

# D.1 ترسيم Phase 1C-4B.1 — DOCUMENTATION ONLY

**التاريخ:** 2026-09-08 · **الطبيعة:** توثيق فقط — **صفر كود · صفر migration · صفر تعديل قاعدة بيانات · صفر تعديل SPA.**
**التفاصيل الكاملة والمصادر الحاكمة:** `BACKEND_DECISION_REGISTER.md` §3.c.

| ID | القرار المُرسَّم | التنفيذ |
|---|---|---|
| `RAT-01` | `B-5` مُغلق تنفيذيًا بـ`REC-BE-15` — Tenant-Ready / Single-Tenant-Deployed | مؤجَّل إلى 1C-5 |
| `RAT-02` | **W3 = OPTION D** — `journal_entry_lines` هو المصدر المالي الوحيد؛ التوازن لكل عملة ينتقل إلى Trigger وفق Schema §23 | مؤجَّل إلى 1C-5 · **لا حذف الآن** |
| `RAT-03` | **W4** — لقطة ثابتة على كل سطر: `account_id` · `account_code` · `account_name` (Freeze §قواعد الترحيل 5) | مؤجَّل إلى 1C-5 |
| `RAT-04` | **C-1** — أعمدة عملة التقرير تُبنى وتبقى `NULL` حتى حسم `OPEN-BE-02` (Design §4.6 · `B-2`) | مؤجَّل إلى 1C-5 |
| `RAT-05` | **W5** — لا `CHECK` لاقتران `party_type`/`party_id`؛ القاعدة محصورة في سطور العكس | مرحلة العكس |
| `RAT-06` | **W2** — `entry_number` · `period_id` · `status` · روابط العكس · `created_by` · `correlation_id` مؤجَّلة لمراحلها | مراحلها الطبيعية |
| `RAT-07` | `chart_of_accounts` · `currencies` · `accounting_periods` لا تُنشأ الآن · ومصدر حقيقة الأبعاد **غير محسوم** | تعريف 1C-5 |
| `RAT-08` | `B-1` توقيع سجل ADR = 🔶 **`UNVERIFIED`** | Project Owner |

**ما لم يُحسم ويبقى `OPEN`:** `OPEN-BE-02` · `OPEN-BE-03` · `OPEN-BE-04` · `W5` · مصدر حقيقة `allowed_dimensions`/`required_dimensions` · التعارضات `C-3` · `C-4` · `C-8` · `C-9` · `C-10`.

## D.2 الإغلاق النهائي — Phase 1C-4B.1 = **CLOSED** (2026-09-08)

اعتمد Project Owner القرارات النهائية `FIN-01` … `FIN-11` — التفاصيل الكاملة و`OLD → NEW → REASON` في `BACKEND_DECISION_REGISTER.md §3.c.5`.

| القرار | الخلاصة |
|---|---|
| `FIN-01` | `tenant_id TEXT` مطابق لـ`RuntimeConfig.tenantId` · مصدره البنية التحتية · ADR-108 ط2 تصبح tenant-aware |
| `FIN-02` | `account_id` = **`DEFERRED`** (لا مُلغى) — يُعاد تقييمه مع Account Lifecycle / COA Persistence |
| `FIN-03` | لقطة الحساب = `account_code` + `account_name` فقط |
| `FIN-04` | مبدأ **Historical Read ≠ Current Posting Validation** معتمد · **التنفيذ مُعلَّق** (`H-01`) |
| `FIN-05` | `journal_entry_lines` = المصدر المالي الوحيد · `journal_entry_totals` يُزال · البديل `CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED` |
| `FIN-06` | أعمدة عملة التقرير **مؤجَّلة** — `INTENTIONAL SCOPE CHANGE` · راجع `H-02` |
| `FIN-07` | لا جداول مرجعية في 1C-5 |
| `FIN-08` | لا `CHECK` لاقتران الطرف · المالك **Accounting Posting Rule** |
| `FIN-09` | `account_name` = 1C-5 MUST · `account_id` = DEFERRED · الباقي LATER |
| `FIN-10` | اسم المرحلة: **`PHASE 1C-5 — ACCOUNTING PERSISTENCE CORRECTIONS`** |
| `FIN-11` | حالة توقيع ADR تبقى كما هي · **Freeze wins until explicitly amended** |

**ثلاث نقاط أُوقفت وتنتظر قرارًا (`H-01` · `H-02` · `H-03`)** — راجع §3.c.5 من سجل القرارات. لا تُنفَّذ 1C-5 قبل حسم `H-03` على الأقل.

> **ملاحظة على نص هذه البوابة (`C-9`):** ترويسة الوثيقة (`AWAITING ARCHITECT SIGN-OFF — لم يبدأ أي تنفيذ`) وقسم «الحكم» (`IMPLEMENTATION: لم يبدأ`) **لم يُعدَّلا**، رغم أن `1A` … `1C-4B` مُنفَّذة ومقبولة فعليًا. عدم التعديل مقصود: تغيير سجل توقيع ليس من صلاحية مرحلة توثيق. يُسجَّل التعارض ويُترك حسمه لـProject Owner.

---

# E. NON-BLOCKING RISKS

| # | الخطر | الأثر | التخفيف |
|---|---|---|---|
| **R-1** | **10 من 32 وثيقة مصدر مفقودة** — منها الوثيقة الأم · `الربط البرمجي` · `سجلات التدقيق` · `إدارة الأجهزة` · `الواي فاي` · `الكريمي والتغذية` | قد تحمل متطلبات إلزامية في 5 نطاقات | `MISSING SOURCE` معلن · رفعها بالتوازي مع `1A` |
| **R-2** | **`TEST SUITE NOT PRESENT`** — 41 ملفًا و1530 اختبارًا مذكورة كمُسلَّمة وغير موجودة | صفر دليل جودة على المنطق المُرحَّل | **مجموعة اختبارات تعاقدية إلزامية في `1C`** |
| **R-3** | لا مزوّد حقيقي (3 محاكيات) | `1G` يُختبر بالمحاكي فقط | `provider_kind='SIMULATOR'` ممنوع إنتاجيًا |
| **R-4** | لا واجهة بنكية حقيقية | طبقة المطابقة 3 معطَّلة | تُبنى وتنتظر |
| **R-5** | **مصدر `localStorage` قد يكون ناقصًا أو متعدد الأجهزة** | ترحيل ناقص لا يمكن اكتشافه | حصر الجهاز/المتصفح المعتمد **قبل** التصدير |
| **R-6** | نسب العمولة وأسعار الخدمات وتكاليف المزوّدين | `1H` لا يعمل بلا بيانات | الجداول جاهزة · `UNKNOWN` |

---

# F. DOMAIN DEPENDENCY MATRIX

**المفاتيح:** `R` قراءة · `W` كتابة · `E` عبر حدث (Outbox) · `—` لا علاقة · **`✗` ممنوع صراحةً**
**الصف = المستدعي · العمود = المستدعى**

| ↓ من \ إلى → | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 | D11 | D12 | D13 | D14 | D15 | D16 | PF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **D2** Identity | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | W |
| **D3** Security | R | — | **✗** | **✗** | — | — | — | — | — | — | — | — | — | — | — | W |
| **D4** Accounting | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | W |
| **D5** Wallet | R | — | R/W | — | — | — | — | — | — | — | — | — | — | — | — | W |
| **D6** Funding | R | — | R/W | R/W | — | — | — | — | — | — | — | — | — | — | — | W |
| **D7** Catalog&Pricing | R | — | — | **✗** | — | — | — | R | R | — | — | — | — | — | — | W |
| **D8** Transaction | R | — | R/W | R/W | — | R | — | R | R/W | R/W | — | — | — | — | — | W |
| **D9** Provider | — | — | **✗** | **✗** | — | R | **✗** | — | — | — | — | — | — | — | — | W |
| **D10** Commission | R | — | R/W | **✗** | — | R | R | — | — | — | — | — | — | — | — | W |
| **D11** Digital | — | — | R/W | — | — | R | R | R | — | — | — | — | — | — | — | W |
| **D12** Operations | R | — | — | — | — | R | R/W | — | — | R | — | — | — | — | — | W |
| **D13** Disputes | R | — | R/W | R | — | — | R/W | R | R/W | — | R | — | — | — | — | W |
| **D14** Reconciliation | R | — | R/W | R | R | — | R | R | R | R | — | — | — | — | — | W |
| **D15** Reporting | R | R | R | R | R | R | R | R | R | R | R | R | R | — | — | R |
| **D16** Notifications | R | — | **✗** | **✗** | **✗** | — | **✗** | — | **✗** | — | **✗** | **✗** | — | — | — | R |
| **PF** Platform | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |

## قواعد لا تُخرق
```
1. D4 Accounting  →  لا يستدعي أي نطاق. جذر شجرة الاعتماد.
2. D9 Provider    →  ✗ D8   — يُستدعى ولا يستدعي. الرجوع بالحدث فقط.
3. D15 Reporting  →  W ممنوع على كل عمود. قراءة فقط ماليًا (استثناء export_jobs غير المالي).
4. D16 Notifications → لا يكتب في أي نطاق أعمال. يقرأ Outbox ويكتب جداوله فقط.
5. D3 Security    →  ✗ D4 · ✗ D5  — لا يقرأ قيدًا ولا رصيدًا لتنفيذ صلاحياته (AP-04).
6. D7 Pricing     →  ✗ D5  — لا يعدّل محفظة إطلاقًا.
7. D10 Commission →  ✗ D5  — يمرّ بقيد D4 حصرًا، لا كتابة مباشرة على محفظة.
8. فحص Maker/Checker يقع في طبقة التنسيق **قبل** استدعاء أي نطاق مالي (C-01).
9. party_risk_metrics تُغذّى بالأحداث لا بالاستدعاء (C-02).
```

## إثبات عدم الدوران
| المسار المفحوص | النتيجة |
|---|---|
| `D8 → D9 → D8` | ✗ مقطوع — D9 ممنوع من استدعاء D8 |
| `D3 → D4/D5 → D3` | ✗ مقطوع — D3 ممنوع من قراءة القيود/الأرصدة |
| `D12 → D16 → D12` | ✗ مقطوع — D16 لا يستدعي نطاق أعمال |
| `D2 → D7 → D2` | ✗ مقطوع بـ`NF-02` — `pricing_group_id` نُقل إلى `party_pricing_assignments`(D7) |
| `D10 → D5 → D10` | ✗ مقطوع — D10 ممنوع من الكتابة على D5 |
| **دورة FK على مستوى الجداول** | ✗ **مقطوعة بـ`NF-01`** — حُذف `transactions.hold_id` |
| `journal_entries.source_id` كـFK | ✗ **عمدًا نص لا FK** — يمنع دورة مع `transactions.settlement_journal_entry_id` |

**النتيجة: صفر دورة اعتماد · صفر دورة FK.**

---

# G. SOURCE-OF-TRUTH MATRIX

| البيان | مصدر الحقيقة | Projection/Cache | من يكتب | كيف يُطابَق |
|---|---|---|---|---|
| رصيد أي طرف | **`journal_entry_lines`** | `party_wallet_projection` | **D4 فقط** | طبقة 1 يومي |
| رصيد المزوّد | **`journal_entry_lines`** [provider, provider_account] | `party_wallet_projection` | D4 فقط | طبقة 1 |
| رصيد البوابة | **`journal_entry_lines`** + بُعد `gateway_id` | — | D4 فقط | طبقة 1 |
| رصيد البنك/الصندوق | **`journal_entry_lines`** + `financial_account_id` | — | D4 فقط | طبقة 3 |
| **المبلغ المحجوز** | **`wallet_holds`** | — | D5 فقط · **ليس قيدًا** | إفصاح لا مطابقة |
| المتاح | **محسوب** `Ledger − Held + Credit` | — | — | — |
| حد الائتمان | `credit_limits` (**افتراضه 0 في v1**) | — | D5 · Maker/Checker | — |
| العمولة المستحقة | **`journal_entry_lines`** (`COMMISSION-PAYABLE`) | `commission_accruals` | D10 → D4 | طبقة 4 |
| حالة المعاملة | `transactions.status` + التاريخ | — | D8 فقط | طبقة 2 |
| **نتيجة التنفيذ** | **المزوّد الخارجي** — مخزَّنة في `provider_executions` | — | D9 فقط · **النظام يعكس ولا يقرر** | طبقة 2 |
| حالة القسيمة | `inventory_items` (Row Lock) | — | D11 فقط | — |
| السعر/التكلفة/FX المطبَّق | `transactions.locked_*` | — | **مُثبَّت لحظة `HELD`** | — |
| الشجرة الهرمية | `parties.parent_id` + `party_closure` | — | D2 فقط | — |
| سلسلة الأسلاف لمعاملة | `transactions.ancestor_chain_snapshot` | — | **مُثبَّتة لا تُعاد قراءتها** | — |
| الشريحة السعرية للطرف | `party_pricing_assignments` *(جديد)* | — | D7 فقط | — |
| التحويل البنكي | **البنك الخارجي** | `funding_requests` | D6 فقط | طبقة 3 |
| قيم `CONFIGURATION` | `system_configuration` *(جديد)* | — | Platform · Maker/Checker للمالي | — |
| التدقيق | `audit_log` + مجارٍ متخصصة | — | **الكل يكتب · لا أحد يعدّل** | فحص السلسلة |
| الجلسة/الصلاحيات المُخبّأة | Cache | — | D3 · **ليس مصدر حقيقة مالية** | — |
| أي شيء على جهاز العميل | — | Cache | **ليس مصدر حقيقة إطلاقًا** | — |
| `legacy_wallet_ledger` | — | أرشيف | **لا كاتب · لا قارئ مالي** | — |

**❌ ليست مصادر حقيقة — ولا وجود لها في المخطط:** `agent.balance` · `providerAccount.balance` · `ownerEntity.balance` · `WALLET_LEDGER`.

---

# H. TABLE OWNERSHIP MATRIX

| النطاق | يملك | ملاحظات |
|---|---|---|
| **D2** Identity | `zones` · `parties` · `party_closure` · `party_financial_limits` · `kyc_submissions` | **لا عمود `balance`** · **لا `pricing_group_id`** (`NF-02`) |
| **D3** Security | `users` · `credentials` · `sessions` · `trusted_devices` · `permissions` · `roles` · `role_permissions` · `user_roles` · `user_permission_overrides` · `access_constraints` · **`approval_requests`** · `security_events` · `party_risk_metrics` · **`audit_log`** | `approval_requests` يُقرأ من طبقة التنسيق فقط (`C-01`) |
| **D4** Accounting | `currencies` · `fx_rates` · `chart_of_accounts` · `accounting_periods` · `journal_entries` · `journal_entry_lines` | **الجذر — لا يستدعي أحدًا** |
| **D5** Wallet | `party_wallet_projection` · `wallet_holds` · `credit_limits` · `legacy_wallet_ledger` | `financial_accounts` **نُقل إلى D6** (`NF-05`) |
| **D6** Funding | `gateways` · `funding_methods` · `party_funding_links` · `funding_requests` · `bank_statement_lines` · **`financial_accounts`** | `provider_webhook_events` **نُقل إلى D9** (`NF-06`) |
| **D7** Catalog & Pricing | `services` · `packages` · `pricing_groups` · **`party_pricing_assignments`** · `service_pricing` · `pricing_overrides` · `pricing_change_logs` | التسمية موحّدة (`NF-07`) |
| **D8** Transaction | `transactions` · `transaction_status_history` | **بلا `hold_id`** (`NF-01`) |
| **D9** Provider | `providers` · `provider_accounts` · `provider_credentials` · `provider_mappings` · `provider_health` · `provider_executions` · `provider_settlement_files` · **`provider_webhook_events`** | `provider_accounts` **بلا عمود رصيد** |
| **D10** Commission | `commission_policies` · `commission_tiers` · `commission_accruals` · `transaction_commission_lines` · `commission_settlements` | |
| **D11** Digital | `inventory_pools` · `inventory_batches` · `inventory_items` · `fulfillment_records` | **مفردات الحالة موحّدة — لا جداول PIN/Voucher/WiFi منفصلة** (`AP-03`) |
| **D12** Operations | `service_requests` · `service_request_history` · `service_request_offers` · `support_tickets` · `ticket_messages` · `wifi_networks` · `wifi_profiles` · `wifi_assignments` · `wifi_collections` | إدارة WiFi هنا · **بيع الكرت في D11** |
| **D13** Disputes | `disputes` · `dispute_events` | |
| **D14** Reconciliation | `reconciliation_sessions` · `reconciliation_items` · `financial_discrepancies` | **يكتب ماليًا بصلاحية + Maker/Checker** |
| **D15** Reporting | `export_jobs` **فقط** + 6 MVs | **استثناء غير مالي موثَّق** (`NF-04`) |
| **D16** Notifications | `notifications` · `notification_deliveries` | مستهلك Outbox |
| **PF** Platform | **`outbox_events`** · **`system_configuration`** · `tenants` (مشروط) | بنية تحتية · لا نطاق أعمال (`C-03` · `NF-03`) |

**صفر جدول بمالكَين.** الجداول الأربعة التي كانت ملكيتها ملتبسة صُحِّحت (`NF-05` · `NF-06` · `C-03`).

---

# I. ACCOUNTING INVARIANTS

| # | الثابت | الفرض |
|---|---|---|
| **AI-1** | كل قيد **متوازن لكل عملة معاملة على حدة** — لا تجميع عبر العملات | Trigger على مستوى القيد |
| **AI-2** | كل سطر: `debit ≥ 0 AND credit ≥ 0 AND NOT(both>0) AND NOT(both=0)` | `CHECK` |
| **AI-3** | `source_type` + `source_id` **إلزاميان** · `UNIQUE(source_type, source_id)` | قيد فريد |
| **AI-4** | **لا `UPDATE` ولا `DELETE`** على قيد أو سطر — لأي دور | Trigger |
| **AI-5** | **سطر العكس ينسخ كل الأبعاد** | اختبار عقد إلزامي + مراجعة |
| **AI-6** | **عكس واحد لكل قيد** | `UNIQUE(reversal_of_entry_id)` |
| **AI-7** | **لا ترحيل في فترة `CLOSED`** | Trigger |
| **AI-8** | **لا إقفال فترة مع `financial_discrepancy` مفتوح** | فحص عند الإقفال |
| **AI-9** | الترحيل **فقط على `is_postable = true` (level 3)** · البُعد ضمن `allowed` وشامل `required` | Trigger |
| **AI-10** | **لا حساب COA لأي طرف** — 24 حسابًا `is_system` · لا API إنشاء | مخطط + عقد |
| **AI-11** | **كل مبلغ له عملة** — لا عمود مبلغ بلا `currency_code` مجاور | مراجعة مخطط + CI |
| **AI-12** | **`FLOAT`/`DOUBLE` ممنوعة** على أي مبلغ | مراجعة مخطط |
| **AI-13** | **System Margin مشتق** — لا حساب يُرحَّل عليه | تصميم COA |
| **AI-14** | تقريب **عند الترحيل** بمنزلة العملة · `HALF_UP` · Largest Remainder للتقسيم | Money Engine + اختبارات |
| **AI-15** | **عملة الطرف immutable بعد أول حركة** | Trigger (`BE-28`) |
| **AI-16** | **`gateway.default_currency_code` لا يُشتق منه عملة قيد أبدًا** | فحص CI (`BE-30`) |

---

# J. TRANSACTION INVARIANTS

| # | الثابت | الفرض |
|---|---|---|
| **TI-1** | `UNIQUE(party_id, client_ref)` — إعادة الإرسال تُعيد النتيجة المخزَّنة | قيد فريد + بصمة الطلب |
| **TI-2** | **`SUCCESS ≠ SETTLED`** — لا قيد قبل `SETTLED` | آلة الحالات |
| **TI-3** | **`TIMEOUT ≠ FAILED`** — المهلة ⟹ `PENDING_PROVIDER` | محرك التنفيذ |
| **TI-4** | **`HELD` قبل أي استدعاء خارجي** حين `requires_hold = true` | Trigger انتقال |
| **TI-5** | **لا إفراج حجز عند الغموض** — `expires_at = NULL` بعد `QUEUED` | `CHECK` + Trigger |
| **TI-6** | `SETTLED → أي شيء عدا REVERSED` ممنوع · `FAILED → SUCCESS` ممنوع | Trigger |
| **TI-7** | **كل انتقال يكتب صفًا** في `transaction_status_history` | Trigger |
| **TI-8** | `UNIQUE(provider_id, provider_request_id, operation, attempt_no)` | قيد فريد |
| **TI-9** | **`SENT` يُكتب ويُلتزم قبل الاستدعاء** — انهيار ⟹ استعلام لا إعادة | تسلسل الـWorker |
| **TI-10** | **صفر إعادة تنفيذ على `unknown`/`pending`** | محرك التنفيذ |
| **TI-11** | **لا استدعاء خارجي داخل معاملة DB** — Outbox حصرًا | مراجعة + Trace |
| **TI-12** | **`SUCCESS` لا يبقى بلا `SETTLED`** — Worker تسوية idempotent + إنذار عند تجاوز العتبة | Worker + Alert |
| **TI-13** | `UNIQUE(wallet_holds.transaction_id)` — حجز واحد لكل معاملة | قيد فريد |
| **TI-14** | **الحجز مسموح فقط على `is_spendable = true`** | قيد (`NF-08`) |
| **TI-15** | **التكلفة لا تُشتق من سعر العميل** · **العمولة من السياسة لا من السعر** | Pricing Engine + مراجعة |
| **TI-16** | `UNIQUE(transaction_id, beneficiary_party_id)` على الاستحقاق · **لا عمولة قبل `SETTLED`** | قيد فريد + محرك |
| **TI-17** | **بيع القسيمة مرة واحدة** — `FOR UPDATE SKIP LOCKED` + `UNIQUE(locked_by_transaction_id)` جزئي | قيد فريد |

---

# K. SECURITY INVARIANTS

| # | الثابت | الفرض |
|---|---|---|
| **SI-1** | **كل فرض أمني خادمي** — الواجهة تجربة استخدام لا حماية | مراجعة معمارية |
| **SI-2** | **صفر سرّ** في قاعدة البيانات أو الكود أو السجلات — KMS/Vault حصرًا | مراجعة + فحص أسرار في CI |
| **SI-3** | **صفر سرّ مزوّد أو `credential_ref` في أي استجابة API** | عقد الـAPI |
| **SI-4** | كلمات المرور و PIN بـ**Argon2id** — لا نص صريح | مخطط |
| **SI-5** | `Deny-by-default` → منح الدور → **منع صريح يتفوق** | محرك RBAC |
| **SI-6** | **العزل الشجري إلزامي** على كل استعلام يمسّ طرفًا — بلا استثناء | Repository + اختبارات |
| **SI-7** | **`maker ≠ checker`** | `CHECK` + بصمة الحمولة |
| **SI-8** | الموافقة **تُستهلك مرة واحدة** ومرتبطة ببصمة الحمولة | `UNIQUE` + حالة `CONSUMED` |
| **SI-9** | **`audit_log` append-only + سلسلة تجزئة** — لا تعديل ولا حذف لأي دور | Trigger + فحص دوري |
| **SI-10** | **`reason` إلزامي** لكل فعل مالي يدوي · عكس · تجاوز حارس · منح صلاحية | تحقق API |
| **SI-11** | **كشف إعادة استخدام Refresh ⟹ إبطال كل جلسات الحساب** + حدث أمني | محرك الجلسات |
| **SI-12** | **`SUPER_ADMIN` لا يحصل تلقائيًا على أرصدة العملاء** — دور `FINANCE` منفصل | بذور RBAC (`OPEN-BE-13`) |
| **SI-13** | **منع تصعيد الرتبة** — لا تعديل صلاحيات من هو أعلى · لا منح ما لا تملك | محرك RBAC |
| **SI-14** | **`D15 Reporting` بلا أي صلاحية كتابة مالية** | بذور RBAC + مصفوفة F |
| **SI-15** | تنقيح إلزامي (Redaction) لكل حمولة مزوّد وسجل | قائمة حظر مركزية |

---

# L. MIGRATION INVARIANTS

12 ثابتًا — التفصيل الكامل في `MIGRATION_DESIGN_v1.0.md §17.b`:

`MI-1` قيد افتتاحي واحد لكل (طرف·عملة) — **يمنع double opening balance** · `MI-2` لا رصيد افتتاحي بلا `OPENING-BALANCE-SUSPENSE` · `MI-3` المُعلَّق يُصفَّر قبل أول إقفال · `MI-4` **`legacy_wallet_ledger` بلا كاتب وبلا قارئ مالي** · `MI-5` لا عمود `balance` في الوجهة · `MI-6` كل قيد بأبعاده · `MI-7` استحقاق `paid` بلا قيد (**يمنع مضاعفة العمولة**) · `MI-8` كل خطوة idempotent · `MI-9` **لا ترحيل بلا عملة صريحة** (`B-3`) · `MI-10` لا كلمة مرور تُرحَّل · `MI-11` مزوّدو الـSPA `SIMULATOR` حصرًا · `MI-12` `T3` بعد دورة إقفال ناجحة.

---

# M. SAFE TO IMPLEMENT PHASES

| Phase | الحالة | الشرط |
|---|---|---|
| **1A** Runtime Foundation | ✅ **آمن** | `B-1` |
| **1B** Money + Currency | ✅ **آمن** | `B-1` · ADR-101/102 مجمَّدان |
| **1C** COA + Accounting Core | ✅ **آمن** | `B-1` + **`B-5`** · أعمدة عملة التقرير تُبنى وتبقى `NULL` |
| **1D** Parties + Dimensions | ✅ **آمن** | `B-1` · العمق `CONFIGURATION` |
| **1K** Security / RBAC / Audit ★ | ✅ **آمن** | `B-1` · `OPEN-BE-12/13` إعداد لا بنية |
| **1E** Wallet + Holds | ✅ **آمن** | بعد `1K` · `credit_limit = 0` وسياسة المنح `FUTURE` |
| **1F** Transaction + Idempotency | ✅ **آمن** | ADR-107/108 مجمَّدان |

**الترتيب المعتمد:** `1A → 1B → 1C → 1D → 1K → 1E → 1F`

---

# N. NOT SAFE TO IMPLEMENT PHASES

| Phase | السبب | ما ينقص |
|---|---|---|
| **1G** Provider | ⚠️ البنية آمنة · **لا مزوّد حقيقي** | عقد تكامل واحد على الأقل · `الربط البرمجي.docx` مفقود |
| **1H** Pricing + Commission | ⚠️ المحرك آمن · **لا بيانات** | `OPEN-BE-06` · `OPEN-BE-07` — كل الأسعار والنسب `UNKNOWN` |
| **1I** Funding | ⚠️ الآلية آمنة · **لا بنك** | `OPEN-BE-09` — `الكريمي والتغذية.docx` مفقود |
| **1J** Digital / WiFi / Manual | ⚠️ المحرك آمن · **لا بيانات WiFi** | `OPEN-BE-10` — `الواي فاي.docx` مفقود |
| **1L** Reconciliation / Reports | ⚠️ طبقتان تعملان (1 و4) · **2 و3 تنتظران بيانات خارجية** · القوائم الموحّدة محجوبة | `B-2` · `OPEN-BE-09` |
| **1M** Migration | ⛔ **محجوب** | **`B-3`** — إعلان عملة لكل طرف |
| **نطاق السعودية** (FR-35) | ⛔ **محجوب** | `B-4` — رأي قانوني |
| **Credit granting** | ⛔ **`FUTURE`** | لم يُصمَّم — لم يُخترع |
| **Subscription lifecycle** | ⛔ **`FUTURE`** | لم يُصمَّم |

---

# المراجعة الذاتية النهائية (§32 من التكليف)

| # | السؤال | الجواب | الضمانة |
|---|---|---|---|
| 1 | هل Reporting يستطيع الكتابة؟ | **لا** | `AP-01` · `NF-04` · مصفوفة F (صف D15 كله `R`) · `SI-14` |
| 2 | هل Reconciliation يعدّل الحقيقة المالية بلا صلاحية؟ | **لا** | التصحيح **قيد تسوية** + Maker/Checker + `financial_discrepancies` · `AI-8` |
| 3 | هل Wallet ينشئ رصيدًا بلا Journal؟ | **لا** | `party_wallet_projection` يُكتب حصريًا من محدِّث الـProjection داخل معاملة القيد · لا API كتابة رصيد |
| 4 | هل Transaction تصبح `SUCCESS` بلا مسار تسوية؟ | **لا** | `TI-2` + `TI-12` (Worker idempotent + إنذار) |
| 5 | هل Provider يسبب تنفيذًا مزدوجًا؟ | **لا** | `TI-8` · `TI-9` · `TI-10` · `SKIP LOCKED` + شرط الحالة |
| 6 | هل Commission تغيّر `agent.balance`؟ | **لا** | الحقل **غير موجود** · D10 ممنوع من الكتابة على D5 (مصفوفة F) |
| 7 | هل Pricing تحدد Provider Cost؟ | **لا** | التكلفة من `provider_mappings` حصرًا · `TI-15` |
| 8 | هل عملة الطرف تتغير بعد حركة؟ | **لا** | `AI-15` · `BE-28` — Trigger |
| 9 | هل Gateway أصبح Currency؟ | **لا** | `AI-16` · `BE-30` — فحص CI |
| 10 | هل يُنشأ حساب COA لكل طرف؟ | **لا** | `AI-10` — 24 `is_system` · لا API إنشاء · `createFinancialAccount` أُغلق في SPA |
| 11 | هل يوجد مبلغ بلا عملة؟ | **لا** | `AI-11` |
| 12 | هل توجد دورة Domain dependency؟ | **لا** | مصفوفة F + إثبات القطع الستة |
| 13 | هل توجد FK cycle؟ | **لا** | `NF-01` مُصلَح · `source_id` نص عمدًا |
| 14 | هل يوجد duplicate source of truth؟ | **لا** | مصفوفة G · الـProjection مشتقة ومُطابَقة يوميًا |
| 15 | هل Migration ينشئ double opening balance؟ | **لا** | `MI-1` — Idempotency L2 |
| 16 | هل Offline يعلن نجاحًا ماليًا؟ | **لا** | ADR-115 — لا `SUCCESS` في مفردات العميل |
| 17 | هل سرّ المزوّد يصل الواجهة؟ | **لا** | `SI-2` · `SI-3` |
| 18 | هل يمكن حذف/تعديل التدقيق؟ | **لا** | `SI-9` |
| 19 | هل توجد API مالية تتجاوز Accounting؟ | **لا** | كل تغيير رصيد أثر جانبي لقيد · لا endpoint كتابة رصيد |
| 20 | هل يمكن إقفال فترة مع فرق مفتوح؟ | **لا** | `AI-8` |

**نتيجة المراجعة: صفر ثغرة من العشرين. لم يُحتَج إلى تحويل أي بند إلى Blocker أو Open.**

---

# الحكم

```
DESIGN STATUS   :  READY FOR ARCHITECT SIGN-OFF
IMPLEMENTATION  :  لم يبدأ · لن يبدأ قبل التوقيع
BLOCKERS        :  5   (B-1 · B-2 · B-3 · B-4 · B-5)
                    منها قابل للإغلاق فورًا بقرارٍ منكم: B-1 · B-5
                    ولا يمنع بدء 1A/1B: B-2 · B-3 · B-4
OPEN DECISIONS  :  17  (لم يُحوَّل أي منها إلى FROZEN)
FROZEN ADR      :  19  (صفر تعارض · صفر تغيير)
```

**بمجرد توقيع `B-1` وحسم `B-5`، يبدأ التنفيذ من `1A` مباشرة — بلا عمل تصميمي متبقٍّ للمراحل `1A` → `1F`.**

**لم يبدأ Phase 1A. لم يُكتب كود. لم يُنشأ مشروع ولا `package.json` ولا SQL ولا migration. لم يُعدَّل SPA.**
