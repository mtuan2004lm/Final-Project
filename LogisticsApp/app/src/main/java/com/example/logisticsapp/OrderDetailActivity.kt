package com.example.logisticsapp

import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class OrderDetailActivity : AppCompatActivity() {

    private lateinit var txtDetailTitle: TextView
    private lateinit var txtDetailInfo: TextView
    private lateinit var txtDetailLocation: TextView
    private lateinit var txtDetailCondition: TextView
    private lateinit var imgProductInitial: ImageView
    private lateinit var imgProductDamage: ImageView
    private lateinit var edtBarcodeInput: EditText
    private lateinit var btnConfirmScan: Button
    private lateinit var btnBack: Button

    private var currentOrder: WmsOrder? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_order_detail)

        txtDetailTitle = findViewById(R.id.txtDetailTitle)
        txtDetailInfo = findViewById(R.id.txtDetailInfo)
        txtDetailLocation = findViewById(R.id.txtDetailLocation)
        txtDetailCondition = findViewById(R.id.txtDetailCondition)
        imgProductInitial = findViewById(R.id.imgProductInitial)
        imgProductDamage = findViewById(R.id.imgProductDamage)
        edtBarcodeInput = findViewById(R.id.edtBarcodeInput)
        btnConfirmScan = findViewById(R.id.btnConfirmScan)
        btnBack = findViewById(R.id.btnBack)

        currentOrder = intent.getSerializableExtra("CHOSEN_ORDER") as? WmsOrder

        if (currentOrder != null) {
            setupOrderDetails(currentOrder!!)
        } else {
            Toast.makeText(this, "Không tìm thấy dữ liệu kiện hàng hợp lệ!", Toast.LENGTH_SHORT).show()
            finish()
        }

        btnBack.setOnClickListener { finish() }

        btnConfirmScan.setOnClickListener {
            val inputCode = edtBarcodeInput.text.toString().trim()
            val expectedCode = "PKG-${60000 + currentOrder!!.id}"

            if (inputCode.isEmpty()) {
                Toast.makeText(this, "Vui lòng nhập/quét mã xác thực!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (inputCode.equals(expectedCode, ignoreCase = true)) {
                submitScanBarcode(currentOrder!!.id)
            } else {
                Toast.makeText(this, "Mã kiện nhập sai! Yêu cầu chính xác: $expectedCode", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setupOrderDetails(order: WmsOrder) {
        txtDetailTitle.text = "CHI TIẾT KIỆN HÀNG: PKG-${60000 + order.id}"
        txtDetailInfo.text = "Chủ đơn hàng: ${order.customer_name}\nTên mặt hàng: ${order.product_name}\nSố lượng: ${order.quantity} sản phẩm"

        txtDetailLocation.text = "📍 Vị trí ô kệ lưu kho: ${if (order.warehouseLocation.isNullOrEmpty()) "Chưa gán vị trí ô bãi" else order.warehouseLocation}"
        txtDetailCondition.text = "⚠️ Tình trạng báo hư tổn: ${if (order.cargoCondition.isNullOrEmpty()) "Hàng hóa nguyên vẹn" else order.cargoCondition}"

        if (!order.productImage.isNullOrEmpty()) {
            val fullUrl = ApiConfig.BASE_URL + order.productImage.removePrefix("/")
            loadImageFromUrl(fullUrl, imgProductInitial)
        }

        if (!order.cargoImage.isNullOrEmpty()) {
            val fullUrl = ApiConfig.BASE_URL + order.cargoImage.removePrefix("/")
            loadImageFromUrl(fullUrl, imgProductDamage)
        }
    }

    private fun loadImageFromUrl(urlString: String, imageView: ImageView) {
        thread {
            try {
                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                connection.doInput = true
                connection.connect()
                val input = connection.inputStream
                val myBitmap = BitmapFactory.decodeStream(input)
                runOnUiThread {
                    imageView.setImageBitmap(myBitmap)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun submitScanBarcode(orderId: Int) {
        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val apiService = retrofit.create(ApiService::class.java)

        apiService.scanWmsBarcode(orderId).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(call: Call<ScanResponse>, response: Response<ScanResponse>) {
                if (response.isSuccessful) {
                    Toast.makeText(this@OrderDetailActivity, "Xác nhận nhập kho bãi thành công!", Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    // ĐÃ CẢI TIẾN: Trích xuất mã trạng thái HTTP và chi tiết phản hồi lỗi từ Backend trả về
                    val statusCode = response.code()
                    val errorBody = response.errorBody()?.string() ?: "Không có thông tin mô tả lỗi."

                    // Đẩy dữ liệu ra Logcat để tiện kiểm tra nội dung JSON lỗi trong Android Studio
                    Log.e("WMS_API_ERROR", "Mã HTTP: $statusCode | Nội dung lỗi từ Server: $errorBody")

                    // Show chi tiết thông tin lỗi trực tiếp lên UI để người dùng biết lý do bị từ chối
                    Toast.makeText(
                        this@OrderDetailActivity,
                        "Hệ thống kho từ chối (Lỗi $statusCode): $errorBody",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                Toast.makeText(this@OrderDetailActivity, "Lỗi kết nối mạng đến máy chủ kho: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }
}