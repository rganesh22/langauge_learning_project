// Agentic Curriculum UI Application Logic

const API_URL = 'http://localhost:8000';

let currentTasks = [];
let activeStreams = new Map();

// Task filtering and selection
let selectedTasks = new Set();
let currentStatusFilter = 'all';

// Prompt history for console-like behavior
let promptHistory = [];
let historyIndex = -1;
let currentDraft = '';

// DOM Elements - will be initialized after DOM loads
let promptInput, modelSelect, maxIterInput, maxCostInput, includeReadmeToggle;
let startTaskBtn, tasksList, tasksCount, taskModal, modalTitle, modalBody, closeModalBtn;
let statsBtn, toolboxBtn;
let statusFilter, batchActions, selectedCount, batchCancelBtn, batchDeleteBtn;
let settingsToggle, settingsContent;
let viewReadmeLink, readmeModal, closeReadmeBtn, readmeContent;
let toolboxModal, closeToolboxBtn, toolsList;
let statsModal, closeStatsBtn, statsBody;
let yamlPreviewToggle, yamlPreviewContent, yamlPreview;
let systemPromptPreviewToggle, systemPromptPreviewContent, systemPromptPreview;
let configureToolsBtn, toolsConfigModal, closeToolsConfigBtn, toolsConfigList, applyToolsConfigBtn, toolsSummary;
let editSystemPromptBtn, systemPromptModal, closeSystemPromptBtn, systemPromptTextarea, saveSystemPromptBtn, resetSystemPromptBtn;
let contextSummarizationToggle, contextSummarizationContent;
let enableContextSummarizationToggle, contextTokenThreshold, contextTargetTokens, contextCompressionRatio, contextMinMessages, contextSummarizationModel;
let expandSystemPromptBtn, fullSystemPromptModal, closeFullSystemPromptBtn, fullSystemPromptPreview;
let manageProfilesBtn, profileModal, closeProfileBtn, newProfileName, saveProfileBtn, profilesList;

// Tools state
let availableTools = [];
let enabledTools = new Set();

// System prompt state
let currentSystemPrompt = '';
let defaultSystemPrompt = '';
let currentReadmeContent = '';

// Profiles state
let savedProfiles = {};
let defaultProfileName = null;

// Load profiles from localStorage
function loadProfiles() {
  try {
    const stored = localStorage.getItem('taskProfiles');
    if (stored) {
      savedProfiles = JSON.parse(stored);
    }
    defaultProfileName = localStorage.getItem('defaultProfile') || null;
  } catch (error) {
    console.error('Failed to load profiles:', error);
    savedProfiles = {};
    defaultProfileName = null;
  }
}

// Save profiles to localStorage
function saveProfilesToStorage() {
  try {
    localStorage.setItem('taskProfiles', JSON.stringify(savedProfiles));
    if (defaultProfileName) {
      localStorage.setItem('defaultProfile', defaultProfileName);
    } else {
      localStorage.removeItem('defaultProfile');
    }
  } catch (error) {
    console.error('Failed to save profiles:', error);
  }
}

// Initialize DOM elements
function initDOMElements() {
  promptInput = document.getElementById('promptInput');
  modelSelect = document.getElementById('modelSelect');
  maxIterInput = document.getElementById('maxIterInput');
  maxCostInput = document.getElementById('maxCostInput');
  includeReadmeToggle = document.getElementById('includeReadmeToggle');
  startTaskBtn = document.getElementById('startTaskBtn');
  tasksList = document.getElementById('tasksList');
  tasksCount = document.getElementById('tasksCount');
  taskModal = document.getElementById('taskModal');
  modalTitle = document.getElementById('modalTitle');
  modalBody = document.getElementById('modalBody');
  closeModalBtn = document.getElementById('closeModalBtn');
  statsBtn = document.getElementById('statsBtn');
  toolboxBtn = document.getElementById('toolboxBtn');
  
  // Task filtering and batch operations
  statusFilter = document.getElementById('statusFilter');
  batchActions = document.getElementById('batchActions');
  selectedCount = document.getElementById('selectedCount');
  batchCancelBtn = document.getElementById('batchCancelBtn');
  batchDeleteBtn = document.getElementById('batchDeleteBtn');
  
  settingsToggle = document.getElementById('settingsToggle');
  settingsContent = document.getElementById('settingsContent');
  
  viewReadmeLink = document.getElementById('viewReadmeLink');
  readmeModal = document.getElementById('readmeModal');
  closeReadmeBtn = document.getElementById('closeReadmeBtn');
  readmeContent = document.getElementById('readmeContent');
  
  toolboxModal = document.getElementById('toolboxModal');
  closeToolboxBtn = document.getElementById('closeToolboxBtn');
  toolsList = document.getElementById('toolsList');
  
  statsModal = document.getElementById('statsModal');
  closeStatsBtn = document.getElementById('closeStatsBtn');
  statsBody = document.getElementById('statsBody');
  
  yamlPreviewToggle = document.getElementById('yamlPreviewToggle');
  yamlPreviewContent = document.getElementById('yamlPreviewContent');
  yamlPreview = document.getElementById('yamlPreview');
  
  systemPromptPreviewToggle = document.getElementById('systemPromptPreviewToggle');
  systemPromptPreviewContent = document.getElementById('systemPromptPreviewContent');
  systemPromptPreview = document.getElementById('systemPromptPreview');
  
  configureToolsBtn = document.getElementById('configureToolsBtn');
  toolsConfigModal = document.getElementById('toolsConfigModal');
  closeToolsConfigBtn = document.getElementById('closeToolsConfigBtn');
  toolsConfigList = document.getElementById('toolsConfigList');
  applyToolsConfigBtn = document.getElementById('applyToolsConfigBtn');
  toolsSummary = document.getElementById('toolsSummary');
  
  editSystemPromptBtn = document.getElementById('editSystemPromptBtn');
  systemPromptModal = document.getElementById('systemPromptModal');
  closeSystemPromptBtn = document.getElementById('closeSystemPromptBtn');
  systemPromptTextarea = document.getElementById('systemPromptTextarea');
  saveSystemPromptBtn = document.getElementById('saveSystemPromptBtn');
  resetSystemPromptBtn = document.getElementById('resetSystemPromptBtn');
  
  contextSummarizationToggle = document.getElementById('contextSummarizationToggle');
  contextSummarizationContent = document.getElementById('contextSummarizationContent');
  enableContextSummarizationToggle = document.getElementById('enableContextSummarizationToggle');
  contextTokenThreshold = document.getElementById('contextTokenThreshold');
  contextTargetTokens = document.getElementById('contextTargetTokens');
  contextCompressionRatio = document.getElementById('contextCompressionRatio');
  contextMinMessages = document.getElementById('contextMinMessages');
  contextSummarizationModel = document.getElementById('contextSummarizationModel');
  
  expandSystemPromptBtn = document.getElementById('expandSystemPromptBtn');
  fullSystemPromptModal = document.getElementById('fullSystemPromptModal');
  closeFullSystemPromptBtn = document.getElementById('closeFullSystemPromptBtn');
  fullSystemPromptPreview = document.getElementById('fullSystemPromptPreview');
  
  manageProfilesBtn = document.getElementById('manageProfilesBtn');
  profileModal = document.getElementById('profileModal');
  closeProfileBtn = document.getElementById('closeProfileBtn');
  newProfileName = document.getElementById('newProfileName');
  saveProfileBtn = document.getElementById('saveProfileBtn');
  profilesList = document.getElementById('profilesList');
  
  console.log('DOM elements initialized:', {
    toolboxBtn: !!toolboxBtn,
    statsBtn: !!statsBtn,
    settingsToggle: !!settingsToggle,
    editSystemPromptBtn: !!editSystemPromptBtn,
    contextSummarizationToggle: !!contextSummarizationToggle
  });
}

// Initialize
async function init() {
  loadProfiles();
  await loadConfig();
  await loadTools();
  await loadSystemPromptDefault();
  await loadReadmeContent();
  await loadTasks();
  updateYAMLPreview();
  updateSystemPromptPreview();
  
  // Apply default profile if one is set
  if (defaultProfileName && savedProfiles[defaultProfileName]) {
    applySettings(savedProfiles[defaultProfileName]);
    console.log(`Applied default profile: ${defaultProfileName}`);
  }
  
  // Auto-refresh tasks every 2 seconds
  setInterval(loadTasks, 2000);
}

// Load README content for preview
async function loadReadmeContent() {
  try {
    const response = await fetch(`${API_URL}/api/readme`);
    if (!response.ok) return;
    const data = await response.json();
    
    currentReadmeContent = data.content;
  } catch (error) {
    console.error('Failed to load README content:', error);
  }
}

// Load default system prompt
async function loadSystemPromptDefault() {
  try {
    const response = await fetch(`${API_URL}/api/system-prompt`);
    if (!response.ok) return;
    const data = await response.json();
    
    defaultSystemPrompt = data.content;
    currentSystemPrompt = data.content;
  } catch (error) {
    console.error('Failed to load default system prompt:', error);
  }
}

// Load available tools
async function loadTools() {
  try {
    const response = await fetch(`${API_URL}/api/tools`);
    const data = await response.json();
    
    if (data.success) {
      availableTools = data.tools;
      // Enable all tools by default
      enabledTools = new Set(availableTools.map(t => t.name));
      updateToolsSummary();
      updateSystemPromptPreview();
    }
  } catch (error) {
    console.error('Failed to load tools:', error);
    toolsSummary.textContent = 'Failed to load tools';
  }
}

// Update tools summary text
function updateToolsSummary() {
  const total = availableTools.length;
  const enabled = enabledTools.size;
  
  if (enabled === total) {
    toolsSummary.textContent = `All tools enabled (${total})`;
  } else {
    toolsSummary.textContent = `${enabled} of ${total} tools enabled`;
  }
  
  updateYAMLPreview();
}

