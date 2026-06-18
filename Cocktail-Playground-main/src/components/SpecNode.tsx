import React, { useState, useMemo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { supabase } from '../services/supabaseClient';
import { Save } from 'lucide-react';
import { parseAmount } from '../utils/pricing';
import { HierarchyManager } from '../utils/hierarchy';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SpecNode({ id, data, selected }: any) {
  const { setNodes, getNodes, getEdges } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const [isSaving, setIsSaving] = useState(false);
  
  const totalCost = useMemo(() => {
    const edges = getEdges().filter(e => e.target === id);
    const nodes = getNodes();
    return edges.reduce((sum, edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.type === 'ingredient' && sourceNode.data?.unitPrice) {
        const amount = parseAmount(edge.label as string || '');
        return sum + (amount * (sourceNode.data.unitPrice as number));
      }
      return sum;
    }, 0);
  // data.ingredientsList changes whenever edges connecting to this spec change,
  // which is the correct trigger for recalculating cost.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data.ingredientsList, getEdges, getNodes]);

  const isMatched = data.isMatched && !data.isCustomOverride;

  const isLockedNode = data.isLocked ?? true; // Default to locked as requested by user
  const isCustom = data.isCustomOverride;
  
  // Theme styling
  const bgColor = isMatched ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)';
  const borderColor = isMatched ? 'rgba(16,185,129,0.35)' : isCustom ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.10)';
  const shadowColor = isMatched ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.4)';

  const handleSave = () => {
    setIsEditing(false);
    setNodes((nds) => 
      nds.map((node) => 
        node.id === id ? { ...node, data: { ...node.data, label: name, isCustomOverride: true } } : node
      )
    );
  };

  const toggleOverride = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => 
      nds.map((node) => 
        node.id === id ? { ...node, data: { ...node.data, isCustomOverride: !data.isCustomOverride } } : node
      )
    );
  };

  const deleteNode = () => {
    setNodes((nds) => {
      const remainingNodes = nds.filter((n) => n.id !== id);
      return remainingNodes.map((node) => {
        if (node.parentId === id) {
          // We need the absolute position of the node before it loses its parent
          // But HierarchyManager needs the full list.
          return { 
            ...node, 
            parentId: undefined, 
            position: HierarchyManager.getAbsolutePosition(node, nds),
            extent: undefined 
          };
        }
        return node;
      });
    });
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => 
      nds.map((node) => 
        node.id === id ? { ...node, data: { ...node.data, isLocked: !isLockedNode } } : node
      )
    );
  };

  const saveToLibrary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please sign in to save custom recipes!');
        return;
      }

      if (user.id === 'demo-user-123') {
        const local = localStorage.getItem('demo_recipes');
        const current = local ? JSON.parse(local) : [];
        const updated = [...current.filter((r: any) => r.name !== data.label), {
          name: data.label,
          method: data.method,
          glass: data.glassware,
          user_id: user.id,
          ingredients: data.ingredientsList || []
        }];
        localStorage.setItem('demo_recipes', JSON.stringify(updated));
        alert('Recipe saved to your library (Demo Mode)!');
        return;
      }

      const { error } = await supabase.from('cocktails').upsert({
        name: data.label,
        method: data.method,
        glass: data.glassware,
        user_id: user.id,
        ingredients: data.ingredientsList || []
      });

      if (error) throw error;
      alert('Recipe saved to your library!');
    } catch (err: any) {
      alert('Error saving recipe: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      style={{
        background: bgColor,
        color: '#f8fafc',
        border: `1px solid ${selected ? 'rgba(16,185,129,0.55)' : borderColor}`,
        outline: 'none',
        borderRadius: '14px',
        padding: '18px',
        boxShadow: selected
          ? `0 0 0 1.5px rgba(16,185,129,0.6), -2px 0 10px rgba(255,30,80,0.25), 2px 0 10px rgba(30,120,255,0.25), 0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)`
          : `0 16px 48px ${shadowColor}, inset 0 1px 0 rgba(255,255,255,${isMatched ? '0.12' : '0.08'}), -0.5px 0 0 rgba(255,30,80,0.07), 0.5px 0 0 rgba(30,120,255,0.07)`,
        minWidth: '240px',
        transition: 'box-shadow 0.25s ease, border-color 0.2s ease',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        position: 'relative'
      }}
    >
      {/* Action Buttons */}
      <div className="no-export" style={{ position: 'absolute', top: '-14px', right: '-10px', display: 'flex', gap: '5px', zIndex: 10 }}>
        <Button
          size="icon-xs"
          variant={isLockedNode ? 'default' : 'secondary'}
          onClick={toggleLock}
          title={isLockedNode ? 'Unlock Ingredients' : 'Lock Ingredients'}
          className="rounded-full shadow-md"
        >
          {isLockedNode ? '🔒' : '🔓'}
        </Button>

        <Button
          size="icon-xs"
          variant="default"
          onClick={saveToLibrary}
          title="Save to Library"
          className="rounded-full shadow-md"
          disabled={isSaving}
        >
          {isSaving ? '…' : <Save size={11} />}
        </Button>

        <Button
          size="icon-xs"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="Edit name"
          className="rounded-full shadow-md"
        >
          ✏️
        </Button>

        <Button
          size="icon-xs"
          variant="destructive"
          onClick={(e) => { e.stopPropagation(); deleteNode(); }}
          title="Delete specification"
          className="rounded-full shadow-md"
        >
          ✕
        </Button>
      </div>

      <Handle className="no-export" id="target-left" type="target" position={Position.Left} style={{ background: '#fff', width: '4px', height: '12px', borderRadius: '1px', border: `1px solid ${borderColor}` }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flexGrow: 1 }}>
          <div className="flex gap-1.5 mb-1">
            {isMatched && <Badge className="text-[9px] px-1.5 py-0 bg-emerald-900/60 text-emerald-300 border-emerald-700/50 font-extrabold uppercase tracking-wider">✨ Match</Badge>}
            {data.isCustomOverride && <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-400 border-amber-600/50 font-extrabold uppercase tracking-wider">🛠️ Custom</Badge>}
          </div>
          
          {isEditing ? (
             <input 
               autoFocus
               value={name}
               onChange={(e) => setName(e.target.value)}
               onBlur={handleSave}
               onKeyDown={(e) => e.key === 'Enter' && handleSave()}
               style={{ width: '90%', fontSize: '18px', fontWeight: 'bold', background: '#1e293b', color: 'white', borderRadius: '4px', border: '1px solid #475569', padding: '2px 8px', outline: 'none' }}
             />
          ) : (
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'white',
                textShadow: isMatched
                  ? '-1px 0 rgba(255,30,80,0.35), 1px 0 rgba(30,120,255,0.35), 0 0 16px rgba(16,185,129,0.25)'
                  : '-0.5px 0 rgba(255,30,80,0.2), 0.5px 0 rgba(30,120,255,0.2)',
              }}
            >
              {data.label}
            </div>
          )}
          <div style={{ fontSize: '11px', color: isMatched ? '#34d399' : '#64748b', marginTop: '4px', fontWeight: 600 }}>
             {isMatched ? (
               <span style={{ display: 'flex', gap: '8px' }}>
                 <span style={{ background: 'rgba(6, 78, 59, 0.6)', padding: '2px 6px', borderRadius: '4px' }}>{data.method?.toUpperCase()}</span>
                 <span style={{ background: 'rgba(6, 78, 59, 0.6)', padding: '2px 6px', borderRadius: '4px' }}>{data.glassware?.toUpperCase()}</span>
               </span>
             ) : (
               <span>{data.method} • {data.glassware}</span>
             )}
          </div>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={toggleOverride}
          title={data.isCustomOverride ? 'Re-enable Auto-Matcher' : 'Make Custom Spec'}
          className="text-muted-foreground text-[11px] h-6 px-2"
        >
          {data.isCustomOverride ? '🪄 Matcher' : '🛠️ Override'}
        </Button>
      </div>

       <div style={{ background: 'rgba(0,0,0,0.22)', borderRadius: '10px', padding: '12px', marginTop: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
         {(!data.ingredientsList || data.ingredientsList.length === 0) ? (
           <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>Connect ingredients on canvas...</div>
         ) : (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '12px' }}>
               {data.ingredientsList.map((ing: any, idx: number) => (
                 <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: idx < data.ingredientsList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                   <span style={{ fontWeight: 800, color: isMatched ? '#34d399' : '#cbd5e1' }}>{ing.amount}</span>
                   <span style={{ color: '#94a3b8' }}>{ing.name}</span>
                 </li>
               ))}
             </ul>
             <div style={{ 
               display: 'flex', 
               justifyContent: 'space-between', 
               alignItems: 'center', 
               marginTop: '4px', 
               paddingTop: '8px', 
               borderTop: '2px solid rgba(255,255,255,0.1)',
               fontSize: '13px',
               fontWeight: 'bold',
               color: '#f8fafc'
             }}>
               <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>EST. COST:</span>
               <span style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.3)' }}>
                 ${totalCost.toFixed(2)}
               </span>
             </div>
           </div>
         )}
       </div>


      <Handle className="no-export" id="source-right" type="source" position={Position.Right} style={{ background: '#fff', width: '4px', height: '12px', borderRadius: '1px', border: `1px solid ${borderColor}` }} />
    </div>
  );
}
