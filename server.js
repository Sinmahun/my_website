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
app.use(express.static(__dirname));

// Uploads directory
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}
app.use("/uploads", express.static(uploadPath));

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage: storage });

// MySQL connection with fallback values
const db = mysql.createConnection({
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "mydatabase",
  port: process.env.MYSQLPORT || 3306
});

// Connect to database and create table
db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    console.log("⚠️  Running without database...");
  } else {
    console.log("✅ Database connected");
    
    // Create table if not exists
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image VARCHAR(255) NOT NULL,
        period VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.query(createTableSQL, (err) => {
      if (err) {
        console.error("Error creating table:", err);
      } else {
        console.log("✅ Table 'attendance' is ready");
      }
    });
  }
});

// API Routes
app.post("/api/check", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  const period = req.body.period;
  const image = req.file.filename;

  const sql = `INSERT INTO attendance (image, period) VALUES (?, ?)`;

  db.query(sql, [image, period], (err, result) => {
    if (err) {
      console.log("Database error:", err);
      res.status(500).json({ success: false, message: "Database Error" });
    } else {
      res.json({ 
        success: true, 
        message: "บันทึกสำเร็จ",
        data: {
          id: result.insertId,
          image: image,
          period: period
        }
      });
    }
  });
});

// Serve HTML pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "homepage.html"));
});

app.get("/check", (req, res) => {
  res.sendFile(path.join(__dirname, "check.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    database: db.state === "connected" ? "connected" : "disconnected"
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files serving from: ${__dirname}`);
});