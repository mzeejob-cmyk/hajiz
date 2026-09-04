# HAJIZ — STAGING GROUND TRUTH S1-A

## 1. VERDICT

**MATCH — القرار A: STAGING ALREADY MATCHES CANONICAL — NO MIGRATION APPLY NEEDED.**

التحقق المباشر أكد تطابق السلطة الفعلية للدفع وB11–B14 وتصحيحات RT-01/03/04 مع C1. لم تُنفّذ أي كتابة أو اختبارات runtime تُنشئ بيانات.

التطابق هنا للتعريفات والسياسات والصلاحيات المفحوصة؛ ليس ادعاءً بأن اختبارات runtime الجديدة قد نُفّذت.

## 2. CANONICAL CODE IDENTITY

GitHub والنسخة المحلية يطابقان:

`61c1c760efc5b098334046166b383b5f3fa154dd`

التسلسل المباشر المؤكد:

```text
57f0763093ba01b6a43b448adb43fd69e7b8c668  RT-04
da96cee73a0e2ebf390937968b7247cc23b01254  Hotels
5e5aff204c7ae455f6f7a420251568ffe22124c9  Product
61c1c760efc5b098334046166b383b5f3fa154dd  Docs
```

Working tree نظيف، وdiff وstaged diff فارغان. لم يحدث fetch أو commit أو push.

## 3. STAGING IDENTITY

| الخاصية | القيمة الحالية |
|---|---|
| Project | `pdnuswmljownjzjzpoop` |
| الاسم | HAJIZ Staging |
| المنطقة | `ap-northeast-1` |
| الحالة | `ACTIVE_HEALTHY` |
| إصدار المنصة | `17.6.1.165` |
| PostgreSQL الفعلي | PostgreSQL 17.6، ‏64-bit |

فُحصت هوية Legacy فقط وفق الاستثناء المسموح: `ckqxmacpojierkyxmiip`، اسمه `mzeejob@gmail.com's Project` وحالته الحالية **INACTIVE**. لم تُفحص قاعدة بياناته أو تُعدّل.

## 4. CURRENT REMOTE MIGRATION LEDGER

السجل الحالي يحتوي **14 migration مسجّلة كمطبقة**، بالترتيب التالي. لكل واحدة عنصر واحد في `statements`.

| # | Remote version | Logical name |
|---|---|---|
| 1 | 20260825173443 | payment_authority_staging_v1 |
| 2 | 20260825173613 | payment_authority_staging_v1_advisor_hardening |
| 3 | 20260825173751 | payment_authority_staging_v1_checkout_fix |
| 4 | 20260825175325 | payment_authority_security_v2 |
| 5 | 20260826174412 | psp_rejected_transition_v1 |
| 6 | 20260827134213 | payment_event_consumption_and_expiry_v1 |
| 7 | 20260827191245 | multi_supplier_identity_and_operations_v1 |
| 8 | 20260831165725 | flight_booking_intents_v1 |
| 9 | 20260831165816 | flight_payment_initiation_v1 |
| 10 | 20260831170046 | flight_supplier_booking_execution_v1 |
| 11 | 20260831170139 | flight_ticketing_confirmation_v1 |
| 12 | 20260831174408 | fix_flight_supplier_booking_execution_accepted_persistence |
| 13 | 20260831180657 | fix_flight_supplier_booking_failure_unknown_persistence |
| 14 | 20260901160250 | fix_flight_supplier_ticketing_issued_persistence |

MD5 لمحتوى statements، بنفس الترتيب:

```text
01 f9b8960b573e0e64598d4a750335e4bc
02 00d671d010d9de42a18d7975c0e03325
03 c81d02208892d6dbde47ecf04ab55f3c
04 642b820b727cb10121d718839ef7e1ce
05 8662021e3b056f1820459c6146661036
06 2ed9edb0c1b27e3d87dbc08a8e2b70e8
07 51d4c6f797e6ab7f5e7d100680ede74a
08 12a7a20d238a0deda90557b99076e82c
09 7513f53e2bc25935dae79b5f0c8e3d25
10 aa25e28b0b8183b57bd71fdd2c402c52
11 1564692c3d64e461498bb0f99433ed9c
12 39ec2d57dc669fd27c7798904d35eec8
13 6d093be86ff9b83176aaf298d19291d2
14 2f8b75776b42a1fe32c8920995cace62
```

