/**
 * itemStyles.js
 *
 * Shared StyleSheet for rendering activity items (passages, MCQs,
 * transcripts, free-response, speaking prompts, etc.).
 * Used by both PlacementTestScreen and UnifiedActivityRenderer.
 */
import { StyleSheet } from 'react-native';

const itemStyles = StyleSheet.create({
  // ── Passage ──
  passageCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  passageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  passageHeaderText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  /** Transliteration under the passage title (inside the colored header) — white to match title */
  transliterationTextInHeader: {
    fontSize: 13,
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 0,
  },
  passageText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1F2937',
    padding: 14,
  },
  /** Same as passageText but no padding — for paragraph-by-paragraph body inside padded container */
  passageParagraph: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1F2937',
  },

  // ── Transcript / Audio ──
  audioPlayerCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  audioPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  speakerLegend: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    flexWrap: 'wrap',
  },
  speakerLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speakerLegendName: {
    fontSize: 13,
    fontWeight: '600',
  },
  speakerLabel: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 14,
    paddingTop: 8,
    fontStyle: 'italic',
  },
  audioControls: {
    padding: 16,
    alignItems: 'center',
  },
  audioPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  audioPlayBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  audioLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  audioErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioErrorText: {
    fontSize: 14,
    color: '#EF4444',
    flex: 1,
  },
  audioRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  audioRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  audioUnavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioUnavailableText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // ── Dialogue bubbles ──
  dialoguePreview: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  dialogueLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '85%',
  },
  dialogueLineRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  dialogueBubble: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dialogueBubbleRight: {
    borderBottomRightRadius: 4,
  },
  dialogueBubbleText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },

  // ── MCQ / Options ──
  questionItem: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 20,
  },
  questionEnText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFF',
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  optionNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },

  // ── Translation source ──
  translationSourceBox: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  translationSourceText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 36,
  },

  // ── Free response / text input ──
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFF',
    minHeight: 120,
    marginTop: 8,
  },
  wordHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },

  // ── Speaking / recording ──
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  recordBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  audioRecordedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  audioRecordedText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  audioRecordedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  audioRecordedBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Transliteration overlay ──
  textWithTransliteration: {
    marginBottom: 2,
  },
  transliterationText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 4,
  },
  /** Transliteration for passage body (inside the white card) — keeps gray, italic */
  transliterationTextInCard: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 20,
  },

  // ── CEFR badges ──
  cefrBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  cefrBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  // ── Conversation Task ──
  conversationCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  conversationPersonaDetails: {
    marginLeft: 12,
    flex: 1,
  },
  conversationPersonaName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  conversationPersonaSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  conversationTurnsRemaining: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conversationTurnsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  conversationTasksContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  conversationTasksTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  conversationTaskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  conversationTaskText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  conversationTaskTextCompleted: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  conversationHistory: {
    flexGrow: 0,
    maxHeight: 300,
    marginBottom: 16,
  },
  conversationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conversationTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  conversationSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationFeedback: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  conversationFeedbackText: {
    fontSize: 13,
    color: '#991B1B',
    fontStyle: 'italic',
  },
  conversationLoadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
});

export default itemStyles;
