-- ============================================================
-- ingredients — app ingredient pool
-- Run once in the Supabase SQL editor AFTER schema.sql.
-- After this, the Sidebar and RadialWheel load from this table
-- instead of hardcoded arrays. The ingest script adds new ones.
-- ============================================================

create table if not exists ingredients (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  category   text not null check (category in (
               'spirits','liqueurs','vermouth','amari','citrus','sweeteners','bitters'
             )),
  emoji      text not null default '🍹',
  color      text not null default 'text-slate-300',  -- Tailwind class used in Sidebar
  created_at timestamptz not null default now()
);

alter table ingredients enable row level security;
create policy "ingredients readable" on ingredients for select using (true);
grant select on ingredients to anon, authenticated;

-- ============================================================
-- Seed: existing hardcoded ingredients
-- ============================================================
insert into ingredients (label, category, emoji, color) values

-- SPIRITS
('Bourbon',           'spirits', '🥃', 'text-amber-500'),
('Rye Whiskey',       'spirits', '🥃', 'text-amber-600'),
('Scotch',            'spirits', '🥃', 'text-amber-700'),
('Irish Whiskey',     'spirits', '🍀', 'text-emerald-600'),
('London Dry Gin',    'spirits', '🍸', 'text-blue-300'),
('Old Tom Gin',       'spirits', '🐱', 'text-amber-200'),
('Vodka',             'spirits', '💎', 'text-slate-300'),
('Blanco Tequila',    'spirits', '🌵', 'text-emerald-400'),
('Reposado Tequila',  'spirits', '🌵', 'text-amber-500'),
('Mezcal',            'spirits', '🔥', 'text-emerald-600'),
('Light Rum',         'spirits', '🏴‍☠️', 'text-slate-200'),
('Dark Rum',          'spirits', '🏴‍☠️', 'text-amber-900'),
('Overproof Rum',     'spirits', '💣', 'text-red-600'),
('Cognac',            'spirits', '🍷', 'text-amber-800'),
('Brandy / Pisco',    'spirits', '🍇', 'text-slate-100'),
('Cachaça',           'spirits', '🎋', 'text-emerald-300'),
('Applejack',         'spirits', '🍎', 'text-red-500'),

-- LIQUEURS
('Triple Sec',        'liqueurs', '🍊', 'text-orange-300'),
('Curaçao',           'liqueurs', '🌊', 'text-blue-500'),
('Maraschino',        'liqueurs', '🍒', 'text-slate-100'),
('Elderflower',       'liqueurs', '🌸', 'text-yellow-100'),
('Benedictine',       'liqueurs', '⛪', 'text-amber-600'),
('Drambuie',          'liqueurs', '🏴', 'text-amber-500'),
('Green Chartreuse',  'liqueurs', '🌿', 'text-emerald-500'),
('Yellow Chartreuse', 'liqueurs', '🌿', 'text-yellow-500'),
('Amaretto',          'liqueurs', '🥜', 'text-amber-800'),
('Coffee Liqueur',    'liqueurs', '☕', 'text-amber-950'),
('Apricot Brandy',    'liqueurs', '🍑', 'text-orange-400'),
('Crème de Violette', 'liqueurs', '🟣', 'text-purple-400'),
('Absinthe',          'liqueurs', '🧚', 'text-emerald-300'),

-- VERMOUTH & FORTIFIED
('Sweet Vermouth',    'vermouth', '🍷', 'text-red-700'),
('Dry Vermouth',      'vermouth', '🍸', 'text-slate-400'),
('Blanc Vermouth',    'vermouth', '🥂', 'text-yellow-100'),
('Fino Sherry',       'vermouth', '🍷', 'text-yellow-500'),
('Pedro Ximénez',     'vermouth', '🍇', 'text-amber-900'),
('Lillet Blanc',      'vermouth', '🇫🇷', 'text-yellow-200'),

-- AMARI & APERITIFS
('Campari',           'amari', '🔴', 'text-red-500'),
('Aperol',            'amari', '🟠', 'text-orange-500'),
('Fernet-Branca',     'amari', '🦅', 'text-emerald-950'),
('Cynar',             'amari', '🌿', 'text-emerald-700'),
('Averna',            'amari', '🇮🇹', 'text-amber-900'),
('Suze',              'amari', '🌼', 'text-yellow-500'),
('Montenegro',        'amari', '🏰', 'text-amber-700'),

-- CITRUS
('Lemon Juice',       'citrus', '🍋', 'text-yellow-400'),
('Lime Juice',        'citrus', '🍈', 'text-emerald-400'),
('Orange Juice',      'citrus', '🍊', 'text-orange-400'),
('Grapefruit',        'citrus', '🍑', 'text-pink-400'),
('Pineapple',         'citrus', '🍍', 'text-yellow-600'),
('Cranberry',         'citrus', '🍒', 'text-red-500'),

-- SWEETENERS
('Simple Syrup',      'sweeteners', '🍯', 'text-slate-300'),
('Rich Simple',       'sweeteners', '🍯', 'text-yellow-100'),
('Demerara Syrup',    'sweeteners', '🍯', 'text-amber-900'),
('Honey Syrup',       'sweeteners', '🍯', 'text-amber-400'),
('Agave Nectar',      'sweeteners', '🌱', 'text-amber-200'),
('Orgeat',            'sweeteners', '🥜', 'text-slate-100'),
('Grenadine',         'sweeteners', '🍒', 'text-red-600'),
('Maple Syrup',       'sweeteners', '🍁', 'text-amber-700'),

-- BITTERS
('Aromatic Bitters',  'bitters', '🪵', 'text-amber-900'),
('Peychaud''s',       'bitters', '🔴', 'text-red-600'),
('Orange Bitters',    'bitters', '🍊', 'text-orange-500'),
('Chocolate Bitters', 'bitters', '🍫', 'text-amber-950'),
('Celery Bitters',    'bitters', '🌱', 'text-emerald-500')

on conflict (label) do nothing;
