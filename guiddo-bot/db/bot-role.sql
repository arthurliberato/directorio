-- Database role for guiddo-bot. Run once as the database owner (Supabase: SQL editor), after replacing the password.
-- The bot reads the catalog and writes ONLY appointment_requests (the requests patients send to verified doctors).
create role guiddo_bot login password 'CHANGE-ME' nobypassrls;

grant usage on schema public to guiddo_bot;
grant select on specialties, cities, sectors, ars, facilities, doctors, locations, doctor_ars, guides, redirects to guiddo_bot;
grant select, insert, update on appointment_requests to guiddo_bot;
grant usage, select on sequence appointment_requests_id_seq to guiddo_bot;

-- appointment_requests has RLS enabled (migration 006) and no policies, so a role without BYPASSRLS sees nothing.
-- Give the bot exactly the access it needs; any other table with RLS enabled needs its own policy the same way.
create policy guiddo_bot_all on appointment_requests for all to guiddo_bot using (true) with check (true);
do $$ declare t text; begin
  foreach t in array array['specialties','cities','sectors','ars','facilities','doctors','locations','doctor_ars','guides','redirects'] loop
    if (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      execute format('create policy guiddo_bot_read on %I for select to guiddo_bot using (true)', t);
    end if;
  end loop;
end $$;
