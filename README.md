# Secure Note-Taking Application - Backend API

A secure, production-grade RESTful API built with Node.js, Express, and MongoDB with Mongoose. Designed for high performance, strict indexing without unindexed scans (zero `COLLSCAN`), optimized aggregation pipelines, and deployment to Vercel Serverless.

---

## Live Deployments

- **Live Backend API**: [https://notes-backend-virid.vercel.app](https://notes-backend-virid.vercel.app)
- **Live Frontend Application**: [https://notes-frontend-gold.vercel.app](https://notes-frontend-gold.vercel.app)
- **Health Check Endpoint**: [https://notes-backend-virid.vercel.app/api/health](https://notes-backend-virid.vercel.app/api/health)

---

## Evaluation & Test Credentials

The backend database is pre-seeded with the administrator account:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `AdminPassword123!` | Full user CRUD, view/delete all notes, optional `?owner=` filter, Scenario 1 Aggregation |
| **User** | Public Registration | Min 6 chars | Create/view/edit/delete **own** notes only, edit own profile interests, public posts |

---

## Features

- **Strict Role-Based Access Control (RBAC)**:
  - `user`: Create, update, delete, and paginated list of **their own notes**. Cannot access or modify other users' notes or user management endpoints (403 Forbidden).
  - `admin`: Inherits all user capabilities, plus full CRUD on users, view all notes across the entire system with optional `?owner=<userId>` filter, and admin aggregations.
  - Public registration **always** creates role `"user"`. Admins are created exclusively via `npm run seed:admin` or by an existing admin via `POST /api/users`.
- **JWT & Password Security**: Passwords hashed with `bcryptjs` (cost 10). Authentication via `Bearer <JWT>` with configurable expiration (`JWT_EXPIRES_IN`). Passwords are never returned (`select: false`).
- **Minimalist Indexing Policy (Strictly 4 Indexes)**:
  - Only 4 explicit indexes defined via `schema.index(...)` across all collections.
  - All universal lists sort by `_id: -1` (ObjectIds encode timestamps naturally), leveraging the default clustered `_id_` index and eliminating redundant indexes on `createdAt`, `role`, or `title`.
  - Zero collection scans (`COLLSCAN`) verified via `npm run verify:indexes`.
- **Aggregation Scenarios**:
  - **Scenario 1 (Group by Interests)**: Exactly **one** `User.aggregate([...])` call. Pipeline: `$match` (utilizing multikey index `{ interests: 1 }` with optional `?interest=` filter) -> `$unwind "$interests"` -> `$group` by `$interests` with `$push` of `{ _id, name, email }` and `$sum` count -> `$sort { _id: 1 }` -> `$facet` for integrated pagination and count. Admin only.
  - **Scenario 2 (User Posts)**: Single aggregation on `User` collection: `$match { _id: ObjectId(userId) }` -> `$project` safe user fields -> `$lookup` from `"posts"` using `let: { uid: "$_id" }` and sub-pipeline with `$match { $expr: { $eq: ["$author", "$$uid"] } }`, `$sort { _id: -1 }`, `$skip`, `$limit` -> returns user + posts + total posts count. Public access.
- **Vercel Serverless Ready**:
  - Global cached connection promise pattern in `src/config/db.js` with `bufferCommands: false`.
  - Dual route mounting (`/api/*` and `/*`) to ensure compatibility with serverless rewrites.
  - Centralized error handler catching DB connection errors and returning clean JSON responses.
  - Security headers via `helmet`, rate limiting via `express-rate-limit` on auth routes, input validation via `express-validator`.

---

## Tech Stack

- **Runtime**: Node.js (LTS v20+ / v22+)
- **Framework**: Express 4.x (CommonJS)
- **Database & ODM**: MongoDB with Mongoose 8.x
- **Authentication**: `jsonwebtoken` (JWT), `bcryptjs`
- **Security & Validation**: `helmet`, `cors`, `express-rate-limit`, `express-validator`, `dotenv`
- **Testing**: Jest, Supertest, `mongodb-memory-server`

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Local server port | `5000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb+srv://<user>:<password>@cluster.mongodb.net/secure_notes?retryWrites=true&w=majority` |
| `JWT_SECRET` | Secret key for JWT signing | `super_secret_jwt_key_at_least_32_chars` |
| `JWT_EXPIRES_IN`| Token lifespan | `7d` |
| `CLIENT_URL` | Comma-separated allowed CORS origins | `https://notes-frontend-gold.vercel.app,http://localhost:3000` |
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

# Seed default administrator account on target database
npm run seed:admin

# Synchronize model indexes with MongoDB
npm run sync:indexes

# Verify all queries use indexes and confirm zero COLLSCAN with executionStats
npm run verify:indexes

# Run full automated integration test suite
npm test
```

---

## Role & Permission Matrix

| Endpoint | Method | Public | User | Admin | Description |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `/api/health` | `GET` | ✅ | ✅ | ✅ | System health and uptime |
| `/api/auth/register` | `POST` | ✅ | ✅ | ✅ | Public registration (role enforced to `user`) |
| `/api/auth/login` | `POST` | ✅ | ✅ | ✅ | User & Admin login, returns JWT |
| `/api/auth/me` | `GET` | ❌ | ✅ | ✅ | Get currently authenticated profile |
| `/api/auth/me` | `PUT` | ❌ | ✅ | ✅ | Update own profile (name, interests only; never role) |
| `/api/notes` | `POST` | ❌ | ✅ | ✅ | Create confidential note |
| `/api/notes` | `GET` | ❌ | Own | All | Paginated notes (admin can filter `?owner=<userId>`) |
| `/api/notes/:id` | `GET` | ❌ | Own | ✅ | Get single note by ID |
| `/api/notes/:id` | `PUT` | ❌ | Own | ✅ | Update note by ID |
| `/api/notes/:id` | `DELETE` | ❌ | Own | ✅ | Delete note by ID |
| `/api/users` | `POST` | ❌ | ❌ | ✅ | Admin create user with custom role |
| `/api/users` | `GET` | ❌ | ❌ | ✅ | Admin list users (paginated) |
| `/api/users/:id` | `GET` | ❌ | ❌ | ✅ | Admin get user by ID |
| `/api/users/:id` | `PUT` | ❌ | ❌ | ✅ | Admin update user (role, name, interests) |
| `/api/users/:id` | `DELETE` | ❌ | ❌ | ✅ | Admin delete user and their data |
| `/api/posts` | `GET` | ✅ | ✅ | ✅ | Public community posts feed (paginated) |
| `/api/posts/:id` | `GET` | ✅ | ✅ | ✅ | Public get post by ID |
| `/api/posts` | `POST` | ❌ | ✅ | ✅ | Create community post |
| `/api/posts/:id` | `PUT` | ❌ | Author | ❌ | Author only can edit post |
| `/api/posts/:id` | `DELETE` | ❌ | Author | ✅ | Author or Admin can delete post |
| `/api/users/grouped-by-interests` | `GET` | ❌ | ❌ | ✅ | **Scenario 1**: Group users by interests (facet pagination) |
| `/api/users/:id/posts` | `GET` | ✅ | ✅ | ✅ | **Scenario 2**: Get user with posts ($lookup sub-pipeline) |

*All list endpoints are paginated via `?page=&limit=` (default limit 10, max 100), returning `{ data, page, limit, total, totalPages }`.*

---

## Indexing Architecture

Strictly 4 explicit indexes are created:
1. `User`: `userSchema.index({ email: 1 }, { unique: true })` — supports login, duplicate checks, uniqueness.
2. `User`: `userSchema.index({ interests: 1 })` — multikey index supporting Scenario 1 `$match`.
3. `Note`: `noteSchema.index({ owner: 1, _id: -1 })` — compound index supporting user's notes and admin `?owner=` filter sorted by `_id: -1`.
4. `Post`: `postSchema.index({ author: 1, _id: -1 })` — compound index supporting Scenario 2 `$lookup` sub-pipeline and user's posts sorted by `_id: -1`.

All generic listings (list all users, list all notes, list all posts, and GET-by-id) leverage the default clustered `_id_` index with backward scan. Refer to [INDEXES.md](INDEXES.md) for full architectural analysis and `executionStats`.

---

## Vercel Deployment

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for notes-backend"
   git branch -M main
   git remote add origin https://github.com/<username>/notes-backend.git
   git push -u origin main
   ```
2. **Deploy on Vercel**:
   - Import the repository on [Vercel](https://vercel.com).
   - Framework Preset: **Other**.
   - Add Environment Variables:
     - `MONGODB_URI`: Atlas connection string (make sure `0.0.0.0/0` is allowed in Atlas Network Access).
     - `JWT_SECRET`: 32+ character secret string.
     - `JWT_EXPIRES_IN`: `7d`.
     - `CLIENT_URL`: `https://notes-frontend-gold.vercel.app`.
     - `ADMIN_EMAIL`: `admin@example.com`.
     - `ADMIN_PASSWORD`: `AdminPassword123!`.
     - `ADMIN_NAME`: `System Administrator`.
   - Click **Deploy**.
