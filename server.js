const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Serve static files
app.use(express.static('.'));

// Proxy all /api/* requests to Ollama
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:11434',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api' // Keep the /api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy requests
    console.log(`Proxying ${req.method} ${req.url} to Ollama`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Proxying /api requests to http://localhost:11434`);
}); 