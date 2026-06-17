import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

export default function IngredientNode({ id, data, selected }: any) {
  const { updateNodeData, setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);

  const typeColors: Record<string, string> = {
    spirit: '#fbbf24',    // amber-400
    sweetener: '#60a5fa', // blue-400
    bitters: '#f87171',   // red-400
    citrus: '#facc15',   // yellow-400
    modifier: '#c084fc'  // purple-400
  };

  const handleSave = () => {
    setIsEditing(false);
    updateNodeData(id, { label: name });
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  };

  return (
    <div 
      style={{ 
        background: '#1e293b', 
        border: `1px solid ${selected ? '#10b981' : (typeColors[data.type] || '#334155')}`, 
        borderRadius: '8px', 
        padding: '8px 12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        minWidth: '120px',
        textAlign: 'center',
        color: '#e2e8f0',
        position: 'relative'
      }}
    >
      {/* Action Buttons */}
      <div style={{
        position: 'absolute',
        top: '-10px',
        right: '-10px',
        display: 'flex',
        gap: '4px',
        zIndex: 10
      }}>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="Edit ingredient"
          style={{ 
            background: '#334155', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '8px', 
            color: 'white',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
        >
          ✏️
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); deleteNode(); }}
          title="Delete ingredient"
          style={{ 
            background: '#f87171', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '10px', 
            color: 'white',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            opacity: 1,
            pointerEvents: 'all',
            transition: 'all 0.2s'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '2px' }}>
        {data.type}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        {isEditing ? (
          <input 
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{ width: '100%', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', border: 'none', background: '#334155', color: 'white', borderRadius: '4px', outline: 'none' }}
          />
        ) : (
          <div 
            style={{ fontWeight: 600, fontSize: '13px' }}
          >
            {data.label}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#475569', width: '4px', height: '12px', borderRadius: '1px' }} />
    </div>
  );
}
