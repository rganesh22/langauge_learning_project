import { API_BASE_URL } from '../constants';

/**
 * Helper: ensure transliteration map values are strings to avoid rendering objects
 */
export const coerceTranslitMapToStrings = (map) => {
  const out = {};
  if (!map) return out;
  Object.keys(map).forEach(k => {
    const v = map[k];
    if (v === null || v === undefined) {
      out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.filter(Boolean).join('\n');
    } else if (typeof v === 'object') {
      try {
        // prefer joining object values when possible
        const vals = Object.values(v).filter(Boolean).map(x => (typeof x === 'string' ? x : JSON.stringify(x)));
        out[k] = vals.length > 0 ? vals.join(' ') : JSON.stringify(v);
      } catch (e) {
        out[k] = JSON.stringify(v);
      }
    } else {
      out[k] = String(v);
    }
  });
  return out;
};

/**
 * Normalize text-like values into displayable strings to avoid '[object Object]' in UI
 */
export const normalizeText = (v, debug = false) => {
  if (v === null || typeof v === 'undefined') return '';
  if (typeof v === 'string') return v;
  const originalType = typeof v;
  let out = '';
  
  if (typeof v === 'number' || typeof v === 'boolean') {
    out = String(v);
  } else if (Array.isArray(v)) {
    // Flatten array elements recursively and join by newline for paragraphs
    out = v.map(item => normalizeText(item, false)).filter(Boolean).join('\n');
  } else if (typeof v === 'object') {
    // Prefer common fields
    for (const key of ['text', 'content', 'value', 'label']) {
      if (v[key] && (typeof v[key] === 'string' || typeof v[key] === 'number')) {
        out = String(v[key]);
        break;
      }
    }
    // If object has a 'parts' or 'paragraphs' array, join them
    if (!out && Array.isArray(v.parts)) out = normalizeText(v.parts, false);
    if (!out && Array.isArray(v.paragraphs)) out = normalizeText(v.paragraphs, false);
    if (!out) {
      try {
        out = JSON.stringify(v);
      } catch (e) {
        out = String(v);
      }
    }
  } else {
    out = String(v);
  }

  if (debug && originalType !== 'string') {
    try {
      const preview = typeof out === 'string' && out.length > 200 ? out.substring(0, 200) + '...(truncated)' : out;
      console.warn('[normalizeText] coerced', { originalType, preview });
    } catch (e) {
      console.warn('[normalizeText] coerced non-string value (unable to preview)');
    }
  }

  return out;
};

/**
 * Helper that normalizes a value and logs the field key when debug is enabled
 */
export const normalizeField = (key, v, context = {}, debug = false) => {
  const res = normalizeText(v, false);
  
  // Only warn when value is present but not a string; skip undefined/null which are expected
  if (debug && v !== null && typeof v !== 'undefined' && typeof v !== 'string') {
    try {
      const preview = typeof res === 'string' && res.length > 200 ? res.substring(0, 200) + '...(truncated)' : res;
      console.warn('[normalizeField]', { key, originalType: typeof v, preview, ...context });
    } catch (e) {
      console.warn('[normalizeField] key=', key, 'coerced non-string value');
    }
  }
  
  return res;
};

/**
 * Sanitize activity object to ensure all text fields are strings
 */
export const sanitizeActivity = (act, debug = false) => {
  if (!act || typeof act !== 'object') return act;
  const a = { ...act };
  
  // Normalize common fields
  ['story', 'story_name', 'passage', 'passage_name', 'activity_name', 'topic', 'hint'].forEach(k => {
    if (a[k]) a[k] = normalizeField(k, a[k], {}, debug);
  });
  
  // Questions
  if (a.questions && Array.isArray(a.questions)) {
    a.questions = a.questions.map((q, qi) => ({
      ...q,
      question: normalizeField(`question_${qi}`, q.question, {}, debug),
      options: Array.isArray(q.options) 
        ? q.options.map((o, oi) => normalizeField(`option_${qi}_${oi}`, o, {}, debug)) 
        : q.options,
    }));
  }
  
  // Required words
  if (a.required_words && Array.isArray(a.required_words)) {
    a.required_words = a.required_words.map((w, wi) => normalizeField(`required_word_${wi}`, w, {}, debug));
  }
  
  return a;
};

/**
 * Transliterate text using the backend API
 */
export const transliterateText = async (text, language, toScript = 'IAST') => {
  // Normalize non-string inputs
  text = normalizeText(text);
  if (!text || typeof text !== 'string' || !text.trim()) return '';
  if (!language || typeof language !== 'string') {
    console.warn('Transliteration skipped: invalid language', language);
    return '';
  }
  
  try {
    // Guess source script to help backend choose correct aksharamukha mapping
    let from_script = null;
    try {
      if (/[\u0900-\u097F]/.test(text)) from_script = 'Devanagari';
      else if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) from_script = 'Urdu';
    } catch (e) {}

    const response = await fetch(`${API_BASE_URL}/api/transliterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), language, to_script: toScript, from_script }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Transliteration failed (${response.status}):`, errorText);
      return '';
    }
    
    const data = await response.json();
    return data.transliteration || '';
  } catch (error) {
    console.error('Transliteration error:', error);
    return '';
  }
};
