let audioContext;
let mediaStream;
let recognition;
let mediaRecorder;
let audioChunks = [];
let useAssemblyAI = false;
let isCapturing = false;

// Improved message listener with proper response handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startCapture') {
    useAssemblyAI = request.useAssemblyAI || false;
    startCapture(request.streamId)
      .then(() => {
        sendResponse({ success: true, message: 'Capture started successfully' });
      })
      .catch((error) => {
        console.error('Error in startCapture:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'stopCapture') {
    stopCapture();
    sendResponse({ success: true, message: 'Capture stopped successfully' });
  }
  
  return false;
});

async function startCapture(streamId) {
  if (isCapturing) {
    console.log('Already capturing, stopping previous session');
    stopCapture();
  }
  
  console.log('Starting capture with streamId:', streamId);
  
  try {
    // More robust audio constraints
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        },
        optional: [
          { echoCancellation: false },
          { autoGainControl: false },
          { noiseSuppression: false }
        ]
      }
    };
    
    console.log('Requesting media stream with constraints:', constraints);
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Media stream obtained:', stream);
    
    mediaStream = stream;
    isCapturing = true;
    
    // Initialize audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    
    console.log('Audio context created, sample rate:', audioContext.sampleRate);
    
    // Send success message
    chrome.runtime.sendMessage({
      action: 'status',
      message: 'Audio stream connected successfully',
      type: 'success'
    });

    // Setup transcription based on available options
    if (useAssemblyAI) {
      console.log('Setting up AssemblyAI recording');
      await setupAssemblyAIRecording(stream);
    }
    
    // Always setup Web Speech Recognition as primary or fallback
    console.log('Setting up Web Speech Recognition');
    setupWebSpeechRecognition();

  } catch (error) {
    console.error('Error starting capture:', error);
    isCapturing = false;
    
    // Send detailed error information
    chrome.runtime.sendMessage({
      action: 'error',
      message: `Failed to start audio capture: ${error.message}`,
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    
    throw error;
  }
}

async function setupAssemblyAIRecording(stream) {
  try {
    console.log('Setting up AssemblyAI recording');
    audioChunks = [];
    
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder not supported in this browser');
    }
    
    // Try different MIME types for better compatibility
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Use default
        }
      }
    }
    
    console.log('Using MIME type:', mimeType || 'default');
    
    const options = mimeType ? { mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      console.log('Audio data available, size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped, processing audio chunks');
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        console.log('Created audio blob, size:', audioBlob.size);
        sendAudioToAssemblyAI(audioBlob);
      }
    };

    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      chrome.runtime.sendMessage({
        action: 'error',
        message: 'Recording error: ' + error.message
      });
    };

    mediaRecorder.onstart = () => {
      console.log('MediaRecorder started');
      chrome.runtime.sendMessage({
        action: 'status',
        message: 'AssemblyAI recording started',
        type: 'success'
      });
    };

    // Start recording
    mediaRecorder.start();
    
    // Set up interval to process chunks every 30 seconds
    const recordingInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording' && isCapturing) {
        console.log('Processing audio chunk');
        mediaRecorder.stop();
        setTimeout(() => {
          if (mediaStream && mediaStream.active && isCapturing) {
            audioChunks = [];
            mediaRecorder.start();
          }
        }, 100);
      } else {
        clearInterval(recordingInterval);
      }
    }, 30000);

  } catch (error) {
    console.error('Error setting up AssemblyAI recording:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'AssemblyAI setup failed: ' + error.message
    });
  }
}

function setupWebSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error('Speech recognition not supported');
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Speech recognition not supported in this browser'
    });
    return;
  }

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';
    let restartTimeout;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      chrome.runtime.sendMessage({
        action: 'status',
        message: 'Speech recognition started',
        type: 'success'
      });
    };

    recognition.onresult = (event) => {
      console.log('Speech recognition result:', event);
      interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          console.log('Final transcript:', transcript);
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Display real-time transcript
      const displayTranscript = finalTranscript + interimTranscript;
      if (displayTranscript.trim() !== '') {
        chrome.runtime.sendMessage({
          action: 'updateTranscript', 
          transcript: displayTranscript.trim()
        });
        
        // Check if the final transcript contains a question
        if (finalTranscript.trim() !== '' && isQuestion(finalTranscript.trim())) {
          console.log('Question detected:', finalTranscript.trim());
          chrome.runtime.sendMessage({
            action: 'getAIResponse', 
            question: finalTranscript.trim()
          });
          finalTranscript = ''; // Reset after processing
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      chrome.runtime.sendMessage({
        action: 'error',
        message: 'Speech recognition error: ' + event.error
      });
      
      // Restart recognition after error (with delay)
      if (isCapturing && event.error !== 'aborted') {
        restartTimeout = setTimeout(() => {
          if (isCapturing && mediaStream && mediaStream.active) {
            console.log('Restarting speech recognition after error');
            try {
              recognition.start();
            } catch (e) {
              console.error('Error restarting recognition:', e);
            }
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Restart recognition if still capturing
      if (isCapturing && mediaStream && mediaStream.active) {
        restartTimeout = setTimeout(() => {
          if (isCapturing) {
            console.log('Restarting speech recognition');
            try {
              recognition.start();
            } catch (e) {
              console.error('Error restarting recognition:', e);
            }
          }
        }, 100);
      }
    };

    recognition.start();
    
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Failed to start speech recognition: ' + error.message
    });
  }
}

async function sendAudioToAssemblyAI(audioBlob) {
  try {
    // Convert webm to wav for better compatibility
    const wavBlob = await convertToWav(audioBlob);
    
    chrome.runtime.sendMessage({
      action: 'transcribeAudio',
      audioData: wavBlob
    });

  } catch (error) {
    console.error('Error processing audio for AssemblyAI:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Audio processing failed: ' + error.message
    });
  }
}

async function convertToWav(webmBlob) {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const fileReader = new FileReader();
    
    fileReader.onload = function(event) {
      audioContext.decodeAudioData(event.target.result)
        .then(audioBuffer => {
          const wavBlob = audioBufferToWav(audioBuffer);
          resolve(wavBlob);
        })
        .catch(reject);
    };
    
    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(webmBlob);
  });
}

function audioBufferToWav(buffer) {
  const length = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert audio data
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function sendAudioToAssemblyAI(audioBlob) {
  try {
    console.log('Sending audio to AssemblyAI, blob size:', audioBlob.size);
    
    // Convert webm to wav for better compatibility
    const wavBlob = await convertToWav(audioBlob);
    console.log('Converted to WAV, size:', wavBlob.size);
    
    chrome.runtime.sendMessage({
      action: 'transcribeAudio',
      audioData: wavBlob
    });

  } catch (error) {
    console.error('Error processing audio for AssemblyAI:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Audio processing failed: ' + error.message
    });
  }
}

async function convertToWav(webmBlob) {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const fileReader = new FileReader();
    
    fileReader.onload = function(event) {
      audioContext.decodeAudioData(event.target.result)
        .then(audioBuffer => {
          const wavBlob = audioBufferToWav(audioBuffer);
          resolve(wavBlob);
        })
        .catch(reject);
    };
    
    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(webmBlob);
  });
}

function audioBufferToWav(buffer) {
  const length = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert audio data
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function stopCapture() {
  console.log('Stopping capture');
  isCapturing = false;
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('Stopping MediaRecorder');
    mediaRecorder.stop();
  }
  
  if (mediaStream) {
    console.log('Stopping media stream tracks');
    mediaStream.getTracks().forEach(track => {
      track.stop();
      console.log('Stopped track:', track.kind);
    });
    mediaStream = null;
  }
  
  if (audioContext && audioContext.state !== 'closed') {
    console.log('Closing audio context');
    audioContext.close();
    audioContext = null;
  }
  
  if (recognition) {
    console.log('Stopping speech recognition');
    recognition.stop();
    recognition = null;
  }
  
  // Clear any chunks
  audioChunks = [];
  
  chrome.runtime.sendMessage({
    action: 'status',
    message: 'Audio capture stopped',
    type: 'info'
  });
}

function isQuestion(text) {
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'will', 'shall'];
  const lowerText = text.toLowerCase().trim();
  
  return questionWords.some(word => lowerText.startsWith(word + ' ')) || 
         text.includes('?') || 
         lowerText.includes('tell me') || 
         lowerText.includes('explain') ||
         lowerText.includes('describe') ||
         lowerText.includes('walk me through');
}