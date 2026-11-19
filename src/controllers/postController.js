const Post = require('../models/Post');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// GET /api/posts (Public, paginated)
async function getPosts(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    // List all posts sorted by _id: -1 utilizes default _id index
    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'name email'),
      Post.countDocuments(),
    ]);

    res.status(200).json(formatPaginatedResponse(posts, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/posts/:id (Public)
async function getPostById(req, res, next) {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    res.status(200).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts (Auth required)
async function createPost(req, res, next) {
  try {
    const { title, content } = req.body;

    const post = new Post({
      title,
      content,
      author: req.user._id,
    });

    await post.save();

    await post.populate('author', 'name email');

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/posts/:id (Author-only update)
async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Author only can update
    if (!post.author.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the author can update this post',
      });
    }

    const { title, content } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;

    await post.save();
    await post.populate('author', 'name email');

    res.status(200).json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id (Author or admin may delete)
async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const isAuthor = post.author.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to delete this post',
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
