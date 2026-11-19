const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');
const bcrypt = require('bcryptjs');

// POST /api/users (Admin only)
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, interests } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    const user = new User({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'user',
      interests: Array.isArray(interests) ? interests : [],
    });

    await user.save();

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/users (Admin only, paginated)
async function getUsers(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    // List all users sorted by _id: -1 utilizes default _id index
    const [users, total] = await Promise.all([
      User.find()
        .select('-password')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(),
    ]);

    res.status(200).json(formatPaginatedResponse(users, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id (Admin only)
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id (Admin only)
async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { name, email, role, interests, password } = req.body;

    if (email && email.toLowerCase().trim() !== user.email) {
      const emailConflict = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailConflict) {
        return res.status(409).json({
          success: false,
          message: 'Email is already in use by another account',
        });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
    if (interests !== undefined) user.interests = Array.isArray(interests) ? interests : [];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        interests: user.interests,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id (Admin only)
async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent deleting the currently authenticated admin user themselves
    if (user._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own admin account',
      });
    }

    // Clean up user's notes and posts
    await Promise.all([
      Note.deleteMany({ owner: user._id }),
      Post.deleteMany({ author: user._id }),
      User.findByIdAndDelete(user._id),
    ]);

    res.status(200).json({
      success: true,
      message: 'User and associated data deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
