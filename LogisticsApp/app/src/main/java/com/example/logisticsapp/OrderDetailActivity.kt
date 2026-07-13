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
    private lateinit var btnBackTop: Button

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
        btnBackTop = findViewById(R.id.btnBackTop)

        currentOrder = intent.getSerializableExtra("CHOSEN_ORDER") as? WmsOrder

        if (currentOrder != null) {
            setupOrderDetails(currentOrder!!)
        } else {
            Toast.makeText(this, "No valid package data found!", Toast.LENGTH_SHORT).show()
            finish()
        }

        // Nút back: đóng activity hiện tại, quay về màn hình trước đó (danh sách)
        btnBack.setOnClickListener {
            finish()
        }

        // MỚI: nút Back đặt ngay đầu màn hình (cùng hành vi với btnBack ở cuối) để
        // người dùng không phải cuộn hết qua ảnh và ô nhập barcode mới quay lại được.
        btnBackTop.setOnClickListener {
            finish()
        }

        btnConfirmScan.setOnClickListener {
            val inputCode = edtBarcodeInput.text.toString().trim()
            val expectedCode = "PKG-${60000 + currentOrder!!.id}"

            if (inputCode.isEmpty()) {
                Toast.makeText(this, "Please enter/scan the verification code!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (inputCode.equals(expectedCode, ignoreCase = true)) {
                submitScanBarcode(currentOrder!!.id)
            } else {
                Toast.makeText(this, "Incorrect package code! Expected: $expectedCode", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setupOrderDetails(order: WmsOrder) {
        txtDetailTitle.text = "PACKAGE DETAILS: PKG-${60000 + order.id}"
        txtDetailInfo.text = "Order Owner: ${order.customer_name}\nProduct Name: ${order.product_name}\nQuantity: ${order.quantity} items"

        txtDetailLocation.text = "📍 Storage Bin/Shelf Location: ${if (order.warehouseLocation.isNullOrEmpty()) "Not assigned yet" else order.warehouseLocation}"
        txtDetailCondition.text = "⚠️ Damage Condition Report: ${if (order.cargoCondition.isNullOrEmpty()) "Goods intact" else order.cargoCondition}"

        if (!order.productImage.isNullOrEmpty()) {
            val fullUrl = ApiConfig.BASE_URL + order.productImage.removePrefix("/")
            loadImageFromUrl(fullUrl, imgProductInitial)
        }

        // Ưu tiên hiển thị damageImage (ảnh hư hại) nếu có, nếu không thì lấy cargoImage
        val imgToLoad = if (!order.damageImage.isNullOrEmpty()) order.damageImage else order.cargoImage
        if (!imgToLoad.isNullOrEmpty()) {
            val fullUrl = ApiConfig.BASE_URL + imgToLoad.removePrefix("/")
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
                    imageView.setBackgroundColor(android.graphics.Color.TRANSPARENT) // Xóa màu nền xám
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
                    Toast.makeText(this@OrderDetailActivity, "Yard intake confirmed successfully!", Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    val statusCode = response.code()
                    val errorBody = response.errorBody()?.string() ?: "No error description available."
                    Log.e("WMS_API_ERROR", "HTTP Code: $statusCode | Error content from Server: $errorBody")
                    Toast.makeText(
                        this@OrderDetailActivity,
                        "Warehouse system rejected (Error $statusCode): $errorBody",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                Toast.makeText(this@OrderDetailActivity, "Network connection error to warehouse server: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }
}