import React, { useState, useMemo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { supabase } from '../services/supabaseClient';
import { Save } from 'lucide-react';
import { parseAmount } from '../utils/pricing';

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
        const amount = parseAmount(edge.label || '');
        return sum + (amount * sourceNode.data.unitPrice);
      }
      return sum;
    }, 0);
  }, [getEdges, getNodes]);

  const isMatched = data.isMatched && !data.isCustomOverride;

  const isLockedNode = data.isLocked ?? true; // Default to locked as requested by user
  const isCustom = data.isCustomOverride;
  
  // Theme styling
  const bgColor = isMatched ? 'rgba(6, 78, 59, 0.4)' : '#0f172a'; // emerald-950/40 or slate-950
  const borderColor = isMatched ? '#10b981' : isCustom ? '#f59e0b' : '#334155'; // emerald-500, amber-500, or slate-700
  const shadowColor = isMatched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.4)';

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
        border: `2px solid ${selected ? '#10b981' : borderColor}`, 
        borderRadius: '16px', 
        padding: '20px',
        boxShadow: `0 20px 40px ${shadowColor}`,
        minWidth: '240px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(8px)',
        position: 'relative'
      }}
    >
      {/* Action Buttons */}
      <div className="no-export" style={{
        position: 'absolute',
        top: '-12px',
        right: '-12px',
        display: 'flex',
        gap: '6px',
        opacity: 1,
        pointerEvents: 'all',
        zIndex: 10
      }}>
        <button 
          onClick={toggleLock}
          title={isLockedNode ? "Unlock Ingredients" : "Lock Ingredients"}
          style={{ 
            background: isLockedNode ? '#10b981' : '#334155', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '12px', 
            color: 'white',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
        >
          {isLockedNode ? '🔒' : '🔓'}
        </button>
        
        <button 
          onClick={saveToLibrary}
          title="Save to Library"
          style={{ 
            background: '#059669', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '12px', 
            color: 'white',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
            opacity: isSaving ? 0.5 : 1
          }}
        >
          {isSaving ? '...' : <Save size={12} />}
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="Edit name"
          style={{ 
            background: '#334155', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '12px', 
            color: 'white',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
        >
          ✏️
        </button>
        
        <button 
          onClick={(e) => { e.stopPropagation(); deleteNode(); }}
          title="Delete specification"
          style={{ 
            background: '#f87171', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '12px', 
            color: 'white',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
        >
          ✕
        </button>
      </div>
// ... rest of the component


      <Handle className="no-export" id="target-left" type="target" position={Position.Left} style={{ background: '#fff', width: '4px', height: '12px', borderRadius: '1px', border: `1px solid ${borderColor}` }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flexGrow: 1 }}>
          {isMatched && <div style={{ fontSize: '10px', color: '#34d399', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 800, letterSpacing: '0.05em' }}>✨ Branch Match</div>}
          {data.isCustomOverride && <div style={{ fontSize: '10px', color: '#fbbf24', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 800, letterSpacing: '0.05em' }}>🛠️ Custom Spec</div>}
          
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
              style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'white' }}
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={toggleOverride}
            title={data.isCustomOverride ? "Re-enable Auto-Matcher" : "Make Custom Spec"}
            style={{ 
              background: data.isCustomOverride ? '#1e293b' : 'transparent',
              border: '1px solid #334155',
              padding: '4px',
              borderRadius: '6px',
              cursor: 'pointer', 
              fontSize: '12px', 
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {data.isCustomOverride ? '🪄 Enable Matcher' : '🛠️ Override'}
          </button>
        </div>
      </div>

       <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '12px', marginTop: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
         {(!data.ingredientsList || data.ingredientsList.length === 0) ? (
           <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>Connect ingredients on canvas...</div>
         ) : (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '12px' }}>
               {data.ingredientsList.map((ing: any, idx: number) => (
                 <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: idx < data.ingredientsList.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
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
