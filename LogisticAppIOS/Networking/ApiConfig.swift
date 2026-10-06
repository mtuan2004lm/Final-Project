import Foundation

// Tương đương ApiConfig trong ApiService.kt (Android).
//
// Lưu ý khác biệt quan trọng so với Android Emulator:
// - Android Emulator dùng alias đặc biệt "10.0.2.2" để trỏ về máy host chạy backend.
// - iOS Simulator thì KHÔNG cần alias nào cả, vì Simulator dùng chung network
//   namespace với máy Mac đang chạy nó -> chỉ cần dùng "localhost" (hoặc 127.0.0.1)
//   là gọi thẳng tới backend Node.js đang chạy trên máy.
// - "localhost" cũng được Apple tự động miễn trừ App Transport Security (ATS),
//   nên không cần thêm NSAppTransportSecurity exception trong Info.plist khi
//   chạy trên Simulator.
// - Nếu test trên điện thoại thật (không phải Simulator), phải đổi thành địa chỉ
//   IP LAN thật của máy đang chạy backend (ví dụ "http://192.168.1.5:3000/"),
//   và lúc đó CẦN thêm NSAppTransportSecurity exception cho domain đó (xem README).
struct ApiConfig {
    // Simulator dùng chung mạng với Mac -> localhost luôn đúng. Máy thật phải dùng IP LAN của Mac:
    // nếu IP đổi, chỉ cần sửa dòng deviceURL bên dưới (chạy `ipconfig getifaddr en0` trong Terminal để xem IP).
    static let deviceURL = "http://172.16.11.230:3000/"
    #if targetEnvironment(simulator)
    static let baseURL = "http://localhost:3000/"
    #else
    static let baseURL = deviceURL
    #endif
}
