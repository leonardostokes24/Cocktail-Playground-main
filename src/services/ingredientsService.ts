// The old `ingredients` DB table (label/category/emoji/color) was replaced by the
// new cost-library schema in Phase 0. The RadialWheel and Sidebar still need a
// catalogue — they use this static list until Phase 2 retires IngredientNode entirely.

export interface AppIngredient {
  id: string;
  label: string;
  category: string;
  emoji: string;
  color: string;
}

export type IngredientsByCategory = Record<string, AppIngredient[]>;

export const CATEGORY_TO_TYPE: Record<string, string> = {
  spirits:    'spirit',
  liqueurs:   'modifier',
  vermouth:   'modifier',
  amari:      'modifier',
  citrus:     'citrus',
  sweeteners: 'sweetener',
  bitters:    'bitters',
};

const EMOJI: Record<string, string> = {
  spirits: '🍶', liqueurs: '🍹', vermouth: '🍷',
  amari: '🌿', citrus: '🍊', sweeteners: '🍯', bitters: '💧',
};

const CATALOGUE: Record<string, string[]> = {
  spirits:    ['Bourbon', 'Rye Whiskey', 'Scotch', 'Irish Whiskey', 'London Dry Gin', 'Old Tom Gin', 'Vodka', 'Blanco Tequila', 'Reposado Tequila', 'Mezcal', 'Light Rum', 'Dark Rum', 'Overproof Rum', 'Cognac', 'Brandy / Pisco', 'Cachaça', 'Applejack'],
  liqueurs:   ['Triple Sec', 'Curaçao', 'Maraschino', 'Elderflower', 'Benedictine', 'Drambuie', 'Green Chartreuse', 'Yellow Chartreuse', 'Amaretto', 'Coffee Liqueur', 'Apricot Brandy', 'Crème de Violette', 'Absinthe'],
  vermouth:   ['Sweet Vermouth', 'Dry Vermouth', 'Blanc Vermouth', 'Fino Sherry', 'Pedro Ximénez', 'Lillet Blanc'],
  amari:      ['Campari', 'Aperol', 'Fernet-Branca', 'Cynar', 'Averna', 'Suze', 'Montenegro'],
  citrus:     ['Lemon Juice', 'Lime Juice', 'Orange Juice', 'Grapefruit Juice', 'Pineapple Juice', 'Cranberry Juice'],
  sweeteners: ['Simple Syrup', 'Rich Simple Syrup', 'Demerara Syrup', 'Honey Syrup', 'Agave Nectar', 'Orgeat', 'Grenadine', 'Maple Syrup'],
  bitters:    ['Aromatic Bitters', "Peychaud's Bitters", 'Orange Bitters', 'Chocolate Bitters', 'Celery Bitters'],
};

const STATIC_CATALOGUE: IngredientsByCategory = Object.fromEntries(
  Object.entries(CATALOGUE).map(([cat, labels]) => [
    cat,
    labels.map((label) => ({
      id: `${cat}:${label}`,
      label,
      category: cat,
      emoji: EMOJI[cat] ?? '🍹',
      color: 'text-slate-300',
    })),
  ])
);

export async function fetchIngredients(): Promise<IngredientsByCategory> {
  return STATIC_CATALOGUE;
}
