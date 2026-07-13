package com.example.logisticsapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class GpsBaseService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    // Biển số xe của tài xế đang chạy chuyến này, dùng để bắn GPS định kỳ
    // lên server (PUT /api/orders/tms/fleet/gps) theo đúng xe. Được truyền
    // vào từ DriverActivity qua Intent extra "LICENSE_PLATE".
    private var licensePlate: String = ""

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000)
            .setMinUpdateIntervalMillis(5000)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    // 1) Giữ nguyên hành vi cũ: báo tọa độ về DriverActivity qua broadcast local
                    val intent = Intent("GPS_UPDATE_ACTION")
                    intent.putExtra("LAT", location.latitude)
                    intent.putExtra("LNG", location.longitude)
                    sendBroadcast(intent)

                    // 2) MỚI: đẩy tọa độ lên server để web TMS theo dõi vị trí xe thời gian thực
                    pushGpsToServer(location.latitude, location.longitude)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        } catch (e: SecurityException) {
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val vehicleInfo = intent?.getStringExtra("VEHICLE_INFO") ?: "Unknown vehicle"
        licensePlate = intent?.getStringExtra("LICENSE_PLATE") ?: ""

        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, "BASE_GPS_CHANNEL")
            .setContentTitle("Trip: $vehicleInfo")
            .setContentText("Base system is recording location in the background...")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .build()

        startForeground(1, notification)
        return START_STICKY
    }

    // Gọi API cập nhật GPS thời gian thực cho xe. Lỗi mạng ở đây không nên
    // làm crash hay dừng service - chỉ log lại, lần cập nhật tiếp theo (5-10s sau) sẽ thử lại.
    private fun pushGpsToServer(lat: Double, lng: Double) {
        if (licensePlate.isEmpty()) return

        val body = TruckGpsRequest(license_plate = licensePlate, lat = lat, lng = lng)
        TmsRetrofitClient.api.updateTruckGps(body).enqueue(object : Callback<Any> {
            override fun onResponse(call: Call<Any>, response: Response<Any>) {
                // Không cần xử lý gì thêm, chạy ngầm hoàn toàn im lặng
            }

            override fun onFailure(call: Call<Any>, t: Throwable) {
                // Bỏ qua lỗi mạng tạm thời, chờ lần cập nhật vị trí kế tiếp
            }
        })
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("BASE_GPS_CHANNEL", "GPS Simulation", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}