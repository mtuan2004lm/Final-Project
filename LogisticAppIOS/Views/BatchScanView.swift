import SwiftUI
import VisionKit
import Vision

// ĐỢT 3: quét liên tục nhiều mã QR kiện hàng rồi gửi 1 lần lên /api/ext/wms/scan-batch.
// Camera không tự đóng sau mỗi mã; mã trùng được bỏ qua.
struct BatchScanView: View {
    @State private var codes: [String] = []
    @State private var release = false
    @State private var scanning = true
    @State private var sending = false
    @State private var resultText: String?
    @State private var results: [BatchScanItem] = []
    @State private var manual = ""

    var body: some View {
        VStack(spacing: 0) {
            if scanning && BatchScannerRepresentable.isSupported {
                BatchScannerRepresentable { value in add(value) }
                    .frame(height: 240)
            } else if !BatchScannerRepresentable.isSupported {
                Text("Camera scanning is not available on this device. Type codes below.")
                    .font(.footnote).foregroundStyle(.secondary).padding()
            }

            HStack {
                TextField("Type code (PKG-60023) and press return", text: $manual)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { add(manual); manual = "" }
                Button(scanning ? "Pause" : "Resume") { scanning.toggle() }
                    .buttonStyle(.bordered)
            }.padding(.horizontal).padding(.top, 8)

            Toggle("Release to TMS after scanning", isOn: $release).padding(.horizontal).padding(.vertical, 6)

            List {
                if !results.isEmpty {
                    Section(resultText ?? "Result") {
                        ForEach(results) { r in
                            HStack {
                                Text(r.code).font(.subheadline)
                                Spacer()
                                Text(label(r.status)).font(.caption).foregroundStyle(color(r.status))
                            }
                        }
                    }
                } else {
                    Section("Scanned (\(codes.count))") {
                        ForEach(codes, id: \.self) { c in Text(c) }
                            .onDelete { codes.remove(atOffsets: $0) }
                    }
                }
            }

            HStack {
                Button("Clear") { codes = []; results = []; resultText = nil }
                    .buttonStyle(.bordered).disabled(sending)
                Button {
                    Task { await send() }
                } label: {
                    Text(sending ? "Sending..." : "Submit \(codes.count) package(s)").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).disabled(codes.isEmpty || sending)
            }.padding()
        }
        .navigationTitle("Batch Scan")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func add(_ raw: String) {
        let v = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !v.isEmpty, !codes.contains(v) else { return }
        results = []; resultText = nil
        codes.append(v)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func send() async {
        sending = true; defer { sending = false }
        do {
            let r = try await ApiService.shared.scanBatch(codes: codes, release: release)
            results = r.results; resultText = r.message
            codes = []
        } catch {
            resultText = "Error: \(error.localizedDescription)"
            results = []
        }
    }

    private func label(_ s: String) -> String {
        switch s {
        case "scanned": return "✅ Scanned"
        case "already_scanned": return "ℹ️ Already scanned"
        case "scanned_released": return "✅ Scanned & released"
        case "already_scanned_released": return "ℹ️ Released (was scanned)"
        case "not_found": return "❌ Not found"
        case "not_in_warehouse": return "⚠️ Not in warehouse"
        case "invalid_code": return "❌ Invalid code"
        default: return s
        }
    }
    private func color(_ s: String) -> Color {
        if s.hasPrefix("scanned") { return .green }
        if s.hasPrefix("already") { return .secondary }
        return .red
    }
}

// Máy quét nhiều mã liên tục (không dismiss)
struct BatchScannerRepresentable: UIViewControllerRepresentable {
    var onCode: (String) -> Void

    static var isSupported: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        try? vc.startScanning()
        return vc
    }
    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}
    static func dismantleUIViewController(_ vc: DataScannerViewController, coordinator: Coordinator) { vc.stopScanning() }
    func makeCoordinator() -> Coordinator { Coordinator(onCode) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCode: (String) -> Void
        init(_ f: @escaping (String) -> Void) { onCode = f }
        func dataScanner(_ s: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            for item in items {
                if case .barcode(let b) = item, let v = b.payloadStringValue { onCode(v) }
            }
        }
    }
}
