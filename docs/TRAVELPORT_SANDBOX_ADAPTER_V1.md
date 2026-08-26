# Travelport Sandbox Adapter V1

This server-only adapter targets Travelport TripServices Flights v11 **pre-production only**. It does not select suppliers, set HAJIZ selling prices, persist data, transition booking/payment state, or expose provider references, economics, or raw responses to browsers.

Implemented and capability-gated: OAuth 2.0 password-grant token reuse, journey Search (`catalog/search/catalogproductofferings`), normalization into the private HAJIZ supplier shape, and reference AirPrice (`price/offers/buildfromcatalogproductofferings`). Search requests use `offersPerPage` so Travelport caches the journey for reference repricing.

Configuration is server-side only: `TRAVELPORT_USERNAME`, `TRAVELPORT_PASSWORD`, `TRAVELPORT_CLIENT_ID`, `TRAVELPORT_CLIENT_SECRET`, and optional `TRAVELPORT_ACCESS_GROUP`. With any required value absent, search/reprice capabilities are disabled and fail closed. No credentials were available during implementation, so no live sandbox assertion is made.

Booking, reservation retrieval/status, confirmation, cancellation, and ticketing are deliberately disabled. Travelport booking is a multi-step workbench flow and the repository has no verified traveler-token resolver or provisioned-content contract to map it safely. These methods remain contract stubs that fail via capability checks; ticket issuance is not claimed.

Official references reviewed (2026-08-26): Travelport Flights v11 endpoints, OAuth authentication, Search API Reference, and AirPrice Reference Payload API Reference in `support.travelport.com/webhelp/JSONAPIs/Airv11`.
