import SwiftUI
import UIKit

// Tương đương việc tạo thẻ <a download> rồi .click() để tải file CSV trên web
// (xem exportOrdersReport() trong AdminView.vue). Trên iOS không có khái niệm
// "tải file về Downloads", nên dùng UIActivityViewController (share sheet chuẩn
// của Apple) - người dùng tự chọn Lưu vào Files, gửi qua AirDrop, Mail...
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
