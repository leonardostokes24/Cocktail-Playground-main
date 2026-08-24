import { describe, it, expect } from 'vitest';
import { slugify } from './venues';

describe('slugify', () => {
  it('makes a url-safe handle', () => {
    expect(slugify('Kiyori Bar')).toBe('kiyori-bar');
  });
  it('drops punctuation and collapses whitespace', () => {
    expect(slugify("  The  Dead Rabbit's & Co.  ")).toBe('the-dead-rabbits-co');
  });
  it('keeps accented letters readable rather than dropping the word', () => {
    expect(slugify('Café Pacífico')).toBe('cafe-pacifico');
  });
  it('caps length so the unique column is never overrun', () => {
    expect(slugify('a'.repeat(200)).length).toBe(60);
  });
  it('returns empty for a name with nothing usable, so the caller can store null', () => {
    expect(slugify('///')).toBe('');
  });
});
