import { formatDisplayDate, fromIsoDate, toIsoDate, yearsAgo } from '@/lib/dates';
import { personalSchema } from '@/features/onboarding/schemas';

describe('date of birth helpers', () => {
  // protects=a picked birth date is stored as the same calendar day, not shifted by the device time zone;
  // fails_when=the conversion goes through UTC (jest.global-setup.js pins UTC+14, where that shifts every date by a day);
  // no_claim=other offsets are not exercised individually; the native picker's own time zone handling
  it('round-trips a calendar day without shifting', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-14 * 60); // guard: the suite really runs at UTC+14
    for (const iso of ['1990-12-10', '2000-01-01', '1984-02-29', '1999-12-31']) {
      expect(toIsoDate(fromIsoDate(iso)!)).toBe(iso);
    }
  });

  // protects=impossible or malformed dates are rejected; fails_when=Feb 30 or a non-ISO string is accepted; no_claim=locale formats
  it('rejects impossible and malformed dates', () => {
    for (const bad of ['1990-02-30', '1990-13-01', '1990-1-1', '10/12/1990', '']) {
      expect(fromIsoDate(bad)).toBeNull();
    }
  });

  // protects=picker upper bound is exactly 18 years ago today; fails_when=bound is off by a day or a year; no_claim=leap-day birthdays on non-leap years
  it('computes the picker bound as the same day N years ago', () => {
    expect(toIsoDate(yearsAgo(18, new Date(2026, 10, 14)))).toBe('2008-11-14');
  });

  // protects=field shows a readable date and nothing for empty values; fails_when=raw ISO or "Invalid Date" is shown; no_claim=non en-US locales
  it('formats for display', () => {
    expect(formatDisplayDate('1990-12-10')).toBe('Dec 10, 1990');
    expect(formatDisplayDate('')).toBe('');
  });

  // protects=an empty date shows a prompt to pick one, not a format hint; fails_when=the old "YYYY-MM-DD" message appears; no_claim=UI rendering
  it('asks to select a date when empty', () => {
    const r = personalSchema.shape.dateOfBirth.safeParse('');
    expect(r.error?.issues[0]?.message).toBe('Select your date of birth');
  });
});
