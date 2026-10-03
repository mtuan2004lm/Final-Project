import SwiftUI
import UIKit

// MỚI: bọc UIImagePickerController (sourceType = .camera) thành SwiftUI View,
// vì SwiftUI chưa có API camera "thuần" trước iOS 17 - đây là cách chuẩn của
// Apple để chụp ảnh trực tiếp từ camera. Dùng cho "Actual Cargo Image" ở màn
// Create Order, tương đương <input type="file" accept="image/*"> bên web nhưng
// web không phân biệt được camera/thư viện còn app thì cho chọn rõ ràng.
struct CameraPicker: UIViewControllerRepresentable {
    var onImagePicked: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        // QUAN TRỌNG: Simulator KHÔNG có camera thật - nếu set sourceType = .camera
        // khi không có camera, UIImagePickerController sẽ làm app CRASH ngay lập tức.
        // Luôn kiểm tra isSourceTypeAvailable trước, fallback về thư viện ảnh nếu
        // không có camera (ví dụ đang chạy trên Simulator).
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImagePicked(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
