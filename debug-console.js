// Debug Console for AI Interview Assistant
// Use this in the browser console to test functionality

console.log('🎯 AI Interview Assistant Debug Console Loaded');

// Test functions
const AIInterviewDebug = {
  
  // Test if extension is loaded
  testExtension: () => {
    console.log('Testing extension availability...');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('✅ Chrome extension API available');
      console.log('Extension ID:', chrome.runtime.id);
      return true;
    } else {
      console.log('❌ Chrome extension API not available');
      return false;
    }
  },

  // Test audio permissions
  testAudioPermissions: async () => {
    console.log('Testing audio permissions...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Audio permission granted');
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.log('❌ Audio permission denied:', error.message);
      return false;
    }
  },

  // Test speech recognition
  testSpeechRecognition: () => {
    console.log('Testing speech recognition availability...');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      console.log('✅ Speech Recognition API available');
      return true;
    } else {
      console.log('❌ Speech Recognition API not available');
      return false;
    }
  },

  // Test tab capture permissions
  testTabCapture: () => {
    console.log('Testing tab capture permissions...');
    if (typeof chrome !== 'undefined' && chrome.tabCapture) {
      console.log('✅ Tab capture API available');
      return true;
    } else {
      console.log('❌ Tab capture API not available');
      return false;
    }
  },

  // Simulate question detection
  testQuestionDetection: (text) => {
    const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'will', 'shall'];
    const lowerText = text.toLowerCase().trim();
    
    const isQuestion = questionWords.some(word => lowerText.startsWith(word + ' ')) || 
           text.includes('?') || 
           lowerText.includes('tell me') || 
           lowerText.includes('explain') ||
           lowerText.includes('describe') ||
           lowerText.includes('walk me through') ||
           lowerText.includes('can you') ||
           lowerText.includes('would you');
           
    console.log(`Testing question: "${text}"`);
    console.log(isQuestion ? '✅ Detected as question' : '❌ Not detected as question');
    return isQuestion;
  },

  // Test all systems
  runAllTests: async () => {
    console.log('🚀 Running all AI Interview Assistant tests...\n');
    
    const results = {
      extension: AIInterviewDebug.testExtension(),
      audio: await AIInterviewDebug.testAudioPermissions(),
      speech: AIInterviewDebug.testSpeechRecognition(),
      tabCapture: AIInterviewDebug.testTabCapture()
    };

    console.log('\n📊 Test Results Summary:');
    console.log('Extension API:', results.extension ? '✅' : '❌');
    console.log('Audio Permissions:', results.audio ? '✅' : '❌');
    console.log('Speech Recognition:', results.speech ? '✅' : '❌');
    console.log('Tab Capture:', results.tabCapture ? '✅' : '❌');

    const allPassed = Object.values(results).every(result => result);
    console.log('\n🎯 Overall Status:', allPassed ? '✅ All tests passed!' : '❌ Some tests failed');

    if (!allPassed) {
      console.log('\n🔧 Troubleshooting Tips:');
      if (!results.extension) console.log('- Make sure the extension is installed and enabled');
      if (!results.audio) console.log('- Grant microphone permissions in browser settings');
      if (!results.speech) console.log('- Speech Recognition requires Chrome/Chromium browser');
      if (!results.tabCapture) console.log('- Tab capture requires extension permissions');
    }

    return results;
  },

  // Test sample questions
  testSampleQuestions: () => {
    console.log('🎯 Testing sample interview questions...\n');
    
    const sampleQuestions = [
      "Tell me about yourself",
      "What are your strengths?",
      "Why do you want to work here?",
      "Where do you see yourself in 5 years?",
      "Can you describe a challenging project you worked on?",
      "How do you handle stress and pressure?",
      "What is your greatest weakness?",
      "Why are you leaving your current job?"
    ];

    sampleQuestions.forEach(question => {
      AIInterviewDebug.testQuestionDetection(question);
    });
  },

  // Monitor extension messages (run in background page console)
  monitorMessages: () => {
    console.log('🔍 Monitoring extension messages...');
    
    const originalSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function(...args) {
      console.log('📤 Sending message:', args);
      return originalSendMessage.apply(this, args);
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📥 Received message:', message, 'from:', sender);
    });
  }
};

// Auto-run basic tests
console.log('🔧 Running basic compatibility tests...');
AIInterviewDebug.runAllTests();

// Make debug functions available globally
window.AIInterviewDebug = AIInterviewDebug;

console.log('\n💡 Available debug functions:');
console.log('- AIInterviewDebug.runAllTests() - Run all compatibility tests');
console.log('- AIInterviewDebug.testQuestionDetection("your question") - Test question detection');
console.log('- AIInterviewDebug.testSampleQuestions() - Test with sample interview questions');
console.log('- AIInterviewDebug.monitorMessages() - Monitor extension messages (background page only)');