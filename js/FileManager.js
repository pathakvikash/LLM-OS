/**
 * File Management System
 * Handles file uploads, storage, viewing, and integration with AI actions
 */
class FileManager {
  constructor(config, logger, appState) {
    this.config = config;
    this.logger = logger;
    this.appState = appState;
    
    this.files = new Map(); // Store file objects with metadata
    this.fileBlobs = new Map(); // Store actual file blobs
    this.supportedTextTypes = ['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.csv', '.ts', '.jsx', '.tsx', '.vue', '.php', '.java', '.cpp', '.c', '.h', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.r', '.sql', '.sh', '.bash', '.yaml', '.yml', '.toml', '.ini', '.conf', '.log'];
    this.supportedImageTypes = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
    this.supportedDocumentTypes = ['.pdf', '.doc', '.docx', '.rtf'];
    
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 50;
    
    // IndexedDB setup
    this.dbName = 'LLM-OS-Files';
    this.dbVersion = 1;
    this.storeName = 'files';
    
    this.logger.info('FileManager initialized', {
      supportedTextTypes: this.supportedTextTypes.length,
      supportedImageTypes: this.supportedImageTypes.length,
      maxFileSize: this.maxFileSize,
      maxFiles: this.maxFiles
    });
    
    // Initialize IndexedDB
    this.initDatabase();
  }

  /**
   * Initialize IndexedDB
   */
  async initDatabase() {
    try {
      this.logger.debug('Initializing IndexedDB', { dbName: this.dbName, version: this.dbVersion });
      
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = (event) => {
        this.logger.error('Failed to open IndexedDB', { 
          error: request.error,
          errorCode: request.error?.code,
          errorMessage: request.error?.message 
        });
      };
      
      request.onsuccess = (event) => {
        this.db = request.result;
        this.logger.info('IndexedDB initialized successfully', { 
          dbName: this.db.name,
          version: this.db.version,
          objectStores: Array.from(this.db.objectStoreNames)
        });
        this.loadFilesFromStorage();
      };
      
      request.onupgradeneeded = (event) => {
        this.logger.debug('IndexedDB upgrade needed', { oldVersion: event.oldVersion, newVersion: event.newVersion });
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
          this.logger.info('IndexedDB object store created', { storeName: this.storeName });
        }
      };
    } catch (error) {
      this.logger.error('Failed to initialize IndexedDB', { error: error.message, stack: error.stack });
    }
  }

  /**
   * Load files from IndexedDB storage
   */
  async loadFilesFromStorage() {
    if (!this.db) return;
    
    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const files = request.result;
        for (const file of files) {
          this.files.set(file.id, file);
        }
        this.logger.info('Files loaded from storage', { count: files.length });
      };
      
