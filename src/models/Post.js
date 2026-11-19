const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
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
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Explicitly defined index ONLY:
// 4. Author compound index: Serves Scenario 2 $lookup sub-pipeline matching author & sorting/paginating by _id: -1.
postSchema.index({ author: 1, _id: -1 });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
