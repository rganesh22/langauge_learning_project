/**
 * Web implementation: use the browser Clipboard API.
 * Used when bundling for platform=web so we never load expo-clipboard (avoids 500 on web).
 */
export async function setStringAsync(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text || '');
  } else {
    // Fallback for older browsers or non-secure context
    const textArea = document.createElement('textarea');
    textArea.value = text || '';
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
