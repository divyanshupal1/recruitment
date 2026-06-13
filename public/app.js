// ==========================================================================
// App State & Configuration
// ==========================================================================

const state = {
  apiUrl: '',
  chats: [],
  activeChatId: null,
  activeChat: null,
  messages: [],
  driveData: {},
  activeQuestions: [],
  tagInputsData: {}, // Keeps track of tags in tag inputs { [fieldPath]: string[] }
  isUploading: false,
  isGenerating: false,
};

// DOM Cache
const DOM = {
  apiUrlInput: document.getElementById('api-url-input'),
  saveApiBtn: document.getElementById('btn-save-api'),
  driveSelector: document.getElementById('drive-selector'),
  newChatBtnTop: document.getElementById('btn-new-chat-top'),
  welcomeScreen: document.getElementById('welcome-screen'),
  welcomeCreateBtn: document.getElementById('btn-welcome-create'),
  workspaceActive: document.getElementById('workspace-active'),
  chatPanel: document.getElementById('chat-panel'),
  previewPanel: document.getElementById('preview-panel'),
  activeChatTitle: document.getElementById('active-chat-title'),
  messageFeed: document.getElementById('message-feed'),
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  uploadContentNormal: document.getElementById('upload-content-normal'),
  uploadContentLoading: document.getElementById('upload-content-loading'),
  chatTextInput: document.getElementById('chat-text-input'),
  sendMessageBtn: document.getElementById('btn-send-message'),
  generateDriveBtn: document.getElementById('btn-generate-drive'),
  refreshChatBtn: document.getElementById('btn-refresh-chat'),
  
  // Inline Form (Left Pane)
  qaFormContainer: document.getElementById('qa-form-container'),
  qaRoundNum: document.getElementById('qa-round-num'),
  qaSummary: document.getElementById('qa-summary'),
  qaFields: document.getElementById('qa-fields'),
  qaForm: document.getElementById('dynamic-qa-form'),
  
  // Banners & Stats
  successBanner: document.getElementById('success-banner'),
  exportJsonBtn: document.getElementById('btn-export-json'),
  statCandidates: document.getElementById('stat-candidates'),
  statCompensation: document.getElementById('stat-compensation'),
  statJoining: document.getElementById('stat-joining'),
  
  // Dashboard Badges
  badgeSetup: document.getElementById('badge-setup'),
  badgePosition: document.getElementById('badge-position'),
  badgeEligibility: document.getElementById('badge-eligibility'),
  badgeInterview: document.getElementById('badge-interview'),
  
  // Dashboard Bodies
  specSetupBody: document.getElementById('spec-setup-body'),
  specPositionBody: document.getElementById('spec-position-body'),
  specEligibilityBody: document.getElementById('spec-eligibility-body'),
  specInterviewBody: document.getElementById('spec-interview-body'),
  
};

// ==========================================================================
// Initialization & API Config
// ==========================================================================

function initApp() {
  // Determine API Base URL
  const storedUrl = localStorage.getItem('recruit_agent_api_url');
  if (storedUrl) {
    state.apiUrl = storedUrl;
  } else {
    // Default fallback
    if (window.location.origin && !window.location.origin.startsWith('file://')) {
      state.apiUrl = window.location.origin;
    } else {
      state.apiUrl = 'http://localhost:3000';
    }
  }
  DOM.apiUrlInput.value = state.apiUrl;

  // Bind Events
  DOM.saveApiBtn.addEventListener('click', saveApiUrl);
  DOM.newChatBtnTop.addEventListener('click', handleCreateChat);
  DOM.welcomeCreateBtn.addEventListener('click', handleCreateChat);
  DOM.sendMessageBtn.addEventListener('click', handleSendChatMessage);
  DOM.chatTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendChatMessage();
  });
  DOM.generateDriveBtn.addEventListener('click', triggerDriveGeneration);
  DOM.refreshChatBtn.addEventListener('click', () => {
    if (state.activeChatId) loadChatDetails(state.activeChatId, true);
  });
  DOM.qaForm.addEventListener('submit', handleAnswersSubmit);
  DOM.exportJsonBtn.addEventListener('click', exportJsonToFile);
  
  DOM.driveSelector.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      selectChat(val);
    }
  });

  // Setup Upload Zone Click & Drag
  DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', handleFileSelected);
  
  DOM.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.add('dragover');
  });
  DOM.uploadZone.addEventListener('dragleave', () => {
    DOM.uploadZone.classList.remove('dragover');
  });
  DOM.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  // Load chats list
  loadChatsList();
}

function saveApiUrl() {
  const url = DOM.apiUrlInput.value.trim().replace(/\/$/, '');
  if (url) {
    state.apiUrl = url;
    localStorage.setItem('recruit_agent_api_url', url);
    showToast('API URL Saved!', 'success');
    loadChatsList();
  }
}

// ==========================================================================
// API Helpers
// ==========================================================================

async function apiCall(endpoint, method = 'GET', body = null, isMultipart = false) {
  const url = `${state.apiUrl}${endpoint}`;
  const options = {
    method,
    headers: {},
  };

  if (!isMultipart) {
    options.headers['Content-Type'] = 'application/json';
  }

  if (body) {
    options.body = isMultipart ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `API error (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Call failed [${method} ${endpoint}]:`, error);
    showToast(error.message, 'danger');
    throw error;
  }
}

