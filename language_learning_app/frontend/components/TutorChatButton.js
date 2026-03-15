/**
 * TutorChatButton + TutorModal
 * Floating button (bottom-right) to open a chat with the tutor AI.
 * Hidden when another popup is open or when on Placement Test.
 */
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigationState } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { setStringAsync as clipboardSetString } from '../utils/clipboard';
import { useTutor } from '../contexts/TutorContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const COLORS = {
  primary: '#4A90E2',
  primaryLight: '#E8F4FD',
  surface: '#FFFFFF',
  border: '#E5E5E5',
  text: '#1A1A1A',
  textSecondary: '#666',
  assistantBg: '#F5F5F5',
  userBg: '#4A90E2',
};

/** Preprocess LLM output so markdown parses correctly: ensure tables/lists have preceding newlines and table alignment row is valid. */
function preprocessTutorMarkdown(content) {
  if (typeof content !== 'string' || !content.trim()) return content;
  let s = content;
  // Ensure a blank line before the *first* table row only (so we don't break consecutive table rows)
  s = s.replace(/(^|\n)([^\n]+)\n(\|[^\n]*)/gm, (_, before, prev, pipeLine) => {
    if (/^\s*\|/.test(prev.trim())) return before + prev + '\n' + pipeLine; // prev is table row, keep consecutive
    return before + prev + '\n\n' + pipeLine;
  });
  // Normalize table alignment row: use ASCII hyphen, ensure at least 2 dashes per column (markdown-it expects /^:?-+:?$/)
  s = s.replace(/^\s*\|[\s|:\t-]+\|\s*$/gm, (line) => {
    const cells = line.split('|').map(c => c.trim().replace(/\u2013|\u2014|\u2212/g, '-'));
    const out = cells.filter(Boolean).map((t) => {
      if (!/^:?-+:?$/.test(t)) return t;
      if (t.length >= 2) return t;
      if (t === ':-') return ':--';
      if (t === '-:') return '--:';
      return '---';
    });
    return out.length ? '| ' + out.join(' | ') + ' |' : line;
  });
  // Trim leading spaces from table rows (4+ spaces → code block in markdown-it) so table is recognized
  s = s.replace(/(^|\n)([ \t]{4,})(\|[^\n]*)/g, (_, before, spaces, rest) => before + rest.replace(/^\s*/, ''));
  return s;
}

/** Markdown styles for assistant (tutor) message bubbles — supports tables, lists, code, etc. */
const tutorMarkdownStyles = {
  body: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  heading1: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 8 },
  heading2: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 10, marginBottom: 6 },
  heading3: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 8, marginBottom: 4 },
  heading4: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 6, marginBottom: 4 },
  heading5: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4, marginBottom: 2 },
  heading6: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 4, marginBottom: 2 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  strong: { fontWeight: '700', color: COLORS.text },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  blockquote: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    marginVertical: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  code_inline: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  fence: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  bullet_list_icon: { marginLeft: 6, marginRight: 8 },
  bullet_list_content: { flex: 1 },
  ordered_list_icon: { marginLeft: 6, marginRight: 8 },
  ordered_list_content: { flex: 1 },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginVertical: 10,
  },
  thead: {},
  tbody: {},
  th: {
    flex: 1,
    padding: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
  },
  td: {
    flex: 1,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  link: { color: COLORS.primary, textDecorationLine: 'underline' },
  hr: { backgroundColor: COLORS.border, height: 1, marginVertical: 12 },
  image: { marginVertical: 8, borderRadius: 8 },
};

