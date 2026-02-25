/**
 * TutorChatButton + TutorModal
 * Floating button (bottom-right) to open a chat with the tutor AI.
 * Hidden when another popup is open or when on Placement Test.
 */
import React, { useState, useEffect, useContext } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext } from '../contexts/LanguageContext';
import { useNavigationState } from '@react-navigation/native';
import TextImportModal from './TextImportModal';
import TranslationToolModal from './TranslationToolModal';
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
          <Ionicons name="school" size={24} color="#4A90E2" />
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
  const [levels, setLevels] = useState({});
  const [debugVisible, setDebugVisible] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [toolsMenuVisible, setToolsMenuVisible] = useState(false);

  useEffect(() => {
    if (visible && view === 'history') {
      setLoadingHistory(true);
      fetch(`${API_BASE_URL}/api/tutor/history`)
        .then(res => res.json())
        .then(data => {
          setHistory(data.conversations || []);
        })
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [visible, view]);

  useEffect(() => {
    if (!visible) return;
    fetch(`${API_BASE_URL}/api/dashboard/${selectedLanguage || 'kannada'}`)
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        const lvl = {};
        if (data?.cefr_level) lvl[selectedLanguage || 'kannada'] = data.cefr_level;
        setLevels(lvl);
      })
      .catch(() => {});
  }, [visible, selectedLanguage]);

  const sendMessage = async () => {
    const text = (input || '').trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || '' }]);
      setConversationId(data.conversation_id || null);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t respond. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (id) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tutor/conversation/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages || []);
      setConversationId(data.id);
      setView('chat');
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setView('chat');
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={[styles.modalOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Ionicons name="school" size={22} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.modalTitle}>Tutor</Text>
            </View>
            <View style={styles.headerTabs}>
              <TouchableOpacity
                style={[styles.tab, view === 'chat' && styles.tabActive]}
                onPress={() => setView('chat')}
              >
                <Ionicons name="chatbubbles" size={18} color={view === 'chat' ? COLORS.primary : COLORS.textSecondary} />
                <Text style={[styles.tabText, view === 'chat' && styles.tabTextActive]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tab}
                onPress={startNewChat}
              >
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
            </View>
            <TouchableOpacity onPress={() => setDebugVisible(true)} style={styles.debugBtn}>
              <Ionicons name="bug" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {view === 'history' ? (
            <ScrollView style={styles.historyList} contentContainerStyle={styles.historyContent}>
              {loadingHistory ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 24 }} />
              ) : history.length === 0 ? (
                <Text style={styles.emptyHistory}>No past conversations</Text>
              ) : (
                history.map((conv) => (
                  <TouchableOpacity
                    key={conv.id}
                    style={styles.historyItem}
                    onPress={() => loadConversation(conv.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.historyTitle} numberOfLines={1}>{conv.title || 'Conversation'}</Text>
                    <Text style={styles.historyMeta}>{conv.message_count} messages</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : (
            <>
              <FlatList
                data={messages}
                keyExtractor={(_, i) => String(i)}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                renderItem={({ item }) => (
                  <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                      {item.content}
                    </Text>
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
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.toolsTrigger}
                    onPress={() => setToolsMenuVisible(v => !v)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="construct-outline" size={18} color={COLORS.text} />
                    <Text style={styles.toolsTriggerText}>Tools</Text>
                    <Ionicons name={toolsMenuVisible ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {toolsMenuVisible && (
                    <View style={styles.toolsMenu}>
                      <TouchableOpacity
                        style={styles.toolsMenuItem}
                        onPress={() => { setToolsMenuVisible(false); setShowImportModal(true); }}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#4A90E2" />
                        <Text style={[styles.toolsMenuItemText, { color: '#4A90E2' }]}>Import Vocab</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.toolsMenuItem}
                        onPress={() => { setToolsMenuVisible(false); setShowTranslateModal(true); }}
                      >
                        <Ionicons name="language" size={18} color="#8B5CF6" />
                        <Text style={[styles.toolsMenuItemText, { color: '#8B5CF6' }]}>Translate</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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

          {view === 'chat' && messages.length > 0 && (
            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TextImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        language={selectedLanguage || 'kannada'}
      />
      <TranslationToolModal
        visible={showTranslateModal}
        onClose={() => setShowTranslateModal(false)}
        language={selectedLanguage || 'kannada'}
      />

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
    width: 56,
    height: 56,
    borderRadius: 28,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
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
    maxHeight: 420,
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
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.userBg,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.assistantBg,
  },
  bubbleText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#FFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    position: 'relative',
  },
  toolsTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.assistantBg,
  },
  toolsTriggerText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  toolsMenu: {
    position: 'absolute',
    left: 12,
    top: '100%',
    marginTop: 4,
    minWidth: 180,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  toolsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  toolsMenuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
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
    maxHeight: 460,
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
  historyItem: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.assistantBg,
    marginBottom: 8,
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
