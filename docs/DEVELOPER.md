# Developer Guide — WK-Factory

## Architecture Overview

WK-Factory is a desktop ERP for garment factories built with:

```
┌──────────────────────────────────────────┐
│              Electron Shell              │
│  ┌────────────┐    ┌──────────────────┐  │
│  │  Frontend   │    │    Backend       │  │
│  │  React 19   │◄──►│  Express 4       │  │
│  │  Vite 6     │    │  SQLite (better) │  │
│  │  Tailwind 4 │    │  Port 9002       │  │
│  └────────────┘    └──────────────────┘  │
└──────────────────────────────────────────┘
```

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop Shell | Electron 41 | `electron.js`, `preload.js` |
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 | `frontend/` |
| Backend API | Express 4 + Node.js 22 | `backend/` |
| Database | SQLite via better-sqlite3 | `backend/wk-hub.db` |
| Auth | JWT cookies + CSRF double-submit | `backend/middleware/auth.js` |

See [ARCHITECTURE.md](../ARCHITECTURE.md) for detailed architecture documentation.

---

## Getting Started

### Prerequisites

- Node.js 22 LTS (higher versions may break `better-sqlite3`)
- Git
- Windows 10+ (for Electron builds)

### Setup

```bash
# Clone
git clone https://github.com/Wessam-K/fabric.git
cd fabric

# Install all dependencies
npm run install:all

# Rebuild native modules for Electron
cd backend && npm rebuild better-sqlite3 && cd ..

# Seed the database (optional — creates test data)
npm run seed

# Start development
npm run dev
```

This runs both backend (port 9002) and frontend (port 9173) concurrently.

---

## Project Structure

```
fabric/
├── electron.js          # Electron main process
├── preload.js           # Electron preload script
├── package.json         # Root package (Electron + build config)
├── backend/
│   ├── server.js        # Express app entry point
│   ├── database.js      # SQLite connection + migrations
│   ├── seed.js          # Database seeder
│   ├── middleware/       # Express middleware
│   │   ├── auth.js      # JWT auth + RBAC
│   │   ├── csrf.js      # CSRF protection
│   │   ├── contentType.js
│   │   ├── apiKey.js    # API key auth
│   │   └── licenseGuard.js  # License tier enforcement
│   ├── routes/          # API route handlers (35 files)
│   ├── utils/           # Shared utilities
│   │   ├── money.js     # Monetary arithmetic (piaster-safe)
│   │   ├── websocket.js # WebSocket server
│   │   ├── webhooks.js  # Webhook delivery
│   │   ├── cleanup.js   # Data retention cleanup
│   │   └── validators.js
│   ├── migrations/      # Schema migration files
│   ├── tests/           # API tests
│   └── uploads/         # User-uploaded files
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # Main app with routing
│   │   ├── pages/       # Page components (57 pages)
│   │   ├── components/  # Shared components
│   │   ├── context/     # React contexts (Auth, Theme)
│   │   ├── hooks/       # Custom hooks
│   │   ├── utils/       # Frontend utilities
│   │   └── locales/     # i18n: ar.json, en.json
│   └── vite.config.js
├── lib/                 # Shared libraries (cache, logger, security)
├── tools/               # Build tools
└── docs/                # Documentation
```

---

## How to Add a New Route

### 1. Create the route file

```bash
# backend/routes/myfeature.js
```

```javascript
const express = require('express');
const router = express.Router();
const db = require('../database');
const { requirePermission, logAudit } = require('../middleware/auth');

// GET /api/myfeature — list all
router.get('/', requirePermission('myfeature', 'view'), (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM my_table WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/myfeature — create
router.post('/', requirePermission('myfeature', 'create'), (req, res) => {
  try {
    const { name, value } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare('INSERT INTO my_table (name, value) VALUES (?, ?)').run(name, value);
    logAudit(req, 'CREATE', 'myfeature', result.lastInsertRowid, name);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
```

