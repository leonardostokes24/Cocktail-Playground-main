import React, { useState, useEffect, useRef } from 'react';
import type { Cocktail } from '../data/cocktailDB';
import { useIngredients } from '../hooks/useIngredients';
import { CATEGORY_TO_TYPE } from '../services/ingredientsService';

interface IngredientItem {
  label: string;
  type: string;
}

interface CategoryConfig {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

// Visual config for each wheel slice — items are populated from the DB at runtime
const WHEEL_CONFIG: CategoryConfig[] = [
  { id: 'spirits',    label: 'Spirits',    emoji: '🥃', color: '#f59e0b' },
  { id: 'liqueurs',   label: 'Liqueurs',   emoji: '🍹', color: '#fb923c' },
  { id: 'vermouth',   label: 'Vermouth',   emoji: '🍷', color: '#dc2626' },
  { id: 'amari',      label: 'Amari',      emoji: '🌿', color: '#10b981' },
  { id: 'citrus',     label: 'Citrus',     emoji: '🍋', color: '#facc15' },
  { id: 'sweeteners', label: 'Sweeteners', emoji: '🍬', color: '#fbbf24' },
  { id: 'bitters',    label: 'Bitters',    emoji: '💧', color: '#b45309' },
  { id: 'formulas',   label: 'Formulas',   emoji: '📋', color: '#3b82f6' },
];

// Formulas are not ingredients — always hardcoded
const FORMULA_ITEMS: IngredientItem[] = [
  { label: 'The Sour',       type: 'formula' },
  { label: 'Spirit-Forward', type: 'formula' },
  { label: 'Highball',       type: 'formula' },
  { label: 'Negroni Style',  type: 'formula' },
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
  onSearchCocktails: (q: string) => Promise<Cocktail[]>;
}

export default function RadialWheel({
  x, y, onClose, onCreateIngredient, onCreateSpec, onCreateContainer, onExpandFormula, onExpandRecipe, onSearchCocktails,
}: RadialWheelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showRecipeSearch, setShowRecipeSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Cocktail[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await onSearchCocktails(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, onSearchCocktails]);

  const { ingredients } = useIngredients();

  const flyoutOnLeft = x > window.innerWidth / 2;
  const flyoutLeft = flyoutOnLeft
    ? x - RADIUS - SLICE_SIZE / 2 - 14 - FLYOUT_WIDTH
    : x + RADIUS + SLICE_SIZE / 2 + 14;
  const flyoutTop = Math.min(Math.max(16, y - 120), window.innerHeight - 380);

  const activeCat = WHEEL_CONFIG.find(c => c.id === activeCategory);

  // Items for the active category flyout
  const activeCatItems: IngredientItem[] = activeCategory === 'formulas'
    ? FORMULA_ITEMS
    : (ingredients[activeCategory ?? ''] ?? []).map(ing => ({
        label: ing.label,
        type: CATEGORY_TO_TYPE[ing.category] ?? 'modifier',
      }));

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
        {WHEEL_CONFIG.map((cat, i) => {
          const angle = (i / WHEEL_CONFIG.length) * 2 * Math.PI - Math.PI / 2;
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
                borderColor: isActive ? cat.color : 'rgba(255,255,255,0.12)',
                boxShadow: isActive
                  ? `0 0 20px ${cat.color}55, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`
                  : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
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
              {activeCatItems.length === 0 && (
                <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                  No ingredients yet
                </p>
              )}
              {activeCatItems.map((item) => (
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
              <div className="radial-flyout-header">📚 Recipe Library</div>
              <input
                autoFocus
                className="radial-search-input"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ overflowY: 'auto', maxHeight: 260 }}>
                {isSearching ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                    Searching…
                  </p>
                ) : !searchQuery.trim() ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                    Type to search the library
                  </p>
                ) : searchResults.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                    No matches
                  </p>
                ) : (
                  searchResults.map((recipe) => (
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
