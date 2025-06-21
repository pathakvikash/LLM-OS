/**
 * UI Management
 * Handles all UI interactions, updates, and DOM manipulations
 */
class UIManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    this.chatBox = document.getElementById('chatBox');
    this.userInput = document.getElementById('userInput');
    this.sendButton = document.getElementById('sendButton');
    this.actionButtons = document.getElementById('actionButtons');
    this.modelSelect = document.getElementById('modelSelect');
    this.modelInfo = document.getElementById('modelInfo');
    this.sessionInfo = document.getElementById('sessionInfo');
    this.sessionId = document.getElementById('sessionId');
    this.chatStatus = document.getElementById('chatStatus');
    
    // Section elements
    this.sidebar = document.getElementById('sidebar');
    this.userSection = document.getElementById('userSection');
    this.chatSection = document.getElementById('chatSection');
    this.mainContent = document.getElementById('mainContent');
    
    this.logger.info('UIManager initialized', {
      elementsFound: {
        chatBox: !!this.chatBox,
        userInput: !!this.userInput,
        sendButton: !!this.sendButton,
        actionButtons: !!this.actionButtons,
        modelSelect: !!this.modelSelect,
        sidebar: !!this.sidebar,
        userSection: !!this.userSection,
        chatSection: !!this.chatSection
      }
    });
  }

  addMessage(message, type = 'user') {
    if (!this.chatBox) return;

    let messageElement;

    if (type === 'user' || type === 'agent') {
      messageElement = document.createElement('div');
      messageElement.classList.add('message', `${type}-message`, 'fade-in');

      const avatar = document.createElement('div');
      avatar.classList.add('avatar');
      avatar.textContent = type === 'user' ? 'You' : 'Ag';

      const content = document.createElement('div');
      content.classList.add('content');
      
      // Basic markdown parsing
      let html = this.escapeHtml(message);
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
      html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>'); // Code blocks
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>'); // Inline code

      content.innerHTML = html;

      messageElement.appendChild(avatar);
      messageElement.appendChild(content);

    } else { // For system, error, success messages
      messageElement = document.createElement('div');
      messageElement.className = `${type}-message fade-in`;
      messageElement.textContent = message;
    }

    this.chatBox.appendChild(messageElement);
    this.scrollToBottom();
    
    this.logger.debug('Message added to UI', { type, messageLength: message.length });
  }

  addContextInfo(context) {
    if (!this.config.shouldShowContextInfo() || !context || Object.keys(context).length === 0) return;
    
    const contextElement = document.createElement('div');
    contextElement.className = 'context-info fade-in';
    contextElement.innerHTML = `<strong>Context:</strong> ${this.escapeHtml(JSON.stringify(context, null, 2))}`;
    this.chatBox.appendChild(contextElement);
    this.scrollToBottom();
    
    this.logger.debug('Context info added to UI', { contextKeys: Object.keys(context) });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    this.chatBox.scrollTop = this.chatBox.scrollHeight;
  }

  setLoading(loading) {
    this.sendButton.disabled = loading;
    this.userInput.disabled = loading;
    this.sendButton.textContent = loading ? 'Processing...' : 'Send';
    this.chatStatus.textContent = loading ? 'Processing...' : 'Ready';
    
    if (loading) {
      this.userInput.classList.add('loading');
    } else {
      this.userInput.classList.remove('loading');
    }
    
    this.logger.debug('Loading state changed', { loading });
  }

  showActionButtons(show) {
    this.actionButtons.style.display = show ? 'flex' : 'none';
    this.logger.debug('Action buttons visibility changed', { show });
  }

  updateModelSelect(models, currentModel) {
    this.modelSelect.innerHTML = '';
    
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">No models available</option>';
      this.modelInfo.textContent = 'No models found. Please pull a model with: ollama pull <model-name>';
      this.logger.warn('No models available for selection');
      return;
    }
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.name;
      if (model.name === currentModel) {
        option.selected = true;
      }
      this.modelSelect.appendChild(option);
    });
    
    this.modelInfo.textContent = `Using: ${currentModel}`;
    this.logger.debug('Model selector updated', { modelCount: models.length, currentModel });
  }

  updateSessionInfo(sessionId) {
    const displayLength = this.config.getSessionIdDisplayLength();
    this.sessionId.textContent = sessionId.substring(0, displayLength) + '...';
    this.logger.debug('Session info updated', { sessionId: sessionId.substring(0, displayLength) + '...' });
  }

  selectAutomationType(type) {
    // Remove active class from all automation types
    document.querySelectorAll('.automation-type').forEach(el => {
      el.classList.remove('active');
    });
    
    // Add active class to selected type
    const selectedElement = document.querySelector(`[data-type="${type}"]`);
    if (selectedElement) {
      selectedElement.classList.add('active');
    }
    
    this.logger.debug('Automation type selected in UI', { type });
  }

  // Section visibility management
  toggleSection(sectionName, visible) {
    const section = this[sectionName];
    if (!section) {
      this.logger.warn('Section not found for toggle', { sectionName });
      return;
    }

    if (visible) {
      section.classList.remove('collapsed');
    } else {
      section.classList.add('collapsed');
    }

    // Update layout
    this.updateLayout();
    this.logger.debug('Section toggled', { sectionName, visible });
  }

  updateLayout() {
    // Add/remove classes to main container based on visible sections
    const sidebarVisible = !this.sidebar.classList.contains('collapsed');
    const userVisible = !this.userSection.classList.contains('collapsed');
    const chatVisible = !this.chatSection.classList.contains('collapsed');

    this.mainContent.className = 'main-content';
    
    if (!sidebarVisible) {
      this.mainContent.classList.add('sidebar-hidden');
    }
    if (!userVisible) {
      this.mainContent.classList.add('user-hidden');
    }
    if (!chatVisible) {
      this.mainContent.classList.add('chat-hidden');
    }
    
    this.logger.debug('Layout updated', { sidebarVisible, userVisible, chatVisible });
  }

  updateCollapseButtons() {
    // Update button text based on current state
    const sidebarBtn = this.sidebar.querySelector('.collapse-btn span');
    const userBtn = this.userSection.querySelector('.collapse-btn span');
    const chatBtn = this.chatSection.querySelector('.collapse-btn span');

    if (sidebarBtn) {
      sidebarBtn.textContent = this.sidebar.classList.contains('collapsed') ? '▶' : '◀';
    }
    if (userBtn) {
      userBtn.textContent = this.userSection.classList.contains('collapsed') ? '▶' : '▼';
    }
    if (chatBtn) {
      chatBtn.textContent = this.chatSection.classList.contains('collapsed') ? '▶' : '▼';
    }
    
    this.logger.debug('Collapse buttons updated');
  }

  clearChat() {
    this.chatBox.innerHTML = '';
    this.addMessage("Hello! I'm your AI assistant. How can I help you today?", 'agent');
    this.logger.debug('Chat cleared');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
} else {
  window.UIManager = UIManager;
} 