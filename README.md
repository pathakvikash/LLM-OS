# LLM-OS: AI-Powered Application Interface

A modern, AI-powered application interface that integrates file management, workspace automation, web search capabilities, and AI assistance in a single, intuitive platform.

## Features

### 🤖 AI Integration
- **Multiple AI Models**: Support for various Ollama models
- **Automation Types**: Edit, Ask, and Agent modes for different AI interactions
- **Context-Aware**: AI understands your files, workspace, and conversation history
- **Real-time Processing**: Instant AI responses with loading indicators

### 🌐 Web Search Integration
- **Multi-Provider Search**: Support for Google, DuckDuckGo, and Bing search engines
- **AI-Enhanced Results**: Intelligent analysis and summarization of search results
- **Content Extraction**: Automatic extraction and processing of web content
- **Smart Caching**: Efficient caching system for improved performance
- **Rate Limiting**: Built-in protection against API abuse

### 📁 File Management System
- **Multi-format Support**: Upload and manage text files, images, and documents
- **Supported File Types**:
  - **Text Files**: `.txt`, `.md`, `.py`, `.js`, `.html`, `.css`, `.json`, `.xml`, `.csv`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.php`, `.java`, `.cpp`, `.c`, `.h`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`, `.scala`, `.r`, `.sql`, `.sh`, `.bash`, `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.log`
  - **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.svg`, `.webp`
  - **Documents**: `.pdf`, `.doc`, `.docx`, `.rtf`

- **File Operations**:
  - Drag & drop file upload
  - File browser with search and filtering
  - File viewer with syntax highlighting
  - Download and delete files
  - AI-powered file analysis and editing

### 💼 Workspace Management
- **Tabbed Interface**: Separate Files and Workspace sections
- **Text Selection**: Select any text to trigger AI actions
- **Action Buttons**: Quick access to Edit, Ask, and Agent modes
- **Session Management**: Persistent sessions with conversation history

### 🎨 Modern UI
- **Glass Morphism Design**: Beautiful, modern interface
- **Responsive Layout**: Works on desktop and mobile devices
- **Collapsible Sections**: Customize your workspace layout
- **Dark Theme**: Easy on the eyes for extended use

## Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Ollama installed and running locally
- At least one AI model pulled (e.g., `ollama pull llama2`)

### Installation
1. Clone or download this repository
2. Ensure Ollama is running: `ollama serve`
3. Pull a model: `ollama pull llama2`
4. Open `index.html` in your browser or serve it with a local server

### Usage

#### File Management
1. **Upload Files**: Drag and drop files into the upload area or click to browse
2. **Browse Files**: Use the file browser to view, search, and filter your files
3. **View Files**: Click on any file to open it in the viewer
4. **AI Actions**: Use the action buttons (✏️, ❓, 🤖) to interact with files using AI

#### Workspace
1. **Text Selection**: Select any text in the workspace to reveal action buttons
2. **AI Actions**: Choose from Edit, Ask, or Agent modes
3. **Conversation**: Chat with the AI assistant in the chat section

#### Web Search
1. **Search Interface**: Use the search bar in the chat section to perform web searches
2. **AI Analysis**: Get intelligent analysis and summaries of search results
3. **Content Extraction**: Automatically extract and process web content
4. **Search History**: View and manage your search history

#### AI Models
1. **Model Selection**: Choose from available Ollama models in the sidebar
2. **Automation Types**: Select the type of AI interaction you want
3. **Session Management**: Create new chats, clear sessions, or reset models

## Architecture

### Core Modules
- **AppController**: Main application orchestrator
- **AppState**: Session and state management
- **FileManager**: File storage and management with IndexedDB
- **FileUI**: File management user interface
- **UIManager**: UI interactions and updates
- **OllamaAPI**: AI model communication
- **Logger**: Comprehensive logging system

### Data Storage
- **IndexedDB**: Persistent file storage
- **localStorage**: Session and configuration persistence
- **Memory**: Active file content and conversation history

## Configuration

The application uses a configuration system that can be customized in `js/config.js`:

- **Model Settings**: Default model, endpoint configuration
- **UI Settings**: Animation preferences, display options
- **File Settings**: Maximum file size, supported types
- **Session Settings**: History limits, context management

### Deployment Configuration

When the application is deployed (e.g., on Vercel, Netlify, etc.), it automatically detects the deployed environment and configures Ollama endpoints to connect to your local Ollama instance:

- **Automatic Detection**: The app detects deployed environments and switches to localhost endpoints
- **Local Ollama Connection**: Uses `http://localhost:11434` for API calls when deployed
- **Custom Configuration**: Users can configure custom endpoints via the sidebar
- **Connection Status**: Real-time connection status monitoring in the sidebar

#### Using with Local Ollama

1. **Start Ollama**: Ensure Ollama is running locally: `ollama serve`
2. **Pull Models**: Pull at least one model: `ollama pull llama2`
3. **Access Deployed App**: Open the deployed application URL
4. **Check Connection**: Use the "Test Connection" button in the sidebar
5. **Configure if Needed**: Use the "Configure" button to set custom endpoints

#### Custom Endpoint Configuration

If you need to use a different Ollama endpoint:

1. Click the "⚙️ Configure" button in the Connection Status section
2. Enter your custom endpoint (e.g., `http://192.168.1.100:11434/api/generate`)
3. The app will test the connection and update the status

**Note**: For security reasons, ensure your Ollama instance is properly configured for network access if using a custom endpoint.

## Development

### Project Structure
```
LLM-OS/
├── css/                 # Stylesheets
│   ├── base.css        # Base styles and variables
│   ├── layout.css      # Layout components
│   ├── file-management.css # File management styles
│   └── ...
├── js/                 # JavaScript modules
│   ├── AppController.js # Main application controller
│   ├── FileManager.js  # File management system
│   ├── FileUI.js       # File management UI
│   └── ...
├── index.html          # Main application file
└── README.md           # This file
```

### Adding New Features
1. Create new modules in the `js/` directory
2. Add corresponding styles in `css/`
3. Update the main initialization in `main.js`
4. Document new features in this README

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Note: IndexedDB support is required for file persistence.

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests. 