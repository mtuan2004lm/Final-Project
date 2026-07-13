package com.example.logisticsapp

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val edtUsername = findViewById<EditText>(R.id.edtUsername)
        val edtPassword = findViewById<EditText>(R.id.edtPassword)
        val btnLogin = findViewById<Button>(R.id.btnLogin)

        // Khởi tạo Retrofit lấy URL từ cấu hình ApiConfig có sẵn của bạn
        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val apiService = retrofit.create(ApiService::class.java)

        btnLogin.setOnClickListener {
            val username = edtUsername.text.toString().trim()
            val password = edtPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill in all the information!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Dùng cấu trúc Map để khớp hoàn toàn với kiểu Any trong ApiService của bạn
            val requestData = mapOf(
                "username" to username,
                "password" to password
            )

            // Gửi dữ liệu và xử lý Callback dạng <Any> để dọn sạch hoàn toàn lỗi gạch đỏ
            apiService.loginUser(requestData).enqueue(object : Callback<Any> {
                override fun onResponse(call: Call<Any>, response: Response<Any>) {
                    if (response.isSuccessful) {
                        // Ép kiểu dữ liệu trả về thành Map để bóc tách thông tin thành công/thất bại
                        val resBody = response.body() as? Map<*, *>
                        val isSuccess = resBody?.get("success") as? Boolean ?: false

                        if (isSuccess) {
                            val role = (resBody?.get("role") as? String)?.lowercase() ?: ""
                            when (role) {
                                // "tms": tài khoản phòng TMS trong hệ thống của bạn dùng chung
                                // cho cả điều phối lẫn tài xế -> đăng nhập mobile mở màn tài xế.
                                // "driver": vẫn giữ lại phòng trường hợp sau này bạn tách riêng
                                // role cho tài xế khỏi role "tms".
                                "driver", "tms" -> {
                                    Toast.makeText(this@LoginActivity, "Driver (TMS) login successful!", Toast.LENGTH_SHORT).show()
                                    val intent = Intent(this@LoginActivity, DriverActivity::class.java)
                                    startActivity(intent)
                                    finish()
                                }
                                "wms" -> {
                                    Toast.makeText(this@LoginActivity, "WMS login successful!", Toast.LENGTH_SHORT).show()
                                    val intent = Intent(this@LoginActivity, WarehouseActivity::class.java)
                                    startActivity(intent)
                                    finish()
                                }
                                else -> {
                                    Toast.makeText(this@LoginActivity, "This account does not have access to the Mobile app!", Toast.LENGTH_LONG).show()
                                }
                            }
                        } else {
                            val msg = resBody?.get("message") as? String ?: "Incorrect username or password!"
                            Toast.makeText(this@LoginActivity, msg, Toast.LENGTH_LONG).show()
                        }
                    } else {
                        Toast.makeText(this@LoginActivity, "System response error: ${response.code()}", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Any>, t: Throwable) {
                    Toast.makeText(this@LoginActivity, "Unable to connect to the server: ${t.message}", Toast.LENGTH_LONG).show()
                }
            })
        }
    }
}