-- Verified (affiliated) vs listed (public-source) doctors, optional sector, provenance, clinic suite + extension.
-- Safe to run once on a database that already has 001 and 003.

create type listing_status as enum ('draft', 'listed', 'affiliated');

alter table doctors
  add column listing_status listing_status not null default 'draft',   -- draft = hidden; listed = public-source profile; affiliated = verified affiliate
  add column source_name text,                                         -- where the public data came from (e.g. HOMS)
  add column source_url text,
  add column source_retrieved_at date,
  alter column gender drop not null;                                   -- unknown gender => neutral wording, no title

-- Keep what was already visible visible.
update doctors set listing_status = 'listed' where exequatur_verified_at is not null;

-- An affiliate is by definition credential-verified.
alter table doctors add constraint affiliated_requires_exequatur check (listing_status <> 'affiliated' or exequatur_verified_at is not null);

alter table locations
  alter column sector_id drop not null,
  add column suite text,          -- "consultorio 405, 4.º piso"
  add column phone_ext text;      -- extension on the clinic switchboard

create index doctors_listing_status_idx on doctors (listing_status);