// Update YAML preview
function updateYAMLPreview() {
  const prompt = promptInput.value.trim() || 'Enter a task prompt above';
  const model = modelSelect.value;
  const maxIter = maxIterInput.value;
  const maxCost = maxCostInput.value;
  const includeReadme = includeReadmeToggle.checked;
  
  const toolsConfig = enabledTools.size === availableTools.length 
    ? 'all' 
    : Array.from(enabledTools).join(', ');
  
  // Context summarization settings
  const contextEnabled = enableContextSummarizationToggle.checked;
  const contextTokens = contextTokenThreshold.value;
  const contextTarget = contextTargetTokens.value;
  const contextRatio = contextCompressionRatio.value;
  const contextMin = contextMinMessages.value;
  const contextModel = contextSummarizationModel.value;
  
  const yaml = `task_id: auto-generated
prompt: "${prompt.replace(/"/g, '\\"').substring(0, 60)}${prompt.length > 60 ? '...' : ''}"
model: ${model}
max_iterations: ${maxIter}
max_cost: ${maxCost}
include_readme: ${includeReadme}
enabled_tools: ${toolsConfig === 'all' ? 'all' : '\n  - ' + Array.from(enabledTools).join('\n  - ')}
context_summarization:
  enabled: ${contextEnabled}
  token_threshold: ${contextTokens}
  target_tokens: ${contextTarget}
  compression_ratio: ${contextRatio}
  min_messages: ${contextMin}
  model: ${contextModel}`;
  
  yamlPreview.textContent = yaml;
}

// Update system prompt preview
async function updateSystemPromptPreview() {
  try {
    const includeReadme = includeReadmeToggle.checked;
    
    // Build FULL tools description (no abbreviation)
    let toolsDesc = '';
    if (availableTools.length > 0) {
      toolsDesc = availableTools.map(tool => {
        return `**${tool.name}**\n${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`;
      }).join('\n\n');
    } else {
      toolsDesc = '[Tools will be loaded when available]';
    }
    
    // Build FULL README section (no abbreviation)
    const readmeSection = includeReadme && currentReadmeContent
      ? `\n\nLESSON FORMAT SPECIFICATION:\n\n${currentReadmeContent}\n\n---\n`
      : '\n\n[Lesson format specification will be included when README toggle is enabled]\n';
    
    // Format the COMPLETE preview (exactly as it will be sent to model)
    const preview = `${currentSystemPrompt}

Your task: [Task prompt will be inserted here]

AVAILABLE TOOLS:

${toolsDesc}
${readmeSection}`;
    
    systemPromptPreview.textContent = preview;
  } catch (error) {
    console.error('Failed to update system prompt preview:', error);
    systemPromptPreview.textContent = 'Error loading preview...';
  }
}

// Load configuration
async function loadConfig() {
  try {
    const response = await fetch(`${API_URL}/api/config`);
    const config = await response.json();
    
    modelSelect.value = config.model;
    maxIterInput.value = config.max_iterations;
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

// Load tasks list
async function loadTasks() {
  try {
    const response = await fetch(`${API_URL}/api/tasks?limit=50`);
    const data = await response.json();
    
    // Merge server tasks with any optimistically-added local tasks
    // that haven't appeared on the server yet (race condition fix)
    const serverTaskIds = new Set(data.tasks.map(t => t.task_id));
    const localOnlyTasks = currentTasks.filter(t => 
      !serverTaskIds.has(t.task_id) && t.status === 'running'
    );
    
    // Server tasks take priority, but prepend any local-only running tasks
    currentTasks = [...localOnlyTasks, ...data.tasks];
    renderTasks();
  } catch (error) {
    console.error('Failed to load tasks:', error);
  }
}

// Render tasks list
function renderTasks() {
  // Filter tasks based on status filter
  const filteredTasks = currentStatusFilter === 'all' 
    ? currentTasks 
    : currentTasks.filter(task => task.status === currentStatusFilter);
  
  // Update tasks count
  tasksCount.textContent = `${filteredTasks.length}${currentStatusFilter !== 'all' ? ` / ${currentTasks.length}` : ''}`;
  
  if (filteredTasks.length === 0) {
    tasksList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <div class="empty-state-text">${currentStatusFilter === 'all' ? 'No tasks yet. Create one to get started!' : `No ${currentStatusFilter} tasks.`}</div>
      </div>
    `;
    return;
  }
  
  tasksList.innerHTML = filteredTasks.map(task => {
    // Determine status class - map all possible statuses
    let statusClass = 'pending';
    if (task.status === 'running') statusClass = 'running';
    else if (task.status === 'complete') statusClass = 'complete';
    else if (task.status === 'failed' || task.status === 'error') statusClass = 'failed';
    else if (task.status === 'cancelled') statusClass = 'cancelled';
    else if (task.status === 'max_iterations') statusClass = 'warning';
    
    // Format status display
    const statusDisplay = task.status === 'max_iterations' ? 'Max Iterations' : 
                         task.status.charAt(0).toUpperCase() + task.status.slice(1);
    
    const cost = task.total_cost ? `$${task.total_cost.toFixed(4)}` : '-';
    const iterations = task.iterations || 0;
    const startTime = formatDateTime(task.created_at);
    const duration = getExecutionDuration(task.created_at, task.completed_at);
    
    const isSelected = selectedTasks.has(task.task_id);
    
    return `
      <div class="task-card ${statusClass} ${isSelected ? 'selected' : ''}" style="padding-left: 40px;">
        <input type="checkbox" 
               class="task-checkbox" 
               data-task-id="${task.task_id}"
               ${isSelected ? 'checked' : ''}
               onclick="event.stopPropagation(); toggleTaskSelection('${task.task_id}')" />
        <div onclick="openTaskDetails('${task.task_id}')">
          <div class="task-header">
            <div class="task-prompt">${escapeHtml(task.prompt)}</div>
            <div class="task-status ${statusClass}">
              ${task.status === 'running' ? '<span class="spinner"></span>' : ''}
              ${statusDisplay}
            </div>
          </div>
          <div class="task-meta">
            <div class="task-meta-item"><i class="fas fa-fingerprint"></i> ${task.task_id.substring(0, 8)}</div>
            <div class="task-meta-item"><i class="fas fa-calendar"></i> ${startTime}</div>
          </div>
          <div class="task-meta">
            <div class="task-meta-item"><i class="fas fa-hourglass-half"></i> ${duration}</div>
            <div class="task-meta-item"><i class="fas fa-dollar-sign"></i> ${cost}</div>
          </div>
          <div class="task-meta">
            <div class="task-meta-item"><i class="fas fa-sync-alt"></i> ${iterations} iter</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Update batch actions visibility
  updateBatchActionsUI();
}

// Task selection and filtering functions
function toggleTaskSelection(taskId) {
  if (selectedTasks.has(taskId)) {
    selectedTasks.delete(taskId);
  } else {
    selectedTasks.add(taskId);
  }
  renderTasks();
}

function clearSelection() {
  selectedTasks.clear();
  renderTasks();
}

function updateBatchActionsUI() {
  const count = selectedTasks.size;
  selectedCount.textContent = `${count} selected`;
  batchActions.style.display = count > 0 ? 'flex' : 'none';
  
  // Update button states
  const hasRunning = Array.from(selectedTasks).some(taskId => {
    const task = currentTasks.find(t => t.task_id === taskId);
    return task && task.status === 'running';
  });
  
  batchCancelBtn.disabled = !hasRunning;
  batchCancelBtn.style.opacity = hasRunning ? '1' : '0.5';
  batchCancelBtn.style.cursor = hasRunning ? 'pointer' : 'not-allowed';
}

async function batchCancelTasks() {
  const tasksToCancel = Array.from(selectedTasks).filter(taskId => {
    const task = currentTasks.find(t => t.task_id === taskId);
    return task && task.status === 'running';
  });
  
  if (tasksToCancel.length === 0) {
    showToast('No running tasks to cancel', 'warning');
    return;
  }
  
  if (!confirm(`Cancel ${tasksToCancel.length} running task(s)?`)) {
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const taskId of tasksToCancel) {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/cancel`, {
        method: 'POST'
      });
      
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`Failed to cancel task ${taskId}:`, error);
      failCount++;
    }
  }
  
  showToast(`✅ Cancelled ${successCount} task(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 
            failCount === 0 ? 'success' : 'warning');
  
  clearSelection();
  await loadTasks();
}

async function batchDeleteTasks() {
  if (selectedTasks.size === 0) {
    showToast('No tasks selected', 'warning');
    return;
  }
  
  if (!confirm(`Delete ${selectedTasks.size} task(s)? This cannot be undone.`)) {
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const taskId of selectedTasks) {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      failCount++;
    }
  }
  
  showToast(`🗑️ Deleted ${successCount} task(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 
            failCount === 0 ? 'success' : 'warning');
  
  clearSelection();
  await loadTasks();
}

// Make functions globally accessible
window.toggleTaskSelection = toggleTaskSelection;
window.clearSelection = clearSelection;
window.batchCancelTasks = batchCancelTasks;
window.batchDeleteTasks = batchDeleteTasks;

// Start new task
async function startTask() {
  const prompt = promptInput.value.trim();
  
  if (!prompt) {
    alert('Please enter a task prompt');
    return;
  }
  
  // Add to history
  if (promptHistory.length === 0 || promptHistory[promptHistory.length - 1] !== prompt) {
    promptHistory.push(prompt);
    // Keep only last 50 prompts
    if (promptHistory.length > 50) {
      promptHistory.shift();
    }
  }
  historyIndex = promptHistory.length;
  currentDraft = '';
  
  const config = {
    model: modelSelect.value,
    max_iterations: parseInt(maxIterInput.value),
    max_cost_per_task: parseFloat(maxCostInput.value),
    include_readme: includeReadmeToggle.checked,
    enabled_tools: Array.from(enabledTools),
    enable_context_summarization: enableContextSummarizationToggle.checked,
    context_summarization: {
      model: contextSummarizationModel.value,
      token_threshold: parseInt(contextTokenThreshold.value),
      target_token_count: parseInt(contextTargetTokens.value),
      min_messages_before_summarize: parseInt(contextMinMessages.value),
      compression_ratio: parseInt(contextCompressionRatio.value)
    }
  };
  
  // Add system prompt if customized
  if (currentSystemPrompt && currentSystemPrompt !== defaultSystemPrompt) {
    config.system_prompt = currentSystemPrompt;
  }
  
  startTaskBtn.disabled = true;
  startTaskBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  
  try {
    const response = await fetch(`${API_URL}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, config })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.task_id) {
      promptInput.value = '';
      
      // Show success toast
      showToast('✅ Task started successfully!', 'success');
      
      // Immediately add task to list and open details (don't wait for loadTasks)
      const newTask = {
        task_id: data.task_id,
        status: 'running',
        prompt: prompt,
        config: config,
        created_at: new Date().toISOString(),
        completed_at: null,
        iterations: 0,
        total_cost: 0.0,
        history: []
      };
      
      console.log('Adding new task to list:', newTask);
      
      // Add to beginning of tasks array
      currentTasks.unshift(newTask);
      console.log('Current tasks count:', currentTasks.length);
      
      // Re-render the task list
      renderTasks();
      console.log('Tasks rendered');
      
      // Open task details immediately to watch it run
      setTimeout(() => {
        console.log('Opening task details for:', data.task_id);
        openTaskDetails(data.task_id);
      }, 100);
    }
  } catch (error) {
    console.error('Failed to start task:', error);
    showToast(`❌ Failed to start task: ${error.message}`, 'error');
  } finally {
    startTaskBtn.disabled = false;
    startTaskBtn.innerHTML = '<i class="fas fa-play"></i> Start Task';
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  };
  
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    font-weight: 500;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    max-width: 400px;
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Task action functions
async function cancelTask(taskId) {
  if (!confirm('Are you sure you want to cancel this task?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}/cancel`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to cancel task');
    }
    
    // Stop any active stream for this task
    if (activeStreams.has(taskId)) {
      activeStreams.get(taskId).close();
      activeStreams.delete(taskId);
    }
    
    showToast('⛔ Task cancelled successfully', 'success');
    
    // Force immediate refresh to show cancelled status
    await loadTasks();
    
    // If modal is open for this task, close it
    if (modalBody.dataset.currentTaskId === taskId) {
      closeModal();
    }
    
    // Refresh again after a short delay to ensure backend has updated
    setTimeout(() => loadTasks(), 500);
  } catch (error) {
    console.error('Failed to cancel task:', error);
    showToast(`❌ Failed to cancel task: ${error.message}`, 'error');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete task');
    }
    
    showToast('✅ Task deleted successfully', 'success');
    closeModal();
    await loadTasks();
  } catch (error) {
    console.error('Failed to delete task:', error);
    showToast(`❌ Failed to delete task: ${error.message}`, 'error');
  }
}

