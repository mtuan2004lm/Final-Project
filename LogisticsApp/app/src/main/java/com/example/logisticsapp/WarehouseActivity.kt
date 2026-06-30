package com.example.logisticsapp

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

class WarehouseActivity : AppCompatActivity() {

    private lateinit var listViewOrders: ListView
    private lateinit var txtSelectedOrder: TextView
    private lateinit var apiService: ApiService

    private var listOrdersFromServer: List<WmsOrder> = emptyList()
    private var selectedOrderId: Int = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_warehouse)

        val btnScan = findViewById<Button>(R.id.btnScan)
        val btnReload = findViewById<Button>(R.id.btnReload)
        val btnLogout = findViewById<Button>(R.id.btnLogout)
        listViewOrders = findViewById(R.id.listViewOrders)
        txtSelectedOrder = findViewById(R.id.txtSelectedOrder)

        btnScan.text = "NHẬP / QUÉT MÃ KIỆN HÀNG"

        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        apiService = retrofit.create(ApiService::class.java)

        loadWmsOrders()

        btnReload.setOnClickListener {
            Toast.makeText(this, "Đang cập nhật dữ liệu mới từ OMS...", Toast.LENGTH_SHORT).show()
            loadWmsOrders()
        }

        btnLogout.setOnClickListener {
            val intent = Intent(this, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            Toast.makeText(this, "Đã đăng xuất tài khoản!", Toast.LENGTH_SHORT).show()
            finish()
        }

        listViewOrders.setOnItemClickListener { _, _, position, _ ->
            if (position < 0 || position >= listOrdersFromServer.size) {
                return@setOnItemClickListener
            }

            val orderClicked = listOrdersFromServer[position]
            selectedOrderId = orderClicked.id

            val formattedPackageId = formatPackageId(orderClicked.id)
            val locationInfo = orderClicked.warehouseLocation.orEmpty().ifBlank { "Chưa xếp kệ" }
            val conditionInfo = orderClicked.cargoCondition.orEmpty().ifBlank { "Bình thường" }

            txtSelectedOrder.text =
                "Đang xử lý: Kiện $formattedPackageId\n📍 Vị trí: $locationInfo\n⚠️ Tình trạng: $conditionInfo"

            Toast.makeText(this, "Đã chọn kiện hàng $formattedPackageId", Toast.LENGTH_SHORT).show()
        }

        btnScan.setOnClickListener {
            if (selectedOrderId == -1) {
                Toast.makeText(this, "Vui lòng chọn 1 đơn hàng trong danh sách trước!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            showInputDialog()
        }
    }

    private fun showInputDialog() {
        val builder = AlertDialog.Builder(this)
        val formattedPackageId = formatPackageId(selectedOrderId)

        builder.setTitle("Xác nhận mã kiện hàng")
        builder.setMessage("Nhập mã vạch trên kiện hàng. Ví dụ: $formattedPackageId hoặc $selectedOrderId")

        val input = EditText(this)
        input.hint = "Nhập mã kiện hàng tại đây..."
        builder.setView(input)

        builder.setPositiveButton("XÁC NHẬN") { dialog, _ ->
            val userInput = input.text.toString().trim().toUpperCase(Locale.ROOT)
            val isMatch = userInput == formattedPackageId || userInput == selectedOrderId.toString()

            if (isMatch) {
                syncScanWithWeb(selectedOrderId)
                dialog.dismiss()
            } else {
                Toast.makeText(
                    this,
                    "Sai mã! Bạn nhập '$userInput', mã cần nhập là '$formattedPackageId' hoặc '$selectedOrderId'",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        builder.setNegativeButton("HỦY") { dialog, _ ->
            dialog.cancel()
        }

        builder.show()
    }

    private fun loadWmsOrders() {
        apiService.getWmsOrders().enqueue(object : Callback<List<WmsOrder>> {
            override fun onResponse(
                call: Call<List<WmsOrder>>,
                response: Response<List<WmsOrder>>
            ) {
                if (!response.isSuccessful) {
                    Toast.makeText(
                        this@WarehouseActivity,
                        "Server trả lỗi: ${response.code()}",
                        Toast.LENGTH_SHORT
                    ).show()
                    return
                }

                val body = response.body().orEmpty()

                // Chỉ hiển thị đơn OMS đã chuyển sang WMS nhưng mobile/PDA chưa quét xác nhận.
                listOrdersFromServer = body.filter { !it.isScanned }

                listViewOrders.adapter = WmsOrderAdapter(this@WarehouseActivity, listOrdersFromServer)

                if (listOrdersFromServer.isEmpty()) {
                    resetSelection("Hiện tại không có kiện hàng nào chờ WMS quét xác nhận.")
                } else {
                    resetSelection("Chưa chọn đơn hàng nào - Vui lòng bấm chọn bên dưới!")
                }
            }

            override fun onFailure(call: Call<List<WmsOrder>>, t: Throwable) {
                Toast.makeText(
                    this@WarehouseActivity,
                    "Không thể tải dữ liệu từ máy chủ: ${t.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    private fun syncScanWithWeb(orderId: Int) {
        apiService.scanWmsBarcode(orderId).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(
                call: Call<ScanResponse>,
                response: Response<ScanResponse>
            ) {
                if (response.isSuccessful) {
                    val serverMessage = response.body()?.message.orEmpty()
                        .ifBlank { "Đã xác nhận mã kiện nhập kho" }

                    Toast.makeText(
                        this@WarehouseActivity,
                        "Thành công: $serverMessage",
                        Toast.LENGTH_LONG
                    ).show()

                    resetSelection("Chưa chọn đơn hàng nào - Vui lòng bấm chọn bên dưới!")
                    loadWmsOrders()
                } else {
                    Toast.makeText(
                        this@WarehouseActivity,
                        "Lỗi đồng bộ phía máy chủ: ${response.code()}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                Toast.makeText(
                    this@WarehouseActivity,
                    "Lỗi kết nối mạng: ${t.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    private fun resetSelection(message: String) {
        selectedOrderId = -1
        txtSelectedOrder.text = message
    }

    // ĐÃ SỬA CHUẨN: Đồng bộ thuật toán hiển thị mã kiện dạng 5 chữ số với Web (60000 + id)
    private fun formatPackageId(id: Int): String {
        return "PKG-${60000 + id}"
    }
}

class WmsOrderAdapter(
    private val context: Context,
    private val orders: List<WmsOrder>
) : BaseAdapter() {

    private val inflater: LayoutInflater = LayoutInflater.from(context)
    private val imageExecutor = Executors.newFixedThreadPool(3)
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getCount(): Int {
        return orders.size
    }

    override fun getItem(position: Int): WmsOrder {
        return orders[position]
    }

    override fun getItemId(position: Int): Long {
        return orders[position].id.toLong()
    }

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val view = convertView ?: inflater.inflate(R.layout.item_wms_order, parent, false)

        val imgCargo = view.findViewById<ImageView>(R.id.imgCargo)
        val txtCode = view.findViewById<TextView>(R.id.txtOrderCode)
        val txtInfo = view.findViewById<TextView>(R.id.txtOrderInfo)
        val txtLocation = view.findViewById<TextView>(R.id.txtOrderLocation)

        val order = getItem(position)

        // ĐÃ SỬA CHUẨN: Cập nhật đồng bộ hiển thị mã kiện trong danh sách
        val formattedPackageId = "PKG-${60000 + order.id}"
        val customer = order.customer_name.orEmpty().ifBlank { "Không rõ khách hàng" }
        val product = order.product_name.orEmpty().ifBlank { "Không rõ mặt hàng" }
        val location = order.warehouseLocation.orEmpty().ifBlank { "Chưa xếp kệ" }
        val condition = order.cargoCondition.orEmpty().ifBlank { "Bình thường" }

        txtCode.text = "Mã kiện: $formattedPackageId"
        txtInfo.text = "KH: $customer | Sản phẩm: $product | SL: ${order.quantity}"
        txtLocation.text = "📍 $location | ⚠️ $condition"

        imgCargo.setImageResource(android.R.drawable.ic_menu_gallery)

        val imageUrl = buildImageUrl(order.cargoImage, order.productImage)
        imgCargo.tag = imageUrl

        if (imageUrl != null) {
            loadImage(imgCargo, imageUrl)
        }

        return view
    }

    private fun buildImageUrl(cargoImage: String?, productImage: String?): String? {
        val path = cargoImage.orEmpty().ifBlank { productImage.orEmpty() }.trim()

        if (path.isBlank()) {
            return null
        }

        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path
        }

        return ApiConfig.BASE_URL.trimEnd('/') + "/" + path.trimStart('/')
    }

    private fun loadImage(imageView: ImageView, imageUrl: String) {
        imageExecutor.execute {
            try {
                val connection = URL(imageUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                connection.connect()

                val bitmap = connection.inputStream.use { input ->
                    BitmapFactory.decodeStream(input)
                }

                connection.disconnect()

                mainHandler.post {
                    if (imageView.tag == imageUrl && bitmap != null) {
                        imageView.setImageBitmap(bitmap)
                    }
                }
            } catch (_: Exception) {
                mainHandler.post {
                    if (imageView.tag == imageUrl) {
                        imageView.setImageResource(android.R.drawable.ic_menu_report_image)
                    }
                }
            }
        }
    }
}