/**
 * ActivityGenerationContext
 *
 * Manages the list of in-progress and recently-completed activity
 * generation jobs so any screen can kick off a generation and the
 * floating tray (ActivityGenerationTray) can display their status
 * app-wide.
 *
 * Each job has the shape:
 * {
 *   id:           string   (uuid-lite: Date.now() + random)
 *   activityType: string   ('reading' | 'listening' | 'writing' | 'speaking' | 'translation')
 *   language:     string   (language code, e.g. 'kannada')
 *   status:       'generating' | 'done' | 'error'
 *   title:        string   (activity title once done, else null)
 *   activityId:   string | null
 *   activityData: object | null
 *   errorMsg:     string | null
 *   statusMessage: string | null  (e.g. "Generating audio: 2 of 5...")
 *   startedAt:    number   (Date.now())
 * }
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ActivityGenerationContext = createContext(null);

export function ActivityGenerationProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef([]);

  const _setJobs = (updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  };

  /** Create a new job and return its id */
  const createJob = useCallback((activityType, language) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id,
      activityType,
      language,
      status: 'generating',
      title: null,
      activityId: null,
      activityData: null,
      errorMsg: null,
      statusMessage: null,
      startedAt: Date.now(),
    };
    _setJobs((prev) => [job, ...prev]);
    return id;
  }, []);

  /** Update status message for a job (e.g. "Generating audio: 2 of 5...") */
  const updateJobStatus = useCallback((id, statusMessage) => {
    _setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, statusMessage: statusMessage ?? null } : j)),
    );
  }, []);

  /** Mark a job as successfully completed */
  const completeJob = useCallback((id, { title, activityId, activityData }) => {
    _setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: 'done', title: title || null, activityId: activityId || null, activityData: activityData || null }
          : j,
      ),
    );
  }, []);

  /** Mark a job as failed */
  const failJob = useCallback((id, errorMsg) => {
    _setJobs((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, status: 'error', errorMsg: errorMsg || 'Unknown error' } : j,
      ),
    );
  }, []);

  /** Remove a job from the tray (user pressed ×) */
  const dismissJob = useCallback((id) => {
    _setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return (
    <ActivityGenerationContext.Provider
      value={{ jobs, createJob, completeJob, failJob, dismissJob, updateJobStatus }}
    >
      {children}
    </ActivityGenerationContext.Provider>
  );
}

export function useActivityGeneration() {
  const ctx = useContext(ActivityGenerationContext);
  if (!ctx) {
    throw new Error('useActivityGeneration must be used inside ActivityGenerationProvider');
  }
  return ctx;
}
