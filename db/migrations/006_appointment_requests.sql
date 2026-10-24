-- Appointment requests collected by the guiddo WhatsApp bot for verified doctors. Holds the patient's WhatsApp number and
-- a short free-text message (name + preferred day/time; the bot tells people not to send medical details). Admin-only.
create table if not exists appointment_requests (
  id bigserial primary key,
  doctor_id bigint not null references doctors(id) on delete cascade,
  patient_phone text not null,
  message text not null,
  status text not null default 'received' check (status in ('received', 'forwarded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  forwarded_at timestamptz
);
create index if not exists appointment_requests_doctor_idx on appointment_requests (doctor_id, created_at desc);
-- Personal data: never readable through Supabase's public API. The app connects with the database role directly.
alter table appointment_requests enable row level security;
