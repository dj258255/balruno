'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '@/hooks/useTour';
import { TourStep as TourStepType } from '@/data/tourSteps';
import TourStep from './TourStep';

interface InteractiveTourProps {
  // Container ref for the spreadsheet table
  tableContainerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Main interactive tour component
 * Manages spotlight overlay and step progression
 */
export default function InteractiveTour({ tableContainerRef }: InteractiveTourProps) {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    tourSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  // Set mounted on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate target element position based on step target
  const calculateTargetRect = useCallback((step: TourStepType): DOMRect | null => {
    if (!tableContainerRef?.current || step.target.type === 'none') {
      return null;
    }

    const table = tableContainerRef.current.querySelector('table');
    if (!table) return null;

    try {
      let targetElement: Element | null = null;

      switch (step.target.type) {
        case 'cell': {
          const { rowIndex = 0, colIndex = 0 } = step.target.cellCoords || {};
          // Find cell by data attributes or position
          const rows = table.querySelectorAll('tbody tr');
          if (rows[rowIndex]) {
            const cells = rows[rowIndex].querySelectorAll('td');
            targetElement = cells[colIndex] || null;
          }
          break;
        }

        case 'column': {
          const colIndex = step.target.columnIndex || 0;
          // Find column header
          const headers = table.querySelectorAll('thead th');
          targetElement = headers[colIndex] || null;
          break;
        }

        case 'row': {
          const rowIndex = step.target.rowIndex || 0;
          const rows = table.querySelectorAll('tbody tr');
          targetElement = rows[rowIndex] || null;
          break;
        }

        case 'area': {
          const { startRow = 0, endRow = 0, startCol = 0, endCol = 0 } = step.target.area || {};
          const rows = table.querySelectorAll('tbody tr');

          if (rows[startRow] && rows[endRow]) {
            const startCells = rows[startRow].querySelectorAll('td');
            const endCells = rows[endRow].querySelectorAll('td');
            const firstCell = startCells[startCol];
            const lastCell = endCells[endCol];

            if (firstCell && lastCell) {
              const firstRect = firstCell.getBoundingClientRect();
              const lastRect = lastCell.getBoundingClientRect();

              // Create a combined rect
              return new DOMRect(
                firstRect.left,
                firstRect.top,
                lastRect.right - firstRect.left,
                lastRect.bottom - firstRect.top
              );
            }
          }
          break;
        }

        default:
          return null;
      }

      return targetElement?.getBoundingClientRect() || null;
    } catch (error) {
      console.error('Error calculating target rect:', error);
      return null;
    }
  }, [tableContainerRef]);

  // Update target rect when step changes
  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const rect = calculateTargetRect(currentStep);
      setTargetRect(rect);
    };

    // Initial calculation
    updateRect();

    // Update on scroll or resize
    const handleUpdate = () => {
      requestAnimationFrame(updateRect);
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isActive, currentStep, calculateTargetRect]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTour]);

  // Don't render if not active or not mounted
  if (!isActive || !currentStep || !mounted) {
    return null;
  }

  const isLastStep = currentStepIndex === tourSteps.length - 1;
  const canGoPrev = currentStepIndex > 0;

  // Get spotlight intensity
  const getSpotlightOpacity = () => {
    switch (currentStep.highlightIntensity) {
      case 'high':
        return 0.85;
      case 'medium':
        return 0.75;
      case 'low':
        return 0.6;
      default:
        return 0.7;
    }
  };

  const spotlightOpacity = getSpotlightOpacity();

  // Portal content
  const tourContent = (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        className="fixed inset-0 z-[1200] pointer-events-none"
        style={{
          background: targetRect
            ? `radial-gradient(
                circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
                transparent 0px,
                transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 20}px,
                rgba(0, 0, 0, ${spotlightOpacity}) ${Math.max(targetRect.width, targetRect.height) / 2 + 60}px,
                rgba(0, 0, 0, ${spotlightOpacity}) 100%
              )`
            : `rgba(0, 0, 0, ${spotlightOpacity})`,
          transition: 'background 0.3s ease-in-out',
        }}
      />

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="fixed z-[1201] pointer-events-none"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: '3px solid var(--primary-blue)',
            borderRadius: '8px',
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5)',
            transition: 'all 0.3s ease-in-out',
            animation: 'pulse-border 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Step card - positioned adaptively */}
      <div
        className="fixed z-[1202] pointer-events-auto"
        style={{
          left: '50%',
          top: targetRect
            ? targetRect.bottom + 20 < window.innerHeight - 400
              ? targetRect.bottom + 20
              : targetRect.top - 420 > 0
              ? targetRect.top - 420
              : '50%'
            : '50%',
          transform: targetRect
            ? targetRect.bottom + 20 < window.innerHeight - 400 || targetRect.top - 420 > 0
              ? 'translateX(-50%)'
              : 'translate(-50%, -50%)'
            : 'translate(-50%, -50%)',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <TourStep
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={tourSteps.length}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          canGoPrev={canGoPrev}
          isLastStep={isLastStep}
        />
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2), 0 0 30px rgba(59, 130, 246, 0.7);
          }
        }
      `}</style>
    </>
  );

  // Render as portal
  return createPortal(tourContent, document.body);
}
