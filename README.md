# Sui Eliza News Agent

ElizaOS News Agent for Sui Times - monitors Twitter for Sui-related news and posts updates to the Sui Times API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```bash
SUI_TIMES_API_URL=http://localhost:3000
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Deployment

### Railway
1. Push this code to a GitHub repository
2. Connect repository to Railway
3. Set environment variables in Railway dashboard
4. Deploy

### Environment Variables
- `SUI_TIMES_API_URL`: URL of your Sui Times frontend API
- `TWITTER_BEARER_TOKEN`: Twitter API Bearer Token

## Features

- Monitors Twitter for Sui-related keywords
- Categorizes news (breaking, defi, nft, tech)
- Posts updates to Sui Times API every 5 minutes
- Handles duplicate prevention
- Graceful error handling

## API Endpoints

The agent posts to: `{SUI_TIMES_API_URL}/api/news/live`

Example payload:
```json
{
  "title": "Sui Network Update...",
  "category": "breaking",
  "source": "Twitter @username",
  "urgent": true
}