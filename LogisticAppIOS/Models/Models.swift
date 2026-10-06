import Foundation

// =============================================================================
// Các model dữ liệu - tương đương data class trong ApiService.kt / Triporder.kt /
// Truckgpsrequest.kt / Podsubmitrequest.kt / LoginRequest.kt / LoginResponse.kt
// =============================================================================

// Khớp JSON trả về từ GET /api/orders/wms (xem wmsController ở backend)
struct WmsOrder: Codable, Identifiable, Hashable {
    var id: Int
    var customer_name: String?
    var product_name: String?
    var quantity: Int
    var status: String?
    var current_dept: String?
    var isScanned: Bool
    var warehouseLocation: String?
    var cargoImage: String?
    var productImage: String?
    var cargoCondition: String?
    var damageImage: String?

    enum CodingKeys: String, CodingKey {
        case id, customer_name, product_name, quantity, status, current_dept
        case isScanned = "is_scanned"
        case warehouseLocation = "warehouse_location"
        case cargoImage = "cargo_image"
        case productImage = "product_image"
        case cargoCondition = "cargo_condition"
        case damageImage = "damage_image"
    }

    // Decode thủ công với giá trị mặc định cho từng field, giống hệt default value
    // trong data class Kotlin (val id: Int = 0, val status: String? = ""...)
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        customer_name = try c.decodeIfPresent(String.self, forKey: .customer_name) ?? ""
        product_name = try c.decodeIfPresent(String.self, forKey: .product_name) ?? ""
        quantity = try c.decodeIfPresent(Int.self, forKey: .quantity) ?? 0
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? ""
        current_dept = try c.decodeIfPresent(String.self, forKey: .current_dept) ?? ""
        isScanned = try c.decodeIfPresent(Bool.self, forKey: .isScanned) ?? false
        warehouseLocation = try c.decodeIfPresent(String.self, forKey: .warehouseLocation) ?? ""
        cargoImage = try c.decodeIfPresent(String.self, forKey: .cargoImage) ?? ""
        productImage = try c.decodeIfPresent(String.self, forKey: .productImage) ?? ""
        cargoCondition = try c.decodeIfPresent(String.self, forKey: .cargoCondition) ?? ""
        damageImage = try c.decodeIfPresent(String.self, forKey: .damageImage) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(customer_name, forKey: .customer_name)
        try c.encode(product_name, forKey: .product_name)
        try c.encode(quantity, forKey: .quantity)
        try c.encode(status, forKey: .status)
        try c.encode(current_dept, forKey: .current_dept)
        try c.encode(isScanned, forKey: .isScanned)
        try c.encode(warehouseLocation, forKey: .warehouseLocation)
        try c.encode(cargoImage, forKey: .cargoImage)
        try c.encode(productImage, forKey: .productImage)
        try c.encode(cargoCondition, forKey: .cargoCondition)
        try c.encode(damageImage, forKey: .damageImage)
    }
}

struct ScanResponse: Decodable {
    let message: String?
    let order: WmsOrder?
}

// Model cho Nhật ký kho - khớp WarehouseLog trong ApiService.kt
struct WarehouseLog: Decodable, Identifiable {
    let id: Int
    let orderId: Int
    let notes: String?
    let oldStatus: String?
    let newStatus: String?
    let changedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, notes
        case orderId = "order_id"
        case oldStatus = "old_status"
        case newStatus = "new_status"
        case changedAt = "changed_at"
    }
}

// Khớp JSON trả về từ GET /api/orders/tms/driver/{license_plate}
// (xem tmsController.getDriverTrips ở backend) - giống TripOrder.kt
struct TripOrder: Decodable, Identifiable {
    let id: Int
    let customer_name: String
    let product_name: String
    let quantity: Int
    let status: String
    let delivery_route: String?
    let assigned_truck: String?
    let bot_fee: String?
    let fuel_fee: String?
    let driver_notes: String?
    let gps_coordinates: String?
    // ĐỢT 3: địa chỉ giao + thứ tự điểm dừng (có thể null với đơn cũ)
    let delivery_address: String?
    let receiver_name: String?
    let receiver_phone: String?
    let stop_sequence: Int?
}

