import express from 'express'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(join(DATA_DIR, 'records.db'))
db.pragma('journal_mode = WAL')

// ── Schema ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#FFE500',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL DEFAULT 'default',
    title          TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    created_date   TEXT NOT NULL,
    due_date       TEXT NOT NULL,
    completed      INTEGER NOT NULL DEFAULT 0,
    completed_date TEXT,
    depends_on     TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS positions (
    task_id TEXT PRIMARY KEY,
    x       REAL NOT NULL,
    y       REAL NOT NULL
  );
`)

// ── Migrations ───────────────────────────────────────────
try { db.exec(`ALTER TABLE tasks ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'`) } catch (_) {}
try { db.exec(`ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`) } catch (_) {}

// Ensure a default project exists for legacy data
db.prepare(`INSERT OR IGNORE INTO projects (id, name, color, created_at) VALUES (?, ?, ?, ?)`)
  .run('default', 'Default', '#FFE500', new Date().toISOString())

// ── Auth helpers ─────────────────────────────────────────
function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':')
  const buf = Buffer.from(hash, 'hex')
  const derived = scryptSync(pw, salt, 64)
  return timingSafeEqual(buf, derived)
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const session = db.prepare(`SELECT * FROM sessions WHERE id=?`).get(token)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  req.userId = session.user_id
  next()
}

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// All /api routes except /api/auth/* require authentication
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next()
  requireAuth(req, res, next)
})

// ── Auth endpoints ────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const row = db.prepare(`SELECT s.user_id as id, u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?`).get(token)
    if (row) return res.json({ id: row.id, username: row.username })
  }
  const userCount = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c
  res.status(401).json({ error: 'Not authenticated', needsSetup: userCount === 0 })
})

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username and password required' })
  const isFirst = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c === 0
  const id = randomBytes(16).toString('hex')
  try {
    db.prepare(`INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`)
      .run(id, username.trim(), hashPassword(password), new Date().toISOString())
  } catch {
    return res.status(400).json({ error: 'Username already taken' })
  }
  // First user claims all orphaned legacy projects
  if (isFirst) db.prepare(`UPDATE projects SET user_id=? WHERE user_id=''`).run(id)
  const token = randomBytes(32).toString('hex')
  db.prepare(`INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)`).run(token, id, Date.now())
  res.json({ token, id, username: username.trim() })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare(`SELECT * FROM users WHERE username=?`).get(username)
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid username or password' })
  const token = randomBytes(32).toString('hex')
  db.prepare(`INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)`).run(token, user.id, Date.now())
  res.json({ token, id: user.id, username: user.username })
})

app.delete('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) db.prepare(`DELETE FROM sessions WHERE id=?`).run(token)
  res.json({ ok: true })
})

// ── Helpers ──────────────────────────────────────────────
function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdDate: row.created_date,
    dueDate: row.due_date,
    completed: Boolean(row.completed),
    completedDate: row.completed_date ?? undefined,
    dependsOn: JSON.parse(row.depends_on),
  }
}

// ── Projects (user-scoped) ────────────────────────────────
app.get('/api/projects', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, COUNT(t.id) AS task_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at
  `).all(req.userId)
  res.json(rows.map(r => ({
    id: r.id, name: r.name, color: r.color, createdAt: r.created_at, taskCount: r.task_count,
  })))
})

app.post('/api/projects', (req, res) => {
  const { id, name, color, createdAt } = req.body
  db.prepare(`INSERT INTO projects (id, name, color, created_at, user_id) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name, color, createdAt, req.userId)
  res.json({ ok: true })
})

app.put('/api/projects/:id', (req, res) => {
  const { name, color } = req.body
  db.prepare(`UPDATE projects SET name=?, color=? WHERE id=? AND user_id=?`).run(name, color, req.params.id, req.userId)
  res.json({ ok: true })
})

app.delete('/api/projects/:id', (req, res) => {
  const id = req.params.id
  const proj = db.prepare(`SELECT id FROM projects WHERE id=? AND user_id=?`).get(id, req.userId)
  if (!proj) return res.status(403).json({ error: 'Not found' })
  db.transaction(() => {
    db.prepare(`DELETE FROM positions WHERE task_id IN (SELECT id FROM tasks WHERE project_id=?)`).run(id)
    db.prepare(`DELETE FROM tasks WHERE project_id=?`).run(id)
    db.prepare(`DELETE FROM projects WHERE id=?`).run(id)
  })()
  res.json({ ok: true })
})

// ── Tasks (project-scoped) ────────────────────────────────
app.get('/api/projects/:projectId/tasks', (req, res) => {
  const rows = db.prepare(`SELECT * FROM tasks WHERE project_id=? ORDER BY rowid`).all(req.params.projectId)
  res.json(rows.map(rowToTask))
})

app.post('/api/projects/:projectId/tasks', (req, res) => {
  const pid = req.params.projectId
  const { id, title, description, createdDate, dueDate, completed, completedDate, dependsOn } = req.body
  db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, created_date, due_date, completed, completed_date, depends_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, pid, title, description ?? '', createdDate, dueDate, completed ? 1 : 0, completedDate ?? null, JSON.stringify(dependsOn ?? []))
  res.json({ ok: true })
})

