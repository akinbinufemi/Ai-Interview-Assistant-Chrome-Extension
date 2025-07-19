let recognition;
let assistantWindowId = null;
let currentStreamId = null;
let currentTabId = null;
let interviewContext = { jobDescription: '', resume: '' };
let apiKeys = {};

// Netlify backend URL - replace with your actual Netlify function URL
const BACKEND_URL = 'https://sparkling-tiramisu-90d945.netlify.app/.netlify/functions';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case 'startListening':
      startListening();
      break;
    case 'stopListening':
      stopListening();
      break;
    case 'setApiKey':
      setApiKey(request.provider, request.apiKey);
      break;
    case 'setContext':
      setInterviewContext(request.context);
      break;
    case 'getAIResponse':
      getAIResponse(request.question);
      break;
    case 'saveTranscriptToBackend':
      saveTranscriptToBackend(request.transcript);
      break;
    case 'transcribeAudio':
      // Handle audio transcription from content script
      if (request.audioData) {
        transcribeWithAssemblyAI(request.audioData);
      }
      break;
    case 'status':
      // Forward status messages to UI
      chrome.runtime.sendMessage({
        action: 'status',
        message: request.message,
        type: request.type
      });
      break;
    case 'error':
      // Forward error messages to UI
      console.error('Content script error:', request.message);
      chrome.runtime.sendMessage({
        action: 'error',
        message: request.message
      });
      break;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === assistantWindowId) {
    assistantWindowId = null;
  }
});

function setApiKey(provider, apiKey) {
  apiKeys[provider] = apiKey;
  chrome.storage.sync.set({ [`${provider}ApiKey`]: apiKey });
}

function setInterviewContext(context) {
  interviewContext = context;
  chrome.storage.sync.set({
    jobDescription: context.jobDescription,
    resume: context.resume
  });
}

async function loadStoredData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'openaiApiKey', 'geminiApiKey', 'assemblyaiApiKey',
      'jobDescription', 'resume', 'aiProvider'
    ], (result) => {
      if (result.openaiApiKey) apiKeys.openai = result.openaiApiKey;
      if (result.geminiApiKey) apiKeys.gemini = result.geminiApiKey;
      if (result.assemblyaiApiKey) apiKeys.assemblyai = result.assemblyaiApiKey;
      
      interviewContext = {
        jobDescription: result.jobDescription || '',
        resume: result.resume || ''
      };
      
      resolve(result);
    });
  });
}

function startListening() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error('Error querying tabs:', chrome.runtime.lastError);
      sendStatusMessage('Error: Could not access current tab', 'error');
      return;
    }
    if (tabs.length === 0) {
      console.error('No active tab found');
      sendStatusMessage('Error: No active tab found', 'error');
      return;
    }
    
    currentTabId = tabs[0].id;
    if (typeof currentTabId === 'undefined') {
      console.error('Active tab ID is undefined');
      sendStatusMessage('Error: Invalid tab', 'error');
      return;
    }
    
    chrome.tabCapture.getMediaStreamId({ consumerTabId: currentTabId }, (streamId) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting media stream ID:', chrome.runtime.lastError);
        sendStatusMessage('Error: Could not capture audio', 'error');
        return;
      }
      
      currentStreamId = streamId;
      injectContentScriptAndStartCapture(currentTabId, streamId);
    });
  });
}

function injectContentScriptAndStartCapture(tabId, streamId) {
  console.log('Starting capture for tab:', tabId, 'with streamId:', streamId);
  
  // Since content script is now registered in manifest, we can directly send the message
  // But we'll still inject as fallback for reliability
  const tryStartCapture = () => {
    chrome.tabs.sendMessage(tabId, { 
      action: 'startCapture', 
      streamId: streamId,
      useAssemblyAI: !!apiKeys.assemblyai
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting capture:', chrome.runtime.lastError);
        sendStatusMessage('Error: Could not start audio capture - ' + chrome.runtime.lastError.message, 'error');
      } else if (response && response.success) {
        console.log('Capture started successfully:', response.message);
        sendStatusMessage('Audio capture started successfully', 'success');
      } else if (response && !response.success) {
        console.error('Capture failed:', response.error);
        sendStatusMessage('Error: ' + response.error, 'error');
      } else {
        console.log('Capture command sent, no response received');
        sendStatusMessage('Audio capture command sent', 'info');
      }
    });
  };

  // Try to inject content script as fallback
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.log('Content script injection failed (may already be injected):', chrome.runtime.lastError);
      // Try to start capture anyway, content script might already be loaded
      setTimeout(tryStartCapture, 100);
    } else {
      console.log('Content script injected successfully');
      // Wait a bit to ensure the content script is fully loaded
      setTimeout(tryStartCapture, 500);
    }
  });
}

