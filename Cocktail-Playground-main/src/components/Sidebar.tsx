import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function Sidebar({ type, isOpen, user, onTabChange }: { type: 'builder' | 'library', isOpen: boolean, user: any, onTabChange: (type: 'builder' | 'library') => void }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customRecipes, setCustomRecipes] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All', color: '#64748b', glow: 'rgba(100, 116, 139, 0.4)', outline: '#94a3b8' },
    { id: 'spirits', label: 'Spirits', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', outline: '#fbbf24' },
    { id: 'liqueurs', label: 'Liqueurs', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)', outline: '#fdba74' },
    { id: 'vermouth', label: 'Vermouth', color: '#dc2626', glow: 'rgba(220, 38, 38, 0.4)', outline: '#ef4444' },
    { id: 'amari', label: 'Amari', color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', outline: '#34d399' },
    { id: 'citrus', label: 'Citrus', color: '#facc15', glow: 'rgba(250, 204, 21, 0.4)', outline: '#fde047' },
    { id: 'sweeteners', label: 'Sweet', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', outline: '#fcd34d' },
    { id: 'bitters', label: 'Bitters', color: '#92400e', glow: 'rgba(146, 64, 14, 0.4)', outline: '#b45309' },
    { id: 'formulas', label: 'Formulas', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', outline: '#60a5fa' },
  ];

  useEffect(() => {
    if (!user) {
      setCustomRecipes([]);
      return;
    }

    const fetchCustomRecipes = async () => {
      const { data, error } = await supabase
        .from('cocktails')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error && data) {
        setCustomRecipes(data);
      }
    };

    fetchCustomRecipes();
  }, [user]);

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const IngredientItem = ({ label, type, emoji, color }: { label: string, type: string, emoji: string, color: string }) => {
    if (search && !label.toLowerCase().includes(search.toLowerCase())) return null;
    return (
      <div className="dnd-node" draggable onDragStart={(e) => onDragStart(e, 'ingredient', label, type)}>
        <span>{label}</span> <span className={color}>{emoji}</span>
      </div>
    );
  };

  const Section = ({ title, id, children }: { title: string, id: string, children: React.ReactNode }) => {
    if (type === 'builder' && activeCategory !== 'all' && activeCategory !== id) return null;
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
            borderBottom: '1px solid rgba(51, 65, 85, 0.5)'
          }}
        >
          <h3 className="section-title" style={{ margin: 0 }}>{title}</h3>
          <span style={{ color: '#64748b' }}>
            {isCollapsed ? <Plus size={12} /> : <Minus size={12} />}
          </span>
        </div>
        {!isCollapsed && (
          <div className="flex flex-col gap-1 mt-2">
            {children}
          </div>
        )}
      </section>
    );
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, categoryType: string, extraData?: any) => {
    const nodeData = { nodeType, label, categoryType, ...extraData };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`sidebar ${type === 'builder' ? 'left' : 'right'} ${!isOpen ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-box">{type === 'builder' ? 'B' : 'L'}</div>
        <h1 className="text-xl font-bold tracking-tight text-white">{type === 'builder' ? 'Builder' : 'My Recipes'}</h1>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder={type === 'builder' ? "Search Ingredients..." : "Search IBA Library..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
        />
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
          <section>
            <h3 className="section-title">Saved Recipes</h3>
            <div className="flex flex-col gap-2">
              {customRecipes
                .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
                .map((recipe, idx) => (
                  <div
                    key={`custom-${idx}`}
                    className="dnd-node"
                    style={{ background: '#1e3a8a', border: '1px solid #1e40af' }}
                    draggable
                    onDragStart={(e) => onDragStart(e, 'recipe', recipe.name, 'spec', { recipe })}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⭐ <span>{recipe.name}</span></span>
                  </div>
                ))
              }
              {customRecipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '20px' }}>
                  {customRecipes.length === 0 ? 'Save a spec to see it here' : 'No matches found'}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
       <div className="mt-8 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
         {type === 'builder' ? (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setCollapsed(prev => ({ ...prev, [cat.id]: false }));
                    }}
                    style={{ 
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: `1px solid ${cat.color}`,
                      color: 'white',
                      background: activeCategory === cat.id 
                        ? `linear-gradient(180deg, ${cat.outline} 0%, ${cat.color} 100%)` 
                        : 'transparent',
                      boxShadow: activeCategory === cat.id 
                        ? `0 0 10px ${cat.glow}, 0 0 20px ${cat.glow}, inset 0 1px 1px rgba(255,255,255,0.3)` 
                        : `0 0 5px ${cat.glow}`,
                      outline: activeCategory === cat.id ? `2px solid ${cat.outline}` : 'none',
                      textShadow: activeCategory === cat.id ? '0 0 5px rgba(0,0,0,0.5)' : 'none',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
             </div>
             <p className="text-[10px] text-slate-500 mt-2 leading-relaxed text-center">
               {activeCategory === 'all' 
                 ? 'Explore all ingredients' 
                 : `Showing ${categories.find(c => c.id === activeCategory)?.label} items`}
             </p>
           </div>
         ) : (
           <div style={{ display: 'flex', gap: '8px' }}>
             <button 
               onClick={() => onTabChange('builder')}
               style={{ 
                 flex: 1,
                 padding: '8px',
                 borderRadius: '8px',
                 fontSize: '11px',
                 fontWeight: 'bold',
                 cursor: 'pointer',
                 transition: 'all 0.2s',
                 border: 'none',
                 color: 'white',
                 background: '#1e293b',
                 boxShadow: 'none',
                 outline: 'none',
               }}
             >
               🛠️ Switch to Builder
             </button>
             <button 
               onClick={() => onTabChange('library')}
               style={{ 
                 flex: 1,
                 padding: '8px',
                 borderRadius: '8px',
                 fontSize: '11px',
                 fontWeight: 'bold',
                 cursor: 'pointer',
                 transition: 'all 0.2s',
                 border: 'none',
                 color: 'white',
                 background: '#3b82f6',
                 boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
                 outline: '2px solid #60a5fa',
               }}
             >
               📚 Library
             </button>
           </div>
         )}
        </div>
      </aside>
    );
  }

