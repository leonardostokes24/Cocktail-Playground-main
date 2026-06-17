import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Search, Sparkles, Loader } from 'lucide-react';
import { searchByName, suggestByIngredients, type CDBRecipe } from '../api/cocktaildb';

type Status = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function Sidebar({
  type,
  isOpen,
  canvasIngredients = [],
}: {
  type: 'builder' | 'library';
  isOpen: boolean;
  canvasIngredients?: string[];
}) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Library-only state
  const [results, setResults] = useState<CDBRecipe[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, categoryType: string, extraData?: Record<string, unknown>) => {
    const nodeData = { nodeType, label, categoryType, ...extraData };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  // Debounced name search for library
  useEffect(() => {
    if (type !== 'library') return;
    clearTimeout(debounceRef.current);

    if (!search.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchByName(search);
        setResults(found);
        setStatus(found.length > 0 ? 'results' : 'empty');
      } catch {
        setStatus('error');
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [search, type]);

  const handleSuggest = async () => {
    if (!canvasIngredients.length) return;
    setSearch('');
    setStatus('loading');
    try {
      const found = await suggestByIngredients(canvasIngredients);
      setResults(found);
      setStatus(found.length > 0 ? 'results' : 'empty');
    } catch {
      setStatus('error');
    }
  };

  const IngredientItem = ({ label, type: itemType, emoji, color }: { label: string; type: string; emoji: string; color: string }) => {
    if (search && !label.toLowerCase().includes(search.toLowerCase())) return null;
    return (
      <div className="dnd-node" draggable onDragStart={(e) => onDragStart(e, 'ingredient', label, itemType)}>
        <span>{label}</span> <span className={color}>{emoji}</span>
      </div>
    );
  };

  const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => {
    const isCollapsed = collapsed[id];
    return (
      <section style={{ marginBottom: '12px' }}>
        <div
          onClick={() => toggleSection(id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '8px 0',
            borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
          }}
        >
          <h3 className="section-title" style={{ margin: 0 }}>{title}</h3>
          <span style={{ color: '#64748b' }}>
            {isCollapsed ? <Plus size={12} /> : <Minus size={12} />}
          </span>
        </div>
        {!isCollapsed && <div className="flex flex-col gap-1 mt-2">{children}</div>}
      </section>
    );
  };


  return (
    <aside className={`sidebar ${type === 'builder' ? 'left' : 'right'} ${!isOpen ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-box">{type === 'builder' ? 'B' : 'L'}</div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          {type === 'builder' ? 'Builder' : 'Cocktail Search'}
        </h1>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder={type === 'builder' ? 'Search Ingredients...' : 'Search any cocktail...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              padding: '10px 10px 10px 30px',
              borderRadius: '8px',
              color: 'white',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {type === 'library' && (
          <button
            onClick={handleSuggest}
            disabled={!canvasIngredients.length || status === 'loading'}
            style={{
              marginTop: '8px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px',
              borderRadius: '8px',
              border: '1px solid #065f46',
              background: canvasIngredients.length ? '#052c21' : '#0f172a',
              color: canvasIngredients.length ? '#10b981' : '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: canvasIngredients.length ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            <Sparkles size={13} />
            {canvasIngredients.length
              ? `Suggest from Canvas (${canvasIngredients.length} ingredient${canvasIngredients.length > 1 ? 's' : ''})`
              : 'Add ingredients to canvas first'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {type === 'builder' ? (
          <>
            <Section title="Layout & Grouping" id="layout">
              <div
                className="dnd-node"
                style={{ border: '1px dashed #64748b' }}
                draggable
                onDragStart={(e) => onDragStart(e, 'container', 'New Group', 'container')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📋 <span>Group Container</span></span>
              </div>
            </Section>

            <Section title="Base Spirits" id="spirits">
              <IngredientItem label="Bourbon" type="spirit" emoji="🥃" color="text-amber-500" />
              <IngredientItem label="Rye Whiskey" type="spirit" emoji="🥃" color="text-amber-600" />
              <IngredientItem label="Scotch" type="spirit" emoji="🥃" color="text-amber-700" />
              <IngredientItem label="Irish Whiskey" type="spirit" emoji="🍀" color="text-emerald-600" />
              <IngredientItem label="London Dry Gin" type="spirit" emoji="🍸" color="text-blue-300" />
              <IngredientItem label="Old Tom Gin" type="spirit" emoji="🐱" color="text-amber-200" />
              <IngredientItem label="Vodka" type="spirit" emoji="💎" color="text-slate-300" />
              <IngredientItem label="Blanco Tequila" type="spirit" emoji="🌵" color="text-emerald-400" />
              <IngredientItem label="Reposado Tequila" type="spirit" emoji="🌵" color="text-amber-500" />
              <IngredientItem label="Mezcal" type="spirit" emoji="🔥" color="text-emerald-600" />
              <IngredientItem label="Light Rum" type="spirit" emoji="🏴‍☠️" color="text-slate-200" />
              <IngredientItem label="Dark Rum" type="spirit" emoji="🏴‍☠️" color="text-amber-900" />
              <IngredientItem label="Overproof Rum" type="spirit" emoji="💣" color="text-red-600" />
              <IngredientItem label="Cognac" type="spirit" emoji="🍷" color="text-amber-800" />
              <IngredientItem label="Brandy / Pisco" type="spirit" emoji="🍇" color="text-slate-100" />
              <IngredientItem label="Cachaça" type="spirit" emoji="🎋" color="text-emerald-300" />
              <IngredientItem label="Applejack" type="spirit" emoji="🍎" color="text-red-500" />
            </Section>

            <Section title="Liqueurs" id="liqueurs">
              <IngredientItem label="Triple Sec" type="modifier" emoji="🍊" color="text-orange-300" />
              <IngredientItem label="Curaçao" type="modifier" emoji="🌊" color="text-blue-500" />
              <IngredientItem label="Maraschino" type="modifier" emoji="🍒" color="text-slate-100" />
              <IngredientItem label="Elderflower" type="modifier" emoji="🌸" color="text-yellow-100" />
              <IngredientItem label="Benedictine" type="modifier" emoji="⛪" color="text-amber-600" />
              <IngredientItem label="Drambuie" type="modifier" emoji="🏴󠁧󠁢󠁳󠁣󠁴󠁿" color="text-amber-500" />
              <IngredientItem label="Green Chartreuse" type="modifier" emoji="🌿" color="text-emerald-500" />
              <IngredientItem label="Yellow Chartreuse" type="modifier" emoji="🌿" color="text-yellow-500" />
              <IngredientItem label="Amaretto" type="modifier" emoji="🥜" color="text-amber-800" />
              <IngredientItem label="Coffee Liqueur" type="modifier" emoji="☕" color="text-amber-950" />
              <IngredientItem label="Apricot Brandy" type="modifier" emoji="🍑" color="text-orange-400" />
              <IngredientItem label="Crème de Violette" type="modifier" emoji="🟣" color="text-purple-400" />
              <IngredientItem label="Absinthe" type="modifier" emoji="🧚" color="text-emerald-300" />
            </Section>

            <Section title="Fortified & Vermouth" id="vermouth">
              <IngredientItem label="Sweet Vermouth" type="modifier" emoji="🍷" color="text-red-700" />
              <IngredientItem label="Dry Vermouth" type="modifier" emoji="🍸" color="text-slate-400" />
              <IngredientItem label="Blanc Vermouth" type="modifier" emoji="🥂" color="text-yellow-100" />
              <IngredientItem label="Fino Sherry" type="modifier" emoji="🍷" color="text-yellow-500" />
              <IngredientItem label="Pedro Ximénez" type="modifier" emoji="🍇" color="text-amber-900" />
              <IngredientItem label="Lillet Blanc" type="modifier" emoji="🇫🇷" color="text-yellow-200" />
            </Section>

            <Section title="Amari & Aperitifs" id="amari">
              <IngredientItem label="Campari" type="modifier" emoji="🔴" color="text-red-500" />
              <IngredientItem label="Aperol" type="modifier" emoji="🟠" color="text-orange-500" />
              <IngredientItem label="Fernet-Branca" type="modifier" emoji="🦅" color="text-emerald-950" />
              <IngredientItem label="Cynar" type="modifier" emoji="🌿" color="text-emerald-700" />
              <IngredientItem label="Averna" type="modifier" emoji="🇮🇹" color="text-amber-900" />
              <IngredientItem label="Suze" type="modifier" emoji="🌼" color="text-yellow-500" />
              <IngredientItem label="Montenegro" type="modifier" emoji="🏰" color="text-amber-700" />
            </Section>

            <Section title="Juices & Citrus" id="citrus">
              <IngredientItem label="Lemon Juice" type="citrus" emoji="🍋" color="text-yellow-400" />
              <IngredientItem label="Lime Juice" type="citrus" emoji="🍈" color="text-emerald-400" />
              <IngredientItem label="Orange Juice" type="citrus" emoji="🍊" color="text-orange-400" />
              <IngredientItem label="Grapefruit" type="citrus" emoji="🍑" color="text-pink-400" />
              <IngredientItem label="Pineapple" type="citrus" emoji="🍍" color="text-yellow-600" />
              <IngredientItem label="Cranberry" type="citrus" emoji="🍒" color="text-red-500" />
            </Section>

            <Section title="Sweeteners" id="sweeteners">
              <IngredientItem label="Simple Syrup" type="sweetener" emoji="🍯" color="text-slate-300" />
              <IngredientItem label="Rich Simple" type="sweetener" emoji="🍯" color="text-yellow-100" />
              <IngredientItem label="Demerara Syrup" type="sweetener" emoji="🍯" color="text-amber-900" />
              <IngredientItem label="Honey Syrup" type="sweetener" emoji="🍯" color="text-amber-400" />
              <IngredientItem label="Agave Nectar" type="sweetener" emoji="🌱" color="text-amber-200" />
              <IngredientItem label="Orgeat" type="sweetener" emoji="🥜" color="text-slate-100" />
              <IngredientItem label="Grenadine" type="sweetener" emoji="🍒" color="text-red-600" />
              <IngredientItem label="Maple Syrup" type="sweetener" emoji="🍁" color="text-amber-700" />
            </Section>

            <Section title="Bitters & Tinctures" id="bitters">
              <IngredientItem label="Aromatic Bitters" type="bitters" emoji="🪵" color="text-amber-900" />
              <IngredientItem label="Peychaud's" type="bitters" emoji="🔴" color="text-red-600" />
              <IngredientItem label="Orange Bitters" type="bitters" emoji="🍊" color="text-orange-500" />
              <IngredientItem label="Chocolate Bitters" type="bitters" emoji="🍫" color="text-amber-950" />
              <IngredientItem label="Celery Bitters" type="bitters" emoji="🌱" color="text-emerald-500" />
            </Section>

            <Section title="Formulas & Clusters" id="formulas">
              <div className="dnd-node formula-node" draggable onDragStart={(e) => onDragStart(e, 'spec', 'The Sour', 'spec')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🍋 <span>The Sour Cluster</span></span>
              </div>
              <div className="dnd-node formula-node" draggable onDragStart={(e) => onDragStart(e, 'spec', 'Spirit-Forward', 'spec')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🥃 <span>Spirit-Forward</span></span>
              </div>
              <div className="dnd-node formula-node" draggable onDragStart={(e) => onDragStart(e, 'spec', 'Highball', 'spec')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🫧 <span>Highball / Fizz</span></span>
              </div>
              <div className="dnd-node formula-node" draggable onDragStart={(e) => onDragStart(e, 'spec', 'Negroni Style', 'spec')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🔴 <span>Negroni Style</span></span>
              </div>
              <div className="dnd-node" style={{ background: '#0f172a', border: '1px solid #334155' }} draggable onDragStart={(e) => onDragStart(e, 'spec', 'Custom Recipe', 'spec')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📝 <span>Blank Spec</span></span>
              </div>
            </Section>
          </>
        ) : (
          /* ── Library / Search panel ── */
          <div style={{ flex: 1 }}>
            {status === 'idle' && (
              <div style={{ textAlign: 'center', marginTop: '32px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>🍹</div>
                Search 600+ cocktails by name,<br />or use Suggest to find drinks<br />based on what's on your canvas.
              </div>
            )}

            {status === 'loading' && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '40px', color: '#64748b', gap: '8px' }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px' }}>Searching...</span>
              </div>
            )}

            {status === 'empty' && (
              <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '32px' }}>
                No cocktails found. Try a different search.
              </p>
            )}

            {status === 'error' && (
              <p style={{ fontSize: '12px', color: '#f87171', textAlign: 'center', marginTop: '32px' }}>
                Couldn't reach CocktailDB. Check your connection.
              </p>
            )}

            {status === 'results' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''} — drag to canvas
                </p>
                {results.map((recipe, idx) => (
                  <div
                    key={idx}
                    className="dnd-node"
                    style={{ background: '#052c21', border: '1px solid #064e3b', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', cursor: 'grab' }}
                    draggable
                    onDragStart={(e) => onDragStart(e, 'recipe', recipe.name, 'spec', { recipe })}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      📑 <span>{recipe.name}</span>
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', paddingLeft: '24px' }}>
                      {recipe.method} · {recipe.glass}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
        <p className="text-[11px] text-slate-400 uppercase tracking-tighter font-bold">
          {type === 'builder' ? 'Lineage Mode: Ready' : 'CocktailDB: Live'}
        </p>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
          {type === 'builder'
            ? 'Drag base spirits and modifiers to the canvas to start identifying lineages and classic ratios.'
            : 'Searching thecocktaildb.com — 600+ cocktails. Drag any result onto the canvas to expand its full spec.'}
        </p>
      </div>
    </aside>
  );
}