async function retryTask(taskId) {
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}/retry`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to retry task');
    }
    
    const data = await response.json();
    showToast('✅ Task retry started successfully', 'success');
    closeModal();
    await loadTasks();
    
    // Optionally open the new task's details
    setTimeout(() => openTaskDetails(data.task_id), 500);
  } catch (error) {
    console.error('Failed to retry task:', error);
    showToast(`❌ Failed to retry task: ${error.message}`, 'error');
  }
}

// Make functions globally accessible
window.cancelTask = cancelTask;
window.deleteTask = deleteTask;
window.retryTask = retryTask;

// Open task details modal
async function openTaskDetails(taskId) {
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`);
    const task = await response.json();
    
    modalTitle.innerHTML = `
      <i class="fas fa-tasks"></i>
      <span style="max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${escapeHtml(task.prompt)}
      </span>
    `;
    
    // Track current task ID in modal
    modalBody.dataset.currentTaskId = taskId;
    
    // Render enhanced task details
    // Extract system prompt from start event if available
    const startEvent = (task.history || []).find(h => h.event === 'start');
    const taskSystemPrompt = startEvent?.data?.system_prompt || task.config?.system_prompt || null;
    
    modalBody.innerHTML = `
      <div class="task-detail-container">
        <!-- Task Header with Stats (All 6 in one row) -->
        <div class="task-header-stats">
          <div class="task-stat-card ${getStatusClass(task.status)}">
            <div class="stat-icon-large">
              ${getStatusIcon(task.status)}
            </div>
            <div class="stat-info">
              <div class="stat-label">Status</div>
              <div class="stat-value" style="font-size: 13px;">${getStatusText(task.status)}</div>
            </div>
          </div>
          
          <div class="task-stat-card">
            <div class="stat-icon-large" style="background: rgba(147, 51, 234, 0.1); color: #9333ea;">
              <i class="fas fa-brain"></i>
            </div>
            <div class="stat-info">
              <div class="stat-label">Model</div>
              <div class="stat-value" style="font-size: 13px;">${task.config.model.replace('gemini-', '').replace('-lite', '-L')}</div>
            </div>
          </div>
          
          <div class="task-stat-card">
            <div class="stat-icon-large" style="background: rgba(234, 179, 8, 0.1); color: #ffd700;">
              <i class="fas fa-dollar-sign"></i>
            </div>
            <div class="stat-info">
              <div class="stat-label">Cost</div>
              <div class="stat-value" style="font-size: 13px;">$${task.total_cost.toFixed(4)}</div>
            </div>
          </div>
          
          <div class="task-stat-card">
            <div class="stat-icon-large" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
              <i class="fas fa-sync"></i>
            </div>
            <div class="stat-info">
              <div class="stat-label">Iterations</div>
              <div class="stat-value" style="font-size: 13px;">${task.iterations}/${task.config.max_iterations}</div>
            </div>
          </div>

          <div class="task-stat-card">
            <div class="stat-icon-large" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="stat-info">
              <div class="stat-label">Started</div>
              <div class="stat-value" style="font-size: 11px;">${formatDateTime(task.created_at)}</div>
            </div>
          </div>

          <div class="task-stat-card">
            <div class="stat-icon-large" style="background: rgba(236, 72, 153, 0.1); color: #ec4899;">
              <i class="fas fa-hourglass-half"></i>
            </div>
            <div class="stat-info">
              <div class="stat-label">Duration</div>
              <div class="stat-value" style="font-size: 13px;">${getExecutionDuration(task.created_at, task.completed_at)}</div>
            </div>
          </div>
        </div>
        
        <!-- Task ID Badge -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 215, 0, 0.15); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-fingerprint" style="color: #94a3b8;"></i>
          <span style="color: #64748b; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Task ID:</span>
          <code style="color: #e2e8f0; font-size: 12px; font-family: 'Courier New', monospace; background: rgba(0, 0, 0, 0.3); padding: 4px 8px; border-radius: 4px;">${task.task_id}</code>
          <button onclick="navigator.clipboard.writeText('${task.task_id}'); showToast('📋 Task ID copied!', 'success');" style="margin-left: auto; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        
        <!-- System Prompt Section (Collapsed) -->
        ${taskSystemPrompt ? `
        <div class="task-config-section">
          <div onclick="const c=document.getElementById('sysprompt-${task.task_id}'); const ch=document.getElementById('sysprompt-chevron-${task.task_id}'); c.style.display = c.style.display === 'none' ? 'block' : 'none'; ch.style.transform = c.style.display === 'none' ? 'rotate(-90deg)' : 'rotate(0deg)';" style="cursor: pointer; user-select: none; display: flex; align-items: center; padding: 10px 14px; background: rgba(236, 72, 153, 0.06); border: 1px solid rgba(236, 72, 153, 0.15); border-radius: 8px; margin-bottom: 8px;">
            <i class="fas fa-robot" style="color: #ec4899; margin-right: 8px;"></i>
            <span style="font-weight: 600; color: #e2e8f0; font-size: 13px;">System Prompt</span>
            <span style="margin-left: auto; font-size: 11px; color: #64748b; margin-right: 8px;">${taskSystemPrompt.length.toLocaleString()} chars</span>
            <i class="fas fa-chevron-right" id="sysprompt-chevron-${task.task_id}" style="transition: transform 0.3s ease; color: #94a3b8; font-size: 10px; transform: rotate(-90deg);"></i>
          </div>
          <div id="sysprompt-${task.task_id}" style="display: none;">
            <pre style="background: #0a0e1a; padding: 12px; border-radius: 6px; color: #94a3b8; font-family: 'Courier New', monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; max-height: 400px; overflow-y: auto; margin-bottom: 12px; border: 1px solid rgba(236, 72, 153, 0.1);">${escapeHtml(taskSystemPrompt)}</pre>
          </div>
        </div>
        ` : ''}
        
        <!-- Task Configuration Card (Collapsed) -->
        <div class="task-config-section">
          <div class="config-header" onclick="toggleTaskConfig('${task.task_id}')" style="cursor: pointer; user-select: none; display: flex; align-items: center; padding: 10px 14px; background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.15); border-radius: 8px; margin-bottom: 8px;">
            <i class="fas fa-cog" style="color: #ffd700; margin-right: 8px;"></i>
            <span style="font-weight: 600; color: #e2e8f0; font-size: 13px;">Task Configuration</span>
            <i class="fas fa-chevron-right" id="config-chevron-${task.task_id}" style="margin-left: auto; transition: transform 0.3s ease; color: #94a3b8; font-size: 10px; transform: rotate(-90deg);"></i>
          </div>
          
          <div class="config-content" id="config-${task.task_id}" style="display: none;">
            <!-- Model Settings -->
            <div class="config-card">
              <div class="config-card-header">
                <i class="fas fa-brain" style="color: #9333ea;"></i>
                <span>Model Settings</span>
              </div>
              <div class="config-grid">
                <div class="config-item">
                  <span class="config-label">Model:</span>
                  <span class="config-value">${task.config.model}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">Max Iterations:</span>
                  <span class="config-value">${task.config.max_iterations}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">Temperature:</span>
                  <span class="config-value">${task.config.temperature || 0.7}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">Max Cost:</span>
                  <span class="config-value">$${task.config.max_cost_per_task || 10}</span>
                </div>
              </div>
            </div>
            
            <!-- Enabled Tools (grouped by category) -->
            <div class="config-card">
              <div class="config-card-header">
                <i class="fas fa-toolbox" style="color: #3b82f6;"></i>
                <span>Enabled Tools (${(task.config.enabled_tools || []).length})</span>
              </div>
              <div class="tools-grid">
                ${(task.config.enabled_tools || []).map(tool => `
                  <div class="tool-badge">
                    <i class="${getToolIcon(tool)}" style="color: #10b981; font-size: 10px;"></i>
                    ${tool}
                  </div>
                `).join('')}
              </div>
            </div>
            
            <!-- Context Summarization -->
            ${task.config.enable_context_summarization ? `
              <div class="config-card">
                <div class="config-card-header">
                  <i class="fas fa-compress-alt" style="color: #f59e0b;"></i>
                  <span>Context Summarization</span>
                </div>
                <div class="config-grid">
                  <div class="config-item">
                    <span class="config-label">Enabled:</span>
                    <span class="config-value"><i class="fas fa-check" style="color: #10b981;"></i> Yes</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Token Threshold:</span>
                    <span class="config-value">${task.config.context_summarization?.token_threshold || 100000}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Target Tokens:</span>
                    <span class="config-value">${task.config.context_summarization?.target_token_count || 50000}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Model:</span>
                    <span class="config-value">${task.config.context_summarization?.model || 'gemini-2.5-flash'}</span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Task Prompt Card -->
        <div class="task-prompt-card">
          <div class="card-header">
            <i class="fas fa-edit"></i>
            <span>Task Prompt</span>
          </div>
          <div class="card-content">
            ${escapeHtml(task.prompt)}
          </div>
        </div>
        
        <!-- Timeline Header (Collapsible) -->
        <div class="timeline-header" onclick="toggleTimeline('${task.task_id}')" style="cursor: pointer; user-select: none;">
          <i class="fas fa-history"></i>
          <span>Execution Timeline</span>
          <div class="timeline-badge">${(task.history || []).length} events</div>
          <i class="fas fa-chevron-down" id="timeline-chevron-${task.task_id}" style="margin-left: auto; transition: transform 0.3s ease;"></i>
        </div>
        
        <!-- Timeline Container (Collapsible, not scrollable) -->
        <div class="timeline-container" id="timeline-${task.task_id}" style="display: block;">
          ${renderEnhancedHistory(task.history || [])}
        </div>
        
        ${task.status === 'running' ? `
          <div class="timeline-item running-indicator">
            <div class="timeline-dot pulsing"></div>
            <div class="timeline-card running-card">
              <div class="spinner-large"></div>
              <div style="margin-left: 16px;">
                <div style="font-weight: 600; color: #ffd700; margin-bottom: 4px;">Task Running...</div>
                <div style="color: #94a3b8; font-size: 13px;">Watching for updates in real-time</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${task.result && task.status !== 'running' ? `
          <div class="result-card ${task.status === 'complete' ? 'success' : 'error'}">
            <div class="card-header">
              <i class="fas fa-${task.status === 'complete' ? 'check-circle' : 'exclamation-triangle'}"></i>
              <span>Final Result</span>
            </div>
            <div class="card-content">
              <pre>${JSON.stringify(task.result, null, 2)}</pre>
            </div>
          </div>
        ` : ''}

        <!-- Task Actions -->
        <div class="task-actions">
          ${task.status === 'running' ? `
            <button class="action-btn cancel-btn" onclick="cancelTask('${task.task_id}')">
              <i class="fas fa-ban"></i>
              Cancel Task
            </button>
          ` : `
            <button class="action-btn retry-btn" onclick="retryTask('${task.task_id}')">
              <i class="fas fa-redo"></i>
              Retry Task
            </button>
            <button class="action-btn delete-btn" onclick="deleteTask('${task.task_id}')">
              <i class="fas fa-trash"></i>
              Delete Task
            </button>
          `}
        </div>
      </div>
    `;
    
    taskModal.classList.add('show');
    
    // Auto-scroll to bottom
    const timeline = document.getElementById('historyContainer');
    if (timeline) {
      setTimeout(() => timeline.scrollTop = timeline.scrollHeight, 100);
    }
    
    // Set up live streaming if task is running
    if (task.status === 'running') {
      streamTaskUpdates(taskId);
    }
  } catch (error) {
    console.error('Failed to load task details:', error);
    showToast('❌ Failed to load task details', 'error');
  }
}

