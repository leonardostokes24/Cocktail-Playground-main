import React, { useState, useEffect } from 'react';
import type { Cocktail } from '../data/cocktailDB';

interface IngredientItem {
  label: string;
  type: string;
}

interface CategoryConfig {
  id: string;
  label: string;
  emoji: string;
  color: string;
  items: IngredientItem[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'spirits', label: 'Spirits', emoji: '🥃', color: '#f59e0b',
    items: [
      { label: 'Bourbon', type: 'spirit' },
      { label: 'Rye Whiskey', type: 'spirit' },
      { label: 'Scotch', type: 'spirit' },
      { label: 'Irish Whiskey', type: 'spirit' },
      { label: 'London Dry Gin', type: 'spirit' },
      { label: 'Old Tom Gin', type: 'spirit' },
      { label: 'Vodka', type: 'spirit' },
      { label: 'Blanco Tequila', type: 'spirit' },
      { label: 'Reposado Tequila', type: 'spirit' },
      { label: 'Mezcal', type: 'spirit' },
      { label: 'Light Rum', type: 'spirit' },
      { label: 'Dark Rum', type: 'spirit' },
      { label: 'Overproof Rum', type: 'spirit' },
      { label: 'Cognac', type: 'spirit' },
      { label: 'Brandy / Pisco', type: 'spirit' },
      { label: 'Cachaça', type: 'spirit' },
      { label: 'Applejack', type: 'spirit' },
    ],
  },
  {
    id: 'liqueurs', label: 'Liqueurs', emoji: '🍹', color: '#fb923c',
    items: [
      { label: 'Triple Sec', type: 'modifier' },
      { label: 'Curaçao', type: 'modifier' },
      { label: 'Maraschino', type: 'modifier' },
      { label: 'Elderflower', type: 'modifier' },
      { label: 'Benedictine', type: 'modifier' },
      { label: 'Drambuie', type: 'modifier' },
      { label: 'Green Chartreuse', type: 'modifier' },
      { label: 'Yellow Chartreuse', type: 'modifier' },
      { label: 'Amaretto', type: 'modifier' },
      { label: 'Coffee Liqueur', type: 'modifier' },
      { label: 'Apricot Brandy', type: 'modifier' },
      { label: 'Crème de Violette', type: 'modifier' },
      { label: 'Absinthe', type: 'modifier' },
    ],
  },
  {
    id: 'vermouth', label: 'Vermouth', emoji: '🍷', color: '#dc2626',
    items: [
      { label: 'Sweet Vermouth', type: 'modifier' },
      { label: 'Dry Vermouth', type: 'modifier' },
      { label: 'Blanc Vermouth', type: 'modifier' },
      { label: 'Fino Sherry', type: 'modifier' },
      { label: 'Pedro Ximénez', type: 'modifier' },
      { label: 'Lillet Blanc', type: 'modifier' },
    ],
  },
  {
    id: 'amari', label: 'Amari', emoji: '🌿', color: '#10b981',
    items: [
      { label: 'Campari', type: 'modifier' },
      { label: 'Aperol', type: 'modifier' },
      { label: 'Fernet-Branca', type: 'modifier' },
      { label: 'Cynar', type: 'modifier' },
      { label: 'Averna', type: 'modifier' },
      { label: 'Suze', type: 'modifier' },
      { label: 'Montenegro', type: 'modifier' },
    ],
  },
  {
    id: 'citrus', label: 'Citrus', emoji: '🍋', color: '#facc15',
    items: [
      { label: 'Lemon Juice', type: 'citrus' },
      { label: 'Lime Juice', type: 'citrus' },
      { label: 'Orange Juice', type: 'citrus' },
      { label: 'Grapefruit', type: 'citrus' },
      { label: 'Pineapple', type: 'citrus' },
      { label: 'Cranberry', type: 'citrus' },
    ],
  },
  {
    id: 'sweeteners', label: 'Sweeteners', emoji: '🍬', color: '#fbbf24',
    items: [
      { label: 'Simple Syrup', type: 'sweetener' },
      { label: 'Rich Simple', type: 'sweetener' },
      { label: 'Demerara Syrup', type: 'sweetener' },
      { label: 'Honey Syrup', type: 'sweetener' },
      { label: 'Agave Nectar', type: 'sweetener' },
      { label: 'Orgeat', type: 'sweetener' },
      { label: 'Grenadine', type: 'sweetener' },
      { label: 'Maple Syrup', type: 'sweetener' },
    ],
  },
  {
    id: 'bitters', label: 'Bitters', emoji: '💧', color: '#b45309',
    items: [
      { label: 'Aromatic Bitters', type: 'bitters' },
      { label: "Peychaud's", type: 'bitters' },
      { label: 'Orange Bitters', type: 'bitters' },
      { label: 'Chocolate Bitters', type: 'bitters' },
      { label: 'Celery Bitters', type: 'bitters' },
    ],
  },
  {
    id: 'formulas', label: 'Formulas', emoji: '📋', color: '#3b82f6',
    items: [
      { label: 'The Sour', type: 'formula' },
      { label: 'Spirit-Forward', type: 'formula' },
      { label: 'Highball', type: 'formula' },
      { label: 'Negroni Style', type: 'formula' },
    ],
  },
];

