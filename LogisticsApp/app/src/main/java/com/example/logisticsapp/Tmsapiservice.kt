package com.example.logisticsapp

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path

// GHI CHÚ: Đây là interface Retrofit RIÊNG cho các API TMS mới (đặt tách biệt
// với ApiService.kt sẵn có của bạn để không phải sửa file đó - vì file này
// không có trong danh sách bạn gửi nên tôi không biết cấu trúc/tên hiện tại
// của nó). Nếu bạn muốn gộp chung vào ApiService.kt cũ, chỉ cần copy 3 hàm
// bên dưới vào interface đó là dùng được, không cần TmsRetrofitClient.kt nữa.
//
// ĐÃ XÁC NHẬN: ApiConfig.BASE_URL = "http://10.0.2.2:3000/" (không có "/api/"),
// nên mỗi đường dẫn bên dưới phải tự thêm tiền tố "api/" vào đầu.
interface TmsApiService {

    // Lấy danh sách chuyến (đơn hàng) đang SHIPPING được gán cho xe của tài xế
    @GET("api/orders/tms/driver/{license_plate}")
    fun getDriverTrips(@Path("license_plate") licensePlate: String): Call<List<TripOrder>>

    // Tài xế nộp biên bản E-POD: phí BOT, tiền dầu, ghi chú, tọa độ GPS lúc giao hàng
    @PUT("api/orders/tms/{id}/pod-submit")
    fun submitPod(@Path("id") orderId: Int, @Body body: PodSubmitRequest): Call<Any>

    // GpsBaseService gọi định kỳ để đẩy tọa độ GPS thời gian thực của xe lên server
    @PUT("api/orders/tms/fleet/gps")
    fun updateTruckGps(@Body body: TruckGpsRequest): Call<Any>
}