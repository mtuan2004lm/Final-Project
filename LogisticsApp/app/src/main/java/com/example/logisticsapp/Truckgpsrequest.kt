package com.example.logisticsapp

// Khớp với body mà PUT /api/orders/tms/fleet/gps yêu cầu
// (xem tmsController.updateTruckGps ở backend) - dùng để bắn tọa độ
// định kỳ lên server, phục vụ theo dõi vị trí xe thời gian thực trên web TMS.
data class TruckGpsRequest(
    val license_plate: String,
    val lat: Double,
    val lng: Double
)