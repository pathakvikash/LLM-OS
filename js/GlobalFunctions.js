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
    window.peekSidebar = (show) => this.app.peekSidebar(show);
    window.restoreSidebar = () => this.app.restoreSidebar();
    window.peekUserSection = (show) => this.app.peekUserSection(show);
    window.restoreUserSection = () => this.app.restoreUserSection();
    window.peekChatSection = (show) => this.app.peekChatSection(show);
    window.restoreChatSection = () => this.app.restoreChatSection();
    
    // Debug functions
    window.checkModels = () => this.app.checkModels();
    
    this.logger.debug('Global functions setup completed');
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