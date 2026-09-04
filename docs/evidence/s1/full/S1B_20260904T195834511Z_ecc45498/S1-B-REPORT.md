# HAJIZ — STAGING CONTROLLED RUNTIME GATE S1-B

Run: S1B_20260904T195834511Z_ecc45498

S1-B RESULT: PASS

## B13 CONCURRENCY

Status: PASS
Objective: Real lock competition across prepare/mark; no duplicate execution/operation/send
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Real lock competition across prepare/mark; no duplicate execution/operation/send

## B13 CRASH WINDOW

Status: PASS
Objective: Committed REQUEST_SENT survives session loss; recovery never grants a blind second send
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Committed REQUEST_SENT survives session loss; recovery never grants a blind second send

## B14 CONCURRENCY

Status: PASS
Objective: B13 completion and B14 prepare/mark use real competing sessions
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: B13 completion and B14 prepare/mark use real competing sessions

## B14 CRASH WINDOW

Status: PASS
Objective: Committed request -> closed sender -> UNKNOWN recovery -> durable issued evidence, no reissue
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Committed request -> closed sender -> UNKNOWN recovery -> durable issued evidence, no reissue

## PAYMENT AUTHORITY

Status: PASS
Objective: PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED; B11/B12 lineage and Model B
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED; B11/B12 lineage and Model B

## BANKAK

Status: PASS
Objective: Receipt ownership, consumption/reuse/expiry; finance review cannot supplier-confirm
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Receipt ownership, consumption/reuse/expiry; finance review cannot supplier-confirm

## PSP

Status: PASS
Objective: Confirmed/rejected; same provider event cannot have duplicate financial effects
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Confirmed/rejected; same provider event cannot have duplicate financial effects

## RLS / IDOR

Status: PASS
Objective: Normal authenticated A/B and anonymous paths; never postgres as user evidence
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Normal authenticated A/B and anonymous paths; never postgres as user evidence

## TICKET ARTIFACT GATE

Status: PASS
Objective: Only trusted AVAILABLE artifact grants download; payment/PNR/reference/NONE/METADATA_ONLY do not
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Only trusted AVAILABLE artifact grants download; payment/PNR/reference/NONE/METADATA_ONLY do not

## MY TRIPS

Status: PASS
Objective: Owner-scoped real projections and no internal financial/storage/operation leakage
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Owner-scoped real projections and no internal financial/storage/operation leakage

## EXPIRY

Status: PASS
Objective: Server-time expiry cannot be bypassed by caller-supplied event time
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T195834511Z_ecc45498
Identities: 064ea040-a5c2-4b92-afbd-015c6a23091e, c73f6b30-a5fe-4e63-bb2d-99586d7ed355
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Server-time expiry cannot be bypassed by caller-supplied event time

## Final decision

B13 CONCURRENCY: PASS
B13 CRASH WINDOW: PASS
B14 CONCURRENCY: PASS
B14 CRASH WINDOW: PASS
PAYMENT AUTHORITY: PASS
BANKAK: PASS
PSP: PASS
RLS / IDOR: PASS
TICKET ARTIFACT GATE: PASS
MY TRIPS: PASS
EXPIRY: PASS
DELETABLE TEST DATA CLEANUP: PASS
IMMUTABLE SYNTHETIC RESIDUE: YES
IMMUTABLE RESIDUE WITHIN DECLARED BUDGET: YES
RESIDUE LEDGER COMPLETE: YES
REAL PII RETAINED: NO
LIVE-SUPPLIER-ELIGIBLE TEST DATA RETAINED: NO
PRODUCTION TOUCHED: NO
LEGACY TOUCHED: NO
LIVE SUPPLIER TOUCHED: NO
SAFE TO START HOTELS H2 / PRODUCT P2: YES
