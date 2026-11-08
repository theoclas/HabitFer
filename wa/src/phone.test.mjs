// Pruebas de los números. Corren con: npm test (en wa/)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jidToPhone, normalizeDigits } from './phone.mjs';

test('celular colombiano con y sin indicativo', () => {
  assert.equal(normalizeDigits('+57 300 123 4567'), '573001234567');
  assert.equal(normalizeDigits('300 123 4567'), '573001234567');
  assert.equal(normalizeDigits('(300) 123-4567'), '573001234567');
  assert.equal(normalizeDigits('0057 3001234567'), '573001234567');
});

test('otros países quedan igual', () => {
  assert.equal(normalizeDigits('+34 612 345 678'), '34612345678');
  assert.equal(normalizeDigits('+1 (305) 555-0101'), '13055550101');
});

test('lo que no es un número', () => {
  assert.equal(normalizeDigits(''), null);
  assert.equal(normalizeDigits('hola'), null);
  assert.equal(normalizeDigits('12345'), null);
  assert.equal(normalizeDigits('0123456789012'), null);
  assert.equal(normalizeDigits('1234567890123456'), null);
});

test('jid de WhatsApp a número', () => {
  assert.equal(jidToPhone('573001234567:12@s.whatsapp.net'), '573001234567');
  assert.equal(jidToPhone('573001234567@s.whatsapp.net'), '573001234567');
  assert.equal(jidToPhone(undefined), null);
});
