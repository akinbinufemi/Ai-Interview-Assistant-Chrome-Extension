# Deployment Guide

This guide will walk you through deploying the AI Interview Assistant backend to Netlify and configuring the Chrome extension.

## Prerequisites

Before starting, ensure you have:
- Node.js (v16 or later) installed
- A Netlify account
- A MongoDB Atlas account (free tier available)
- API keys for your chosen AI providers

## Step 1: Backend Deployment

### 1.1 Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ai-interview-assistant.git
cd ai-interview-assistant

# Install dependencies
npm install
```

### 1.2 MongoDB Atlas Setup

1. **Create Account**: Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**: 
   - Choose the free M0 tier
   - Select a region close to your users
   - Name your cluster (e.g., "interview-assistant")
3. **Create Database User**:
   - Go to Database Access → Add New Database User
   - Choose password authentication
   - Set username and password (save these!)
   - Grant "Atlas admin" role for simplicity
4. **Configure Network Access**:
   - Go to Network Access → Add IP Address
   - Add `0.0.0.0/0` to allow access from anywhere (for Netlify functions)
   - Or add specific Netlify IP ranges for better security
5. **Get Connection String**:
   - Go to Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/interview_assistant?retryWrites=true&w=majority`

### 1.3 Netlify Deployment

#### Option A: Deploy via Netlify CLI (Recommended)

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy to production
netlify deploy --prod
```

#### Option B: Deploy via Git Integration

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify Dashboard](https://app.netlify.com/)
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `.`
   - Click "Deploy site"

### 1.4 Configure Environment Variables

1. **Go to Site Settings**: In your Netlify dashboard, click on your site
2. **Environment Variables**: Navigate to Site settings → Environment variables
3. **Add Variables**:
   ```
   MONGODB_URI = mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/interview_assistant?retryWrites=true&w=majority
   ```

### 1.5 Test Deployment

```bash
# Test the save-transcript function
curl -X POST https://your-site-name.netlify.app/.netlify/functions/save-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "timestamp": "2024-01-01T12:00:00Z",
    "text": "Test transcript",
    "context": {
      "jobDescription": "Test job",
      "resume": "Test resume"
    }
  }'

# Test the get-transcripts function
curl https://your-site-name.netlify.app/.netlify/functions/get-transcripts
```

## Step 2: Chrome Extension Configuration

### 2.1 Update Backend URL

1. **Edit background.js**: Update the `BACKEND_URL` constant:
   ```javascript
   const BACKEND_URL = 'https://your-site-name.netlify.app/.netlify/functions';
   ```

2. **Update manifest.json**: Add your Netlify domain to host permissions:
   ```json
   "host_permissions": [
     "https://api.assemblyai.com/*",
     "https://generativelanguage.googleapis.com/*",
     "https://api.openai.com/*",
     "https://your-site-name.netlify.app/*"
   ]
   ```

### 2.2 Load Extension in Chrome

1. **Open Chrome Extensions**: Navigate to `chrome://extensions/`
2. **Enable Developer Mode**: Toggle the switch in the top right
3. **Load Unpacked**: Click "Load unpacked" and select your extension directory
4. **Verify Installation**: The extension should appear in your extensions list

## Step 3: API Keys Setup

### 3.1 OpenAI API Key

1. **Get API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Create Key**: Click "Create new secret key"
3. **Add to Extension**: 
   - Open the extension side panel
   - Select "OpenAI GPT" as provider
   - Enter your API key and save

### 3.2 Google Gemini API Key

1. **Get API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Create Key**: Click "Create API key"
3. **Add to Extension**:
   - Select "Google Gemini" as provider
   - Enter your API key and save

### 3.3 AssemblyAI API Key

1. **Sign Up**: Create account at [AssemblyAI](https://www.assemblyai.com/)
2. **Get Key**: Find your API key in the dashboard
3. **Add to Extension**: Enter in the AssemblyAI field and save

## Step 4: Testing

### 4.1 Test Audio Capture

1. **Grant Permissions**: Ensure microphone access is granted
2. **Start Listening**: Click "Start Listening" in the extension
3. **Speak**: Say a test question like "What is your experience with JavaScript?"
4. **Verify**: Check that transcription appears and AI responds

### 4.2 Test Context Features

1. **Add Job Description**: Paste a sample job posting
2. **Add Resume**: Include your background information
3. **Save Context**: Click "Save Context"
4. **Test Response**: Ask a relevant question and verify the AI uses context

### 4.3 Test Transcript Storage

1. **Generate Transcript**: Have a short conversation
2. **Save Transcript**: Click "Save Transcript"
3. **Check History**: Verify it appears in the transcript history
4. **Verify Backend**: Check your MongoDB database for the stored transcript

## Step 5: Production Considerations

### 5.1 Security

- **Environment Variables**: Never commit API keys to version control
- **CORS Configuration**: Restrict origins in production
- **Rate Limiting**: Implement rate limiting for your functions
- **Input Validation**: Add comprehensive input validation

### 5.2 Monitoring

- **Netlify Analytics**: Monitor function usage and errors
- **MongoDB Monitoring**: Set up alerts for database usage
- **API Usage**: Monitor API key usage and costs

### 5.3 Scaling

- **Function Optimization**: Optimize cold start times
- **Database Indexing**: Add indexes for better query performance
- **CDN**: Use Netlify's CDN for static assets
- **Caching**: Implement appropriate caching strategies

## Troubleshooting

### Common Issues

#### Functions Not Deploying
```bash
# Check build logs
netlify logs

# Redeploy with verbose output
netlify deploy --prod --debug
```

#### Database Connection Issues
- Verify MongoDB URI is correct
- Check network access settings in MongoDB Atlas
- Ensure database user has proper permissions

#### CORS Errors
- Verify host permissions in manifest.json
- Check CORS headers in function responses
- Test with browser developer tools

#### API Key Issues
- Verify keys are saved correctly in extension storage
- Check API provider dashboards for usage limits
- Test keys with direct API calls

### Debug Mode

Enable debug mode for more verbose logging:

```javascript
// In background.js, add:
const DEBUG = true;

function debugLog(message, data) {
  if (DEBUG) {
    console.log(`[AI Assistant Debug] ${message}`, data);
  }
}
```

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify all API keys are valid and have sufficient credits
3. Test backend functions directly with curl
4. Check Netlify function logs for server-side errors
5. Review MongoDB Atlas logs for database issues

For additional support, create an issue in the GitHub repository with:
- Detailed error messages
- Browser and extension version
- Steps to reproduce the issue
- Screenshots if applicable