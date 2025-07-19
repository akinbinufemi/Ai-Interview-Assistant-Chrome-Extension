const { MongoClient } = require('mongodb');

// MongoDB connection string - set this in your Netlify environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'interview_assistant';
const COLLECTION_NAME = 'transcripts';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    // Parse the request body
    const transcript = JSON.parse(event.body);
    
    // Validate required fields
    if (!transcript.text || !transcript.timestamp) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: text, timestamp' }),
      };
    }

    // Add server timestamp and processing info
    const transcriptDocument = {
      ...transcript,
      serverTimestamp: new Date().toISOString(),
      source: 'chrome_extension',
      processed: true,
    };

    // Connect to database and save transcript
    const client = await connectToDatabase();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const result = await collection.insertOne(transcriptDocument);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: result.insertedId,
        message: 'Transcript saved successfully',
      }),
    };

  } catch (error) {
    console.error('Error saving transcript:', error);
    
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