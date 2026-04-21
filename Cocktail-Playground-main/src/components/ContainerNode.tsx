import React, { useState } from 'react';
import { NodeResizer, useReactFlow } from '@xyflow/react';

export default function ContainerNode({ id, data, selected }: any) {
  const { updateNodeData, setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'New Group');

  const handleSave = () => {
    setIsEditing(false);
    updateNodeData(id, { label });
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  };

  return (
    <div 
      style={{
        background: 'rgba(30, 41, 59, 0.2)',
        border: `2px dashed ${selected ? '#10b981' : '#334155'}`,
        borderRadius: '12px',
        height: '100%',
        width: '100%',
        position: 'relative',
        backdropFilter: 'blur(2px)',
      }}
    >
      <NodeResizer 
        isVisible={selected} 
        minWidth={100} 
        minHeight={100} 
        lineStyle={{ border: '1.5px solid #10b981' }}
        handleStyle={{ width: 8, height: 8, background: '#10b981', border: 'none' }}
      />

      {/* Action Buttons */}
      <div className="no-export" style={{
        position: 'absolute',
        top: '-12px',
        right: '-12px',
        display: 'flex',
        gap: '4px',
        zIndex: 10
      }}>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="Edit group name"
          style={{ 
            background: '#334155', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '10px', 
            color: 'white',
            width: '24px',
            height: '24px',
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
          title="Delete group"
          style={{ 
            background: '#f87171', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '12px', 
            color: 'white',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            opacity: 1,
            pointerEvents: 'all',
            transition: 'all 0.2s'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{
        position: 'absolute',
        top: '-24px',
        left: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {isEditing ? (
          <input 
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              background: '#1e293b', 
              color: 'white', 
              border: '1px solid #10b981', 
              borderRadius: '4px', 
              padding: '2px 6px',
              textTransform: 'uppercase',
              outline: 'none'
            }}
          />
        ) : (
          <div 
            style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              color: selected ? '#10b981' : '#64748b', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em'
            }}
          >
            📋 {label}
          </div>
        )}
      </div>
    </div>
  );
}
