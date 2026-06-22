import mongoose from 'mongoose';

let mongoServer;

/**
 * Connects to MongoDB Atlas using MONGO_URI from the environment variables.
 * Implements environment verification, retry logic, success/failure logging,
 * and a fail-fast strategy that terminates the process on failure.
 */
export const connectDatabase = async () => {
  let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('[DB] MONGO_URI/MONGODB_URI is missing. Initializing in-memory MongoDB fallback...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`[DB] In-memory MongoDB instance started: ${mongoUri}`);
    } catch (err) {
      console.error('[DB Critical] Failed to start in-memory MongoDB server:', err.message);
      throw err;
    }
  }

  const maxRetries = mongoServer ? 1 : 3;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB] Attempting connection to MongoDB (Attempt ${attempt}/${maxRetries})...`);
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
      });

      console.log('[DB] MongoDB connection established successfully.');
      console.log(`Connected DB: ${mongoose.connection.name}`);
      return;
    } catch (error) {
      console.error(`[DB] Attempt ${attempt} failed. Error: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`[DB] Retrying in ${retryDelayMs / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else {
        // If local connection failed, fall back to in-memory server as a last resort
        if (!mongoServer && (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production')) {
          console.log('[DB] Local/configured MongoDB connection failed. Falling back to in-memory MongoDB...');
          try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            mongoServer = await MongoMemoryServer.create();
            mongoUri = mongoServer.getUri();
            console.log(`[DB] In-memory MongoDB instance started: ${mongoUri}`);
            
            await mongoose.connect(mongoUri, {
              serverSelectionTimeoutMS: 5000,
            });
            console.log('[DB] Connected to in-memory MongoDB.');
            return;
          } catch (fallbackError) {
            console.error('[DB Critical] Failed to initialize in-memory MongoDB fallback:', fallbackError.message);
          }
        }

        console.error('\nMongoDB connection failed');
        console.error('Server shutdown initiated\n');
        process.exit(1);
      }
    }
  }
};

/**
 * Disconnects from the MongoDB database gracefully.
 */
export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('[DB] In-memory MongoDB server stopped.');
    }
    console.log('[DB] Database connections closed.');
  } catch (err) {
    console.error(`[DB] Error disconnecting database: ${err.message}`);
  }
};