// Helper functions for status display
function getStatusClass(status) {
  const classes = {
    'running': 'status-running',
    'complete': 'status-success',
    'error': 'status-error',
    'failed': 'status-error',
    'cancelled': 'status-warning',
    'max_iterations': 'status-warning'
  };
  return classes[status] || '';
}

function getStatusIcon(status) {
  const icons = {
    'running': '<i class="fas fa-spinner fa-spin"></i>',
    'complete': '<i class="fas fa-check-circle"></i>',
    'error': '<i class="fas fa-exclamation-circle"></i>',
    'failed': '<i class="fas fa-times-circle"></i>',
    'cancelled': '<i class="fas fa-ban"></i>',
    'max_iterations': '<i class="fas fa-clock"></i>'
  };
  return icons[status] || '<i class="fas fa-info-circle"></i>';
}

function getStatusText(status) {
  const texts = {
    'running': 'Running',
    'complete': 'Complete',
    'error': 'Error',
    'failed': 'Failed',
    'cancelled': 'Cancelled',
    'max_iterations': 'Max Iterations'
  };
  return texts[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// Toggle timeline visibility
function toggleTimeline(taskId) {
  const timeline = document.getElementById(`timeline-${taskId}`);
  const chevron = document.getElementById(`timeline-chevron-${taskId}`);
  
  if (timeline.style.display === 'none') {
    timeline.style.display = 'block';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    timeline.style.display = 'none';
    chevron.style.transform = 'rotate(-90deg)';
  }
}

// Toggle task config visibility
function toggleTaskConfig(taskId) {
  const config = document.getElementById(`config-${taskId}`);
  const chevron = document.getElementById(`config-chevron-${taskId}`);
  
  if (config.style.display === 'none') {
    config.style.display = 'block';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    config.style.display = 'none';
    chevron.style.transform = 'rotate(-90deg)';
  }
}

// Make toggle functions globally accessible
window.toggleTimeline = toggleTimeline;
window.toggleTaskConfig = toggleTaskConfig;

// Stream task updates via SSE
function streamTaskUpdates(taskId) {
  // Close existing stream if any
  if (activeStreams.has(taskId)) {
    activeStreams.get(taskId).close();
  }
  
  const eventSource = new EventSource(`${API_URL}/api/tasks/${taskId}/stream`);
  activeStreams.set(taskId, eventSource);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.event === 'done') {
      eventSource.close();
      activeStreams.delete(taskId);
      // Reload task details
      openTaskDetails(taskId);
      return;
    }
    
    // Update timeline in real-time
    const historyContainer = document.getElementById(`timeline-${taskId}`);
    if (historyContainer) {
      if (data.event === 'iteration') {
        // Create a new iteration group
        const iterNum = data.data?.number || '?';
        const groupDiv = document.createElement('div');
        groupDiv.className = 'iteration-group';
        groupDiv.id = `iter-group-${taskId}-${iterNum}`;
        groupDiv.innerHTML = `
          <div class="iteration-group-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <i class="fas fa-chevron-down iteration-chevron"></i>
            <span class="iteration-label">Iteration ${iterNum}</span>
            <span class="iteration-event-count" id="iter-count-${taskId}-${iterNum}">0 actions</span>
          </div>
          <div class="iteration-group-body"></div>
        `;
        historyContainer.appendChild(groupDiv);
      } else {
        // Find the last iteration group body and append to it
        const lastGroupBody = historyContainer.querySelector('.iteration-group:last-child .iteration-group-body');
        if (lastGroupBody) {
          lastGroupBody.insertAdjacentHTML('beforeend', renderEnhancedHistoryItem(data));
          // Update action count
          const actionCount = lastGroupBody.querySelectorAll('.timeline-dot.action').length;
          const countEl = lastGroupBody.closest('.iteration-group').querySelector('.iteration-event-count');
          if (countEl) countEl.textContent = `${actionCount} action${actionCount !== 1 ? 's' : ''}`;
        } else {
          // No iteration group yet (pre-iteration events like start)
          historyContainer.insertAdjacentHTML('beforeend', renderEnhancedHistoryItem(data));
        }
      }
    }
  };
  
  eventSource.onerror = () => {
    eventSource.close();
    activeStreams.delete(taskId);
  };
}

// Render enhanced execution timeline
function renderEnhancedHistory(history) {
  if (history.length === 0) {
    return `
      <div class="empty-timeline">
        <i class="fas fa-inbox"></i>
        <div>No events yet</div>
      </div>
    `;
  }
  
  // Group events by iteration
  const iterations = [];
  let currentIteration = { number: 0, events: [] };
  
  for (const item of history) {
    if (item.event === 'iteration') {
      if (currentIteration.events.length > 0) {
        iterations.push(currentIteration);
      }
      currentIteration = { number: item.data?.number || 0, events: [] };
    } else {
      currentIteration.events.push(item);
    }
  }
  if (currentIteration.events.length > 0) {
    iterations.push(currentIteration);
  }
  
  return iterations.map(iter => {
    if (iter.number === 0) {
      // Pre-iteration events (start, etc.)
      return iter.events.map(renderEnhancedHistoryItem).join('');
    }
    const iterEvents = iter.events.map(renderEnhancedHistoryItem).join('');
    return `
      <div class="iteration-group" style="margin-bottom: 8px;">
        <div class="iteration-group-header" onclick="this.parentElement.classList.toggle('collapsed')" style="cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 6px; margin-bottom: 4px;">
          <i class="fas fa-chevron-down iteration-chevron" style="color: #3b82f6; font-size: 10px; transition: transform 0.2s;"></i>
          <span style="font-weight: 600; font-size: 12px; color: #3b82f6;">Iteration ${iter.number}</span>
          <span style="font-size: 11px; color: #64748b; margin-left: auto;">${iter.events.filter(e => e.event === 'action').length} actions</span>
        </div>
        <div class="iteration-group-body" style="padding-left: 8px;">
          ${iterEvents}
        </div>
      </div>
    `;
  }).join('');
}

