# Secure Note-Taking Application - Backend API

A secure, production-grade RESTful API built with Node.js, Express, and MongoDB/Mongoose. Designed for high performance, strict indexing without unindexed scans (zero COLLSCAN), aggregation pipelines, and deployment to Vercel Serverless.

---

## Features

- **Strict Role-Based Access Control (RBAC)**: Enforces `user` and `admin` permission isolation.
- **JWT & Password Security**: Passwords hashed with `bcryptjs` (cost 10). Authentication via Bearer JWT with configurable expiration.
- **Minimalist Indexing**: Strictly 4 explicit indexes created via `schema.index(...)`. All lists sorted by `_id: -1` to leverage default clustered index without COLLSCAN.
- **Optimized Aggregations**:
  - **Scenario 1**: Group users by interests with single-pipeline `$facet` pagination and multikey index usage.
  - **Scenario 2**: Fetch user profile with correlated `$lookup` sub-pipeline for paginated posts and total count.
- **Vercel Serverless Ready**: Global cached connection pattern (`bufferCommands: false`), serverless rewrite rules, and standalone index verification.
- **Hardened Security**: Helmet, Express rate-limiting on auth routes, centralized error handler, input validation (`express-validator`), and sanitized responses.

---

## Tech Stack

- **Runtime**: Node.js (LTS v20+ / v22+)
- **Framework**: Express 4.x
- **Database & ODM**: MongoDB with Mongoose 8.x
- **Authentication**: `jsonwebtoken` (JWT), `bcryptjs`
- **Security & Utilities**: `helmet`, `cors`, `express-rate-limit`, `express-validator`, `dotenv`
- **Testing**: Jest, Supertest, `mongodb-memory-server`

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Local server port | `5000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/secure_notes` |
| `JWT_SECRET` | Secret key for JWT signing | `super_secret_jwt_key_at_least_32_chars` |
| `JWT_EXPIRES_IN`| Token lifespan | `7d` |
| `CLIENT_URL` | Comma-separated allowed CORS origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `ADMIN_EMAIL` | Default admin email for seeding | `admin@example.com` |
| `ADMIN_PASSWORD`| Default admin password for seeding | `AdminPassword123!` |
| `ADMIN_NAME` | Default admin display name | `System Administrator` |

---

## Scripts

```bash
# Install dependencies
npm install

# Run locally in development mode (starts server on PORT)
npm run dev

# Seed default administrator account
npm run seed:admin

# Synchronize model indexes with MongoDB
npm run sync:indexes

# Verify all queries use indexes and verify zero COLLSCAN with executionStats
npm run verify:indexes

# Run full integration test suite
npm test
```

---

## Role & Permission Matrix

| Endpoint | Method | Public | User | Admin | Description |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `/api/health` | `GET` | ✅ | ✅ | ✅ | Health check |
| `/api/auth/register` | `POST` | ✅ | ✅ | ✅ | Public registration (role is always `user`) |
| `/api/auth/login` | `POST` | ✅ | ✅ | ✅ | User / Admin login, returns JWT |
| `/api/auth/me` | `GET` | ❌ | ✅ | ✅ | View own profile |
| `/api/auth/me` | `PUT` | ❌ | ✅ | ✅ | Update own profile (name, interests only) |
| `/api/notes` | `POST` | ❌ | ✅ | ✅ | Create note |
| `/api/notes` | `GET` | ❌ | Own | All | Paginated list (admin can filter `?owner=`) |
| `/api/notes/:id` | `GET` | ❌ | Own | ✅ | Get note by ID |
| `/api/notes/:id` | `PUT` | ❌ | Own | ✅ | Update note |
| `/api/notes/:id` | `DELETE` | ❌ | Own | ✅ | Delete note |
| `/api/users` | `POST` | ❌ | ❌ | ✅ | Admin create user with role |
| `/api/users` | `GET` | ❌ | ❌ | ✅ | Admin list users (paginated) |
| `/api/users/:id` | `GET` | ❌ | ❌ | ✅ | Admin view user |
| `/api/users/:id` | `PUT` | ❌ | ❌ | ✅ | Admin update user (role, name, interests) |
| `/api/users/:id` | `DELETE` | ❌ | ❌ | ✅ | Admin delete user and their data |
| `/api/posts` | `GET` | ✅ | ✅ | ✅ | Public list posts (paginated) |
| `/api/posts/:id` | `GET` | ✅ | ✅ | ✅ | Public get post by ID |
| `/api/posts` | `POST` | ❌ | ✅ | ✅ | Create post |
| `/api/posts/:id` | `PUT` | ❌ | Author | ❌ | Author only update |
| `/api/posts/:id` | `DELETE` | ❌ | Author | ✅ | Author or Admin delete |
| `/api/users/grouped-by-interests` | `GET` | ❌ | ❌ | ✅ | Scenario 1 Aggregation (paginated, ?interest=) |
| `/api/users/:id/posts` | `GET` | ✅ | ✅ | ✅ | Scenario 2 Aggregation (paginated posts) |

---

## Indexing Summary

Only 4 explicit indexes are created:
1. `User`: `userSchema.index({ email: 1 }, { unique: true })`
2. `User`: `userSchema.index({ interests: 1 })`
3. `Note`: `noteSchema.index({ owner: 1, _id: -1 })`
4. `Post`: `postSchema.index({ author: 1, _id: -1 })`

All generic listings rely on the default clustered `_id` index with `.sort({ _id: -1 })`. Refer to [INDEXES.md](INDEXES.md) for full architectural rationale.

---

## Vercel Deployment

1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for notes-backend"
   ```
2. Push to GitHub:
   ```bash
   git remote add origin https://github.com/<username>/notes-backend.git
   git branch -M main
   git push -u origin main
   ```
3. Deploy to Vercel:
   - Import repository on [Vercel](https://vercel.com).
   - Set Framework Preset to **Other**.
   - Add Environment Variables (`MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
   - Deploy. Vercel automatically routes all paths through `vercel.json` to `api/index.js`.
