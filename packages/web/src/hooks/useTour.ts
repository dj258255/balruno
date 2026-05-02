import { useState, useCallback, useEffect } from 'react';
import { ProjectTour, TourStep, getTourByProjectId } from '@/data/tourSteps';

export interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  projectId: string | null;
  tourSteps: TourStep[];
}

const TOUR_STORAGE_KEY = 'balruno_completed_tours';

/**
 * Hook for managing interactive tour state
 * Handles tour progression, completion tracking, and localStorage persistence
 */
export function useTour() {
  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    currentStepIndex: 0,
    projectId: null,
    tourSteps: [],
  });

  // Get completed tours from localStorage
  const getCompletedTours = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(TOUR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load completed tours:', error);
      return [];
    }
  }, []);

  // Check if a tour has been completed
  const isTourCompleted = useCallback((projectId: string): boolean => {
    const completed = getCompletedTours();
    return completed.includes(projectId);
  }, [getCompletedTours]);

  // Mark a tour as completed
  const markTourCompleted = useCallback((projectId: string) => {
    try {
      const completed = getCompletedTours();
      if (!completed.includes(projectId)) {
        const updated = [...completed, projectId];
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Failed to save tour completion:', error);
    }
  }, [getCompletedTours]);

  // Start a tour (accepts either ProjectTour object or projectId string)
  const startTour = useCallback((tourOrId: ProjectTour | string, force: boolean = false) => {
    // Resolve tour from ID if string was passed
    const tour = typeof tourOrId === 'string'
      ? getTourByProjectId(tourOrId)
      : tourOrId;

    if (!tour) {
      console.warn(`No tour found for project: ${tourOrId}`);
      return false;
    }

    // Don't start if already completed (unless forced)
    if (!force && isTourCompleted(tour.projectId)) {
      return false;
    }

    setTourState({
      isActive: true,
      currentStepIndex: 0,
      projectId: tour.projectId,
      tourSteps: tour.steps,
    });

    return true;
  }, [isTourCompleted]);

  // End the tour
  const endTour = useCallback((markComplete: boolean = true) => {
    if (markComplete && tourState.projectId) {
      markTourCompleted(tourState.projectId);
    }

    setTourState({
      isActive: false,
      currentStepIndex: 0,
      projectId: null,
      tourSteps: [],
    });
  }, [tourState.projectId, markTourCompleted]);

  // Skip the tour (mark as completed)
  const skipTour = useCallback(() => {
    endTour(true);
  }, [endTour]);

  // Go to next step
  const nextStep = useCallback(() => {
    if (tourState.currentStepIndex < tourState.tourSteps.length - 1) {
      setTourState((prev) => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex + 1,
      }));
      return true;
    } else {
      // Last step - complete the tour
      endTour(true);
      return false;
    }
  }, [tourState.currentStepIndex, tourState.tourSteps.length, endTour]);

  // Go to previous step
  const prevStep = useCallback(() => {
    if (tourState.currentStepIndex > 0) {
      setTourState((prev) => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex - 1,
      }));
      return true;
    }
    return false;
  }, [tourState.currentStepIndex]);

  // Jump to a specific step
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tourState.tourSteps.length) {
      setTourState((prev) => ({
        ...prev,
        currentStepIndex: stepIndex,
      }));
      return true;
    }
    return false;
  }, [tourState.tourSteps.length]);

  // Reset a specific tour (for testing/debugging)
  const resetTour = useCallback((projectId: string) => {
    try {
      const completed = getCompletedTours();
      const updated = completed.filter((id) => id !== projectId);
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to reset tour:', error);
    }
  }, [getCompletedTours]);

  // Reset all tours
  const resetAllTours = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset all tours:', error);
    }
  }, []);

  // Get current step
  const currentStep = tourState.tourSteps[tourState.currentStepIndex] || null;

  // Calculate progress
  const progress = tourState.tourSteps.length > 0
    ? ((tourState.currentStepIndex + 1) / tourState.tourSteps.length) * 100
    : 0;

  return {
    // State
    isActive: tourState.isActive,
    currentStepIndex: tourState.currentStepIndex,
    currentStep,
    tourSteps: tourState.tourSteps,
    projectId: tourState.projectId,
    progress,

    // Actions
    startTour,
    endTour,
    skipTour,
    nextStep,
    prevStep,
    goToStep,

    // Utilities
    isTourCompleted,
    resetTour,
    resetAllTours,
  };
}
