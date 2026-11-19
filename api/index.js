const { connectDB } = require('../src/config/db');
const app = require('../src/app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection error in serverless handler:', err);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
      hint: 'Please ensure IP 0.0.0.0/0 is whitelisted in MongoDB Atlas Network Access and MONGODB_URI is complete.',
    });
  }
  return app(req, res);
};