// ĐỢT 3: quét QR hàng loạt
struct BatchScanRequest: Encodable {
    let codes: [String]
    let release: Bool
}
struct BatchScanItem: Decodable, Identifiable {
    let code: String
    let id_: Int?
    let status: String
    var id: String { code }
    enum CodingKeys: String, CodingKey { case code, status, id_ = "id" }
}
struct BatchScanResponse: Decodable {
    let message: String
    let results: [BatchScanItem]
}

// ĐỢT 3: tạo đơn hàng loạt từ CSV
struct BulkOrderRow: Encodable {
    let customer_name: String
    let product_name: String
    let quantity: Int
    let cargo_type: String
    let delivery_address: String
    let receiver_name: String
    let receiver_phone: String
}
struct BulkOrdersRequest: Encodable {
    let username: String
    let orders: [BulkOrderRow]
}
struct BulkOrdersResponse: Decodable {
    let message: String?
    let count: Int?
}

// Khớp body mà PUT /api/orders/tms/fleet/gps yêu cầu - giống TruckGpsRequest.kt
struct TruckGpsRequest: Encodable {
    let license_plate: String
    let lat: Double
    let lng: Double
}

// Khớp body mà PUT /api/orders/tms/:id/pod-submit yêu cầu - giống PodSubmitRequest.kt
struct PodSubmitRequest: Encodable {
    let bot_fee: String
    let fuel_fee: String
    let driver_notes: String
    let pod_image: String
    let gps_coordinates: String
}

// Giống LoginRequest.kt
struct LoginRequest: Encodable {
    let username: String
    let password: String
}

// =============================================================================
// CUSTOMER - tương đương CustomerView.vue + customerController.js bên web.
// Khách hàng KHÔNG đăng nhập qua /api/auth/mobile-login (route đó chỉ cho phép
// role wms/tms/admin) mà dùng đúng 2 route gốc của web: POST /api/auth/register
// và POST /api/auth/login (xem authController.js: register() và login()).
// =============================================================================

// Body gửi lên POST /api/auth/register
struct RegisterRequest: Encodable {
    let username: String
    let password: String
    let fullName: String
}

// Response của cả register() và login() trong authController.js đều có dạng
// { message, token?, user: { username, role } } - khác hẳn LoginResponse của
// mobileLogin (success/message/token/role phẳng), nên tách struct riêng.
struct WebAuthUser: Decodable {
    let username: String?
    let role: String?
}

struct WebAuthResponse: Decodable {
    let message: String
    let token: String?
    let user: WebAuthUser?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        message = try c.decodeIfPresent(String.self, forKey: .message) ?? ""
        token = try c.decodeIfPresent(String.self, forKey: .token)
        user = try c.decodeIfPresent(WebAuthUser.self, forKey: .user)
    }

    enum CodingKeys: String, CodingKey { case message, token, user }
}

// 1 đơn hàng của khách hàng - khớp customerController.getCustomerOrders().
// Có kèm vị trí GPS xe (truck_lat/truck_lng) giống bản web đã thêm trước đó.
struct CustomerOrder: Decodable, Identifiable {
    var id: Int
    var username: String?
    var customer_name: String?
    var product_name: String?
    var quantity: Int
    var status: String?
    var current_dept: String?
    var notes: String?
    var driver_notes: String?
    var cargo_type: String?
    var total_price: Double?
    var payment_status: String?
    var product_image: String?
    var assigned_truck: String?
    var delivery_route: String?
    var rating: Int?
    var feedback: String?
    var truck_lat: Double?
    var truck_lng: Double?
    var truck_gps_updated_at: String?
    // ĐỢT 1
    var delivery_address: String?
    var receiver_name: String?
    var receiver_phone: String?
    var pickup_date: String?
    var pickup_note: String?
    var cancel_reason: String?
    var return_status: String?
    var return_reason: String?
    var return_reject_note: String?
    var refund_status: String?
    var refund_amount: Double?
    var pod_image: String?
    var pod_signature: String?
    var pod_received_by: String?
    var pod_at: String?
    // ĐỢT 4: bảo hiểm
    var insured: Bool?
    var insured_value: Double?
    var insurance_fee: Double?