// ── Tasks (standalone update / delete) ───────────────────
app.put('/api/tasks/:id', (req, res) => {
  const { title, description, createdDate, dueDate, completed, completedDate, dependsOn } = req.body
  db.prepare(`
    UPDATE tasks SET title=?, description=?, created_date=?, due_date=?, completed=?, completed_date=?, depends_on=?
    WHERE id=?
  `).run(title, description ?? '', createdDate, dueDate, completed ? 1 : 0, completedDate ?? null, JSON.stringify(dependsOn ?? []), req.params.id)
  res.json({ ok: true })
})

app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id
  db.transaction(() => {
    db.prepare(`DELETE FROM tasks WHERE id=?`).run(id)
    db.prepare(`DELETE FROM positions WHERE task_id=?`).run(id)
    const others = db.prepare(`SELECT id, depends_on FROM tasks`).all()
    const upd = db.prepare(`UPDATE tasks SET depends_on=? WHERE id=?`)
    for (const row of others) {
      const deps = JSON.parse(row.depends_on).filter(d => d !== id)
      upd.run(JSON.stringify(deps), row.id)
    }
  })()
  res.json({ ok: true })
})

// ── Positions ─────────────────────────────────────────────
app.get('/api/projects/:projectId/positions', (req, res) => {
  const rows = db.prepare(`
    SELECT pos.task_id, pos.x, pos.y
    FROM positions pos
    JOIN tasks t ON t.id = pos.task_id
    WHERE t.project_id = ?
  `).all(req.params.projectId)
  const result = {}
  for (const r of rows) result[r.task_id] = { x: r.x, y: r.y }
  res.json(result)
})

app.put('/api/positions/:id', (req, res) => {
  const { x, y } = req.body
  db.prepare(`INSERT OR REPLACE INTO positions (task_id, x, y) VALUES (?, ?, ?)`).run(req.params.id, x, y)
  res.json({ ok: true })
})

app.put('/api/positions', (req, res) => {
  const positions = req.body
  const stmt = db.prepare(`INSERT OR REPLACE INTO positions (task_id, x, y) VALUES (?, ?, ?)`)
  db.transaction(() => {
    for (const [taskId, pos] of Object.entries(positions)) stmt.run(taskId, pos.x, pos.y)
  })()
  res.json({ ok: true })
})

// ── Board atomic replace (undo/redo) ─────────────────────
app.put('/api/projects/:projectId/board', (req, res) => {
  const pid = req.params.projectId
  const { tasks, positions } = req.body
  db.transaction(() => {
    db.prepare(`DELETE FROM positions WHERE task_id IN (SELECT id FROM tasks WHERE project_id=?)`).run(pid)
    db.prepare(`DELETE FROM tasks WHERE project_id=?`).run(pid)
    const ins = db.prepare(`INSERT INTO tasks (id,project_id,title,description,created_date,due_date,completed,completed_date,depends_on) VALUES (?,?,?,?,?,?,?,?,?)`)
    for (const t of tasks)
      ins.run(t.id, pid, t.title, t.description ?? '', t.createdDate, t.dueDate, t.completed ? 1 : 0, t.completedDate ?? null, JSON.stringify(t.dependsOn ?? []))
    const insP = db.prepare(`INSERT OR REPLACE INTO positions (task_id,x,y) VALUES (?,?,?)`)
    for (const [id, p] of Object.entries(positions)) insP.run(id, p.x, p.y)
  })()
  res.json({ ok: true })
})

// ── Export ────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  const projects = db.prepare(`SELECT * FROM projects WHERE user_id=? ORDER BY created_at`).all(req.userId)
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map(proj => {
      const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id=? ORDER BY rowid`).all(proj.id).map(rowToTask)
      const posRows = db.prepare(`SELECT pos.task_id,pos.x,pos.y FROM positions pos JOIN tasks t ON t.id=pos.task_id WHERE t.project_id=?`).all(proj.id)
      const positions = {}
      for (const r of posRows) positions[r.task_id] = { x: r.x, y: r.y }
      return { id: proj.id, name: proj.name, color: proj.color, createdAt: proj.created_at, tasks, positions }
    }),
  }
  res.setHeader('Content-Disposition', `attachment; filename="atomic-records-${Date.now()}.json"`)
  res.json(payload)
})

// ── Import (upsert — never deletes pre-existing data) ────
app.post('/api/import', (req, res) => {
  const { projects } = req.body
  if (!Array.isArray(projects)) return res.status(400).json({ error: 'Invalid format' })
  db.transaction(() => {
    for (const proj of projects) {
      db.prepare(`INSERT OR REPLACE INTO projects (id,name,color,created_at,user_id) VALUES (?,?,?,?,?)`).run(proj.id, proj.name, proj.color, proj.createdAt, req.userId)
      if (Array.isArray(proj.tasks)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO tasks (id,project_id,title,description,created_date,due_date,completed,completed_date,depends_on) VALUES (?,?,?,?,?,?,?,?,?)`)
        for (const t of proj.tasks)
          ins.run(t.id, proj.id, t.title, t.description ?? '', t.createdDate, t.dueDate, t.completed ? 1 : 0, t.completedDate ?? null, JSON.stringify(t.dependsOn ?? []))
      }
      if (proj.positions && typeof proj.positions === 'object') {
        const insP = db.prepare(`INSERT OR REPLACE INTO positions (task_id,x,y) VALUES (?,?,?)`)
        for (const [id, p] of Object.entries(proj.positions)) insP.run(id, p.x, p.y)
      }
    }
  })()
  res.json({ ok: true, imported: projects.length })
})

// ── SPA fallback ──────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))

const PORT = process.env.PORT ?? 3210
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`))
