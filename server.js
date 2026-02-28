const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Upload folder
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}
app.use("/uploads", express.static(uploadPath));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ================= DATABASE =================

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT || 3306,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ทดสอบ connection ตอน start
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
  console.log("✅ Database pool connected");
  connection.release();
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1); // ให้แอป crash ไปเลยถ้า DB ไม่ได้
  }
  console.log("✅ Database connected");

  // Create table
  const createTable = `
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image VARCHAR(255) NOT NULL,
      period VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(createTable, (err) => {
    if (err) {
      console.error("❌ Create table error:", err);
    } else {
      console.log("✅ Table attendance ready");
    }
  });
});

// ================= API =================

// บันทึกข้อมูล
app.post("/api/check", upload.single("image"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  const period = req.body.period;
  const image = req.file.filename;

  const sql = `INSERT INTO attendance (image, period) VALUES (?, ?)`;

  db.query(sql, [image, period], (err, result) => {
    if (err) {
      console.error("❌ Insert error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "บันทึกสำเร็จใน Database",
      id: result.insertId
    });
  });
});

// ดึงข้อมูล
app.get("/api/records", (req, res) => {
  db.query("SELECT * FROM attendance ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("❌ Query error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      data: results
    });
  });
});

// Health check
app.get("/api/health", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) {
      return res.json({ status: "error", database: "disconnected" });
    }
    res.json({ status: "ok", database: "connected" });
  });
});

// Serve pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "homepage.html"));
});

app.get("/records", (req, res) => {
  res.sendFile(path.join(__dirname, "records.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});