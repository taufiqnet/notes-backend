require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

async function syncAllIndexes() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Synchronizing indexes for User collection...');
    const userIndexes = await User.syncIndexes();
    console.log('User synced indexes:', userIndexes);

    console.log('Synchronizing indexes for Note collection...');
    const noteIndexes = await Note.syncIndexes();
    console.log('Note synced indexes:', noteIndexes);

    console.log('Synchronizing indexes for Post collection...');
    const postIndexes = await Post.syncIndexes();
    console.log('Post synced indexes:', postIndexes);

    console.log('All indexes synchronized successfully.');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Error synchronizing indexes:', error);
    process.exit(1);
  }
}

syncAllIndexes();
