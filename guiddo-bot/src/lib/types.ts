export type IndexStatus = 'auto' | 'force_index' | 'force_noindex';
export type Gender = 'f' | 'm';
export type ListingStatus = 'draft' | 'listed' | 'affiliated';

export interface Specialty {
  id: number; slug: string; // plural, no accents: cardiologos
  name_singular: string; name_plural: string; // Cardiología / Cardiólogos
  field_name: string; // Cardiología
  agent_f: string; agent_m: string; // cardióloga / cardiólogo
  schema_enum: string | null; // schema.org MedicalSpecialty value; null when schema.org has no matching term (never guess)
  icon: string;
}
export interface City { id: number; slug: string; name: string; province: string; }
export interface Sector { id: number; slug: string; name: string; city_id: number; }
export interface Ars { id: number; slug: string; name: string; }
export interface Facility {
  id: number; slug: string; name: string; type: 'Hospital' | 'MedicalClinic';
  address: string; city_id: number; sector_id: number | null; phone: string | null; website: string | null;
  lat: number | null; lng: number | null; updated_at: string;
}
export interface ScheduleEntry { day: 1 | 2 | 3 | 4 | 5 | 6 | 7; open: string; close: string; } // 1=Mon
export interface Location {
  id: number; doctor_id: number; facility_id: number | null; address: string;
  sector_id: number | null; city_id: number; lat: number | null; lng: number | null;
  suite: string | null; phone_ext: string | null;
  schedule: ScheduleEntry[]; phone: string | null;
}
export interface Doctor {
  id: number; slug: string; full_legal_name: string; display_name: string; gender: Gender | null;
  specialty_id: number; subspecialties: string[];
  exequatur_number: string | null; exequatur_decree: string | null;
  exequatur_verified_at: string | null; cmd_member: boolean; cmd_verified_at: string | null;
  specialty_verified_at: string | null; claimed: boolean; claimed_at: string | null;
  bio: string | null; education: string[]; languages: string[]; photo_url: string | null;
  consultation_fee_min: number | null; consultation_fee_max: number | null; currency: 'DOP';
  accepting_new_patients: boolean | null;
  whatsapp: string | null; phone: string | null; website: string | null;
  gbp_url: string | null; sameas_urls: string[];
  data_verified_at: string | null; updated_at: string;
  index_status: IndexStatus;
  sponsored: boolean;
  listing_status: ListingStatus;
  booking_url: string | null;
  source_name: string | null; source_url: string | null; source_retrieved_at: string | null;
}
export type MentionKind = 'press' | 'article' | 'video' | 'social';
export type MentionTextOrigin = 'excerpt' | 'summary';
/** Press / article / video / social post about a doctor, added and reviewed by a person. Shown on affiliated profiles only. */
export interface DoctorMention {
  id: number; doctor_id: number; kind: MentionKind; title: string; source_name: string; url: string;
  published_on: string | null; summary: string | null; summary_origin: MentionTextOrigin | null;
  published: boolean; checked_at: string | null;
}
export interface DoctorArs { doctor_id: number; ars_id: number; verified_at: string; }
export interface Guide {
  id: number; slug: string; title: string; category: string; icon: string;
  answer_summary: string; body: string[]; read_minutes: number;
  reviewer_doctor_id: number; reviewed_at: string;
  sources: { title: string; url: string }[];
  related_specialty_slugs: string[];
}
export interface RedirectRow { from_path: string; to_path: string; status: 301; }
