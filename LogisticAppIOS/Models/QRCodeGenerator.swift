import UIKit
import CoreImage.CIFilterBuiltins

// MỚI: sinh mã QR NGAY TRÊN MÁY (không cần gọi API/internet), dùng CIFilter có sẵn
// của Apple. Nội dung QR là đúng "mã kiện hàng" (PKG-xxxxx) mà WarehouseView/
// OrderDetailView bên WMS đang dùng để đối chiếu khi quét/nhập tay xác nhận.
enum QRCodeGenerator {
    static func packageCode(forOrderId id: Int) -> String {
        "PKG-\(60000 + id)"
    }

    static func generate(from string: String, size: CGFloat = 220) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return nil }

        let scaleX = size / outputImage.extent.width
        let scaleY = size / outputImage.extent.height
        let transformed = outputImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

        guard let cgImage = context.createCGImage(transformed, from: transformed.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