هذه hashes للسجل البعيد، وليست ادعاءً بمطابقتها لبايتات ملفات SQL المحلية.

## 5. LOCAL ↔ REMOTE MIGRATION MAP

لتجنب تكرار الأسماء الطويلة: اسم الملف المحلي لكل صف هو  
`<Local timestamp>_<Logical name من القسم 4>.sql`.

| # | Local timestamp | Source commit المختصر | Remote version | التصنيف |
|---|---|---|---|---|
| 1 | 20260825173046 | d56c16da3317 | 20260825173443 | EXACT LOGICAL MATCH؛ NEVER REPLAY |
| 2 | 20260825173551 | d56c16da3317 | 20260825173613 | EXACT LOGICAL MATCH؛ NEVER REPLAY |
| 3 | 20260825173703 | d56c16da3317 | 20260825173751 | EXACT LOGICAL MATCH؛ SUPERSEDED |
| 4 | 20260825210000 | 11b547e2108d | 20260825175325 | EXACT LOGICAL MATCH |
| 5 | 20260826200000 | 3c9eef59a69b | 20260826174412 | EXACT LOGICAL MATCH |
| 6 | 20260827171209 | 2aa6d3c42af5 | 20260827134213 | EXACT LOGICAL MATCH |
| 7 | 20260827180646 | a1c6054a8c43 | 20260827191245 | EXACT LOGICAL MATCH |
| 8 | 20260829120000 | 88efbd9ee107 | 20260831165725 | EXACT LOGICAL MATCH |
| 9 | 20260829183000 | 81b383463882 | 20260831165816 | EXACT LOGICAL MATCH |
| 10 | 20260829213000 | a9ddbede637e | 20260831170046 | EXACT LOGICAL MATCH |
| 11 | 20260830090000 | 54adb2e2ed39 | 20260831170139 | EXACT LOGICAL MATCH |
| 12 | 20260831183000 | 290f5cf544aa | 20260831174408 | EXACT LOGICAL MATCH |
| 13 | 20260831190000 | 18badb5a9bf5 | 20260831180657 | EXACT LOGICAL MATCH |
| 14 | 20260831193000 | 57f0763093ba | 20260901160250 | EXACT LOGICAL MATCH |

جميع الصفوف بها **TIMESTAMP DRIFT مفهوم ومربوط**، وليس migration مفقودة. الثقة في ربط الأسماء عالية، ودُعمت بمقارنة الدوال الفعّالة.

الملف الإضافي:

`PLAN_ONLY_20260825_payment_authority.sql`  
المصدر `b603e63b5f28` — **LOCAL ONLY؛ NEVER REPLAY**.

لا توجد migration بعيدة بلا مقابل محلي ضمن السجل المفحوص. تأكدت قيم [سجل C1](C:/Users/mzeep/Documents/Codex/2026-09-02/referenced-chatgpt-conversation-this-is-an/work/hajiz-c1-lf-r0b/docs/C1_CANONICAL_MIGRATION_LEDGER.md) الحالي؛ لم يُعدّل.

## 6. NEVER-REPLAY LIST

- Base payment authority: لا يُعاد على قاعدة مهيأة.
- Advisor hardening: لا يُعاد عشوائيًا على السياسات والفهارس الموجودة.
- Checkout fix القديم: superseded بواسطة Security V2.
- تعريفات أحداث الدفع القديمة: لا تستبدل consumption/expiry الحالية.
- B13 القديم: لا يستبدل تصحيحات RT-01/RT-03.
- B14 القديم: لا يستبدل RT-04.
- `PLAN_ONLY`: ليس migration تنفيذية.
- لا تُعاد أي migration لمجرد اختلاف timestamp.

## 7. PAYMENT AUTHORITY

التعريفات الحية تطابق C1:

