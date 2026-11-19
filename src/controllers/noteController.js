const Note = require('../models/Note');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// POST /api/notes
async function createNote(req, res, next) {
  try {
    const { title, content } = req.body;

    const note = new Note({
      title,
      content,
      owner: req.user._id,
    });

    await note.save();

    res.status(201).json({
      success: true,
      data: note,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/notes (own notes; admin gets ALL notes, optional ?owner=)
async function getNotes(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    let filter = {};

    if (req.user.role === 'admin') {
      if (req.query.owner) {
        filter.owner = req.query.owner;
      }
    } else {
      filter.owner = req.user._id;
    }

    // Sort by _id: -1 leverages default _id index (for all notes) or { owner: 1, _id: -1 } index
    const [notes, total] = await Promise.all([
      Note.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name email'),
      Note.countDocuments(filter),
    ]);

    res.status(200).json(formatPaginatedResponse(notes, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:id (owner or admin)
async function getNoteById(req, res, next) {
  try {
    const note = await Note.findById(req.params.id).populate('owner', 'name email');

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    const isOwner = note.owner._id ? note.owner._id.equals(req.user._id) : note.owner.equals(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this note',
      });
    }

    res.status(200).json({
      success: true,
      data: note,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notes/:id (owner or admin)
async function updateNote(req, res, next) {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    const isOwner = note.owner.equals(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to update this note',
      });
    }

    const { title, content } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;

    await note.save();

    res.status(200).json({
      success: true,
      data: note,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notes/:id (owner or admin)
async function deleteNote(req, res, next) {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    const isOwner = note.owner.equals(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to delete this note',
      });
    }

    await Note.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
};
