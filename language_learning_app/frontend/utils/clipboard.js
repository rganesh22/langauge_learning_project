/**
 * Native (iOS/Android) implementation: re-export from expo-clipboard.
 * For web, Metro resolves utils/clipboard.web.js instead.
 */
export { setStringAsync } from 'expo-clipboard';