// Render a pretty view of tool parameters instead of raw JSON
function renderToolParamsPretty(toolName, params) {
  if (!params || Object.keys(params).length === 0) return '<span style="color: #64748b; font-style: italic;">No parameters</span>';
  
  // Special rendering for plan_task
  if (toolName === 'plan_task') {
    const goal = params.goal || params.task || '';
    const steps = params.steps || [];
    return `
      <div style="margin-top: 8px;">
        <div style="margin-bottom: 8px;">
          <span style="color: #94a3b8; font-size: 11px; font-weight: 600;">GOAL</span>
          <div style="color: #e2e8f0; margin-top: 4px; padding: 8px; background: rgba(245, 158, 11, 0.08); border-left: 2px solid #f59e0b; border-radius: 4px; font-size: 13px;">${escapeHtml(String(goal))}</div>
        </div>
        ${Array.isArray(steps) && steps.length > 0 ? `
          <div>
            <span style="color: #94a3b8; font-size: 11px; font-weight: 600;">STEPS</span>
            <div style="margin-top: 4px;">
              ${steps.map((step, i) => {
                const desc = typeof step === 'string' ? step : (step.description || JSON.stringify(step));
                const num = typeof step === 'object' ? (step.step_number || i + 1) : i + 1;
                return `<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; margin-bottom: 2px; background: rgba(15, 23, 42, 0.4); border-radius: 4px;">
                  <span style="color: #f59e0b; font-weight: 600; font-size: 12px; min-width: 20px;">${num}.</span>
                  <span style="color: #e2e8f0; font-size: 12px;">${escapeHtml(String(desc))}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Special rendering for mark_step_complete
  if (toolName === 'mark_step_complete') {
    return `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
        ${params.plan_id ? `<div style="padding: 4px 10px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; font-size: 11px; color: #a78bfa;">Plan: ${escapeHtml(String(params.plan_id).substring(0, 8))}</div>` : ''}
        ${params.step_number ? `<div style="padding: 4px 10px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; font-size: 11px; color: #60a5fa;">Step #${params.step_number}</div>` : ''}
        ${params.status ? `<div style="padding: 4px 10px; background: ${params.status === 'complete' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${params.status === 'complete' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; border-radius: 12px; font-size: 11px; color: ${params.status === 'complete' ? '#34d399' : '#fbbf24'};">${params.status === 'complete' ? '✅' : '🔄'} ${escapeHtml(String(params.status))}</div>` : ''}
        ${params.notes ? `<div style="width: 100%; color: #94a3b8; font-size: 12px; margin-top: 4px; padding: 6px 8px; background: rgba(15, 23, 42, 0.4); border-radius: 4px;">${escapeHtml(String(params.notes))}</div>` : ''}
      </div>
    `;
  }
  
  // Special rendering for read_file / write_file / delete_file
  if (['read_file', 'write_file', 'delete_file'].includes(toolName)) {
    return `
      <div style="margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(59, 130, 246, 0.08); border-radius: 4px; margin-bottom: 4px;">
          <i class="fas fa-file" style="color: #60a5fa; font-size: 11px;"></i>
          <code style="color: #93c5fd; font-size: 12px;">${escapeHtml(String(params.path || ''))}</code>
          ${params.mode ? `<span style="margin-left: auto; font-size: 10px; padding: 2px 8px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-radius: 8px;">${escapeHtml(String(params.mode))}</span>` : ''}
        </div>
        ${params.content ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${params.content.length.toLocaleString()} chars of content</div>` : ''}
      </div>
    `;
  }
  
  // Special rendering for validate_lesson
  if (toolName === 'validate_lesson') {
    return `
      <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(16, 185, 129, 0.08); border-radius: 4px;">
        <i class="fas fa-check-circle" style="color: #10b981; font-size: 11px;"></i>
        <code style="color: #6ee7b7; font-size: 12px;">${escapeHtml(String(params.lesson_path || ''))}</code>
      </div>
    `;
  }
  
  // Special rendering for list_directory
  if (toolName === 'list_directory') {
    return `
      <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(59, 130, 246, 0.08); border-radius: 4px;">
        <i class="fas fa-folder-open" style="color: #60a5fa; font-size: 11px;"></i>
        <code style="color: #93c5fd; font-size: 12px;">${escapeHtml(String(params.path || '.'))}</code>
        ${params.pattern ? `<span style="margin-left: auto; font-size: 10px; color: #94a3b8;">filter: ${escapeHtml(String(params.pattern))}</span>` : ''}
      </div>
    `;
  }
  
  // Default: key-value pairs
  return `
    <div style="margin-top: 8px;">
      ${Object.entries(params).map(([key, value]) => {
        const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const isLong = displayVal.length > 200;
        return `
          <div style="margin-bottom: 4px; display: flex; gap: 8px; align-items: flex-start;">
            <span style="color: #94a3b8; font-size: 11px; font-weight: 600; min-width: 80px; text-transform: uppercase;">${escapeHtml(key)}</span>
            <span style="color: #e2e8f0; font-size: 12px; word-break: break-all;">${isLong ? escapeHtml(displayVal.substring(0, 200)) + '…' : escapeHtml(displayVal)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Render nice observation results
function renderObservationPretty(data) {
  const result = data.result || data;
  if (!result || typeof result !== 'object') return null;
  
  // Plan task result
  if (result.plan_id && result.plan) {
    const plan = result.plan;
    return `
      <div style="margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <i class="fas fa-project-diagram" style="color: #f59e0b;"></i>
          <span style="font-weight: 600; color: #fbbf24; font-size: 13px;">Plan Created</span>
          <code style="font-size: 10px; color: #64748b; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${escapeHtml(String(plan.plan_id).substring(0, 8))}</code>
        </div>
        <div style="padding: 8px; background: rgba(245, 158, 11, 0.06); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.1);">
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">GOAL: <span style="color: #e2e8f0;">${escapeHtml(String(plan.goal || ''))}</span></div>
          ${(plan.steps || []).map(step => {
            const statusIcon = step.status === 'complete' ? '✅' : step.status === 'in_progress' ? '🔄' : '⬜';
            const statusColor = step.status === 'complete' ? '#34d399' : step.status === 'in_progress' ? '#fbbf24' : '#64748b';
            return `<div style="display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
              <span style="font-size: 12px;">${statusIcon}</span>
              <span style="color: ${statusColor}; font-size: 11px; font-weight: 600; min-width: 16px;">${step.step_number}.</span>
              <span style="color: #e2e8f0; font-size: 12px; flex: 1;">${escapeHtml(String(step.description || ''))}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // Mark step complete result
  if (result.plan_id && result.step_number !== undefined && result.new_status) {
    return `
      <div style="margin-top: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
        <span style="font-size: 12px;">${result.new_status === 'complete' ? '✅' : '🔄'}</span>
        <span style="color: #e2e8f0; font-size: 12px;">Step ${result.step_number} → <strong style="color: ${result.new_status === 'complete' ? '#34d399' : '#fbbf24'};">${result.new_status}</strong></span>
        <span style="color: #64748b; font-size: 11px;">${escapeHtml(String(result.progress || ''))}</span>
      </div>
    `;
  }
  
  // File operation results
  if (result.success !== undefined && result.path) {
    const icon = result.success ? 'fa-check-circle' : 'fa-times-circle';
    const color = result.success ? '#10b981' : '#ef4444';
    return `
      <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: ${result.success ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)'}; border-radius: 4px;">
        <i class="fas ${icon}" style="color: ${color};"></i>
        <code style="color: #93c5fd; font-size: 12px;">${escapeHtml(String(result.path || '').replace(/.*\/lessons\//, ''))}</code>
        ${result.size ? `<span style="margin-left: auto; font-size: 10px; color: #64748b;">${result.size.toLocaleString()} bytes</span>` : ''}
        ${result.mode ? `<span style="font-size: 10px; color: #fbbf24; padding: 1px 6px; background: rgba(245, 158, 11, 0.1); border-radius: 6px;">${result.mode}</span>` : ''}
      </div>
    `;
  }
  
  // Validation results
  if (result.valid !== undefined) {
    return `
      <div style="margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <i class="fas ${result.valid ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${result.valid ? '#10b981' : '#ef4444'};"></i>
          <span style="color: ${result.valid ? '#34d399' : '#f87171'}; font-weight: 600; font-size: 13px;">${result.valid ? 'Valid' : 'Invalid'}</span>
          ${result.lesson_id ? `<code style="font-size: 10px; color: #64748b;">${escapeHtml(String(result.lesson_id))}</code>` : ''}
        </div>
        ${(result.errors || []).length > 0 ? `<div style="margin-top: 4px;">${result.errors.map(e => `<div style="color: #f87171; font-size: 12px; padding: 2px 0;">❌ ${escapeHtml(String(e))}</div>`).join('')}</div>` : ''}
        ${(result.warnings || []).length > 0 ? `<div style="margin-top: 4px;">${result.warnings.map(w => `<div style="color: #fbbf24; font-size: 12px; padding: 2px 0;">⚠️ ${escapeHtml(String(w))}</div>`).join('')}</div>` : ''}
      </div>
    `;
  }
  
  // Directory listing
  if (result.items && Array.isArray(result.items)) {
    const items = result.items;
    return `
      <div style="margin-top: 8px;">
        <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${items.length} items in directory</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 200px; overflow-y: auto;">
          ${items.map(item => `<span style="font-size: 11px; padding: 2px 8px; background: rgba(59, 130, 246, 0.08); border-radius: 4px; color: #93c5fd; font-family: monospace;">${escapeHtml(String(item))}</span>`).join('')}
        </div>
      </div>
    `;
  }
  
  return null; // Fall through to raw display
}

function renderEnhancedHistoryItem(item) {
  const eventType = item.event;
  const data = item.data || {};
  const ts = item.timestamp;
  let timestamp = '';
  if (ts) {
    let d = new Date(ts);
    if (isNaN(d.getTime()) && !ts.endsWith('Z') && !ts.includes('+')) d = new Date(ts + 'Z');
    timestamp = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  
  let card = '';
  
  switch (eventType) {
    case 'start':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot start"></div>
          <div class="timeline-card">
            <div class="card-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
              <i class="fas fa-play"></i>
            </div>
            <div class="card-body">
              <div class="card-title">Task Started</div>
              <div class="card-text">Maximum ${data.max_iterations} iterations configured</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'iteration':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot iteration"></div>
          <div class="timeline-card iteration-card">
            <div class="iteration-badge">Iteration ${data.number}</div>
          </div>
        </div>
      `;
      break;
      
    case 'thought':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot thought"></div>
          <div class="timeline-card">
            <div class="card-icon" style="background: rgba(168, 85, 247, 0.1); color: #a855f7;">
              <i class="fas fa-brain"></i>
            </div>
            <div class="card-body">
              <div class="card-title">💭 Agent Thinking</div>
              <div class="card-text thought-text">${escapeHtml(data.content)}</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'action':
      const actionId = 'action-' + Math.random().toString(36).substr(2, 9);
      card = `
        <div class="timeline-item">
          <div class="timeline-dot action"></div>
          <div class="timeline-card action-card">
            <div class="card-icon" style="background: rgba(255, 215, 0, 0.1); color: #ffd700;">
              <i class="${getToolIcon(data.tool || '')}"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                🔧 Tool: <code>${escapeHtml(data.tool || '')}</code>
                <button onclick="document.getElementById('${actionId}-raw').style.display = document.getElementById('${actionId}-raw').style.display === 'none' ? 'block' : 'none'; document.getElementById('${actionId}-pretty').style.display = document.getElementById('${actionId}-pretty').style.display === 'none' ? 'block' : 'none';" style="margin-left: auto; font-size: 10px; padding: 2px 8px; background: rgba(148, 163, 184, 0.1); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 4px; color: #94a3b8; cursor: pointer;">
                  <i class="fas fa-code"></i> Raw
                </button>
              </div>
              <div class="card-text">
                <div id="${actionId}-pretty">
                  ${renderToolParamsPretty(data.tool, data.parameters)}
                </div>
                <div id="${actionId}-raw" style="display: none;">
                  <div class="code-block">
                    <div class="code-header">
                      <span>Parameters (JSON)</span>
                      <button class="copy-btn" onclick="copyToClipboard(this, ${JSON.stringify(JSON.stringify(data.parameters || {}))})">
                        <i class="fas fa-copy"></i>
                      </button>
                    </div>
                    <pre>${escapeHtml(JSON.stringify(data.parameters || {}, null, 2))}</pre>
                  </div>
                </div>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'observation':
      const obsId = 'obs-' + Math.random().toString(36).substr(2, 9);
      const resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result || {}, null, 2);
      const prettyObs = renderObservationPretty(data);
      const isVeryLong = (resultStr || '').length > 5000;
      
      card = `
        <div class="timeline-item">
          <div class="timeline-dot observation"></div>
          <div class="timeline-card observation-card">
            <div class="card-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
              <i class="fas fa-eye"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                👁️ Observation
                <button onclick="document.getElementById('${obsId}-raw').style.display = document.getElementById('${obsId}-raw').style.display === 'none' ? 'block' : 'none'; document.getElementById('${obsId}-pretty').style.display = document.getElementById('${obsId}-pretty').style.display === 'none' ? 'block' : 'none';" style="margin-left: auto; font-size: 10px; padding: 2px 8px; background: rgba(148, 163, 184, 0.1); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 4px; color: #94a3b8; cursor: pointer;">
                  <i class="fas fa-code"></i> Raw
                </button>
              </div>
              <div class="card-text">
                ${prettyObs ? `
                  <div id="${obsId}-pretty">${prettyObs}</div>
                  <div id="${obsId}-raw" style="display: none;">
                ` : `
                  <div id="${obsId}-pretty" style="display: none;"></div>
                  <div id="${obsId}-raw">
                `}
                  <div class="code-block">
                    <div class="code-header">
                      <span>Result</span>
                      <button class="copy-btn" onclick="copyToClipboard(this, ${JSON.stringify(resultStr)})">
                        <i class="fas fa-copy"></i>
                      </button>
                    </div>
                    ${isVeryLong ? `
                      <pre id="${obsId}-short">${escapeHtml(resultStr.substring(0, 3000))}<span style="color: #f59e0b; cursor: pointer;" onclick="document.getElementById('${obsId}-short').style.display='none'; document.getElementById('${obsId}-full').style.display='block';">... [${(resultStr.length - 3000).toLocaleString()} more chars — click to expand]</span></pre>
                      <pre id="${obsId}-full" style="display: none;">${escapeHtml(resultStr)}</pre>
                    ` : `
                      <pre>${escapeHtml(resultStr)}</pre>
                    `}
                  </div>
                </div>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'cost_update':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot cost"></div>
          <div class="timeline-card cost-card">
            <div class="card-icon" style="background: rgba(234, 179, 8, 0.1); color: #eab308;">
              <i class="fas fa-coins"></i>
            </div>
            <div class="card-body">
              <div class="card-title">💰 Cost Update</div>
              <div class="card-text">
                <div style="display: flex; gap: 20px; margin-top: 8px;">
                  <div>
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Total Cost</div>
                    <div style="font-size: 18px; font-weight: 600; color: #ffd700;">$${data.total_cost.toFixed(4)}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Input Tokens</div>
                    <div style="font-size: 16px; font-weight: 500;">${data.input_tokens.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Output Tokens</div>
                    <div style="font-size: 16px; font-weight: 500;">${data.output_tokens.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'finish_reflection':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot" style="background: #f59e0b;"></div>
          <div class="timeline-card" style="border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.05);">
            <div class="card-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
              <i class="fas fa-clipboard-check"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="color: #fbbf24;">🎯 Completion Verification</div>
              <div class="card-text" style="font-size: 12px;">
                <div style="margin-bottom: 8px; padding: 8px; background: rgba(245, 158, 11, 0.08); border-radius: 4px; border-left: 2px solid #f59e0b;">
                  <strong style="color: #fbbf24;">Proposed Summary:</strong>
                  <div style="color: #e2e8f0; margin-top: 4px;">${escapeHtml(data.summary || 'Task completion claimed')}</div>
                </div>
                <div style="color: #94a3b8; font-style: italic; font-size: 11px;">
                  <i class="fas fa-shield-alt"></i> Agent prompted to verify task is truly complete before finishing
                </div>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'reflection':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot reflection"></div>
          <div class="timeline-card reflection-card" style="border-left: 3px solid #f59e0b;">
            <div class="card-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
              <i class="fas fa-mirror"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="color: #fbbf24;">🪞 Reflection Point</div>
              <div class="card-text" style="font-size: 12px;">
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                  <div style="padding: 4px 10px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; font-size: 11px; color: #fbbf24;">
                    <i class="fas fa-sync-alt"></i> Iteration ${data.iteration || '?'}
                  </div>
                  <div style="padding: 4px 10px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; font-size: 11px; color: #60a5fa;">
                    ${data.progress_pct || 0}% through budget
                  </div>
                  ${(data.tools_used || []).map(t => `
                    <div style="padding: 4px 10px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; font-size: 11px; color: #a78bfa;">
                      <i class="${getToolIcon(t)}"></i> ${escapeHtml(t)}
                    </div>
                  `).join('')}
                </div>
                <div style="margin-top: 8px; color: #94a3b8; font-style: italic; font-size: 11px;">Agent prompted to reflect on progress and strategy</div>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'context_summarization':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card" style="border-left: 3px solid #6366f1;">
            <div class="card-icon" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">
              <i class="fas fa-compress-alt"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="color: #818cf8;">📦 Context Summarization</div>
              <div class="card-text" style="font-size: 12px; color: #94a3b8;">Compressing conversation context (${data.before_count || '?'} messages)</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'context_summarized':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card" style="border-left: 3px solid #6366f1;">
            <div class="card-icon" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">
              <i class="fas fa-compress"></i>
            </div>
            <div class="card-body">
              <div class="card-title" style="color: #818cf8;">✂️ Context Compressed</div>
              <div class="card-text" style="font-size: 12px; color: #94a3b8;">Reduced to ${data.after_count || '?'} messages</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'complete':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot complete"></div>
          <div class="timeline-card complete-card">
            <div class="card-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="card-body">
              <div class="card-title">✅ Task Complete</div>
              <div class="card-text">${escapeHtml(data.summary || 'Task completed successfully')}</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'error':
      card = `
        <div class="timeline-item">
          <div class="timeline-dot error"></div>
          <div class="timeline-card error-card">
            <div class="card-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
              <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="card-body">
              <div class="card-title">❌ Error Occurred</div>
              <div class="card-text error-text">${escapeHtml(data.error || 'Unknown error')}</div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
      break;
      
    default:
      card = `
        <div class="timeline-item">
          <div class="timeline-dot default"></div>
          <div class="timeline-card">
            <div class="card-icon" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8;">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="card-body">
              <div class="card-title">${eventType.toUpperCase()}</div>
              <div class="card-text">
                <pre>${JSON.stringify(data, null, 2)}</pre>
              </div>
              <div class="card-time">${timestamp}</div>
            </div>
          </div>
        </div>
      `;
  }
  
  return card;
}

// Copy to clipboard function
window.copyToClipboard = function(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    setTimeout(() => {
      icon.className = 'fas fa-copy';
    }, 2000);
  });
};

// Render execution history (old function - keep for compatibility)
function renderHistory(history) {
  return renderEnhancedHistory(history);
}

function renderHistoryItem(item) {
  return renderEnhancedHistoryItem(item);
}

// Close modal
function closeModal() {
  taskModal.classList.remove('show');
  
  // Close any active streams
  activeStreams.forEach(stream => stream.close());
  activeStreams.clear();
}

// Show stats
async function showStats() {
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    const stats = await response.json();
    
    statsBody.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon">
            <i class="fas fa-tasks"></i>
          </div>
          <div>
            <div class="stat-label">Total Tasks</div>
            <div class="stat-value">${stats.total_tasks || 0}</div>
          </div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
              <i class="fas fa-check"></i>
            </div>
            <div>
              <div class="stat-label">Completed</div>
              <div class="stat-value">${stats.completed_tasks || 0}</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">
              <i class="fas fa-times"></i>
            </div>
            <div>
              <div class="stat-label">Failed</div>
              <div class="stat-value">${stats.failed_tasks || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon" style="background: rgba(34, 197, 94, 0.15); color: #22c55e;">
              <i class="fas fa-dollar-sign"></i>
            </div>
            <div>
              <div class="stat-label">Total Cost</div>
              <div class="stat-value">$${(stats.total_cost || 0).toFixed(4)}</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">
              <i class="fas fa-chart-line"></i>
            </div>
            <div>
              <div class="stat-label">Avg Cost</div>
              <div class="stat-value">$${(stats.average_cost || 0).toFixed(4)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    statsModal.classList.add('show');
  } catch (error) {
    console.error('Failed to load stats:', error);
    statsBody.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load statistics</p>';
    statsModal.classList.add('show');
  }
}

// Show config dialog
async function showConfig() {
  try {
    const response = await fetch(`${API_URL}/api/config`);
    const config = await response.json();
    
    // Populate config modal
    configModel.value = config.model;
    configMaxIter.value = config.max_iterations;
    configTemp.value = config.temperature || 0.7;
    configSandbox.checked = config.sandbox_mode || false;
    configMaxCost.value = config.max_cost_per_task || 10.0;
    
    // Show modal
    configModal.classList.add('show');
  } catch (error) {
    console.error('Failed to load config:', error);
    alert('Failed to load configuration');
  }
}

// Save config
async function saveConfig() {
  try {
    const newConfig = {
      model: configModel.value,
      max_iterations: parseInt(configMaxIter.value),
      temperature: parseFloat(configTemp.value),
      sandbox_mode: configSandbox.checked,
      max_cost_per_task: parseFloat(configMaxCost.value)
    };
    
    await fetch(`${API_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    
    await loadConfig();
    closeConfigModal();
    
    // Show success message
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 100px;
      right: 30px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      font-weight: 600;
      z-index: 2000;
      animation: slideIn 0.3s;
    `;
    toast.textContent = '✅ Configuration saved!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  } catch (error) {
    console.error('Failed to save config:', error);
    alert('Failed to save configuration');
  }
}

// Close config modal
function closeConfigModal() {
  configModal.classList.remove('show');
}

// Toolbox functions
async function showToolbox() {
  try {
    const response = await fetch(`${API_URL}/api/tools`);
    const data = await response.json();
    
    if (data.success) {
      renderTools(data.tools);
      toolboxModal.classList.add('show');
    } else {
      throw new Error('Failed to load tools');
    }
  } catch (error) {
    console.error('Failed to load tools:', error);
    alert('Failed to load tools');
  }
}

function renderTools(tools) {
  // Group tools by category
  const categories = {};
  const categoryLabels = {
    'filesystem': { label: 'File System', icon: 'fas fa-folder', color: '#3b82f6' },
    'system': { label: 'System', icon: 'fas fa-terminal', color: '#ef4444' },
    'validation': { label: 'Validation', icon: 'fas fa-check-double', color: '#10b981' },
    'database': { label: 'Database', icon: 'fas fa-database', color: '#8b5cf6' },
    'planning': { label: 'Planning', icon: 'fas fa-project-diagram', color: '#f59e0b' },
    'general': { label: 'General', icon: 'fas fa-wrench', color: '#94a3b8' }
  };
  
  tools.forEach(tool => {
    const cat = tool.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(tool);
  });
  
  let toolIdx = 0;
  toolsList.innerHTML = Object.entries(categories).map(([cat, catTools]) => {
    const catInfo = categoryLabels[cat] || categoryLabels['general'];
    const html = `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255, 215, 0, 0.08); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${catInfo.color};">
          <i class="${catInfo.icon}" style="color: ${catInfo.color};"></i>
          <span style="font-weight: 600; font-size: 13px; color: ${catInfo.color};">${catInfo.label}</span>
          <span style="margin-left: auto; font-size: 11px; color: #64748b;">${catTools.length} tools</span>
        </div>
        ${catTools.map(tool => {
          const idx = toolIdx++;
          return `
            <div class="tool-card" style="margin-left: 12px;">
              <div class="tool-header" onclick="toggleTool(${idx})">
                <div class="tool-header-left">
                  <div class="tool-icon">
                    <i class="${getToolIcon(tool.name)}"></i>
                  </div>
                  <div class="tool-name">${escapeHtml(tool.name)}</div>
                </div>
                <i class="fas fa-chevron-down tool-collapse-icon"></i>
              </div>
              <div class="tool-body" id="tool-${idx}">
                <div class="tool-content">
                  <div class="tool-description">${escapeHtml(tool.description)}</div>
                  ${renderToolParameters(tool)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    return html;
  }).join('');
}

function getToolIcon(toolName) {
  const icons = {
    'read_file': 'fas fa-file-alt',
    'write_file': 'fas fa-file-edit',
    'delete_file': 'fas fa-trash-alt',
    'list_directory': 'fas fa-folder-open',
    'run_command': 'fas fa-terminal',
    'validate_lesson': 'fas fa-check-circle',
    'query_vocabulary': 'fas fa-book',
    'query_lessons': 'fas fa-graduation-cap',
    'load_lesson_to_db': 'fas fa-database',
    'plan_task': 'fas fa-project-diagram',
    'mark_step_complete': 'fas fa-tasks',
    'get_plan_status': 'fas fa-clipboard-check'
  };
  return icons[toolName] || 'fas fa-wrench';
}

function toggleTool(index) {
  const header = document.querySelectorAll('.tool-header')[index];
  const body = document.getElementById(`tool-${index}`);
  
  header.classList.toggle('expanded');
  body.classList.toggle('expanded');
}

function renderToolParameters(tool) {
  if (!tool.parameters || !tool.parameters.properties) {
    return '<div style="color: #64748b; font-style: italic;">No parameters</div>';
  }
  
  const props = tool.parameters.properties;
  const required = tool.parameters.required || [];
  
  const paramsList = Object.entries(props).map(([name, param]) => {
    const isRequired = required.includes(name);
    const type = param.type || 'string';
    const enumValues = param.enum ? ` (${param.enum.join(', ')})` : '';
    
    return `
      <div class="tool-param">
        <div>
          <span class="param-name">${escapeHtml(name)}</span>
          <span class="param-type">${escapeHtml(type)}${escapeHtml(enumValues)}</span>
          ${isRequired ? '<span class="param-required">required</span>' : ''}
        </div>
        ${param.description ? `<div class="param-description">${escapeHtml(param.description)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  return `
    <div class="tool-params-title">Parameters</div>
    ${paramsList}
  `;
}

function closeToolboxModal() {
  toolboxModal.classList.remove('show');
}

// Tools configuration modal
function showToolsConfig() {
  renderToolsConfig();
  toolsConfigModal.classList.add('show');
}

function renderToolsConfig() {
  // Group tools by category
  const categories = {};
  const categoryLabels = {
    'filesystem': { label: 'File System', icon: 'fas fa-folder', color: '#3b82f6' },
    'system': { label: 'System', icon: 'fas fa-terminal', color: '#ef4444' },
    'validation': { label: 'Validation', icon: 'fas fa-check-double', color: '#10b981' },
    'database': { label: 'Database', icon: 'fas fa-database', color: '#8b5cf6' },
    'planning': { label: 'Planning', icon: 'fas fa-project-diagram', color: '#f59e0b' },
    'general': { label: 'General', icon: 'fas fa-wrench', color: '#94a3b8' }
  };
  
  availableTools.forEach(tool => {
    const cat = tool.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(tool);
  });
  
  toolsConfigList.innerHTML = Object.entries(categories).map(([cat, tools]) => {
    const catInfo = categoryLabels[cat] || categoryLabels['general'];
    return `
      <div style="margin-bottom: 16px;">
        <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.cat-chevron').style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(-90deg)' : ''" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255, 215, 0, 0.08); border-radius: 6px; margin-bottom: 4px;">
          <i class="${catInfo.icon}" style="color: ${catInfo.color}; width: 16px;"></i>
          <span style="font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: ${catInfo.color};">${catInfo.label}</span>
          <span style="margin-left: auto; font-size: 11px; color: #64748b;">${tools.length} tools</span>
          <i class="fas fa-chevron-down cat-chevron" style="color: #64748b; font-size: 10px; transition: transform 0.2s;"></i>
        </div>
        <div>
          ${tools.map(tool => `
            <div style="padding: 10px 12px 10px 28px; margin-bottom: 4px; background: rgba(15, 23, 42, 0.4); border-radius: 6px; border-left: 2px solid ${catInfo.color}20;">
              <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                <input 
                  type="checkbox" 
                  value="${escapeHtml(tool.name)}" 
                  ${enabledTools.has(tool.name) ? 'checked' : ''}
                  onchange="toggleToolEnabled('${escapeHtml(tool.name)}')"
                  style="margin-right: 12px; width: 16px; height: 16px; cursor: pointer;"
                />
                <div style="flex: 1;">
                  <div style="color: #e2e8f0; font-weight: 500; margin-bottom: 2px; font-size: 13px;">
                    <i class="${getToolIcon(tool.name)}" style="margin-right: 6px; color: ${catInfo.color};"></i>
                    ${escapeHtml(tool.name)}
                  </div>
                  <div style="color: #64748b; font-size: 12px;">${escapeHtml(tool.description)}</div>
                </div>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Make this available globally for onclick
window.toggleToolEnabled = function(toolName) {
  if (enabledTools.has(toolName)) {
    enabledTools.delete(toolName);
  } else {
    enabledTools.add(toolName);
  }
  updateToolsSummary();
};

function applyToolsConfig() {
  updateToolsSummary();
  toolsConfigModal.classList.remove('show');
}

function closeToolsConfigModal() {
  toolsConfigModal.classList.remove('show');
}

// System Prompt Functions
async function showSystemPromptEditor() {
  try {
    const response = await fetch(`${API_URL}/api/system-prompt`);
    if (!response.ok) throw new Error('Failed to fetch system prompt');
    const data = await response.json();
    
    currentSystemPrompt = data.content;
    if (data.is_default) {
      defaultSystemPrompt = data.content;
    }
    
    systemPromptTextarea.value = currentSystemPrompt;
    systemPromptModal.classList.add('show');
  } catch (error) {
    console.error('Failed to load system prompt:', error);
    showToast('Failed to load system prompt', 'error');
  }
}

async function saveSystemPrompt() {
  try {
    const content = systemPromptTextarea.value;
    
    if (!content.trim()) {
      showToast('System prompt cannot be empty', 'error');
      return;
    }
    
    const response = await fetch(`${API_URL}/api/system-prompt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) throw new Error('Failed to save system prompt');
    
    currentSystemPrompt = content;
    updateSystemPromptPreview();
    showToast('System prompt saved successfully', 'success');
    closeSystemPromptModal();
  } catch (error) {
    console.error('Failed to save system prompt:', error);
    showToast('Failed to save system prompt', 'error');
  }
}

async function resetSystemPrompt() {
  if (!confirm('Are you sure you want to reset the system prompt to default? This cannot be undone.')) {
    return;
  }
  
  try {
    // Load default and save it
    const response = await fetch(`${API_URL}/api/system-prompt`);
    if (!response.ok) throw new Error('Failed to fetch default');
    const data = await response.json();
    
    const defaultPrompt = data.is_default ? data.content : defaultSystemPrompt;
    systemPromptTextarea.value = defaultPrompt;
    
    // Save the default
    await saveSystemPrompt();
  } catch (error) {
    console.error('Failed to reset system prompt:', error);
    showToast('Failed to reset system prompt', 'error');
  }
}

function closeSystemPromptModal() {
  systemPromptModal.classList.remove('show');
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  // Server sends UTC ISO strings - ensure proper parsing
  let date = new Date(timestamp);
  if (isNaN(date.getTime()) && !timestamp.endsWith('Z') && !timestamp.includes('+')) {
    // If no timezone info, assume UTC
    date = new Date(timestamp + 'Z');
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function getExecutionDuration(createdAt, completedAt) {
  if (!createdAt) return 'N/A';
  
  const start = new Date(createdAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const seconds = Math.floor((end - start) / 1000);
  
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Event Listeners Setup
function setupEventListeners() {
  console.log('Setting up event listeners...');
  console.log('Button elements:', { 
    startTaskBtn: !!startTaskBtn, 
    statsBtn: !!statsBtn, 
    toolboxBtn: !!toolboxBtn,
    settingsToggle: !!settingsToggle
  });
  
  startTaskBtn.addEventListener('click', startTask);
  closeModalBtn.addEventListener('click', closeModal);
  
  // Status filter
  statusFilter.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    clearSelection(); // Clear selection when filter changes
    renderTasks();
  });
  
  statsBtn.addEventListener('click', () => {
    console.log('Stats button clicked!');
    showStats();
  });
  
  toolboxBtn.addEventListener('click', () => {
    console.log('Toolbox button clicked!');
    showToolbox();
  });
  
  closeToolboxBtn.addEventListener('click', closeToolboxModal);
  closeStatsBtn.addEventListener('click', () => statsModal.classList.remove('show'));
  closeReadmeBtn.addEventListener('click', () => readmeModal.classList.remove('show'));

  // Settings toggle
  settingsToggle.addEventListener('click', () => {
    console.log('Settings toggle clicked!');
    settingsToggle.classList.toggle('expanded');
    settingsContent.classList.toggle('expanded');
  });

  // YAML Preview toggle
  yamlPreviewToggle.addEventListener('click', () => {
    yamlPreviewToggle.classList.toggle('expanded');
    yamlPreviewContent.classList.toggle('expanded');
  });

  // System prompt preview toggle
  systemPromptPreviewToggle.addEventListener('click', () => {
    const header = systemPromptPreviewToggle;
    const content = systemPromptPreviewContent;
    header.classList.toggle('expanded');
    content.classList.toggle('expanded');
  });

  // Update YAML preview on input changes
  promptInput.addEventListener('input', updateYAMLPreview);
  
  // Prompt history navigation with arrow keys (console-like behavior)
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (promptHistory.length === 0) return;
      
      // Save current draft if at the end
      if (historyIndex === promptHistory.length) {
        currentDraft = promptInput.value;
      }
      
      // Move up in history
      if (historyIndex > 0) {
        historyIndex--;
        promptInput.value = promptHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (promptHistory.length === 0) return;
      
      // Move down in history
      if (historyIndex < promptHistory.length - 1) {
        historyIndex++;
        promptInput.value = promptHistory[historyIndex];
      } else if (historyIndex === promptHistory.length - 1) {
        // Restore draft
        historyIndex = promptHistory.length;
        promptInput.value = currentDraft;
      }
    }
  });
  
  modelSelect.addEventListener('change', () => {
    updateYAMLPreview();
    updateSystemPromptPreview();
  });
  maxIterInput.addEventListener('change', updateYAMLPreview);
  maxCostInput.addEventListener('change', updateYAMLPreview);
  includeReadmeToggle.addEventListener('change', () => {
    updateYAMLPreview();
    updateSystemPromptPreview();
  });

  // Context summarization settings
  enableContextSummarizationToggle.addEventListener('change', updateYAMLPreview);
  contextTokenThreshold.addEventListener('change', updateYAMLPreview);
  contextTargetTokens.addEventListener('change', updateYAMLPreview);
  contextCompressionRatio.addEventListener('change', updateYAMLPreview);
  contextMinMessages.addEventListener('change', updateYAMLPreview);
  contextSummarizationModel.addEventListener('change', updateYAMLPreview);

  // Context summarization collapsible
  contextSummarizationToggle.addEventListener('click', () => {
    const header = contextSummarizationToggle;
    const content = contextSummarizationContent;
    header.classList.toggle('expanded');
    content.classList.toggle('expanded');
  });

  // Tools configuration
  configureToolsBtn.addEventListener('click', showToolsConfig);
  closeToolsConfigBtn.addEventListener('click', closeToolsConfigModal);
  applyToolsConfigBtn.addEventListener('click', applyToolsConfig);

  // System prompt editor
  editSystemPromptBtn.addEventListener('click', showSystemPromptEditor);
  closeSystemPromptBtn.addEventListener('click', closeSystemPromptModal);
  saveSystemPromptBtn.addEventListener('click', saveSystemPrompt);
  resetSystemPromptBtn.addEventListener('click', resetSystemPrompt);

  // View README link
  viewReadmeLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/readme`);
      if (!response.ok) throw new Error('Failed to fetch README');
      const data = await response.json();
      // Simple markdown to HTML conversion
      readmeContent.innerHTML = data.content
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[hpc])/gm, '<p>')
        .replace(/(?<![>])\n/g, '<br>');
      readmeModal.classList.add('show');
    } catch (error) {
      console.error('Failed to load README:', error);
      readmeContent.innerHTML = '<p style="color: #ef4444;">Failed to load README</p>';
      readmeModal.classList.add('show');
    }
  });

  // Close modal on outside click
  taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) {
      closeModal();
    }
  });

  toolboxModal.addEventListener('click', (e) => {
    if (e.target === toolboxModal) {
      closeToolboxModal();
    }
  });

  statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) {
      statsModal.classList.remove('show');
    }
  });

  readmeModal.addEventListener('click', (e) => {
    if (e.target === readmeModal) {
      readmeModal.classList.remove('show');
    }
  });

  toolsConfigModal.addEventListener('click', (e) => {
    if (e.target === toolsConfigModal) {
      closeToolsConfigModal();
    }
  });

  systemPromptModal.addEventListener('click', (e) => {
    if (e.target === systemPromptModal) {
      closeSystemPromptModal();
    }
  });

  // Full system prompt modal
  expandSystemPromptBtn.addEventListener('click', () => {
    fullSystemPromptPreview.textContent = systemPromptPreview.textContent;
    fullSystemPromptModal.classList.add('show');
  });

  closeFullSystemPromptBtn.addEventListener('click', () => {
    fullSystemPromptModal.classList.remove('show');
  });

  fullSystemPromptModal.addEventListener('click', (e) => {
    if (e.target === fullSystemPromptModal) {
      fullSystemPromptModal.classList.remove('show');
    }
  });

  // Profile management
  manageProfilesBtn.addEventListener('click', () => {
    renderProfilesList();
    profileModal.classList.add('show');
  });

  closeProfileBtn.addEventListener('click', () => {
    profileModal.classList.remove('show');
  });

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
      profileModal.classList.remove('show');
    }
  });

  saveProfileBtn.addEventListener('click', saveCurrentProfile);
  
  console.log('Event listeners attached');
}

// Profile Management Functions
function getCurrentSettings() {
  return {
    model: modelSelect.value,
    maxIterations: parseInt(maxIterInput.value),
    maxCost: parseFloat(maxCostInput.value),
    includeReadme: includeReadmeToggle.checked,
    enabledTools: Array.from(enabledTools),
    contextSummarization: {
      enabled: enableContextSummarizationToggle.checked,
      tokenThreshold: parseInt(contextTokenThreshold.value),
      targetTokens: parseInt(contextTargetTokens.value),
      compressionRatio: parseInt(contextCompressionRatio.value),
      minMessages: parseInt(contextMinMessages.value),
      model: contextSummarizationModel.value
    }
  };
}

function applySettings(settings) {
  modelSelect.value = settings.model || 'gemini-2.5-flash';
  maxIterInput.value = settings.maxIterations || 15;
  maxCostInput.value = settings.maxCost || 1.0;
  includeReadmeToggle.checked = settings.includeReadme !== false;
  
  if (settings.enabledTools) {
    enabledTools = new Set(settings.enabledTools);
    updateToolsSummary();
  }
  
  if (settings.contextSummarization) {
    const ctx = settings.contextSummarization;
    enableContextSummarizationToggle.checked = ctx.enabled !== false;
    contextTokenThreshold.value = ctx.tokenThreshold || 100000;
    contextTargetTokens.value = ctx.targetTokens || 50000;
    contextCompressionRatio.value = ctx.compressionRatio || 50;
    contextMinMessages.value = ctx.minMessages || 15;
    contextSummarizationModel.value = ctx.model || 'gemini-2.5-flash';
  }
  
  updateYAMLPreview();
  updateSystemPromptPreview();
}

function saveCurrentProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    showToast('⚠️ Please enter a profile name', 'warning');
    return;
  }
  
  savedProfiles[name] = getCurrentSettings();
  saveProfilesToStorage();
  renderProfilesList();
  newProfileName.value = '';
  showToast('✅ Profile saved successfully', 'success');
}

