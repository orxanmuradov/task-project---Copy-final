
const express = require("express");
const { sql } = require("@vercel/postgres");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path"); // <--- YENİ: Fayl yollarını tapmaq üçün lazım

const app = express();
const port = 3000;
const JWT_SECRET = "sizin_super_gizli_acariniz_12345";

// 1. Middleware
app.use(cors());
app.use(express.json());

// --- YENİ HİSSƏ: Frontend fayllarını (HTML, CSS, JS) serverdən oxutmaq ---
 app.use(express.static(process.cwd()));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// ------------------------------------------------------------------------

// 2. Database Cədvəllərinin Yaradılması
async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        category TEXT NOT NULL DEFAULT 'general',
        description TEXT,
        due_date TEXT
      );
    `;
    console.log("Postgres cədvəlləri hazırdır.");
  } catch (err) {
    console.error("Cədvəl yaratma xətası:", err);
  }
}

initDB();

// === 4. İstifadəçi Qeydiyyatı ===
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "İstifadəçi adı və parol tələb olunur." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (username, password_hash) VALUES (${username}, ${hashedPassword})
      RETURNING id
    `;
    res.status(201).json({ message: "İstifadəçi uğurla yaradıldı.", userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: "Bu istifadəçi adı artıq mövcuddur." });
    }
    res.status(500).json({ error: "Server xətası: " + err.message });
  }
});

// === 5. İstifadəçi Girişi ===
app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: "İstifadəçi adı və ya parol səhvdir." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: "İstifadəçi adı və ya parol səhvdir." });
    }

    const tokenPayload = { 
      id: user.id, 
      username: user.username, 
      role: user.role
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Giriş uğurludur.", token: token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 6. Middleware ===
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) return res.sendStatus(403);
    req.user = userPayload; 
    next();
  });
}

function authenticateAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "İcazəniz yoxdur (Admin deyilsiniz)." });
  }
  next();
}

// === 8. API Endpoints ===
app.get("/api/tasks", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY id DESC`;
    res.json({ tasks: result.rows });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.get("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  try {
    const result = await sql`SELECT * FROM tasks WHERE id = ${id} AND user_id = ${userId}`;
    if (result.rows.length === 0) return res.status(404).json({ "error": "Tapşırıq tapılmadı" });
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title, category, description, due_date } = req.body; 
  const userId = req.user.id;
  if (!title) return res.status(400).json({ "error": "Başlıq tələb olunur." });
  const taskCategory = category || 'general';

  try {
    const result = await sql`
      INSERT INTO tasks (user_id, title, category, description, due_date) 
      VALUES (${userId}, ${title}, ${taskCategory}, ${description}, ${due_date})
      RETURNING *
    `;
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const { title, description, due_date } = req.body;
  if (!title) return res.status(400).json({ "error": "Başlıq tələb olunur." });

  try {
    const result = await sql`
      UPDATE tasks 
      SET title = ${title}, description = ${description}, due_date = ${due_date} 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    if (result.rowCount === 0) return res.status(404).json({ error: "Tapşırıq tapılmadı" });
    res.json({ message: "Tapşırıq yeniləndi" });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.put("/api/tasks/:id/status", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const { status } = req.body; 
  try {
    const result = await sql`
      UPDATE tasks SET status = ${status} WHERE id = ${id} AND user_id = ${userId}
    `;
    if (result.rowCount === 0) return res.status(404).json({ error: "Tapşırıq tapılmadı" });
    res.json({ message: "Status yeniləndi" });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  try {
    const result = await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId}`;
    if (result.rowCount === 0) return res.status(404).json({ error: "Tapşırıq tapılmadı" });
    res.json({ message: "Tapşırıq silindi" });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

// === 9. Admin Endpoints ===
app.get("/api/admin/users", [authenticateToken, authenticateAdmin], async (req, res) => {
  try {
    const result = await sql`SELECT id, username, role FROM users`;
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.get("/api/admin/tasks", [authenticateToken, authenticateAdmin], async (req, res) => {
  try {
    const result = await sql`
      SELECT tasks.*, users.username 
      FROM tasks 
      JOIN users ON tasks.user_id = users.id 
      ORDER BY tasks.id DESC
    `;
    res.json({ tasks: result.rows });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.delete("/api/admin/users/:id", [authenticateToken, authenticateAdmin], async (req, res) => {
  const id = req.params.id;
  try {
    const result = await sql`DELETE FROM users WHERE id = ${id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: "İstifadəçi tapılmadı." });
    res.json({ message: "İstifadəçi silindi." });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.put("/api/admin/users/:id/reset-password", [authenticateToken, authenticateAdmin], async (req, res) => {
  const id = req.params.id;
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: "Yeni parol tələb olunur." });
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await sql`UPDATE users SET password_hash = ${hashedPassword} WHERE id = ${id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: "İstifadəçi tapılmadı." });
    res.json({ message: "İstifadəçinin parolu uğurla yeniləndi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/users/:id/role", [authenticateToken, authenticateAdmin], async (req, res) => {
  const id = req.params.id;
  const { newRole } = req.body; 
  if (id == req.user.id) return res.status(400).json({ error: "Öz rolunuzu dəyişə bilməzsiniz." });
  if (newRole !== 'admin' && newRole !== 'user') return res.status(400).json({ error: "Səhv rol." });

  try {
    const result = await sql`UPDATE users SET role = ${newRole} WHERE id = ${id}`;
    if (result.rowCount === 0) return res.status(404).json({ error: "İstifadəçi tapılmadı." });
    res.json({ message: `İstifadəçinin rolu '${newRole}' olaraq dəyişdirildi.` });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server http://localhost:${port} ünvanında işləyir...`);
});