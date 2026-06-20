import { useState, useEffect } from 'react';
import { fetchIngredients, type IngredientsByCategory } from '../services/ingredientsService';

// Module-level cache so Sidebar and RadialWheel share one fetch per page load
let cache: IngredientsByCategory | null = null;
let pending: Promise<IngredientsByCategory> | null = null;

export function useIngredients() {
  const [ingredients, setIngredients] = useState<IngredientsByCategory>(cache ?? {});
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache !== null) return;
    if (!pending) pending = fetchIngredients();
    pending.then(data => {
      cache = data;
      setIngredients(data);
      setLoading(false);
    });
  }, []);

  return { ingredients, loading };
}
