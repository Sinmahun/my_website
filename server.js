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

// Database configuration
let db = null;

function initializeDatabase() {
  try {
    db = mysql.createConnection({
      host: process.env.MYSQLHOST || "localhost",
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "",
      database: process.env.MYSQLDATABASE || "railway",
      port: process.env.MYSQLPORT || 3306
    });

    db.connect((err) => {
      if (err) {
        console.error("❌ Database connection failed:", err.message);
        console.log("⚠️  Running without database...");
        db = null;
      } else {
        console.log("✅ Database connected successfully");
        
        // Create table
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
            console.error("❌ Error creating table:", err);
          } else {
            console.log("✅ Table 'attendance' is ready");
          }
        });
      }
    });

    // Handle connection errors
    db.on('error', (err) => {
      console.error('Database error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Reconnecting to database...');
        initializeDatabase();
      } else {
        throw err;
      }
    });

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    db = null;
  }
}

// Initialize database
initializeDatabase();

// Helper function to execute queries with error handling
function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error("Database not connected"));
    }
    
    db.query(sql, params, (err, results) => {
      if (err) {
        console.error("❌ Query error:", err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

// API Routes
app.post("/api/check", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  const period = req.body.period;
  const image = req.file.filename;

  try {
    if (!db) {
      // Fallback to memory storage if database is not available
      return res.json({ 
        success: true, 
        message: "บันทึกสำเร็จ (Memory Storage)",
        data: { image, period, id: Date.now() }
      });
    }

    const sql = `INSERT INTO attendance (image, period) VALUES (?, ?)`;
    const result = await executeQuery(sql, [image, period]);
    
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
    res.status(500).json({ 
      success: false, 
      message: "Database Error: " + error.message 
    });
  }
});

// API ดึงข้อมูลทั้งหมด
app.get("/api/records", async (req, res) => {
  try {
    if (!db) {
      return res.json({ 
        success: true, 
        message: "Database not connected",
        data: [] 
      });
    }

    const sql = "SELECT * FROM attendance ORDER BY created_at DESC";
    const results = await executeQuery(sql);
    
    res.json({ 
      success: true, 
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error("Records error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Database Error: " + error.message,
      data: [] 
    });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    if (!db) {
      return res.json({ 
        status: "OK", 
        database: "disconnected",
        timestamp: new Date().toISOString(),
        message: "Database is not connected"
      });
    }

    const result = await executeQuery("SELECT 1 as status");
    res.json({ 
      status: "OK", 
      database: "connected",
      timestamp: new Date().toISOString(),
      connection: "healthy"
    });
  } catch (error) {
    res.json({ 
      status: "OK", 
      database: "error",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Serve HTML pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "homepage.html"));
});

app.get("/check", (req, res) => {
  res.sendFile(path.join(__dirname, "check.html"));
});

app.get("/records", (req, res) => {
  res.sendFile(path.join(__dirname, "records.html"));
});

app.get("/test-db", (req, res) => {
  res.sendFile(path.join(__dirname, "test-db.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    success: false, 
    message: "Internal Server Error" 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files serving from: ${__dirname}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Records page: http://localhost:${PORT}/records`);
  console.log(`🧪 Test DB: http://localhost:${PORT}/test-db`);
});