    enum CodingKeys: String, CodingKey {
        case id, username, customer_name, product_name, quantity, status, current_dept, notes,
             driver_notes, cargo_type, total_price, payment_status, product_image, assigned_truck,
             delivery_route, rating, feedback, truck_lat, truck_lng, truck_gps_updated_at
        case delivery_address, receiver_name, receiver_phone, pickup_date, pickup_note, cancel_reason,
             return_status, return_reason, return_reject_note, refund_status, refund_amount,
             pod_image, pod_signature, pod_received_by, pod_at
        case insured, insured_value, insurance_fee
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        username = try c.decodeIfPresent(String.self, forKey: .username)
        customer_name = try c.decodeIfPresent(String.self, forKey: .customer_name)
        product_name = try c.decodeIfPresent(String.self, forKey: .product_name)
        quantity = try c.decodeIfPresent(Int.self, forKey: .quantity) ?? 0
        status = try c.decodeIfPresent(String.self, forKey: .status)
        current_dept = try c.decodeIfPresent(String.self, forKey: .current_dept)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        driver_notes = try c.decodeIfPresent(String.self, forKey: .driver_notes)
        cargo_type = try c.decodeIfPresent(String.self, forKey: .cargo_type)
        total_price = decodeFlexibleDouble(c, .total_price)
        payment_status = try c.decodeIfPresent(String.self, forKey: .payment_status)
        product_image = try c.decodeIfPresent(String.self, forKey: .product_image)
        assigned_truck = try c.decodeIfPresent(String.self, forKey: .assigned_truck)
        delivery_route = try c.decodeIfPresent(String.self, forKey: .delivery_route)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating)
        feedback = try c.decodeIfPresent(String.self, forKey: .feedback)
        truck_lat = decodeFlexibleDouble(c, .truck_lat)
        truck_lng = decodeFlexibleDouble(c, .truck_lng)
        truck_gps_updated_at = try c.decodeIfPresent(String.self, forKey: .truck_gps_updated_at)
        delivery_address = try c.decodeIfPresent(String.self, forKey: .delivery_address)
        receiver_name = try c.decodeIfPresent(String.self, forKey: .receiver_name)
        receiver_phone = try c.decodeIfPresent(String.self, forKey: .receiver_phone)
        pickup_date = try c.decodeIfPresent(String.self, forKey: .pickup_date)
        pickup_note = try c.decodeIfPresent(String.self, forKey: .pickup_note)
        cancel_reason = try c.decodeIfPresent(String.self, forKey: .cancel_reason)
        return_status = try c.decodeIfPresent(String.self, forKey: .return_status)
        return_reason = try c.decodeIfPresent(String.self, forKey: .return_reason)
        return_reject_note = try c.decodeIfPresent(String.self, forKey: .return_reject_note)
        refund_status = try c.decodeIfPresent(String.self, forKey: .refund_status)
        refund_amount = decodeFlexibleDouble(c, .refund_amount)
        pod_image = try c.decodeIfPresent(String.self, forKey: .pod_image)
        pod_signature = try c.decodeIfPresent(String.self, forKey: .pod_signature)
        pod_received_by = try c.decodeIfPresent(String.self, forKey: .pod_received_by)
        pod_at = try c.decodeIfPresent(String.self, forKey: .pod_at)
        insured = try? c.decodeIfPresent(Bool.self, forKey: .insured)
        insured_value = decodeFlexibleDouble(c, .insured_value)
        insurance_fee = decodeFlexibleDouble(c, .insurance_fee)
    }
}

