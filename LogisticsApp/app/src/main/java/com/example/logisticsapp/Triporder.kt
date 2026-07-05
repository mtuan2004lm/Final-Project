package com.example.logisticsapp

// Khớp với JSON trả về từ GET /api/orders/tms/driver/{license_plate}
// (xem tmsController.getDriverTrips ở backend)
data class TripOrder(
    val id: Int,
    val customer_name: String,
    val product_name: String,
    val quantity: Int,
    val status: String,
    val delivery_route: String? = "",
    val assigned_truck: String? = "",
    // Các trường phí có thể trả về dạng số hoặc chuỗi tùy driver PG -> để String cho an toàn khi parse Gson
    val bot_fee: String? = "0",
    val fuel_fee: String? = "0",
    val driver_notes: String? = "",
    val gps_coordinates: String? = ""
)