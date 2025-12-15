require('dotenv').config(); 
const express = require("express");
const { Pool } = require("pg"); // Standart PostgreSQL kitabxanası
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = "gizli_acar_123"; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HTML səhifələri
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// DATABASE BAĞLANTISI (Environment Variable-dan oxuyur)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: {
        rejectUnauthorized: false
    }
});

// BAZANI BAŞLATMAQ
async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user');`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL);`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY, 
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
        title TEXT NOT NULL, 
        status TEXT NOT NULL DEFAULT 'pending', 
        category TEXT NOT NULL DEFAULT 'general', 
        description TEXT, 
        due_date TEXT
    );`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, type TEXT NOT NULL, content TEXT);`);

    // Sütunları yoxla və əlavə et
    const columnsToAdd = [
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end TEXT",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TEXT"
    ];

    for (const query of columnsToAdd) {
        try { await pool.query(query); } catch (e) { console.log("Info: " + e.message); }
    }
    
    console.log("✅ PostgreSQL Server Hazırdır!");
  } catch (err) { 
      console.error("❌ Baza Xətası:", err.message); 
  }
}
initDB();

// AUTH Middleware
function authenticateToken(req, res, next) {
  const t = req.headers['authorization']?.split(' ')[1];
  if (!t) return res.sendStatus(401);
  jwt.verify(t, JWT_SECRET, (err, u) => { if(err) return res.sendStatus(403); req.user = u; next(); });
}

function authenticateAdmin(req, res, next) { 
    if (req.user.role !== 'admin') return res.status(403).json({ error: "İcazəniz yoxdur" }); 
    next(); 
}

// --- API ROUTES (Standard PG formatında) ---

// LOGIN / REGISTER
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id", [username, hashedPassword]);
    res.status(201).json({ message: "Uğurlu", userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "Bu ad artıq tutulub." });
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(400).json({ error: "Səhv məlumat." });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Giriş uğurlu", token, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// TASKS
app.get("/api/tasks", authenticateToken, async (req, res) => { 
    try { 
        const r = await pool.query("SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC", [req.user.id]); 
        res.json({ tasks: r.rows }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title, category, description, due_date, start_date, parent_id, recurrence, recurrence_end } = req.body;
  try { 
      const sql = `INSERT INTO tasks (user_id, title, category, description, due_date, start_date, parent_id, recurrence, recurrence_end) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
      const values = [req.user.id, title, category || 'general', description, due_date, start_date || null, parent_id || null, recurrence || null, recurrence_end || null];
      const r = await pool.query(sql, values); 
      res.status(201).json(r.rows[0]); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
    const { title, description, due_date, start_date, recurrence, recurrence_end } = req.body;
    try { 
        const sql = `UPDATE tasks SET title=$1, description=$2, due_date=$3, start_date=$4, recurrence=$5, recurrence_end=$6 
                     WHERE id=$7 AND user_id=$8`;
        await pool.query(sql, [title, description, due_date, start_date, recurrence, recurrence_end, req.params.id, req.user.id]); 
        res.json({ message: "Yeniləndi" }); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tasks/:id/status", authenticateToken, async (req, res) => { 
    try { 
        await pool.query("UPDATE tasks SET status=$1 WHERE id=$2 AND user_id=$3", [req.body.status, req.params.id, req.user.id]); 
        res.json({ message: "Status dəyişdi" }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => { 
    try { 
        await pool.query("DELETE FROM tasks WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]); 
        res.json({ message: "Silindi" }); 
    } catch (err) { res.status(500).json({ error: err.message }); } 
});

// Categories & Notes (Sadələşdirilmiş)
app.get("/api/categories", authenticateToken, async (req, res) => { try { const r = await pool.query("SELECT * FROM categories WHERE user_id = $1", [req.user.id]); res.json({ categories: r.rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/categories", authenticateToken, async (req, res) => { const { name } = req.body; try { const r = await pool.query("INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *", [req.user.id, name]); res.status(201).json(r.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete("/api/categories/:id", authenticateToken, async (req, res) => { try { await pool.query("DELETE FROM categories WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]); res.json({ message: "Silindi" }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.get("/api/notes", authenticateToken, async (req, res) => { try { const r = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY id DESC", [req.user.id]); res.json({ notes: r.rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/notes", authenticateToken, async (req, res) => { const { title, type, content } = req.body; try { const r = await pool.query("INSERT INTO notes (user_id, title, type, content) VALUES ($1, $2, $3, $4) RETURNING *", [req.user.id, title, type, content]); res.status(201).json(r.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put("/api/notes/:id", authenticateToken, async (req, res) => { const { content } = req.body; try { await pool.query("UPDATE notes SET content=$1 WHERE id=$2 AND user_id=$3", [content, req.params.id, req.user.id]); res.json({ message: "Yeniləndi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete("/api/notes/:id", authenticateToken, async (req, res) => { try { await pool.query("DELETE FROM notes WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]); res.json({ message: "Silindi" }); } catch (err) { res.status(500).json({ error: err.message }); } });

// ADMIN
app.get("/api/admin/users", [authenticateToken, authenticateAdmin], async (req, res) => { const r = await pool.query("SELECT id, username, role FROM users ORDER BY id ASC"); res.json({ users: r.rows }); });
app.delete("/api/admin/users/:id", [authenticateToken, authenticateAdmin], async (req, res) => { await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ message: "Silindi" }); });
app.put("/api/admin/users/:id/role", [authenticateToken, authenticateAdmin], async (req, res) => { const { role } = req.body; try { await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, req.params.id]); res.json({ message: "Rol yeniləndi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put("/api/admin/users/:id/reset-password", [authenticateToken, authenticateAdmin], async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash("12345", 10);
        await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hashedPassword, req.params.id]);
        res.json({ message: "Şifrə '12345' olaraq sıfırlandı!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/admin/cleanup", [authenticateToken, authenticateAdmin], async (req, res) => { try { await pool.query("DELETE FROM tasks WHERE status = 'completed'"); res.json({ message: "Bütün bitmiş tapşırıqlar silindi!" }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.listen(port, () => console.log(`🚀 Server işləyir: http://localhost:${port}`));