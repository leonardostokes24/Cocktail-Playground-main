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
