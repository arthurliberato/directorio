import { readFileSync } from 'node:fs';
// Applies every migration the app needs, in order (the reviews migration is intentionally skipped: phase 2).
export const MIGRATIONS = ['001_core.sql', '003_ai_visibility.sql', '004_listing_tiers.sql', '005_booking_url.sql', '006_appointment_requests.sql', '007_doctor_mentions.sql', '008_profession.sql'];
export const schemaSql = () => MIGRATIONS.map((f) => readFileSync(new URL(`../db/migrations/${f}`, import.meta.url), 'utf8')).join('\n');
