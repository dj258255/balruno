'use client';

import { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, ChevronDown, Heart, Swords, Shield } from 'lucide-react';
import type { UnitStats } from '@/lib/simulation/types';

interface UnitPickerProps {
  units: UnitStats[];
  onSelect: (unit: UnitStats) => void;
  color: string;
  buttonText: string;
}

export function UnitPicker({
  units,
  onSelect,
  color,
  buttonText
}: UnitPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (units.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 whitespace-nowrap"
        style={{
          background: `${color}10`,
          color: color,
          border: `1.5px solid ${color}`,
          boxShadow: `0 1px 3px ${color}20`
        }}
      >
        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 커스텀 툴팁 */}
      {showTooltip && !isOpen && (
        <div
          className="absolute right-0 bottom-full mb-1.5 px-2 py-1 rounded text-sm whitespace-nowrap z-50 pointer-events-none animate-fadeIn"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          {buttonText}
          <div
            className="absolute right-3 top-full w-0 h-0"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid var(--border-primary)'
            }}
          />
        </div>
      )}

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-lg shadow-xl overflow-hidden z-50 animate-slideDown"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)'
          }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {buttonText}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {units.map((unit, index) => (
              <button
                key={unit.id}
                onClick={() => {
                  onSelect(unit);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: `${color}20`, color: color }}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {unit.name}
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-2.5 h-2.5" style={{ color: '#e86161' }} />
                      {unit.maxHp}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Swords className="w-2.5 h-2.5" style={{ color: '#e5a440' }} />
                      {unit.atk}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" style={{ color: '#5a9cf5' }} />
                      {unit.def}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
