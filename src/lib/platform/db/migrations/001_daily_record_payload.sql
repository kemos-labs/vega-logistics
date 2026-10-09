-- Manual optional-sync migration. No historic cash values are invented.
begin;
alter table public.daily_records add column if not exists record_payload jsonb;
alter table public.daily_records drop constraint if exists daily_records_payload_v1_check;
alter table public.daily_records add constraint daily_records_payload_v1_check
  check (record_payload is null or (
    jsonb_typeof(record_payload) = 'object'
    and record_payload ?& array['version', 'record']
    and record_payload @> '{"version":1}'::jsonb
    and jsonb_typeof(record_payload -> 'record') = 'object'
    and (record_payload -> 'record') ? 'date'
    and jsonb_typeof(record_payload -> 'record' -> 'date') = 'string'
    and record_payload -> 'record' ->> 'date' = report_date::text
  ));
commit;
