package com.example.logisticsapp

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class WmsLogsActivity : AppCompatActivity() {

    private lateinit var listViewLogs: ListView
    private lateinit var btnCloseLogs: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_wms_logs)

        listViewLogs = findViewById(R.id.listViewLogs)
        btnCloseLogs = findViewById(R.id.btnCloseLogs)

        btnCloseLogs.setOnClickListener { finish() }

        fetchWarehouseLogs()
    }

    private fun fetchWarehouseLogs() {
        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val apiService = retrofit.create(ApiService::class.java)

        // ĐÃ FIX: Sửa thành getWmsLogs() để khớp với hàm khai báo trong ApiService
        apiService.getWmsLogs().enqueue(object : Callback<List<WarehouseLog>> {
            override fun onResponse(call: Call<List<WarehouseLog>>, response: Response<List<WarehouseLog>>) {
                if (response.isSuccessful && response.body() != null) {
                    val logs = response.body()!!
                    val adapter = LogAdapter(this@WmsLogsActivity, logs)
                    listViewLogs.adapter = adapter
                } else {
                    Toast.makeText(this@WmsLogsActivity, "Lỗi lấy dữ liệu lịch sử nhật ký kho!", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<WarehouseLog>>, t: Throwable) {
                Toast.makeText(this@WmsLogsActivity, "Mất kết nối máy chủ dữ liệu nhật ký!", Toast.LENGTH_SHORT).show()
            }
        })
    }

    inner class LogAdapter(context: AppCompatActivity, private val logs: List<WarehouseLog>) :
        ArrayAdapter<WarehouseLog>(context, 0, logs) {

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(context).inflate(android.R.layout.simple_list_item_2, parent, false)
            val log = logs[position]

            val text1 = view.findViewById<TextView>(android.R.id.text1)
            val text2 = view.findViewById<TextView>(android.R.id.text2)

            text1.text = "📦 Đơn: PKG-${60000 + log.orderId} | ${log.notes}"
            text1.setTypeface(null, android.graphics.Typeface.BOLD)
            text1.setTextColor(android.graphics.Color.parseColor("#2C3E50"))

            text2.text = "Lịch trình: ${log.oldStatus} ➡️ ${log.newStatus}\nThời gian: ${log.changedAt}"
            text2.setTextColor(android.graphics.Color.parseColor("#7F8C8D"))

            return view
        }
    }
}