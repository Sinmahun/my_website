const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

/* ------------------ Middleware ------------------ */
app.use(cors());
app.use(express.json());

/* ------------------ สร้าง uploads ถ้ายังไม่มี ------------------ */
const uploadPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

app.use("/uploads", express.static(uploadPath));

/* ------------------ ตั้งค่าการเก็บไฟล์ ------------------ */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });

/* ------------------ เชื่อม Database (Railway MySQL) ------------------ */
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Database connected");
  }
});

/* ------------------ API บันทึกข้อมูล ------------------ */
app.post("/check", upload.single("image"), (req, res) => {

  if (!req.file) {
    return res.status(400).send("No image uploaded");
  }

  const period = req.body.period;
  const image = req.file.filename;

  const sql = `
    INSERT INTO attendance (image, period)
    VALUES (?, ?)
  `;

  db.query(sql, [image, period], (err) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database Error");
    } else {
      res.send("บันทึกสำเร็จ");
    }
  });

});

/* ------------------ Health Check ------------------ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ------------------ สำคัญมากสำหรับ Railway ------------------ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});