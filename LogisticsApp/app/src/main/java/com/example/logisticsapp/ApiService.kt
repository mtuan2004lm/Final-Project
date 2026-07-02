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

// SỬA TẠI ĐÂY: Thêm ": java.io.Serializable" để object này có thể truyền đi giữa các Màn hình (Activity)
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
) : java.io.Serializable // <-- Thêm dòng này vào cuối class

data class ScanResponse(
    val message: String? = "",
    val order: WmsOrder? = null
)

// THÊM MỚI: Model cho Nhật ký kho
data class WarehouseLog(
    val id: Int = 0,
    @SerializedName("order_id") val orderId: Int = 0,
    val notes: String? = "",
    @SerializedName("old_status") val oldStatus: String? = "",
    @SerializedName("new_status") val newStatus: String? = "",
    @SerializedName("changed_at") val changedAt: String? = ""
)

interface ApiService {

    @POST("api/auth/mobile-login")
    fun loginUser(@Body request: Any): Call<Any>

    @GET("api/orders/wms")
    fun getWmsOrders(): Call<List<WmsOrder>>

    @PUT("api/orders/wms/location/{id}")
    fun updateWmsLocation(@Path("id") id: Int, @Body body: Map<String, String>): Call<ScanResponse>

    @PUT("api/orders/wms/scan/{id}")
    fun scanWmsBarcode(@Path("id") id: Int): Call<ScanResponse>

    @GET("api/orders/wms/logs")
    fun getWmsLogs(): Call<List<WarehouseLog>>
}