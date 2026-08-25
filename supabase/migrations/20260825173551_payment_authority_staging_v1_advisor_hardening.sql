-- Make server-only intent explicit to the RLS advisor as defense in depth.
create policy fx_config_server_only on public.fx_config for all to anon, authenticated using (false) with check (false);
create policy offers_server_only on public.offers for all to anon, authenticated using (false) with check (false);
create policy traveler_tokens_server_only on public.traveler_tokens for all to anon, authenticated using (false) with check (false);
create policy payment_provider_events_server_only on public.payment_provider_events for all to anon, authenticated using (false) with check (false);
create policy payment_audit_server_only on public.payment_audit for all to anon, authenticated using (false) with check (false);

create index bookings_offer_id_idx on public.bookings(offer_id);
create index fx_config_created_by_idx on public.fx_config(created_by);
create index payment_provider_events_payment_id_idx on public.payment_provider_events(payment_id);
create index payment_receipts_user_id_idx on public.payment_receipts(user_id);
create index payments_reviewer_id_idx on public.payments(reviewer_id);
create index traveler_tokens_user_id_idx on public.traveler_tokens(user_id);
