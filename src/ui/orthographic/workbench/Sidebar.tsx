/**
 * [Workbench] Sidebar
 * Sliding "Gravity Glass" panel for tools.
 * Slides in from LEFT on warp complete.
 */

import React, { useState, useEffect } from 'react';
import { InputForm } from './InputForm.js';
import { LabsPanel } from '../panels/Labs.js';
import { DesignTokens } from '../../styles/DesignTokens.js';
import { useScrollVelocityContextSafe } from '../../controllers/useScrollVelocity.js';

import { dragController } from '../../controllers/DragController.js';

import { store } from '../../../kernel/registry/Store';

export function Sidebar() {
  const [isLabsOpen, setIsLabsOpen] = useState(false);
  const [isStoreDirty, setIsStoreDirty] = useState(false);
  const [tickerValue, setTickerValue] = useState('');

  // Get navigation state for slide-in animation
  const { state, groundOpacity } = useScrollVelocityContextSafe();

  // Sidebar is visible when in ground state
  const isVisible = state === 'ground' || groundOpacity > 0.5;
  const slideOffset = isVisible ? 0 : -500;

  // Sync with Store Dirty State
  useEffect(() => {
    const unsub = store.subscribeAll(() => {
      setIsStoreDirty(store.isDirty);
    });

    return () => unsub();
  }, []);

  const toggleLabs = () => setIsLabsOpen(!isLabsOpen);

  const handleDragStart = (type: 'VOL_CUBE' | 'ENTROPY') => {
    dragController.startDrag(type);
  };

  return (
    <>
      {/* Main Sidebar - Gravity Glass */}
      <div
        className="gravity-glass"
        style={{
          position: 'fixed',
          top: 'var(--safe-area, 64px)',
          left: 'var(--safe-area, 64px)',
          bottom: 'var(--safe-area, 64px)',
          width: '420px',
          zIndex: 1000,
          transform: `translateX(${slideOffset}px)`,
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          opacity: groundOpacity,
          pointerEvents: isVisible ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Content Container */}
        <div style={{ padding: 'var(--container-padding, 48px)', flex: 1, overflowY: 'auto' }}>
          {/* Header - ASSET DNA */}
          <div style={{ marginBottom: '32px' }}>
            <h2
              className="heading-uppercase"
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.3em',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '8px',
              }}
            >
              ASSET DNA
            </h2>
            <div style={{
              width: '40px',
              height: '1px',
              background: 'linear-gradient(90deg, rgba(0, 243, 255, 0.5), transparent)',
            }} />
          </div>

          {/* Ticker Input - Pill-shaped with glowing border */}
          <div style={{ marginBottom: '32px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '12px',
              }}
            >
              TICKER
            </label>
            <input
              type="text"
              value={tickerValue}
              onChange={(e) => setTickerValue(e.target.value.toUpperCase())}
              placeholder="AAPL"
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '1.25rem',
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 500,
                letterSpacing: '0.1em',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                borderRadius: '50px',
                color: '#00F3FF',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: tickerValue
                  ? '0 0 20px rgba(0, 243, 255, 0.2), inset 0 0 20px rgba(0, 243, 255, 0.05)'
                  : 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(0, 243, 255, 0.6)';
                e.target.style.boxShadow = '0 0 30px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(0, 243, 255, 0.3)';
                e.target.style.boxShadow = tickerValue
                  ? '0 0 20px rgba(0, 243, 255, 0.2), inset 0 0 20px rgba(0, 243, 255, 0.05)'
                  : 'none';
              }}
            />
          </div>

          {/* Ghosted content until valid DNA entered */}
          <div style={{
            opacity: tickerValue.length >= 1 ? 1 : 0.2,
            transition: 'opacity 0.5s ease',
            pointerEvents: tickerValue.length >= 1 ? 'auto' : 'none',
          }}>
            <InputForm />

            <button
              onClick={async () => {
                console.log('[Sidebar] Requesting Physics Freeze...');
                const pauseEvent = new CustomEvent('PHYSICS_PAUSE_REQUEST');
                window.dispatchEvent(pauseEvent);

                await new Promise(r => setTimeout(r, 50));

                if ((window as any).commitState) {
                  await (window as any).commitState();
                }

                console.log('[Sidebar] Resuming Physics...');
                const resumeEvent = new CustomEvent('PHYSICS_RESUME_REQUEST');
                window.dispatchEvent(resumeEvent);
              }}
              disabled={!isStoreDirty}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '12px',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                background: isStoreDirty ? 'rgba(255, 170, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isStoreDirty ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '8px',
                color: isStoreDirty ? '#FFAA00' : 'rgba(255, 255, 255, 0.2)',
                cursor: isStoreDirty ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
              }}
            >
              [ COMMIT STATE ]
            </button>

            {/* Draggable Widgets Section */}
            <div style={{ marginTop: '48px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
              <h3 style={{
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '16px',
              }}>
                Market Makers
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                  onMouseDown={() => handleDragStart('VOL_CUBE')}
                  style={{
                    aspectRatio: '1',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(0, 255, 200, 0.2)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.4)' }}>VOL_CUBE</span>
                </div>
                <div
                  onMouseDown={() => handleDragStart('ENTROPY')}
                  style={{
                    aspectRatio: '1',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 170, 0, 0.2)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.4)' }}>ENTROPY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Labs Panel Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100%',
        zIndex: 9005,
        transform: isLabsOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
      }}>
        {isLabsOpen && <LabsPanel onClose={() => setIsLabsOpen(false)} />}
      </div>

      <button
        onClick={toggleLabs}
        style={{
          position: 'fixed',
          bottom: 'var(--safe-area, 64px)',
          right: 'var(--safe-area, 64px)',
          background: 'none',
          border: '1px solid rgba(255, 0, 255, 0.3)',
          borderRadius: '8px',
          color: '#FF00FF',
          fontFamily: "'IBM Plex Mono', monospace",
          padding: '8px 16px',
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          zIndex: 10001,
          pointerEvents: 'auto',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        LABS
      </button>
    </>
  );
}

