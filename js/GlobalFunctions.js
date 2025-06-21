/**
 * Global Functions Module
 * Handles all global window functions and application initialization
 */
class GlobalFunctions {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.app = null;
  }

  initialize() {
    try {
      this.app = new AppController(this.config, this.logger);
      this.setupGlobalFunctions();
      this.logger.info('Global functions initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize global functions', error);
      throw error;
    }
  }

  setupGlobalFunctions() {
    // Core functionality
    window.sendMessage = () => this.app.sendMessage();
    window.performAction = (actionType) => this.app.performAction(actionType);
    window.performFileAction = (actionType, fileId) => this.app.performFileAction(actionType, fileId);
    window.handleKeyPress = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.app.sendMessage();
      }
    };

    // Model and automation functions
    window.changeModel = (modelName) => this.app.changeModel(modelName);
    window.selectAutomationType = (type) => this.app.selectAutomationType(type);
    window.createNewChat = () => this.app.createNewChat();
    window.clearSession = () => this.app.clearSession();
    window.resetModel = () => this.app.resetModel();
    
    // Section toggle functions
    window.toggleSidebar = () => this.app.toggleSidebar();
    window.toggleUserSection = () => this.app.toggleUserSection();
    window.toggleChatSection = () => this.app.toggleChatSection();
    
    // Peek and restore functions
    window.restoreSidebar = () => this.app.restoreSidebar();
    window.restoreUserSection = () => this.app.restoreUserSection();
    window.restoreChatSection = () => this.app.restoreChatSection();
    
    // Tab switching function
    window.switchTab = (tabName) => this.switchTab(tabName);
    
    // Debug functions
    window.checkModels = () => this.app.checkModels();
    
    this.logger.debug('Global functions setup completed');
  }

  /**
   * Switch between tabs in the user section
   */
  switchTab(tabName) {
    try {
      // Update tab buttons
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
          btn.classList.add('active');
        }
      });

      // Update tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName + 'Tab') {
          content.classList.add('active');
        }
      });

      this.logger.debug('Tab switched', { tabName });
    } catch (error) {
      this.logger.error('Failed to switch tab', { tabName, error: error.message });
    }
  }

  getApp() {
    return this.app;
  }
}

// Legacy function for backward compatibility
function toggleSection(sectionId) {
  const sectionIds = ['sidebar', 'userSection', 'chatSection'];
  const visibleSections = sectionIds.filter(id => !document.getElementById(id).classList.contains('collapsed'));
  const section = document.getElementById(sectionId);

  if (!section.classList.contains('collapsed') && visibleSections.length === 1) {
    alert('At least one section must remain visible.');
    return;
  }
  section.classList.toggle('collapsed');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlobalFunctions, toggleSection };
} else {
  window.GlobalFunctions = GlobalFunctions;
  window.toggleSection = toggleSection;
} 