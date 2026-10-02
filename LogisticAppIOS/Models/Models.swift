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