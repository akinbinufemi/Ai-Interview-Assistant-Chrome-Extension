const { AssemblyAI } = require('assemblyai');

// Initialize AssemblyAI client
let assemblyAIClient = null;

function getAssemblyAIClient(apiKey) {
  if (!assemblyAIClient || assemblyAIClient.apiKey !== apiKey) {
    assemblyAIClient = new AssemblyAI({
      apiKey: apiKey
    });
  }
  return assemblyAIClient;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { action, apiKey, audioData, sessionParams } = JSON.parse(event.body);

    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'AssemblyAI API key is required' }),
      };
    }

    const client = getAssemblyAIClient(apiKey);

    switch (action) {
      case 'createSession':
        return await createStreamingSession(client, sessionParams, headers);
      
      case 'transcribeAudio':
        return await transcribeAudioData(client, audioData, headers);
      
      case 'generateToken':
        return await generateTemporaryToken(client, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' }),
        };
    }

  } catch (error) {
    console.error('Error in streaming transcription:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

async function createStreamingSession(client, params, headers) {
  try {
    // Create streaming session with Universal-Streaming
    const sessionConfig = {
      sample_rate: params?.sampleRate || 16000,
      format_turns: true,
      end_of_turn_confidence_threshold: 0.7,
      min_end_of_turn_silence_when_confident: 160,
      max_turn_silence: 2400,
      ...params
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionConfig,
        message: 'Streaming session configuration created'
      }),
    };
  } catch (error) {
    throw new Error(`Failed to create streaming session: ${error.message}`);
  }
}

async function transcribeAudioData(client, audioData, headers) {
  try {
    // For real-time transcription, we'll use the batch API as a fallback
    // The actual streaming should be handled client-side with WebSocket
    const transcript = await client.transcripts.create({
      audio_url: audioData,
      speaker_labels: true,
      auto_highlights: true,
      sentiment_analysis: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        transcript,
        message: 'Audio transcription completed'
      }),
    };
  } catch (error) {
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

async function generateTemporaryToken(client, headers) {
  try {
    // Generate temporary token for client-side streaming
    const token = await client.realtime.createTemporaryToken({
      expires_in: 3600, // 1 hour
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        message: 'Temporary token generated'
      }),
    };
  } catch (error) {
    throw new Error(`Failed to generate token: ${error.message}`);
  }
}