import { describe, it, expect } from 'vitest';
import { canWatchSchoolReplay } from './replayVisibility';

describe('canWatchSchoolReplay (api copy)', () => {
  it('admin always passes', () => {
    expect(canWatchSchoolReplay('hidden', 'free', 'admin')).toBe(true);
  });
  it("'all' opens to any plan", () => {
    expect(canWatchSchoolReplay('all', 'free', 'student')).toBe(true);
  });
  it("'paid' needs individual or vip", () => {
    expect(canWatchSchoolReplay('paid', 'free', 'student')).toBe(false);
    expect(canWatchSchoolReplay('paid', 'individual', 'student')).toBe(true);
    expect(canWatchSchoolReplay('paid', 'vip', 'student')).toBe(true);
  });
  it("'hidden', unknown values and missing plan are denied", () => {
    expect(canWatchSchoolReplay('hidden', 'vip', 'student')).toBe(false);
    expect(canWatchSchoolReplay(undefined, 'vip', 'student')).toBe(false);
    expect(canWatchSchoolReplay('paid', null, 'student')).toBe(false);
  });
});
