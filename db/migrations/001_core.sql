-- Core schema (SPEC §2). Postgres / Supabase.
create extension if not exists pgcrypto;

create table specialties (
  id serial primary key, slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_singular text not null, name_plural text not null, field_name text not null,
  agent_f text not null, agent_m text not null,            -- cardióloga / cardiólogo (profile grammar)
  schema_enum text not null,                               -- schema.org MedicalSpecialty value
  icon text
);
create table cities (id serial primary key, slug text unique not null, name text not null, province text not null);
create table sectors (id serial primary key, slug text not null, name text not null, city_id int not null references cities, unique (city_id, slug));
create table ars (id serial primary key, slug text unique not null, name text not null);

create table facilities (
  id serial primary key, slug text unique not null, name text not null,
  type text not null check (type in ('Hospital','MedicalClinic')),
  address text not null, city_id int not null references cities, sector_id int references sectors,
  phone text, website text, lat double precision, lng double precision, updated_at timestamptz not null default now()
);

create type index_status as enum ('auto','force_index','force_noindex');
create table doctors (
  id serial primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),   -- reserved slugs enforced by trigger below
  full_legal_name text not null, display_name text not null, gender char(1) not null check (gender in ('f','m')),
  specialty_id int not null references specialties, subspecialties text[] not null default '{}',
  exequatur_number text, exequatur_decree text,
  cedula_hash text,                                                      -- never display cédula
  exequatur_verified_at timestamptz, cmd_member boolean not null default false, cmd_verified_at timestamptz,
  specialty_verified_at timestamptz, claimed boolean not null default false, claimed_at timestamptz,
  bio text, education text[] not null default '{}', languages text[] not null default '{es}', photo_url text,
  consultation_fee_min int, consultation_fee_max int, currency char(3) not null default 'DOP',
  accepting_new_patients boolean,
  whatsapp text, phone text, website text, gbp_url text, sameas_urls text[] not null default '{}',
  data_verified_at timestamptz, updated_at timestamptz not null default now(),
  index_status index_status not null default 'auto',
  sponsored boolean not null default false
);
create index on doctors (specialty_id) where exequatur_verified_at is not null;

create table locations (
  id serial primary key, doctor_id int not null references doctors on delete cascade, facility_id int references facilities,
  address text not null, sector_id int not null references sectors, city_id int not null references cities,
  lat double precision, lng double precision,
  schedule jsonb not null default '[]',                                  -- [{day:1..7, open:"08:00", close:"12:00"}]
  phone text
);
create index on locations (doctor_id); create index on locations (city_id, sector_id);

create table doctor_ars (doctor_id int references doctors on delete cascade, ars_id int references ars, verified_at timestamptz not null, primary key (doctor_id, ars_id));

create table guides (
  id serial primary key, slug text unique not null, title text not null, category text, icon text, read_minutes int,
  answer_summary text not null,
  body jsonb not null, reviewer_doctor_id int not null references doctors, reviewed_at date not null,
  sources jsonb not null default '[]', related_specialty_ids int[] not null default '{}'
);

create table verification_log (
  id bigserial primary key, doctor_id int not null references doctors on delete cascade,
  type text not null check (type in ('exequatur','cmd','claim')), method text not null, result text not null,
  evidence_hash text, checked_at timestamptz not null default now(), checked_by text not null
);

create table redirects (from_path text primary key, to_path text not null, status int not null default 301 check (status = 301));

-- Index-status log written by the nightly job (SPEC §4.3): URL, old, new, reason.
create table index_status_log (
  id bigserial primary key, url text not null, old_status text, new_status text not null, reason text not null, changed_at timestamptz not null default now()
);

-- Last computed index state per URL; diffed by the nightly job to decide IndexNow pings.
create table url_index_state (url text primary key, status text not null check (status in ('index','noindex')), reason text not null, lastmod date not null);

-- Reserved root slugs can never be doctors (SPEC §3). Specialty slugs are checked too.
create or replace function reject_reserved_slug() returns trigger language plpgsql as $$
begin
  if new.slug = any (array['especialidad','ciudad','ars','guia','centro','en','metodologia','quienes-somos','como-verificamos',
      'politica-editorial','publicidad-y-patrocinios','privacidad','contacto','buscar','api','admin','pagina','llms.txt','robots.txt'])
     or new.slug like 'sitemap%' or exists (select 1 from specialties where slug = new.slug) then
    raise exception 'slug % is reserved', new.slug;
  end if;
  return new;
end $$;
create trigger doctors_reserved_slug before insert or update of slug on doctors for each row execute function reject_reserved_slug();

-- Slug change => automatic 301 (never break old URLs).
create or replace function record_slug_redirect() returns trigger language plpgsql as $$
begin
  if old.slug <> new.slug then
    insert into redirects (from_path, to_path) values ('/' || old.slug, '/' || new.slug) on conflict (from_path) do update set to_path = excluded.to_path;
  end if;
  return new;
end $$;
create trigger doctors_slug_redirect after update of slug on doctors for each row execute function record_slug_redirect();

-- Overdue re-verification (every 6 months, SPEC §2).
create view doctors_needing_reverification as
  select id, slug, exequatur_verified_at from doctors
  where exequatur_verified_at is not null and exequatur_verified_at < now() - interval '6 months';
