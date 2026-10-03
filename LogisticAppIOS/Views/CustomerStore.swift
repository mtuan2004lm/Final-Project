import Foundation
import Combine

// Tương đương toàn bộ phần <script setup> của CustomerView.vue (orders, priceRates,
// getOrderPrice, các computed activeOrders/completedOrders/unpaidOrders, fetchOrders
// định kỳ 5s...) - gom vào 1 ObservableObject dùng chung cho mọi tab của khách hàng,
// thay vì lặp lại logic ở từng View con.
@MainActor
final class CustomerStore: ObservableObject {
    @Published var orders: [CustomerOrder] = []
    @Published var errorMessage: String?
    @Published var returnedOrderNotice: CustomerOrder?

    private var timer: Timer?

    // Giống hệt bảng giá priceRates trong CustomerView.vue
    let priceRates: [String: Double] = [
        "Hàng hóa thông thường": 100,
        "Hàng hóa điện tử": 250,
        "Hàng hóa nguy hiểm": 180,
        "Hàng hóa nhanh": 400
    ]

    let cargoTypes = [
        ("Hàng hóa thông thường", "📦 Regular Goods", 100.0),
        ("Hàng hóa điện tử", "⚡ Electronics", 250.0),
        ("Hàng hóa nguy hiểm", "☣️ Hazardous Goods", 180.0),
        ("Hàng hóa nhanh", "🚀 Express Goods", 400.0)
    ]

    // Giống getOrderPrice(order) bên web: đơn cũ có total_price hợp lệ thì dùng,
    // không thì tính lại theo đơn giá x số lượng.
    func getOrderPrice(_ order: CustomerOrder) -> Double {
        if let tp = order.total_price, tp > 0, tp < 100000 { return tp }
        let rate = priceRates[order.cargo_type ?? ""] ?? 100
        return rate * Double(order.quantity)
    }

    // Giống activeOrders computed
    var activeOrders: [CustomerOrder] {
        orders.filter { $0.status != "DONE" && $0.status != "DELIVERED" }
    }

    // Giống completedOrders computed
    var completedOrders: [CustomerOrder] {
        orders.filter { $0.status == "DONE" || $0.status == "DELIVERED" }
    }

    // Giống unpaidOrders computed
    var unpaidOrders: [CustomerOrder] {
        orders.filter { $0.payment_status != "PAID" && $0.status != "RETURNED" && $0.status != "DONE" }
    }

    func fetchOrders(username: String) async {
        do {
            let result = try await ApiService.shared.getCustomerOrders(username: username)
            orders = result
            returnedOrderNotice = result.first(where: { $0.status == "RETURNED" })
        } catch {
            // Giống web: chỉ log, không chặn UI bằng alert (polling mỗi 5s, lỗi tạm thời không
            // nên làm phiền người dùng liên tục).
            print("🔴 Error fetching customer orders: \(error.localizedDescription)")
        }
    }

    func startPolling(username: String) {
        Task { await fetchOrders(username: username) }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { await self?.fetchOrders(username: username) }
        }
    }

    func stopPolling() {
        timer?.invalidate()
        timer = nil
    }

    // Giống translateStatus() bên web
    func translateStatus(_ status: String?) -> String {
        let dict: [String: String] = [
            "NEW": "⏳ Awaiting Approval",
            "APPROVED": "✅ Dispatched for Processing",
            "WMS": "🏬 At Warehouse",
            "PACKED": "📦 Packed",
            "TMS": "🚛 In Transit",
            "SHIPPING": "🚛 In Transit",
            "DELIVERED": "🏁 Delivered Successfully",
            "DONE": "🏁 Completed",
            "RETURNED": "⚠️ Returned"
        ]
        return dict[status ?? ""] ?? "⏳ Awaiting Approval"
    }

    func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    func formatDateTime(_ s: String?) -> String {
        guard let s = s else { return "—" }
        if let date = ISO8601DateFormatter().date(from: s) {
            let f = DateFormatter()
            f.dateStyle = .short
            f.timeStyle = .short
            return f.string(from: date)
        }
        return s
    }

    // Giống generateQRUrl() bên web (VietQR)
    func generateQRUrl(_ order: CustomerOrder) -> URL? {
        let bankId = "MB"
        let accountNo = "0902510519"
        let template = "qr_only"
        let amountUsd = getOrderPrice(order)
        let amountVnd = Int(amountUsd * 25000)
        let description = "Payment for order \(order.id)"
        let encodedDesc = description.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? description
        return URL(string: "https://img.vietqr.io/image/\(bankId)-\(accountNo)-\(template).png?amount=\(amountVnd)&addInfo=\(encodedDesc)")
    }
}
