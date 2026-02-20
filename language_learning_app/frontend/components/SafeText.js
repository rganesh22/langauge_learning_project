import React, { useContext } from 'react';
import { Text, StyleSheet } from 'react-native';
import { LanguageContext } from '../contexts/LanguageContext';

// When SAFE_TEXT_DEBUG=true in the environment, SafeText will console.warn
// whenever a non-string child is coerced. This helps capture RN Web "Unexpected text node" cases at runtime.
const DEBUG = typeof process !== 'undefined' && process?.env?.SAFE_TEXT_DEBUG === 'true';

export default function SafeText({ children, ...props }) {
  // If children contain React elements, render them directly.
  // Otherwise coerce to a single string to avoid React Native Web "Unexpected text node" errors.
  const isReactElement = (c) => React.isValidElement(c);

  const extractText = (c) => {
    if (c === null || c === undefined) return '';
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(extractText).join('');
    if (React.isValidElement(c)) return extractText(c.props.children);
    try { return String(c); } catch (e) { return ''; }
  };

  let renderChildren = children;
  let text = '';
  const childrenArray = Array.isArray(children) ? children : [children];
  const hasElementChild = childrenArray.some(c => isReactElement(c));
  if (hasElementChild) {
    // Render elements as-is; but still compute text for font/Arabic detection
    text = extractText(children);
    renderChildren = children;
    if (DEBUG) {
      // Warn if other non-string leaf nodes are present
      const nonStrings = childrenArray.filter(c => typeof c !== 'string' && c !== null && c !== undefined && !isReactElement(c));
      if (nonStrings.length > 0) console.warn('SafeText mixed children, rendering elements and coercing non-strings:', nonStrings);
    }
  } else {
    // No element children: safe to coerce everything to string
    text = extractText(children);
    renderChildren = text;
  }

  // Convert common escaped sequences (e.g., "\\n") into real characters so
  // literal backslash sequences received from APIs render correctly as newlines/tabs.
  const unescapeString = (s) => {
    if (!s || typeof s !== 'string') return s;
    // Replace escaped backslash first
    let out = s.replace(/\\\\/g, '\\');
    out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    return out;
  };

  // Apply unescaping to both the extracted text and the renderChildren when it's a string
  text = unescapeString(text);
  if (typeof renderChildren === 'string') renderChildren = unescapeString(renderChildren);
  // Merge/override style to apply Urdu Nastaliq font when Arabic/Urdu script is detected
  const { selectedLanguage } = useContext(LanguageContext);
  // Flatten the incoming style (handles arrays and registered styles) so we
  // merge a plain object and avoid numeric keys like '0' which break RN Web.
  const incomingStyleRaw = props.style;
  const incomingStyle = StyleSheet.flatten(incomingStyleRaw) || {};
  let appliedStyle = incomingStyle;

  // If the caller did not already set a fontFamily and the selected language is Urdu,
  // apply the matching Noto Nastaliq Urdu font weight family (if available).
  // Helper: detect Arabic/Urdu script characters in the text so we only apply
  // the Nastaliq font to strings that actually contain Urdu script. This avoids
  // changing English/Latin text to a Nastaliq serif font.
  const isArabicScript = (str) => {
    if (!str) return false;
    // Unicode blocks: Arabic, Arabic Supplement, Arabic Extended-A, Presentation Forms
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
  };

  // Apply the Nastaliq font only when the text contains Arabic/Urdu script.
  // Do not override if the caller already provided a fontFamily. This
  // prevents switching the entire UI to Nastaliq when the user selects the
  // Urdu language; only actual Urdu-script substrings will use the font.
  if (!(incomingStyle && incomingStyle.fontFamily) && isArabicScript(text)) {
    // Determine requested weight from style or props
  const weight = (incomingStyle && incomingStyle.fontWeight) || props.fontWeight || '400';
    let family = 'Noto Nastaliq Urdu';
    if (weight === '700' || String(weight).toLowerCase() === 'bold') {
      family = 'Noto Nastaliq Urdu-Bold';
    } else if (weight === '600' || String(weight).toLowerCase() === 'semibold' || String(weight).toLowerCase() === '600') {
      family = 'Noto Nastaliq Urdu-SemiBold';
    } else if (weight === '500' || String(weight).toLowerCase() === 'medium') {
      family = 'Noto Nastaliq Urdu-Medium';
    } else {
      family = 'Noto Nastaliq Urdu';
    }
    appliedStyle = { ...incomingStyle, fontFamily: family, textAlign: incomingStyle.textAlign || 'left' };
  }

  return <Text {...props} style={appliedStyle}>{renderChildren}</Text>;
}