const RADIUS = 96;
const SLICE_SIZE = 62;
const FLYOUT_WIDTH = 192;

interface RadialWheelProps {
  x: number;
  y: number;
  onClose: () => void;
  onCreateIngredient: (label: string, type: string) => void;
  onCreateSpec: () => void;
  onCreateContainer: () => void;
  onExpandFormula: (label: string) => void;
  onExpandRecipe: (recipe: Cocktail) => void;
  ibaCocktails: Cocktail[];
}

export default function RadialWheel({
  x, y, onClose, onCreateIngredient, onCreateSpec, onCreateContainer, onExpandFormula, onExpandRecipe, ibaCocktails,
}: RadialWheelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const flyoutOnLeft = x > window.innerWidth / 2;
  const flyoutLeft = flyoutOnLeft
    ? x - RADIUS - SLICE_SIZE / 2 - 14 - FLYOUT_WIDTH
    : x + RADIUS + SLICE_SIZE / 2 + 14;
  const flyoutTop = Math.min(Math.max(16, y - 120), window.innerHeight - 380);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);
  const filteredRecipes = ibaCocktails.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCategoryClick = (catId: string) => {
    setShowRecipeSearch(false);
    setActiveCategory(prev => (prev === catId ? null : catId));
  };

  const handleRecipesClick = () => {
    setActiveCategory(null);
    setShowRecipeSearch(prev => !prev);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="radial-overlay"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Radial ring */}
      <div
        className="radial-wheel"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {CATEGORIES.map((cat, i) => {
          const angle = (i / CATEGORIES.length) * 2 * Math.PI - Math.PI / 2;
          const cx = Math.cos(angle) * RADIUS;
          const cy = Math.sin(angle) * RADIUS;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              className={`radial-slice${isActive ? ' active' : ''}`}
              style={{
                left: cx - SLICE_SIZE / 2,
                top: cy - SLICE_SIZE / 2,
                width: SLICE_SIZE,
                height: SLICE_SIZE,
                borderColor: isActive ? cat.color : '#334155',
                boxShadow: isActive ? `0 0 14px ${cat.color}55` : undefined,
              }}
              onClick={(e) => { e.stopPropagation(); handleCategoryClick(cat.id); }}
              title={cat.label}
            >
              <span style={{ fontSize: '22px', lineHeight: 1 }}>{cat.emoji}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: isActive ? 'white' : '#94a3b8', marginTop: 2 }}>
                {cat.label}
              </span>
            </button>
          );
        })}

        {/* Center quick-actions */}
        <div className="radial-center">
          <button
            className="radial-center-btn"
            onClick={(e) => { e.stopPropagation(); onCreateSpec(); onClose(); }}
            title="New Blank Spec"
          >
            📝 Spec
          </button>
          <button
            className="radial-center-btn"
            onClick={(e) => { e.stopPropagation(); onCreateContainer(); onClose(); }}
            title="Group Container"
          >
            📦 Group
          </button>
          <button
            className={`radial-center-btn${showRecipeSearch ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleRecipesClick(); }}
            title="IBA Recipes"
          >
            📚 Recipes
          </button>
        </div>
      </div>

      {/* Flyout panel */}
      {(activeCat || showRecipeSearch) && (
        <div
          className="radial-flyout"
          style={{ left: flyoutLeft, top: flyoutTop }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeCat && !showRecipeSearch && (
            <>
              <div className="radial-flyout-header" style={{ color: activeCat.color }}>
                {activeCat.emoji} {activeCat.label}
              </div>
              {activeCat.items.map((item) => (
                <button
                  key={item.label}
                  className="radial-flyout-item"
                  onClick={() => {
                    if (item.type === 'formula') {
                      onExpandFormula(item.label);
                    } else {
                      onCreateIngredient(item.label, item.type);
                    }
                    onClose();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </>
          )}

          {showRecipeSearch && (
            <>
              <div className="radial-flyout-header">📚 IBA Library</div>
              <input
                autoFocus
                className="radial-search-input"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ overflowY: 'auto', maxHeight: 260 }}>
                {filteredRecipes.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                    No matches
                  </p>
                ) : (
                  filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.name}
                      className="radial-flyout-item"
                      onClick={() => { onExpandRecipe(recipe); onClose(); }}
                    >
                      📑 {recipe.name}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
