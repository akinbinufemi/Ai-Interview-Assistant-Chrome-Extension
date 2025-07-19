let audioContext;
let mediaStream;
let recognition;
let mediaRecorder;
let audioChunks = [];
let useAssemblyAI = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    useAssemblyAI = request.useAssemblyAI || false;
    startCapture(request.streamId);
  } else if (request.action === 'stopCapture') {
    stopCapture();
  }
});

function startCapture(streamId) {
  navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  }).then((stream) => {
    mediaStream = stream;
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // If AssemblyAI is available, use it for better transcription
    if (useAssemblyAI) {
      setupAssemblyAIRecording(stream);
    } else {
      setupWebSpeechRecognition();
    }
    
    // Always setup Web Speech Recognition as fallback
    setupWebSpeechRecognition();

  }).catch((error) => {
    console.error('Error starting capture:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Failed to start audio capture: ' + error.message
    });
  });
}

function setupAssemblyAIRecording(stream) {
  try {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      sendAudioToAssemblyAI(audioBlob);
    };

    // Record in 30-second chunks for real-time processing
    mediaRecorder.start();
    
    // Set up interval to process chunks
    setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setTimeout(() => {
          if (mediaStream && mediaStream.active) {
            audioChunks = [];
            mediaRecorder.start();
          }
        }, 100);
      }
    }, 30000);

    chrome.runtime.sendMessage({
      action: 'status',
      message: 'AssemblyAI recording started',
      type: 'success'
    });

  } catch (error) {
    console.error('Error setting up AssemblyAI recording:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'AssemblyAI setup failed, falling back to Web Speech API'
    });
  }
}

function setupWebSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Speech recognition not supported in this browser'
    });
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';
  let interimTranscript = '';

  recognition.onresult = function(event) {
    interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Display real-time transcript
    const displayTranscript = finalTranscript + interimTranscript;
    if (displayTranscript.trim() !== '') {
      chrome.runtime.sendMessage({
        action: 'updateTranscript', 
        transcript: displayTranscript
      });
      
      // Check if the final transcript contains a question
      if (finalTranscript.trim() !== '' && isQuestion(finalTranscript)) {
        chrome.runtime.sendMessage({
          action: 'getAIResponse', 
          question: finalTranscript.trim()
        });
      }
    }
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Speech recognition error: ' + event.error
    });
    
    // Restart recognition after error
    setTimeout(() => {
      if (mediaStream && mediaStream.active) {
        recognition.start();
      }
    }, 1000);
  };

  recognition.onend = function() {
    // Restart recognition if stream is still active
    if (mediaStream && mediaStream.active) {
      setTimeout(() => {
        recognition.start();
      }, 100);
    }
  };

  try {
    recognition.start();
    chrome.runtime.sendMessage({
      action: 'status',
      message: 'Speech recognition started',
      type: 'success'
    });
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    chrome.runtime.sendMessage({
      action: 'error',
      message: 'Failed to start speech recognition'
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

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  
  if (audioContext) {
    audioContext.close();
  }
  
  if (recognition) {
    recognition.stop();
  }
  
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