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
      { label: 'Campari', type: 'modifier', amount: '1 oz' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' },
      { label: 'Soda Water', type: 'sweetener', amount: 'top' }
    ]
  },
  { 
    name: 'Daiquiri', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['rum'], ['lime'], ['syrup', 'sugar']],
    standardIngredients: [
      { label: 'White Rum', type: 'spirit', amount: '2 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'Manhattan', 
    method: 'Stirred', 
    glass: 'Martini/Coupe', 
    keywords: [['whiskey', 'bourbon', 'rye'], ['sweet vermouth', 'rosso'], ['bitters']],
    standardIngredients: [
      { label: 'Rye Whiskey', type: 'spirit', amount: '2 oz' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' },
      { label: 'Angostura Bitters', type: 'bitters', amount: '2 dashes' }
    ]
  },
  { 
    name: 'Negroni', 
    method: 'Stirred', 
    glass: 'Rocks', 
    keywords: [['gin'], ['sweet vermouth', 'rosso'], ['campari']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '1 oz' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' },
      { label: 'Campari', type: 'modifier', amount: '1 oz' }
    ]
  },
  { 
    name: 'Old Fashioned', 
    method: 'Stirred', 
    glass: 'Rocks', 
    keywords: [['whiskey', 'bourbon', 'rye'], ['syrup', 'sugar', 'gomme'], ['bitters']],
    standardIngredients: [
      { label: 'Bourbon', type: 'spirit', amount: '2 oz' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '0.25 oz' },
      { label: 'Angostura Bitters', type: 'bitters', amount: '2 dashes' }
    ]
  },
  { 
    name: 'Margarita', 
    method: 'Shaken', 
    glass: 'Rocks/Margarita', 
    keywords: [['tequila'], ['triple sec', 'cointreau'], ['lime']],
    standardIngredients: [
      { label: 'Tequila Blanco', type: 'spirit', amount: '1.5 oz' },
      { label: 'Triple Sec', type: 'modifier', amount: '0.75 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Espresso Martini', 
    method: 'Shaken', 
    glass: 'Martini', 
    keywords: [['vodka'], ['espresso', 'coffee'], ['coffee liqueur', 'kahlua']],
    standardIngredients: [
      { label: 'Vodka', type: 'spirit', amount: '2 oz' },
      { label: 'Espresso', type: 'modifier', amount: '1 oz' },
      { label: 'Coffee Liqueur', type: 'modifier', amount: '0.5 oz' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '0.25 oz' }
    ]
  },
  { 
    name: 'Last Word', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['gin'], ['lime'], ['maraschino'], ['chartreuse', 'green']],
    standardIngredients: [
      { label: 'Gin', type: 'spirit', amount: '0.75 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' },
      { label: 'Maraschino', type: 'modifier', amount: '0.75 oz' },
      { label: 'Green Chartreuse', type: 'modifier', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Paper Plane', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['bourbon', 'whiskey'], ['amaro nonino', 'amaro'], ['aperol'], ['lemon']],
    standardIngredients: [
      { label: 'Bourbon', type: 'spirit', amount: '0.75 oz' },
      { label: 'Amaro Nonino', type: 'modifier', amount: '0.75 oz' },
      { label: 'Aperol', type: 'modifier', amount: '0.75 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Naked and Famous', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['mezcal'], ['aperol'], ['chartreuse', 'yellow'], ['lime']],
    standardIngredients: [
      { label: 'Mezcal', type: 'spirit', amount: '0.75 oz' },
      { label: 'Aperol', type: 'modifier', amount: '0.75 oz' },
      { label: 'Yellow Chartreuse', type: 'modifier', amount: '0.75 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Dry Martini', 
    method: 'Stirred', 
    glass: 'Martini', 
    keywords: [['gin', 'vodka'], ['dry vermouth']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '2.5 oz' },
      { label: 'Dry Vermouth', type: 'modifier', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'Mojito', 
    method: 'Muddled', 
    glass: 'Highball', 
    keywords: [['rum'], ['lime'], ['mint'], ['soda']],
    standardIngredients: [
      { label: 'White Rum', type: 'spirit', amount: '2 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '0.5 oz' },
      { label: 'Mint Leaves', type: 'modifier', amount: '6-8 leaves' },
      { label: 'Soda Water', type: 'sweetener', amount: 'top' }
    ]
  },
  { 
    name: 'Aperol Spritz', 
    method: 'Built', 
    glass: 'Wine Glass', 
    keywords: [['aperol'], ['prosecco', 'sparkling'], ['soda']],
    standardIngredients: [
      { label: 'Aperol', type: 'modifier', amount: '3 oz' },
      { label: 'Prosecco', type: 'spirit', amount: '3 oz' },
      { label: 'Soda Water', type: 'sweetener', amount: 'splash' }
    ]
  },
  { 
    name: 'Cosmopolitan', 
    method: 'Shaken', 
    glass: 'Martini', 
    keywords: [['vodka'], ['cranberry'], ['lime'], ['cointreau', 'triple sec']],
    standardIngredients: [
      { label: 'Citron Vodka', type: 'spirit', amount: '1.5 oz' },
      { label: 'Cointreau', type: 'modifier', amount: '0.5 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.5 oz' },
      { label: 'Cranberry Juice', type: 'citrus', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'White Russian', 
    method: 'Built', 
    glass: 'Rocks', 
    keywords: [['vodka'], ['coffee liqueur', 'kahlua'], ['cream']],
    standardIngredients: [
      { label: 'Vodka', type: 'spirit', amount: '2 oz' },
      { label: 'Coffee Liqueur', type: 'modifier', amount: '1 oz' },
      { label: 'Heavy Cream', type: 'modifier', amount: '1 oz' }
    ]
  },
  { 
    name: 'Paloma', 
    method: 'Built', 
    glass: 'Highball', 
    keywords: [['tequila'], ['grapefruit'], ['lime']],
    standardIngredients: [
      { label: 'Tequila Blanco', type: 'spirit', amount: '2 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.5 oz' },
      { label: 'Grapefruit Soda', type: 'citrus', amount: 'top' }
    ]
  },
  { 
    name: 'French 75', 
    method: 'Shaken', 
    glass: 'Flute', 
    keywords: [['gin'], ['lemon'], ['champagne', 'sparkling']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '1 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.5 oz' },
      { label: 'Simple Syrup', type: 'sweetener', amount: '0.5 oz' },
      { label: 'Champagne', type: 'spirit', amount: 'top' }
    ]
  },
  { 
    name: 'Aviation', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['gin'], ['maraschino'], ['lemon'], ['violette']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '2 oz' },
      { label: 'Maraschino', type: 'modifier', amount: '0.25 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.25 oz' },
      { label: 'Crème de Violette', type: 'modifier', amount: '0.25 oz' }
    ]
  },
  { 
    name: 'Bee\'s Knees', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['gin'], ['lemon'], ['honey']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '2 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.75 oz' },
      { label: 'Honey Syrup', type: 'sweetener', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Sazerac', 
    method: 'Stirred', 
    glass: 'Rocks', 
    keywords: [['rye', 'cognac'], ['absinthe'], ['bitters']],
    standardIngredients: [
      { label: 'Rye Whiskey', type: 'spirit', amount: '2 oz' },
      { label: 'Absinthe', type: 'modifier', amount: 'rinse' },
      { label: 'Peychaud\'s Bitters', type: 'bitters', amount: '3 dashes' },
      { label: 'Sugar Cube', type: 'sweetener', amount: '1 cube' }
    ]
  },
  { 
    name: 'Dark and Stormy', 
    method: 'Built', 
    glass: 'Highball', 
    keywords: [['dark rum'], ['ginger beer'], ['lime']],
    standardIngredients: [
      { label: 'Dark Rum', type: 'spirit', amount: '2 oz' },
      { label: 'Ginger Beer', type: 'modifier', amount: 'top' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'Piña Colada', 
    method: 'Blended', 
    glass: 'Poco Grande', 
    keywords: [['rum'], ['coconut'], ['pineapple']],
    standardIngredients: [
      { label: 'White Rum', type: 'spirit', amount: '2 oz' },
      { label: 'Cream of Coconut', type: 'modifier', amount: '1.5 oz' },
      { label: 'Pineapple Juice', type: 'citrus', amount: '2 oz' }
    ]
  },
  { 
    name: 'Zombie', 
    method: 'Shaken', 
    glass: 'Zombie', 
    keywords: [['rum'], ['lime'], ['grenadine'], ['apricot']],
    standardIngredients: [
      { label: 'Light Rum', type: 'spirit', amount: '1.5 oz' },
      { label: 'Dark Rum', type: 'spirit', amount: '1.5 oz' },
      { label: 'Overproof Rum', type: 'spirit', amount: '0.5 oz' },
      { label: 'Apricot Brandy', type: 'modifier', amount: '0.5 oz' },
      { label: 'Lime Juice', type: 'citrus', amount: '0.75 oz' },
      { label: 'Grenadine', type: 'sweetener', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'Vesper', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['gin'], ['vodka'], ['lillet']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '3 oz' },
      { label: 'Vodka', type: 'spirit', amount: '1 oz' },
      { label: 'Lillet Blanc', type: 'modifier', amount: '0.5 oz' }
    ]
  },
  { 
    name: 'Boulevardier', 
    method: 'Stirred', 
    glass: 'Rocks', 
    keywords: [['bourbon', 'whiskey'], ['campari'], ['sweet vermouth']],
    standardIngredients: [
      { label: 'Bourbon', type: 'spirit', amount: '1.25 oz' },
      { label: 'Campari', type: 'modifier', amount: '1 oz' },
      { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' }
    ]
  },
  { 
    name: 'Caipirinha', 
    method: 'Muddled', 
    glass: 'Rocks', 
    keywords: [['cachaça'], ['lime'], ['sugar']],
    standardIngredients: [
      { label: 'Cachaça', type: 'spirit', amount: '2 oz' },
      { label: 'Lime', type: 'citrus', amount: '1 lime' },
      { label: 'Sugar', type: 'sweetener', amount: '2 tsp' }
    ]
  },
  { 
    name: 'Sidecar', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['cognac'], ['triple sec'], ['lemon']],
    standardIngredients: [
      { label: 'Cognac', type: 'spirit', amount: '1.5 oz' },
      { label: 'Triple Sec', type: 'modifier', amount: '0.75 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'White Lady', 
    method: 'Shaken', 
    glass: 'Coupe', 
    keywords: [['gin'], ['triple sec'], ['lemon']],
    standardIngredients: [
      { label: 'London Dry Gin', type: 'spirit', amount: '1.5 oz' },
      { label: 'Triple Sec', type: 'modifier', amount: '0.75 oz' },
      { label: 'Lemon Juice', type: 'citrus', amount: '0.75 oz' }
    ]
  },
  { 
    name: 'Espresso Martini', 
    method: 'Shaken', 
    glass: 'Martini', 
    keywords: [['vodka'], ['espresso'], ['coffee liqueur']],
    standardIngredients: [
      { label: 'Vodka', type: 'spirit', amount: '2 oz' },
      { label: 'Espresso', type: 'modifier', amount: '1 oz' },
      { label: 'Coffee Liqueur', type: 'modifier', amount: '0.5 oz' }
    ]
  }
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
