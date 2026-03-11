/**
 * ItemRenderer.js
 *
 * Shared, extensible item renderer used by both PlacementTestScreen and
 * UnifiedActivityRenderer.  Each caller passes a `config` object to
 * customise behaviour (recording flow, audio state, text rendering).
 *
 * Usage:
 *   import { renderItem } from './shared/components/ItemRenderer';
 *   renderItem(item, config);
 */
import React from 'react';
import { View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../../../components/SafeText';
import HistoryAudioPlayer from './HistoryAudioPlayer';
import itemStyles from './itemStyles';
import { isDevanagari } from '../utils/textProcessing';

const SPEAKER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

/** For Urdu, never show Devanagari: use Nastaliq from getDisplayText when available. */
function resolveDisplayText(rawText, item, index, field, config) {
  if (!rawText) return rawText;
  if (config.language === 'urdu' && isDevanagari(rawText)) {
    return config.getDisplayText?.(item, index, field) || '';
  }
  return rawText;
}

/**
 * Default text renderer — just renders SafeText.
 * Callers can override via config.renderText for
 * dictionary-clickable / transliteration support.
 * Optional third arg (transliterationText) and fourth (transliterationStyle) are ignored when using default.
 */
const defaultRenderText = (text, style, _transliterationText, _transliterationStyle) => (
  <SafeText style={style}>{text}</SafeText>
);

function renderPassage(item, config, index) {
  const renderText = config.renderText || defaultRenderText;
  const getTranslit = config.getTransliterationForItem;
  const translitTitle = getTranslit?.(item, index, 'passageTitle');
  const translitBody = getTranslit?.(item, index, 'passage');
  const titleText = resolveDisplayText(item.passage_title || 'Passage', item, index, 'passageTitle', config);
  const bodyText = resolveDisplayText(item.passage_text, item, index, 'passage', config);

  let paragraphs = (bodyText || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  let translitParagraphs = (translitBody || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  let useParagraphMatch = paragraphs.length > 1 && translitParagraphs.length === paragraphs.length;
  if (!useParagraphMatch && paragraphs.length === 1 && (bodyText || '').includes('\n')) {
    const byNewline = (bodyText || '').split(/\n/).map(p => p.trim()).filter(Boolean);
    const translitByNewline = (translitBody || '').split(/\n/).map(p => p.trim()).filter(Boolean);
    if (byNewline.length > 1 && byNewline.length === translitByNewline.length) {
      paragraphs = byNewline;
      translitParagraphs = translitByNewline;
      useParagraphMatch = true;
    }
  }

  const bodyContent = useParagraphMatch
    ? paragraphs.flatMap((para, i) => [
        renderText(para, itemStyles.passageParagraph, translitParagraphs[i] || '', itemStyles.transliterationTextInCard),
      ])
    : [renderText(bodyText, itemStyles.passageText, translitBody, itemStyles.transliterationTextInCard)];

  return (
    <View key={item.item_id} style={itemStyles.passageCard}>
      <View style={[itemStyles.passageHeader, { backgroundColor: config.sectionColor }]}>
        <Ionicons name="book-outline" size={18} color="#FFF" />
        <View style={{ flex: 1 }}>
          {renderText(titleText, itemStyles.passageHeaderText, translitTitle, [itemStyles.transliterationTextInHeader, { color: '#FFFFFF' }])}
        </View>
      </View>
      <View style={{ padding: 14 }}>
        {bodyContent.map((el, i) => (
          <View key={`passage-para-${i}`}>{el}</View>
        ))}
      </View>
    </View>
  );
}

function renderTranscript(item, config, index) {
  const hasSpeakers = item.speakers && item.speakers.length > 0;
  const hasDialogue = item.dialogue && item.dialogue.length > 0;
  const sc = config.sectionColor;
  const renderText = config.renderText || defaultRenderText;
  const getTranslit = config.getTransliterationForItem;

  // Audio source — either pre-embedded base64 OR from an external audio state map
  const audioState = config.listeningAudio?.[item.item_id] || {};
  const directBase64 = item.audio_base64 || item.audioBase64 || null;
  const base64 = directBase64 || audioState.audioBase64 || null;

  // Show dialogue in review mode only (config.showDialogue)
  const showDialogue = config.showDialogue && hasDialogue;

  const translitTitle = getTranslit?.(item, index, 'transcriptTitle');
  const titleText = resolveDisplayText(item.transcript_title || 'Listening', item, index, 'transcriptTitle', config);

  return (
    <View key={item.item_id} style={[itemStyles.audioPlayerCard, { borderColor: sc }]}>
      <View style={[itemStyles.audioPlayerHeader, { backgroundColor: sc }]}>
        <Ionicons name="headset-outline" size={18} color="#FFF" />
        {renderText(
          titleText,
          itemStyles.passageHeaderText,
          translitTitle,
          [itemStyles.transliterationTextInHeader, { color: '#FFFFFF' }]
        )}
      </View>

      {/* Speaker legend */}
      {hasSpeakers && (
        <View style={itemStyles.speakerLegend}>
          {item.speakers.map((sp, i) => (
            <View key={i} style={itemStyles.speakerLegendItem}>
              <Ionicons
                name={sp.gender === 'male' ? 'man-outline' : 'woman-outline'}
                size={14}
                color={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}
              />
              <View>
                <SafeText
                  style={[
                    itemStyles.speakerLegendName,
                    { color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] },
                  ]}
                >
                  {sp.name}
                </SafeText>
                {getTranslit && (() => {
                  const t = getTranslit(item, index, `speaker${i}`);
                  return t ? (
                    <SafeText style={itemStyles.transliterationText}>
                      {t}
                    </SafeText>
                  ) : null;
                })()}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Dialogue bubbles (review mode) */}
      {showDialogue && (
        <View style={[itemStyles.dialoguePreview, { marginTop: 8 }]}>
          {item.dialogue.map((line, i) => {
            const color = SPEAKER_COLORS[line.speaker_index % SPEAKER_COLORS.length];
            const sp = item.speakers?.[line.speaker_index];
            const isRight = line.speaker_index % 2 === 1;
            const dialTranslit = getTranslit?.(item, index, `dial${i}`);
            const lineDisplayText = resolveDisplayText(line.text, item, index, `dial${i}`, config);
            return (
              <View key={i} style={[itemStyles.dialogueLine, isRight && itemStyles.dialogueLineRight]}>
                {!isRight && (
                  <Ionicons
                    name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                    size={13}
                    color={color}
                    style={{ marginTop: 3 }}
                  />
                )}
                <View
                  style={[
                    itemStyles.dialogueBubble,
                    { backgroundColor: color + '18', borderColor: color + '40' },
                    isRight && itemStyles.dialogueBubbleRight,
                  ]}
                >
                  {renderText(lineDisplayText, itemStyles.dialogueBubbleText, dialTranslit)}
                </View>
                {isRight && (
                  <Ionicons
                    name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                    size={13}
                    color={color}
                    style={{ marginTop: 3 }}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Fallback speaker label */}
      {!hasSpeakers && item.speaker_label_en && (
        <SafeText style={itemStyles.speakerLabel}>{item.speaker_label_en}</SafeText>
      )}

      {/* Audio controls */}
      <View style={[itemStyles.audioControls, { padding: 12 }]}>
        {base64 ? (
          <HistoryAudioPlayer
            audioBase64={base64}
            mimeType="audio/wav"
            color={sc}
            label="Play Audio"
          />
        ) : audioState.loading ? (
          <View style={itemStyles.audioLoadingRow}>
            <ActivityIndicator size="small" color={sc} />
            <SafeText style={[itemStyles.audioLoadingText, { color: sc }]}>Preparing audio…</SafeText>
          </View>
        ) : audioState.error ? (
          <View style={itemStyles.audioErrorRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
            <SafeText style={itemStyles.audioErrorText}>Could not load audio</SafeText>
            {config.onLoadAudio && (
              <TouchableOpacity onPress={() => config.onLoadAudio(item)} style={itemStyles.audioRetryBtn}>
                <SafeText style={[itemStyles.audioRetryText, { color: sc }]}>Retry</SafeText>
              </TouchableOpacity>
            )}
          </View>
        ) : config.onLoadAudio ? (
          <TouchableOpacity
            style={[itemStyles.audioPlayBtn, { backgroundColor: sc }]}
            onPress={() => config.onLoadAudio(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="play-circle" size={20} color="#FFF" />
            <SafeText style={itemStyles.audioPlayBtnText}>Load Audio</SafeText>
          </TouchableOpacity>
        ) : (
          <View style={itemStyles.audioUnavailableRow}>
            <Ionicons name="volume-mute-outline" size={18} color="#6B7280" />
            <SafeText style={itemStyles.audioUnavailableText}>
              Audio not available. Generate a new listening activity for audio.
            </SafeText>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Choice (also covers translation_choice, transliteration_choice)
// ─────────────────────────────────────────────────────────────────────────────
function renderMultipleChoice(item, index, config) {
  const selected = config.answers[item.item_id];
  const sc = config.sectionColor;
  const showAns = config.showResult || config.showAnswers;
  const disabled = !!config.showResult;
  const renderText = config.renderText || defaultRenderText;
  const language = config.language || '';

  let headerContent = null;
  if (item.type === 'translation_choice' || item.type === 'transliteration_choice') {
    const sourceTranslit = config.getTransliterationForItem?.(item, index, 'source');
    const sourceDisplay = resolveDisplayText(item.source_phrase, item, index, 'source', config);
    headerContent = (
      <>
        <View style={[itemStyles.translationSourceBox, { borderColor: sc }]}>
          {renderText(sourceDisplay, itemStyles.translationSourceText, sourceTranslit)}
        </View>
        {item.question_en && (
          <SafeText style={itemStyles.questionEnText}>{item.question_en}</SafeText>
        )}
      </>
    );
  } else if (item.type === 'translation_choice_reverse') {
    headerContent = (
      <>
        <View style={[itemStyles.translationSourceBox, { borderColor: sc }]}>
          <SafeText style={[itemStyles.translationSourceText, { fontSize: 22 }]}>
            {item.source_phrase_en}
          </SafeText>
        </View>
        <SafeText style={itemStyles.questionEnText}>
          What is the {language ? language.charAt(0).toUpperCase() + language.slice(1) : ''} translation?
        </SafeText>
      </>
    );
  } else {
    const questionTranslit = config.getTransliterationForItem?.(item, index, 'question');
    const questionDisplay = resolveDisplayText(item.question || '', item, index, 'question', config);
    const questionNum = config.getQuestionNumber?.(index);
    const num = (typeof questionNum === 'number' && questionNum > 0) ? questionNum : (typeof index === 'number' ? index + 1 : 0);
    const prefix = num > 0 ? `${num}. ` : '';
    headerContent = (
      <>
        {renderText(
          prefix + questionDisplay,
          itemStyles.questionText,
          questionTranslit
        )}
      </>
    );
  }

  return (
    <View key={item.item_id} style={itemStyles.questionItem}>
      {headerContent}
      <View style={itemStyles.optionsContainer}>
        {(item.options || []).map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === item.correct_index;
          const optDisplay = resolveDisplayText(opt, item, index, `opt${i}`, config);
          return (
            <TouchableOpacity
              key={i}
              style={[
                itemStyles.optionBtn,
                isSelected && { borderColor: sc, backgroundColor: sc + '18' },
                showAns && isCorrect && { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
                showAns && isSelected && !isCorrect && { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
              ]}
              onPress={() => !disabled && config.setAnswers(prev => ({ ...prev, [item.item_id]: i }))}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <View
                style={[
                  itemStyles.optionNumber,
                  isSelected && { backgroundColor: sc },
                  showAns && isCorrect && { backgroundColor: '#10B981' },
                  showAns && isSelected && !isCorrect && { backgroundColor: '#EF4444' },
                ]}
              >
              <SafeText
                style={[
                  itemStyles.optionNumberText,
                  (isSelected || (showAns && (isCorrect || isSelected))) && { color: '#FFF' },
                ]}
              >
                {i + 1}
              </SafeText>
            </View>
            {renderText(
              optDisplay,
              [
                itemStyles.optionText,
                isSelected && { color: sc, fontWeight: '600' },
                showAns && isCorrect && { color: '#10B981', fontWeight: 'bold' },
              ],
              config.getTransliterationForItem?.(item, index, `opt${i}`)
            )}
          </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free Response
// ─────────────────────────────────────────────────────────────────────────────
function renderFreeResponse(item, config, index) {
  const sc = config.sectionColor;
  const disabled = !!config.showResult;
  const renderText = config.renderText || defaultRenderText;
  const promptTranslit = config.getTransliterationForItem?.(item, index, 'prompt');

  // Support both single-textInputValue model (PT) and per-item model (UAR)
  const value =
    config.getTextValue
      ? config.getTextValue(item.item_id)
      : config.textInputValue ?? '';
  const onChange =
    config.onTextChange
      ? (val) => config.onTextChange(item.item_id, val)
      : config.setTextInputValue || (() => {});

  return (
    <View key={item.item_id} style={itemStyles.questionItem}>
      {item.question_en && (
        <SafeText style={itemStyles.questionEnText}>{item.question_en}</SafeText>
      )}
      {item.prompt_native && (() => {
        const questionNum = config.getQuestionNumber?.(index);
        const num = (typeof questionNum === 'number' && questionNum > 0) ? questionNum : (typeof index === 'number' ? index + 1 : 0);
        const prefix = num > 0 ? `${num}. ` : '';
        return renderText(
          prefix + resolveDisplayText(item.prompt_native, item, index, 'prompt', config),
          itemStyles.questionText,
          promptTranslit
        );
      })()}
      <TextInput
        style={[itemStyles.textInput, { borderColor: sc }]}
        multiline
        numberOfLines={5}
        value={value}
        onChangeText={onChange}
        placeholder="Write your response here…"
        placeholderTextColor="#9CA3AF"
        textAlignVertical="top"
        editable={!disabled}
      />
      {item.min_words && (
        <SafeText style={itemStyles.wordHint}>
          {item.min_words}–{item.max_words || '∞'} words
        </SafeText>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Speaking Prompt
// ─────────────────────────────────────────────────────────────────────────────
function renderSpeakingPrompt(item, config, index) {
  const sc = config.sectionColor;
  const disabled = !!config.showResult;
  const renderText = config.renderText || defaultRenderText;
  const promptTranslit = config.getTransliterationForItem?.(item, index, 'prompt');

  const audioAnswer =
    typeof config.answers[item.item_id] === 'object'
      ? config.answers[item.item_id]
      : null;
  const hasAudio = !!(audioAnswer?.audio_base64);

  // Recording state — provided by caller
  const isRecordingThis = config.isRecordingItem?.(item.item_id) ?? false;
  const isSaving = config.isSavingItem?.(item.item_id) ?? false;
  const recordingIdle = !isRecordingThis && !isSaving;

  return (
    <View key={item.item_id} style={itemStyles.questionItem}>
      {item.prompt_native && renderText(
        resolveDisplayText(item.prompt_native, item, index, 'prompt', config),
        itemStyles.questionText,
        promptTranslit
      )}

      {/* Recorded audio playback */}
      {hasAudio && (
        <View style={[itemStyles.audioRecordedCard, { borderColor: sc, flexDirection: 'column', gap: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="mic-circle-outline" size={20} color={sc} />
            <SafeText style={[itemStyles.audioRecordedText, { color: sc }]}>Audio recorded</SafeText>
            {!disabled && (
              <TouchableOpacity
                style={[
                  itemStyles.audioRecordedBtn,
                  { backgroundColor: '#EF444418', borderColor: '#EF4444', marginLeft: 'auto' },
                ]}
                onPress={() =>
                  config.setAnswers(prev => ({ ...prev, [item.item_id]: undefined }))
                }
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <SafeText style={[itemStyles.audioRecordedBtnText, { color: '#EF4444' }]}>
                  Delete
                </SafeText>
              </TouchableOpacity>
            )}
          </View>
          <HistoryAudioPlayer
            audioBase64={audioAnswer.audio_base64}
            mimeType={audioAnswer.audio_format === 'webm' ? 'audio/webm' : 'audio/mp4'}
            color={sc}
            label="Play back"
          />
        </View>
      )}

      {/* Record / Stop / Saving */}
      {!hasAudio && (
        <View style={itemStyles.recordRow}>
          {recordingIdle && (
            <TouchableOpacity
              style={[itemStyles.recordBtn, { backgroundColor: disabled ? '#9CA3AF' : sc }]}
              onPress={() => config.onStartRecording?.(item.item_id)}
              activeOpacity={0.8}
              disabled={disabled}
            >
              <Ionicons name="mic" size={22} color="#FFF" />
              <SafeText style={itemStyles.recordBtnText}>Record Response</SafeText>
            </TouchableOpacity>
          )}
          {isRecordingThis && (
            <TouchableOpacity
              style={[itemStyles.recordBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => config.onStopRecording?.(item.item_id)}
              activeOpacity={0.8}
            >
              <Ionicons name="stop-circle" size={22} color="#FFF" />
              <SafeText style={itemStyles.recordBtnText}>Stop Recording</SafeText>
            </TouchableOpacity>
          )}
          {isSaving && (
            <View style={[itemStyles.recordBtn, { backgroundColor: '#6B7280' }]}>
              <ActivityIndicator size="small" color="#FFF" />
              <SafeText style={itemStyles.recordBtnText}>Saving…</SafeText>
            </View>
          )}
        </View>
      )}
      {item.min_sentences && !hasAudio && (
        <SafeText style={itemStyles.wordHint}>
          {item.min_sentences}–{item.max_sentences || '∞'} sentences
        </SafeText>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Object} item   – an item from the sections→items array
 * @param {number} index  – visual index (used for question numbering)
 * @param {Object} config – caller-specific overrides:
 *   answers, setAnswers, sectionColor, showResult, showAnswers,
 *   language, renderText, textInputValue, setTextInputValue,
 *   getTextValue, onTextChange,
 *   listeningAudio, onLoadAudio, onToggleAudio, showDialogue,
 *   onStartRecording, onStopRecording, isRecordingItem, isSavingItem
 */
export function renderItem(item, index, config) {
  if (!item) return null;

  switch (item.type) {
    case 'passage':
      return renderPassage(item, config, index);
    case 'transcript':
      return renderTranscript(item, config, index);
    case 'multiple_choice':
    case 'translation_choice':
    case 'translation_choice_reverse':
    case 'transliteration_choice':
      return renderMultipleChoice(item, index, config);
    case 'free_response':
      return renderFreeResponse(item, config, index);
    case 'speaking_prompt':
      return renderSpeakingPrompt(item, config, index);
    default:
      return (
        <SafeText key={item.item_id || index} style={itemStyles.questionText}>
          {JSON.stringify(item)}
        </SafeText>
      );
  }
}

export default { renderItem };
