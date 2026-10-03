import SwiftUI

// MỚI: hiện mã QR của 1 đơn hàng - dùng chung cho 2 chỗ:
// 1. Popup hiện ngay sau khi khách tạo đơn thành công (CustomerCreateOrderView).
// 2. Nút "View QR" ở mỗi đơn trong tab Current Orders (CustomerOrdersListView).
// WMS sẽ quét đúng chuỗi text này (PKG-xxxxx) bằng camera để xác nhận nhận hàng,
// xem QRScannerView.swift + OrderDetailView.swift.
struct OrderQRCodeView: View {
    let orderId: Int
    var onDismiss: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    private var packageCode: String { QRCodeGenerator.packageCode(forOrderId: orderId) }

    var body: some View {
        VStack(spacing: 20) {
            Text("Order #\(orderId) created successfully!")
                .font(.headline)
                .multilineTextAlignment(.center)

            if let qrImage = QRCodeGenerator.generate(from: packageCode) {
                Image(uiImage: qrImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding()
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(radius: 2)
            }

            Text(packageCode)
                .font(.title2).bold()
                .monospaced()

            Text("Print or screenshot this QR code and attach it to your package. The warehouse (WMS) will scan it on arrival to confirm receipt.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Done") {
                onDismiss?()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
