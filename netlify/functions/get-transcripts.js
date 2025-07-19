const { MongoClient } = require('mongodb');

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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (queryParams.startDate) {
      filter.timestamp = { $gte: queryParams.startDate };
    }
    if (queryParams.endDate) {
      filter.timestamp = { ...filter.timestamp, $lte: queryParams.endDate };
    }

    const client = await connectToDatabase();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Get transcripts with pagination
    const transcripts = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await collection.countDocuments(filter);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transcripts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }),
    };

  } catch (error) {
    console.error('Error retrieving transcripts:', error);
    
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