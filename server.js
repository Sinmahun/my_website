const express = require("express");
const sqlite3 = require('sqlite3').verbose();
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to SQLite database');
        // สร้าง table อัตโนมัติ
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image TEXT NOT NULL,
            period TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Uploads setup (เหมือนเดิม)
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// API (ง่ายกว่า MySQL)
app.post("/api/check", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    
    const { period } = req.body;
    const image = req.file.filename;
    
    db.run("INSERT INTO attendance (image, period) VALUES (?, ?)", 
        [image, period], 
        function(err) {
            if (err) {
                res.status(500).json({ error: "Database error" });
            } else {
                res.json({ 
                    success: true, 
                    id: this.lastID,
                    message: "บันทึกสำเร็จ" 
                });
            }
        }
    );
});

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "homepage.html"));
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});