const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

let mongoServer;
let adminToken;
let userToken1;
let userToken2;
let user1Id;
let user2Id;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { bufferCommands: false });
  await Promise.all([User.syncIndexes(), Note.syncIndexes(), Post.syncIndexes()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Secure Note-Taking API Test Suite', () => {
  it('GET /api/health should return 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  describe('Authentication & Roles', () => {
    it('POST /api/auth/register should register user with role "user" even if admin requested', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Regular User 1',
        email: 'user1@example.com',
        password: 'Password123!',
        role: 'admin', // Attempted escalation
        interests: ['coding', 'music'],
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('user'); // Enforced role
      userToken1 = res.body.token;
      user1Id = res.body.user._id;
    });

    it('POST /api/auth/register duplicate email should return 409 Conflict', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'User 1 Duplicate',
        email: 'user1@example.com',
        password: 'Password123!',
      });
      expect(res.status).toBe(409);
    });

    it('Register a second regular user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Regular User 2',
        email: 'user2@example.com',
        password: 'Password123!',
        interests: ['sports', 'music'],
      });
      expect(res.status).toBe(201);
      userToken2 = res.body.token;
      user2Id = res.body.user._id;
    });

    it('Seed an Admin user directly in DB and login via POST /api/auth/login', async () => {
      const admin = new User({
        name: 'Super Admin',
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        role: 'admin',
        interests: ['security', 'management'],
      });
      await admin.save();

      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'AdminPassword123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('admin');
      adminToken = res.body.token;
    });

    it('GET /api/auth/me should return current user info', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken1}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user1@example.com');
    });

    it('PUT /api/auth/me allows updating name and interests, but NEVER role', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${userToken1}`)
        .send({
          name: 'User 1 Updated',
          interests: ['coding', 'travel'],
          role: 'admin', // Should be ignored
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('User 1 Updated');
      expect(res.body.user.interests).toEqual(['coding', 'travel']);
      expect(res.body.user.role).toBe('user');
    });
  });

  describe('Notes CRUD & Isolation', () => {
    let noteId1;
    let noteId2;

    it('User 1 creates a note', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${userToken1}`)
        .send({
          title: 'User 1 Note',
          content: 'Secret content for User 1',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('User 1 Note');
      noteId1 = res.body.data._id;
    });

    it('User 2 creates a note', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${userToken2}`)
        .send({
          title: 'User 2 Note',
          content: 'Secret content for User 2',
        });
      expect(res.status).toBe(201);
      noteId2 = res.body.data._id;
    });

    it('User 1 GET /api/notes only retrieves their own notes', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${userToken1}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]._id).toBe(noteId1);
      expect(res.body.total).toBe(1);
    });

    it('User 1 cannot access User 2 note (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/notes/${noteId2}`)
        .set('Authorization', `Bearer ${userToken1}`);
      expect(res.status).toBe(403);
    });

    it('User 1 cannot update User 2 note (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId2}`)
        .set('Authorization', `Bearer ${userToken1}`)
        .send({ title: 'Hacked title' });
      expect(res.status).toBe(403);
    });

    it('Admin can view all notes', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    it('Admin can filter notes by ?owner=', async () => {
      const res = await request(app)
        .get(`/api/notes?owner=${user1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0]._id).toBe(noteId1);
    });

    it('Admin can update and delete user note', async () => {
      const updateRes = await request(app)
        .put(`/api/notes/${noteId1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Revised Title' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Admin Revised Title');

      const delRes = await request(app)
        .delete(`/api/notes/${noteId1}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);
    });
  });

  describe('Users Admin Endpoints', () => {
    it('Regular user cannot access GET /api/users (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken1}`);
      expect(res.status).toBe(403);
    });

    it('Admin can create user via POST /api/users', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Created by Admin',
          email: 'admincreated@example.com',
          password: 'Password123!',
          role: 'user',
          interests: ['devops'],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('admincreated@example.com');
    });

    it('Admin can list users paginated', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(2);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Posts Endpoints', () => {
    let postId;

    it('Public can view posts without auth', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('Authenticated user creates a post', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${userToken1}`)
        .send({
          title: 'Public Post by User 1',
          content: 'Hello everyone in the community!',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Public Post by User 1');
      postId = res.body.data._id;
    });

    it('User 2 cannot update User 1 post (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${userToken2}`)
        .send({ title: 'Unauthorized edit' });
      expect(res.status).toBe(403);
    });

    it('Author can update post', async () => {
      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${userToken1}`)
        .send({ title: 'Updated Title by Author' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title by Author');
    });

    it('Admin can delete post', async () => {
      const res = await request(app)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Aggregations (Scenario 1 & 2)', () => {
    beforeAll(async () => {
      // Add posts for User 1
      await Post.create([
        { title: 'Post A', content: 'Content A', author: user1Id },
        { title: 'Post B', content: 'Content B', author: user1Id },
        { title: 'Post C', content: 'Content C', author: user1Id },
      ]);
    });

    it('Scenario 1: Non-admin gets 403 on /api/users/grouped-by-interests', async () => {
      const res = await request(app)
        .get('/api/users/grouped-by-interests')
        .set('Authorization', `Bearer ${userToken1}`);
      expect(res.status).toBe(403);
    });

    it('Scenario 1: Admin gets users grouped by interests (paginated)', async () => {
      const res = await request(app)
        .get('/api/users/grouped-by-interests?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('_id');
      expect(res.body.data[0]).toHaveProperty('count');
      expect(res.body.data[0]).toHaveProperty('users');
    });

    it('Scenario 1: Admin can filter by ?interest=', async () => {
      const res = await request(app)
        .get('/api/users/grouped-by-interests?interest=music')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]._id).toBe('music');
    });

    it('Scenario 2: Public can get user posts aggregation via /api/users/:id/posts', async () => {
      const res = await request(app).get(`/api/users/${user1Id}/posts?page=1&limit=2`);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user._id).toBe(user1Id.toString());
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
    });
  });
});
