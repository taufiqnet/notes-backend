const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { register, login, getMe, updateMe } = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array of strings'),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// GET /api/auth/me
router.get('/me', auth, getMe);

// PUT /api/auth/me (update name and interests only)
router.put(
  '/me',
  auth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array of strings'),
  ],
  validate,
  updateMe
);

module.exports = router;