- `create_checkout`: Security V2 وreturn-origin allow-list.
- `apply_payment_event`: consumption/expiry remediation.
- فحص صلاحية الحدث يسبق تسجيل provider event.
- PSP confirmation يتطلب مبلغًا وعملة مطابقين وحدثًا موثّقًا وصلاحية غير منتهية.
- تأكيد الدفع يغيّر الحجز إلى `payment_confirmed` فقط.

Bankak يتطلب مسار المراجعة؛ PSP يسمح بالانتقال المباشر من `awaiting` إلى `confirmed` وفق الشروط. ليست جميع طرق الدفع سلسلة خطية واحدة.

## 8. BOOKING STATE AUTHORITY

الـenum والـtrigger الحيان يحافظان على:

`pending_payment → payment_confirmed → processing → confirmed → ticketed → completed`

Trigger الحالات مفعّل. تأكيد الدفع لا يساوي تأكيد حجز المورد.

## 9. PSP REJECTED

**ACTIVE** في الدالة والـtrigger، لا في السجل وحده:

`awaiting → rejected` مسموح لغير Bankak.

## 10. B11 / B12

الدوال الحية تطابق أجسام C1:

- `create_flight_booking_intent_v1`
- `get_flight_booking_intent_v1`
- `prepare_flight_payment_initiation_v1`
- `materialize_flight_payment_initiation_v1`

الجداول الخاصة موجودة؛ B11 يحتوي 18 عمودًا وB12 يحتوي 20. تنفيذ RPCs الداخلية محصور في `service_role` ومالكها.

## 11. B13

الدوال التالية فعّالة ومطابقة:

- `prepare_flight_supplier_booking_execution_v1`
- `mark_flight_supplier_booking_request_sent_v1`
- `complete_flight_supplier_booking_execution_v1`
- `record_flight_supplier_booking_failure_v1`
- private projection المقابلة.

قيود المحاولة الواحدة، uniqueness وUNKNOWN/reconciliation موجودة.

## 12. B14

دوال prepare/mark/complete/failure وprivate projection مطابقة لـC1.

جدول التنفيذ يحتوي 23 عمودًا؛ حالات الإصدار وUNKNOWN وقيود منع تكرار المحاولة موجودة.

## 13. RT-01

**EFFECTIVE** — جسم `complete_flight_supplier_booking_execution_v1` يطابق التصحيح canonical، وليس نسخة B13 السابقة.

## 14. RT-03

**EFFECTIVE** — جسم `record_flight_supplier_booking_failure_v1` يطابق تصحيح UNKNOWN canonical.

## 15. RT-04

**EFFECTIVE** — جسم `complete_flight_supplier_ticketing_v1` يطابق تصحيح issued persistence canonical.

## 16. EFFECTIVE FUNCTION DEFINITIONS

فُحصت **35 دالة** في `public/app_private`:

- 34 جسم دالة مطابق بعد إزالة الفراغات الخارجية فقط.
- دالة `can_upload_bankak_receipt` تختلف في توزيع المسافات والأسطر فقط؛ شروط owner/method/status/expiry متطابقة.
- بعد تسوية whitespace: **35/35 MATCHES CANONICAL**.
- لا دالة متوقعة مفقودة ضمن المجموعة المستخرجة.
- لا جسم فعّال مطابق لنسخة superseded بدل التصحيح الحالي.

شمل الفحص كذلك `SECURITY DEFINER`، المالك، search_path وامتيازات التنفيذ؛ لم يُستخدم اسم migration وحده دليلًا.

## 17. RLS STATUS

جميع الجداول التالية مملوكة لـ`postgres`، وRLS مفعّل، وFORCE RLS غير مفعّل:

| الجداول | السياسة/الوصول الفعلي |
|---|---|
| profiles | SELECT لصاحب الحساب فقط؛ لا كتابة مباشرة للمتصفح |
| bookings، payments، payment_receipts | سياسات owner دفاعية؛ لا SELECT مباشر للمستخدم حاليًا |
| offers، payment_provider_events، payment_audit | server-only؛ deny للمتصفح |
| fx_config، traveler_tokens | server-only؛ deny للمتصفح |
| flight_booking_intents | deny مباشر لـanon/authenticated |
| flight_payment_initiations | deny مباشر لـanon/authenticated |
| flight_supplier_booking_executions | deny مباشر لـanon/authenticated |
| flight_supplier_ticketing_executions | deny مباشر لـanon/authenticated |
| flight_ticket_records | deny مباشر لـanon/authenticated |
| supplier_operations | RLS بلا سياسات؛ لا وصول للمتصفح |

