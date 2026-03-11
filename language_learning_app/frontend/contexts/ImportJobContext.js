/**
 * ImportJobContext
 *
 * Manages background import (extract) jobs. When the user starts an extract and closes
 * the modal, the job continues; a tray notification shows progress. Clicking the
 * notification reopens the import modal at the review step.
 *
 * Job shape:
 * {
 *   id: string,
 *   text: string,
 *   language: string,
 *   deckName: string,
 *   targetLangs: string[],
 *   status: 'extracting' | 'review' | 'committing' | 'done' | 'error',
 *   progress: object | null,
 *   statusMessage: string,
 *   errorMsg: string | null,
 *   extractDurationSeconds: number | null,
 *   startedAt: number,
 *   // when status === 'review' | 'done':
 *   extractedWords: array,
 *   synonymWords: array,
 *   existingWords: array,
 *   selectedWords: array (of word strings),
 *   selectedSynonyms: array,
 *   langData: object,
 *   importResult: object | null,
 * }
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const ImportJobContext = createContext(null);

export { ImportJobContext };

export function ImportJobProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef([]);
  const [modalRequest, setModalRequest] = useState(null); // { type: 'job', jobId, jobSnapshot? } | { type: 'open', language?, prefillText? } | null
  const abortControllersRef = useRef({});

  const setJobsDirect = (updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  };

  const startImport = useCallback((text, language, deckName, targetLangs) => {
    const id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id,
      text: (text || '').trim(),
      language: language || 'kannada',
      deckName: (deckName || '').trim(),
      targetLangs: Array.isArray(targetLangs) ? targetLangs : [],
      status: 'extracting',
      progress: null,
      statusMessage: 'Starting…',
      errorMsg: null,
      extractDurationSeconds: null,
      startedAt: Date.now(),
      extractedWords: [],
      synonymWords: [],
      existingWords: [],
      selectedWords: [],
      selectedSynonyms: [],
      langData: {},
      importResult: null,
    };
    setJobsDirect((prev) => [job, ...prev]);

    const controller = new AbortController();
    abortControllersRef.current[id] = controller;

    const updateJob = (patch) => {
      setJobsDirect((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
      );
    };

    (async () => {
      const startTime = Date.now();
      const inputText = job.text;
      const selectedTargetLangs = job.targetLangs.length > 0 ? job.targetLangs : null;

      try {
        const res = await fetch(`${API_BASE_URL}/api/vocab/extract-text-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: inputText,
            language: job.language,
            target_languages: selectedTargetLangs,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Server error: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalData = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'start') {
                updateJob({
                  progress: { phase: 'start', total_words: event.total_words, total_batches: event.total_batches, batch: 0 },
                  statusMessage: `Processing ${event.total_words} word${event.total_words !== 1 ? 's' : ''}…`,
                });
              } else if (event.type === 'progress') {
                updateJob({ progress: event });
                if (event.phase === 'lemmatize') {
                  updateJob({ statusMessage: `Lemmatizing batch ${event.batch}/${event.total_batches}…` });
                } else if (event.phase === 'translate') {
                  const langNames = (event.languages || []).map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
                  updateJob({ statusMessage: `Translating batch ${event.batch}/${event.total_batches} for ${langNames}…` });
                }
              } else if (event.type === 'done') {
                finalData = event;
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (_) {}
          }
        }

        if (!finalData) {
          const r2 = await fetch(`${API_BASE_URL}/api/vocab/extract-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: inputText,
              language: job.language,
              target_languages: selectedTargetLangs,
            }),
          });
          finalData = await r2.json();
        }

        const words = finalData.words || [];
        const synonyms = finalData.synonyms || [];
        const existing = finalData.existing || [];
        const newLangData = {};
        for (const [lang, info] of Object.entries(finalData.translations_by_lang || {})) {
          newLangData[lang] = {
            new_words: info.new_words || [],
            existing_words: info.existing_words || [],
            selected: (info.new_words || []).map((w) => w.word),
          };
        }

        const extractDurationSeconds = (Date.now() - startTime) / 1000;
        const debugData = {
          input_text: finalData.input_text || '',
          raw_tokens: finalData.raw_tokens || [],
          lemma_tokens: finalData.lemma_tokens || [],
          translations_by_lang: finalData.translations_by_lang || {},
        };
        updateJob({
          status: 'review',
          statusMessage: null,
          progress: null,
          extractDurationSeconds,
          extractedWords: words,
          synonymWords: synonyms,
          existingWords: existing,
          selectedWords: words.map((w) => w.word),
          selectedSynonyms: (synonyms || []).map((w) => w.word),
          langData: newLangData,
          debugData,
        });
      } catch (err) {
        if (err.name === 'AbortError') return;
        updateJob({
          status: 'error',
          errorMsg: err.message || 'Extract failed',
          progress: null,
          statusMessage: null,
        });
      } finally {
        delete abortControllersRef.current[id];
      }
    })();

    return id;
  }, []);

  const updateJob = useCallback((jobId, patch) => {
    setJobsDirect((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j))
    );
  }, []);

  const startCommit = useCallback((jobId, payload) => {
    const id = jobId;
    setJobsDirect((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: 'committing', statusMessage: 'Importing words…' }
          : j
      )
    );

    (async () => {
      const startTime = Date.now();
      try {
        const res = await fetch(`${API_BASE_URL}/api/vocab/commit-import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: payload.language,
            words: payload.words || [],
            synonyms: payload.synonyms || [],
            words_by_lang: payload.words_by_lang || {},
            deck_name: payload.deck_name?.trim() || null,
            existing_ids: payload.existing_ids?.length ? payload.existing_ids : undefined,
            existing_by_lang: payload.existing_by_lang && Object.keys(payload.existing_by_lang).length > 0 ? payload.existing_by_lang : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Import failed');
        }
        const data = await res.json();
        const duration = Math.round((Date.now() - startTime) / 100) / 10;
        if (duration != null) data.import_duration_seconds = duration;
        if (data.deck_id && data.import_duration_seconds != null) {
          fetch(`${API_BASE_URL}/api/vocab/decks/${data.deck_id}/duration?duration_seconds=${data.import_duration_seconds}`, { method: 'PATCH' }).catch(() => {});
        }
        setJobsDirect((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: 'done', statusMessage: null, importResult: data } : j))
        );
      } catch (err) {
        setJobsDirect((prev) =>
          prev.map((j) =>
            j.id === id
              ? { ...j, status: 'error', errorMsg: err.message || 'Import failed', statusMessage: null }
              : j
          )
        );
      }
    })();
  }, []);

  const getJob = useCallback(
    (jobId) => {
      const fromList = jobsRef.current.find((j) => j.id === jobId) || jobs.find((j) => j.id === jobId);
      if (fromList) return fromList;
      if (modalRequest?.type === 'job' && modalRequest.jobId === jobId && modalRequest.jobSnapshot)
        return modalRequest.jobSnapshot;
      return null;
    },
    [jobs, modalRequest]
  );

  const dismissJob = useCallback((id) => {
    if (abortControllersRef.current[id]) {
      abortControllersRef.current[id].abort();
      delete abortControllersRef.current[id];
    }
    setJobsDirect((prev) => prev.filter((j) => j.id !== id));
    setModalRequest((prev) => (prev?.type === 'job' && prev.jobId === id ? null : prev));
  }, []);

  const openModalForJob = useCallback((jobId, jobSnapshot) => {
    setModalRequest({ type: 'job', jobId, jobSnapshot: jobSnapshot || null });
  }, []);

  const openModalWithPrefill = useCallback(({ language, prefillText } = {}) => {
    setModalRequest({ type: 'open', language: language || null, prefillText: prefillText || '' });
  }, []);

  const closeModal = useCallback(() => {
    setModalRequest(null);
  }, []);

  return (
    <ImportJobContext.Provider
      value={{
        jobs,
        modalRequest,
        startImport,
        updateJob,
        startCommit,
        getJob,
        dismissJob,
        openModalForJob,
        openModalWithPrefill,
        closeModal,
      }}
    >
      {children}
    </ImportJobContext.Provider>
  );
}

export function useImportJob() {
  const ctx = useContext(ImportJobContext);
  if (!ctx) {
    throw new Error('useImportJob must be used inside ImportJobProvider');
  }
  return ctx;
}
