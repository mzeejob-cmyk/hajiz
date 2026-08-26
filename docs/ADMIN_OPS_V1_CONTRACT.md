# Admin / Operations V1 contract

The active `/admin` route is a Figma-informed, presentation-only shell based on page `18:23` (`30 — Admin`) and verified frame `87:5`.

It supports Bankak review, separate payment/booking states, booking exceptions, mock-supplier failures, and a refund/reconciliation placeholder. The browser has no mutation authority: no database client, service-role key, SQL, provider SDK, refund action, supplier action, or persistence call. Future reads need an approved role-aware RPC; future writes need separately reviewed server contracts.

No Production or Staging project is contacted by this branch.