/** Animated "..." typing indicator for when the agent is thinking */
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (anim, delay) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, useNativeDriver: true, duration: 200 }),
        Animated.timing(anim, { toValue: 0.3, useNativeDriver: true, duration: 200 }),
      ]);
    const loop = Animated.loop(
      Animated.parallel([
        animate(dot1, 0),
        animate(dot2, 150),
        animate(dot3, 300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.bubble, styles.bubbleAssistant, { alignSelf: 'flex-start' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Animated.Text style={[styles.typingDot, { opacity: dot1 }]}>.</Animated.Text>
        <Animated.Text style={[styles.typingDot, { opacity: dot2 }]}>.</Animated.Text>
        <Animated.Text style={[styles.typingDot, { opacity: dot3 }]}>.</Animated.Text>
      </View>
    </View>
  );
}

export function TutorChatButton({ visible = true, onOpenChange }) {
  const insets = useSafeAreaInsets();
  const { openTutor, closeTutor, isOpen } = useTutor();
  const routeName = useNavigationState(state => {
    const r = state?.routes?.[state.index];
    return r?.name ?? '';
  });
  const showFab = visible && !isOpen && routeName !== 'Flashcards';

  const handleClose = () => {
    closeTutor();
    onOpenChange?.(false);
  };

  return (
    <>
      {showFab && (
        <TouchableOpacity
          style={[styles.fab, { bottom: (insets.bottom || 0) + 64 }]}
          onPress={() => { openTutor(); onOpenChange?.(true); }}
          activeOpacity={0.85}
        >
          <View style={styles.fabIconWrapper}>
            <Ionicons name="school" size={24} color="#4A90E2" />
            <Text style={styles.fabLabel}>Tutor</Text>
          </View>
        </TouchableOpacity>
      )}
      <TutorModal
        visible={isOpen}
        onClose={handleClose}
      />
    </>
  );
}

function TutorModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { selectedLanguage } = useContext(LanguageContext);
  const { authHeaders } = useContext(AuthContext);
  const routeName = useNavigationState(state => {
    const r = state?.routes?.[state.index];
    return r?.name ?? 'Main';
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [view, setView] = useState('chat');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectingMode, setSelectingMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [levels, setLevels] = useState({});
  const [debugVisible, setDebugVisible] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    const searchParam = historySearch.trim() ? `?search=${encodeURIComponent(historySearch.trim())}` : '';
    fetch(`${API_BASE_URL}/api/tutor/history${searchParam}`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => setHistory(data.conversations || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [historySearch, authHeaders]);

  useEffect(() => {
    if (visible && view === 'history') fetchHistory();
  }, [visible, view, fetchHistory]);

  useEffect(() => {
    if (!visible) return;
    fetch(`${API_BASE_URL}/api/dashboard/${selectedLanguage || 'kannada'}`, { headers: authHeaders })
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        const lvl = {};
        if (data?.cefr_level) lvl[selectedLanguage || 'kannada'] = data.cefr_level;
        setLevels(lvl);
      })
      .catch(() => {});
  }, [visible, selectedLanguage, authHeaders]);

  const sendMessage = async () => {
    const text = (input || '').trim();
    if (!text || loading) return;
    setInput('');
    const now = new Date().toISOString();
    const userMsg = { role: 'user', content: text, timestamp: now };

    if (editingMessageIndex != null) {
      setMessages(prev => {
        const next = prev.map((m, i) => (i === editingMessageIndex ? { ...userMsg } : m));
        return next.slice(0, editingMessageIndex + 1);
      });
      setEditingMessageIndex(null);
      setConversationId(null);
    } else {
      setMessages(prev => [...prev, userMsg]);
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          context: {
            screen: routeName,
            language: selectedLanguage || '',
            levels,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || '', timestamp: new Date().toISOString() }]);
      setConversationId(data.conversation_id || null);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t respond. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (id) => {
    if (selectingMode) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tutor/conversation/${id}`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const msgs = (data.messages || []).map(m => ({ ...m, timestamp: m.timestamp || null }));
      setMessages(msgs);
      setConversationId(data.id);
      setView('chat');
      setEditingMessageIndex(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setView('chat');
    setEditingMessageIndex(null);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const deleteConversations = async (ids) => {
    if (!ids.length) return;
    setDeleting(true);
    try {
      if (ids.length === 1) {
        const res = await fetch(`${API_BASE_URL}/api/tutor/conversation/${ids[0]}`, { method: 'DELETE', headers: authHeaders });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${API_BASE_URL}/api/tutor/conversations/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ conversation_ids: ids }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      setSelectedIds([]);
      setSelectingMode(false);
      fetchHistory();
      if (conversationId && ids.includes(conversationId)) {
        setMessages([]);
        setConversationId(null);
        setView('chat');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not delete conversation(s).');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteSelected = () => {
    const ids = selectedIds.length ? selectedIds : [];
    if (!ids.length) return;
    Alert.alert(
      'Delete conversations',
      `Delete ${ids.length} conversation${ids.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversations(ids) },
      ]
    );
  };

  const copyMessage = async (content) => {
    try {
      await clipboardSetString(content || '');
      Alert.alert('Copied', 'Message copied to clipboard.');
    } catch (e) {
      Alert.alert('Error', 'Could not copy.');
    }
  };

  const editUserMessage = (index) => {
    const msg = messages[index];
    if (msg?.role === 'user' && msg?.content) {
      setInput(msg.content);
      setEditingMessageIndex(index);
    }
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const showMessageMenu = (item, index) => {
    const options = [
      { text: 'Copy', onPress: () => copyMessage(item.content) },
      ...(item.role === 'user' ? [{ text: 'Edit', onPress: () => editUserMessage(index) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Message', '', options);
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.tutorContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.tutorHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <View style={styles.headerTutorIcon}>
              <Ionicons name="school" size={20} color="#FFF" />
            </View>
            <Text style={styles.tutorHeaderTitle}>Tutor</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.tab, view === 'chat' && styles.tabActive]}
              onPress={() => setView('chat')}
            >
              <Ionicons name="chatbubbles" size={18} color={view === 'chat' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, view === 'chat' && styles.tabTextActive]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={startNewChat}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.tabText, { color: COLORS.primary }]}>New chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, view === 'history' && styles.tabActive]}
              onPress={() => setView('history')}
            >
              <Ionicons name="time" size={18} color={view === 'history' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, view === 'history' && styles.tabTextActive]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDebugVisible(true)} style={styles.debugBtn}>
              <Ionicons name="bug" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tutorBody}>
          {view === 'history' ? (
            <>
              <View style={styles.historyToolbar}>
                <TextInput
                  style={styles.historySearchInput}
                  placeholder="Search chats..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={historySearch}
                  onChangeText={setHistorySearch}
                  returnKeyType="search"
                  onSubmitEditing={fetchHistory}
                />
                <TouchableOpacity
                  style={[styles.historySearchBtn, (historySearch.trim().length > 0) && styles.historySearchBtnActive]}
                  onPress={fetchHistory}
                >
                  <Ionicons name="search" size={20} color={historySearch.trim() ? COLORS.primary : COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.historyActionsRow}>
                <TouchableOpacity
                  style={[styles.historyActionBtn, selectingMode && styles.historyActionBtnActive]}
                  onPress={() => {
                    setSelectingMode(prev => !prev);
                    if (selectingMode) setSelectedIds([]);
                  }}
                >
                  <Text style={[styles.historyActionText, selectingMode && { color: COLORS.primary }]}>
                    {selectingMode ? 'Cancel' : 'Select'}
                  </Text>
                </TouchableOpacity>
                {selectingMode && selectedIds.length > 0 && (
                  <TouchableOpacity
                    style={[styles.historyActionBtn, styles.historyDeleteBtn]}
                    onPress={confirmDeleteSelected}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={18} color="#FFF" />
                        <Text style={styles.historyDeleteText}>Delete ({selectedIds.length})</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.historyList} contentContainerStyle={styles.historyContent} keyboardShouldPersistTaps="handled">
                {loadingHistory ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 24 }} />
                ) : history.length === 0 ? (
                  <Text style={styles.emptyHistory}>
                    {historySearch.trim() ? 'No matching conversations' : 'No past conversations'}
                  </Text>
                ) : (
                  history.map((conv) => (
                    <View key={conv.id} style={styles.historyItemWrapper}>
                      <TouchableOpacity
                        style={[styles.historyItem, selectingMode && selectedIds.includes(conv.id) && styles.historyItemSelected]}
                        onPress={() => loadConversation(conv.id)}
                        activeOpacity={0.7}
                      >
                        {selectingMode && (
                          <View style={styles.historyCheckbox}>
                            <Ionicons
                              name={selectedIds.includes(conv.id) ? 'checkbox' : 'square-outline'}
                              size={24}
                              color={selectedIds.includes(conv.id) ? COLORS.primary : COLORS.textSecondary}
                            />
                          </View>
                        )}
                        <View style={styles.historyItemContent}>
                          <Text style={styles.historyTitle} numberOfLines={1}>{conv.title || 'Conversation'}</Text>
                          <Text style={styles.historyMeta}>{conv.message_count} messages</Text>
                        </View>
                        {!selectingMode && (
                          <TouchableOpacity
                            style={styles.historyItemDelete}
                            onPress={(e) => { e.stopPropagation(); Alert.alert('Delete', 'Delete this conversation?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteConversations([conv.id]) }]); }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Ionicons name="trash-outline" size={20} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            <>
              <FlatList
                data={messages}
                keyExtractor={(_, i) => String(i)}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                ListFooterComponent={loading ? <TypingIndicator /> : null}
                renderItem={({ item, index }) => (
                  <View style={[styles.bubbleWrapper, item.role === 'user' ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant]}>
                    <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                      {item.role === 'user' ? (
                        <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.content}</Text>
                      ) : (
                        <Markdown style={tutorMarkdownStyles}>
                          {preprocessTutorMarkdown(item.content)}
                        </Markdown>
                      )}
                    </View>
                    <View style={[styles.messageMetaRow, item.role === 'user' ? styles.messageMetaRowUser : styles.messageMetaRowAssistant]}>
                      {formatMessageTime(item.timestamp) ? (
                        <Text style={styles.messageTimestamp}>{formatMessageTime(item.timestamp)}</Text>
                      ) : null}
                      <TouchableOpacity
                        style={styles.messageMenuBtn}
                        onPress={() => showMessageMenu(item, index)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.welcomeBlock}>
                    <Text style={styles.welcomeText}>
                      Hey! I'm so glad you're here. Ask me anything about learning {selectedLanguage ? ` ${selectedLanguage}` : ''}—grammar, vocabulary, pronunciation, or culture. Let's make progress together!
                    </Text>
                  </View>
                }
              />
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
              >
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask the tutor..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={sendMessage}
                    returnKeyType="send"
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="send" size={20} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </>
          )}
        </View>
      </View>

      {/* Debug popup */}
      <Modal visible={debugVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.debugOverlay} activeOpacity={1} onPress={() => setDebugVisible(false)}>
          <View style={styles.debugCard} onStartShouldSetResponder={() => true}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>Debug</Text>
              <TouchableOpacity onPress={() => setDebugVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.debugScroll} contentContainerStyle={styles.debugContent}>
              <Text style={styles.debugLabel}>Current screen</Text>
              <Text style={styles.debugValue}>{routeName}</Text>
              <Text style={styles.debugLabel}>Language</Text>
              <Text style={styles.debugValue}>{selectedLanguage || '—'}</Text>
              <Text style={styles.debugLabel}>Levels</Text>
              <Text style={styles.debugValue}>{JSON.stringify(levels, null, 2) || '—'}</Text>
              <Text style={styles.debugLabel}>Conversation ID</Text>
              <Text style={styles.debugValue}>{conversationId || '—'}</Text>
              <Text style={styles.debugLabel}>Messages in thread</Text>
              <Text style={styles.debugValue}>{messages.length}</Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#4A90E2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tutorContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  tutorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  closeBtn: { padding: 8 },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  headerTutorIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  tutorHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tutorBody: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    minHeight: 520,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBtn: {
    padding: 4,
  },
  debugBtn: {
    padding: 6,
    marginLeft: 'auto',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerTabs: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 12,
  },
  welcomeBlock: {
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  welcomeSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    opacity: 0.8,
  },
  bubble: {
    maxWidth: '100%',
    padding: 12,
    borderRadius: 12,
  },
  bubbleWrapper: {
    marginBottom: 8,
    maxWidth: '85%',
  },
  bubbleWrapperUser: { alignSelf: 'flex-end' },
  bubbleWrapperAssistant: { alignSelf: 'flex-start' },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.userBg,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.assistantBg,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  messageActionsUser: { justifyContent: 'flex-end' },
  messageActionsAssistant: { justifyContent: 'flex-start' },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  messageMetaRowUser: { justifyContent: 'flex-end' },
  messageMetaRowAssistant: { justifyContent: 'flex-start' },
  messageTimestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  messageMenuBtn: {
    padding: 4,
  },
  messageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  messageActionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bubbleText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#FFF',
  },
  typingDot: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: COLORS.assistantBg,
    fontSize: 15,
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  newChatText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  historyList: {
    flex: 1,
  },
  historyContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyHistory: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  historyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  historySearchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.assistantBg,
    fontSize: 15,
    color: COLORS.text,
  },
  historySearchBtn: {
    padding: 10,
  },
  historySearchBtnActive: {},
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  historyActionBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  historyActionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  historyDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E53935',
  },
  historyDeleteText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  historyItemWrapper: {
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.assistantBg,
  },
  historyItemSelected: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  historyCheckbox: {
    marginRight: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemDelete: {
    padding: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  debugOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  debugCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  debugScroll: {
    maxHeight: 400,
  },
  debugContent: {
    paddingBottom: 8,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 2,
  },
  debugValue: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default TutorChatButton;
