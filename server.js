//  const express = require("express");
// const sqlite3 = require("sqlite3").verbose();
// const cors = require("cors");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");

// const app = express(); // 'app' burada yaradılır!
// const port = 3000;
// const JWT_SECRET = "sizin_super_gizli_acariniz_12345";

// // 1. Middleware
// app.use(cors());
// app.use(express.json());

// // 2. Database Qoşulması
// const db = new sqlite3.Database("./tasks.db", (err) => {
//   if (err) {
//     console.error("Baza qoşulma xətası:", err.message);
//   }
//   console.log("Kiçik SQLite bazasına qoşuldu.");
// });

// // 3. Cədvəllərin Yaradılması
// db.serialize(() => {
//   // İstifadəçi Cədvəli (role sütunu ilə)
//   db.run(`CREATE TABLE IF NOT EXISTS users (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     username TEXT UNIQUE NOT NULL,
//     password_hash TEXT NOT NULL,
//     role TEXT NOT NULL DEFAULT 'user' 
//   )`, (err) => {
//     if (err) console.error("Users cədvəli xətası:", err.message);
//   });

//   // Tapşırıq Cədvəli ('ON DELETE CASCADE' ilə)
//   db.run(`CREATE TABLE IF NOT EXISTS tasks (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id INTEGER NOT NULL, 
//     title TEXT NOT NULL,
//     status TEXT NOT NULL DEFAULT 'pending',
//     category TEXT NOT NULL DEFAULT 'general',
//     description TEXT, 
//     due_date TEXT,
//     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
//   )`, (err) => {
//     if (err) console.error("Tasks cədvəli xətası:", err.message);
//   });
// });


// // === 4. İstifadəçi Qeydiyyatı (Register) ===
// app.post("/api/users/register", async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ error: "İstifadəçi adı və parol tələb olunur." });
//   }
//   try {
//     const hashedPassword = await bcrypt.hash(password, 10);
//     db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, [username, hashedPassword], function (err) {
//       if (err) {
//         return res.status(400).json({ error: "Bu istifadəçi adı artıq mövcuddur." });
//       }
//       res.status(201).json({ message: "İstifadəçi uğurla yaradıldı.", userId: this.lastID });
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Qeydiyyat zamanı server xətası baş verdi." });
//   }
// });

// // === 5. İstifadəçi Girişi (Login) ===
// app.post("/api/users/login", (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ error: "İstifadəçi adı və parol tələb olunur." });
//   }

//   db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
//     if (err || !user) {
//       return res.status(400).json({ error: "İstifadəçi adı və ya parol səhvdir." });
//     }
//     const match = await bcrypt.compare(password, user.password_hash);
//     if (!match) {
//       return res.status(400).json({ error: "İstifadəçi adı və ya parol səhvdir." });
//     }

//     const tokenPayload = { 
//       id: user.id, 
//       username: user.username, 
//       role: user.role
//     };
//     const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
//     res.json({ message: "Giriş uğurludur.", token: token, role: user.role });
//   });
// });


// // === 6. Token Yoxlama "Middleware" ===
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (token == null) return res.sendStatus(401);

//   jwt.verify(token, JWT_SECRET, (err, userPayload) => {
//     if (err) return res.sendStatus(403);
//     req.user = userPayload; 
//     next();
//   });
// }

// // === 7. YALNIZ Admin Yoxlama "Middleware" ===
// function authenticateAdmin(req, res, next) {
//   if (req.user.role !== 'admin') {
//     return res.status(403).json({ error: "İcazəniz yoxdur (Admin deyilsiniz)." });
//   }
//   next();
// }


// // === 8. API Endpoints (NORMAL İSTİFADƏÇİ TAPŞIRIQLARI) ===
// // (Bu blok sizin normal istifadəçi tapşırıqlarınızı idarə edir)

// // Bütün tapşırıqları göstər
// app.get("/api/tasks", authenticateToken, (req, res) => {
//   const userId = req.user.id;
//   db.all("SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
//     if (err) res.status(500).json({ "error": err.message });
//     else res.json({ tasks: rows });
//   });
// });

