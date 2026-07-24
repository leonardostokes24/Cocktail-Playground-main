import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RadialContext } from './RadialMenu';
import { useProofStore } from '../../store/useProofStore';

interface Props {
  context: RadialContext;
  onClose: () => void;
  onSwitchToRadial: () => void;
  firstRun: boolean;
  onDismissFirstRun: () => void;
}

type Phase = 'main' | 'confirm-delete';

export default function ContextMenuFallback({
  context, onClose, onSwitchToRadial, firstRun, onDismissFirstRun,
}: Props) {
  const [phase, setPhase] = useState<Phase>('main');
  const menuRef = useRef<HTMLDivElement>(null);

  const { position } = context;
  const nodeId = context.kind === 'node' ? context.nodeId : null;

  const specs      = useProofStore(s => s.specs);
  const createSpec = useProofStore(s => s.createSpec);
  const branchSpec = useProofStore(s => s.branchSpec);
  const selectSpec = useProofStore(s => s.selectSpec);
  const removeSpec = useProofStore(s => s.removeSpec);

  useEffect(() => { menuRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'confirm-delete') setPhase('main');
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const handleNewSpec = useCallback(async () => {
    const x = specs.length ? Math.max(...specs.map(s => s.canvas_x)) + 280 : 100;
    await createSpec({ name: 'New Spec', canvas_x: x, canvas_y: 200 });
    onClose();
  }, [specs, createSpec, onClose]);

  const handleBranch = useCallback(async () => {
    if (!nodeId) return;
    await branchSpec(nodeId);
    onClose();
  }, [nodeId, branchSpec, onClose]);

  const handleOpen = useCallback(() => {
    if (!nodeId) return;
    selectSpec(nodeId);
    onClose();
  }, [nodeId, selectSpec, onClose]);

  const handleAddIngredient = useCallback(() => {
    if (!nodeId) return;
    selectSpec(nodeId);
    onClose();
  }, [nodeId, selectSpec, onClose]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!nodeId) return;
    await removeSpec(nodeId);
    onClose();
  }, [nodeId, removeSpec, onClose]);

  const handleSwitchToRadial = useCallback(() => {
    onDismissFirstRun();
    onSwitchToRadial();
  }, [onDismissFirstRun, onSwitchToRadial]);

  return (
    <>
      <div
        style={backdrop}
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        tabIndex={-1}
        style={{ ...menuStyle, left: position.x + 4, top: position.y + 4 }}
        onClick={e => e.stopPropagation()}
      >
        {context.kind === 'canvas' ? (
          <>
            <Item icon="✦" label="New Spec" onClick={handleNewSpec} />
            <Item icon="⌕" label="Search Commons" disabled />
            <Item icon="⇩" label="Quick Ingest" disabled />
            <Item icon="⚗" label="New Prep" disabled />
          </>
        ) : phase === 'confirm-delete' ? (
          <>
            <div style={confirmHeader}>Delete this spec?</div>
            <Item icon="✕" label="Confirm Delete" onClick={handleDeleteConfirm} danger />
            <Item icon="←" label="Cancel" onClick={() => setPhase('main')} />
          </>
        ) : (
          <>
            <Item icon="⎇" label="Branch" onClick={handleBranch} />
            <Item icon="+" label="Add Ingredient" onClick={handleAddIngredient} />
            <Item icon="→" label="Open Spec" onClick={handleOpen} />
            <div style={divider} />
            <Item icon="✕" label="Delete" onClick={() => setPhase('confirm-delete')} danger />
          </>
        )}

        <div style={footer}>
          {firstRun && (
            <span style={tip}>✦ Right-click opens the radial menu</span>
          )}
          <button style={switchBtn} onClick={handleSwitchToRadial}>
            {firstRun ? 'Try radial →' : 'Radial menu ↑'}
          </button>
        </div>
      </div>
    </>
  );
}

interface ItemProps {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function Item({ icon, label, onClick, disabled, danger }: ItemProps) {
  return (
    <button
      style={{
        ...itemStyle,
        ...(disabled ? itemDisabled : {}),
        ...(danger && !disabled ? itemDanger : {}),
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span style={itemIcon}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {disabled && <span style={comingSoon}>soon</span>}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2000,
};

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 2001,
  minWidth: 192,
  background: 'linear-gradient(168deg, rgba(18,22,40,0.97), rgba(12,15,28,0.98))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow:
    'inset 1px 0 0 rgba(120,225,255,.28), inset -1px 0 0 rgba(255,135,210,.22), inset 0 1px 0 rgba(255,255,255,.18), 0 16px 48px rgba(0,0,0,.7)',
  borderRadius: 10,
  padding: '4px 0',
  outline: 'none',
  animation: 'radialAppear 0.14s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '8px 14px',
  background: 'transparent', border: 'none',
  color: 'var(--ink)', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 500,
  cursor: 'pointer', textAlign: 'left',
  transition: 'background 0.1s, color 0.1s',
};

const itemIcon: React.CSSProperties = {
  width: 18, textAlign: 'center',
  fontSize: 14, color: 'var(--mute)',
  flexShrink: 0,
};

const itemDisabled: React.CSSProperties = {
  opacity: 0.38, cursor: 'default',
};

const itemDanger: React.CSSProperties = {
  color: '#f87171',
};

const comingSoon: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
  color: 'var(--mute)', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3,
  padding: '1px 5px', textTransform: 'uppercase',
};

const confirmHeader: React.CSSProperties = {
  padding: '6px 14px 4px',
  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)',
  color: '#f87171', letterSpacing: '0.04em', textTransform: 'uppercase',
};

const divider: React.CSSProperties = {
  height: 1, margin: '3px 10px',
  background: 'rgba(255,255,255,0.08)',
};

const footer: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '6px 12px 4px',
  borderTop: '1px solid rgba(255,255,255,0.07)',
  gap: 8,
};

const tip: React.CSSProperties = {
  fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-ui)',
  flex: 1,
};

const switchBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)',
  color: 'var(--cyan)', background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '2px 0', letterSpacing: '0.02em',
  flexShrink: 0,
};
