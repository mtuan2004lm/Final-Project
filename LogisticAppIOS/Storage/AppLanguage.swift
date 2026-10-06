import SwiftUI
import Combine

// ĐỢT 4: đa ngôn ngữ EN / VI.
// Các chuỗi Text("...") trong app được dịch tự động từ Localizable.xcstrings theo `locale` đặt ở gốc app.
// Đổi ngôn ngữ ở đây sẽ cập nhật ngay, không cần khởi động lại app.
final class AppLanguage: ObservableObject {
    @Published var code: String {
        didSet { UserDefaults.standard.set(code, forKey: "app_language") }
    }

    init() {
        code = UserDefaults.standard.string(forKey: "app_language") ?? "en"
    }

    var locale: Locale { Locale(identifier: code) }
}

// Nút chọn ngôn ngữ gọn (EN | VI) dùng ở màn đăng nhập và tab Account.
struct LanguagePicker: View {
    @EnvironmentObject var language: AppLanguage

    var body: some View {
        Picker("Language", selection: $language.code) {
            Text("English").tag("en")
            Text("Tiếng Việt").tag("vi")
        }
        .pickerStyle(.segmented)
    }
}

// Lấy thông điệp lỗi gọn từ phản hồi của server ({"error":"..."}); nếu không có thì dùng mô tả mặc định.
func friendlyError(_ error: Error) -> String {
    if case ApiError.server(_, let body) = error,
       let data = body.data(using: .utf8),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let msg = (obj["error"] as? String) ?? (obj["message"] as? String) {
        return msg
    }
    return error.localizedDescription
}
