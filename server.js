 // ==========================================
// 1. DATABASE LİNKİ (Sənin Vercel Linkin)
// ==========================================
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

// ==========================================
// 2. DİZAYN VƏ FAYLLAR (Əsas Hissə)
// ==========================================
// Serverə deyirik: "public" qovluğundakı CSS və JS fayllarını olduğu kimi işlət
app.use(express.static(path.join(__dirname, 'public')));

// HTML Səhifələri
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ==========================================
// 3. DATABASE (Cədvəllər)
// ==========================================
async function initDB() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user');`;
    await sql`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT NOT NULL DEFAULT 'general', description TEXT, due_date TEXT);`;
    console.log("✅ Server və Baza Hazırdır!");
  } catch (err) { console.error("❌ Baza Xətası:", err.message); }
}
initDB();

// ==========================================
// 4. API (Qeydiyyat və Giriş)
// ==========================================
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Yeni istifadəçi yaradanda avtomatik ID qaytarırıq
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
    
    // Token yaradırıq
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Giriş uğurlu", token, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware (İstifadəçi yoxlanışı)
function authenticateToken(req, res, next) {
  const t = req.headers['authorization']?.split(' ')[1];
  if (!t) return res.sendStatus(401);
  jwt.verify(t, JWT_SECRET, (err, u) => { if(err) return res.sendStatus(403); req.user = u; next(); });
}

// Admin yoxlanışı
function authenticateAdmin(req, res, next) { 
    if (req.user.role !== 'admin') return res.status(403).json({ error: "İcazəniz yoxdur!" }); 
    next(); 
}

// --- Admin API ---
app.get("/api/admin/users", [authenticateToken, authenticateAdmin], async (req, res) => {
    const r = await sql`SELECT id, username, role FROM users`; res.json({ users: r.rows });
});
app.delete("/api/admin/users/:id", [authenticateToken, authenticateAdmin], async (req, res) => {
    await sql`DELETE FROM users WHERE id=${req.params.id}`; res.json({ message: "Silindi" });
});

// --- User API ---
app.get("/api/tasks", authenticateToken, async (req, res) => {
  const r = await sql`SELECT * FROM tasks WHERE user_id = ${req.user.id} ORDER BY id DESC`; res.json({ tasks: r.rows });
});
app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title, category, description, due_date } = req.body;
  const r = await sql`INSERT INTO tasks (user_id, title, category, description, due_date) VALUES (${req.user.id}, ${title}, ${category||'general'}, ${description}, ${due_date}) RETURNING *`;
  res.status(201).json(r.rows[0]);
});
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
    await sql`DELETE FROM tasks WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: "Silindi" });
});

// Serveri Başlat
app.listen(port, () => console.log(`🚀 Server işləyir: http://localhost:${port}`));