// ĐỢT 4: bảo hiểm + bồi thường
struct BuyInsuranceRequest: Encodable {
    let username: String
    let declared_value: Double
}
struct NewClaimRequest: Encodable {
    let username: String
    let order_id: Int
    let reason: String
    let description: String
    let claimed_amount: Double
}
struct ClaimItem: Decodable, Identifiable {
    let id: Int
    let order_id: Int
    let reason: String
    let description: String?
    let claimed_amount: Double
    let status: String
    let approved_amount: Double?
    let resolver_note: String?
}

// ĐỢT 4: quên mật khẩu bằng OTP
struct ForgotRequest: Encodable { let username: String }
struct ForgotResponse: Decodable { let message: String?; let dev_otp: String? }
struct VerifyOtpRequest: Encodable { let username: String; let otp: String }
struct VerifyOtpResponse: Decodable { let reset_token: String }
struct ResetPasswordRequest: Encodable { let username: String; let reset_token: String; let new_password: String }

// ĐỢT 4: audit log (Admin)
struct AuditEntry: Decodable, Identifiable {
    let id: Int
    let actor: String?
    let action: String
    let entity_id: String?
    let status_code: Int?
    let detail: String?
    let created_at: String?
}

// Body gửi lên POST /api/orders/:id/feedback
struct FeedbackRequest: Encodable {
    let rating: Int
    let feedback: String
}

// ĐỢT 1: địa chỉ giao hàng đã lưu - khớp bảng customer_addresses
struct CustomerAddress: Decodable, Identifiable {
    var id: Int
    var label: String
    var address: String
    var receiver_name: String?
    var receiver_phone: String?
    var is_default: Bool?
}

struct NewAddressRequest: Encodable {
    let username: String
    let label: String
    let address: String
    let receiver_name: String
    let receiver_phone: String
    let is_default: Bool
}

struct DeliveryInfoRequest: Encodable {
    let delivery_address: String
    let receiver_name: String
    let receiver_phone: String
    let pickup_date: String?   // ISO8601, nil nếu không đặt lịch
    let pickup_note: String
}

struct ReasonRequest: Encodable {
    let reason: String
}

// =============================================================================
// ĐỢT 2: thông báo, chat hỗ trợ, dashboard khách
// =============================================================================

struct AppNotification: Decodable, Identifiable, Equatable {
    var id: Int
    var order_id: Int?
    var title: String
    var message: String
    var is_read: Bool
    var created_at: String?
}

struct NotificationsResponse: Decodable {
    var unread: Int
    var notifications: [AppNotification]
}

struct SupportMessage: Decodable, Identifiable, Equatable {
    var id: Int
    var username: String?
    var order_id: Int?
    var sender: String          // "CUSTOMER" hoặc "OMS"
    var message: String
    var created_at: String?
}

struct SupportUnreadResponse: Decodable { var unread: Int }

struct SendSupportMessageRequest: Encodable {
    let username: String
    let sender: String
    let message: String
    let order_id: Int?
}

struct MarkNotificationsReadRequest: Encodable {
    let username: String
    let id: Int?
}

struct MarkSupportReadRequest: Encodable {
    let username: String
    let reader: String
}

struct MonthlySpend: Decodable, Identifiable {
    var month: String
    var orders: Int
    var spent: Double
    var id: String { month }
}

struct CargoSpend: Decodable, Identifiable {
    var cargo_type: String
    var orders: Int
    var spent: Double
    var id: String { cargo_type }
}

struct CustomerStats: Decodable {
    var total_orders: Int
    var delivered_orders: Int
    var cancelled_orders: Int
    var active_orders: Int
    var total_spent: Double
    var total_paid: Double
    var total_refunded: Double
    var success_rate: Int?
    var monthly: [MonthlySpend]
    var by_cargo: [CargoSpend]
}

