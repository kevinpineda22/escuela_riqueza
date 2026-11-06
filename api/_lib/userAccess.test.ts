import { describe, it, expect } from 'vitest';
import { periodEndFor, tempPassword } from './userAccess';

describe('periodEndFor', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');

  it('VIP no tiene vigencia, aunque viniera con fecha', () => {
    expect(periodEndFor('vip', '2026-12-01T00:00:00Z', now)).toBeNull();
    expect(periodEndFor('vip', null, now)).toBeNull();
  });

  it('otro plan conserva la fecha que ya tenía', () => {
    expect(periodEndFor('individual', '2027-01-15T00:00:00Z', now)).toBe('2027-01-15T00:00:00Z');
  });

  it('otro plan sin fecha (venía de VIP o es nuevo) arranca 30 días', () => {
    expect(periodEndFor('individual', null, now)).toBe('2026-12-06T12:00:00.000Z');
    expect(periodEndFor('free', undefined, now)).toBe('2026-12-06T12:00:00.000Z');
  });
});

describe('tempPassword', () => {
  it('son 12 caracteres en bloques de 4, con mayúscula, minúscula y número', () => {
    for (let i = 0; i < 200; i++) {
      const p = tempPassword();
      expect(p).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[2-9]/);
    }
  });

  it('nunca usa caracteres que se confunden al dictarla', () => {
    const all = Array.from({ length: 200 }, tempPassword).join('');
    expect(all).not.toMatch(/[0O1lI]/);
  });
});
