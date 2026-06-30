package com.example.logisticsapp

import com.google.gson.annotations.SerializedName
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

object ApiConfig {
    // Nếu chạy bằng Android Emulator thì dùng 10.0.2.2
    // Nếu chạy bằng điện thoại thật thì đổi thành IP máy tính chạy backend.
    const val BASE_URL = "http://10.0.2.2:3000/"
}

data class WmsOrder(
    val id: Int = 0,
    val customer_name: String? = "",
    val product_name: String? = "",
    val quantity: Int = 0,
    val status: String? = "",
    val current_dept: String? = "",

    @SerializedName("is_scanned")
    val isScanned: Boolean = false,

    @SerializedName("warehouse_location")
    val warehouseLocation: String? = "",

    @SerializedName("cargo_image")
    val cargoImage: String? = "",

    @SerializedName("product_image")
    val productImage: String? = "",

    @SerializedName("cargo_condition")
    val cargoCondition: String? = ""
)

data class ScanResponse(
    val message: String? = "",
    val order: WmsOrder? = null
)

interface ApiService {

    @POST("api/auth/mobile-login")
    fun loginUser(@Body request: LoginRequest): Call<LoginResponse>

    @GET("api/orders/wms")
    fun getWmsOrders(): Call<List<WmsOrder>>

    // ĐÃ SỬA CHUẨN: Đổi thành "scan-barcode" để khớp chuẩn với hàm scanBarcode trong wmsController.js
    @PUT("api/orders/wms/{id}/scan-barcode")
    fun scanWmsBarcode(@Path("id") orderId: Int): Call<ScanResponse>
}