#!/usr/bin/env node
/**
 * Library ingestion: PDF -> Gemini (structured extraction) -> cocktails table
 *
 * Each ingredient is mapped to the app's canonical ingredient list (see KNOWN_INGREDIENTS).
 * If an ingredient has no close match, it is flagged as new (isNew: true) so you can decide
 * whether to add it to the Sidebar / RadialWheel.
 *
 * Usage:
 *   node --env-file=.env ingest.js ./pdfs/source.pdf --source "IBA" [--chunk 20] [--commit]
 *
 * Env:
 *   GEMINI_API_KEY               required
 *   SUPABASE_URL                 required
 *   SUPABASE_SERVICE_ROLE_KEY    required
 */

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

// ---------- args ----------
const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith("--"));
const getFlag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};
const source = getFlag("source");
const chunkPages = parseInt(getFlag("chunk") ?? "20", 10);
const commit = args.includes("--commit");

if (!pdfPath || !source) {
  console.error('Usage: node --env-file=.env ingest.js <file.pdf> --source "IBA" [--chunk 20] [--commit]');
  process.exit(1);
}

// ---------- app ingredient catalogue ----------
// Gemini maps each extracted ingredient to the closest entry here.
// category must be one of the 7 values the DB accepts.
const KNOWN_INGREDIENTS = {
  spirits: [
    "Bourbon", "Rye Whiskey", "Scotch", "Irish Whiskey",
    "London Dry Gin", "Old Tom Gin",
    "Vodka",
    "Blanco Tequila", "Reposado Tequila", "Mezcal",
    "Light Rum", "Dark Rum", "Overproof Rum",
    "Cognac", "Brandy / Pisco", "Cachaça", "Applejack",
  ],
  liqueurs: [
    "Triple Sec", "Curaçao", "Maraschino", "Elderflower", "Benedictine", "Drambuie",
    "Green Chartreuse", "Yellow Chartreuse", "Amaretto", "Coffee Liqueur",
    "Apricot Brandy", "Crème de Violette", "Absinthe",
  ],
  vermouth: [
    "Sweet Vermouth", "Dry Vermouth", "Blanc Vermouth",
    "Fino Sherry", "Pedro Ximénez", "Lillet Blanc",
  ],
  amari: [
    "Campari", "Aperol", "Fernet-Branca", "Cynar", "Averna", "Suze", "Montenegro",
  ],
  citrus: [
    "Lemon Juice", "Lime Juice", "Orange Juice", "Grapefruit", "Pineapple", "Cranberry",
  ],
  sweeteners: [
    "Simple Syrup", "Rich Simple", "Demerara Syrup", "Honey Syrup",
    "Agave Nectar", "Orgeat", "Grenadine", "Maple Syrup",
  ],
  bitters: [
    "Aromatic Bitters", "Peychaud's", "Orange Bitters", "Chocolate Bitters", "Celery Bitters",
  ],
};

// Default emoji per category for new ingredients added to the pool
const CATEGORY_EMOJI = {
  spirits: "🍶", liqueurs: "🍹", vermouth: "🍷",
  amari: "🌿", citrus: "🍊", sweeteners: "🍯", bitters: "💧",
};

// Flat list used in the prompt so Gemini sees the full catalogue
const INGREDIENT_LIST_TEXT = Object.entries(KNOWN_INGREDIENTS)
  .map(([cat, labels]) => `${cat.toUpperCase()}:\n${labels.map(l => `  - ${l}`).join("\n")}`)
  .join("\n\n");

// ---------- clients ----------
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-2.5-flash";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- split PDF into page-chunks ----------
async function splitToChunks(filePath) {
  const bytes = fs.readFileSync(path.resolve(filePath));
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const chunks = [];
  for (let start = 0; start < total; start += chunkPages) {
    const sub = await PDFDocument.create();
    const end = Math.min(start + chunkPages, total);
    const indices = Array.from({ length: end - start }, (_, k) => start + k);
    const copied = await sub.copyPages(src, indices);
    copied.forEach((p) => sub.addPage(p));
    const out = await sub.save();
    chunks.push({ base64: Buffer.from(out).toString("base64"), from: start + 1, to: end });
  }
  return { total, chunks };
}

