import Foundation

// Lỗi mạng/dữ liệu, dùng chung cho mọi lời gọi API trong app.
enum ApiError: Error, LocalizedError {
    case invalidURL
    case server(Int, String)
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL."
        case .server(let code, let body):
            return "System response error (\(code)): \(body)"
        case .decoding(let e):
            return "Data decoding error: \(e.localizedDescription)"
        case .network(let e):
            return "Unable to connect to the server: \(e.localizedDescription)"
        }
    }
}

// Type-erasure nhỏ để request() chấp nhận bất kỳ Encodable nào làm body JSON
private struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ value: Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}

// =============================================================================
// ApiService - tương đương interface ApiService.kt + TmsApiService.kt (Android),
// nhưng dùng URLSession + async/await thuần của iOS thay cho Retrofit + Gson.
// Giữ nguyên 1:1 các endpoint (cùng path, cùng method HTTP) để backend không
// phải sửa gì cả - app iOS gọi đúng những API Node.js/Express đã có sẵn.
// =============================================================================
final class ApiService {
    static let shared = ApiService()
    private init() {}

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // --- Hạ tầng dùng chung ---

    private func buildRequest(path: String, method: String, body: Encodable?) throws -> URLRequest {
        guard let url = URL(string: ApiConfig.baseURL + path) else { throw ApiError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let body = body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return req
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", body: Encodable? = nil) async throws -> T {
        let req = try buildRequest(path: path, method: method, body: body)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ApiError.network(error)
        }
        guard let http = response as? HTTPURLResponse else { throw ApiError.network(URLError(.badServerResponse)) }
        guard (200...299).contains(http.statusCode) else {
            throw ApiError.server(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw ApiError.decoding(error)
        }
    }

    // Dùng cho các API chỉ cần biết thành công/thất bại, không cần đọc JSON trả về
    // (giống kiểu Call<Any> dùng để "bỏ qua" response body trong code Kotlin gốc).
    private func requestVoid(_ path: String, method: String, body: Encodable? = nil) async throws {
        let req = try buildRequest(path: path, method: method, body: body)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ApiError.network(error)
        }
        guard let http = response as? HTTPURLResponse else { throw ApiError.network(URLError(.badServerResponse)) }
        guard (200...299).contains(http.statusCode) else {
            throw ApiError.server(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
    }

    // --- Auth (giống LoginActivity.kt -> apiService.loginUser) ---

    func login(username: String, password: String) async throws -> LoginResponse {
        try await request("api/auth/mobile-login", method: "POST", body: LoginRequest(username: username, password: password))
    }

    // --- WMS (giống ApiService.kt) ---

    func getWmsOrders() async throws -> [WmsOrder] {
        try await request("api/orders/wms")
    }

    // GHI CHÚ: giống hệt bên Android, hàm này được khai báo đầy đủ nhưng KHÔNG
    // được bất kỳ màn hình nào trong app gọi tới (dead code) - giữ lại để đối
    // chiếu 1:1 với ApiService.kt (updateWmsLocation).
    func updateWmsLocation(id: Int, location: String) async throws -> ScanResponse {
        try await request("api/orders/wms/\(id)/location", method: "PUT", body: ["location": location])
    }

    func scanWmsBarcode(id: Int) async throws -> ScanResponse {
        try await request("api/orders/wms/\(id)/scan-barcode", method: "PUT")
    }

    func getWmsLogs() async throws -> [WarehouseLog] {
        try await request("api/orders/wms/logs")
    }

    // MỚI: báo cáo hiện trạng hàng hóa lúc nhận hàng tại kho (giống nút "Báo cáo tình
    // trạng" bên web gọi PUT /api/orders/wms/:id/condition, multer field "cargo_image").
    // Khớp đúng wmsController.updateCargoCondition: body.cargo_condition (text) +
    // file field "cargo_image" (ảnh, không bắt buộc - có thể chỉ ghi chú chữ).
    func updateCargoCondition(
        orderId: Int,
        condition: String,
        imageData: Data?,
        imageFileName: String = "cargo.jpg",
        imageMimeType: String = "image/jpeg"
    ) async throws -> ScanResponse {
        guard let url = URL(string: ApiConfig.baseURL + "api/orders/wms/\(orderId)/condition") else {
            throw ApiError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        appendField("cargo_condition", condition)

        if let imageData = imageData {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"cargo_image\"; filename=\"\(imageFileName)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: \(imageMimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ApiError.network(error)
        }
        guard let http = response as? HTTPURLResponse else { throw ApiError.network(URLError(.badServerResponse)) }
        guard (200...299).contains(http.statusCode) else {
            throw ApiError.server(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try decoder.decode(ScanResponse.self, from: data)
        } catch {
            throw ApiError.decoding(error)
        }
    }

    // --- TMS (giống TmsApiService.kt) ---

    func getDriverTrips(licensePlate: String) async throws -> [TripOrder] {
        let encoded = licensePlate.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? licensePlate
        // ĐỢT 3: endpoint mới trả thêm địa chỉ giao + thứ tự điểm dừng
        return try await request("api/ext/tms/driver-trips/\(encoded)")
    }

    // ĐỢT 4
    func buyInsurance(orderId: Int, username: String, declaredValue: Double) async throws {
        try await requestVoid("api/ext/orders/\(orderId)/insurance", method: "POST",
                              body: BuyInsuranceRequest(username: username, declared_value: declaredValue))
    }
    func getClaims(username: String) async throws -> [ClaimItem] {
        try await request("api/ext/claims?username=\(enc(username))")
    }
    func createClaim(_ body: NewClaimRequest) async throws {
        try await requestVoid("api/ext/claims", method: "POST", body: body)
    }
    func forgotPassword(username: String) async throws -> ForgotResponse {
        try await request("api/ext/auth/forgot", method: "POST", body: ForgotRequest(username: username))
    }
    func verifyOtp(username: String, otp: String) async throws -> VerifyOtpResponse {
        try await request("api/ext/auth/verify-otp", method: "POST", body: VerifyOtpRequest(username: username, otp: otp))
    }
    func resetPassword(username: String, token: String, newPassword: String) async throws {
        try await requestVoid("api/ext/auth/reset", method: "POST",
                              body: ResetPasswordRequest(username: username, reset_token: token, new_password: newPassword))
    }
    func getAuditLog(actor: String, query: String) async throws -> [AuditEntry] {
        try await request("api/ext/admin/audit?limit=200&actor=\(enc(actor))&q=\(enc(query))")
    }

    // ĐỢT 3
    func scanBatch(codes: [String], release: Bool) async throws -> BatchScanResponse {
        try await request("api/ext/wms/scan-batch", method: "POST", body: BatchScanRequest(codes: codes, release: release))
    }

    func createBulkOrders(username: String, rows: [BulkOrderRow]) async throws -> BulkOrdersResponse {
        try await request("api/ext/orders/bulk", method: "POST", body: BulkOrdersRequest(username: username, orders: rows))
    }

    func submitPod(orderId: Int, body: PodSubmitRequest) async throws {
        try await requestVoid("api/orders/tms/\(orderId)/pod-submit", method: "PUT", body: body)
    }

    func updateTruckGps(body: TruckGpsRequest) async throws {
        try await requestVoid("api/orders/tms/fleet/gps", method: "PUT", body: body)
    }

    // --- Admin (giống AdminView.vue) ---

    func getAdminOverview() async throws -> AdminOverview {
        try await request("api/orders/admin/overview")
    }

    func getRevenue() async throws -> RevenueSummary {
        try await request("api/orders/oms/analytics/revenue")
    }

    func getAccSummary() async throws -> AccSummary {
        let res: AccOrdersResponse = try await request("api/orders/acc/orders")
        return res.summary
    }

    func getOrderHistory(id: Int) async throws -> [OrderLogEntry] {
        try await request("api/orders/history/\(id)")
    }

    func getAdminReports() async throws -> [AdminReport] {
        try await request("api/orders/admin/reports")
    }

    func getAdminReportDetail(id: Int) async throws -> AdminReportDetail {
        try await request("api/orders/admin/reports/\(id)")
    }

    // --- Customer (giống CustomerView.vue + customerController.js) ---

    // ĐÃ SỬA: khách hàng dùng đúng route gốc /api/auth/register và /api/auth/login
    // của web (KHÔNG dùng /api/auth/mobile-login vì route đó chặn role customer).
    func customerRegister(username: String, password: String, fullName: String) async throws -> WebAuthResponse {
        try await request("api/auth/register", method: "POST",
                           body: RegisterRequest(username: username, password: password, fullName: fullName))
    }

    func customerLogin(username: String, password: String) async throws -> WebAuthResponse {
        try await request("api/auth/login", method: "POST",
                           body: LoginRequest(username: username, password: password))
    }

    func getCustomerOrders(username: String) async throws -> [CustomerOrder] {
        let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username
        return try await request("api/orders/customer?username=\(encoded)")
    }

    func confirmPaymentSubmitted(orderId: Int) async throws {
        try await requestVoid("api/orders/\(orderId)/pay", method: "PUT")
    }

    func submitFeedback(orderId: Int, body: FeedbackRequest) async throws {
        try await requestVoid("api/orders/\(orderId)/feedback", method: "POST", body: body)
    }

    // --- ĐỢT 1: địa chỉ giao hàng, hủy đơn, trả hàng (router /api/ext ở backend) ---

    func getAddresses(username: String) async throws -> [CustomerAddress] {
        let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username
        return try await request("api/ext/addresses?username=\(encoded)")
    }

    func addAddress(_ body: NewAddressRequest) async throws {
        try await requestVoid("api/ext/addresses", method: "POST", body: body)
    }

    func deleteAddress(id: Int) async throws {
        try await requestVoid("api/ext/addresses/\(id)", method: "DELETE")
    }

    func setDeliveryInfo(orderId: Int, body: DeliveryInfoRequest) async throws {
        try await requestVoid("api/ext/orders/\(orderId)/delivery-info", method: "PUT", body: body)
    }

    func cancelOrder(orderId: Int, reason: String) async throws {
        try await requestVoid("api/ext/orders/\(orderId)/cancel", method: "PUT", body: ReasonRequest(reason: reason))
    }

    func requestReturn(orderId: Int, reason: String) async throws {
        try await requestVoid("api/ext/orders/\(orderId)/return-request", method: "POST", body: ReasonRequest(reason: reason))
    }

    // --- ĐỢT 2: thông báo, chat hỗ trợ, dashboard, chứng từ ---

    private func enc(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? s
    }

    func getNotifications(username: String) async throws -> NotificationsResponse {
        try await request("api/ext/notifications?username=\(enc(username))")
    }

    // id = nil -> đánh dấu đã đọc tất cả
    func markNotificationsRead(username: String, id: Int?) async throws {
        try await requestVoid("api/ext/notifications/read", method: "PUT",
                              body: MarkNotificationsReadRequest(username: username, id: id))
    }

    func getSupportMessages(username: String, after: Int) async throws -> [SupportMessage] {
        try await request("api/ext/support/messages?username=\(enc(username))&after=\(after)")
    }

    func sendSupportMessage(username: String, message: String, orderId: Int?) async throws {
        try await requestVoid("api/ext/support/messages", method: "POST",
                              body: SendSupportMessageRequest(username: username, sender: "CUSTOMER", message: message, order_id: orderId))
    }

    func markSupportRead(username: String) async throws {
        try await requestVoid("api/ext/support/read", method: "PUT",
                              body: MarkSupportReadRequest(username: username, reader: "CUSTOMER"))
    }

    func getSupportUnread(username: String) async throws -> Int {
        let res: SupportUnreadResponse = try await request("api/ext/support/unread?username=\(enc(username))")
        return res.unread
    }

    func getCustomerStats(username: String) async throws -> CustomerStats {
        try await request("api/ext/customer/stats?username=\(enc(username))")
    }

    // Link mở vận đơn / hóa đơn (trang HTML có nút Print / Save as PDF) - mở bằng Safari
    func documentURL(type: String, orderId: Int) -> URL? {
        URL(string: ApiConfig.baseURL + "api/ext/documents/\(type)/\(orderId)")
    }

    // Proof of Delivery (multipart: ảnh + chữ ký PNG base64 + tên người nhận) - dùng ở app tài xế
    func submitProofOfDelivery(orderId: Int, imageData: Data?, signatureDataURL: String?, receivedBy: String) async throws {
        guard let url = URL(string: ApiConfig.baseURL + "api/ext/orders/\(orderId)/pod") else { throw ApiError.invalidURL }
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        appendField("received_by", receivedBy)
        if let sig = signatureDataURL { appendField("signature", sig) }
        if let imageData = imageData {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"image\"; filename=\"pod.jpg\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: req) } catch { throw ApiError.network(error) }
        guard let http = response as? HTTPURLResponse else { throw ApiError.network(URLError(.badServerResponse)) }
        guard (200...299).contains(http.statusCode) else {
            throw ApiError.server(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
    }

    // ĐÃ SỬA: tạo đơn hàng mới của khách hàng CẦN multipart/form-data (có kèm file
    // ảnh hàng hóa), khác hẳn mọi API JSON thuần ở trên -> phải tự dựng request
    // thủ công thay vì dùng hàm request()/requestVoid() chung (chỉ hỗ trợ JSON).
    // MỚI: đổi kiểu trả về từ "không trả gì" (requestVoid) sang parse luôn JSON response
    // ({ message, order }) để lấy ĐÚNG id đơn vừa tạo từ server - cần id này để tạo
    // QR code mã kiện hàng (PKG-xxxxx) hiện ngay cho khách sau khi tạo đơn thành công.
    struct CreateOrderResponse: Decodable {
        let message: String?
        let order: CustomerOrder?
    }

    @discardableResult
    func createCustomerOrder(
        username: String,
        customerName: String,
        productName: String,
        cargoType: String,
        quantity: Int,
        totalPrice: Double,
        imageData: Data,
        imageFileName: String = "product.jpg",
        imageMimeType: String = "image/jpeg"
    ) async throws -> CreateOrderResponse {
        guard let url = URL(string: ApiConfig.baseURL + "api/orders") else { throw ApiError.invalidURL }

        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        appendField("username", username)
        appendField("customer_name", customerName)
        appendField("product_name", productName)
        appendField("cargo_type", cargoType)
        appendField("quantity", String(quantity))
        appendField("total_price", String(totalPrice))

        // Field file "product_image" - đúng tên multer đang nhận ở route POST /api/orders
        // (upload.single('product_image')), xem orderRoutes.js.
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"product_image\"; filename=\"\(imageFileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(imageMimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ApiError.network(error)
        }
        guard let http = response as? HTTPURLResponse else { throw ApiError.network(URLError(.badServerResponse)) }
        guard (200...299).contains(http.statusCode) else {
            throw ApiError.server(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try decoder.decode(CreateOrderResponse.self, from: data)
        } catch {
            throw ApiError.decoding(error)
        }
    }
}

// Lưu ý: [String: String] đã tự conform Encodable sẵn trong Swift Standard
// Library (Dictionary: Encodable where Key: Encodable, Value: Encodable),
// nên không cần viết thêm extension nào cho updateWmsLocation(location:) ở trên.
