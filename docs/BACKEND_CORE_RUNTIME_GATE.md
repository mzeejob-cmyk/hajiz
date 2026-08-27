# HAJIZ Backend Core Runtime Gate

## Status

**PASS**

- Validated Staging: `pdnuswmljownjzjzpoop`
- Validated remediation source: `20260827171209_payment_event_consumption_and_expiry_v1.sql`
- Validated Git commit and canonical Integration V2 merge point: `b52a325b5c99dfd8f99dfd7af3502ed3690878a3`

## Runtime evidence

The following isolated, synthetic scenarios passed on HAJIZ Staging. The validation transaction was rolled back and retained no synthetic rows.

1. Burn-and-recover: an inapplicable event did not consume its provider event ID, and the same ID later applied successfully.
2. Genuine duplicate: the first applicable event succeeded and the duplicate was a no-op.
3. Cross-payment event reuse: the provider/event identity could not be reused for another payment.
4. Expired PSP confirmation failed closed without consuming the event.
5. NULL PSP expiry failed closed without consuming the event.
6. Direct Bankak `awaiting -> confirmed` was blocked by the payment transition trigger.
7. Bankak `awaiting -> under_review -> confirmed` succeeded through trusted review authority.
8. Confirmed payment advanced its booking only to `payment_confirmed`, not supplier confirmation or ticketing.

## Closure rule

Backend Core is considered **CLOSED for normal product work**.

Any future change to the payment state machine, booking state machine, provider-event idempotency, Bankak authority, or payment-expiry rules must reopen this Runtime Gate and repeat focused validation before the change is treated as canonical.
