-- Press, articles, videos and social posts about a verified doctor, shown on the profile ("En los medios y publicaciones").
-- Every row is added by a person (never scraped) and only shown when `published` is true, which requires a review date.
-- The site shows them for affiliated doctors only; the database does not enforce the tier (a doctor can be demoted later).
create table if not exists doctor_mentions (
  id bigserial primary key,
  doctor_id bigint not null references doctors(id) on delete cascade,
  kind text not null check (kind in ('press', 'article', 'video', 'social')),
  title text not null check (char_length(title) between 3 and 200),
  source_name text not null check (char_length(source_name) between 2 and 100),
  url text not null check (url ~* '^https://[^ ]+$'),
  published_on date,
  -- Photo of the item (its cover image): an https URL or a site path such as /img/x.jpg. Required to publish.
  image_url text check (image_url ~* '^(https://[^ ]+|/[a-z0-9._/-]+)$'),
  -- Text shown under the link. excerpt = literal quote from the item; summary = written by guiddo and checked against the original.
  summary text check (char_length(summary) <= 600),
  summary_origin text check (summary_origin in ('excerpt', 'summary')),
  published boolean not null default false,
  checked_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, url),
  check (summary is null or summary_origin is not null),
  check (not published or checked_at is not null),
  check (not published or image_url is not null)
);
create index if not exists doctor_mentions_doctor_idx on doctor_mentions (doctor_id, published_on desc);
