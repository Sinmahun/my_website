let map;
let officeMarker;
let userMarker;
//13.821285112356703, 100.03890459620975
const officeLocation = {
  lat: 13.821285112356703,
  lng: 100.03890459620975
};

const allowedRadius = 200; // เมตร

// เปิดกล้อง
async function startCamera() {
  const video = document.getElementById("video");
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
}

// โหลดแผนที่ (Google เรียกอัตโนมัติ)
function initMap() {

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 17,
    center: officeLocation
  });

  // หมุดบริษัท
  officeMarker = new google.maps.Marker({
    position: officeLocation,
    map: map,
    title: "บริษัท"
  });

  // วงกลม 200 เมตร
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
}

// ฟังก์ชันกลางสำหรับคำนวณระยะ (ใช้ Google)
function calculateDistance(userLocation) {
  return google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(userLocation),
    new google.maps.LatLng(officeLocation)
  );
}

// กดตรวจสอบตำแหน่ง
function checkLocation() {

  if (!navigator.geolocation) {
    alert("อุปกรณ์ไม่รองรับ GPS");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {

    const userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    if (userMarker) {
      userMarker.setMap(null);
    }

    userMarker = new google.maps.Marker({
      position: userLocation,
      map: map,
      title: "ตำแหน่งคุณ"
    });

    const distance = calculateDistance(userLocation);

    document.getElementById("result").innerHTML =
      distance <= allowedRadius
        ? `✅ อยู่ในระยะ ${Math.round(distance)} เมตร`
        : `❌ อยู่นอกระยะ ${Math.round(distance)} เมตร`;

  }, () => {
    alert("ไม่สามารถดึงตำแหน่งได้");
  });
}

// กดลงเวลา
function checkIn(timePeriod) {

  if (!navigator.geolocation) {
    alert("อุปกรณ์ไม่รองรับ GPS");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {

    const userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    const distance = calculateDistance(userLocation);

    if (distance <= allowedRadius) {
      document.getElementById("result").innerHTML =
        `✅ ลงเวลา "${timePeriod}" สำเร็จ <br>
         ระยะห่าง: ${Math.round(distance)} เมตร`;
    } else {
      document.getElementById("result").innerHTML =
        `❌ คุณอยู่นอกพื้นที่อนุญาต <br>
         ระยะห่าง: ${Math.round(distance)} เมตร`;
    }

  }, () => {
    document.getElementById("result").innerHTML =
      "❌ ไม่สามารถเข้าถึงตำแหน่งได้";
  });
}