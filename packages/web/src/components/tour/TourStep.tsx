'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  MousePointer2,
  Edit3,
  Eye,
  ChevronRight,
  ChevronLeft,
  X,
  Lightbulb
} from 'lucide-react';
import { TourStep as TourStepType } from '@/data/tourSteps';

interface TourStepProps {
  step: TourStepType;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  canGoPrev: boolean;
  isLastStep: boolean;
}

/**
 * Individual tour step component
 * Displays step content, action icons, and navigation controls
 */
export default function TourStep({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  canGoPrev,
  isLastStep,
}: TourStepProps) {
  const t = useTranslations();

  // Get action icon based on step action
  const getActionIcon = () => {
    switch (step.action) {
      case 'click':
        return <MousePointer2 className="w-5 h-5" style={{ color: 'var(--primary-blue)' }} />;
      case 'edit':
        return <Edit3 className="w-5 h-5" style={{ color: 'var(--success)' }} />;
      case 'observe':
        return <Eye className="w-5 h-5" style={{ color: 'var(--warning)' }} />;
      default:
        return <Lightbulb className="w-5 h-5" style={{ color: 'var(--primary-purple)' }} />;
    }
  };

  // Get action text color
  const getActionColor = () => {
    switch (step.action) {
      case 'click':
        return 'var(--primary-blue)';
      case 'edit':
        return 'var(--success)';
      case 'observe':
        return 'var(--warning)';
      default:
        return 'var(--primary-purple)';
    }
  };

  return (
    <div
      className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Progress bar */}
      <div className="h-1" style={{ background: 'var(--bg-tertiary)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${((stepIndex + 1) / totalSteps) * 100}%`,
            background: 'var(--primary-blue)',
          }}
        />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('tour.step')} {stepIndex + 1} / {totalSteps}
          </span>
        </div>
        <button
          onClick={onSkip}
          className="text-sm transition-colors px-2 py-1 rounded-lg hover:bg-opacity-10"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex-1">
        {/* Action indicator */}
        {step.action && (
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-sm font-medium"
            style={{ background: `${getActionColor()}20`, color: getActionColor() }}
          >
            {getActionIcon()}
            <span>{t(`tour.action.${step.action}`)}</span>
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t(step.titleKey)}
        </h2>

        {/* Description */}
        <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t(step.descriptionKey)}
        </p>
      </div>

      {/* Footer with navigation */}
      <div
        className="px-6 py-4 border-t flex items-center justify-between"
        style={{
          background: 'var(--bg-tertiary)',
          borderColor: 'var(--border-primary)'
        }}
      >
        <div>
          {canGoPrev && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronLeft className="w-4 h-4" />
              {t('tour.previous')}
            </button>
          )}
        </div>

        <button
          onClick={onNext}
          className="flex items-center gap-1 px-5 py-2 rounded-lg transition-opacity text-sm font-medium"
          style={{ background: 'var(--primary-blue)', color: 'white' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {isLastStep ? t('tour.finish') : t('tour.next')}
          {!isLastStep && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
