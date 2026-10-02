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

    // --- TMS (giống TmsApiService.kt) ---

    func getDriverTrips(licensePlate: String) async throws -> [TripOrder] {
        let encoded = licensePlate.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? licensePlate
        return try await request("api/orders/tms/driver/\(encoded)")
    }

    func submitPod(orderId: Int, body: PodSubmitRequest) async throws {
        try await requestVoid("api/orders/tms/\(orderId)/pod-submit", method: "PUT", body: body)
    }

    func updateTruckGps(body: TruckGpsRequest) async throws {
        try await requestVoid("api/orders/tms/fleet/gps", method: "PUT", body: body)
    }
}

// Lưu ý: [String: String] đã tự conform Encodable sẵn trong Swift Standard
// Library (Dictionary: Encodable where Key: Encodable, Value: Encodable),
// nên không cần viết thêm extension nào cho updateWmsLocation(location:) ở trên.
