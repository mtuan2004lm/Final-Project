package com.example.logisticsapp

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

// Model hứng dữ liệu đơn hàng trả về từ hàm getWmsOrders của Node.js
data class WmsOrder(
    val id: Int,
    val customer_name: String,
    val product_name: String,
    val quantity: Int,
    val status: String,
    val current_dept: String,
    val is_scanned: Boolean
)

// Model phản hồi của hàm scanBarcode từ Node.js (Chứa chuỗi "message")
data class ScanResponse(
    val message: String
)

interface ApiService {
    @POST("api/auth/mobile-login")
    fun loginUser(@Body request: LoginRequest): Call<LoginResponse>

    // 1. Lấy danh sách đơn hàng đang chờ tại Kho
    @GET("api/orders/wms")
    fun getWmsOrders(): Call<List<WmsOrder>>

    // 2. Đồng bộ trạng thái quét mã vạch bằng phương thức PUT lên Node.js
    @PUT("api/orders/wms/{id}/scan-barcode")
    fun scanWmsBarcode(@Path("id") orderId: Int): Call<ScanResponse>
}