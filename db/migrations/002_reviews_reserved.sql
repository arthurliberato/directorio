-- PHASE 2 — NOT APPLIED IN V1 (SPEC §12). Reserved so the model is ready; do not run until legal review (Ley 172-13).
create table consents (
  id bigserial primary key, subject_ref text not null, purpose text not null, text_version text not null,
  granted_at timestamptz not null, revoked_at timestamptz, channel text not null
);
create table reviews (
  id bigserial primary key, doctor_id int not null references doctors, location_id int references locations,
  rating smallint not null check (rating between 1 and 5), attributes jsonb,        -- puntualidad, trato, explicación, instalaciones
  body text, display_name text,
  verification_level text not null check (verification_level in ('booking','doctor_invite','proof','unverified')),
  verification_evidence_ref text, consent_record_id bigint references consents,
  status text not null default 'pending' check (status in ('pending','published','under_review','removed')),
  created_at timestamptz not null default now(), published_at timestamptz, doctor_reply text, doctor_reply_at timestamptz
);