function loadProfile(name) {
  const profile = savedProfiles[name];
  if (profile) {
    applySettings(profile);
    profileModal.classList.remove('show');
    showToast(`📋 Loaded profile: ${name}`, 'success');
  }
}

function deleteProfile(name) {
  if (confirm(`Delete profile "${name}"?`)) {
    delete savedProfiles[name];
    if (defaultProfileName === name) {
      defaultProfileName = null;
    }
    saveProfilesToStorage();
    renderProfilesList();
    showToast('🗑️ Profile deleted', 'success');
  }
}

function setDefaultProfile(name) {
  if (defaultProfileName === name) {
    // Toggle off — unset default
    defaultProfileName = null;
    showToast('⭐ Default profile cleared', 'info');
  } else {
    defaultProfileName = name;
    showToast(`⭐ "${name}" set as default profile`, 'success');
  }
  saveProfilesToStorage();
  renderProfilesList();
}

function renderProfilesList() {
  const names = Object.keys(savedProfiles);
  
  if (names.length === 0) {
    profilesList.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #64748b; font-size: 13px;">
        <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
        No saved profiles yet
      </div>
    `;
    return;
  }
  
  profilesList.innerHTML = names.map(name => {
    const isDefault = defaultProfileName === name;
    return `
    <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(15, 23, 42, 0.5); border: 1px solid ${isDefault ? 'rgba(250, 204, 21, 0.4)' : 'rgba(139, 92, 246, 0.2)'}; border-radius: 6px;">
      <div style="flex: 1; color: #e2e8f0; font-size: 14px; font-weight: 500;">
        <i class="fas fa-user-circle" style="color: ${isDefault ? '#facc15' : '#a78bfa'}; margin-right: 8px;"></i>
        ${escapeHtml(name)}
        ${isDefault ? '<span style="font-size: 11px; color: #facc15; margin-left: 6px; background: rgba(250, 204, 21, 0.15); padding: 2px 8px; border-radius: 10px;">⭐ Default</span>' : ''}
      </div>
      <button onclick="setDefaultProfile('${escapeHtml(name)}')" style="padding: 6px 12px; background: ${isDefault ? 'rgba(250, 204, 21, 0.2)' : 'rgba(250, 204, 21, 0.1)'}; border: 1px solid rgba(250, 204, 21, ${isDefault ? '0.5' : '0.3'}); color: #facc15; border-radius: 4px; cursor: pointer; font-size: 12px;" title="${isDefault ? 'Remove as default' : 'Set as default'}">
        <i class="fas fa-star"></i> ${isDefault ? 'Unset' : 'Default'}
      </button>
      <button onclick="loadProfile('${escapeHtml(name)}')" style="padding: 6px 12px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); color: #a78bfa; border-radius: 4px; cursor: pointer; font-size: 12px;">
        <i class="fas fa-download"></i> Load
      </button>
      <button onclick="deleteProfile('${escapeHtml(name)}')" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 4px; cursor: pointer; font-size: 12px;">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  }).join('');
}

// Make profile functions globally accessible for onclick handlers
window.loadProfile = loadProfile;
window.deleteProfile = deleteProfile;
window.setDefaultProfile = setDefaultProfile;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - initializing app');
  initDOMElements();
  setupEventListeners();
  init();
});

