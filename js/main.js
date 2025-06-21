/**
 * Main Application Entry Point
 * Loads all modules and initializes the application
 */

// Application initialization
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize configuration and logger first
    const config = new AppConfig();
    const logger = new Logger(config);
    
    logger.info('Starting LLM-OS application initialization');
    
    // Initialize global functions and application
    const globalFunctions = new GlobalFunctions(config, logger);
    globalFunctions.initialize();
    
    // Initialize file management system
    const fileManager = new FileManager(config, logger, globalFunctions.appState);
    const fileUI = new FileUI(config, logger, fileManager, globalFunctions.uiManager);
    
    // Initialize file UI components
    fileUI.initialize();
    
    // Make file management globally accessible
    window.fileManager = fileManager;
    window.fileUI = fileUI;
    
    logger.info('LLM-OS Application initialized successfully');
    
    // Enable debug mode if configured
    if (config.isDebugEnabled()) {
      logger.info('Debug mode enabled', { 
        logLevel: config.getLogLevel(),
        showContextInfo: config.shouldShowContextInfo()
      });
    }
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Show error message to user
    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
      chatBox.innerHTML = `
        <p class="error fade-in">
          <strong>Error:</strong> Failed to initialize application. Please check the console for details.
        </p>
        <p><strong>Agent:</strong> Hello! I'm your AI assistant. How can I help you today?</p>
      `;
    }
  }
});

// Export for testing or external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppState, OllamaAPI, UIManager, AppController, GlobalFunctions, AppConfig, Logger, FileManager, FileUI };
} 