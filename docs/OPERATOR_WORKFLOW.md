# Operator Workflow — daily operating loop
**Status:** workflow model used for product sequencing · **Evidence class:** hypotheses from `daily-ops-painpoints.md`, dossier workstream W4, and public operator patterns. **No real operator interview has been conducted — everything below is labelled H (hypothesis) until owner/operator validation.** A structured interview guide is included at the end.

## The loop VEGA must serve

### Morning (plan) — H
1. Provider/customer sends the day's plan by **WhatsApp** (counts per driver, sometimes addresses/COD notes) or it is known from standing arrangements.
2. Owner/dispatcher transcribes numbers into VEGA: planned shipments per provider; assigns drivers to vehicles; orders stops.
3. Gaps surface: missing address/contact, missing COD amount, vehicle unavailable.
4. Print/export a **driver sheet / manifest** (bilingual, print-friendly).

**VEGA today:** daily counts + provider WhatsApp import (totals-level). **R2/R3 add:** stop-level records, safe bulk paste/CSV preview, assignment board, printable manifest.

### During the day (execute) — H
- Drivers update via WhatsApp voice/text; dispatcher adjusts statuses manually (offline-first — no live backend assumption).
- Failed stops get standardized reasons (`failureReasons` vocabulary already shipped).
- Exceptions are assigned an owner; reattempts tracked on the recovery board.
- POD completeness flagged per day.

**VEGA today:** recovery board + failure reasons live. **R2 adds stop status lifecycle; R4 wires failed stops → recovery entries automatically (no duplicates).**

### Evening (close & reconcile) — H
1. Provider sends closing WhatsApp summary (تحميل/توصيل/راجع + driver/car/plate) → parser preview → confirm into today's record.
2. Reconcile: **loaded = delivered + returned + pending/unexplained** — differences shown, never auto-balanced.
3. COD: expected vs collected vs remitted; outstanding carried forward.
4. Fuel cash (SAR), extra costs, attendance, safety, notes, tomorrow priority.
5. Generate EN/AR report (PDF/Excel); back up when prompted.

**VEGA today:** entry forms + reports + backup exist; guided close with hard invariant arrives in R4.

### Weekly/monthly (steer)
Weak customers/drivers/vehicles/routes, cost per delivered stop, COD remittance lag, recovery performance, plan-vs-actual — all from recorded data only (see KPI_DICTIONARY).

## Ten friction points this product attacks (from painpoints doc, prioritized)

1. Numbers scattered across WhatsApp threads → single workspace + parser import.
2. End-of-day totals that don't add up → enforced reconciliation invariant with visible difference.
3. COD cash leakage/lag → expected/collected/remitted/outstanding + lag trend.
4. Missed recovery follow-ups → recovery board aging + owners.
5. Missing POD at dispute time → POD completeness tracking.
6. Spreadsheet formula rot → engine with pinned tests.
7. Data loss fear → versioned backups + age banner.
8. Arabic-afterthought tools → native Saudi Arabic UI/reports.
9. No morning printable plan → R3 manifest export.
10. Unknown cost per stop → derived metrics with honest labels.

## Structured interview guide (for first real operator session)

Morning: كيف تصلك خطة اليوم؟ من يرسلها وبأي صيغة؟ كم سائقاً وسيارة؟ كيف توزع الوقفات؟
Import: مثال حقيقي لرسالة واتساب من المزوّد (نص حرفي). هل الأرقام دائماً تحميل/توصيل/راجع؟ ماذا يختلف في رمضان؟
Assignment: كيف تختار السائق والسيارة؟ ماذا تفعل عند الغياب؟
Failures: أكثر سبب فشل شائع؟ ماذا يحدث للشحنة الفاشلة نفس اليوم؟ من يتابع إعادة المحاولة؟
COD: كيف تُحصّل النقدية؟ متى تسلّمها للمحاسبة؟ كيف تعرف أن هناك نقصاً؟
Fuel: كيف تدفع الوقود؟ فواتير أم نقداً؟ من يرفع الإثبات؟
Disputes: آخر خلاف مع عميل — ماذا طلب كإثبات؟
Weekly: أي تقرير تفتحه أولاً؟ ما الرقم الذي يغيّر قرارك فعلاً؟
Vehicles: أين تُخزّن هويات المركبات وتواريخ انتهاء الوثائق (تشغيل/تأمين/فحص)؟
Language: المصطلحات التي يستخدمها المرسلون فعلياً (سجّل حرفياً).
Pain: أكبر مضيعة وقت هذا الأسبوع؟ أكبر تأخير في معلومة كلّفتك مالاً؟

Each answer becomes either a validated requirement or a discarded hypothesis — recorded in this file under "Validated" with date.
