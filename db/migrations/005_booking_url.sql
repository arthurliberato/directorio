-- Online booking link for verified doctors (Cal.com, Calendly, or any https page). Optional.
alter table doctors add column if not exists booking_url text;