function stopListening() {
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'stopCapture' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error stopping capture:', chrome.runtime.lastError);
      } else {
        console.log('Capture stopped successfully');
      }
    });
  }
  
  currentStreamId = null;
  currentTabId = null;
}

function isQuestion(text) {
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'will', 'shall'];
  const lowerText = text.toLowerCase();
  return questionWords.some(word => lowerText.startsWith(word + ' ')) || 
         text.includes('?') || 
         lowerText.includes('tell me') || 
         lowerText.includes('explain');
}

async function getAIResponse(question) {
  try {
    await loadStoredData();
    
    const provider = await getStoredValue('aiProvider') || 'openai';
    const apiKey = apiKeys[provider];
    
    if (!apiKey) {
      throw new Error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not set`);
    }

    console.log(`Sending request to ${provider} API...`);
    
    const contextPrompt = buildContextPrompt(question);
    let response;
    
    if (provider === 'openai') {
      response = await getOpenAIResponse(apiKey, contextPrompt);
    } else if (provider === 'gemini') {
      response = await getGeminiResponse(apiKey, contextPrompt);
    }
    
    chrome.runtime.sendMessage({action: 'updateAIResponse', response: response});
  } catch (error) {
    console.error('Error getting AI response:', error);
    const errorMessage = 'Error: ' + error.message;
    chrome.runtime.sendMessage({action: 'updateAIResponse', response: errorMessage});
    sendStatusMessage(errorMessage, 'error');
  }
}

function buildContextPrompt(question) {
  let prompt = `You are an AI interview assistant helping a candidate answer interview questions. Please provide a concise, professional response to the following question: "${question}"`;
  
  if (interviewContext.jobDescription) {
    prompt += `\n\nJob Description Context:\n${interviewContext.jobDescription}`;
  }
  
  if (interviewContext.resume) {
    prompt += `\n\nCandidate's Resume/Background:\n${interviewContext.resume}`;
  }
  
  prompt += `\n\nPlease provide a response that:
1. Directly answers the question
2. Is relevant to the job description (if provided)
3. Highlights relevant experience from the resume (if provided)
4. Is concise but complete (2-3 sentences)
5. Sounds natural and professional`;
  
  return prompt;
}

async function getOpenAIResponse(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful interview assistant that provides concise, professional responses." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function getGeminiResponse(apiKey, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function transcribeWithAssemblyAI(audioBlob) {
  try {
    const apiKey = apiKeys.assemblyai;
    if (!apiKey) {
      throw new Error('AssemblyAI API key not set');
    }

    // First, upload the audio file
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/octet-stream'
      },
      body: audioBlob
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Then, request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        auto_highlights: true
      })
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptResponse.status}`);
    }

    const { id } = await transcriptResponse.json();

    // Poll for completion
    return await pollTranscriptionStatus(apiKey, id);
  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    throw error;
  }
}

async function pollTranscriptionStatus(apiKey, transcriptId) {
  const maxAttempts = 30; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: {
        'authorization': apiKey
      }
    });

    const transcript = await response.json();

    if (transcript.status === 'completed') {
      return transcript.text;
    } else if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    // Wait 10 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 10000));
    attempts++;
  }

  throw new Error('Transcription timeout');
}

async function saveTranscriptToBackend(transcript) {
  try {
    const response = await fetch(`${BACKEND_URL}/save-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcript)
    });

    if (!response.ok) {
      throw new Error(`Backend save failed: ${response.status}`);
    }

    sendStatusMessage('Transcript saved to backend', 'success');
  } catch (error) {
    console.error('Error saving to backend:', error);
    sendStatusMessage('Warning: Could not save to backend', 'warning');
  }
}

function sendStatusMessage(message, type = 'info') {
  chrome.runtime.sendMessage({
    action: 'status',
    message: message,
    type: type
  });
}

async function getStoredValue(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      resolve(result[key]);
    });
  });
}

// Initialize stored data on startup
loadStoredData();