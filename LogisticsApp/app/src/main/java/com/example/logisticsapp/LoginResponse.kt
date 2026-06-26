package com.example.logisticsapp

data class LoginResponse(
    val success: Boolean,
    val message: String,
    val token: String? = null,
    val role: String? = null // Thêm trường này để nhận diện "wms" hoặc "tms" từ PostgreSQL
)