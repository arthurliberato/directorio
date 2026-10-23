// Runtime env first (so the host can flip SITE_MODE without a rebuild), build-time env as fallback.
const env = (k: string): string | undefined => (typeof process !== 'undefined' ? process.env[k] : undefined) ?? (import.meta as any).env?.[k];

export const BRAND = 'guiddo';
/** Name of the WhatsApp channel / platform as users see it in chat. */
export const BOT_NAME = env('WHATSAPP_BOT_NAME') ?? 'guiddo';
export const SITE_URL = (env('PUBLIC_SITE_URL') ?? 'https://guiddo.net').replace(/\/$/, '');
// prototype => seed data: whole site noindex + robots Disallow:/ (never let illustrative data get indexed)
export const SITE_MODE: 'prototype' | 'production' = env('SITE_MODE') === 'production' ? 'production' : 'prototype';
export const PUBLISH_EXEQUATUR_IDENTIFIER = env('PUBLISH_EXEQUATUR_IDENTIFIER') === 'true';
export const INDEXNOW_KEY = env('INDEXNOW_KEY') ?? '';

export const MIN_DOCTORS_FOR_HUB_INDEX = 5;
export const MIN_VERIFIED_POINTS_FOR_PROFILE = 3;
export const PAGE_SIZE = 20;
export const SITEMAP_URLS_PER_FILE = 50000;

export const NAP = {
  name: BRAND,
  email: 'contacto@guiddo.net',
  street: env('NAP_STREET') ?? '', // only shown when set: never a made-up address
  locality: 'Santo Domingo',
  country: 'DO',
  countryName: 'República Dominicana',
};

// Analytics (SPEC §11): GA4 loads only when an ID is configured.
export const GA4_ID = env('PUBLIC_GA4_ID') ?? '';
