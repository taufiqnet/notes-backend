const mongoose = require('mongoose');
const User = require('../models/User');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Scenario 1: GET /api/users/grouped-by-interests (Admin only)
// Exactly ONE User.aggregate([...]) call, no other query methods (no countDocuments, find, etc.).
async function getGroupedByInterests(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const interestFilter = req.query.interest ? req.query.interest.trim() : null;

    const pipeline = [];

    // Stage 1: $match { interests: { $exists: true, $ne: [] } } or { interests: interest }
    // Uses multikey index userSchema.index({ interests: 1 })
    if (interestFilter) {
      pipeline.push({ $match: { interests: interestFilter } });
    } else {
      pipeline.push({
        $match: {
          interests: { $exists: true, $ne: [] },
        },
      });
    }

    // Stage 2: $unwind "$interests"
    pipeline.push({ $unwind: '$interests' });

    // Optional post-unwind match to ensure only the queried interest group is processed
    if (interestFilter) {
      pipeline.push({ $match: { interests: interestFilter } });
    }

    // Stage 3: $group by "$interests" with $push of { _id, name, email } and a $sum count
    pipeline.push({
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            name: '$name',
            email: '$email',
          },
        },
      },
    });

    // Stage 4: $sort { _id: 1 }
    pipeline.push({ $sort: { _id: 1 } });

    // Stage 5: $facet for pagination returning { data: [$skip, $limit], total: [$count] }
    pipeline.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [aggregateResult] = await User.aggregate(pipeline);

    const data = aggregateResult?.data || [];
    const total = aggregateResult?.total?.[0]?.count || 0;

    res.status(200).json(formatPaginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// Scenario 2: GET /api/users/:id/posts (Public access)
// A SINGLE aggregation on the User collection:
// $match { _id: ObjectId(userId) } -> $project safe user fields ->
// $lookup from "posts" with sub-pipeline ($match { $expr: { $eq: ["$author", "$$uid"] } }, $sort { _id: -1 }, $skip, $limit)
// + additional $lookup for total posts count
async function getUserWithPosts(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const { page, limit, skip } = getPaginationParams(req.query);
    const userObjectId = new mongoose.Types.ObjectId(id);

    const pipeline = [
      // Stage 1: $match { _id: ObjectId(userId) }
      { $match: { _id: userObjectId } },

      // Stage 2: $project safe user fields
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          interests: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },

      // Stage 3: $lookup from "posts" for paginated posts
      {
        $lookup: {
          from: 'posts',
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$author', '$$uid'] } } },
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit },
          ],
          as: 'posts',
        },
      },

      // Stage 4: $lookup from "posts" with $count sub-pipeline for total posts
      {
        $lookup: {
          from: 'posts',
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$author', '$$uid'] } } },
            { $count: 'count' },
          ],
          as: 'totalMeta',
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userDoc = result[0];
    const totalPosts = userDoc.totalMeta?.[0]?.count || 0;
    const posts = userDoc.posts || [];
    const totalPages = Math.ceil(totalPosts / limit) || (totalPosts === 0 ? 0 : 1);

    res.status(200).json({
      success: true,
      user: {
        _id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        interests: userDoc.interests,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt,
      },
      data: posts,
      page,
      limit,
      total: totalPosts,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGroupedByInterests,
  getUserWithPosts,
};