`checkout_return_origins` استثناء خاص: RLS غير مفعّل، لكن الجدول بلا grants للمتصفح. هذا يستحق hardening دفاعيًا لاحقًا، لا إعادة migration الآن.

## 18. RPC PRIVILEGES / SECURITY DEFINER

- جميع الدوال المفحوصة تمنع `anon`.
- دوال B11–B14 التنفيذية: `service_role` فقط، مع `search_path=''`.
- دوال MyTrips العميلية: `authenticated` مع شروط ownership.
- دوال Finance تستخدم `auth.uid()` وrole/finance-enabled المخزنة خادميًا.
- جميع search_paths المفحوصة مثبتة.
- لم يظهر `current_user` داخل أي جسم من الدوال الـ35؛ لا عودة لنمط الثقة القديم عبر هوية definer.
- FORCE RLS=false متسق مع نموذج ملكية الجداول والدوال الموجود.

ملاحظة أمنية: default privileges في `public` واسعة للكائنات المستقبلية، رغم أن grants الفعلية للكائنات الحالية مقيدة. لا ينبغي إنشاء كائنات جديدة دون مراجعة ACL صريحة.

## 19. MY TRIPS DATABASE AUTHORITY

الدوال الحالية:

- `get_my_bookings`
- `get_my_payments`
- `get_my_flight_ticketing_v1`
- `get_my_flight_ticket_records_v1`

تستخدم ownership عبر `auth.uid()`. قراءة سجلات التذاكر تتطلب حجزًا `ticketed` وتنفيذًا `ISSUED` وروابط owner متطابقة.

لا تُكشف `artifact_ref` أو storage path في projection العميلية.

## 20. TICKET RECORD AUTHORITY

جدول `flight_ticket_records` موجود بـ14 عمودًا، وRLS وقيود:

- تذكرة لكل execution/traveler.
- uniqueness لـprovider/ticket number.
- حالات artifact: `NONE / METADATA_ONLY / AVAILABLE`.
- قيود artifact shape.
- projection تحسب availability من السجلات، لا من PNR أو مرجع المورد.

هذا تحقق من التعريفات والقيود الحالية؛ لم تُنشأ تذاكر اختبارية.

## 21. EDGE FUNCTIONS

`inspect-payment-receipt`:

| الخاصية | القيمة |
|---|---|
| الحالة | ACTIVE |
| Version | 3 |
| JWT verification | true |
| آخر تحديث | 2026-08-25 18:07:21.764 UTC |

الكود/config المقروءان يتوافقان مع C1: تحقق claims، مسار مملوك للمستخدم، حد 10MB، فحص MIME وSHA-256، ثم `register_inspected_receipt`.

وظيفتها التسجيل للمراجعة، لا تأكيد الدفع. لم تُستدعَ أو تُنشر.

## 22. SECURITY / PERFORMANCE ADVISORS

| التصنيف | النتيجة | التقييم |
|---|---|---|
| MEDIUM / مراجعة مقصودة | 7 تحذيرات SECURITY DEFINER قابلة لاستدعاء authenticated | RPCs عميلية مقصودة؛ شروط owner/Finance مفحوصة |
| INFORMATIONAL | supplier_operations: RLS بلا policy | fail-closed للمتصفح؛ ليس دعوة لإضافة allow policy |
| LOW | FK بلا covering index على supplier_operations.offer_id | تحسين أداء لاحق |
| INFORMATIONAL | فهرس B13 لم يُستخدم | لا يُحذف استنادًا إلى قلة الاستخدام في Staging |
| MEDIUM، فحص إضافي | default privileges واسعة للكائنات المستقبلية | مراجعة قبل أي DDL جديد |
| LOW، فحص إضافي | checkout_return_origins بلا RLS | ACL الحالية تمنع المتصفح؛ hardening مؤجل |

