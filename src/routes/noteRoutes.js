const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');

const router = express.Router();

// All note routes require authentication
router.use(auth);

// POST /api/notes
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
  ],
  validate,
  createNote
);

// GET /api/notes (own notes for user, all notes for admin, optional ?owner=)
router.get('/', getNotes);

// GET /api/notes/:id
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid note ID')],
  validate,
  getNoteById
);

// PUT /api/notes/:id
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid note ID'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
  ],
  validate,
  updateNote
);

// DELETE /api/notes/:id
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid note ID')],
  validate,
  deleteNote
);

module.exports = router;
