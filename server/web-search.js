/**
 * Web Search Backend Proxy
 * Handles content extraction and provides unified web search API
 */
const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');

class WebSearchProxy {
  constructor() {
    this.contentCache = new Map();
    this.extractionTimeout = 10000; // 10 seconds
    this.maxContentLength = 50000; // 50KB
  }

  async extractContent(url) {
    const cacheKey = this.generateCacheKey(url);
    
    // Check cache first
    if (this.contentCache.has(cacheKey)) {
      const cached = this.contentCache.get(cacheKey);
      if (!this.isCacheExpired(cached.timestamp)) {
        return cached.content;
      } else {
        this.contentCache.delete(cacheKey);
      }
    }

    try {
      const content = await this.fetchAndExtractContent(url);
      
      // Cache the result
      this.contentCache.set(cacheKey, {
        content,
        timestamp: Date.now()
      });

      return content;
    } catch (error) {
      console.error('Content extraction failed:', error);
      throw error;
    }
  }

  async fetchAndExtractContent(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Content extraction timeout'));
      }, this.extractionTimeout);

      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'LLM-OS/1.0 (Web Content Extractor)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };

      const req = client.request(options, (res) => {
        clearTimeout(timeout);
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          data += chunk;
          
          // Check content length limit
          if (data.length > this.maxContentLength) {
            req.destroy();
            reject(new Error('Content too large'));
            return;
          }
        });
        
        res.on('end', () => {
          try {
            const extractedContent = this.extractTextFromHTML(data);
            resolve(extractedContent);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      req.end();
    });
  }

  extractTextFromHTML(html) {
    // Simple HTML to text extraction
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  generateCacheKey(url) {
    return Buffer.from(url).toString('base64');
  }

  isCacheExpired(timestamp) {
    const ttl = 3600000; // 1 hour
    return Date.now() - timestamp > ttl;
  }

  clearCache() {
    this.contentCache.clear();
  }

  getCacheStats() {
    return {
      size: this.contentCache.size,
      keys: Array.from(this.contentCache.keys())
    };
  }

  // DuckDuckGo search methods
  async searchDuckDuckGo(query) {
    try {
      // Try instant answer API first
      const instantAnswer = await this.searchDuckDuckGoInstant(query);
      if (instantAnswer && instantAnswer.length > 0) {
        return instantAnswer;
      }

      // Fallback to web search
      return await this.searchDuckDuckGoWeb(query);
    } catch (error) {
      console.error('DuckDuckGo search failed:', error);
      throw error;
    }
  }

  async searchDuckDuckGoInstant(query) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1'
      });

      const url = `https://api.duckduckgo.com/?${params.toString()}`;
      
      https.get(url, {
        headers: {
          'User-Agent': 'LLM-OS/1.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`DuckDuckGo API error: ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const results = this.parseDuckDuckGoInstantResponse(jsonData, query);
            resolve(results);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  async searchDuckDuckGoWeb(query) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ q: query });
      const url = `https://html.duckduckgo.com/html/?${params.toString()}`;
      
      https.get(url, {
        headers: {
          'User-Agent': 'LLM-OS/1.0',
          'Accept': 'text/html'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`DuckDuckGo web search error: ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const results = this.parseDuckDuckGoWebResults(data, query);
            resolve(results);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  parseDuckDuckGoInstantResponse(data, query) {
    const results = [];

    // Add instant answer if available
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || '',
        snippet: data.AbstractText,
        content: data.AbstractText,
        relevance: 1.0,
        language: 'en'
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
            content: topic.Text,
            relevance: 0.8,
            language: 'en'
          });
        }
      });
    }

    // Add definition if available
    if (data.Definition) {
      results.push({
        title: `Definition: ${data.Heading || query}`,
        url: data.DefinitionURL || '',
        snippet: data.Definition,
        content: data.Definition,
        relevance: 0.9,
        language: 'en'
      });
    }

    return results;
  }

  parseDuckDuckGoWebResults(html, query) {
    const results = [];
    
    // Simple HTML parsing for search results
    const resultPattern = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    let match;
    
    while ((match = resultPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();
      
      // Filter out non-result links
      if (url && title && 
          !url.startsWith('#') && 
          !url.startsWith('javascript:') &&
          title.length > 10 &&
          results.length < 10) {
        
        results.push({
          title: title,
          url: url,
          snippet: title,
          content: title,
          relevance: 0.7,
          language: 'en'
        });
      }
    }

    return results;
  }
}

const webSearchProxy = new WebSearchProxy();

// Content extraction endpoint
router.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Extracting content from: ${url}`);
    const content = await webSearchProxy.extractContent(url);
    
    res.json({ content });
  } catch (error) {
    console.error('Content extraction error:', error);
    res.status(500).json({ 
      error: 'Content extraction failed', 
      message: error.message 
    });
  }
});

// DuckDuckGo search endpoint
router.post('/search/duckduckgo', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`Searching DuckDuckGo for: ${query}`);
    const results = await webSearchProxy.searchDuckDuckGo(query);
    
    res.json({ results });
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    res.status(500).json({ 
      error: 'DuckDuckGo search failed', 
      message: error.message 
    });
  }
});

// Cache management endpoints
router.get('/cache/stats', (req, res) => {
  res.json(webSearchProxy.getCacheStats());
});

router.delete('/cache', (req, res) => {
  webSearchProxy.clearCache();
  res.json({ message: 'Cache cleared' });
});

module.exports = router; 