// // Tək tapşırığı göstər
// app.get("/api/tasks/:id", authenticateToken, (req, res) => {
//   const id = req.params.id;
//   const userId = req.user.id;
//   db.get("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [id, userId], (err, row) => {
//     if (err) res.status(500).json({ "error": err.message });
//     else if (!row) res.status(404).json({ "error": "Tapşırıq tapılmadı" });
//     else res.json({ task: row });
//   });
// });

// // Yeni tapşırıq yarat
// app.post("/api/tasks", authenticateToken, (req, res) => {
//   const { title, category, description, due_date } = req.body; 
//   const userId = req.user.id;
//   if (!title) return res.status(400).json({ "error": "Başlıq tələb olunur." });
//   const taskCategory = category || 'general';
//   db.run(`INSERT INTO tasks (user_id, title, category, description, due_date) VALUES (?, ?, ?, ?, ?)`, 
//     [userId, title, taskCategory, description, due_date], 
//     function (err) {
//       if (err) res.status(500).json({ "error": err.message });
//       else db.get("SELECT * FROM tasks WHERE id = ?", [this.lastID], (err, row) => res.status(201).json(row));
//   });
// });

// // Tapşırıq detallarını yenilə
// app.put("/api/tasks/:id", authenticateToken, (req, res) => {
//   const id = req.params.id;
//   const userId = req.user.id;
//   const { title, description, due_date } = req.body;
//   if (!title) return res.status(400).json({ "error": "Başlıq tələb olunur." });
//   db.run(`UPDATE tasks SET title = ?, description = ?, due_date = ? WHERE id = ? AND user_id = ?`,
//     [title, description, due_date, id, userId],
//     function (err) {
//       if (err) res.status(500).json({ "error": err.message });
//       else if (this.changes === 0) res.status(404).json({ error: "Tapşırıq tapılmadı" });
//       else res.json({ message: "Tapşırıq yeniləndi" });
//     }
//   );
// });

// // Tapşırıq statusunu yenilə
// app.put("/api/tasks/:id/status", authenticateToken, (req, res) => {
//   const id = req.params.id;
//   const userId = req.user.id;
//   const { status } = req.body; 
//   db.run(`UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?`, [status, id, userId], function (err) {
//     if (err) res.status(500).json({ "error": err.message });
//     else if (this.changes === 0) res.status(404).json({ error: "Tapşırıq tapılmadı" });
//     else res.json({ message: "Status yeniləndi" });
//   });
// });

// // Tapşırığı sil
// app.delete("/api/tasks/:id", authenticateToken, (req, res) => {
//   const id = req.params.id;
//   const userId = req.user.id;
//   db.run(`DELETE FROM tasks WHERE id = ? AND user_id = ?`, [id, userId], function (err) {
//     if (err) res.status(500).json({ "error": err.message });
//     else if (this.changes === 0) res.status(404).json({ error: "Tapşırıq tapılmadı" });
//     else res.json({ message: "Tapşırıq silindi" });
//   });
// });


// // === 9. ADMIN API Endpoints ===

// // Bütün istifadəçiləri göstər
// app.get("/api/admin/users", [authenticateToken, authenticateAdmin], (req, res) => {
//   db.all("SELECT id, username, role FROM users", [], (err, rows) => {
//     if (err) res.status(500).json({ "error": err.message });
//     else res.json({ users: rows });
//   });
// });

// // Bütün tapşırıqları göstər
// app.get("/api/admin/tasks", [authenticateToken, authenticateAdmin], (req, res) => {
//   const sql = `SELECT tasks.*, users.username FROM tasks JOIN users ON tasks.user_id = users.id ORDER BY tasks.id DESC`;
//   db.all(sql, [], (err, rows) => {
//     if (err) res.status(500).json({ "error": err.message });
//     else res.json({ tasks: rows });
//   });
// });

// // İstifadəçini sil
// app.delete("/api/admin/users/:id", [authenticateToken, authenticateAdmin], (req, res) => {
//   const id = req.params.id;
//   db.run(`DELETE FROM users WHERE id = ?`, id, function (err) {
//     if (err) res.status(500).json({ "error": err.message });
//     else if (this.changes === 0) res.status(404).json({ error: "İstifadəçi tapılmadı." });
//     else res.json({ message: "İstifadəçi və ona bağlı bütün tapşırıqlar silindi." });
//   });
// });

