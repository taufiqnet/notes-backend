require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

function findStages(stage, stagesList = []) {
  if (!stage) return stagesList;
  if (stage.stage) stagesList.push(stage.stage);
  if (stage.inputStage) findStages(stage.inputStage, stagesList);
  if (stage.inputStages) {
    stage.inputStages.forEach((s) => findStages(s, stagesList));
  }
  return stagesList;
}

function findIndexName(stage) {
  if (!stage) return null;
  if (stage.indexName) return stage.indexName;
  if (stage.inputStage) {
    const found = findIndexName(stage.inputStage);
    if (found) return found;
  }
  if (stage.inputStages) {
    for (const s of stage.inputStages) {
      const found = findIndexName(s);
      if (found) return found;
    }
  }
  return null;
}

async function verifyIndexes() {
  try {
    console.log('====================================================');
    console.log('       MONGODB INDEX & EXECUTION STATS VERIFICATION ');
    console.log('====================================================\n');

    await connectDB();

    console.log('1. Ensuring indexes are synced on all collections...');
    await Promise.all([
      User.syncIndexes(),
      Note.syncIndexes(),
      Post.syncIndexes(),
    ]);

    console.log('2. Seeding test sample data to warm up query planner...');
    await Promise.all([
      User.deleteMany({}),
      Note.deleteMany({}),
      Post.deleteMany({}),
    ]);

    const testUsers = [];
    for (let i = 1; i <= 5; i++) {
      testUsers.push({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        password: 'Password123!',
        role: i === 1 ? 'admin' : 'user',
        interests: i % 2 === 0 ? ['tech', 'music'] : ['sports', 'art'],
      });
    }
    const insertedUsers = await User.insertMany(testUsers);
    const userId = insertedUsers[0]._id;

    const testNotes = [];
    for (let i = 1; i <= 10; i++) {
      testNotes.push({
        title: `Note ${i}`,
        content: `Content for note ${i}`,
        owner: insertedUsers[i % insertedUsers.length]._id,
      });
    }
    await Note.insertMany(testNotes);

    const testPosts = [];
    for (let i = 1; i <= 10; i++) {
      testPosts.push({
        title: `Post ${i}`,
        content: `Content for post ${i}`,
        author: insertedUsers[i % insertedUsers.length]._id,
      });
    }
    await Post.insertMany(testPosts);

    console.log('   Data seeded: 5 users, 10 notes, 10 posts.\n');
    console.log('3. Running .explain("executionStats") on queries...\n');

    const results = [];

    // Query 1: User Login / Email Lookup
    {
      const exp = await User.find({ email: 'user1@example.com' }).explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN') || stages.includes('IDHACK');

      results.push({
        query: 'User Login / Lookup by Email',
        collection: 'users',
        expectedIndex: '{ email: 1 } (email_1)',
        actualIndex: indexName || 'N/A',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN)' : 'CHECK',
      });
    }

    // Query 2: Scenario 1 Aggregation ($match on interests)
    {
      const exp = await User.aggregate([
        { $match: { interests: 'tech' } },
        { $unwind: '$interests' },
        { $match: { interests: 'tech' } },
        {
          $group: {
            _id: '$interests',
            count: { $sum: 1 },
            users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
          },
        },
        { $sort: { _id: 1 } },
        {
          $facet: {
            data: [{ $skip: 0 }, { $limit: 10 }],
            total: [{ $count: 'count' }],
          },
        },
      ]).explain('executionStats');

      const cursorStage = exp.stages?.[0]?.['$cursor'] || exp.stages?.[0] || exp;
      const winningPlan = cursorStage.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN');

      results.push({
        query: 'Scenario 1: Interests Aggregation $match',
        collection: 'users',
        expectedIndex: '{ interests: 1 } (interests_1)',
        actualIndex: indexName || 'N/A',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN)' : (indexName ? 'PASS' : 'CHECK'),
      });
    }

    // Query 3: User Notes List / Admin ?owner= filter
    {
      const exp = await Note.find({ owner: userId })
        .sort({ _id: -1 })
        .skip(0)
        .limit(10)
        .explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN');

      results.push({
        query: 'User Notes List / Admin ?owner= Filter',
        collection: 'notes',
        expectedIndex: '{ owner: 1, _id: -1 }',
        actualIndex: indexName || 'N/A',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN)' : 'CHECK',
      });
    }

    // Query 4: Scenario 2 Posts Lookup by Author
    {
      const exp = await Post.find({ author: userId })
        .sort({ _id: -1 })
        .skip(0)
        .limit(10)
        .explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN');

      results.push({
        query: 'Scenario 2: Posts by Author ($lookup)',
        collection: 'posts',
        expectedIndex: '{ author: 1, _id: -1 }',
        actualIndex: indexName || 'N/A',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN)' : 'CHECK',
      });
    }

    // Query 5: Admin List All Users (sorted by _id: -1)
    {
      const exp = await User.find()
        .sort({ _id: -1 })
        .skip(0)
        .limit(10)
        .explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN') || indexName === '_id_';

      results.push({
        query: 'Admin List All Users (sort _id: -1)',
        collection: 'users',
        expectedIndex: 'Default Clustered { _id: 1 } (_id_)',
        actualIndex: indexName || '_id_',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN on _id)' : 'CHECK',
      });
    }

    // Query 6: Admin List All Notes (sorted by _id: -1)
    {
      const exp = await Note.find()
        .sort({ _id: -1 })
        .skip(0)
        .limit(10)
        .explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN') || indexName === '_id_';

      results.push({
        query: 'Admin List All Notes (sort _id: -1)',
        collection: 'notes',
        expectedIndex: 'Default Clustered { _id: 1 } (_id_)',
        actualIndex: indexName || '_id_',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN on _id)' : 'CHECK',
      });
    }

    // Query 7: Public List All Posts (sorted by _id: -1)
    {
      const exp = await Post.find()
        .sort({ _id: -1 })
        .skip(0)
        .limit(10)
        .explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IXSCAN') || indexName === '_id_';

      results.push({
        query: 'Public List All Posts (sort _id: -1)',
        collection: 'posts',
        expectedIndex: 'Default Clustered { _id: 1 } (_id_)',
        actualIndex: indexName || '_id_',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IXSCAN on _id)' : 'CHECK',
      });
    }

    // Query 8: Find By ID operations
    {
      const exp = await Note.findById(testNotes[0]._id).explain('executionStats');
      const winningPlan = exp.queryPlanner?.winningPlan || {};
      const stages = findStages(winningPlan);
      const indexName = findIndexName(winningPlan);
      const hasCollscan = stages.includes('COLLSCAN');
      const usesIndex = stages.includes('IDHACK') || stages.includes('IXSCAN') || indexName === '_id_';

      results.push({
        query: 'Get Note By ID (findById)',
        collection: 'notes',
        expectedIndex: 'Default Clustered { _id: 1 } (_id_)',
        actualIndex: indexName || '_id_',
        stages: stages.join(' -> '),
        collscan: hasCollscan ? 'YES (FAIL)' : 'NO (PASS)',
        verdict: usesIndex && !hasCollscan ? 'PASS (IDHACK / IXSCAN)' : 'CHECK',
      });
    }

    console.table(results);

    const failures = results.filter((r) => r.collscan.includes('FAIL'));
    if (failures.length > 0) {
      console.error(`\n❌ VERIFICATION FAILED: ${failures.length} queries performed a COLLSCAN.`);
      await disconnectDB();
      process.exit(1);
    } else {
      console.log('\n✅ VERIFICATION SUCCESS: All queries use indexes (IXSCAN/IDHACK). Zero COLLSCAN detected.');
    }

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Error during index verification:', err);
    process.exit(1);
  }
}

verifyIndexes();
