import { journeyComposer } from './JourneyComposer';

describe('JourneyComposerService.calculateExperienceDensity', () => {
  it('classifies an empty day as very_relaxed', () => {
    expect(journeyComposer.calculateExperienceDensity(0, 0, 0)).toBe('very_relaxed');
    expect(journeyComposer.calculateExperienceDensity(1, 1, 1)).toBe('very_relaxed');
  });

  it('classifies a light day (just past the very_relaxed threshold) as relaxed', () => {
    expect(journeyComposer.calculateExperienceDensity(0, 0, 2)).toBe('relaxed');
    expect(journeyComposer.calculateExperienceDensity(0, 4, 0)).toBe('relaxed');
  });

  it('classifies a moderate day as balanced', () => {
    expect(journeyComposer.calculateExperienceDensity(5, 6, 4)).toBe('balanced');
  });

  it('classifies a packed day as busy', () => {
    expect(journeyComposer.calculateExperienceDensity(9, 9, 7)).toBe('busy');
  });

  it('classifies an extreme day as intense', () => {
    expect(journeyComposer.calculateExperienceDensity(15, 11, 9)).toBe('intense');
  });

  it('lets any single dimension push the day into a higher density tier', () => {
    // 0 km, 0 hours walked, but 9 places scheduled should still count as intense
    expect(journeyComposer.calculateExperienceDensity(0, 0, 9)).toBe('intense');
  });
});
