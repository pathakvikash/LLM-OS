/**
 * ResizeManager - Handles resizing of application sections
 */
class ResizeManager {
  constructor() {
    this.isResizing = false;
    this.currentHandle = null;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.minWidth = 200; // Minimum width for sections
    this.minHeight = 150; // Minimum height for sections
    
    this.init();
  }

  init() {
    this.setupResizeHandles();
    this.setupEventListeners();
  }

  setupResizeHandles() {
    // Sidebar resize handle
    const sidebarHandle = document.getElementById('sidebarResizeHandle');
    if (sidebarHandle) {
      sidebarHandle.addEventListener('mousedown', (e) => this.startResize(e, 'sidebar'));
    }

    // User-Chat section resize handle
    const userChatHandle = document.getElementById('userChatResizeHandle');
    if (userChatHandle) {
      userChatHandle.addEventListener('mousedown', (e) => this.startResize(e, 'userChat'));
    }
  }

  setupEventListeners() {
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.stopResize());
    
    // Prevent text selection during resize
    document.addEventListener('selectstart', (e) => {
      if (this.isResizing) {
        e.preventDefault();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  startResize(e, type) {
    e.preventDefault();
    this.isResizing = true;
    this.currentHandle = type;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const handle = e.target;
    handle.classList.add('resizing');

    // Store initial dimensions
    if (type === 'sidebar') {
      const sidebar = document.getElementById('sidebar');
      this.startWidth = sidebar.offsetWidth;
    } else if (type === 'userChat') {
      const userSection = document.getElementById('userSection');
      this.startWidth = userSection.offsetWidth;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Show resize indicator
    this.showResizeIndicator(type);
  }

  handleMouseMove(e) {
    if (!this.isResizing) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    if (this.currentHandle === 'sidebar') {
      this.resizeSidebar(deltaX);
    } else if (this.currentHandle === 'userChat') {
      this.resizeUserChat(deltaX);
    }
  }

  resizeSidebar(deltaX) {
    const sidebar = document.getElementById('sidebar');
    const newWidth = Math.max(this.minWidth, this.startWidth + deltaX);
    const maxWidth = window.innerWidth * 0.6; // Max 60% of window width
    
    const finalWidth = Math.min(newWidth, maxWidth);
    sidebar.style.width = `${finalWidth}px`;
    sidebar.style.flexShrink = '0';
  }

  resizeUserChat(deltaX) {
    const userSection = document.getElementById('userSection');
    const chatSection = document.getElementById('chatSection');
    const mainContent = document.getElementById('mainContent');

    const mainContentWidth = mainContent.offsetWidth;
    const newWidth = this.startWidth + deltaX;
    
    const minUserWidth = this.minWidth;
    const minChatWidth = this.minWidth;

    let finalUserWidth = newWidth;

    if (finalUserWidth < minUserWidth) {
      finalUserWidth = minUserWidth;
    }
    
    if (mainContentWidth - finalUserWidth < minChatWidth) {
      finalUserWidth = mainContentWidth - minChatWidth;
    }

    userSection.style.width = `${finalUserWidth}px`;
    userSection.style.flex = '0 0 auto';
    chatSection.style.flex = '1 1 auto';
  }

  stopResize() {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.currentHandle = null;
    
    // Remove resizing class from all handles
    document.querySelectorAll('.resize-handle, .resize-handle-vertical').forEach(handle => {
      handle.classList.remove('resizing');
    });

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Hide resize indicator
    this.hideResizeIndicator();
  }

  // Reset all sections to default sizes
  resetSizes() {
    const sidebar = document.getElementById('sidebar');
    const chatSection = document.getElementById('chatSection');
    const userSection = document.getElementById('userSection');

    if (sidebar) {
      sidebar.style.width = '';
      sidebar.style.flexShrink = '';
    }

    if (chatSection) {
      chatSection.style.width = '';
      chatSection.style.flexShrink = '';
    }

    if (userSection) {
      userSection.style.flex = '';
    }
  }

  // Save current sizes to localStorage
  saveSizes() {
    const sidebar = document.getElementById('sidebar');
    const chatSection = document.getElementById('chatSection');
    
    const sizes = {
      sidebarWidth: sidebar ? sidebar.offsetWidth : null,
      chatWidth: chatSection ? chatSection.offsetWidth : null,
      timestamp: Date.now()
    };
    
    localStorage.setItem('llm-os-section-sizes', JSON.stringify(sizes));
  }

  // Load saved sizes from localStorage
  loadSizes() {
    try {
      const saved = localStorage.getItem('llm-os-section-sizes');
      if (!saved) return;

      const sizes = JSON.parse(saved);
      const sidebar = document.getElementById('sidebar');
      const chatSection = document.getElementById('chatSection');

      if (sizes.sidebarWidth && sidebar) {
        sidebar.style.width = `${sizes.sidebarWidth}px`;
        sidebar.style.flexShrink = '0';
      }

      if (sizes.chatWidth && chatSection) {
        chatSection.style.width = `${sizes.chatWidth}px`;
        chatSection.style.flexShrink = '0';
      }
    } catch (error) {
      console.warn('Failed to load saved section sizes:', error);
    }
  }

  showResizeIndicator(type) {
    const indicator = document.getElementById('resizeIndicator');
    if (indicator) {
      const text = type === 'sidebar' ? 'Resizing Sidebar' : 'Resizing User/Chat Sections';
      indicator.textContent = text;
      indicator.classList.add('show');
    }
  }

  hideResizeIndicator() {
    const indicator = document.getElementById('resizeIndicator');
    if (indicator) {
      indicator.classList.remove('show');
    }
  }

  // Keyboard shortcuts for resize actions
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + R to reset sizes
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
      e.preventDefault();
      this.resetSizes();
      this.showNotification('Layout reset to default sizes');
    }
    
    // Ctrl/Cmd + S to save sizes
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      this.saveSizes();
      this.showNotification('Layout sizes saved');
    }
  }

  showNotification(message) {
    const indicator = document.getElementById('resizeIndicator');
    if (indicator) {
      indicator.textContent = message;
      indicator.classList.add('show');
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 2000);
    }
  }
}

// Initialize resize manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.resizeManager = new ResizeManager();
  
  // Load saved sizes after a short delay to ensure all elements are rendered
  setTimeout(() => {
    window.resizeManager.loadSizes();
  }, 100);
});

// Save sizes when window is resized or before unload
window.addEventListener('resize', () => {
  if (window.resizeManager) {
    window.resizeManager.saveSizes();
  }
});

window.addEventListener('beforeunload', () => {
  if (window.resizeManager) {
    window.resizeManager.saveSizes();
  }
}); 