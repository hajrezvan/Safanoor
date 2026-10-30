import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, formatJalaliYmd, formatRelativeTime, gregorianToJalali, jalaliToGregorian, latinDigits, normalizePersian, normalizePhone, persianDigits, validGregorianDate, validNationalId } from './locale';

test('Persian normalization handles Arabic letters, digits, joiners and marks', () => {
  assert.equal(normalizePersian('  كِيان‌ ياس ۱۲٣ '), 'کیان یاس 123');
  assert.equal(latinDigits('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'), '01234567890123456789');
  assert.equal(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹'), '+989123456789');
});

test('national ID validates check digit and rejects repeated and malformed IDs', () => {
  assert.equal(validNationalId('۰۰۸۴۵۷۵۹۴۸'), true);
  assert.equal(validNationalId('0084575949'), false);
  assert.equal(validNationalId('1111111111'), false);
  assert.equal(validNationalId('123'), false);
});

test('Jalali conversion roundtrips new year and leap days', () => {
  assert.equal(jalaliToGregorian('۱۴۰۳/۰۱/۰۱'), '2024-03-20');
  assert.equal(gregorianToJalali('2024-03-20'), '1403/01/01');
  assert.equal(gregorianToJalali(jalaliToGregorian('1399/12/30')), '1399/12/30');
  assert.throws(() => jalaliToGregorian('1400/12/30'));
  assert.equal(validGregorianDate('2025-02-30'), false);
});

test('age changes precisely on Gregorian UTC birthday', () => {
  assert.equal(ageOn('2008-10-17', new Date('2026-10-16T23:59:59Z')), 17);
  assert.equal(ageOn('2008-10-17', new Date('2026-10-17T00:00:00Z')), 18);
  assert.equal(ageOn('2008-02-29', new Date('2026-02-28T12:00:00Z')), 17);
  assert.equal(ageOn('2008-02-29', new Date('2026-03-01T00:00:00Z')), 18);
});

test('formatRelativeTime uses Persian auto relative units', () => {
  const now = new Date('2026-10-30T12:00:00+03:30');
  assert.equal(formatRelativeTime('2026-10-29T12:00:00+03:30', now), 'دیروز');
  const weekAgo = formatRelativeTime('2026-10-23T12:00:00+03:30', now);
  assert.ok(/روز|هفته/.test(weekAgo), weekAgo);
});

test('persianDigits and formatJalaliYmd use Persian numerals', () => {
  assert.equal(persianDigits(3), '۳');
  assert.equal(persianDigits('12'), '۱۲');
  assert.equal(formatJalaliYmd('2024-03-20'), '۱۴۰۳/۰۱/۰۱');
});
