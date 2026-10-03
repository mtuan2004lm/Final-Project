import SwiftUI
import VisionKit
import Vision // Cần import riêng để dùng được VNBarcodeSymbology.qr (VisionKit không tự export)

// MỚI: quét mã QR kiện hàng bằng camera cho WMS, dùng VisionKit's DataScannerViewController
// (framework quét mã của Apple, có sẵn từ iOS 16 - không cần thư viện ngoài). Chỉ
// chạy được trên THIẾT BỊ THẬT có camera, không chạy trên Simulator.
@available(iOS 16.0, *)
struct QRScannerView: UIViewControllerRepresentable {
    var onCodeScanned: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .accurate,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let parent: QRScannerView
        init(_ parent: QRScannerView) { self.parent = parent }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard let first = addedItems.first else { return }
            if case .barcode(let barcode) = first, let value = barcode.payloadStringValue {
                dataScanner.stopScanning()
                parent.onCodeScanned(value)
                parent.dismiss()
            }
        }
    }

    // Kiểm tra thiết bị có hỗ trợ quét không (Simulator hoặc máy quá cũ sẽ trả về false)
    static var isSupported: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }
} 
