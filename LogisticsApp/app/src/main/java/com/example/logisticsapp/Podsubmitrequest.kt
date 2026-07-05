package com.example.logisticsapp

// Khớp với body mà PUT /api/orders/tms/:id/pod-submit yêu cầu
// (xem tmsController.submitDriverPod ở backend)
data class PodSubmitRequest(
    val bot_fee: String,
    val fuel_fee: String,
    val driver_notes: String,
    val pod_image: String,
    val gps_coordinates: String
)