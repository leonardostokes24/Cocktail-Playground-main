import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { priceService } from '../services/priceService';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function IngredientNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const typeColors: Record<string, string> = {
    spirit: '#fbbf24',
    sweetener: '#60a5fa',
    bitters: '#f87171',
    citrus: '#facc15',
    modifier: '#c084fc',
  };

  const color = typeColors[data.type] || '#94a3b8';

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
        const confirmed = window.confirm(
          `Found ${result.currency}${result.price} for ${result.volume}. \nEstimated cost: ${result.currency}${result.pricePerOz.toFixed(2)}/oz. \n\nConfirm import?`
        );
        if (confirmed) {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === id
                ? { ...node, data: { ...node.data, unitPrice: result.pricePerOz, currency: result.currency } }
                : node
            )
          );
        }
      } else {
        alert('Could not automatically determine price from this URL. Please enter it manually if available.');
      }
    } catch {
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        border: `1px solid rgba(255,255,255,0.09)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '10px',
        padding: '10px 12px 10px 12px',
        minWidth: 140,
        boxShadow: selected
          ? `0 0 0 1.5px ${color}90, -2px 0 8px rgba(255,30,80,0.3), 2px 0 8px rgba(30,120,255,0.3), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)`
          : '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10), -0.5px 0 0 rgba(255,30,80,0.06), 0.5px 0 0 rgba(30,120,255,0.06)',
        position: 'relative',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Hover-reveal action buttons */}
      <div
        className="no-export"
        style={{
          position: 'absolute',
          top: '-10px',
          right: '-6px',
          display: 'flex',
          gap: '3px',
          zIndex: 10,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: isHovered ? 'all' : 'none',
        }}
      >
        <Button
          variant="secondary"
          size="icon-xs"
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          title="Edit ingredient"
          className="rounded-full shadow-md"
        >
          ✏️
        </Button>
        <Button
          variant="destructive"
          size="icon-xs"
          onClick={(e) => { e.stopPropagation(); deleteNode(); }}
          title="Delete ingredient"
          className="rounded-full shadow-md"
        >
          ✕
        </Button>
      </div>

      {/* Type label */}
      <Badge
        variant="outline"
        className="mb-1.5 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0"
        style={{ color, borderColor: color + '60' }}
      >
        {data.type}
      </Badge>

      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isEditing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{
              width: '100%',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              background: 'rgba(51,65,85,0.6)',
              color: 'white',
              borderRadius: '4px',
              outline: 'none',
              padding: '2px 6px',
            }}
          />
        ) : (
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0' }}>
            {data.label}
          </div>
        )}
      </div>

      {/* Pricing section */}
      <div style={{
        marginTop: '8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '6px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '6px',
        padding: '5px 6px',
      }}>
        {data.unitPrice ? (
          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, textShadow: '-0.5px 0 rgba(255,30,80,0.3), 0.5px 0 rgba(30,120,255,0.3)' }}>
            {data.currency || '$'}{data.unitPrice.toFixed(2)}<span style={{ color: '#64748b', fontWeight: 500 }}>/oz</span>
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: 'rgba(100,116,139,0.6)', fontStyle: 'italic' }}>No price set</div>
        )}

        <div className="no-export" style={{ display: 'flex', justifyContent: 'flex-start', gap: '4px', marginTop: '4px' }}>
          <button
            onClick={() => {
              const link = prompt('Enter product URL to fetch price:');
              if (link) setUrl(link);
            }}
            title="Import price from URL"
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '8px',
              borderRadius: '4px',
              padding: '2px 5px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <Globe size={8} /> Import
          </button>
          {url && (
            <button
              onClick={handleImportPrice}
              disabled={isFetching}
              style={{
                background: '#059669',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '8px',
                borderRadius: '4px',
                padding: '2px 5px',
              }}
            >
              {isFetching ? '...' : 'Fetch'}
            </button>
          )}
        </div>
      </div>

      <Handle
        className="no-export"
        type="source"
        position={Position.Right}
        style={{ background: '#475569', width: '4px', height: '12px', borderRadius: '1px' }}
      />
    </div>
  );
}
