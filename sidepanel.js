document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const aiProviderSelect = document.getElementById('aiProvider');
    const openaiSection = document.getElementById('openaiSection');
    const geminiSection = document.getElementById('geminiSection');
    const assemblyaiSection = document.getElementById('assemblyaiSection');
    
    const openaiApiKey = document.getElementById('openaiApiKey');
    const geminiApiKey = document.getElementById('geminiApiKey');
    const assemblyaiApiKey = document.getElementById('assemblyaiApiKey');
    
    const saveOpenaiKey = document.getElementById('saveOpenaiKey');
    const saveGeminiKey = document.getElementById('saveGeminiKey');
    const saveAssemblyaiKey = document.getElementById('saveAssemblyaiKey');
    
    const jobDescription = document.getElementById('jobDescription');
    const resume = document.getElementById('resume');
    const jobDescriptionFile = document.getElementById('jobDescriptionFile');
    const resumeFile = document.getElementById('resumeFile');
    const uploadJobDesc = document.getElementById('uploadJobDesc');
    const uploadResume = document.getElementById('uploadResume');
    const saveContext = document.getElementById('saveContext');
    
    const toggleButton = document.getElementById('toggleListening');
    const saveTranscript = document.getElementById('saveTranscript');
    const transcriptDiv = document.getElementById('transcript');
    const aiResponseDiv = document.getElementById('aiResponse');
    const transcriptHistory = document.getElementById('transcriptHistory');
    const clearHistory = document.getElementById('clearHistory');
    const status = document.getElementById('status');
    
    let isListening = false;
    let currentTranscript = '';
    let interviewContext = { jobDescription: '', resume: '' };

    // Load saved data
    loadSavedData();

    // Event Listeners
    aiProviderSelect.addEventListener('change', handleProviderChange);
    
    saveOpenaiKey.addEventListener('click', () => saveApiKey('openai', openaiApiKey.value));
    saveGeminiKey.addEventListener('click', () => saveApiKey('gemini', geminiApiKey.value));
    saveAssemblyaiKey.addEventListener('click', () => saveApiKey('assemblyai', assemblyaiApiKey.value));
    
    uploadJobDesc.addEventListener('click', () => jobDescriptionFile.click());
    uploadResume.addEventListener('click', () => resumeFile.click());
    jobDescriptionFile.addEventListener('change', (e) => handleFileUpload(e, 'jobDescription'));
    resumeFile.addEventListener('change', (e) => handleFileUpload(e, 'resume'));
    
    saveContext.addEventListener('click', saveInterviewContext);
    toggleButton.addEventListener('click', toggleListening);
    saveTranscript.addEventListener('click', saveCurrentTranscript);
    clearHistory.addEventListener('click', clearTranscriptHistory);

    // Input change listeners for API keys
    openaiApiKey.addEventListener('input', () => updateSaveButtonState(saveOpenaiKey, 'Save OpenAI Key'));
    geminiApiKey.addEventListener('input', () => updateSaveButtonState(saveGeminiKey, 'Save Gemini Key'));
    assemblyaiApiKey.addEventListener('input', () => updateSaveButtonState(saveAssemblyaiKey, 'Save AssemblyAI Key'));

    function loadSavedData() {
        chrome.storage.sync.get([
            'openaiApiKey', 'geminiApiKey', 'assemblyaiApiKey',
            'aiProvider', 'jobDescription', 'resume', 'transcriptHistory'
        ], (result) => {
            if (result.openaiApiKey) {
                openaiApiKey.value = result.openaiApiKey;
                updateSaveButtonState(saveOpenaiKey, 'OpenAI Key Saved', true);
            }
            if (result.geminiApiKey) {
                geminiApiKey.value = result.geminiApiKey;
                updateSaveButtonState(saveGeminiKey, 'Gemini Key Saved', true);
            }
            if (result.assemblyaiApiKey) {
                assemblyaiApiKey.value = result.assemblyaiApiKey;
                updateSaveButtonState(saveAssemblyaiKey, 'AssemblyAI Key Saved', true);
            }
            if (result.aiProvider) {
                aiProviderSelect.value = result.aiProvider;
                handleProviderChange();
            }
            if (result.jobDescription) {
                jobDescription.value = result.jobDescription;
                interviewContext.jobDescription = result.jobDescription;
            }
            if (result.resume) {
                resume.value = result.resume;
                interviewContext.resume = result.resume;
            }
            if (result.transcriptHistory) {
                displayTranscriptHistory(result.transcriptHistory);
            }
        });
    }

    function handleProviderChange() {
        const provider = aiProviderSelect.value;
        openaiSection.style.display = provider === 'openai' ? 'block' : 'none';
        geminiSection.style.display = provider === 'gemini' ? 'block' : 'none';
        
        chrome.storage.sync.set({ aiProvider: provider });
    }

    function saveApiKey(provider, apiKey) {
        if (!apiKey.trim()) {
            showStatus('Please enter a valid API key', 'error');
            return;
        }

        const storageKey = `${provider}ApiKey`;
        chrome.storage.sync.set({ [storageKey]: apiKey }, () => {
            chrome.runtime.sendMessage({
                action: 'setApiKey',
                provider: provider,
                apiKey: apiKey
            });
            
            const button = provider === 'openai' ? saveOpenaiKey : 
                          provider === 'gemini' ? saveGeminiKey : saveAssemblyaiKey;
            updateSaveButtonState(button, `${provider.charAt(0).toUpperCase() + provider.slice(1)} Key Saved`, true);
            showStatus(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved successfully`, 'success');
        });
    }

    function updateSaveButtonState(button, text, disabled = false) {
        button.textContent = text;
        button.disabled = disabled;
    }

    function handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            if (type === 'jobDescription') {
                jobDescription.value = content;
            } else if (type === 'resume') {
                resume.value = content;
            }
            showStatus(`${type === 'jobDescription' ? 'Job description' : 'Resume'} uploaded successfully`, 'success');
        };
        reader.readAsText(file);
    }

    function saveInterviewContext() {
        interviewContext = {
            jobDescription: jobDescription.value.trim(),
            resume: resume.value.trim()
        };

        chrome.storage.sync.set({
            jobDescription: interviewContext.jobDescription,
            resume: interviewContext.resume
        }, () => {
            chrome.runtime.sendMessage({
                action: 'setContext',
                context: interviewContext
            });
            showStatus('Interview context saved successfully', 'success');
        });
    }

    function toggleListening() {
        isListening = !isListening;
        
        if (isListening) {
            toggleButton.textContent = 'Stop Listening';
            toggleButton.classList.add('listening');
            saveTranscript.style.display = 'block';
            
            chrome.runtime.sendMessage({ action: 'startListening' });
            transcriptDiv.textContent = 'Listening for questions...';
            aiResponseDiv.textContent = 'AI responses will appear here.';
            showStatus('Started listening...', 'success');
        } else {
            toggleButton.textContent = 'Start Listening';
            toggleButton.classList.remove('listening');
            
            chrome.runtime.sendMessage({ action: 'stopListening' });
            showStatus('Stopped listening', 'warning');
        }
    }

    function saveCurrentTranscript() {
        if (!currentTranscript.trim()) {
            showStatus('No transcript to save', 'warning');
            return;
        }

        const timestamp = new Date().toISOString();
        const transcriptItem = {
            id: Date.now(),
            timestamp: timestamp,
            text: currentTranscript,
            context: { ...interviewContext }
        };

        chrome.storage.sync.get('transcriptHistory', (result) => {
            const history = result.transcriptHistory || [];
            history.unshift(transcriptItem);
            
            // Keep only last 50 transcripts
            if (history.length > 50) {
                history.splice(50);
            }

            chrome.storage.sync.set({ transcriptHistory: history }, () => {
                displayTranscriptHistory(history);
                
                // Send to backend for storage
                chrome.runtime.sendMessage({
                    action: 'saveTranscriptToBackend',
                    transcript: transcriptItem
                });
                
                showStatus('Transcript saved successfully', 'success');
            });
        });
    }

    function displayTranscriptHistory(history) {
        if (!history || history.length === 0) {
            transcriptHistory.innerHTML = '<p>No transcript history available.</p>';
            return;
        }

        transcriptHistory.innerHTML = history.map(item => `
            <div class="transcript-item">
                <div class="transcript-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                <div class="transcript-text">${item.text}</div>
            </div>
        `).join('');
    }

    function clearTranscriptHistory() {
        if (confirm('Are you sure you want to clear all transcript history?')) {
            chrome.storage.sync.set({ transcriptHistory: [] }, () => {
                transcriptHistory.innerHTML = '<p>No transcript history available.</p>';
                showStatus('Transcript history cleared', 'success');
            });
        }
    }

    function showStatus(message, type = 'info') {
        status.textContent = message;
        status.className = type;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        switch (request.action) {
            case 'updateTranscript':
                transcriptDiv.textContent = request.transcript;
                currentTranscript = request.transcript;
                break;
                
            case 'updateAIResponse':
                aiResponseDiv.textContent = request.response;
                break;
                
            case 'transcriptionComplete':
                if (request.transcript) {
                    currentTranscript = request.transcript;
                    transcriptDiv.textContent = request.transcript;
                    showStatus('Transcription completed', 'success');
                }
                break;
                
            case 'error':
                showStatus(request.message, 'error');
                break;
                
            case 'status':
                showStatus(request.message, request.type || 'info');
                break;
        }
    });
});