// ---------- extraction prompt ----------
const SYSTEM = `You extract cocktail recipes from documents into strict JSON.

Return ONLY a JSON array. Each element:
{
  "name": string,
  "category": string|null,
  "glass": string|null,
  "garnish": string|null,
  "method": string|null,
  "description": string|null,
  "keywords": string[],
  "ingredients": [
    {
      "label": string,       // canonical app label (see catalogue below — pick the CLOSEST match)
      "category": string,    // must be one of: spirits | liqueurs | vermouth | amari | citrus | sweeteners | bitters
      "amount": number|null,
      "unit": string|null,   // ml | oz | dash | barspoon | drop | tsp | cl | part
      "isNew": boolean       // true ONLY if no reasonable match exists in the catalogue
    }
  ]
}

INGREDIENT MAPPING RULES:
- Match each extracted ingredient to the CLOSEST label in the catalogue below.
- Use partial/semantic matching: "Sweet Red Vermouth" → "Sweet Vermouth" (vermouth),
  "Bitter Campari" → "Campari" (amari), "Gin" → "London Dry Gin" (spirits, assume London Dry
  unless the recipe specifies otherwise), "Angostura Bitters" → "Aromatic Bitters" (bitters),
  "Grapefruit Juice" → "Grapefruit" (citrus), "Fresh Lemon" → "Lemon Juice" (citrus).
- Set isNew: false when you use a catalogue label exactly.
- Set isNew: true only when the ingredient genuinely doesn't fit any catalogue entry (e.g. "Egg
  White", "Coconut Cream", "Blue Curaçao"). Give it the most descriptive label possible and pick
  the best-fitting category.
- Keep keywords genuinely descriptive of taste/style (4–8 tags like "smoky","citrus-forward").
- Skip incomplete recipes (cut off at a page edge). Never invent recipes.

APP INGREDIENT CATALOGUE:
${INGREDIENT_LIST_TEXT}`;

async function extractChunk(base64) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: "Extract every complete cocktail recipe in this document as the specified JSON array." },
      { inlineData: { mimeType: "application/pdf", data: base64 } },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    throw new Error(`output cut off (${finish}) — re-run with a smaller --chunk`);
  }
  const text = (response.text ?? "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(text);
}

async function insertCocktail(r) {
  const { error } = await supabase.from("cocktails").upsert(
    {
      name: r.name,
      source,
      category: r.category ?? null,
      glass: r.glass ?? null,
      garnish: r.garnish ?? null,
      method: r.method ?? null,
      description: r.description ?? null,
      keywords: r.keywords ?? [],
      ingredients: r.ingredients ?? [],
    },
    { onConflict: "name,source" }
  );
  if (error) throw error;
}

async function upsertNewIngredient(label, category) {
  const emoji = CATEGORY_EMOJI[category] ?? "🍹";
  const { error } = await supabase.from("ingredients").upsert(
    { label, category, emoji, color: "text-slate-300" },
    { onConflict: "label" }
  );
  if (error) console.warn(`  Could not add ingredient "${label}": ${error.message}`);
  else console.log(`  + added ingredient: ${category.padEnd(12)} ${label}`);
}

// ---------- main ----------
async function main() {
  console.log(`Reading ${pdfPath} ...`);
  const { total, chunks } = await splitToChunks(pdfPath);
  console.log(`${total} pages -> ${chunks.length} chunk(s) of up to ${chunkPages} pages.\n`);

  const byName = new Map();
  for (const c of chunks) {
    process.stdout.write(`  pages ${c.from}-${c.to} ... `);
    try {
      const recipes = await extractChunk(c.base64);
      for (const r of recipes) if (!byName.has(r.name)) byName.set(r.name, r);
      console.log(`${recipes.length} found`);
    } catch (e) {
      console.log(`failed: ${e.message}`);
    }
  }

  const recipes = [...byName.values()];
  console.log(`\nParsed ${recipes.length} unique recipe(s):\n`);
  console.log(JSON.stringify(recipes, null, 2));

  // Collect new ingredients flagged by Gemini
  const newIngredients = new Map();
  for (const r of recipes) {
    for (const ing of r.ingredients ?? []) {
      if (ing.isNew) {
        const key = `${ing.label}|${ing.category}`;
        if (!newIngredients.has(key)) newIngredients.set(key, { label: ing.label, category: ing.category ?? 'liqueurs' });
      }
    }
  }
  if (newIngredients.size > 0) {
    console.log(`\n⚠  NEW INGREDIENTS (will be added to the ingredient pool on --commit):`);
    for (const { label, category } of newIngredients.values()) {
      console.log(`   ${(category ?? '').padEnd(12)} ${label}`);
    }
  } else {
    console.log(`\n✓  All ingredients matched the app's catalogue — no new items needed.`);
  }

  if (!commit) {
    console.log(`\n[DRY RUN] Nothing written. Review the JSON above, then re-run with --commit.\n`);
    return;
  }

  // 1. Add new ingredients to the pool
  if (newIngredients.size > 0) {
    console.log(`\nAdding ${newIngredients.size} new ingredient(s) to the pool ...`);
    for (const { label, category } of newIngredients.values()) {
      await upsertNewIngredient(label, category);
    }
  }

  // 2. Insert cocktail recipes
  console.log(`\nWriting to the cocktails library ...`);
  let ok = 0;
  for (const r of recipes) {
    try {
      await insertCocktail(r);
      console.log(`  ✓ ${r.name}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${r.name}: ${e.message}`);
    }
  }
  console.log(`\nDone. Inserted/updated ${ok}/${recipes.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
