# Hotels V2 canonical contract — MS-11 H1

Status: H1 fixture-backed provider-neutral foundation. No live supplier validation or booking capability is claimed.

## Identity and mapping

`canonicalHotelId`, `canonicalRoomId`, and `canonicalRateId` are opaque Hajiz identifiers. Provider identity and supplier hotel/room/rate references remain internal to adapters. Property matching never uses the name alone: direct provider identity is preferred, then a deterministic composite of country, city, normalized address and coordinates. Outcomes are `mapped`, `unmapped`, or `ambiguous`; ambiguity fails closed and is not merged.

Room identity includes category, bed, occupancy, size and view when available. Rate identity includes canonical room, board, cancellation policy, refundability, occupancy, stay dates and tax inclusion. Property-level and rate-level dedupe are deterministic. Public ranking may use only Hajiz display totals, never raw supplier net.

## Browser authority

Browser routes carry only canonical/opaque Hajiz IDs. Provider identifiers, supplier hotel/room/rate identifiers, price and net are rejected as client authority. The server/adaptor boundary will resolve authoritative state in H2. The old synthetic keys are accepted only as non-authoritative input aliases for presentation regression compatibility.

## Hotel Detail

The H1 Hotel Detail contract is supplier-neutral and fixture-backed: canonical identity, public property content, stay, canonical rooms/rates, synthetic marker and expiry. Missing or expired details fail closed.

## Guest Details and Review

Guest fields are local component state only. PII is forbidden in URL, browser storage, analytics and logs. H1 creates no booking and no payment. Review displays hotel, room, board, cancellation, dates, nights, guests, final display amount and currency. `continueToPayment` is explicitly `NOT_YET_WIRED`; the browser cannot submit provider references or authoritative price/net.

## Hold semantics

H1 performs no fake hold. The future capability model is `holdAvailable`, `holdType`, `holdUntil`, `priceGuaranteedUntil`, and `supplierHoldCost`. Fixtures declare `false`, `none`, and `null` values.

## Supplier capability boundary

The future interface lists `search_hotels`, `get_hotel_details`, `get_room_rates`, `reprice_rate`, `hold_room`, `create_booking`, `get_booking_status`, `cancel_booking`, and `retrieve_voucher`. H1 implements deterministic synthetic reads only. The adapter declares `synthetic:true`, `network:false`, `productionAllowed:false` and its constructor fails closed in production. Mutating and live operations return `NOT_IMPLEMENTED_H2`.

The legacy `search-hotels` Edge Function/prototype, where present, is reference/mock material only and is not an authority or integration target for H1.

## MS-11 decision

MS-11 is **CLOSED for the provider-neutral H1 canonical property + room mapping foundation**: contracts, deterministic implementation, ambiguity handling and tests are present. This does not claim live supplier validation, live inventory, repricing, holds, credentials, booking, payment, voucher, cancellation, refund, production FX or deployment.

## H2 only

Validate mappings against a real supplier sandbox; add server-owned persistence and mapping operations; implement live detail/rates and authoritative reprice; then design real hold semantics if supported. Booking/payment remain gated behind their own approved commerce integration.