// ==========================================================================
// Core Operations
// ==========================================================================

async function loadChatsList() {
  try {
    const data = await apiCall('/api/chats');
    state.chats = data.chats || [];
    renderChatsSelector();
  } catch (err) {
    DOM.driveSelector.innerHTML = `<option value="">Failed to fetch drives</option>`;
  }
}

async function handleCreateChat() {
  const title = prompt('Enter a title for the recruitment drive (optional):') || '';
  try {
    const data = await apiCall('/api/chats', 'POST', { title: title.trim() || undefined });
    const newChat = data.chat;
    showToast('Recruitment Drive Created!', 'success');
    await loadChatsList();
    selectChat(newChat.id);
  } catch (err) {
    // Error is toasted inside apiCall
  }
}

function resetWorkspace() {
  state.activeChat = null;
  state.driveData = {};
  state.messages = [];
  state.activeQuestions = [];
  
  // Hide success banner
  DOM.successBanner.classList.add('hidden');
  
  // Reset stats cards
  DOM.statCandidates.textContent = '--';
  DOM.statCompensation.textContent = '--';
  DOM.statJoining.textContent = '--';
  
  // Reset spec sheets to placeholders
  DOM.specSetupBody.innerHTML = `<div class="spec-placeholder">No setup details configured.</div>`;
  DOM.specPositionBody.innerHTML = `<div class="spec-placeholder">No position details configured.</div>`;
  DOM.specEligibilityBody.innerHTML = `<div class="spec-placeholder">No eligibility criteria configured.</div>`;
  DOM.specInterviewBody.innerHTML = `<div class="spec-placeholder">No interview rounds configured.</div>`;
  
  // Reset section badges & indicators
  updateSectionStatus('setup', 'Empty', 'sheet-status', document.getElementById('sheet-setup').querySelector('.check-circle-indicator'), false);
  updateSectionStatus('position', 'Empty', 'sheet-status', document.getElementById('sheet-position').querySelector('.check-circle-indicator'), false);
  updateSectionStatus('eligibility', 'Empty', 'sheet-status', document.getElementById('sheet-eligibility').querySelector('.check-circle-indicator'), false);
  updateSectionStatus('interview', 'Empty', 'sheet-status', document.getElementById('sheet-interview').querySelector('.check-circle-indicator'), false);
  
  // Clear messages feed
  DOM.messageFeed.innerHTML = '';
  
  // Reset Q&A Form
  hideQAForm();
}

async function selectChat(chatId) {
  state.activeChatId = chatId;
  DOM.welcomeScreen.style.display = 'none';
  DOM.workspaceActive.style.display = 'flex';
  
  // Update Selector Dropdown value
  DOM.driveSelector.value = chatId;

  // Reset workspace visuals
  resetWorkspace();

  await loadChatDetails(chatId, true);
}

async function loadChatDetails(chatId, autoTrigger = false) {
  try {
    // Fetch details
    const [detailsData, messagesData] = await Promise.all([
      apiCall(`/api/chats/${chatId}`),
      apiCall(`/api/chats/${chatId}/messages`),
    ]);

    state.activeChat = detailsData.chat;
    state.driveData = detailsData.chat.driveData || {};
    state.messages = messagesData.messages || [];

    renderMessages();
    renderDriveData();
    
    // Check if there are active questions in the last assistant message
    const lastMsg = state.messages[state.messages.length - 1];
    let showForm = false;
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.type === 'questions') {
      const metaQuestions = lastMsg.metadata?.questions;
      if (metaQuestions && metaQuestions.length > 0) {
        showQAForm(metaQuestions, lastMsg.content);
        showForm = true;
      }
    }
    
    if (!showForm) {
      hideQAForm();
      if (autoTrigger && state.activeChat.status === 'active' && state.messages.length > 1) {
        triggerDriveGeneration();
      }
    }
  } catch (err) {
    console.error('Failed to load chat details:', err);
  }
}

// ==========================================================================
// Messaging & Input
// ==========================================================================

async function handleSendChatMessage() {
  const text = DOM.chatTextInput.value.trim();
  if (!text || !state.activeChatId) return;

  DOM.chatTextInput.value = '';
  
  // Append temporary user message for responsive UI
  appendLocalMessage('user', 'text', text);

  try {
    state.isGenerating = true;
    updateInputState();
    
    const response = await apiCall(`/api/chats/${state.activeChatId}/generate`, 'POST', { message: text });
    
    // Refresh chat details completely to synchronize Firestore state
    await loadChatDetails(state.activeChatId);
    
    if (response.type === 'questions') {
      showQAForm(response.questions, response.summary);
    } else {
      hideQAForm();
      showToast('Drive data updated!', 'success');
    }
  } catch (err) {
    // Handled in apiCall
  } finally {
    state.isGenerating = false;
    updateInputState();
  }
}

async function triggerDriveGeneration() {
  if (!state.activeChatId) return;
  
  try {
    state.isGenerating = true;
    updateInputState();
    appendLocalMessage('system', 'text', '🤖 Triggering recruitment drive generation...');

    const response = await apiCall(`/api/chats/${state.activeChatId}/generate`, 'POST', {
      message: "Generate the recruitment drive"
    });

    await loadChatDetails(state.activeChatId);

    if (response.type === 'questions') {
      showQAForm(response.questions, response.summary);
    } else {
      hideQAForm();
      showToast('Recruitment Drive generated successfully!', 'success');
    }
  } catch (err) {
    // Handled
  } finally {
    state.isGenerating = false;
    updateInputState();
  }
}

