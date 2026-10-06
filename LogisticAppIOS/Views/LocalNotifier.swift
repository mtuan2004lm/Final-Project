import Foundation
import UserNotifications

// ĐỢT 2: thông báo cục bộ (banner trên điện thoại) khi app phát hiện thông báo mới từ server.
// Lưu ý: đây là thông báo cục bộ - chạy khi app đang mở hoặc vừa chuyển nền (app còn polling).
// Push thật khi app đã tắt hẳn cần APNs (tài khoản Apple Developer có phí) - để dành sau.
final class LocalNotifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = LocalNotifier()
    private var didSetup = false

    // Xin quyền 1 lần + cho phép hiện banner cả khi app đang mở
    func setup() {
        guard !didSetup else { return }
        didSetup = true
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    func setBadge(_ count: Int) {
        UNUserNotificationCenter.current().setBadgeCount(count) { _ in }
    }

    // Hiện banner ngay cả khi app đang ở foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }
}