      request.onerror = () => {
        this.logger.error('Failed to load files from storage', request.error);
      };
    } catch (error) {
      this.logger.error('Error loading files from storage', error);
    }
  }

  /**
   * Save file to IndexedDB
   */
  async saveFileToStorage(fileObj) {
    if (!this.db) {
      this.logger.warn('IndexedDB not available, skipping save to storage');
      return;
    }
    
    try {
      this.logger.debug('Saving file to IndexedDB', { fileId: fileObj.id, fileName: fileObj.name });
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fileObj);
      
      request.onsuccess = () => {
        this.logger.debug('File saved to IndexedDB successfully', { fileId: fileObj.id });
      };
      
      request.onerror = (event) => {
        this.logger.error('Failed to save file to IndexedDB', { 
          fileId: fileObj.id,
          error: request.error,
          errorCode: request.error?.code,
          errorMessage: request.error?.message 
        });
        throw new Error(`Failed to save file to storage: ${request.error?.message}`);
      };
    } catch (error) {
      this.logger.error('Error saving file to IndexedDB', { 
        fileId: fileObj.id,
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Remove file from IndexedDB
   */
  async removeFileFromStorage(fileId) {
    if (!this.db) return;
    
    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(fileId);
      
      request.onsuccess = () => {
        this.logger.debug('File removed from storage', { fileId });
      };
      
      request.onerror = () => {
        this.logger.error('Failed to remove file from storage', request.error);
      };
    } catch (error) {
      this.logger.error('Error removing file from storage', error);
    }
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  /**
   * Check if file type is supported
   */
  isSupportedFileType(filename) {
    const ext = this.getFileExtension(filename);
    return this.supportedTextTypes.includes(ext) || 
           this.supportedImageTypes.includes(ext) || 
           this.supportedDocumentTypes.includes(ext);
  }

  /**
   * Get file type category
   */
  getFileTypeCategory(filename) {
    const ext = this.getFileExtension(filename);
    if (this.supportedTextTypes.includes(ext)) return 'text';
    if (this.supportedImageTypes.includes(ext)) return 'image';
    if (this.supportedDocumentTypes.includes(ext)) return 'document';
    return 'unknown';
  }

  /**
   * Generate unique file ID
   */
  generateFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Add file to storage
   */
  async addFile(file) {
    try {
      this.logger.debug('Starting file upload', { 
        name: file.name, 
        size: file.size, 
        type: file.type,
        lastModified: file.lastModified 
      });

      if (this.files.size >= this.maxFiles) {
        throw new Error(`Maximum number of files (${this.maxFiles}) reached`);
      }

      if (file.size > this.maxFileSize) {
        throw new Error(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})`);
      }

      const fileExtension = this.getFileExtension(file.name);
      this.logger.debug('File extension detected', { extension: fileExtension });

      if (!this.isSupportedFileType(file.name)) {
        throw new Error(`File type not supported: ${fileExtension}`);
      }

      const fileId = this.generateFileId();
      const fileObj = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        category: this.getFileTypeCategory(file.name),
        extension: fileExtension,
        uploadDate: new Date().toISOString(),
        lastModified: new Date(file.lastModified).toISOString(),
        content: null,
        preview: null
      };

      this.logger.debug('File object created', { fileId, category: fileObj.category });

      // Store the file blob first
      this.fileBlobs.set(fileId, file);
      
      // Add file object to files Map so it can be found during processing
      this.files.set(fileId, fileObj);
      
      // Process the file content
      await this.processFile(fileId, file);
      
      // Save to IndexedDB
      await this.saveFileToStorage(fileObj);
      
      this.logger.info('File added successfully', { fileId, name: file.name, size: file.size, category: fileObj.category });
      
      return fileId;
    } catch (error) {
      this.logger.error('Failed to add file', { 
        name: file.name, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Remove file from storage
   */
  async removeFile(fileId) {
    if (this.files.has(fileId)) {
      const file = this.files.get(fileId);
      this.files.delete(fileId);
      this.fileBlobs.delete(fileId);
      await this.removeFileFromStorage(fileId);
      this.logger.info('File removed', { fileId, name: file.name });
      return true;
    }
    return false;
  }

  /**
   * Get file by ID
   */
  getFile(fileId) {
    return this.files.get(fileId);
  }

  /**
   * Get file blob by ID
   */
  getFileBlob(fileId) {
    return this.fileBlobs.get(fileId);
  }

  /**
   * Get all files
   */
  getAllFiles() {
    return Array.from(this.files.values());
  }

  /**
   * Get files by category
   */
  getFilesByCategory(category) {
    return Array.from(this.files.values()).filter(file => file.category === category);
  }

  /**
   * Process file content based on type
   */
  async processFile(fileId, file) {
    this.logger.debug('Processing file', { fileId, fileName: file.name, category: this.files.get(fileId)?.category });
    
    const fileObj = this.files.get(fileId);
    if (!fileObj) {
      this.logger.error('File object not found in files Map', { fileId, filesCount: this.files.size });
      throw new Error(`File object not found for ID: ${fileId}`);
    }
    
    try {
      if (fileObj.category === 'text') {
        this.logger.debug('Processing text file', { fileId, fileName: file.name });
        fileObj.content = await this.readTextFile(file);
        fileObj.preview = this.generateTextPreview(fileObj.content);
      } else if (fileObj.category === 'image') {
        this.logger.debug('Processing image file', { fileId, fileName: file.name });
        fileObj.preview = await this.generateImagePreview(file);
        // For images, store a description that can be used by AI
        fileObj.content = `Image file: ${fileObj.name} (${this.formatFileSize(fileObj.size)}) - Image content cannot be directly read as text, but the file contains visual data.`;
      } else if (fileObj.category === 'document') {
        this.logger.debug('Processing document file', { fileId, fileName: file.name });
        // Try to extract text from PDF files
        if (fileObj.extension === '.pdf') {
          try {
            fileObj.content = await this.extractTextFromPDF(file);
            fileObj.preview = this.generateTextPreview(fileObj.content);
            this.logger.info('PDF text extracted successfully', { fileId, contentLength: fileObj.content.length });
          } catch (pdfError) {
            this.logger.warn('Failed to extract text from PDF, using fallback', { fileId, error: pdfError.message });
            fileObj.content = `PDF Document: ${fileObj.name} (${this.formatFileSize(fileObj.size)}) - Text extraction failed, but this is a PDF document that may contain text, images, and other content.`;
            fileObj.preview = `PDF Document: ${fileObj.name} (${this.formatFileSize(fileObj.size)})`;
          }
        } else {
          fileObj.content = `Document: ${fileObj.name} (${this.formatFileSize(fileObj.size)}) - This is a ${fileObj.extension} document that may contain text and other content.`;
          fileObj.preview = `Document: ${fileObj.name} (${this.formatFileSize(fileObj.size)})`;
        }
      } else {
        this.logger.warn('Unknown file category', { fileId, category: fileObj.category });
        fileObj.content = `File: ${fileObj.name} (${this.formatFileSize(fileObj.size)})`;
        fileObj.preview = `File: ${fileObj.name} (${this.formatFileSize(fileObj.size)})`;
      }
      
      this.logger.info('File processed successfully', { fileId, category: fileObj.category, hasContent: !!fileObj.content });
    } catch (error) {
      this.logger.error('Failed to process file', { 
        fileId, 
        fileName: file.name,
        category: fileObj.category,
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Read text file content
   */
  async readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Generate text preview (first 200 characters)
   */
  generateTextPreview(content) {
    if (content.length <= 200) return content;
    return content.substring(0, 200) + '...';
  }

  /**
   * Generate image preview
   */
  async generateImagePreview(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract text from PDF file
   */
  async extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
      // Check if PDF.js is available (we'll add this library)
      if (typeof pdfjsLib !== 'undefined') {
        this.extractTextWithPDFJS(file, resolve, reject);
      } else {
        // Fallback: try to read as text (might work for some PDFs)
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target.result;
            // Basic check if content looks like text
            if (content && content.length > 0 && !content.includes('')) {
              resolve(content);
            } else {
              reject(new Error('PDF content could not be extracted as text'));
            }
          } catch (error) {
            reject(new Error('Failed to process PDF content'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsText(file);
      }
    });
  }

  /**
   * Extract text using PDF.js library
   */
  async extractTextWithPDFJS(file, resolve, reject) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      resolve(fullText.trim());
    } catch (error) {
      reject(new Error(`PDF.js extraction failed: ${error.message}`));
    }
  }

  /**
   * Get file from ID
   */
  async getFileFromId(fileId) {
    return this.fileBlobs.get(fileId);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file content for AI processing
   */
  getFileContent(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      this.logger.warn('File not found for content retrieval', { fileId });
      return null;
    }
    
    this.logger.debug('Getting file content for AI', { 
      fileId, 
      fileName: file.name, 
      category: file.category,
      hasContent: !!file.content,
      contentLength: file.content?.length || 0
    });
    
    if (file.category === 'text') {
      return file.content || `Text file: ${file.name} (${this.formatFileSize(file.size)}) - Content not available.`;
    } else if (file.category === 'image') {
      return file.content || `Image file: ${file.name} (${this.formatFileSize(file.size)}) - Image content cannot be directly read as text.`;
    } else if (file.category === 'document') {
      if (file.extension === '.pdf') {
        return file.content || `PDF Document: ${file.name} (${this.formatFileSize(file.size)}) - PDF text extraction was not successful, but this document may contain text, images, and other content.`;
      } else {
        return file.content || `Document: ${file.name} (${this.formatFileSize(file.size)}) - This is a ${file.extension} document.`;
      }
    } else {
      return file.content || `File: ${file.name} (${this.formatFileSize(file.size)})`;
    }
  }

  /**
   * Search files by name or content
   */
  searchFiles(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const file of this.files.values()) {
      if (file.name.toLowerCase().includes(lowerQuery)) {
        results.push(file);
      } else if (file.content && file.content.toLowerCase().includes(lowerQuery)) {
        results.push(file);
      }
    }
    
    return results;
  }

  /**
   * Export files data for persistence
   */
  exportFilesData() {
    const filesData = {};
    for (const [fileId, file] of this.files) {
      filesData[fileId] = {
        ...file,
        content: file.content // Include content for persistence
      };
    }
    return filesData;
  }

  /**
   * Import files data from persistence
   */
  importFilesData(filesData) {
    this.files.clear();
    for (const [fileId, fileData] of Object.entries(filesData)) {
      this.files.set(fileId, fileData);
    }
    this.logger.info('Files data imported', { fileCount: this.files.size });
  }

  /**
   * Clear all files
   */
  async clearAllFiles() {
    const count = this.files.size;
    this.files.clear();
    this.fileBlobs.clear();
    
    // Clear from IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          this.logger.info('All files cleared from storage');
        };
        
        request.onerror = () => {
          this.logger.error('Failed to clear files from storage', request.error);
        };
      } catch (error) {
        this.logger.error('Error clearing files from storage', error);
      }
    }
    
    this.logger.info('All files cleared', { count });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileManager;
} else {
  window.FileManager = FileManager;
} 