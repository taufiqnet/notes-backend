# Database Indexing Strategy & Rationale

This document details the MongoDB indexing architecture for the Secure Note-Taking Application, the exact queries supported by each index, and the technical justification for why no other secondary indexes are created.

---

## 1. Minimalist Indexing Principles

1. **Exact Workload Alignment**: Every index is introduced strictly to support a specific, high-frequency query pattern or database uniqueness constraint.
2. **Zero Redundancy**: Avoid creating composite indexes whose prefix overlaps with another or indexing fields with low cardinality (such as `role`).
3. **Clustered `_id` Leveraging**: In MongoDB, `_id` is an `ObjectId`, which encodes a 4-byte Unix timestamp in seconds. Sorting by `{ _id: -1 }` yields natural chronological reverse-order pagination. By sorting all universal lists (`users`, `notes`, `posts`) by `{ _id: -1 }`, the query planner executes a backward index scan (`IXSCAN` on `_id_`) directly without requiring separate indexes on `createdAt` or in-memory sort stages.
4. **No Inline Schema Indexing**: All indexes are defined explicitly using `schema.index(...)` rather than inline `index: true` or `unique: true` on schema fields, ensuring all indexing rules are immediately visible in one centralized location per model file.

---

## 2. Defined Indexes

### User Collection (`src/models/User.js`)

#### Index 1: `userSchema.index({ email: 1 }, { unique: true })`
* **Type**: Single-field unique index.
* **Query Patterns Supported**:
  - `User.findOne({ email })`: Authenticating users during login (`POST /api/auth/login`).
  - Pre-registration conflict check (`POST /api/auth/register`, `POST /api/users`, `PUT /api/users/:id`).
  - Uniqueness constraint enforced at the storage engine level to prevent duplicate accounts.
* **Why not compound?**: Authentication matches exclusively on `email`. Password verification is performed via bcrypt hashing in application memory.

#### Index 2: `userSchema.index({ interests: 1 })`
* **Type**: Multikey index (because `interests` is an array of strings).
* **Query Patterns Supported**:
  - Scenario 1 Aggregation: `User.aggregate([ { $match: { interests: { $exists: true, $ne: [] } } }, ... ])`
  - Scenario 1 Filtered Aggregation: `User.aggregate([ { $match: { interests: req.query.interest } }, ... ])`
* **Execution Behavior**:
  The multikey index enables the `$match` stage of the aggregation pipeline to rapidly locate users possessing the specified interest or non-empty interest arrays via an `IXSCAN`, avoiding a collection scan (`COLLSCAN`) across all user documents.

---

### Note Collection (`src/models/Note.js`)

#### Index 3: `noteSchema.index({ owner: 1, _id: -1 })`
* **Type**: Compound index with equality on `owner` and descending order on `_id`.
* **Query Patterns Supported**:
  - User Note Listing: `Note.find({ owner: req.user._id }).sort({ _id: -1 }).skip(...).limit(...)`
  - Admin Filtered Note Listing: `Note.find({ owner: req.query.owner }).sort({ _id: -1 }).skip(...).limit(...)`
* **Equality-Sort-Range (ESR) Rule**:
  1. `owner`: Exact equality match.
  2. `_id: -1`: Ordering is aligned exactly with the index order, allowing pagination to traverse the index in forward direction without allocating in-memory sort buffers.

---

### Post Collection (`src/models/Post.js`)

#### Index 4: `postSchema.index({ author: 1, _id: -1 })`
* **Type**: Compound index with equality on `author` and descending order on `_id`.
* **Query Patterns Supported**:
  - Scenario 2 Aggregation `$lookup` sub-pipeline:
    ```javascript
    {
      $match: { $expr: { $eq: ["$author", "$$uid"] } }
    },
    {
      $sort: { _id: -1 }
    }
    ```
  - Directly queries all posts authored by a specific user in reverse-chronological order.
* **Execution Behavior**:
  During the `$lookup` correlated subquery, MongoDB matches `author` and consumes records in `_id: -1` sequence via an `IXSCAN`, guaranteeing sub-millisecond execution even with millions of posts across the database.

---

## 3. Why Other Indexes Are NOT Created

| Candidate Index | Reason Deliberately Omitted |
| :--- | :--- |
| `{ role: 1 }` | `role` only contains two discrete values (`user`, `admin`). It has extremely low cardinality; an index on role would produce large index buckets and high write overhead without selectivity benefits. |
| `{ createdAt: -1 }` | `ObjectId` contains the timestamp natively. All queries sort by `{ _id: -1 }`, eliminating the need for a redundant index on `createdAt`. |
| `{ title: 1 }` | The application does not perform search-by-title queries. Adding it would waste RAM and disk I/O on every document write. |
| Global `{ _id: -1 }` on Users / Notes / Posts | MongoDB automatically creates `{ _id: 1 }` on every collection. B-tree indexes can be traversed in reverse direction at equal speed, allowing `{ _id: -1 }` sorts to use `_id_` directly. |

---

## 4. Verification with `executionStats`

The project includes an index verification script:
```bash
npm run verify:indexes
```

This script executes `.explain("executionStats")` across all application query shapes and aggregation pipelines, validating that:
- Every query utilizes an `IXSCAN` or `IDHACK`.
- Zero queries trigger a `COLLSCAN`.
- In-memory sorting (`SORT` stage) is completely absent.