// ==========================================================================
// File Uploads
// ==========================================================================

function handleFileSelected(e) {
  if (e.target.files.length > 0) {
    uploadFile(e.target.files[0]);
  }
}

async function uploadFile(file) {
  if (!state.activeChatId) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    state.isUploading = true;
    updateUploadZoneState();

    const response = await apiCall(`/api/chats/${state.activeChatId}/files`, 'POST', formData, true);
    
    showToast('File uploaded and parsed successfully!', 'success');
    
    // Automatically fetch updated chat details
    await loadChatDetails(state.activeChatId);

    // If parseWarning is present
    if (response.parseWarning) {
      showToast(`Parse warning: ${response.parseWarning}`, 'warning');
    }

    // Stop upload loading state before triggering drive generation
    state.isUploading = false;
    updateUploadZoneState();

    // Auto generate questions after upload
    await triggerDriveGeneration();

  } catch (err) {
    // Handled
  } finally {
    state.isUploading = false;
    updateUploadZoneState();
    DOM.fileInput.value = ''; // Reset file input
  }
}

// ==========================================================================
// Dynamic Questions Form Builder (QA)
// ==========================================================================

function showQAForm(questions, summary) {
  state.activeQuestions = questions;
  state.tagInputsData = {}; // clear tag inputs state
  DOM.qaSummary.textContent = summary || 'Please clarify these fields to complete the recruitment drive configuration sheet.';
  DOM.qaFields.innerHTML = '';

  questions.forEach(q => {
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'qa-field-group';

    // Label and description
    const labelRow = document.createElement('div');
    labelRow.className = 'qa-label-row';

    const label = document.createElement('label');
    label.className = 'qa-label';
    label.textContent = q.question;
    if (q.required) {
      const req = document.createElement('span');
      req.className = 'qa-req-indicator';
      req.textContent = ' *';
      label.appendChild(req);
    }
    labelRow.appendChild(label);
    fieldGroup.appendChild(labelRow);

    if (q.description) {
      const desc = document.createElement('span');
      desc.className = 'qa-desc';
      desc.textContent = q.description;
      fieldGroup.appendChild(desc);
    }

    if (q.warning) {
      const warn = document.createElement('div');
      warn.className = 'qa-warning-box';
      warn.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> <span>${q.warning}</span>`;
      fieldGroup.appendChild(warn);
    }

    // Input Control based on type
    const inputControl = createInputControl(q);
    fieldGroup.appendChild(inputControl);

    // Append suggestions if any (not tag_input and option elements which handle natively)
    if (q.suggestedOptions && q.suggestedOptions.length > 0 && q.type !== 'tag_input' && q.type !== 'single_select' && q.type !== 'multi_select') {
      const suggestions = renderSuggestions(q.suggestedOptions, q.id);
      fieldGroup.appendChild(suggestions);
    }

    DOM.qaFields.appendChild(fieldGroup);
  });

  lucide.createIcons();
  DOM.qaFormContainer.classList.remove('hidden');
  
  // Smooth scroll left panel to top so user sees the Q&A box immediately
  DOM.previewPanel.scrollTop = 0;
  
  updateInputState();
}

function hideQAForm() {
  DOM.qaFormContainer.classList.add('hidden');
  state.activeQuestions = [];
  state.tagInputsData = {};
  
  updateInputState();
}

function createInputControl(q) {
  const wrapper = document.createElement('div');
  wrapper.className = 'qa-input-wrapper';

  if (q.type === 'text') {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `input-${q.id}`;
    input.className = 'qa-input-text';
    input.name = q.field;
    input.value = q.defaultValue || '';
    if (q.required) input.required = true;
    wrapper.appendChild(input);

  } else if (q.type === 'number') {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `input-${q.id}`;
    input.className = 'qa-input-text';
    input.name = q.field;
    input.value = q.defaultValue || '';
    input.placeholder = 'e.g., 60% or 8.5 CGPA';
    if (q.required) input.required = true;
    wrapper.appendChild(input);

  } else if (q.type === 'date') {
    const input = document.createElement('input');
    input.type = 'date';
    input.id = `input-${q.id}`;
    input.className = 'qa-input-date';
    input.name = q.field;
    input.value = q.defaultValue || '';
    if (q.required) input.required = true;
    wrapper.appendChild(input);

  } else if (q.type === 'toggle') {
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'toggle-switch-wrapper';

    const label = document.createElement('label');
    label.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `input-${q.id}`;
    input.name = q.field;
    input.checked = q.defaultValue === true;

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    label.appendChild(input);
    label.appendChild(slider);

    const labelText = document.createElement('span');
    labelText.className = 'toggle-label-text';
    labelText.textContent = 'Yes';

    input.addEventListener('change', () => {
      labelText.textContent = input.checked ? 'Yes' : 'No';
    });

    labelText.textContent = input.checked ? 'Yes' : 'No';

    toggleWrapper.appendChild(label);
    toggleWrapper.appendChild(labelText);
    wrapper.appendChild(toggleWrapper);

  } else if (q.type === 'single_select') {
    const grid = document.createElement('div');
    grid.className = 'options-cards-grid';

    (q.options || []).forEach((opt, idx) => {
      const inputId = `opt-${q.id}-${idx}`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.id = inputId;
      radio.name = q.field;
      radio.value = opt.value;
      radio.className = 'option-card-input';
      if (q.defaultValue === opt.value || (!q.defaultValue && idx === 0 && q.required)) {
        radio.checked = true;
      }

      const card = document.createElement('label');
      card.className = 'option-card-label';
      card.htmlFor = inputId;

      const title = document.createElement('span');
      title.className = 'opt-title';
      title.textContent = opt.label;

      card.appendChild(title);

      if (opt.description) {
        const desc = document.createElement('span');
        desc.className = 'opt-desc';
        desc.textContent = opt.description;
        card.appendChild(desc);
      }

      grid.appendChild(radio);
      grid.appendChild(card);
    });

    wrapper.appendChild(grid);

  } else if (q.type === 'multi_select') {
    const grid = document.createElement('div');
    grid.className = 'options-cards-grid';

    (q.options || []).forEach((opt, idx) => {
      const inputId = `opt-${q.id}-${idx}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = inputId;
      checkbox.name = q.field;
      checkbox.value = opt.value;
      checkbox.className = 'option-card-input';
      
      const defaults = Array.isArray(q.defaultValue) ? q.defaultValue : [];
      if (defaults.includes(opt.value)) {
        checkbox.checked = true;
      }

      const card = document.createElement('label');
      card.className = 'option-card-label';
      card.htmlFor = inputId;

      const title = document.createElement('span');
      title.className = 'opt-title';
      title.textContent = opt.label;

      card.appendChild(title);

      if (opt.description) {
        const desc = document.createElement('span');
        desc.className = 'opt-desc';
        desc.textContent = opt.description;
        card.appendChild(desc);
      }

      grid.appendChild(checkbox);
      grid.appendChild(card);
    });

    wrapper.appendChild(grid);

  } else if (q.type === 'tag_input') {
    state.tagInputsData[q.field] = Array.isArray(q.defaultValue) ? [...q.defaultValue] : [];
    
    const tagContainer = document.createElement('div');
    tagContainer.className = 'tag-input-container';

    const pillsList = document.createElement('div');
    pillsList.className = 'tags-pills-list';
    pillsList.id = `tags-list-${q.id}`;
    
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'qa-input-text';
    tagInput.placeholder = 'Type and press Enter to add';
    
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = tagInput.value.trim();
        if (value) {
          addTag(q.field, value, pillsList);
          tagInput.value = '';
        }
      }
    });

    tagContainer.appendChild(pillsList);
    tagContainer.appendChild(tagInput);

    if (q.suggestedOptions && q.suggestedOptions.length > 0) {
      const suggestions = renderSuggestions(q.suggestedOptions, q.id, (val) => {
        addTag(q.field, val, pillsList);
      });
      tagContainer.appendChild(suggestions);
    }

    state.tagInputsData[q.field].forEach(val => renderTagPill(q.field, val, pillsList));

    wrapper.appendChild(tagContainer);
  }

  return wrapper;
}

