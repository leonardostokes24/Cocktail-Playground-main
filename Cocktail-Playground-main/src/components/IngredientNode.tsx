import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { priceService } from '../services/priceService';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateCostPerOz } from '../utils/pricing';

type PriceMode = 'display' | 'manual' | 'url';

interface FetchResult {
  price: number;
  volume: string;
  pricePerOz: number;
  currency: string;
}

export default function IngredientNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const [isHovered, setIsHovered] = useState(false);

  const [priceMode, setPriceMode] = useState<PriceMode>('display');
  const [bottlePrice, setBottlePrice] = useState('');
  const [bottleVolume, setBottleVolume] = useState('750');
  const [volumeUnit, setVolumeUnit] = useState<'ml' | 'oz'>('ml');
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchError, setFetchError] = useState('');

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

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  };

  const calculatedPerOz = (() => {
    const price = parseFloat(bottlePrice);
    const vol = parseFloat(bottleVolume);
    if (isNaN(price) || isNaN(vol) || vol <= 0 || price <= 0) return null;
    return calculateCostPerOz(price, bottleVolume + volumeUnit);
  })();

  const applyPrice = (pricePerOz: number, currency = '$') => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, unitPrice: pricePerOz, currency } }
          : node
      )
    );
  };

  const handleSaveManualPrice = () => {
    if (calculatedPerOz === null) return;
    applyPrice(calculatedPerOz);
    resetForm();
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    setFetchResult(null);
    setFetchError('');
    try {
      const result = await priceService.fetchPriceFromUrl(urlInput.trim());
      if (result) {
        setFetchResult(result);
      } else {
        setFetchError('Could not detect price — try entering it manually.');
      }
    } catch {
      setFetchError('Error fetching URL.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleApplyFetchResult = () => {
    if (!fetchResult) return;
    applyPrice(fetchResult.pricePerOz, fetchResult.currency);
    resetForm();
  };

  const resetForm = () => {
    setPriceMode('display');
    setUrlInput('');
    setFetchResult(null);
    setFetchError('');
    setBottlePrice('');
    setBottleVolume('750');
    setVolumeUnit('ml');
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.8)',
    border: '1px solid #334155',
    color: 'white',
    borderRadius: '4px',
    outline: 'none',
    fontSize: '11px',
    padding: '2px 4px',
  };

  const smallBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '9px',
    borderRadius: '4px',
    padding: '3px 6px',
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
        padding: '10px 12px',
        minWidth: 170,
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
        <Button variant="secondary" size="icon-xs" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} title="Edit ingredient" className="rounded-full shadow-md">✏️</Button>
        <Button variant="destructive" size="icon-xs" onClick={(e) => { e.stopPropagation(); deleteNode(); }} title="Delete ingredient" className="rounded-full shadow-md">✕</Button>
      </div>

      <Badge
        variant="outline"
        className="mb-1.5 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0"
        style={{ color, borderColor: color + '60' }}
      >
        {data.type}
      </Badge>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isEditing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            style={{ width: '100%', fontSize: '13px', fontWeight: 700, border: 'none', background: 'rgba(51,65,85,0.6)', color: 'white', borderRadius: '4px', outline: 'none', padding: '2px 6px' }}
          />
        ) : (
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0' }}>{data.label}</div>
        )}
      </div>

      {/* Pricing section */}
      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px' }}>

        {/* DISPLAY */}
        {priceMode === 'display' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
            <div
              className="no-export"
              onClick={() => setPriceMode('manual')}
              title="Click to set price"
              style={{ cursor: 'pointer' }}
            >
              {data.unitPrice ? (
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                  {data.currency || '$'}{data.unitPrice.toFixed(2)}<span style={{ color: '#64748b', fontWeight: 500 }}>/oz</span>
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>Set price…</span>
              )}
            </div>
            <button
              className="no-export"
              onClick={() => setPriceMode('url')}
              title="Import price from URL"
              style={{ ...smallBtnStyle, display: 'flex', alignItems: 'center', gap: '2px', fontSize: '8px' }}
            >
              <Globe size={8} /> URL
            </button>
          </div>
        )}

        {/* MANUAL ENTRY */}
        {priceMode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bottle price</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>$</span>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                placeholder="25.99"
                value={bottlePrice}
                onChange={(e) => setBottlePrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveManualPrice()}
                style={{ ...inputStyle, width: '52px', textAlign: 'right' }}
              />
              <span style={{ fontSize: '10px', color: '#64748b' }}>for</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="750"
                value={bottleVolume}
                onChange={(e) => setBottleVolume(e.target.value)}
                style={{ ...inputStyle, width: '42px', textAlign: 'right' }}
              />
              <select
                value={volumeUnit}
                onChange={(e) => setVolumeUnit(e.target.value as 'ml' | 'oz')}
                style={{ ...inputStyle, padding: '2px 2px', cursor: 'pointer' }}
              >
                <option value="ml">ml</option>
                <option value="oz">oz</option>
              </select>
            </div>

            {calculatedPerOz !== null && (
              <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                → ${calculatedPerOz.toFixed(2)}/oz
              </div>
            )}

            <div style={{ display: 'flex', gap: '3px' }}>
              <button
                onClick={handleSaveManualPrice}
                disabled={calculatedPerOz === null}
                style={{
                  background: calculatedPerOz !== null ? '#059669' : '#1e293b',
                  border: 'none',
                  color: calculatedPerOz !== null ? 'white' : '#475569',
                  cursor: calculatedPerOz !== null ? 'pointer' : 'not-allowed',
                  fontSize: '9px',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontWeight: 700,
                }}
              >
                Save
              </button>
              <button onClick={resetForm} style={smallBtnStyle}>✕</button>
            </div>
          </div>
        )}

        {/* URL IMPORT */}
        {priceMode === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {!fetchResult ? (
              <>
                <input
                  autoFocus
                  type="url"
                  placeholder="Paste product URL…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                  style={{ ...inputStyle, width: '100%', fontSize: '10px', boxSizing: 'border-box' }}
                />
                {fetchError && (
                  <div style={{ fontSize: '9px', color: '#f87171' }}>{fetchError}</div>
                )}
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button
                    onClick={handleFetchUrl}
                    disabled={isFetching || !urlInput.trim()}
                    style={{
                      background: '#0ea5e9',
                      border: 'none',
                      color: 'white',
                      cursor: isFetching || !urlInput.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '9px',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontWeight: 700,
                      opacity: isFetching || !urlInput.trim() ? 0.5 : 1,
                    }}
                  >
                    {isFetching ? 'Fetching…' : 'Fetch'}
                  </button>
                  <button onClick={resetForm} style={smallBtnStyle}>✕</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Found <span style={{ color: '#f8fafc', fontWeight: 700 }}>{fetchResult.currency}{fetchResult.price}</span> / {fetchResult.volume}
                </div>
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 800 }}>
                  → {fetchResult.currency}{fetchResult.pricePerOz.toFixed(2)}/oz
                </div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button
                    onClick={handleApplyFetchResult}
                    style={{ background: '#059669', border: 'none', color: 'white', cursor: 'pointer', fontSize: '9px', borderRadius: '4px', padding: '3px 8px', fontWeight: 700 }}
                  >
                    Apply
                  </button>
                  <button onClick={() => { setFetchResult(null); setUrlInput(''); }} style={smallBtnStyle}>Retry</button>
                  <button onClick={resetForm} style={smallBtnStyle}>✕</button>
                </div>
              </>
            )}
          </div>
        )}
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
