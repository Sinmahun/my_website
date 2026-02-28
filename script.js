let map;
let officeMarker;
let userMarker;
let isCameraStarted = false;
let currentPeriod = "";

// --- ส่วนสำคัญ: ตัวแปรควบคุมสถานะ ---
let isFacePresent = false; 
let detectedOnce = true; 
let lastCapturedBlob = null; // ใช้เก็บไฟล์ภาพที่จะส่งไป Server

const officeLocation = { lat: 13.821285, lng: 100.038904 };//ตำแหน่งบริษัท (ปรับเป็นพิกัดจริงของบริษัทคุณ)
const allowedRadius = 200; // เมตร

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const canvasCtx = canvas.getContext("2d");
const statusText = document.getElementById("status");
const resultText = document.getElementById("result");

// --- MediaPipe Face Detection ---
const faceDetection = new FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
});

faceDetection.setOptions({
    model: "short",
    minDetectionConfidence: 0.6
});

faceDetection.onResults(results => {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.detections && results.detections.length > 0) {
        isFacePresent = true;
        statusText.innerText = "สถานะ: ตรวจพบใบหน้า ✅";
        statusText.style.color = "green";

        // วาดกรอบใบหน้า
        results.detections.forEach(detection => {
            const box = detection.boundingBox;
            const x = box.xCenter * canvas.width - (box.width * canvas.width) / 2;
            const y = box.yCenter * canvas.height - (box.height * canvas.height) / 2;
            const width = box.width * canvas.width;
            const height = box.height * canvas.height;
            canvasCtx.strokeStyle = "#00FF00";
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeRect(x, y, width, height);
        });

        // จังหวะที่กดปุ่มลงชื่อ (detectedOnce จะเป็น false) ให้ทำการบันทึกภาพทันที
        if (!detectedOnce) {
            detectedOnce = true;
            captureSnapshot();
        }
    } else {
        isFacePresent = false;
        statusText.innerText = "สถานะ: ไม่พบใบหน้า ❌";
        statusText.style.color = "red";
    }
});

// --- ฟังก์ชันถ่ายภาพและแปลงเป็น Blob ---
function captureSnapshot() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // แปลง Canvas เป็น Blob (ไฟล์ภาพ) เพื่อเตรียมส่ง Server
    tempCanvas.toBlob((blob) => {
        lastCapturedBlob = blob;
        console.log("บันทึกรูปภาพหลักฐานเรียบร้อย");
    }, "image/png");
}

async function startCamera() {
    if (isCameraStarted) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        const camera = new Camera(video, {
            onFrame: async () => {
                await faceDetection.send({ image: video });
            },
            width: 640,
            height: 480
        });
        camera.start();
        isCameraStarted = true;
    } catch (err) {
        statusText.innerText = "ไม่สามารถเข้าถึงกล้องได้";
    }
}

// --- Google Maps ---
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 17,
        center: officeLocation
    });

    officeMarker = new google.maps.Marker({
        position: officeLocation,
        map: map,
        title: "บริษัท"
    });

    new google.maps.Circle({
        strokeColor: "#00FF00",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#00FF00",
        fillOpacity: 0.2,
        map: map,
        center: officeLocation,
        radius: allowedRadius
    });
    
    startCamera();
}

function calculateDistance(userLocation) {
    return google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(userLocation),
        new google.maps.LatLng(officeLocation)
    );
}

