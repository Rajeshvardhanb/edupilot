/**
 * Free WhatsApp option: a wa.me link opens WhatsApp (phone or web) with the message already typed,
 * and the staff member presses Send from their own number. Nothing is sent automatically.
 */
export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const number = digits.length === 10 ? `91${digits}` : digits; // assume India when no country code
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
