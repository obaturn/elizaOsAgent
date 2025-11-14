#!/usr/bin/env node

/**
 * ElizaOS News Agent for Sui Times
 *
 * This agent monitors Twitter and other sources for Sui-related news
 * and posts updates to the Sui Times API.
 *
 * To run: node elizaos-news-agent.js
 */

require('dotenv').config();
const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.SUI_TIMES_API_URL || 'http://localhost:3000';
const NEWS_API_ENDPOINT = `${API_BASE_URL.replace(/\/$/, '')}/api/news/live`;

// Twitter API Configuration (you'll need to provide these)
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const SUI_KEYWORDS = ['sui', 'sui blockchain', 'sui network', 'sui crypto', 'mysten labs', '"Sui Network"', '"Sui Blockchain"', '"Mysten Labs"', '"Sui mainnet"', '"Sui DeFi"', '"Sui NFT"', 'sui OR mysten OR "sui blockchain"'];
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

console.log('🔧 Configuration:');
console.log(`API_BASE_URL: ${API_BASE_URL}`);
console.log(`NEWS_API_ENDPOINT: ${NEWS_API_ENDPOINT}`);
console.log(`TWITTER_BEARER_TOKEN: ${TWITTER_BEARER_TOKEN ? 'Set' : 'Not set'}`);

class ElizaNewsAgent {
  constructor() {
    this.lastCheckedTweets = new Set();
    this.isRunning = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
    // Added logging for deployment tracking
  }

  async start() {
    this.log('🚀 Starting ElizaOS News Agent for Sui Times');
    this.isRunning = true;

    // Initial check
    await this.checkForNews();

    // Set up interval for continuous monitoring
    setInterval(async () => {
      if (this.isRunning) {
        await this.checkForNews();
      }
    }, CHECK_INTERVAL);

    this.log(`⏰ Agent will check for news every ${CHECK_INTERVAL / 1000 / 60} minutes`);
  }

  async stop() {
    this.log('🛑 Stopping ElizaOS News Agent');
    this.isRunning = false;
  }

  async checkForNews() {
    try {
      this.log('🔍 Checking for new Sui-related news...');

      // Check Twitter for Sui news
      await this.checkTwitterNews();

      // NEW: Check NewsAPI for cryptocurrency news
      await this.checkNewsAPI();

      // TODO: Re-enable CoinGecko when API is stable
      // await this.checkCoinGeckoNews();

      // Check other sources (add more as needed)
      await this.checkAdditionalSources();

    } catch (error) {
      this.log(`Error checking for news: ${error.message}`, 'error');
    }
  }