// --- ฟังก์ชันหลักเมื่อผู้ใช้กดปุ่มลงชื่อ ---
function checkIn(timePeriod) {
    // 1. เช็คใบหน้าก่อน
    if (!isFacePresent) {
        resultText.innerHTML = `<span style="color: red;">❌ ลงเวลาไม่สำเร็จ: ไม่พบใบหน้าในกล้อง</span>`;
        return;
    }

    currentPeriod = timePeriod;
    detectedOnce = false; // ปลดล็อกเพื่อให้ captureSnapshot ทำงานใน frame ถัดไป
    resultText.innerHTML = "⌛ กำลังตรวจสอบตำแหน่ง GPS...";

    if (!navigator.geolocation) {
        alert("อุปกรณ์ไม่รองรับ GPS");
        return;
    }

    navigator.geolocation.getCurrentPosition(async position => {
        const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        // อัปเดต Marker ผู้ใช้บนแผนที่
        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({
            position: userLocation,
            map: map,
            title: "ตำแหน่งของคุณ",
            icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        });

        const distance = calculateDistance(userLocation);
        const isSuccess = distance <= allowedRadius;

        if (isSuccess) {
            resultText.innerHTML = `<span style="color: blue;">⌛ ตำแหน่งถูกต้อง กำลังส่งข้อมูลไปยังเซิร์ฟเวอร์...</span>`;
            
            // รอสักครู่เพื่อให้ Blob ภาพถูกสร้างเสร็จ (จากขั้นตอน captureSnapshot)
            setTimeout(() => {
                sendDataToServer(timePeriod, userLocation);
            }, 800);
        } else {
            resultText.innerHTML = `<span style="color: red;">❌ อยู่นอกพื้นที่อนุญาต<br>ระยะห่าง: ${Math.round(distance)} เมตร</span>`;
        }

    }, (error) => {
        resultText.innerHTML = "❌ ไม่สามารถเข้าถึงตำแหน่งได้ (กรุณาเปิด GPS)";
    }, { enableHighAccuracy: true });
}

// --- ฟังก์ชันส่งข้อมูลไปยัง Backend ---
async function sendDataToServer(period, location) {
    const resultDiv = document.getElementById("result");
    
    if (!lastCapturedBlob) {
        resultDiv.style.backgroundColor = "#ffebee";
        resultDiv.style.color = "#c62828";
        resultDiv.innerHTML = `❌ ไม่พบไฟล์ภาพหลักฐาน กรุณาลองใหม่อีกครั้ง`;
        return;
    }

    const formData = new FormData();
    formData.append("period", period);
    formData.append("image", lastCapturedBlob, `checkin_${Date.now()}.png`);
    formData.append("lat", location.lat);
    formData.append("lng", location.lng);

    try {
        // 1. แสดงสถานะกำลังโหลดใน div
        resultDiv.style.backgroundColor = "#e3f2fd";
        resultDiv.style.color = "#1565c0";
        resultDiv.innerHTML = `⌛ กำลังบันทึกข้อมูล "${period}" ลงระบบ...`;

        const response = await fetch("http://localhost:3000/check", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            // --- 2. กรณีทำรายการสำเร็จ ---
            const timeString = new Date().toLocaleTimeString('th-TH');
            resultDiv.style.backgroundColor = "#e8f5e9";
            resultDiv.style.color = "#2e7d32";
            resultDiv.style.border = "2px solid #2e7d32";
            resultDiv.innerHTML = `
                <div style="font-size: 1.2em;">✅ ลงเวลาเรียบร้อยแล้ว!</div>
                <div style="font-weight: normal; font-size: 0.9em; margin-top: 5px;">
                    ช่วงเวลา: ${period} | เวลา: ${timeString} น.<br>
                    พิกัด: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
                </div>
            `;

            // 3. แสดง Pop-up แจ้งเตือน
            
            setTimeout(() => {
                alert(`🎯 ลงเวลาเรียบร้อยแล้ว!\nช่วงเวลา: ${period}\nเวลา: ${timeString} น.`);
            }, 100);

            console.log("บันทึกสำเร็จ");

        } else {
            resultDiv.style.backgroundColor = "#fff3e0";
            resultDiv.style.color = "#ef6c00";
            resultDiv.innerHTML = `❌ Server Error: ไม่สามารถบันทึกได้ (Code: ${response.status})`;
        }
    } catch (err) {
        resultDiv.style.backgroundColor = "#ffebee";
        resultDiv.style.color = "#c62828";
        resultDiv.innerHTML = `❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์`;
        console.error("Fetch Error:", err);
    }
}

// records
function goToRecords() {
  window.location.href = "/records";
}