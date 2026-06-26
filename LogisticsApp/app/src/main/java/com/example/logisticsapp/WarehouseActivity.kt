package com.example.logisticsapp

import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
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
        listViewOrders = findViewById(R.id.listViewOrders)
        txtSelectedOrder = findViewById(R.id.txtSelectedOrder)

        // Khởi tạo kết nối API Node.js
        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:3000/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        apiService = retrofit.create(ApiService::class.java)

        // 1. Tự động tải danh sách đơn hàng từ Web về
        loadWmsOrders()

        // 2. Sự kiện khi Thủ kho bấm chọn trực tiếp vào một dòng đơn hàng trên màn hình
        listViewOrders.setOnItemClickListener { _, _, position, _ ->
            if (listOrdersFromServer.isNotEmpty()) {
                val orderClicked = listOrdersFromServer[position]
                selectedOrderId = orderClicked.id

                // Cập nhật chữ hiển thị cho thủ kho biết đang chọn xử lý đơn hàng nào
                txtSelectedOrder.text = "Đang xử lý: Đơn hàng #${orderClicked.id} - KH: ${orderClicked.customer_name}"
                Toast.makeText(this, "Đã chọn Đơn hàng #${orderClicked.id}", Toast.LENGTH_SHORT).show()
            }
        }

        // Khởi tạo bộ quét mã ML Kit của Google
        val scanner = GmsBarcodeScanning.getClient(this)

        // 3. Sự kiện bấm nút BẮT ĐẦU QUÉT MÃ ở dưới cùng
        btnScan.setOnClickListener {
            // Kiểm tra xem thủ kho đã bấm chọn đơn hàng nào ở danh sách phía trên chưa
            if (selectedOrderId == -1) {
                Toast.makeText(this, "Vui lòng bấm chọn 1 đơn hàng trong danh sách trước!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            // Nếu đã chọn rồi thì bật camera lên quét mã vạch
            scanner.startScan()
                .addOnSuccessListener { barcode ->
                    val rawValue = barcode.rawValue
                    if (!rawValue.isNullOrEmpty()) {
                        // ĐÃ SỬA ĐỂ TEST TRÊN MÁY ẢO:
                        // Cứ quét trúng bất kỳ hình ảnh mã vạch nào của Google trong phòng 3D,
                        // Hệ thống sẽ lấy luôn ID đơn hàng bạn chọn ở danh sách để gửi đồng bộ lên Web!
                        Toast.makeText(this, "Nhận diện mã vạch máy ảo! Tiến hành đồng bộ đơn hàng #$selectedOrderId", Toast.LENGTH_SHORT).show()
                        syncScanWithWeb(selectedOrderId)
                    }
                }
                .addOnFailureListener { e ->
                    Toast.makeText(this, "Lỗi quét camera: ${e.message}", Toast.LENGTH_SHORT).show()
                }
        }

        // 🛠️ TÍNH NĂNG PHỤ (MẸO TEST NHANH): Nhấn giữ nút quét 2 giây để tự động duyệt luôn không cần camera
        btnScan.setOnLongClickListener {
            if (selectedOrderId == -1) {
                Toast.makeText(this, "Vui lòng bấm chọn 1 đơn hàng trước!", Toast.LENGTH_SHORT).show()
                return@setOnLongClickListener true
            }
            Toast.makeText(this, "Chế độ giả lập: Tự động gửi lệnh quét đơn #$selectedOrderId lên Web...", Toast.LENGTH_SHORT).show()
            syncScanWithWeb(selectedOrderId)
            true
        }
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
                            // Tạo mảng chuỗi định dạng đẹp để đưa vào ListView hiển thị
                            val listDisplayStrings = listOrdersFromServer.map { order ->
                                "Mã Kiện: #${order.id}\nKH: ${order.customer_name} | Sản phẩm: ${order.product_name} (SL: ${order.quantity})"
                            }

                            // Đổ dữ liệu chuỗi vào ListView thông qua ArrayAdapter mặc định của Android
                            val adapter = ArrayAdapter(
                                this@WarehouseActivity,
                                android.R.layout.simple_list_item_1,
                                listDisplayStrings
                            )
                            listViewOrders.adapter = adapter
                        } else {
                            // Không có đơn hàng nào
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

    // Hàm gửi kết quả đồng bộ lên Web khi quét chuẩn xác mã thùng hàng
    private fun syncScanWithWeb(orderId: Int) {
        apiService.scanWmsBarcode(orderId).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(call: Call<ScanResponse>, response: Response<ScanResponse>) {
                if (response.isSuccessful) {
                    val serverMessage = response.body()?.message ?: "Thành công"
                    Toast.makeText(this@WarehouseActivity, "🎉 Thành công: $serverMessage", Toast.LENGTH_LONG).show()

                    // Xóa trạng thái đang chọn sau khi hoàn thành
                    resetSelection()
                    // Tải lại danh sách mới (đơn hàng vừa quét sẽ biến mất khỏi danh sách)
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

    // Đưa trạng thái chọn về ban đầu
    private fun resetSelection() {
        selectedOrderId = -1
        txtSelectedOrder.text = "Chưa chọn đơn hàng nào - Vui lòng bấm chọn bên dưới!"
    }
}