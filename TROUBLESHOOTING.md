# AI Interview Assistant - Troubleshooting Guide

## 🚨 Common Issues and Solutions

### Issue 1: "Error injecting content script" or Extension Not Working

**Symptoms:**
- Error message in background.js console
- Extension icon appears but doesn't respond
- Audio capture fails to start

**Solutions:**

1. **Reload the Extension:**
   ```
   1. Go to chrome://extensions/
   2. Find "AI Interview Assistant"
   3. Click the reload button (🔄)
   4. Try again
   ```

2. **Check Permissions:**
   ```
   1. Go to chrome://extensions/
   2. Click "Details" on AI Interview Assistant
   3. Ensure all permissions are enabled:
      ✅ Read and change all your data on all websites
      ✅ Capture audio from tabs
      ✅ Access your tabs and browsing activity
   ```

3. **Reinstall Extension:**
   ```
   1. Remove extension from chrome://extensions/
   2. Reload the unpacked extension
   3. Grant all permissions when prompted
   ```

### Issue 2: No Audio Capture / "Could not start audio capture"

**Symptoms:**
- "Start Listening" button doesn't work
- No transcription appears
- Audio permission errors

**Solutions:**

1. **Grant Microphone Permissions:**
   ```
   1. Click the 🔒 or 🎤 icon in address bar
   2. Set microphone to "Allow"
   3. Refresh the page and try again
   ```

2. **Check Browser Audio Settings:**
   ```
   1. Go to chrome://settings/content/microphone
   2. Ensure microphone is not blocked
   3. Add your site to "Allow" list if needed
   ```

3. **Test Audio Permissions:**
   ```javascript
   // Run in browser console:
   navigator.mediaDevices.getUserMedia({audio: true})
     .then(() => console.log('✅ Audio permission granted'))
     .catch(err => console.log('❌ Audio permission denied:', err));
   ```

### Issue 3: Speech Recognition Not Working

**Symptoms:**
- Audio captures but no transcription
- "Speech recognition not supported" error

**Solutions:**

1. **Use Chrome/Chromium Browser:**
   - Speech Recognition API only works in Chrome-based browsers
   - Firefox and Safari are not supported

2. **Check Speech Recognition Availability:**
   ```javascript
   // Run in browser console:
   console.log('Speech Recognition:', 
     'webkitSpeechRecognition' in window ? '✅ Available' : '❌ Not Available');
   ```

3. **Enable Microphone for Speech Recognition:**
   ```
   1. Go to chrome://settings/content/microphone
   2. Ensure "Ask before accessing" is selected
   3. Allow microphone access when prompted
   ```

### Issue 4: AI Responses Not Generated

**Symptoms:**
- Questions are detected but no AI responses appear
- API key errors in console

**Solutions:**

1. **Check API Keys:**
   ```
   1. Open extension side panel
   2. Verify API keys are entered correctly:
      - AssemblyAI API key (for transcription)
      - Google Gemini API key (for AI responses)
   3. Click "Save" after entering keys
   ```

2. **Verify API Key Validity:**
   ```javascript
   // Test Gemini API key in browser console:
   fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       contents: [{ parts: [{ text: "Hello" }] }]
     })
   }).then(r => r.ok ? console.log('✅ API key valid') : console.log('❌ API key invalid'));
   ```

3. **Check Network Connectivity:**
   - Ensure internet connection is stable
   - Check if corporate firewall blocks API calls
   - Try disabling VPN if using one

### Issue 5: Context Upload Not Working

**Symptoms:**
- Job description/resume upload fails
- Context not included in AI responses

**Solutions:**

1. **File Format Issues:**
   ```
   ✅ Supported: .txt, .pdf, .doc, .docx
   ❌ Not supported: .rtf, .pages, .odt
   ```

2. **File Size Limits:**
   ```
   Maximum file size: 5MB
   Recommended: Under 1MB for best performance
   ```

3. **Manual Text Entry:**
   ```
   1. Copy text from your document
   2. Paste directly into text areas
   3. Click "Save Context"
   ```

## 🔧 Debug Tools

### Using Debug Console

1. **Load Debug Tools:**
   ```javascript
   // In any browser console, load the debug script:
   const script = document.createElement('script');
   script.src = chrome.runtime.getURL('debug-console.js');
   document.head.appendChild(script);
   ```

2. **Run Diagnostic Tests:**
   ```javascript
   // Test all systems:
   AIInterviewDebug.runAllTests();
   
   // Test specific functionality:
   AIInterviewDebug.testAudioPermissions();
   AIInterviewDebug.testSpeechRecognition();
   AIInterviewDebug.testQuestionDetection("What is your experience?");
   ```

### Extension Console Logs

1. **Background Script Console:**
   ```
   1. Go to chrome://extensions/
   2. Enable "Developer mode"
   3. Click "service worker" link under AI Interview Assistant
   4. Check console for errors
   ```

2. **Content Script Console:**
   ```
   1. Open Developer Tools (F12)
   2. Go to Console tab
   3. Look for content script messages
   4. Check for errors in red
   ```

## 🚀 Performance Optimization

### Reduce Latency

1. **Use Wired Internet Connection**
2. **Close Unnecessary Browser Tabs**
3. **Disable Browser Extensions Temporarily**
4. **Use Chrome Incognito Mode** (fewer extensions/cache)

### Improve Accuracy

1. **Use Good Quality Microphone**
2. **Minimize Background Noise**
3. **Speak Clearly and at Normal Pace**
4. **Position Microphone 6-12 inches from Mouth**

## 📋 System Requirements

### Minimum Requirements:
- Chrome 88+ or Chromium-based browser
- 4GB RAM
- Stable internet connection (5+ Mbps)
- Microphone access

### Recommended:
- Chrome 100+
- 8GB+ RAM
- High-speed internet (25+ Mbps)
- External microphone or headset

## 🆘 Getting Help

### Before Reporting Issues:

1. **Check Browser Console for Errors**
2. **Test with Debug Console**
3. **Try in Incognito Mode**
4. **Disable Other Extensions**
5. **Restart Browser**

### Reporting Bugs:

Include this information:
```
Browser: Chrome Version X.X.X
OS: Windows/Mac/Linux
Error Message: [Copy exact error]
Steps to Reproduce: [Detailed steps]
Console Logs: [Copy relevant console output]
API Keys Status: [Working/Not Working - don't share actual keys]
```

### Quick Fixes Checklist:

- [ ] Extension permissions granted
- [ ] Microphone permissions enabled
- [ ] API keys entered and saved
- [ ] Using Chrome/Chromium browser
- [ ] Internet connection stable
- [ ] No firewall blocking API calls
- [ ] Extension reloaded recently
- [ ] Browser restarted recently

---

💡 **Pro Tip:** Most issues are resolved by reloading the extension and granting proper permissions. Always try this first!