const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeaudit';
    const conn = await mongoose.connect(uri);
    const dbName = conn.connection.name || 'codeaudit';
    const host = conn.connection.host || 'Atlas Cluster';
    console.log(`[MongoDB] Connected to database: ${dbName} (${host})`);
  } catch (err) {
    console.error(`[MongoDB] Error: ${err.message}`);
    // Non-fatal in dev mode if falling back to in-memory/mock
  }
};

module.exports = connectDB;