// =============================================================================
// ADMIN - tương đương dữ liệu AdminView.vue dùng (adminController + accController
// + oms analytics + order_logs). Web không có app Android tương ứng, đây là phần
// mới hoàn toàn thêm riêng cho iOS.
// =============================================================================

// Helper: 1 số cột tiền (bot_fee, fuel_fee, total_cost...) ở PostgreSQL là kiểu
// NUMERIC, driver `pg` của Node đôi khi trả JSON dạng chuỗi, đôi khi dạng số thuần
// tùy cấu hình - hàm này thử cả 2 kiểu để không bao giờ bị lỗi decode.
fileprivate func decodeFlexibleStringIfPresent<Key: CodingKey>(_ c: KeyedDecodingContainer<Key>, forKey key: Key) -> String? {
    if let s = try? c.decode(String.self, forKey: key) { return s }
    if let d = try? c.decode(Double.self, forKey: key) { return String(d) }
    if let i = try? c.decode(Int.self, forKey: key) { return String(i) }
    return nil
}

fileprivate func decodeFlexibleDouble<Key: CodingKey>(_ c: KeyedDecodingContainer<Key>, _ key: Key) -> Double? {
    if let d = try? c.decode(Double.self, forKey: key) { return d }
    if let s = try? c.decode(String.self, forKey: key) { return Double(s) }
    return nil
}

// 1 đơn hàng trong GET /api/orders/admin/overview (adminController.getAllOrdersOverview)
struct AdminOrder: Decodable, Identifiable, Hashable {
    var id: Int
    var customer_name: String?
    var product_name: String?
    var quantity: Int
    var status: String?
    var current_dept: String?
    var created_at: String?
    var warehouse_location: String?
    var delivery_route: String?
    var assigned_truck: String?
    var bot_fee: String?
    var fuel_fee: String?
    var total_cost: String?
    var payment_status: String?

    enum CodingKeys: String, CodingKey {
        case id, customer_name, product_name, quantity, status, current_dept, created_at
        case warehouse_location, delivery_route, assigned_truck, bot_fee, fuel_fee, total_cost, payment_status
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        customer_name = try c.decodeIfPresent(String.self, forKey: .customer_name)
        product_name = try c.decodeIfPresent(String.self, forKey: .product_name)
        quantity = try c.decodeIfPresent(Int.self, forKey: .quantity) ?? 0
        status = try c.decodeIfPresent(String.self, forKey: .status)
        current_dept = try c.decodeIfPresent(String.self, forKey: .current_dept)
        created_at = try c.decodeIfPresent(String.self, forKey: .created_at)
        warehouse_location = try c.decodeIfPresent(String.self, forKey: .warehouse_location)
        delivery_route = try c.decodeIfPresent(String.self, forKey: .delivery_route)
        assigned_truck = try c.decodeIfPresent(String.self, forKey: .assigned_truck)
        bot_fee = decodeFlexibleStringIfPresent(c, forKey: .bot_fee)
        fuel_fee = decodeFlexibleStringIfPresent(c, forKey: .fuel_fee)
        total_cost = decodeFlexibleStringIfPresent(c, forKey: .total_cost)
        payment_status = try c.decodeIfPresent(String.self, forKey: .payment_status)
    }
}

// Toàn bộ response của GET /api/orders/admin/overview
struct AdminOverview: Decodable {
    var orders: [AdminOrder]
    var totalOrders: Int
    var deptCounts: [String: Int]
    var statusCounts: [String: Int]

    static let empty = AdminOverview(orders: [], totalOrders: 0, deptCounts: [:], statusCounts: [:])

    init(orders: [AdminOrder], totalOrders: Int, deptCounts: [String: Int], statusCounts: [String: Int]) {
        self.orders = orders
        self.totalOrders = totalOrders
        self.deptCounts = deptCounts
        self.statusCounts = statusCounts
    }

