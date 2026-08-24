import { describe, it, expect } from 'vitest';
import { parseRecipe } from './ingestion';

describe('parseRecipe', () => {
  it('reads a plain metric recipe', () => {
    const d = parseRecipe(`Old Fashioned
50 ml bourbon
10 ml sugar syrup
2 dashes Angostura bitters
Stir over ice. Rocks glass. Garnish with an orange twist.`);
    expect(d.name).toBe('Old Fashioned');
    expect(d.components).toEqual([
      { amount: 50, unit: 'ml', name: 'bourbon', source: '50 ml bourbon' },
      { amount: 10, unit: 'ml', name: 'sugar syrup', source: '10 ml sugar syrup' },
      { amount: 2, unit: 'dash', name: 'Angostura bitters', source: '2 dashes Angostura bitters' },
    ]);
    expect(d.method).toBe('stirred');
    expect(d.glass).toBe('Rocks');
    expect(d.garnish).toBe('an orange twist');
  });

  it('handles no space between amount and unit', () => {
    expect(parseRecipe('50ml gin').components[0]).toMatchObject({ amount: 50, unit: 'ml', name: 'gin' });
  });

  it('parses mixed numbers written as "1 1/2"', () => {
    expect(parseRecipe('1 1/2 oz rye').components[0]).toMatchObject({ amount: 1.5, unit: 'oz', name: 'rye' });
  });

  it('parses vulgar fractions', () => {
    expect(parseRecipe('¾ oz lime juice').components[0]).toMatchObject({ amount: 0.75, unit: 'oz' });
    expect(parseRecipe('1½ oz gin').components[0]).toMatchObject({ amount: 1.5, unit: 'oz' });
  });

  it('normalises unit spellings', () => {
    const d = parseRecipe(`2 ounces gin
3 dashes orange bitters
1 teaspoon syrup`);
    expect(d.components.map(c => c.unit)).toEqual(['oz', 'dash', 'tsp']);
  });

  it('strips list bullets', () => {
    const d = parseRecipe(`- 50 ml gin
* 20 ml lemon`);
    expect(d.components.map(c => c.name)).toEqual(['gin', 'lemon']);
  });

  it('reads explicit labelled fields over prose', () => {
    const d = parseRecipe(`Daiquiri
Method: shaken
Glass: coupe
Garnish: lime wheel
60 ml rum`);
    expect(d.method).toBe('shaken');
    expect(d.glass).toBe('coupe');
    expect(d.garnish).toBe('lime wheel');
    expect(d.name).toBe('Daiquiri');
  });

  it('treats a bare count as dashes only for bitters', () => {
    expect(parseRecipe('2 Angostura').components[0]).toMatchObject({ amount: 2, unit: 'dash' });
    // Not bitters: refuse rather than invent a unit the user never wrote.
    const d = parseRecipe('2 limes');
    expect(d.components).toHaveLength(0);
    expect(d.unparsed).toEqual(['2 limes']);
  });

  it('reports lines that look like ingredients but could not be read', () => {
    const d = parseRecipe(`Negroni
30 ml gin
a splash of something`);
    expect(d.components).toHaveLength(1);
    expect(d.unparsed).toEqual([]);           // prose, not an ingredient line
    expect(parseRecipe('3 glugs of vermouth').unparsed).toEqual(['3 glugs of vermouth']);
  });

  it('does not mistake an instruction line for the title', () => {
    const d = parseRecipe(`Shake hard and double strain.
50 ml gin`);
    expect(d.name).toBeNull();
    expect(d.method).toBe('shaken');
  });

  it('survives an empty or junk paste without throwing', () => {
    expect(parseRecipe('').components).toEqual([]);
    expect(parseRecipe('\n\n   \n').name).toBeNull();
  });

  it('keeps the source line so the UI can show what it read', () => {
    expect(parseRecipe('  50 ml   gin  ').components[0].source).toBe('50 ml gin');
  });
});
