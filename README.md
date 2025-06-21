# LLM-OS: AI-Powered Application Interface

A web-based application that integrates with Ollama AI models to provide intelligent assistance with context awareness and session management.

## Features

- 🤖 **AI Integration**: Connect to any Ollama model
- 🧠 **Context Awareness**: Maintains conversation history and user context
- 💾 **Session Management**: Persistent sessions across browser refreshes
- 🎯 **Smart Actions**: Edit, Ask, and Agent actions on selected text
- 🔄 **State Persistence**: Automatic save/load of conversations and context

## Setup

### Prerequisites

1. **Node.js** (v14 or higher)
2. **Ollama** installed and running locally

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Ollama:**
   ```bash
   # Make sure Ollama is running on localhost:11434
   ollama serve
   ```

3. **Pull a model (optional):**
   ```bash
   # Example: Pull Llama 3.2
   ollama pull llama3.2
   ```

4. **Start the proxy server:**
   ```bash
   npm start
   ```

5. **Open the application:**
   Navigate to `http://localhost:3000` in your browser

## Usage

### Basic Chat
- Type messages in the chat input
- Press Enter or click Send to get AI responses
- Conversations persist across browser sessions

### Context Actions
1. **Select text** in the user section
2. **Action buttons** will appear (Edit, Ask, Agent)
3. **Click an action** to perform context-aware operations

### Available Models
The application automatically detects available Ollama models. You can change models by:
- Pulling new models with `ollama pull <model-name>`
- The app will detect and use available models

## Architecture

### Components

- **AppState**: Manages session, context, and conversation history
- **OllamaAPI**: Handles communication with Ollama models
- **UIManager**: Manages user interface and interactions
- **AppController**: Main application logic and coordination

### Data Flow

1. User input → AppController
2. Context building → AI prompt generation
3. Ollama API call → Response processing
4. State update → UI refresh

## Troubleshooting

### CORS Issues
The proxy server handles CORS automatically. If you see CORS errors:
- Make sure the proxy server is running (`npm start`)
- Check that Ollama is running on `localhost:11434`

### Model Not Found
- Ensure the model is pulled: `ollama pull <model-name>`
- Check available models: `ollama list`

### Connection Issues
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check proxy server logs for errors

## Development

### Running in Development Mode
```bash
npm run dev
```

### File Structure
```
LLM-OS/
├── index.html          # Main application
├── server.js           # Proxy server
├── package.json        # Dependencies
└── README.md          # This file
```

## API Endpoints

The proxy server forwards these endpoints to Ollama:
- `POST /api/generate` - Generate text responses
- `GET /api/tags` - List available models

## License

MIT License 