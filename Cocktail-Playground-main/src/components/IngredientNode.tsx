import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { priceService } from '../services/priceService';
import { Save, Globe } from 'lucide-react';

export default function IngredientNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const typeColors: Record<string, string> = {
    spirit: '#fbbf24',    // amber-400
    sweetener: '#60a5fa', // blue-400
    bitters: '#f87171',   // red-400
    citrus: '#facc15',   // yellow-400
    modifier: '#c084fc'  // purple-400
  };

  const handleSave = () => {
    setIsEditing(false);
    setNodes((nds) => 
      nds.map((node) => 
        node.id === id ? { ...node, data: { ...node.data, label: name } } : node
      )
    );
  };

  const handleImportPrice = async () => {
    if (!url) return;
    setIsFetching(true);
    try {
      const result = await priceService.fetchPriceFromUrl(url);
      if (result) {
        const confirmed = window.confirm(`Found ${result.currency}${result.price} for ${result.volume}. \nEstimated cost: ${result.currency}${result.pricePerOz.toFixed(2)}/oz. \n\nConfirm import?`);
        if (confirmed) {
          setNodes((nds) => 
            nds.map((node) => 
              node.id === id ? { ...node, data: { ...node.data, unitPrice: result.pricePerOz, currency: result.currency } } : node
            )
          );
        }
      } else {
        alert('Could not automatically determine price from this URL. Please enter it manually if available.');
      }
    } catch (error) {
      alert('Error fetching price from URL.');
    } finally {
      setIsFetching(false);
      setUrl('');
    }
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
      <div className="no-export" style={{
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

      {/* Pricing Section */}
      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(51, 65, 85, 0.5)', paddingTop: '6px' }}>
        {data.unitPrice ? (
          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
            {data.currency || '$'}{data.unitPrice.toFixed(2)}/oz
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>No price set</div>
        )}
        
        <div className="no-export" style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
          <button 
            onClick={() => {
              const link = prompt('Enter product URL to fetch price:');
              if (link) setUrl(link);
            }}
            title="Import price from URL"
            style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: '8px', borderRadius: '4px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            <Globe size={8} /> Import
          </button>
          {url && (
            <button 
              onClick={handleImportPrice}
              disabled={isFetching}
              style={{ background: '#059669', border: 'none', color: 'white', cursor: 'pointer', fontSize: '8px', borderRadius: '4px', padding: '2px 4px' }}
            >
              {isFetching ? '...' : 'Fetch'}
            </button>
          )}
        </div>
      </div>

      <Handle className="no-export" type="source" position={Position.Right} style={{ background: '#475569', width: '4px', height: '12px', borderRadius: '1px' }} />
    </div>
  );
}