// // İstifadəçi parolunu resetlə
// app.put("/api/admin/users/:id/reset-password", [authenticateToken, authenticateAdmin], async (req, res) => {
//   const id = req.params.id;
//   const { newPassword } = req.body;
//   if (!newPassword) return res.status(400).json({ error: "Yeni parol tələb olunur." });
//   try {
//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashedPassword, id], function (err) {
//       if (err) res.status(500).json({ "error": err.message });
//       else if (this.changes === 0) res.status(404).json({ error: "İstifadəçi tapılmadı." });
//       else res.json({ message: "İstifadəçinin parolu uğurla yeniləndi." });
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Parol resetlənərkən server xətası baş verdi." });
//   }
// });

// // İstifadəçi rolunu dəyiş (Sizin son əlavə etdiyiniz kod)
// app.put("/api/admin/users/:id/role", [authenticateToken, authenticateAdmin], (req, res) => {
//   const id = req.params.id;
//   const { newRole } = req.body; 

//   if (id == req.user.id) {
//     return res.status(400).json({ error: "Öz rolunuzu dəyişə bilməzsiniz." });
//   }
//   if (newRole !== 'admin' && newRole !== 'user') {
//     return res.status(400).json({ error: "Rol ancaq 'admin' və ya 'user' ola bilər." });
//   }

//   db.run(`UPDATE users SET role = ? WHERE id = ?`, [newRole, id], function (err) {
//     if (err) res.status(500).json({ "error": err.message });
//     else if (this.changes === 0) res.status(404).json({ error: "İstifadəçi tapılmadı." });
//     else res.json({ message: `İstifadəçinin rolu uğurla '${newRole}' olaraq dəyişdirildi.` });
//   });
// });


// // === 10. Serveri Başla ===
// app.listen(port, () => {
//   console.log(`Backend server http://localhost:${port} ünvanında işləyir...`);
// });








const express = require("express");
const { sql } = require("@vercel/postgres"); // SQLite yerinə bu gəldi
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const JWT_SECRET = "sizin_super_gizli_acariniz_12345";

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Database Cədvəllərinin Yaradılması (Avtomatik yoxlayır)
async function initDB() {
  try {
    // Users cədvəli (Postgres üçün SERIAL istifadə edirik)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      );
    `;

    // Tasks cədvəli
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

// Server işə düşəndə cədvəlləri yoxla
initDB();

// === 4. İstifadəçi Qeydiyyatı (Register) ===
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "İstifadəçi adı və parol tələb olunur." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Postgres-də ID-ni geri almaq üçün 'RETURNING id' yazırıq
    const result = await sql`
      INSERT INTO users (username, password_hash) VALUES (${username}, ${hashedPassword})
      RETURNING id
    `;
    res.status(201).json({ message: "İstifadəçi uğurla yaradıldı.", userId: result.rows[0].id });
  } catch (err) {
    // Postgres-də 'unique violation' kodu 23505-dir
    if (err.code === '23505') {
      return res.status(400).json({ error: "Bu istifadəçi adı artıq mövcuddur." });
    }
    res.status(500).json({ error: "Server xətası: " + err.message });
  }
});

// === 5. İstifadəçi Girişi (Login) ===
app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const user = result.rows[0]; // Postgres nəticəni 'rows' massivində qaytarır

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

// === 6. Token Yoxlama Middleware ===
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

// === 7. Admin Yoxlama Middleware ===
function authenticateAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "İcazəniz yoxdur (Admin deyilsiniz)." });
  }
  next();
}

// === 8. API Endpoints (NORMAL USER) ===

// Bütün tapşırıqları göstər
app.get("/api/tasks", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY id DESC`;
    res.json({ tasks: result.rows });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

// Tək tapşırığı göstər
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

// Yeni tapşırıq yarat
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

// Tapşırıq detallarını yenilə
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

// Status yenilə
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

// Tapşırığı sil
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

// === 9. ADMIN API Endpoints ===

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

// === 10. Serveri Başla ===
app.listen(port, () => {
  console.log(`Backend server http://localhost:${port} ünvanında işləyir...`);
});