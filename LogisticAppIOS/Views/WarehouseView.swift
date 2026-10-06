import SwiftUI

// Tương đương WarehouseActivity.kt + activity_warehouse.xml + item_wms_order.xml
struct WarehouseView: View {
    @EnvironmentObject var session: SessionStore

    @State private var orders: [WmsOrder] = []
    @State private var errorMessage: String?

    var body: some View {
        List(orders) { order in
            NavigationLink(value: order) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Package Code: PKG-\(60000 + order.id)")
                        .font(.headline)
                    Text("Product: \(order.product_name ?? "") | Qty: \(order.quantity) packages")
                        .font(.subheadline)

                    let locStr = (order.warehouseLocation?.isEmpty ?? true) ? "Not shelved yet" : order.warehouseLocation!
                    let condStr = (order.cargoCondition?.isEmpty ?? true) ? "Normal" : order.cargoCondition!
                    let scanStr = order.isScanned ? "✅ Scanned" : "❌ Not scanned"

                    Text("📍 \(locStr) | ⚠️ \(condStr) | \(scanStr)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationDestination(for: WmsOrder.self) { order in
            OrderDetailView(order: order)
        }
        .navigationTitle("Warehouse (WMS)")
        .toolbar {
            // Tương đương btnTabLogs -> mở WmsLogsActivity
            ToolbarItem(placement: .navigationBarLeading) {
                NavigationLink("Logs") {
                    WmsLogsView()
                }
            }
            // ĐỢT 3: quét nhiều kiện liên tiếp
            ToolbarItem(placement: .navigationBarLeading) {
                NavigationLink("Batch") {
                    BatchScanView()
                }
            }
            // Tương đương btnReload
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Reload") { Task { await fetchOrders() } }
            }
            // Tương đương btnLogout
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Logout", role: .destructive) { session.logout() }
            }
        }
        // onAppear (không phải .task) để mô phỏng đúng onResume() của Android:
        // mỗi lần quay lại màn này (VD sau khi xem chi tiết 1 đơn) đều tải lại danh sách.
        .onAppear { Task { await fetchOrders() } }
        .refreshable { await fetchOrders() }
        .alert("Notification", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func fetchOrders() async {
        do {
            orders = try await ApiService.shared.getWmsOrders()
        } catch {
            errorMessage = "Server connection error: \(error.localizedDescription)"
        }
    }
}
