# HAJIZ — STAGING CONTROLLED RUNTIME GATE S1-B

Run: S1B_20260904T193653536Z_795dfb89

S1-B RESULT: FAIL

## B13 CONCURRENCY

Status: PASS
Objective: Real lock competition across prepare/mark; no duplicate execution/operation/send
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Real lock competition across prepare/mark; no duplicate execution/operation/send

## B13 CRASH WINDOW

Status: PASS
Objective: Committed REQUEST_SENT survives session loss; recovery never grants a blind second send
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Committed REQUEST_SENT survives session loss; recovery never grants a blind second send

## B14 CONCURRENCY

Status: PASS
Objective: B13 completion and B14 prepare/mark use real competing sessions
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: B13 completion and B14 prepare/mark use real competing sessions

## B14 CRASH WINDOW

Status: PASS
Objective: Committed request -> closed sender -> UNKNOWN recovery -> durable issued evidence, no reissue
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Committed request -> closed sender -> UNKNOWN recovery -> durable issued evidence, no reissue

## PAYMENT AUTHORITY

Status: PASS
Objective: PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED; B11/B12 lineage and Model B
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED; B11/B12 lineage and Model B

## BANKAK

Status: PASS
Objective: Receipt ownership, consumption/reuse/expiry; finance review cannot supplier-confirm
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Receipt ownership, consumption/reuse/expiry; finance review cannot supplier-confirm

## PSP

Status: PASS
Objective: Confirmed/rejected; same provider event cannot have duplicate financial effects
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Confirmed/rejected; same provider event cannot have duplicate financial effects

## RLS / IDOR

Status: PASS
Objective: Normal authenticated A/B and anonymous paths; never postgres as user evidence
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Normal authenticated A/B and anonymous paths; never postgres as user evidence

## TICKET ARTIFACT GATE

Status: PASS
Objective: Only trusted AVAILABLE artifact grants download; payment/PNR/reference/NONE/METADATA_ONLY do not
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Only trusted AVAILABLE artifact grants download; payment/PNR/reference/NONE/METADATA_ONLY do not

## MY TRIPS

Status: PASS
Objective: Owner-scoped real projections and no internal financial/storage/operation leakage
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Assertions passed; exact safe states and timing in evidence.json
Cleanup: PASS
Invariant: Owner-scoped real projections and no internal financial/storage/operation leakage

## EXPIRY

Status: FAIL
Objective: Server-time expiry cannot be bypassed by caller-supplied event time
Setup: unique mock-provider fixtures; real Auth identities; normal existing RPCs
Records: see journal.fixtures and evidence.json; all scoped to S1B_20260904T193653536Z_795dfb89
Identities: d72ac157-1960-41d8-8b51-36bc9181f416, 1f86d35c-1aa6-4759-b689-20b14196529a
Observed: Not proven; no softened gate
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
EXPIRY: FAIL
DELETABLE TEST DATA CLEANUP: PASS
IMMUTABLE SYNTHETIC RESIDUE: YES
IMMUTABLE RESIDUE WITHIN DECLARED BUDGET: YES
RESIDUE LEDGER COMPLETE: YES
REAL PII RETAINED: NO
LIVE-SUPPLIER-ELIGIBLE TEST DATA RETAINED: NO
PRODUCTION TOUCHED: NO
LEGACY TOUCHED: NO
LIVE SUPPLIER TOUCHED: NO
SAFE TO START HOTELS H2 / PRODUCT P2: NO

Safe blocker: EXPIRED_CONFIRMATION_FAILS_CLOSED
Failing preflight stage: FIXTURE_CREATION
Subsystem: other
Safe error code: UNAVAILABLE
Sanitized error message: Assertion failed
Exception: Error
Network connection established before failure: YES
Target category: HAJIZ STAGING
Failure timestamp: 2026-09-04T19:40:20.062Z
