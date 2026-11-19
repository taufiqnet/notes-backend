const mongoose = require('mongoose');

let cached = global.__mongooseConnection;
if (!cached) {
  cached = global.__mongooseConnection = { conn: null, promise: null };
}

async function connectDB(customUri) {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    let uri = customUri || process.env.MONGODB_URI;

    // Optional in-memory fallback for local dev/testing if no URI or offline
    if (!uri || uri.startsWith('memory://') || process.env.USE_MEMORY_DB === 'true') {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        if (!global.__mongoMemoryServer) {
          global.__mongoMemoryServer = await MongoMemoryServer.create();
        }
        uri = global.__mongoMemoryServer.getUri();
      } catch (err) {
        console.warn('MongoMemoryServer fallback not available, proceeding with default URI');
      }
    }

    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    mongoose.set('bufferCommands', false);

    cached.promise = mongoose.connect(uri, opts).catch(async (err) => {
      // If local connection failed and not in serverless Vercel, try memory server fallback
      if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
        try {
          const { MongoMemoryServer } = require('mongodb-memory-server');
          if (!global.__mongoMemoryServer) {
            global.__mongoMemoryServer = await MongoMemoryServer.create();
          }
          const memoryUri = global.__mongoMemoryServer.getUri();
          return await mongoose.connect(memoryUri, opts);
        } catch (innerErr) {
          cached.promise = null;
          throw err;
        }
      }
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (global.__mongoMemoryServer) {
    await global.__mongoMemoryServer.stop();
    global.__mongoMemoryServer = null;
  }
  cached.conn = null;
  cached.promise = null;
}

module.exports = {
  connectDB,
  disconnectDB,
};
