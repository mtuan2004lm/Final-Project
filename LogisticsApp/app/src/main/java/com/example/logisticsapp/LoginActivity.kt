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

        // Cấu hình kết nối API (Thay IP 10.0.2.2 thành IP server thật của bạn nếu cần)
        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:3000/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val apiService = retrofit.create(ApiService::class.java)

        btnLogin.setOnClickListener {
            val username = edtUsername.text.toString().trim()
            val password = edtPassword.text.toString().trim()

            if (username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Vui lòng điền đủ thông tin!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val requestData = LoginRequest(username, password)

            apiService.loginUser(requestData).enqueue(object : Callback<LoginResponse> {
                override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                    if (response.isSuccessful) {
                        val loginResponse = response.body()

                        if (loginResponse != null && loginResponse.success) {
                            val userRole = loginResponse.role?.lowercase()?.trim()

                            // XỬ LÝ PHÂN QUYỀN ĐIỀU HƯỚNG MÀN HÌNH TẠI ĐÂY
                            when (userRole) {
                                "tms" -> {
                                    Toast.makeText(this@LoginActivity, "Đăng nhập TMS thành công!", Toast.LENGTH_SHORT).show()
                                    val intent = Intent(this@LoginActivity, DriverActivity::class.java)
                                    startActivity(intent)
                                    finish()
                                }
                                "wms" -> {
                                    Toast.makeText(this@LoginActivity, "Đăng nhập WMS thành công!", Toast.LENGTH_SHORT).show()
                                    val intent = Intent(this@LoginActivity, WarehouseActivity::class.java)
                                    startActivity(intent)
                                    finish()
                                }
                                else -> {
                                    // Từ chối nếu user thuộc các role khác trong Database (Ví dụ: accountant, admin_hr...)
                                    Toast.makeText(this@LoginActivity, "Tài khoản của bạn không có quyền truy cập ứng dụng Mobile này!", Toast.LENGTH_LONG).show()
                                }
                            }
                        } else {
                            val msg = loginResponse?.message ?: "Sai tài khoản hoặc mật khẩu!"
                            Toast.makeText(this@LoginActivity, msg, Toast.LENGTH_LONG).show()
                        }
                    } else {
                        Toast.makeText(this@LoginActivity, "Lỗi kết nối hệ thống: ${response.code()}", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                    Toast.makeText(this@LoginActivity, "Không thể kết nối đến máy chủ: ${t.message}", Toast.LENGTH_LONG).show()
                }
            })
        }
    }
}