  async checkTwitterNews() {
    if (!TWITTER_BEARER_TOKEN) {
      this.log('Twitter Bearer Token not configured, skipping Twitter checks', 'error');
      return;
    }

    try {
      // Search for Sui-related tweets
      const query = `(${SUI_KEYWORDS.join(' OR ')}) -is:retweet lang:en`;
      const twitterUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id,text&user.fields=username,name&expansions=author_id`;

      const response = await this.makeRequest(twitterUrl, {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.data && response.data.length > 0) {
        // Create user map
        const userMap = {};
        if (response.includes?.users) {
          response.includes.users.forEach(user => {
            userMap[user.id] = user.username;
          });
        }

        // Process new tweets
        for (const tweet of response.data) {
          if (!this.lastCheckedTweets.has(tweet.id)) {
            await this.processTweet(tweet, userMap);
            this.lastCheckedTweets.add(tweet.id);
          }
        }

        // Keep only recent tweet IDs (prevent memory leak)
        if (this.lastCheckedTweets.size > 1000) {
          const recentTweets = Array.from(this.lastCheckedTweets).slice(-500);
          this.lastCheckedTweets = new Set(recentTweets);
        }
      }

    } catch (error) {
      this.log(`Error checking Twitter: ${error.message}`, 'error');
    }
  }

  async checkAdditionalSources() {
    // Add checks for other news sources here
    // Examples: Sui blog RSS, Discord announcements, etc.

    // For now, we'll simulate occasional news from other sources
    if (Math.random() < 0.02) { // 2% chance every check
      const mockNews = this.generateMockNews();
      if (mockNews) {
        await this.postNewsToAPI(mockNews);
      }
    }
  }

  async checkCoinGeckoNews() {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/news', {
        headers: {
          'User-Agent': 'ElizaOS-News-Agent/1.0'
        }
      });
      const data = await response.json();
      console.log('CoinGecko response:', JSON.stringify(data, null, 2));
      const newsData = data.data || data;

      if (!Array.isArray(newsData)) {
        this.log('Unexpected CoinGecko response format', 'error');
        return;
      }

      const suiNews = newsData.filter(item =>
        item.title?.toLowerCase().includes('sui') ||
        item.description?.toLowerCase().includes('sui') ||
        item.title?.toLowerCase().includes('mysten')
      );

      for (const item of suiNews.slice(0, 2)) {
        const newsItem = {
          title: item.title,
          category: 'market',
          source: 'CoinGecko',
          urgent: item.pinned || false
        };

        await this.postNewsToAPI(newsItem);
        this.log(`📈 Posted CoinGecko news: ${item.title}`, 'success');
      }
    } catch (error) {
      this.log(`❌ CoinGecko fetch error: ${error.message || error}`, 'error');
    }
  }

  async checkNewsAPI() {
    try {
      const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '49b55a0bb8e741b5918352b20a6c373f';
      const url = `https://newsapi.org/v2/everything?q=sui+blockchain+OR+mysten+labs&apiKey=${NEWSAPI_KEY}&pageSize=3`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.articles) {
        for (const article of data.articles.slice(0, 2)) {
          const newsItem = {
            title: article.title,
            category: 'news',
            source: article.source?.name || 'NewsAPI',
            urgent: false
          };

          await this.postNewsToAPI(newsItem);
          this.log(`📰 Posted NewsAPI news: ${article.title}`, 'success');
        }
      }
    } catch (error) {
      this.log(`❌ NewsAPI fetch error: ${error.message}`, 'error');
    }
  }

  async processTweet(tweet, userMap) {
    const username = userMap[tweet.author_id] || 'Unknown';

    // Categorize the tweet
    const category = this.categorizeContent(tweet.text);
    const isUrgent = this.isUrgentNews(tweet.text);

    // Create news item
    const newsItem = {
      title: tweet.text.length > 100 ? tweet.text.substring(0, 100) + '...' : tweet.text,
      category,
      source: `Twitter @${username}`,
      urgent: isUrgent
    };

    await this.postNewsToAPI(newsItem);
  }

  categorizeContent(text) {
    const lowerText = text.toLowerCase();
    console.log('Categorizing text:', lowerText);
    if (lowerText.includes('breaking') || lowerText.includes('urgent') || lowerText.includes('announcement')) {
      return 'breaking';
    }
    if (lowerText.includes('defi') || lowerText.includes('yield') || lowerText.includes('liquidity') || lowerText.includes('staking')) {
      return 'defi';
    }
    if (lowerText.includes('nft') || lowerText.includes('collection') || lowerText.includes('marketplace')) {
      return 'nft';
    }
    if (lowerText.includes('update') || lowerText.includes('upgrade') || lowerText.includes('protocol')) {
      return 'tech';
    }

    return 'breaking'; 
    // Default category
    console.log('Defaulting to breaking category');
  }

  isUrgentNews(text) {
    const urgentKeywords = ['breaking', 'urgent', 'announcement', 'launch', 'mainnet', 'upgrade'];
    return urgentKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  generateMockNews() {
    const mockNewsItems = [
      {
        title: "Sui Foundation Announces New Grant Program",
        category: "breaking",
        source: "Sui Foundation",
        urgent: false
      },
      {
        title: "New DeFi Protocol Integrates with Sui",
        category: "defi",
        source: "DeFi News",
        urgent: false
      },
      {
        title: "Major NFT Collection Launches on Sui",
        category: "nft",
        source: "NFT Marketplace",
        urgent: false
      }
    ];

    return mockNewsItems[Math.floor(Math.random() * mockNewsItems.length)];
  }

  async postNewsToAPI(newsItem) {
    try {
      this.log(`📤 Posting news to ${NEWS_API_ENDPOINT}: ${JSON.stringify(newsItem)}`);
      const response = await this.makeRequest(NEWS_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newsItem)
      });
      this.log(`📥 API response: ${JSON.stringify(response)}`);

      if (response.success) {
        this.log(`✅ Posted news: "${newsItem.title}"`, 'success');
      } else {
        this.log(`Failed to post news: ${response.error || 'No success field in response'}`, 'error');
      }

    } catch (error) {
      this.log(`Error posting news to API: ${error.message}`, 'error');
    }
  }

  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      const urlObj = new URL(url);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = protocol.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = data ? JSON.parse(data) : {};
            resolve(parsedData);
          } catch (error) {
            resolve(data);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async findAvailablePort(startPort) {
    const net = require('net');
    return new Promise((resolve, reject) => {
      const tempServer = net.createServer();
      tempServer.listen(startPort, () => {
        const port = tempServer.address().port;
        tempServer.close(() => {
          resolve(port);
        });
      });
      tempServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          this.log(`Port ${startPort} is in use, trying ${startPort + 1}`);
          this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new ElizaNewsAgent();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
  });

  // Start dummy HTTP server for Render compatibility
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ElizaOS News Agent is running\n');
  });

  const startPort = process.env.PORT || 3000;
  agent.findAvailablePort(startPort).then(availablePort => {
    agent.log(`🔍 Found available port: ${availablePort}`);
    server.listen(availablePort, () => {
      console.log(`Server running on port ${availablePort}`);
    });

    agent.start().catch(error => {
      console.error('Failed to start ElizaOS News Agent:', error);
      process.exit(1);
    });
  }).catch(error => {
    agent.log(`Failed to find available port starting from ${startPort}: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = ElizaNewsAgent;