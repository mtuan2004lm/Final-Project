package com.example.logisticsapp

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

// Màn hình chi tiết 1 chuyến hàng cho tài xế: nhập phí BOT/dầu + ghi chú,
// rồi nộp biên bản E-POD về backend (PUT /api/orders/tms/:id/pod-submit).
// Sau khi nộp thành công, đơn chuyển trạng thái DELIVERED và current_dept = ACC
// (đúng luồng nghiệp vụ: TMS bàn giao dữ liệu chi phí sang phòng Kế toán).
class DriverTripDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ORDER_ID = "EXTRA_ORDER_ID"
        const val EXTRA_CUSTOMER = "EXTRA_CUSTOMER"
        const val EXTRA_PRODUCT = "EXTRA_PRODUCT"
        const val EXTRA_ROUTE = "EXTRA_ROUTE"
        const val EXTRA_TRUCK_PLATE = "EXTRA_TRUCK_PLATE"
        const val EXTRA_GPS = "EXTRA_GPS"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_driver_trip_detail)

        val orderId = intent.getIntExtra(EXTRA_ORDER_ID, -1)
        val customer = intent.getStringExtra(EXTRA_CUSTOMER) ?: ""
        val product = intent.getStringExtra(EXTRA_PRODUCT) ?: ""
        val route = intent.getStringExtra(EXTRA_ROUTE) ?: ""
        val truckPlate = intent.getStringExtra(EXTRA_TRUCK_PLATE) ?: ""
        val gpsFromDriverScreen = intent.getStringExtra(EXTRA_GPS) ?: ""

        if (orderId == -1) {
            Toast.makeText(this, "Missing order code!", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        findViewById<TextView>(R.id.txtDetailOrderId).text = "Package Code: PKG-600$orderId"
        findViewById<TextView>(R.id.txtDetailCustomer).text = "Customer: $customer"
        findViewById<TextView>(R.id.txtDetailProduct).text = "Cargo: $product"
        findViewById<TextView>(R.id.txtDetailRoute).text = "🛣️ Route: $route"
        findViewById<TextView>(R.id.txtDetailTruck).text = "🚛 Vehicle: $truckPlate"

        val txtGps = findViewById<TextView>(R.id.txtDetailGps)
        txtGps.text = if (gpsFromDriverScreen.isNotEmpty())
            gpsFromDriverScreen
        else
            "No GPS signal yet (press 'Start Trip' on the previous screen to enable location tracking)"

        val edtBotFee = findViewById<EditText>(R.id.edtBotFee)
        val edtFuelFee = findViewById<EditText>(R.id.edtFuelFee)
        val edtNotes = findViewById<EditText>(R.id.edtDriverNotes)
        val btnSubmit = findViewById<Button>(R.id.btnSubmitPod)

        btnSubmit.setOnClickListener {
            val botFee = edtBotFee.text.toString().trim().ifEmpty { "0" }
            val fuelFee = edtFuelFee.text.toString().trim().ifEmpty { "0" }
            val notes = edtNotes.text.toString().trim()
            val gpsCoordinates = if (gpsFromDriverScreen.isNotEmpty()) gpsFromDriverScreen else "Unknown"

            btnSubmit.isEnabled = false
            val body = PodSubmitRequest(
                bot_fee = botFee,
                fuel_fee = fuelFee,
                driver_notes = notes,
                // Chưa tích hợp chụp ảnh thật (ngoài phạm vi yêu cầu hiện tại) -> dùng ảnh
                // placeholder giống hệt cách web đang mô phỏng, để giữ đồng bộ dữ liệu demo.
                pod_image = "https://cdn-storage.logistics.pro/pod_600$orderId.jpg",
                gps_coordinates = gpsCoordinates
            )

            TmsRetrofitClient.api.submitPod(orderId, body).enqueue(object : Callback<Any> {
                override fun onResponse(call: Call<Any>, response: Response<Any>) {
                    btnSubmit.isEnabled = true
                    if (response.isSuccessful) {
                        Toast.makeText(this@DriverTripDetailActivity, "E-POD submitted successfully! The order has been forwarded to Accounting.", Toast.LENGTH_LONG).show()
                        finish() // Quay lại DriverActivity, onResume() ở đó sẽ tự tải lại danh sách chuyến
                    } else {
                        Toast.makeText(this@DriverTripDetailActivity, "System response error: ${response.code()}", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Any>, t: Throwable) {
                    btnSubmit.isEnabled = true
                    Toast.makeText(this@DriverTripDetailActivity, "Unable to connect to the server: ${t.message}", Toast.LENGTH_LONG).show()
                }
            })
        }
    }
}