import { SITE_URL } from '../config.ts';
import type { Doctor } from './types.ts';

/**
 * Normalizes a booking link entered by an admin. Accepts "usuario/evento" or "cal.com/usuario/evento"
 * (Cal.com shorthand) or any https:// URL. Returns null when empty; throws on anything unsafe.
 */
export function normalizeBookingUrl(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  if (!v) return null;
  const withScheme = /^(www\.)?cal\.com\//i.test(v) ? `https://${v.replace(/^www\./i, '')}` : v; // "cal.com/usuario/evento"
  if (withScheme === v && /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9._/-]*$/i.test(v)) return `https://cal.com/${v}`; // "usuario/evento" (the user name has no dots)
  let u: URL;
  try { u = new URL(withScheme); } catch { throw new Error('enlace de reserva no válido: usa https://cal.com/usuario/evento o usuario/evento'); }
  if (u.protocol !== 'https:') throw new Error('el enlace de reserva debe empezar con https://');
  return u.toString();
}

/** Only verified (affiliated) doctors get booking buttons. */
export const canBook = (d: Doctor) => d.listing_status === 'affiliated' && !!(d.whatsapp || d.booking_url);

/** Click-to-chat link with a prefilled message that names the doctor and the profile page. */
export function whatsappBookingLink(d: Doctor, profilePath: string, siteUrl = SITE_URL): string | null {
  const num = d.whatsapp?.replace(/\D/g, '');
  if (!num) return null;
  const text = `Hola, quisiera programar una cita con ${d.display_name}. Vi su perfil en dir.do: ${siteUrl}${profilePath}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
