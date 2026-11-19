const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const {
  getGroupedByInterests,
  getUserWithPosts,
} = require('../controllers/aggregationController');

const router = express.Router();

// Scenario 1: GET /api/users/grouped-by-interests (Admin only)
// Note: Registered before /:id routes so 'grouped-by-interests' is not matched as an ObjectId
router.get(
  '/grouped-by-interests',
  auth,
  authorize('admin'),
  getGroupedByInterests
);

// Scenario 2: GET /api/users/:id/posts (Public access)
router.get(
  '/:id/posts',
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  getUserWithPosts
);

// All subsequent user endpoints are strictly Admin only
router.use(auth, authorize('admin'));

// POST /api/users (Admin creates user/admin)
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either "user" or "admin"'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array of strings'),
  ],
  validate,
  createUser
);

// GET /api/users (Admin paginated list of users)
router.get('/', getUsers);

// GET /api/users/:id (Admin get user by id)
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  getUserById
);

// PUT /api/users/:id (Admin update user)
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either "user" or "admin"'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array of strings'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  validate,
  updateUser
);

// DELETE /api/users/:id (Admin delete user)
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid user ID')],
  validate,
  deleteUser
);

module.exports = router;
