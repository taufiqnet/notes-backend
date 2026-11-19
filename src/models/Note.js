const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Explicitly defined index ONLY:
// 3. Owner compound index: Serves user's own note list & admin ?owner=<userId> filter, sorted/paginated by _id: -1.
noteSchema.index({ owner: 1, _id: -1 });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