    enum CodingKeys: String, CodingKey { case orders, totalOrders, deptCounts, statusCounts }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        orders = try c.decodeIfPresent([AdminOrder].self, forKey: .orders) ?? []
        totalOrders = try c.decodeIfPresent(Int.self, forKey: .totalOrders) ?? 0
        deptCounts = try c.decodeIfPresent([String: Int].self, forKey: .deptCounts) ?? [:]
        statusCounts = try c.decodeIfPresent([String: Int].self, forKey: .statusCounts) ?? [:]
    }
}

// GET /api/orders/oms/analytics/revenue (dùng lại ở AdminView.vue tab Revenue)
struct RevenueSummary: Decodable {
    var today: Double
    var month: Double

    static let empty = RevenueSummary(today: 0, month: 0)

    init(today: Double, month: Double) {
        self.today = today
        self.month = month
    }

    enum CodingKeys: String, CodingKey { case today, month }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        today = decodeFlexibleDouble(c, .today) ?? 0
        month = decodeFlexibleDouble(c, .month) ?? 0
    }
}

// Phần "summary" bên trong GET /api/orders/acc/orders (accController.getAccOrders)
struct AccSummary: Decodable {
    var totalCustomerRevenue: Double
    var collectedCustomerRevenue: Double
    var totalEpodCost: Double
    var totalBotFee: Double
    var totalFuelFee: Double
    var netProfit: Double

    static let empty = AccSummary(
        totalCustomerRevenue: 0, collectedCustomerRevenue: 0,
        totalEpodCost: 0, totalBotFee: 0, totalFuelFee: 0, netProfit: 0
    )

    init(totalCustomerRevenue: Double, collectedCustomerRevenue: Double, totalEpodCost: Double,
         totalBotFee: Double, totalFuelFee: Double, netProfit: Double) {
        self.totalCustomerRevenue = totalCustomerRevenue
        self.collectedCustomerRevenue = collectedCustomerRevenue
        self.totalEpodCost = totalEpodCost
        self.totalBotFee = totalBotFee
        self.totalFuelFee = totalFuelFee
        self.netProfit = netProfit
    }

    enum CodingKeys: String, CodingKey {
        case totalCustomerRevenue, collectedCustomerRevenue, totalEpodCost, totalBotFee, totalFuelFee, netProfit
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalCustomerRevenue = decodeFlexibleDouble(c, .totalCustomerRevenue) ?? 0
        collectedCustomerRevenue = decodeFlexibleDouble(c, .collectedCustomerRevenue) ?? 0
        totalEpodCost = decodeFlexibleDouble(c, .totalEpodCost) ?? 0
        totalBotFee = decodeFlexibleDouble(c, .totalBotFee) ?? 0
        totalFuelFee = decodeFlexibleDouble(c, .totalFuelFee) ?? 0
        netProfit = decodeFlexibleDouble(c, .netProfit) ?? 0
    }
}

// Response đầy đủ của GET /api/orders/acc/orders - chỉ cần field "summary"
struct AccOrdersResponse: Decodable {
    var summary: AccSummary

    enum CodingKeys: String, CodingKey { case summary }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        summary = try c.decodeIfPresent(AccSummary.self, forKey: .summary) ?? AccSummary.empty
    }
}

// GET /api/orders/history/:id - nhật ký hành trình 1 đơn (order_logs)
struct OrderLogEntry: Decodable, Identifiable {
    var id: Int
    var old_status: String?
    var new_status: String?
    var notes: String?
    var changed_at: String?

    enum CodingKeys: String, CodingKey { case id, old_status, new_status, notes, changed_at }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        old_status = try c.decodeIfPresent(String.self, forKey: .old_status)
        new_status = try c.decodeIfPresent(String.self, forKey: .new_status)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        changed_at = try c.decodeIfPresent(String.self, forKey: .changed_at)
    }
}

