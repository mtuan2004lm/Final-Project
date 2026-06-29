package com.example.logisticsapp

import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
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

class WarehouseActivity : AppCompatActivity() {

    private lateinit var listViewOrders: ListView
    private lateinit var txtSelectedOrder: TextView
    private lateinit var apiService: ApiService

    // Biến lưu trữ danh sách đơn hàng lấy từ server về
    private var listOrdersFromServer: List<WmsOrder> = ArrayList()
    // Biến lưu ID đơn hàng mà người dùng đang click chọn (mặc định = -1 là chưa chọn)
    private var selectedOrderId: Int = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_warehouse)

        val btnScan = findViewById<Button>(R.id.btnScan)
        val btnReload = findViewById<Button>(R.id.btnReload)
        val btnLogout = findViewById<Button>(R.id.btnLogout) // Ánh xạ nút Đăng xuất mới
        listViewOrders = findViewById(R.id.listViewOrders)
        txtSelectedOrder = findViewById(R.id.txtSelectedOrder)

        // Đổi chữ hiển thị trên nút bấm thành "NHẬP MÃ KIỆN HÀNG" cho đúng thực tế mới
        btnScan.text = "NHẬP MÃ KIỆN HÀNG"

        // Khởi tạo kết nối API Node.js
        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:3000/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        apiService = retrofit.create(ApiService::class.java)

        // 1. Tự động tải danh sách đơn hàng từ Web về khi vừa vào màn hình
        loadWmsOrders()

        // ✨ Sự kiện khi bấm nút TẢI LẠI dữ liệu mới từ OMS
        btnReload.setOnClickListener {
            Toast.makeText(this, "🔄 Đang cập nhật dữ liệu mới từ OMS...", Toast.LENGTH_SHORT).show()
            loadWmsOrders()
        }

        // ✨ Sự kiện khi bấm nút ĐĂNG XUẤT (Logout)
        btnLogout.setOnClickListener {
            // Quay trở về màn hình LoginActivity
            val intent = Intent(this, LoginActivity::class.java)
            // Xóa hết lịch sử các màn hình trước đó để không bấm Back quay lại được
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            Toast.makeText(this, "🚪 Đã đăng xuất tài khoản!", Toast.LENGTH_SHORT).show()
            finish()
        }

        // 2. Sự kiện khi Thủ kho bấm chọn trực tiếp vào một dòng đơn hàng trên màn hình
        listViewOrders.setOnItemClickListener { _, _, position, _ ->
            if (listOrdersFromServer.isNotEmpty()) {
                val orderClicked = listOrdersFromServer[position]
                selectedOrderId = orderClicked.id

                // CẬP NHẬT: Hiển thị định dạng dạng PKG-600xx cho thủ kho nhìn đồng bộ với danh sách
                val formattedPackageId = "PKG-600${orderClicked.id}"

                // Lấy thông tin vị trí lưu kho (nếu null hoặc trống thì hiện "Chưa xếp kệ")
                val locationInfo = if (!orderClicked.location.isNullOrBlank()) orderClicked.location else "Chưa xếp kệ"

                txtSelectedOrder.text = "Đang xử lý: Kiện $formattedPackageId\n📍 Vị trí: $locationInfo"
                Toast.makeText(this, "Đã chọn Kiện hàng $formattedPackageId", Toast.LENGTH_SHORT).show()
            }
        }

        // 3. Sự kiện bấm nút NHẬP MÃ KIỆN HÀNG ở dưới cùng
        btnScan.setOnClickListener {
            if (selectedOrderId == -1) {
                Toast.makeText(this, "Vui lòng bấm chọn 1 đơn hàng trong danh sách trước!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // Hiển thị hộp thoại (Popup) yêu cầu nhập mã kiểm tra
            showInputDialog()
        }
    }

    // Hàm hiển thị Popup nhập mã
    private fun showInputDialog() {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("Xác nhận mã kiện hàng")

        val formattedPackageId = "PKG-600$selectedOrderId"
        builder.setMessage("Nhập mã vạch in trên thùng (Ví dụ: $formattedPackageId hoặc $selectedOrderId)")

        // Tạo một ô nhập chữ (EditText) nằm trong Popup
        val input = EditText(this)
        input.hint = "Nhập mã kiện hàng tại đây..."
        builder.setView(input)

        // Nút bấm xác nhận trên Popup
        builder.setPositiveButton("XÁC NHẬN") { dialog, _ ->
            val userInput = input.text.toString().trim().uppercase()

            // Chấp nhận cả 2 trường hợp gõ đầy đủ "PKG-60016" hoặc gõ nhanh số ID "16"
            val isMatch = userInput == formattedPackageId || userInput == selectedOrderId.toString()

            if (isMatch) {
                // Khớp mã -> Gọi API đồng bộ thẳng lên Web
                syncScanWithWeb(selectedOrderId)
                dialog.dismiss()
            } else {
                // Nhập sai mã
                Toast.makeText(this, "Sai mã! Bạn gõ là: '$userInput' nhưng mã cần nhập là: '$formattedPackageId'", Toast.LENGTH_LONG).show()
            }
        }

        // Nút hủy bỏ Popup
        builder.setNegativeButton("HỦY") { dialog, _ ->
            dialog.cancel()
        }

        builder.show()
    }

    // Hàm gọi API lấy danh sách đơn hàng chờ xử lý kho
    private fun loadWmsOrders() {
        apiService.getWmsOrders().enqueue(object : Callback<List<WmsOrder>> {
            override fun onResponse(call: Call<List<WmsOrder>>, response: Response<List<WmsOrder>>) {
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null) {
                        // Lọc bỏ những đơn đã quét rồi, chỉ giữ lại đơn chưa quét (is_scanned = false)
                        listOrdersFromServer = body.filter { !it.is_scanned }

                        if (listOrdersFromServer.isNotEmpty()) {
                            val listDisplayStrings = listOrdersFromServer.map { order ->
                                val formattedPackageId = "PKG-600${order.id}"

                                // ✨ CẬP NHẬT: Lấy thông tin vị trí lưu kho từ thực tế Backend trả về
                                val locationInfo = if (!order.location.isNullOrBlank()) order.location else "Chưa xếp kệ"

                                // Đưa thông tin vị trí hiển thị trực quan ngay trên danh sách đơn hàng
                                "Mã Kiện: $formattedPackageId  |  📍 Vị trí: $locationInfo\nKH: ${order.customer_name} | Sản phẩm: ${order.product_name} (SL: ${order.quantity})"
                            }

                            val adapter = ArrayAdapter(
                                this@WarehouseActivity,
                                android.R.layout.simple_list_item_1,
                                listDisplayStrings
                            )
                            listViewOrders.adapter = adapter
                        } else {
                            val emptyAdapter = ArrayAdapter(this@WarehouseActivity, android.R.layout.simple_list_item_1, arrayOf("Hiện tại không có kiện hàng nào chờ xử lý xuất kho."))
                            listViewOrders.adapter = emptyAdapter
                            resetSelection()
                        }
                    }
                }
            }

            override fun onFailure(call: Call<List<WmsOrder>>, t: Throwable) {
                Toast.makeText(this@WarehouseActivity, "Không thể tải dữ liệu từ máy chủ!", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // Hàm gửi kết quả đồng bộ lên Web
    private fun syncScanWithWeb(orderId: Int) {
        apiService.scanWmsBarcode(orderId).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(call: Call<ScanResponse>, response: Response<ScanResponse>) {
                if (response.isSuccessful) {
                    val serverMessage = response.body()?.message ?: "Thành công"
                    Toast.makeText(this@WarehouseActivity, "🎉 Thành công: $serverMessage", Toast.LENGTH_LONG).show()

                    // Xóa trạng thái đang chọn và tải lại danh sách mới
                    resetSelection()
                    loadWmsOrders()
                } else {
                    Toast.makeText(this@WarehouseActivity, "Lỗi đồng bộ phía máy chủ!", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                Toast.makeText(this@WarehouseActivity, "Lỗi kết nối mạng, chưa thể cập nhật lên Web!", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun resetSelection() {
        selectedOrderId = -1
        txtSelectedOrder.text = "Chưa chọn đơn hàng nào - Vui lòng bấm chọn bên dưới!"
    }
}