 // =========================================================
// 1. DATABASE LİNKİ (Sənin göndərdiyin "Pooled" linki bura qoydum)
// =========================================================
process.env.POSTGRES_URL = "postgresql://neondb_owner:npg_Auyr0o2pfaDC@ep-gentle-leaf-adm3ylo1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

// =========================================================
// 2. KİTABXANALAR
// =========================================================
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

// =========================================================
// 3. STATİK FAYLLAR (CSS, JS, HTML)
// =========================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// =========================================================
// 4. DATABASE BAŞLANĞICI
// =========================================================
async function initDB() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user'
    );`;
    await sql`CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT NOT NULL DEFAULT 'general',
        description TEXT, due_date TEXT
    );`;
    console.log("✅ Postgres cədvəlləri hazırdır.");
  } catch (err) {
    console.error("❌ Database Xətası:", err.message);
  }
}
initDB();

// =========================================================
// 5. API ENDPOINTS
// =========================================================
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
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ error: "Səhv məlumat." });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Giriş uğurlu", token, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const result = await sql`SELECT * FROM tasks WHERE user_id = ${req.user.id} ORDER BY id DESC`;
    res.json({ tasks: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title, category, description, due_date } = req.body;
  try {
    const result = await sql`INSERT INTO tasks (user_id, title, category, description, due_date) VALUES (${req.user.id}, ${title}, ${category || 'general'}, ${description}, ${due_date}) RETURNING *`;
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    await sql`DELETE FROM tasks WHERE id=${req.params.id} AND user_id=${req.user.id}`;
    res.json({ message: "Silindi" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`Server işləyir: http://localhost:${port}`));