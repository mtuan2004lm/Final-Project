package com.example.logisticsapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class DriverActivity : AppCompatActivity() {

    private lateinit var txtLiveGps: TextView

    private val gpsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val lat = intent?.getDoubleExtra("LAT", 0.0) ?: 0.0
            val lng = intent?.getDoubleExtra("LNG", 0.0) ?: 0.0
            txtLiveGps.text = "Vĩ độ (Lat): $lat\nKinh độ (Lng): $lng"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_driver)

        val edtDriverName = findViewById<EditText>(R.id.edtDriverName)
        val edtTruckPlate = findViewById<EditText>(R.id.edtTruckPlate)
        val btnStart = findViewById<Button>(R.id.btnStartLog)
        val btnStop = findViewById<Button>(R.id.btnStopLog)
        txtLiveGps = findViewById(R.id.txtLiveGps)

        btnStart.setOnClickListener {
            val name = edtDriverName.text.toString().trim()
            val plate = edtTruckPlate.text.toString().trim()

            if (name.isEmpty() || plate.isEmpty()) {
                Toast.makeText(this, "Vui lòng điền đủ thông tin!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val serviceIntent = Intent(this, GpsBaseService::class.java)
            serviceIntent.putExtra("INFO_XE", "$name - Xe: $plate")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            Toast.makeText(this, "Đã khởi chạy định vị ngầm!", Toast.LENGTH_SHORT).show()
        }

        btnStop.setOnClickListener {
            stopService(Intent(this, GpsBaseService::class.java))
            txtLiveGps.text = "Vĩ độ (Lat): Đã dừng\nKinh độ (Lng): Đã dừng"
            Toast.makeText(this, "Đã tắt định vị.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter("GPS_UPDATE_ACTION")
        // Sử dụng ContextCompat để đăng ký tự động tương thích cờ bảo mật trên mọi phiên bản Android
        ContextCompat.registerReceiver(this, gpsReceiver, filter, ContextCompat.RECEIVER_EXPORTED)
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(gpsReceiver)
        } catch (e: Exception) {
            // Tránh crash nếu chưa đăng ký
        }
    }
}