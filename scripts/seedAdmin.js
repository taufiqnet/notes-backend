require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Initializing model schemas and indexes via Model.init()...');
    await Promise.all([User.init(), Note.init(), Post.init()]);

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    const adminName = process.env.ADMIN_NAME || 'System Administrator';

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log(`Admin account already exists with email: ${adminEmail}. Updating credentials...`);
      admin.name = adminName;
      admin.role = 'admin';
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(adminPassword, salt);
      await admin.save();
      console.log('Admin account successfully updated.');
    } else {
      console.log(`Creating new Admin account with email: ${adminEmail}...`);
      admin = new User({
        name: adminName,
        email: adminEmail,
        password: adminPassword, // will be hashed by pre('save')
        role: 'admin',
        interests: ['administration', 'security', 'system'],
      });
      await admin.save();
      console.log('Admin account created successfully.');
    }

    console.log('Seed completed successfully.');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
}

seedAdmin();