### 2. Register in server.js

```javascript
app.use('/api/myfeature', requireAuth, require('./routes/myfeature'));
```

### 3. Add permissions (in the permissions table or migration)

---

## How to Add a New Database Table + Migration

### 1. Create migration file

```bash
# backend/migrations/007_my_feature.js
```

```javascript
module.exports = {
  version: 40,  // Increment from current highest
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS my_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value REAL DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  }
};
```

Migrations run automatically on server startup via `database.js`.

### 2. Key conventions

- Use `INTEGER PRIMARY KEY AUTOINCREMENT` for IDs
- Add `is_deleted`, `deleted_at` for soft-delete support
- Add `created_at`, `updated_at` timestamps
- Use `REAL` for monetary values (process with `money.js` utilities)
- Use `TEXT` for dates (ISO format: `datetime('now','localtime')`)

---

## How to Add a New Frontend Page

### 1. Create the page component

```bash
# frontend/src/pages/MyFeature.jsx
```

```jsx
import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import HelpButton from '../components/HelpButton';
import { TableSkeleton } from '../components/Skeleton';

export default function MyFeature() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/myfeature').then(r => setItems(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <TableSkeleton columns={4} rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="My Feature" icon={Plus} />
        <HelpButton pageKey="myfeature" />
      </div>
      {/* Page content */}
    </div>
  );
}
```

### 2. Add route in App.jsx

```jsx
// In the lazy imports section
const MyFeature = lazy(() => import('./pages/MyFeature'));

// In the Routes section inside AppLayout
<Route path="/myfeature" element={
  <PermissionGuard module="myfeature" action="view">
    <MyFeature />
  </PermissionGuard>
} />
```

### 3. Add to sidebar navigation (in App.jsx `navItems` array)

### 4. Add help content

Add entries to both `helpContentFull.js` (Arabic) and `helpContentFull_en.js` (English).

---

## How to Add Tests

Tests are in `backend/tests/api.test.js` using Node.js built-in test runner.

```javascript
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

describe('My Feature API', () => {
  let token;

  before(async () => {
    // Login as admin
    const res = await fetch('http://localhost:9002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@2024!' }),
    });
    const data = await res.json();
    token = data.token || extractCookie(res, 'wk_token');
  });

  it('GET /api/myfeature returns array', async () => {
    const res = await fetch('http://localhost:9002/api/myfeature', {
      headers: { Cookie: `wk_token=${token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });
});
```

### Running tests

```bash
cd backend
NODE_ENV=test node --test tests/api.test.js
```

---

## Conventions

### Backend
- All endpoints require authentication (via `requireAuth` middleware)
- All state-changing operations log to audit trail via `logAudit()`
- Use `money.js` for all monetary arithmetic (never raw float math)
- All list queries filter `WHERE is_deleted = 0` for soft-delete tables
- Validate all inputs at the route handler level

### Frontend
- Arabic is the primary language; English translations in `locales/en.json`
- Use Tailwind CSS classes (dark mode: `dark:` prefix)
- Brand color: `#c9a84c` (gold)
- Dark background: `#0d0d1a` (base), `#1a1a2e` (cards)
- Every page should have a `<HelpButton pageKey="..." />` 
- Use `<TableSkeleton />` or `<Skeleton />` for loading states
- Use `useConfirm()` hook for delete confirmations

### Git
- Commit messages: `vX.Y: description`
- Branch: `main` (single branch workflow)
- No `.db`, `.backup`, `node_modules`, `dist-electron` in git

---

## Build for Distribution

```bash
# Build the Electron app (Windows)
npm run build

# Output: dist-electron/WK-Factory Setup X.X.X.exe
```

The build process:
1. Copies native modules (`copy-native.js`)
2. Downloads Node.js runtime (`download-node-runtime.js`)
3. Builds frontend with Vite
4. Packages with electron-builder
