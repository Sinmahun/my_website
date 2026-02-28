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

// MySQL Connection Pool (แนะนำให้ใช้ Pool แทน Connection)
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convert pool to promise-based
const promisePool = pool.promise();

// Create table function
async function createTable() {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image VARCHAR(255) NOT NULL,
        period VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await promisePool.execute(createTableSQL);
    console.log("✅ Table 'attendance' created successfully");
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
  }
}

// Initialize database
async function initializeDatabase() {
  try {
    // Test connection
    const connection = await promisePool.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
    
    // Create table
    await createTable();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.log("⚠️  Running without database...");
  }
}

// Initialize on startup
initializeDatabase();

// API Routes
app.post("/api/check", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  const period = req.body.period;
  const image = req.file.filename;

  try {
    const sql = `INSERT INTO attendance (image, period) VALUES (?, ?)`;
    const [result] = await promisePool.execute(sql, [image, period]);
    
    res.json({ 
      success: true, 
      message: "บันทึกสำเร็จใน Database",
      data: {
        id: result.insertId,
        image: image,
        period: period
      }
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ success: false, message: "Database Error" });
  }
});

// API ดึงข้อมูลทั้งหมด
app.get("/api/records", async (req, res) => {
  try {
    const sql = "SELECT * FROM attendance ORDER BY created_at DESC";
    const [rows] = await promisePool.execute(sql);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ success: false, message: "Database Error" });
  }
});

// Serve HTML pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "homepage.html"));
});


app.get("/records", (req, res) => {
  res.sendFile(path.join(__dirname, "records.html"));
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const [result] = await promisePool.execute("SELECT 1 as status");
    res.json({ 
      status: "OK", 
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      status: "OK", 
      database: "disconnected",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files serving from: ${__dirname}`);
});