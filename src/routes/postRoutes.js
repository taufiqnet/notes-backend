const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
} = require('../controllers/postController');

const router = express.Router();

// GET /api/posts (Public, paginated)
router.get('/', getPosts);

// GET /api/posts/:id (Public)
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid post ID')],
  validate,
  getPostById
);

// POST /api/posts (Auth required)
router.post(
  '/',
  auth,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
  ],
  validate,
  createPost
);

// PUT /api/posts/:id (Auth required, author only)
router.put(
  '/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid post ID'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
  ],
  validate,
  updatePost
);

// DELETE /api/posts/:id (Auth required, author or admin)
router.delete(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Invalid post ID')],
  validate,
  deletePost
);

module.exports = router;
