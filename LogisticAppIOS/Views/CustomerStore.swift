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

    // ĐỢT 2: thông báo + chat chưa đọc
    @Published var notifications: [AppNotification] = []
    @Published var unreadNotifications = 0
    @Published var unreadChat = 0
    private var lastNotifiedId: Int?   // nil = lần tải đầu tiên: không bắn banner cho thông báo cũ

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
        orders.filter { $0.payment_status != "PAID" && $0.status != "RETURNED" && $0.status != "CANCELLED" && $0.status != "DONE" }
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

    // ĐỢT 2: tải thông báo + số tin chat chưa đọc; thông báo mới -> bắn banner cục bộ
    func fetchExtras(username: String) async {
        if let res = try? await ApiService.shared.getNotifications(username: username) {
            if let last = lastNotifiedId {
                let fresh = res.notifications.filter { $0.id > last && !$0.is_read }.sorted { $0.id < $1.id }
                for n in fresh { LocalNotifier.shared.notify(title: n.title, body: n.message) }
            }
            lastNotifiedId = max(res.notifications.map(\.id).max() ?? 0, lastNotifiedId ?? 0)
            notifications = res.notifications
            unreadNotifications = res.unread
            LocalNotifier.shared.setBadge(res.unread)
        }
        if let n = try? await ApiService.shared.getSupportUnread(username: username) {
            unreadChat = n
        }
    }

    func markNotificationRead(_ n: AppNotification, username: String) async {
        guard !n.is_read else { return }
        try? await ApiService.shared.markNotificationsRead(username: username, id: n.id)
        await fetchExtras(username: username)
    }

    func markAllNotificationsRead(username: String) async {
        try? await ApiService.shared.markNotificationsRead(username: username, id: nil)
        await fetchExtras(username: username)
    }

    func startPolling(username: String) {
        LocalNotifier.shared.setup()
        lastNotifiedId = nil
        Task {
            await fetchOrders(username: username)
            await fetchExtras(username: username)
        }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task {
                await self?.fetchOrders(username: username)
                await self?.fetchExtras(username: username)
            }
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
            "RETURNED": "⚠️ Returned",
            "CANCELLED": "✖ Cancelled"
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
        // PostgreSQL trả timestamp có phần mili-giây (…:00.000Z), cần withFractionalSeconds
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: s) ?? ISO8601DateFormatter().date(from: s) {
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
