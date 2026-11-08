/** Números de WhatsApp: solo dígitos con indicativo de país (573001234567). */

/** "+57 300 123 4567", "3001234567", "0057…" → "573001234567". null si no parece un número. */
export function normalizeDigits(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Celular colombiano sin indicativo: 10 dígitos que empiezan por 3.
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

/** "573001234567:12@s.whatsapp.net" → "573001234567". */
export function jidToPhone(jid) {
  if (!jid) return null;
  return String(jid).split('@')[0].split(':')[0] || null;
}