// GET /api/orders/admin/reports - danh sách báo cáo Docs đã gửi lên Admin
struct AdminReport: Decodable, Identifiable {
    var id: Int
    var title: String?
    var created_by: String?
    var created_at: String?

    enum CodingKeys: String, CodingKey { case id, title, created_by, created_at }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        title = try c.decodeIfPresent(String.self, forKey: .title)
        created_by = try c.decodeIfPresent(String.self, forKey: .created_by)
        created_at = try c.decodeIfPresent(String.self, forKey: .created_at)
    }
}

// 1 dòng đơn hàng bên trong report chi tiết
struct AdminReportRow: Decodable, Identifiable {
    var id: Int
    var customer_name: String?
    var product_name: String?
    var quantity: Int
    var status: String?
    var current_dept: String?
    var total_cost: String?
    var bot_fee: String?
    var fuel_fee: String?
    // MỚI: các trường chi tiết hơn, giống bản web đã bổ sung (có thể rỗng nếu
    // Docs tạo báo cáo không snapshot đủ các trường này).
    var warehouse_location: String?
    var delivery_route: String?
    var assigned_truck: String?
    var created_at: String?

    enum CodingKeys: String, CodingKey {
        case id, customer_name, product_name, quantity, status, current_dept, total_cost, bot_fee, fuel_fee,
             warehouse_location, delivery_route, assigned_truck, created_at
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        customer_name = try c.decodeIfPresent(String.self, forKey: .customer_name)
        product_name = try c.decodeIfPresent(String.self, forKey: .product_name)
        quantity = try c.decodeIfPresent(Int.self, forKey: .quantity) ?? 0
        status = try c.decodeIfPresent(String.self, forKey: .status)
        current_dept = try c.decodeIfPresent(String.self, forKey: .current_dept)
        total_cost = decodeFlexibleStringIfPresent(c, forKey: .total_cost)
        bot_fee = decodeFlexibleStringIfPresent(c, forKey: .bot_fee)
        fuel_fee = decodeFlexibleStringIfPresent(c, forKey: .fuel_fee)
        warehouse_location = try c.decodeIfPresent(String.self, forKey: .warehouse_location)
        delivery_route = try c.decodeIfPresent(String.self, forKey: .delivery_route)
        assigned_truck = try c.decodeIfPresent(String.self, forKey: .assigned_truck)
        created_at = try c.decodeIfPresent(String.self, forKey: .created_at)
    }
}

// GET /api/orders/admin/reports/:id - chi tiết 1 báo cáo (readOnlyDeptController.submitOrderReportToAdmin tạo ra)
struct AdminReportDetail: Decodable {
    var id: Int
    var title: String?
    var created_by: String?
    var created_at: String?
    var data: [AdminReportRow]

    enum CodingKeys: String, CodingKey { case id, title, created_by, created_at, data }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id) ?? 0
        title = try c.decodeIfPresent(String.self, forKey: .title)
        created_by = try c.decodeIfPresent(String.self, forKey: .created_by)
        created_at = try c.decodeIfPresent(String.self, forKey: .created_at)
        data = try c.decodeIfPresent([AdminReportRow].self, forKey: .data) ?? []
    }
}

// Giống LoginResponse.kt - thêm role để phân biệt "wms" / "tms" từ PostgreSQL
struct LoginResponse: Decodable {
    let success: Bool
    let message: String
    let token: String?
    let role: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        success = try c.decodeIfPresent(Bool.self, forKey: .success) ?? false
        message = try c.decodeIfPresent(String.self, forKey: .message) ?? ""
        token = try c.decodeIfPresent(String.self, forKey: .token)
        role = try c.decodeIfPresent(String.self, forKey: .role)
    }

    enum CodingKeys: String, CodingKey {
        case success, message, token, role
    }
}
