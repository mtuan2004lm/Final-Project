package com.example.logisticsapp

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

// Singleton Retrofit riêng cho TMS. Tái sử dụng ApiConfig.BASE_URL đã có sẵn
// trong project (được dùng trong LoginActivity.kt). Nếu project của bạn đã
// có 1 RetrofitClient dùng chung, có thể xóa file này và dùng lại client đó
// miễn là nó implement được TmsApiService::class.java.
object TmsRetrofitClient {
    val api: TmsApiService by lazy {
        Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TmsApiService::class.java)
    }
}