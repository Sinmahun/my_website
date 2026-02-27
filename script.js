let map;
let officeMarker;
let userMarker;
let isCameraStarted = false;
let currentPeriod = "";

// --- ส่วนสำคัญ: ประกาศ Global Variable เพื่อให้เรียกใช้ได้ทุกฟังก์ชัน ---
let isFacePresent = false; 
let detectedOnce = true; 

const officeLocation = { lat: 13.821285, lng: 100.038904 };
const allowedRadius = 200; // เมตร

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const canvasCtx = canvas.getContext("2d");
const statusText = document.getElementById("status");
const downloadLink = document.getElementById("downloadLink");

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
        isFacePresent = true; // ตรวจเจอใบหน้า
        statusText.innerText = "สถานะ: ตรวจพบใบหน้า ✅";
        statusText.style.color = "green";

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

        // ถ้ามีการกดปุ่ม (detectedOnce = false) ให้ทำการบันทึกภาพ
        if (!detectedOnce) {
            detectedOnce = true;
            captureSnapshot();
        }
    } else {
        isFacePresent = false; // ไม่เจอใบหน้า
        statusText.innerText = "สถานะ: ไม่พบใบหน้า ❌";
        statusText.style.color = "red";
    }
});

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

function captureSnapshot() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const imageData = tempCanvas.toDataURL("image/png");
    downloadLink.href = imageData;
    downloadLink.download = `checkin_${currentPeriod}_${Date.now()}.png`;
    downloadLink.innerText = `คลิกเพื่อดูรูปหลักฐาน (ช่วง${currentPeriod})`;
    downloadLink.style.display = "inline-block";
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

// --- ฟังก์ชันหลักเมื่อกดปุ่ม ---
function checkIn(timePeriod) {
    // 1. เช็คใบหน้าก่อนเป็นอันดับแรก
    if (!isFacePresent) {
        document.getElementById("result").innerHTML = 
            `<span style="color: red;">❌ ลงเวลาไม่สำเร็จ: ไม่พบใบหน้าในกล้อง</span>`;
        return;
    }

    currentPeriod = timePeriod;
    detectedOnce = false; // เปิดสิทธิ์ให้ระบบบันทึกรูปภาพใน Frame ถัดไป
    document.getElementById("result").innerHTML = "⌛ กำลังตรวจสอบตำแหน่ง GPS...";

    if (!navigator.geolocation) {
        alert("อุปกรณ์ไม่รองรับ GPS");
        return;
    }

    navigator.geolocation.getCurrentPosition(position => {
        const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        if (userMarker) userMarker.setMap(null);
        userMarker = new google.maps.Marker({
            position: userLocation,
            map: map,
            title: "ตำแหน่งของคุณ"
        });

        const distance = calculateDistance(userLocation);
        const isSuccess = distance <= allowedRadius;

        if (isSuccess) {
            document.getElementById("result").innerHTML = 
                `<span style="color: green;">✅ ลงชื่อ "${timePeriod}" สำเร็จ!<br>ระยะห่าง: ${Math.round(distance)} เมตร</span>`;
        } else {
            document.getElementById("result").innerHTML = 
                `<span style="color: red;">❌ อยู่นอกพื้นที่อนุญาต<br>ระยะห่าง: ${Math.round(distance)} เมตร</span>`;
        }

    }, (error) => {
        document.getElementById("result").innerHTML = "❌ ไม่สามารถเข้าถึงตำแหน่งได้ (กรุณาเปิด GPS)";
    }, { enableHighAccuracy: true });
}