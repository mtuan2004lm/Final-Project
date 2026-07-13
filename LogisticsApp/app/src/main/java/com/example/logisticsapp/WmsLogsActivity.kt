package com.example.logisticsapp

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
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
    private lateinit var btnTabOverview: Button
    private lateinit var btnTabLogs: Button
    private lateinit var btnBackLogs: Button

    private lateinit var edtSearchLog: EditText
    private lateinit var btnSearchLog: Button
    private var allLogs: List<WarehouseLog> = emptyList() // Lưu trữ danh sách gốc

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_wms_logs)

        listViewLogs = findViewById(R.id.listViewLogs)
        btnTabOverview = findViewById(R.id.btnTabOverview)
        btnTabLogs = findViewById(R.id.btnTabLogs)
        btnBackLogs = findViewById(R.id.btnBackLogs)
        edtSearchLog = findViewById(R.id.edtSearchLog)
        btnSearchLog = findViewById(R.id.btnSearchLog)

        // MỚI: nút Back đặt ngay đầu màn hình, đóng màn Nhật ký và quay về WarehouseActivity
        // ngay lập tức, không cần cuộn xuống tìm nút "Tổng quan" ở cuối như trước.
        btnBackLogs.setOnClickListener { finish() }

        // Bấm vào Tổng quan cũng đóng màn hình Log và quay về WarehouseActivity (giữ hành vi cũ)
        btnTabOverview.setOnClickListener { finish() }

        // Logic tìm kiếm
        btnSearchLog.setOnClickListener {
            val query = edtSearchLog.text.toString().trim()
            if (query.isEmpty()) {
                listViewLogs.adapter = LogAdapter(this@WmsLogsActivity, allLogs) // Hiển thị tất cả
            } else {
                // Lọc những log khớp ID (ví dụ: gõ 60001 hoặc 1 đều tìm ra kiện PKG-60001)
                val filtered = allLogs.filter {
                    it.orderId.toString() == query || (60000 + it.orderId).toString() == query
                }
                listViewLogs.adapter = LogAdapter(this@WmsLogsActivity, filtered)
            }
        }

        fetchWarehouseLogs()
    }

    private fun fetchWarehouseLogs() {
        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val apiService = retrofit.create(ApiService::class.java)

        apiService.getWmsLogs().enqueue(object : Callback<List<WarehouseLog>> {
            override fun onResponse(call: Call<List<WarehouseLog>>, response: Response<List<WarehouseLog>>) {
                if (response.isSuccessful && response.body() != null) {
                    allLogs = response.body()!!
                    listViewLogs.adapter = LogAdapter(this@WmsLogsActivity, allLogs)
                } else {
                    Toast.makeText(this@WmsLogsActivity, "Error fetching warehouse log history!", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<WarehouseLog>>, t: Throwable) {
                Toast.makeText(this@WmsLogsActivity, "Lost connection to the log data server!", Toast.LENGTH_SHORT).show()
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

            text1.text = "📦 Order: PKG-${60000 + log.orderId} | ${log.notes}"
            text1.setTypeface(null, android.graphics.Typeface.BOLD)
            text1.setTextColor(android.graphics.Color.parseColor("#2C3E50"))

            text2.text = "Timeline: ${log.oldStatus} ➡️ ${log.newStatus}\nTime: ${log.changedAt}"
            text2.setTextColor(android.graphics.Color.parseColor("#7F8C8D"))

            return view
        }
    }
}