function addTag(fieldPath, value, pillsListEl) {
  if (!state.tagInputsData[fieldPath]) {
    state.tagInputsData[fieldPath] = [];
  }
  if (!state.tagInputsData[fieldPath].includes(value)) {
    state.tagInputsData[fieldPath].push(value);
    renderTagPill(fieldPath, value, pillsListEl);
  }
}

function removeTag(fieldPath, value, pillEl) {
  if (state.tagInputsData[fieldPath]) {
    state.tagInputsData[fieldPath] = state.tagInputsData[fieldPath].filter(v => v !== value);
  }
  pillEl.remove();
}

function renderTagPill(fieldPath, value, containerEl) {
  const pill = document.createElement('span');
  pill.className = 'tag-pill';
  pill.textContent = value;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = `<i data-lucide="x"></i>`;
  btn.addEventListener('click', () => removeTag(fieldPath, value, pill));

  pill.appendChild(btn);
  containerEl.appendChild(pill);
  lucide.createIcons();
}

function renderSuggestions(options, questionId, customClickCallback = null) {
  const box = document.createElement('div');
  box.className = 'suggestions-box';

  const title = document.createElement('span');
  title.className = 'sug-header';
  title.textContent = 'Suggestions:';
  box.appendChild(title);

  const chips = document.createElement('div');
  chips.className = 'sug-chips';

  options.forEach(opt => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sug-chip';
    chip.innerHTML = `<span>${opt}</span> <i data-lucide="plus"></i>`;
    
    chip.addEventListener('click', () => {
      if (customClickCallback) {
        customClickCallback(opt);
      } else {
        const targetInput = document.getElementById(`input-${questionId}`);
        if (targetInput) {
          targetInput.value = opt;
        }
      }
    });

    chips.appendChild(chip);
  });

  box.appendChild(chips);
  return box;
}

