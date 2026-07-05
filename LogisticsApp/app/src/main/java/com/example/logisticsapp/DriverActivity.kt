package com.example.logisticsapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class DriverActivity : AppCompatActivity() {

    private lateinit var txtLiveGps: TextView
    private lateinit var llTripList: LinearLayout
    private lateinit var txtTripEmpty: TextView
    private lateinit var prefs: SharedPreferences

    // Tọa độ GPS gần nhất nhận được, dùng để đính kèm khi tài xế nộp E-POD
    private var lastLat: Double = 0.0
    private var lastLng: Double = 0.0
    private var hasGpsFix: Boolean = false

    companion object {
        const val PREFS_NAME = "driver_prefs"
        const val KEY_DRIVER_NAME = "driver_name"
        const val KEY_TRUCK_PLATE = "truck_plate"
    }

    private val gpsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val lat = intent?.getDoubleExtra("LAT", 0.0) ?: 0.0
            val lng = intent?.getDoubleExtra("LNG", 0.0) ?: 0.0
            lastLat = lat
            lastLng = lng
            hasGpsFix = true
            txtLiveGps.text = "Vĩ độ (Lat): $lat\nKinh độ (Lng): $lng"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_driver)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        val edtDriverName = findViewById<EditText>(R.id.edtDriverName)
        val edtTruckPlate = findViewById<EditText>(R.id.edtTruckPlate)
        val btnStart = findViewById<Button>(R.id.btnStartLog)
        val btnStop = findViewById<Button>(R.id.btnStopLog)
        val btnRefreshTrips = findViewById<Button>(R.id.btnRefreshTrips)
        val btnLogout = findViewById<Button>(R.id.btnLogout)
        txtLiveGps = findViewById(R.id.txtLiveGps)
        llTripList = findViewById(R.id.llTripList)
        txtTripEmpty = findViewById(R.id.txtTripEmpty)

        // Khôi phục tên tài xế / biển số đã lưu lần trước để khỏi gõ lại mỗi lần mở app
        prefs.getString(KEY_DRIVER_NAME, "")?.let { if (it.isNotEmpty()) edtDriverName.setText(it) }
        prefs.getString(KEY_TRUCK_PLATE, "")?.let {
            if (it.isNotEmpty()) {
                edtTruckPlate.setText(it)
                loadDriverTrips(it)
            }
        }

        btnStart.setOnClickListener {
            val name = edtDriverName.text.toString().trim()
            val plate = edtTruckPlate.text.toString().trim()

            if (name.isEmpty() || plate.isEmpty()) {
                Toast.makeText(this, "Vui lòng điền đủ thông tin!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Lưu lại để lần sau mở app tự nạp danh sách chuyến của đúng xe này
            prefs.edit()
                .putString(KEY_DRIVER_NAME, name)
                .putString(KEY_TRUCK_PLATE, plate)
                .apply()

            val serviceIntent = Intent(this, GpsBaseService::class.java)
            serviceIntent.putExtra("INFO_XE", "$name - Xe: $plate")
            serviceIntent.putExtra("LICENSE_PLATE", plate) // Dùng để GpsBaseService bắn GPS định kỳ lên server theo đúng biển số xe

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            Toast.makeText(this, "Đã khởi chạy định vị ngầm!", Toast.LENGTH_SHORT).show()

            loadDriverTrips(plate)
        }

        btnStop.setOnClickListener {
            stopService(Intent(this, GpsBaseService::class.java))
            txtLiveGps.text = "Vĩ độ (Lat): Đã dừng\nKinh độ (Lng): Đã dừng"
            hasGpsFix = false
            Toast.makeText(this, "Đã tắt định vị.", Toast.LENGTH_SHORT).show()
        }

        btnRefreshTrips.setOnClickListener {
            val plate = edtTruckPlate.text.toString().trim()
            if (plate.isEmpty()) {
                Toast.makeText(this, "Nhập biển số xe trước đã!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            loadDriverTrips(plate)
        }

        btnLogout.setOnClickListener {
            performLogout()
        }
    }

    // Đăng xuất: tắt GPS đang chạy ngầm, xóa thông tin tài xế/biển số đã lưu,
    // rồi quay về màn Đăng nhập và xóa sạch back stack (không cho bấm Back quay lại đây).
    private fun performLogout() {
        stopService(Intent(this, GpsBaseService::class.java))
        prefs.edit().clear().apply()

        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    // Gọi API lấy danh sách đơn hàng (chuyến) đang SHIPPING được gán cho đúng biển số xe này
    private fun loadDriverTrips(licensePlate: String) {
        TmsRetrofitClient.api.getDriverTrips(licensePlate).enqueue(object : Callback<List<TripOrder>> {
            override fun onResponse(call: Call<List<TripOrder>>, response: Response<List<TripOrder>>) {
                if (!response.isSuccessful) {
                    Toast.makeText(this@DriverActivity, "Lỗi tải danh sách chuyến: ${response.code()}", Toast.LENGTH_SHORT).show()
                    return
                }
                val trips = response.body() ?: emptyList()
                renderTripList(trips, licensePlate)
            }

            override fun onFailure(call: Call<List<TripOrder>>, t: Throwable) {
                Toast.makeText(this@DriverActivity, "Không thể kết nối máy chủ: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun renderTripList(trips: List<TripOrder>, licensePlate: String) {
        llTripList.removeAllViews()

        if (trips.isEmpty()) {
            txtTripEmpty.visibility = TextView.VISIBLE
            return
        }
        txtTripEmpty.visibility = TextView.GONE

        val inflater = LayoutInflater.from(this)
        for (trip in trips) {
            val row = inflater.inflate(R.layout.item_trip_row, llTripList, false)
            row.findViewById<TextView>(R.id.txtTripTitle).text =
                "PKG-600${trip.id}  •  ${trip.customer_name}  (${trip.product_name} SL:${trip.quantity})"
            row.findViewById<TextView>(R.id.txtTripRoute).text =
                "🛣️ ${trip.delivery_route ?: ""}"
            row.findViewById<TextView>(R.id.txtTripStatus).text =
                "Trạng thái: ${trip.status}  •  Xe: ${trip.assigned_truck ?: licensePlate}"

            row.findViewById<Button>(R.id.btnTripDetail).setOnClickListener {
                val gpsString = if (hasGpsFix) "$lastLat, $lastLng" else ""
                val intent = Intent(this, DriverTripDetailActivity::class.java)
                intent.putExtra(DriverTripDetailActivity.EXTRA_ORDER_ID, trip.id)
                intent.putExtra(DriverTripDetailActivity.EXTRA_CUSTOMER, trip.customer_name)
                intent.putExtra(DriverTripDetailActivity.EXTRA_PRODUCT, "${trip.product_name} (SL: ${trip.quantity})")
                intent.putExtra(DriverTripDetailActivity.EXTRA_ROUTE, trip.delivery_route ?: "")
                intent.putExtra(DriverTripDetailActivity.EXTRA_TRUCK_PLATE, licensePlate)
                intent.putExtra(DriverTripDetailActivity.EXTRA_GPS, gpsString)
                startActivity(intent)
            }

            llTripList.addView(row)
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter("GPS_UPDATE_ACTION")
        // Sử dụng ContextCompat để đăng ký tự động tương thích cờ bảo mật trên mọi phiên bản Android
        ContextCompat.registerReceiver(this, gpsReceiver, filter, ContextCompat.RECEIVER_EXPORTED)

        // Mỗi lần quay lại màn hình này (VD sau khi nộp POD xong ở màn chi tiết)
        // tự động tải lại danh sách để đơn vừa giao xong biến mất khỏi list SHIPPING.
        val plate = prefs.getString(KEY_TRUCK_PLATE, "") ?: ""
        if (plate.isNotEmpty()) loadDriverTrips(plate)
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