لم يظهر BLOCKER في نطاق بوابة runtime المقيدة. لم يُصلح أي finding.

## 23. CANONICAL VS STAGING MATRIX

| AREA | توقع C1 | الواقع الحالي | MATCH | RISK / ACTION |
|---|---|---|---|---|
| Payment authority | Security V2 + consumption/expiry | فعّالة | YES | لا apply |
| PSP rejected | رفض non-Bankak | فعّال بالدالة والـtrigger | YES | اختبار لاحق |
| B11 | intent خاص وservice RPCs | مطابق | YES | لا apply |
| B12 | initiation/materialization | مطابق | YES | لا apply |
| B13 | تنفيذ مورد مقيد | مطابق | YES | runtime مقيد لاحقًا |
| B14 | trusted ticket evidence | مطابق | YES | runtime مقيد لاحقًا |
| RT-01 | accepted fix | فعّال | YES | لا replay |
| RT-03 | UNKNOWN fix | فعّال | YES | لا replay |
| RT-04 | issued fix | فعّال | YES | لا replay |
| RLS | منع الوصول المباشر | متحقق للجداول المطلوبة | YES | hardening المؤجل موضح |
| RPC grants | فصل العميل والخدمة | متحقق | YES | راقب grants الجديدة |
| Ticket records | private + evidence constraints | موجودة | YES | اختبار أدلة لاحقًا |
| MyTrips | owner-scoped projections | مطابقة | YES | اختبار عزل مستخدمين لاحقًا |
| Edge Function | inspection لا confirmation | متوافق | YES | لا deploy |
| Migration ledger | 14 applied + PLAN_ONLY محلي | مطابق منطقيًا | YES | لا تعالج timestamps بالـapply |

## 24. DRIFT

- **Timestamp drift:** مفهوم ومربوط لكل migrations.
- **Function semantic drift:** لم يُكتشف ضمن المجموعة المفحوصة.
- **Formatting drift:** دالة إيصال واحدة، بلا اختلاف منطقي.
- **Documentation:** سجل C1 تأكد حديثًا؛ بعض الوثائق الأقدم تظل snapshots تاريخية.
- **Legacy identity:** حالته الآن INACTIVE، بخلاف الملاحظات الأقدم.

## 25. BLOCKERS

لا blocker لبدء **مرحلة منفصلة لاختبارات Staging المقيدة**، بشرط synthetic fixtures وrollback وعزل المستخدمين وعدم تشغيل مورد حي.

هذا ليس تصريحًا عامًا بالكتابة أو جاهزية Production. اختبارات concurrency والتنفيذ الفعلي لم تُعد في S1-A.

## 26. WRITE AUTHORIZATION DECISION

**A. STAGING ALREADY MATCHES CANONICAL — NO MIGRATION APPLY NEEDED**

يجوز الانتقال إلى تخطيط/اعتماد مرحلة runtime مقيدة منفصلة. **لا migration مطلوبة أو مأذون بتطبيقها الآن.**

انتهت Phase A دون كتابة على Staging، ودون تعديل Git. الاستثناء الوحيد المتعلق بـLegacy كان قراءة هويته المصرّح بها؛ لم يُلمس محتواه أو إعداداته.

S1-A RESULT: MATCH  
CANONICAL C1 VERIFIED: YES  
STAGING PROJECT VERIFIED: YES  
PAYMENT AUTHORITY MATCHES: YES  
PSP REJECTED ACTIVE: YES  
B13 EFFECTIVE: YES  
B14 EFFECTIVE: YES  
RT-01 EFFECTIVE: YES  
RT-03 EFFECTIVE: YES  
RT-04 EFFECTIVE: YES  
RLS SECURITY ACCEPTABLE: YES  
MIGRATION DRIFT RESOLVED: YES  
SAFE TO BEGIN CONTROLLED STAGING RUNTIME TESTS: YES  
SAFE TO APPLY ANY MIGRATION: NO  
PRODUCTION TOUCHED: NO  
LEGACY PROJECT TOUCHED: NO  
LIVE SUPPLIERS ENABLED: NO
