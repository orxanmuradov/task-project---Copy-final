 // =========================================================
// 1. DATABASE LİNKİ
// =========================================================
process.env.POSTGRES_URL = "postgresql://neondb_owner:npg_Auyr0o2pfaDC@ep-gentle-leaf-adm3ylo1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

const express = require("express");
const { sql } = require("@vercel/postgres");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const port = 3000;
const JWT_SECRET = "gizli_acar_123";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

async function initDB() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user');`;
    await sql`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL);`;
    await sql`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT NOT NULL DEFAULT 'general', description TEXT, due_date TEXT);`;
    await sql`CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, type TEXT NOT NULL, content TEXT);`;
    
    // YENİ SÜTUNLAR
    try { await sql`ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE`; } catch (e) {}
    try { await sql`ALTER TABLE tasks ADD COLUMN recurrence TEXT`; } catch (e) {}
    try { await sql`ALTER TABLE tasks ADD COLUMN recurrence_end TEXT`; } catch (e) {}
    // YENİ: Başlanğıc tarixi
    try { await sql`ALTER TABLE tasks ADD COLUMN start_date TEXT`; } catch (e) {}
    
    console.log("✅ Server Hazırdır!");
  } catch (err) { console.error("❌ Baza Xətası:", err.message); }
}
initDB();

// --- AUTH ---
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await sql`INSERT INTO users (username, password_hash) VALUES (${username}, ${hashedPassword}) RETURNING id`;
    res.status(201).json({ message: "Uğurlu", userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "Bu ad artıq tutulub." });
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(400).json({ error: "Səhv məlumat." });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Giriş uğurlu", token, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function authenticateToken(req, res, next) {
  const t = req.headers['authorization']?.split(' ')[1];
  if (!t) return res.sendStatus(401);
  jwt.verify(t, JWT_SECRET, (err, u) => { if(err) return res.sendStatus(403); req.user = u; next(); });
}

// --- TASKS (YENİLƏNDİ: start_date əlavə olundu) ---
app.get("/api/tasks", authenticateToken, async (req, res) => { try { const r = await sql`SELECT * FROM tasks WHERE user_id = ${req.user.id} ORDER BY id DESC`; res.json({ tasks: r.rows }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post("/api/tasks", authenticateToken, async (req, res) => {
  // start_date bura əlavə edildi
  const { title, category, description, due_date, start_date, parent_id, recurrence, recurrence_end } = req.body;
  try { 
      const r = await sql`INSERT INTO tasks (user_id, title, category, description, due_date, start_date, parent_id, recurrence, recurrence_end) 
      VALUES (${req.user.id}, ${title}, ${category || 'general'}, ${description}, ${due_date}, ${start_date || null}, ${parent_id || null}, ${recurrence || null}, ${recurrence_end || null}) 
      RETURNING *`; 
      res.status(201).json(r.rows[0]); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
    const { title, description, due_date, start_date, recurrence, recurrence_end } = req.body;
    try { 
        await sql`UPDATE tasks SET title=${title}, description=${description}, due_date=${due_date}, start_date=${start_date}, recurrence=${recurrence}, recurrence_end=${recurrence_end} WHERE id=${req.params.id} AND user_id=${req.user.id}`; 
        res.json({ message: "Yeniləndi" }); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tasks/:id/status", authenticateToken, async (req, res) => { try { await sql`UPDATE tasks SET status=${req.body.status} WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Status dəyişdi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => { try { await sql`DELETE FROM tasks WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Silindi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/categories", authenticateToken, async (req, res) => { try { const r = await sql`SELECT * FROM categories WHERE user_id = ${req.user.id}`; res.json({ categories: r.rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/categories", authenticateToken, async (req, res) => { const { name } = req.body; try { const r = await sql`INSERT INTO categories (user_id, name) VALUES (${req.user.id}, ${name}) RETURNING *`; res.status(201).json(r.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete("/api/categories/:id", authenticateToken, async (req, res) => { try { await sql`DELETE FROM categories WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Silindi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/notes", authenticateToken, async (req, res) => { try { const r = await sql`SELECT * FROM notes WHERE user_id = ${req.user.id} ORDER BY id DESC`; res.json({ notes: r.rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/notes", authenticateToken, async (req, res) => { const { title, type, content } = req.body; try { const r = await sql`INSERT INTO notes (user_id, title, type, content) VALUES (${req.user.id}, ${title}, ${type}, ${content}) RETURNING *`; res.status(201).json(r.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put("/api/notes/:id", authenticateToken, async (req, res) => { const { content } = req.body; try { await sql`UPDATE notes SET content=${content} WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Yeniləndi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete("/api/notes/:id", authenticateToken, async (req, res) => { try { await sql`DELETE FROM notes WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Silindi" }); } catch (err) { res.status(500).json({ error: err.message }); } });

// --- ADMIN API ---
function authenticateAdmin(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: "İcazəniz yoxdur" }); next(); }
app.get("/api/admin/users", [authenticateToken, authenticateAdmin], async (req, res) => { const r = await sql`SELECT id, username, role FROM users ORDER BY id ASC`; res.json({ users: r.rows }); });
app.delete("/api/admin/users/:id", [authenticateToken, authenticateAdmin], async (req, res) => { await sql`DELETE FROM users WHERE id=${req.params.id}`; res.json({ message: "Silindi" }); });
app.put("/api/admin/users/:id/role", [authenticateToken, authenticateAdmin], async (req, res) => { const { role } = req.body; try { await sql`UPDATE users SET role=${role} WHERE id=${req.params.id}`; res.json({ message: "Rol yeniləndi" }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.put("/api/admin/users/:id/reset-password", [authenticateToken, authenticateAdmin], async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash("12345", 10);
        await sql`UPDATE users SET password_hash=${hashedPassword} WHERE id=${req.params.id}`;
        res.json({ message: "Şifrə '12345' olaraq sıfırlandı!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/admin/cleanup", [authenticateToken, authenticateAdmin], async (req, res) => { try { await sql`DELETE FROM tasks WHERE status = 'completed'`; res.json({ message: "Bütün bitmiş tapşırıqlar silindi!" }); } catch (err) { res.status(500).json({ error: err.message }); } });

app.listen(port, () => console.log(`🚀 Server işləyir: http://localhost:${port}`));