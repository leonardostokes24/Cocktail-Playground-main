import { createClient } from '@supabase/supabase-js';
import { ibaCocktails } from '../src/data/cocktailDB';

const SUPABASE_URL = 'https://ycapgvrnvipgfiglzzmg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljYXBndnJudmlwZ2ZpZ2x6em1nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc5MzQyNiwiZXhwIjoyMDkyMzY5NDI2fQ.71_l6ALoH562OQlsayRJu1SyzTWcS3JEwupzoWKu3cs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  console.log('Starting migration of expanded cocktail database to Supabase...');
  
  try {
    const dataToInsert = ibaCocktails.map(cocktail => ({
      name: cocktail.name,
      method: cocktail.method,
      glass: cocktail.glass,
      keywords: cocktail.keywords,
      description: cocktail.description || '',
      ingredients: cocktail.standardIngredients || [],
      user_id: null, // IBA cocktails are public
      isCustomOverride: false
    }));

    const { data, error } = await supabase
      .from('cocktails')
      .upsert(dataToInsert, { onConflict: 'name' });

    if (error) {
      console.error('Error inserting data:', error);
      process.exit(1);
    }

    console.log(`Successfully migrated ${(data?.length ?? 0) || ibaCocktails.length} cocktails to Supabase!`);
  } catch (err) {
    console.error('Unexpected error during migration:', err);
    process.exit(1);
  }
}

migrate();
