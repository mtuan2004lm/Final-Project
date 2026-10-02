import SwiftUI

// Tương đương OrderDetailActivity.kt + activity_order_detail.xml
struct OrderDetailView: View {
    let order: WmsOrder

    @Environment(\.dismiss) private var dismiss
    @State private var barcodeInput = ""
    @State private var alertMessage: String?
    @State private var isSubmitting = false

    private var expectedCode: String { "PKG-\(60000 + order.id)" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("PACKAGE DETAILS: \(expectedCode)")
                    .font(.title3).bold()

                Text("Order Owner: \(order.customer_name ?? "")\nProduct Name: \(order.product_name ?? "")\nQuantity: \(order.quantity) items")

                Text("📍 Storage Bin/Shelf Location: \((order.warehouseLocation?.isEmpty ?? true) ? "Not assigned yet" : order.warehouseLocation!)")
                Text("⚠️ Damage Condition Report: \((order.cargoCondition?.isEmpty ?? true) ? "Goods intact" : order.cargoCondition!)")

                if let productImage = order.productImage, !productImage.isEmpty {
                    remoteImage(path: productImage)
                }

                // Ưu tiên hiển thị damageImage (ảnh hư hại) nếu có, nếu không thì lấy cargoImage
                let imgToLoad: String? = (order.damageImage?.isEmpty == false) ? order.damageImage : order.cargoImage
                if let img = imgToLoad, !img.isEmpty {
                    remoteImage(path: img)
                }

                Divider()

                TextField("Enter/scan verification code", text: $barcodeInput)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()

                Button {
                    confirmScan()
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text("Confirm Scan").bold().frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting)
            }
            .padding()
        }
        .navigationTitle("Package Detail")
        .toolbar {
            // Tương đương btnBackTop / btnBack: dùng navigation back mặc định của iOS,
            // nhưng thêm nút rõ ràng cho giống giao diện gốc.
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Back") { dismiss() }
            }
        }
        .alert("Notification", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    // Tương đương loadImageFromUrl() trong OrderDetailActivity.kt, nhưng dùng
    // AsyncImage có sẵn của SwiftUI thay cho HttpURLConnection + Thread thủ công.
    @ViewBuilder
    private func remoteImage(path: String) -> some View {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let fullURL = ApiConfig.baseURL + trimmed

        AsyncImage(url: URL(string: fullURL)) { phase in
            if let image = phase.image {
                image.resizable().scaledToFit().frame(maxHeight: 220)
            } else if phase.error != nil {
                Color.gray.opacity(0.15).frame(height: 140)
                    .overlay(Text("Unable to load image").font(.caption).foregroundStyle(.secondary))
            } else {
                Color.gray.opacity(0.1).frame(height: 140)
                    .overlay(ProgressView())
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // Tương đương btnConfirmScan.setOnClickListener trong OrderDetailActivity.kt:
    // so khớp mã nhập với mã đơn kỳ vọng, nếu đúng thì gọi API scan-barcode.
    private func confirmScan() {
        let input = barcodeInput.trimmingCharacters(in: .whitespaces)
        guard !input.isEmpty else {
            alertMessage = "Please enter/scan the verification code!"
            return
        }
        guard input.caseInsensitiveCompare(expectedCode) == .orderedSame else {
            alertMessage = "Incorrect package code! Expected: \(expectedCode)"
            return
        }

        isSubmitting = true
        Task {
            do {
                _ = try await ApiService.shared.scanWmsBarcode(id: order.id)
                isSubmitting = false
                dismiss()
            } catch {
                isSubmitting = false
                alertMessage = "Warehouse system rejected: \(error.localizedDescription)"
            }
        }
    }
}
