import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function APIDebugModal({ visible, onClose, allApiDetails }) {
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Ensure allApiDetails is an array before using reduce
  const apiDetailsArray = Array.isArray(allApiDetails) ? allApiDetails : [];

  // Calculate cumulative totals
  const cumulative = apiDetailsArray.reduce(
    (acc, apiCall) => {
      const tokenInfo = apiCall.tokenInfo || {};
      const inputTokens = tokenInfo.input_tokens || tokenInfo.prompt_tokens || 0;
      const outputTokens = tokenInfo.output_tokens || tokenInfo.completion_tokens || 0;
      const inputCost = tokenInfo.input_cost || 0;
      const outputCost = tokenInfo.output_cost || 0;
      const textTotalCost = tokenInfo.total_cost || inputCost + outputCost;
      const ttsCost = apiCall.ttsCost || 0;
      const totalCost = apiCall.totalCost || textTotalCost + ttsCost;

      return {
        totalInputTokens: acc.totalInputTokens + inputTokens,
        totalOutputTokens: acc.totalOutputTokens + outputTokens,
        totalInputCost: acc.totalInputCost + inputCost,
        totalOutputCost: acc.totalOutputCost + outputCost,
        totalTtsCost: acc.totalTtsCost + ttsCost,
        totalCost: acc.totalCost + totalCost,
        totalCalls: acc.totalCalls + 1,
      };
    },
    {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalInputCost: 0,
      totalOutputCost: 0,
      totalTtsCost: 0,
      totalCost: 0,
      totalCalls: 0,
    }
  );

  const toggleCard = (id) => {
    const newExpanded = new Set(expandedCards);
    if (expandedCards.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>API Request Details</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
            {/* Cumulative Totals */}
            {apiDetailsArray.length > 0 && (
              <View style={styles.cumulativeSection}>
                <Text style={styles.cumulativeTitle}>
                  Cumulative Totals ({cumulative.totalCalls} API{' '}
                  {cumulative.totalCalls === 1 ? 'Call' : 'Calls'})
                </Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Input Tokens:</Text>
                    <Text style={styles.statValue}>
                      {cumulative.totalInputTokens.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Output Tokens:</Text>
                    <Text style={styles.statValue}>
                      {cumulative.totalOutputTokens.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Input Cost:</Text>
                    <Text style={styles.statValue}>
                      ${cumulative.totalInputCost.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Output Cost:</Text>
                    <Text style={styles.statValue}>
                      ${cumulative.totalOutputCost.toFixed(6)}
                    </Text>
                  </View>
                  {cumulative.totalTtsCost > 0 && (
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Total TTS Cost:</Text>
                      <Text style={styles.statValue}>
                        ${cumulative.totalTtsCost.toFixed(6)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.statRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Grand Total Cost:</Text>
                    <Text style={styles.totalValue}>
                      ${cumulative.totalCost.toFixed(6)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* All API Calls */}
            {apiDetailsArray.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No API calls recorded yet.</Text>
              </View>
            ) : (
              <View style={styles.callsSection}>
                <Text style={styles.callsTitle}>All API Calls:</Text>
                {apiDetailsArray.map((apiCall, index) => {
                  const isExpanded = expandedCards.has(apiCall.id || index);
                  const tokenInfo = apiCall.tokenInfo || {};
                  const inputTokens =
                    tokenInfo.input_tokens || tokenInfo.prompt_tokens || 0;
                  const outputTokens =
                    tokenInfo.output_tokens || tokenInfo.completion_tokens || 0;
                  const inputCost = tokenInfo.input_cost || 0;
                  const outputCost = tokenInfo.output_cost || 0;
                  const textTotalCost = tokenInfo.total_cost || inputCost + outputCost;
                  const totalCost =
                    apiCall.totalCost || textTotalCost + (apiCall.ttsCost || 0);
                  const timestamp = apiCall.timestamp
                    ? new Date(apiCall.timestamp).toLocaleString()
                    : `Call ${index + 1}`;

                  return (
                    <View key={apiCall.id || index} style={styles.callCard}>
                      <TouchableOpacity
                        style={styles.callHeader}
                        onPress={() => toggleCard(apiCall.id || index)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.callEndpoint}>
                            {apiCall.endpoint || `API Call ${index + 1}`}
                          </Text>
                          <Text style={styles.callSummary}>
                            {timestamp} • ${totalCost.toFixed(6)} •{' '}
                            {inputTokens + outputTokens} tokens
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.callContent}>
                          {/* Parse Error */}
                          {apiCall.parseError && (
                            <View style={styles.errorSection}>
                              <Text style={styles.errorLabel}>⚠️ Parse Error:</Text>
                              <Text style={styles.errorText}>{apiCall.parseError}</Text>
                            </View>
                          )}

                          {/* TTS Error */}
                          {apiCall.ttsError && (
                            <View style={styles.errorSection}>
                              <Text style={styles.errorLabel}>
                                🔊 TTS Error (No Audio Generated):
                              </Text>
                              <Text style={styles.errorText}>{apiCall.ttsError}</Text>
                            </View>
                          )}

                          {/* Token Stats */}
                          {tokenInfo && (inputTokens > 0 || outputTokens > 0) && (
                            <View style={styles.detailSection}>
                              <Text style={styles.detailLabel}>
                                Token Usage & Cost:
                              </Text>
                              <View style={styles.statsContainer}>
                                <View style={styles.statRow}>
                                  <Text style={styles.statLabel}>Input Tokens:</Text>
                                  <Text style={styles.statValue}>
                                    {inputTokens.toLocaleString()}
                                  </Text>
                                </View>
                                <View style={styles.statRow}>
                                  <Text style={styles.statLabel}>Output Tokens:</Text>
                                  <Text style={styles.statValue}>
                                    {outputTokens.toLocaleString()}
                                  </Text>
                                </View>
                                <View style={styles.statRow}>
                                  <Text style={styles.statLabel}>Input Cost:</Text>
                                  <Text style={styles.statValue}>
                                    ${inputCost.toFixed(6)}
                                  </Text>
                                </View>
                                <View style={styles.statRow}>
                                  <Text style={styles.statLabel}>Output Cost:</Text>
                                  <Text style={styles.statValue}>
                                    ${outputCost.toFixed(6)}
                                  </Text>
                                </View>
                                {apiCall.ttsCost > 0 && (
                                  <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>TTS Cost:</Text>
                                    <Text style={styles.statValue}>
                                      ${apiCall.ttsCost.toFixed(6)}
                                    </Text>
                                  </View>
                                )}
                                <View style={[styles.statRow, styles.totalRow]}>
                                  <Text style={styles.totalLabel}>Total Cost:</Text>
                                  <Text style={styles.totalValue}>
                                    ${totalCost.toFixed(6)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}

                          {/* Response Time */}
                          {apiCall.responseTime !== undefined &&
                            apiCall.responseTime !== null && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Response Time:</Text>
                                <Text style={styles.detailValue}>
                                  {apiCall.responseTime.toFixed(2)}s
                                </Text>
                              </View>
                            )}

                          {/* Prompt */}
                          {apiCall.prompt && (
                            <View style={styles.detailSection}>
                              <Text style={styles.detailLabel}>Prompt:</Text>
                              <ScrollView
                                style={styles.codeBlock}
                                nestedScrollEnabled={true}
                              >
                                <Text style={styles.codeText}>{apiCall.prompt}</Text>
                              </ScrollView>
                            </View>
                          )}

                          {/* Raw Response */}
                          {apiCall.rawResponse && (
                            <View style={styles.detailSection}>
                              <Text style={styles.detailLabel}>Raw Response:</Text>
                              <ScrollView
                                style={styles.codeBlock}
                                nestedScrollEnabled={true}
                              >
                                <Text style={styles.codeText}>
                                  {apiCall.rawResponse}
                                </Text>
                              </ScrollView>
                            </View>
                          )}

                          {/* Words Used */}
                          {apiCall.wordsUsed && apiCall.wordsUsed.length > 0 && (
                            <View style={styles.detailSection}>
                              <Text style={styles.detailLabel}>Words Used:</Text>
                              <Text style={styles.detailValue}>
                                {apiCall.wordsUsed.join(', ')}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 700,
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  cumulativeSection: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  cumulativeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  statsContainer: {
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#CCC',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  emptySection: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  callsSection: {
    marginTop: 8,
  },
  callsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  callCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  callEndpoint: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  callSummary: {
    fontSize: 11,
    color: '#666',
  },
  callContent: {
    padding: 12,
    gap: 12,
  },
  errorSection: {
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#E53E3E',
  },
  errorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#742A2A',
  },
  detailSection: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    color: '#1A1A1A',
  },
  codeBlock: {
    backgroundColor: '#2D3748',
    borderRadius: 6,
    padding: 12,
    maxHeight: 200,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: '#F7FAFC',
    lineHeight: 16,
  },
});
