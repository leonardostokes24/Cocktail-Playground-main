export interface CocktailIngredient {
  label: string;
  type: string;
  amount: string;
}

export interface Cocktail {
  name: string;
  method: string;
  glass: string;
  keywords: string[][];
  description?: string;
  standardIngredients?: CocktailIngredient[];
}

export const ibaCocktails: Cocktail[] = [
  // THE UNFORGETTABLES
  { 
    name: 'Americano', 
    method: 'Built', 
    glass: 'Rocks', 
    keywords: [['campari'], ['sweet vermouth'], ['soda']],
    standardIngredients: [
      { label: 'Campari', type: 'modifier', amount: '30 ml' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '30 ml' },
      { label: 'Soda Water', type: 'sweetener', amount: 'top' }
    ]
  },
  {
    name: 'Daiquiri',
    method: 'Shaken',
    glass: 'Coupe',
    keywords: [['rum'], ['lime'], ['syrup', 'sugar']],
    standardIngredients: [
      { label: 'White Rum', type: 'spirit', amount: '60 ml' },
      { label: 'Lime Juice', type: 'citrus', amount: '22 ml' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '15 ml' }
    ]
  },
  {
    name: 'Manhattan',
    method: 'Stirred',
    glass: 'Martini/Coupe',
    keywords: [['whiskey', 'bourbon', 'rye'], ['sweet vermouth', 'rosso'], ['bitters']],
    standardIngredients: [
      { label: 'Rye Whiskey', type: 'spirit', amount: '60 ml' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '30 ml' },
      { label: 'Angostura Bitters', type: 'bitters', amount: '2 dashes' }
    ]
  },
  {
    name: 'Negroni',
    method: 'Stirred',
    glass: 'Rocks',
    keywords: [['gin'], ['sweet vermouth', 'rosso'], ['campari']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '30 ml' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '30 ml' },
      { label: 'Campari', type: 'modifier', amount: '30 ml' }
    ]
  },
  {
    name: 'Old Fashioned',
    method: 'Stirred',
    glass: 'Rocks',
    keywords: [['whiskey', 'bourbon', 'rye'], ['syrup', 'sugar', 'gomme'], ['bitters']],
    standardIngredients: [
      { label: 'Bourbon', type: 'spirit', amount: '60 ml' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '7.5 ml' },
      { label: 'Angostura Bitters', type: 'bitters', amount: '2 dashes' }
    ]
  },
  {
    name: 'Margarita',
    method: 'Shaken',
    glass: 'Rocks/Margarita',
    keywords: [['tequila'], ['triple sec', 'cointreau'], ['lime']],
    standardIngredients: [
      { label: 'Tequila Blanco', type: 'spirit', amount: '45 ml' },
      { label: 'Triple Sec', type: 'modifier', amount: '22 ml' },
      { label: 'Lime Juice', type: 'citrus', amount: '22 ml' }
    ]
  },
  {
    name: 'Espresso Martini',
    method: 'Shaken',
    glass: 'Martini',
    keywords: [['vodka'], ['espresso', 'coffee'], ['coffee liqueur', 'kahlua']],
    standardIngredients: [
      { label: 'Vodka', type: 'spirit', amount: '60 ml' },
      { label: 'Espresso', type: 'modifier', amount: '30 ml' },
      { label: 'Coffee Liqueur', type: 'modifier', amount: '15 ml' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '7.5 ml' }
    ]
  },
  {
    name: 'Last Word',
    method: 'Shaken',
    glass: 'Coupe',
    keywords: [['gin'], ['lime'], ['maraschino'], ['chartreuse', 'green']],
    standardIngredients: [
      { label: 'Gin', type: 'spirit', amount: '22 ml' },
      { label: 'Lime Juice', type: 'citrus', amount: '22 ml' },
      { label: 'Maraschino', type: 'modifier', amount: '22 ml' },
      { label: 'Green Chartreuse', type: 'modifier', amount: '22 ml' }
    ]
  },
  {
    name: 'Paper Plane',
    method: 'Shaken',
    glass: 'Coupe',
    keywords: [['bourbon', 'whiskey'], ['amaro nonino', 'amaro'], ['aperol'], ['lemon']],
    standardIngredients: [
      { label: 'Bourbon', type: 'spirit', amount: '22 ml' },
      { label: 'Amaro Nonino', type: 'modifier', amount: '22 ml' },
      { label: 'Aperol', type: 'modifier', amount: '22 ml' },
      { label: 'Lemon Juice', type: 'citrus', amount: '22 ml' }
    ]
  },
  {
    name: 'Naked and Famous',
    method: 'Shaken',
    glass: 'Coupe',
    keywords: [['mezcal'], ['aperol'], ['chartreuse', 'yellow'], ['lime']],
    standardIngredients: [
      { label: 'Mezcal', type: 'spirit', amount: '22 ml' },
      { label: 'Aperol', type: 'modifier', amount: '22 ml' },
      { label: 'Yellow Chartreuse', type: 'modifier', amount: '22 ml' },
      { label: 'Lime Juice', type: 'citrus', amount: '22 ml' }
    ]
  }
  // ... more can be added, but these cover the major favorites for drop testing
];

export const findCocktailMatch = (connectedIngredientLabels: string[]): Cocktail | null => {
  if (!connectedIngredientLabels || connectedIngredientLabels.length === 0) return null;
  
  const inputs = connectedIngredientLabels.map(i => i.toLowerCase());

  for (const cocktail of ibaCocktails) {
    // A match is valid if every mandatory keyword group has at least one matching input
    const isMatch = cocktail.keywords.every(keywordGroup => {
      return inputs.some(input => 
        keywordGroup.some(keyword => input.toLowerCase().includes(keyword.toLowerCase()))
      );
    });

    // Ratio tolerance: allow up to 2 extra "secret" ingredients before failing the match (for garnishes/personal tweaks)
    if (isMatch && inputs.length <= cocktail.keywords.length + 2) {
      return cocktail;
    }
  }

  return null;
};