function parseNumberFromText(val) {
  if (val === undefined || val === null) return null;
  const cleaned = val.trim();
  if (cleaned === '') return null;
  const match = cleaned.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

async function handleAnswersSubmit(e) {
  e.preventDefault();
  if (!state.activeChatId || state.activeQuestions.length === 0) return;

  const answers = {};

  state.activeQuestions.forEach(q => {
    if (q.type === 'tag_input') {
      const tags = state.tagInputsData[q.field] || [];
      if (q.field === 'setupDetails.preferredYearOfGraduation') {
        answers[q.field] = tags.map(tag => parseNumberFromText(tag)).filter(n => n !== null);
      } else {
        answers[q.field] = tags.length > 0 ? tags : null;
      }
    } else if (q.type === 'single_select') {
      const checked = DOM.qaForm.querySelector(`input[name="${q.field}"]:checked`);
      answers[q.field] = checked ? checked.value : null;
    } else if (q.type === 'multi_select') {
      const checkedBoxes = DOM.qaForm.querySelectorAll(`input[name="${q.field}"]:checked`);
      const values = Array.from(checkedBoxes).map(cb => cb.value);
      answers[q.field] = values.length > 0 ? values : [];
    } else if (q.type === 'toggle') {
      const checkbox = document.getElementById(`input-${q.id}`);
      answers[q.field] = checkbox ? checkbox.checked : false;
    } else {
      const input = document.getElementById(`input-${q.id}`);
      if (input) {
        const val = input.value.trim();
        if (q.type === 'number') {
          answers[q.field] = parseNumberFromText(val);
        } else {
          answers[q.field] = val !== '' ? val : null;
        }
      }
    }
  });

  appendLocalMessage('user', 'text', '📝 Submitted answers to clarifications.');

  try {
    state.isGenerating = true;
    updateInputState();
    hideQAForm();

    const response = await apiCall(`/api/chats/${state.activeChatId}/generate`, 'POST', { answers });

    await loadChatDetails(state.activeChatId);

    if (response.type === 'questions') {
      showQAForm(response.questions, response.summary);
    } else {
      showToast('Drive data configured successfully!', 'success');
    }
  } catch (err) {
    // toasted
  } finally {
    state.isGenerating = false;
    updateInputState();
  }
}

// ==========================================================================
// DOM Rendering Functions
// ==========================================================================

function renderChatsSelector() {
  DOM.driveSelector.innerHTML = '<option value="">Select a recruitment drive...</option>';
  
  if (state.chats.length === 0) {
    return;
  }

  state.chats.forEach(chat => {
    const opt = document.createElement('option');
    opt.value = chat.id;
    opt.textContent = chat.title || 'Untitled Recruitment Drive';
    if (chat.id === state.activeChatId) {
      opt.selected = true;
    }
    DOM.driveSelector.appendChild(opt);
  });
}

function renderMessages() {
  DOM.messageFeed.innerHTML = '';
  if (state.messages.length === 0) {
    DOM.messageFeed.innerHTML = `<div class="chat-list-empty">No conversation history.</div>`;
    return;
  }

  state.messages.forEach(msg => {
    if (msg.type === 'answers' && typeof msg.content === 'string' && msg.content === 'Provided answers') return;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${msg.role}`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    let avatarIcon = 'bot';
    if (msg.role === 'user') {
      avatarIcon = 'user';
    } else if (msg.role === 'system') {
      avatarIcon = 'info';
    }
    avatar.innerHTML = `<i data-lucide="${avatarIcon}"></i>`;
    bubble.appendChild(avatar);

    const wrapper = document.createElement('div');
    wrapper.className = 'msg-wrapper';

    const sender = document.createElement('span');
    sender.className = 'msg-sender';
    sender.textContent = msg.role === 'user' ? 'You' : (msg.role === 'system' ? 'System' : 'Assistant');
    wrapper.appendChild(sender);

    const content = document.createElement('div');
    content.className = 'msg-content';
    content.innerHTML = formatMarkdown(msg.content);
    wrapper.appendChild(content);

    // File info
    if (msg.type === 'file_upload' && msg.metadata?.fileId) {
      const fileCard = document.createElement('div');
      fileCard.className = 'file-card';
      fileCard.innerHTML = `
        <div class="file-icon-box"><i data-lucide="file-text"></i></div>
        <div class="file-info">
          <span class="file-name">${msg.metadata.fileName || 'document'}</span>
          <span class="file-meta">${formatBytes(msg.metadata.fileSize || 0)}</span>
        </div>
      `;
      wrapper.appendChild(fileCard);
    }

    bubble.appendChild(wrapper);
    DOM.messageFeed.appendChild(bubble);
  });

  lucide.createIcons();
  DOM.messageFeed.scrollTop = DOM.messageFeed.scrollHeight;
}

function appendLocalMessage(role, type, content) {
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  const avatarIcon = role === 'user' ? 'user' : (role === 'system' ? 'info' : 'bot');
  avatar.innerHTML = `<i data-lucide="${avatarIcon}"></i>`;
  bubble.appendChild(avatar);

  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper';

  const sender = document.createElement('span');
  sender.className = 'msg-sender';
  sender.textContent = role === 'user' ? 'You' : (role === 'system' ? 'System' : 'Assistant');
  wrapper.appendChild(sender);

  const body = document.createElement('div');
  body.className = 'msg-content';
  body.innerHTML = formatMarkdown(content);
  wrapper.appendChild(body);

  bubble.appendChild(wrapper);
  DOM.messageFeed.appendChild(bubble);
  
  lucide.createIcons();
  DOM.messageFeed.scrollTop = DOM.messageFeed.scrollHeight;
}

function renderDriveData() {
  const dd = state.driveData || {};
  
  // Render completed success banner (screenshot styling)
  const isCompleted = state.activeChat?.status === 'completed';
  DOM.successBanner.classList.toggle('hidden', !isCompleted);

  // Update Stats row details
  updateStatsRow(dd);

  // Update JSON Code block removed

  // Render Visual sections
  renderSetupSection(dd.setupDetails);
  renderPositionSection(dd.positionDetails);
  renderEligibilitySection(dd.eligibilityCriteria);
  renderInterviewSection(dd.interviewConfig);
}

function updateStatsRow(dd) {
  const setup = dd.setupDetails || {};
  const pos = dd.positionDetails || {};

  // 1. Target Candidates
  let candidatesText = 'Freshers';
  if (setup.candidateType === 'experienced') {
    candidatesText = 'Experienced';
  } else if (!setup.candidateType) {
    candidatesText = '--';
  }
  DOM.statCandidates.textContent = candidatesText;

  // 2. Compensation
  let compensationText = 'To be discussed';
  if (pos.salaryType === 'fixed' && pos.salaryFixed) {
    compensationText = `${pos.salaryFixed} Fixed`;
  } else if (pos.salaryType === 'range' && (pos.salaryMin || pos.salaryMax)) {
    compensationText = `${pos.salaryMin || '--'} - ${pos.salaryMax || '--'}`;
  } else if (pos.salaryType === 'not_decided') {
    compensationText = 'To be discussed';
  } else if (!pos.salaryType) {
    compensationText = '--';
  }
  DOM.statCompensation.textContent = compensationText;

  // 3. Joining Date / Timeframe
  let joiningText = '--';
  if (setup.targetJoiningTimeframe?.hasTarget && setup.targetJoiningTimeframe.value) {
    joiningText = setup.targetJoiningTimeframe.value;
  }
  DOM.statJoining.textContent = joiningText;
}

function renderSetupSection(setup) {
  const cardEl = document.getElementById('sheet-setup');
  const checkEl = cardEl.querySelector('.check-circle-indicator');

  if (!setup || Object.keys(setup).length === 0) {
    updateSectionStatus('setup', 'Empty', 'sheet-status', checkEl, false);
    DOM.specSetupBody.innerHTML = `<div class="spec-placeholder">No setup details configured.</div>`;
    return;
  }

  // Completeness check
  const required = [setup.candidateType, setup.positionTitle, setup.numberOfVacancies, setup.driveTitle];
  const filled = required.filter(f => f !== undefined && f !== null);
  const isComplete = filled.length === required.length;
  updateSectionStatus('setup', isComplete ? 'Complete' : 'In Progress', `sheet-status ${isComplete ? 'complete' : 'partial'}`, checkEl, isComplete);

  // Formatted grid
  let html = `<div class="detail-grid">`;
  
  if (setup.driveTitle) {
    html += `<div class="detail-item"><span class="detail-label">Recruitment Drive Title</span><span class="detail-value">${setup.driveTitle}</span></div>`;
  }
  if (setup.positionTitle) {
    html += `<div class="detail-item"><span class="detail-label">Official Job Role Title</span><span class="detail-value">${setup.positionTitle}</span></div>`;
  }
  if (setup.numberOfVacancies !== undefined && setup.numberOfVacancies !== null) {
    html += `<div class="detail-item"><span class="detail-label">Target Vacancies Allocated</span><span class="detail-value">${setup.numberOfVacancies} offers</span></div>`;
  }
  if (setup.candidateType) {
    const label = setup.candidateType === 'fresh_graduates' ? 'Freshers' : 'Experienced Professionals';
    html += `<div class="detail-item"><span class="detail-label">Candidate Eligibility Profile</span><span class="detail-value">${label}</span></div>`;
  }
  if (setup.preferredYearOfGraduation && setup.preferredYearOfGraduation.length > 0) {
    html += `<div class="detail-item"><span class="detail-label">Preferred Completed Graduation Year(s)</span><span class="detail-value">${setup.preferredYearOfGraduation.join(', ')}</span></div>`;
  }
  if (setup.targetJoiningTimeframe?.hasTarget) {
    html += `<div class="detail-item"><span class="detail-label">Target Joining Timeframe</span><span class="detail-value">Specified: ${setup.targetJoiningTimeframe.value || '--'}</span></div>`;
  }

  html += `</div>`;
  DOM.specSetupBody.innerHTML = html;
}

function renderPositionSection(pos) {
  const cardEl = document.getElementById('sheet-position');
  const checkEl = cardEl.querySelector('.check-circle-indicator');

  if (!pos || Object.keys(pos).length === 0) {
    updateSectionStatus('position', 'Empty', 'sheet-status', checkEl, false);
    DOM.specPositionBody.innerHTML = `<div class="spec-placeholder">No position details configured.</div>`;
    return;
  }

  // Completeness check
  const required = [pos.employmentType, pos.locationType, pos.salaryType];
  const filled = required.filter(f => f !== undefined && f !== null);
  const isComplete = filled.length === required.length;
  updateSectionStatus('position', isComplete ? 'Complete' : 'In Progress', `sheet-status ${isComplete ? 'complete' : 'partial'}`, checkEl, isComplete);

  let html = `<div class="detail-grid">`;

  if (pos.employmentType) {
    const labels = { full_time: 'Full Time', internship: 'Internship', full_time_internship: 'Full Time Internship' };
    html += `<div class="detail-item"><span class="detail-label">Employment Contract Type Model</span><span class="detail-value">${labels[pos.employmentType] || pos.employmentType}</span></div>`;
  }
  
  if (pos.locationType && pos.locationType.length > 0) {
    let locText = pos.locationType.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
    let citiesSubtext = '';
    if (pos.locationCities && pos.locationCities.length > 0) {
      citiesSubtext = `<div class="detail-subvalue">Office Hub: ${pos.locationCities.join(', ')}</div>`;
    }
    html += `<div class="detail-item"><span class="detail-label">Workplace Location Arrangement</span><span class="detail-value">${locText}</span>${citiesSubtext}</div>`;
  }

  if (pos.salaryType) {
    let salVal = 'To be discussed';
    if (pos.salaryType === 'fixed') {
      salVal = `Fixed Amount: ${pos.salaryFixed || 'Not specified'}`;
    } else if (pos.salaryType === 'range') {
      salVal = `Range Package: ${pos.salaryMin || '--'} to ${pos.salaryMax || '--'}`;
    }
    
    let breakdownHtml = '';
    if (pos.salaryBreakdown && pos.salaryBreakdown.length > 0) {
      breakdownHtml = `<div class="compensation-breakdown-box">`;
      pos.salaryBreakdown.forEach(item => {
        breakdownHtml += `<span class="breakdown-row">${item.component}: ${item.value}</span>`;
      });
      breakdownHtml += `</div>`;
    }
    
    html += `<div class="detail-item"><span class="detail-label">Offered Compensation Package</span><span class="detail-value">${salVal}</span>${breakdownHtml}</div>`;
  }

  if (pos.probationPeriod) {
    html += `<div class="detail-item"><span class="detail-label">Probation Period Details</span><span class="detail-value">${pos.probationPeriod}</span></div>`;
  }
  if (pos.bondPeriod) {
    const amt = pos.bondAmount ? ` (${pos.bondAmount} Liability)` : '';
    html += `<div class="detail-item"><span class="detail-label">Service Agreement / Bond Liability</span><span class="detail-value">${pos.bondPeriod}${amt}</span></div>`;
  }

  if (pos.requiredSkills && pos.requiredSkills.length > 0) {
    html += `<div class="detail-item full-width"><span class="detail-label">Key Core Skill Competencies</span><div class="detail-chips">`;
    pos.requiredSkills.forEach(s => { html += `<span class="detail-chip">${s}</span>`; });
    html += `</div></div>`;
  }
  
  if (pos.goodToHaveSkills && pos.goodToHaveSkills.length > 0) {
    html += `<div class="detail-item full-width"><span class="detail-label">Secondary / Preferred Skill Addons</span><div class="detail-chips">`;
    pos.goodToHaveSkills.forEach(s => { html += `<span class="detail-chip">${s}</span>`; });
    html += `</div></div>`;
  }

  if (pos.additionalDetails) {
    html += `<div class="detail-item full-width"><span class="detail-label">Additional Perks & Culture Benefits</span><span class="detail-value" style="font-weight: 400; color: var(--text-secondary);">${pos.additionalDetails}</span></div>`;
  }

  html += `</div>`;
  DOM.specPositionBody.innerHTML = html;
}

function renderEligibilitySection(elig) {
  const cardEl = document.getElementById('sheet-eligibility');
  const checkEl = cardEl.querySelector('.check-circle-indicator');

  if (!elig || Object.keys(elig).length === 0) {
    updateSectionStatus('eligibility', 'Empty', 'sheet-status', checkEl, false);
    DOM.specEligibilityBody.innerHTML = `<div class="spec-placeholder">No eligibility criteria configured.</div>`;
    return;
  }

  updateSectionStatus('eligibility', 'Complete', 'sheet-status complete', checkEl, true);

  let html = `<div class="detail-grid">`;

  if (elig.eligibleCourses && elig.eligibleCourses.length > 0) {
    html += `<div class="detail-item full-width"><span class="detail-label">Eligible Courses & Academic Streams</span><div class="detail-chips">`;
    elig.eligibleCourses.forEach(c => { html += `<span class="detail-chip">${c}</span>`; });
    html += `</div></div>`;
  }

  if (elig.academicCriteria) {
    const ac = elig.academicCriteria;
    html += `<div class="detail-item full-width"><span class="detail-label">Academic Evaluation Thresholds</span><div class="detail-chips">`;
    
    if (ac.tenthMarks !== undefined && ac.tenthMarks !== null) {
      html += `<span class="detail-chip">10th Grade: min ${ac.tenthMarks}%</span>`;
    }
    if (ac.twelfthMarks !== undefined && ac.twelfthMarks !== null) {
      html += `<span class="detail-chip">12th Grade / Diploma: min ${ac.twelfthMarks}%</span>`;
    }
    if (ac.graduationMarks !== undefined && ac.graduationMarks !== null) {
      html += `<span class="detail-chip">Graduation CGPA / Marks: min ${ac.graduationMarks}%</span>`;
    }
    if (ac.postGraduationMarks !== undefined && ac.postGraduationMarks !== null) {
      html += `<span class="detail-chip">Post-Graduation: min ${ac.postGraduationMarks}%</span>`;
    }
    
    const backpaperText = ac.backpaperAllowed 
      ? `Backpapers: Allowed (Max: ${ac.maxBackpapers || 'No Limit'} ${ac.backpaperType || ''})`
      : 'Backpapers: Strictly Not Allowed';
    html += `<span class="detail-chip">${backpaperText}</span>`;

    html += `</div></div>`;
  }

  if (elig.maxAge) {
    html += `<div class="detail-item"><span class="detail-label">Age Restrictions</span><span class="detail-value">Maximum ${elig.maxAge} years old</span></div>`;
  }
  if (elig.eligibilityDate) {
    html += `<div class="detail-item"><span class="detail-label">Registration Deadline Cutoff</span><span class="detail-value">${elig.eligibilityDate}</span></div>`;
  }

  html += `</div>`;
  DOM.specEligibilityBody.innerHTML = html;
}

function renderInterviewSection(iv) {
  const cardEl = document.getElementById('sheet-interview');
  const checkEl = cardEl.querySelector('.check-circle-indicator');

  if (!iv || !iv.rounds || iv.rounds.length === 0) {
    updateSectionStatus('interview', 'Empty', 'sheet-status', checkEl, false);
    DOM.specInterviewBody.innerHTML = `<div class="spec-placeholder">No interview rounds configured.</div>`;
    return;
  }

  updateSectionStatus('interview', 'Complete', 'sheet-status complete', checkEl, true);

  let html = `<div class="rounds-timeline">`;
  
  iv.rounds.forEach(r => {
    const venueLabel = { online: 'Online Assessment', onsite: 'On-Site Assessment', hybrid_tbd: 'Venue TBD' };
    const typeLabel = r.roundType ? r.roundType.replace(/_/g, ' ') : 'Assessment';
    
    html += `
      <div class="round-item">
        <div class="round-num">${r.roundNumber}</div>
        <div class="round-details">
          <div class="round-title" style="text-transform: capitalize;">
            ${r.roundTitle || typeLabel}
          </div>
          <div class="round-meta">
            ${venueLabel[r.venue] || r.venue || ''} • ⏳ ${r.duration || 'TBD'}
          </div>
          ${r.description ? `<p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; font-weight: 400;">${r.description}</p>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  DOM.specInterviewBody.innerHTML = html;
}

function updateSectionStatus(sectionId, text, className, checkCircleEl, activeCheck) {
  const badge = DOM[`badge${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`];
  if (badge) {
    badge.textContent = text;
    badge.className = className;
  }
  
  if (checkCircleEl) {
    checkCircleEl.classList.toggle('active', activeCheck);
  }
}

// ==========================================================================
// States & UI Toggles
// ==========================================================================

function updateInputState() {
  const hasActiveQuestions = state.activeQuestions && state.activeQuestions.length > 0;
  const disabled = state.isGenerating || !state.activeChatId || hasActiveQuestions;
  
  DOM.chatTextInput.disabled = disabled;
  DOM.sendMessageBtn.disabled = disabled;
  DOM.generateDriveBtn.disabled = disabled;
  
  if (hasActiveQuestions) {
    DOM.chatTextInput.placeholder = "Please answer the clarification questions first";
  } else {
    DOM.chatTextInput.placeholder = "Type a message or request adjustments...";
  }
  
  if (state.isGenerating) {
    DOM.generateDriveBtn.innerHTML = `<div class="spinner"></div>`;
  } else {
    DOM.generateDriveBtn.innerHTML = `<i data-lucide="sparkles"></i> Generate`;
  }
  lucide.createIcons();
}

function updateUploadZoneState() {
  if (state.isUploading) {
    DOM.uploadContentNormal.classList.add('hidden');
    DOM.uploadContentLoading.classList.remove('hidden');
    DOM.uploadZone.style.pointerEvents = 'none';
  } else {
    DOM.uploadContentNormal.classList.remove('hidden');
    DOM.uploadContentLoading.classList.add('hidden');
    DOM.uploadZone.style.pointerEvents = 'auto';
  }
}

// ==========================================================================
// Utilities
// ==========================================================================

function formatMarkdown(text) {
  if (!text) return '';
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert bullet lists
  formatted = formatted.replace(/^\s*•\s+(.*?)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Convert newlines to paragraphs
  formatted = formatted.split('\n\n').map(p => {
    if (p.trim().startsWith('<ul>') || p.trim().startsWith('<li>')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return formatted;
}

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}



function exportJsonToFile() {
  if (!state.driveData || Object.keys(state.driveData).length === 0) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.driveData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  const title = state.driveData.setupDetails?.driveTitle || 'recruitment-drive';
  downloadAnchor.setAttribute("download", `${title.replace(/\s+/g, '-').toLowerCase()}-config.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('JSON configuration exported!', 'success');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '4px';
  toast.style.zIndex = '9999';
  toast.style.fontSize = '0.82rem';
  toast.style.fontWeight = '600';
  toast.style.color = 'white';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.animation = 'messageSlideIn 0.15s ease-out';
  
  if (type === 'success') {
    toast.style.background = 'var(--primary-black)';
  } else if (type === 'warning') {
    toast.style.background = 'var(--amber-brand)';
  } else {
    toast.style.background = '#d9363e';
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initApp);
