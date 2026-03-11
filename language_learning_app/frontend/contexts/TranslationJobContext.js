/**
 * TranslationJobContext
 *
 * Manages background translation jobs and the global translate modal.
 * When the user starts a translation, it runs in the background; a tray
 * notification (top-right) shows progress. Clicking the notification opens
 * the translate modal with that job's data. Completed translations are
 * saved to translation history.
 *
 * Job shape:
 * {
 *   id: string,
 *   sourceText: string,
 *   sourceLanguage: string,
 *   targetLanguages: string[],
 *   contextLanguage: string,  // app language when started (for modal UI)
 *   status: 'translating' | 'done' | 'error',
 *   results: object | null,
 *   errorMsg: string | null,
 *   statusMessage: string | null,
 *   progress: { current, total, currentLangName } | null,
 *   durationSeconds: number | null,
 *   startedAt: number,
 * }
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const TranslationJobContext = createContext(null);

export { TranslationJobContext };
export function TranslationJobProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef([]);

  // modalRequest: { type: 'job', jobId } | { type: 'prefill', prefillText?, language? } | null
  const [modalRequest, setModalRequest] = useState(null);

  const _setJobs = (updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  };

  const saveToHistory = useCallback(async (text, srcLang, targets, results, durationSeconds) => {
    try {
      await fetch(`${API_BASE_URL}/api/translation-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: text,
          source_language: srcLang,
          target_languages: targets,
          results,
          duration_seconds: durationSeconds != null ? Math.round(durationSeconds * 10) / 10 : null,
        }),
      });
    } catch (_) {}
  }, []);

  /** Start a translation in the background. Returns jobId immediately. */
  const startTranslation = useCallback((text, sourceLanguage, targetLanguages, contextLanguage) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id,
      sourceText: text,
      sourceLanguage,
      targetLanguages: targetLanguages && targetLanguages.length > 0 ? targetLanguages : ['english'],
      contextLanguage: contextLanguage || 'kannada',
      status: 'translating',
      results: null,
      errorMsg: null,
      statusMessage: 'Starting…',
      progress: { current: 0, total: targetLanguages?.length || 1, currentLangName: '' },
      durationSeconds: null,
      startedAt: Date.now(),
    };
    _setJobs((prev) => [job, ...prev]);

    const updateProgress = (msg, current, total, currentLangName) => {
      _setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? {
                ...j,
                statusMessage: msg,
                progress: { current, total, currentLangName },
              }
            : j
        )
      );
    };

    (async () => {
      const startTime = Date.now();
      const targets = job.targetLanguages;
      const results = {};
      let detectedSourceCode = job.sourceLanguage || null;
      let detectedSourceName = null;
      const { LANGUAGES } = require('../contexts/LanguageContext');

      for (let i = 0; i < targets.length; i++) {
        const code = targets[i];
        const meta = LANGUAGES.find((l) => l.code === code);
        const langName = meta?.name || code;
        updateProgress(`Translating to ${langName} (${i + 1}/${targets.length})…`, i, targets.length, langName);

        try {
          const body = {
            text: job.sourceText,
            target_language: code,
          };
          if (detectedSourceCode) body.source_language = detectedSourceCode;

          const res = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error (${res.status})`);
          }
          const data = await res.json();
          results[code] = data;
          if (detectedSourceCode == null && data.detected_source_language_code) {
            detectedSourceCode = data.detected_source_language_code;
            detectedSourceName = data.detected_source_language_name || null;
          }
        } catch (e) {
          _setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: 'error', errorMsg: e.message || 'Translation failed' } : j
            )
          );
          return;
        }
      }

      const finalSource = detectedSourceCode || job.sourceLanguage || 'english';
      const durationSeconds = (Date.now() - startTime) / 1000;
      await saveToHistory(job.sourceText, finalSource, targets, results, durationSeconds);
      _setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? {
                ...j,
                status: 'done',
                results,
                sourceLanguage: finalSource,
                sourceLanguageName: detectedSourceName,
                durationSeconds: (Date.now() - startTime) / 1000,
                statusMessage: null,
                progress: null,
              }
            : j
        )
      );
    })();

    return id;
  }, [saveToHistory]);

  const dismissJob = useCallback((id) => {
    _setJobs((prev) => prev.filter((j) => j.id !== id));
    setModalRequest((prev) => (prev?.type === 'job' && prev.jobId === id ? null : prev));
  }, []);

  const openModalForJob = useCallback((jobId) => {
    setModalRequest({ type: 'job', jobId });
  }, []);

  /** Open the global translate modal with optional prefill. Pass onMakeVocabCards to handle "Make Cards" from the modal. */
  const openModalWithPrefill = useCallback(({ prefillText, language, onMakeVocabCards } = {}) => {
    setModalRequest({ type: 'prefill', prefillText: prefillText || '', language: language || null, onMakeVocabCards });
  }, []);

  const closeModal = useCallback(() => {
    setModalRequest(null);
  }, []);

  return (
    <TranslationJobContext.Provider
      value={{
        jobs,
        modalRequest,
        startTranslation,
        dismissJob,
        openModalForJob,
        openModalWithPrefill,
        closeModal,
      }}
    >
      {children}
    </TranslationJobContext.Provider>
  );
}

export function useTranslationJob() {
  const ctx = useContext(TranslationJobContext);
  if (!ctx) {
    throw new Error('useTranslationJob must be used inside TranslationJobProvider');
  }
  return ctx;
}
