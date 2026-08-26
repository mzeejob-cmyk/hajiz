# HAJIZ Hotels and Account design-gap report

## Decision

No Hotel Detail, Hotel Review / Checkout Boundary, or Account / Profile UI is implemented in this branch.

The inspected Figma pages do not contain sufficient design contracts for those screens. Adding them would require inventing product, payment-boundary, or authentication behavior, which is explicitly outside this sprint's presentation-only scope.

## Evidence inspected

- Figma file: `iBE8E9zNJeKEXoKAm1iQm7`
- Hotels page: `18:17` (`12 — Customer · Hotels`)
- Account page requested: `18:21`
- Design-to-code guidance: `resource:figma-design-to-code`
- Codebase baseline: commit `b621730e278d8af5e867e1a778736b479cb457f6`

The required page-level `get_design_context` calls were attempted first. Figma rejected both page canvases because they are not directly renderable selections. The pages were then inspected structurally, and `get_design_context` was successfully retrieved for the concrete hotel frames `76:675` and `77:915`.

## Hotels page findings (`18:17`)

The page contains these explicit screen contracts:

| Node | Contract |
| --- | --- |
| `75:2` | Hotels · Search Results · Desktop |
| `75:504` | Hotels · Search Results · Mobile |
| `75:876` | Hotels · Filters · Mobile Sheet |
| `76:675` | Hotels · Room Selection · Desktop |
| `76:927` | Hotels · Room Selection · Mobile |
| `77:915` | Hotels · Guest Details · Desktop |
| `77:1099` | Hotels · Guest Details · Mobile |

These correspond to the existing presentation flow in `src/features/hotels`: search results, room selection, and guest details.

The page does **not** contain a frame named or structured as:

- Hotel Detail (property overview, gallery, amenities, policies, location, or room-entry boundary)
- Hotel Review
- Hotel Checkout Review
- Hotel Payment Boundary

Room Selection is not treated as a substitute for Hotel Detail. Guest Details is not treated as a substitute for Review / Checkout Boundary.

## Account page findings (`18:21`)

The requested node does not contain Account / Profile contracts. Its concrete frames are booking-detail and trip-status presentations:

| Node | Contract |
| --- | --- |
| `73:2` | Trips · Booking Detail · Processing · Desktop |
| `73:108` | Trips · Booking Detail · Processing · Mobile |
| `73:168` | Trips · Ticketed State |
| `79:70` | Trips · Hotel Booking · Processing · Desktop |
| `79:160` | Trips · Hotel Booking · Processing · Mobile |
| `79:219` | Trips · Hotel Confirmed & Voucher |

No profile fields, account navigation, identity states, authentication states, consent rules, or save/update contract is present. Therefore the existing `AccountPage` placeholder is unchanged and no authentication behavior is inferred.

## Design inputs required to unblock implementation

### Hotel Detail

- Desktop and mobile frames with a stable node ID
- Property content hierarchy and image assets
- Amenities, location, and policy disclosure rules
- Explicit transition into the existing room-selection presentation
- Wording for availability and price volatility that does not imply live inventory

### Hotel Review / Checkout Boundary

- Desktop and mobile review frames
- Exact selected-stay, guest, room, meal, cancellation, tax, fee, and pay-at-property disclosures
- Clear boundary between review presentation and payment authority
- CTA wording and destination route
- Error/expired-offer presentation, if included in scope

### Account / Profile

- Desktop and mobile frames
- Field definitions, editability, validation, and persistence expectations
- Signed-in, signed-out, loading, empty, success, and failure states as applicable
- Authentication and privacy copy approved as an explicit product contract

## Scope and safety confirmation

- Documentation only; no runtime files changed.
- No network, supplier, booking, payment, or authentication behavior added.
- No production or staging environment accessed.
- No Supabase writes, PR, merge, or deployment performed.
