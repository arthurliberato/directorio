-- WhatsApp bot conversation state that must survive between serverless invocations: "this patient is writing an appointment
-- request for doctor X". Expires after 30 minutes (checked on read). Contains the patient's number: admin-only.
create table if not exists bot_pending (
  phone text primary key,
  doctor_slug text not null,
  created_at timestamptz not null default now()
);
alter table bot_pending enable row level security;
