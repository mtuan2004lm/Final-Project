package com.example.logisticsapp

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class WarehouseActivity : AppCompatActivity() {

    private lateinit var listViewOrders: ListView
    private lateinit var btnReload: Button
    private lateinit var btnLogout: Button

    private lateinit var btnTabOverview: Button
    private lateinit var btnTabLogs: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_warehouse)

        listViewOrders = findViewById(R.id.listViewOrders)
        btnReload = findViewById(R.id.btnReload)
        btnLogout = findViewById(R.id.btnLogout)

        btnTabOverview = findViewById(R.id.btnTabOverview)
        btnTabLogs = findViewById(R.id.btnTabLogs)

        fetchOrders()

        btnReload.setOnClickListener { fetchOrders() }

        // ĐÃ SỬA: trước đây chỉ gọi finish() -> vì LoginActivity cũng đã tự finish()
        // sau khi mở màn này, nên không còn activity nào trong back stack để quay về,
        // dẫn đến thoát hẳn ra ngoài app thay vì quay lại màn Đăng nhập.
        // Giờ điều hướng thẳng về LoginActivity và xóa sạch back stack.
        btnLogout.setOnClickListener {
            val intent = Intent(this, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }

        // Mở màn hình Nhật ký kho khi bấm Tab Logs
        btnTabLogs.setOnClickListener {
            startActivity(Intent(this, WmsLogsActivity::class.java))
        }

        listViewOrders.setOnItemClickListener { _, _, position, _ ->
            val adapter = listViewOrders.adapter as WmsOrderAdapter
            val order = adapter.getItem(position)
            if (order != null) {
                val intent = Intent(this, OrderDetailActivity::class.java)
                intent.putExtra("CHOSEN_ORDER", order)
                startActivity(intent)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        fetchOrders()
    }

    private fun getApiService(): ApiService {
        val retrofit = Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        return retrofit.create(ApiService::class.java)
    }

    private fun fetchOrders() {
        getApiService().getWmsOrders().enqueue(object : Callback<List<WmsOrder>> {
            override fun onResponse(call: Call<List<WmsOrder>>, response: Response<List<WmsOrder>>) {
                if (response.isSuccessful && response.body() != null) {
                    val orders = response.body()!!
                    val adapter = WmsOrderAdapter(this@WarehouseActivity, orders)
                    listViewOrders.adapter = adapter
                } else {
                    Toast.makeText(this@WarehouseActivity, "Error fetching warehouse order list!", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<WmsOrder>>, t: Throwable) {
                Toast.makeText(this@WarehouseActivity, "Server connection error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    inner class WmsOrderAdapter(context: AppCompatActivity, private val orders: List<WmsOrder>) :
        ArrayAdapter<WmsOrder>(context, 0, orders) {

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(context).inflate(R.layout.item_wms_order, parent, false)
            val order = orders[position]

            val txtOrderCode = view.findViewById<TextView>(R.id.txtOrderCode)
            val txtOrderInfo = view.findViewById<TextView>(R.id.txtOrderInfo)
            val txtOrderLocation = view.findViewById<TextView>(R.id.txtOrderLocation)

            txtOrderCode.text = "Package Code: PKG-${60000 + order.id}"
            txtOrderInfo.text = "Product: ${order.product_name} | Qty: ${order.quantity} packages"

            val locStr = if (order.warehouseLocation.isNullOrEmpty()) "Not shelved yet" else order.warehouseLocation
            val condStr = if (order.cargoCondition.isNullOrEmpty()) "Normal" else order.cargoCondition
            val scanStr = if (order.isScanned) "✅ Scanned" else "❌ Not scanned"

            txtOrderLocation.text = "📍 $locStr | ⚠️ $condStr | $scanStr"

            return view
        }
    }
}