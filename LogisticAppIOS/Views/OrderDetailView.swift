import SwiftUI
import PhotosUI

// Tương đương OrderDetailActivity.kt + activity_order_detail.xml
struct OrderDetailView: View {
    let order: WmsOrder

    @Environment(\.dismiss) private var dismiss
    @State private var barcodeInput = ""
    @State private var alertMessage: String?
    @State private var isSubmitting = false

    // MỚI: báo cáo hiện trạng hàng hóa lúc nhận hàng tại kho (chụp ảnh + ghi chú),
    // giống nút "Báo cáo tình trạng" bên web (wmsController.updateCargoCondition).
    @State private var conditionText = ""
    @State private var conditionImage: UIImage?
    @State private var photosPickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showImageSourceSheet = false
    @State private var showPhotoPickerTrigger = false
    @State private var isSubmittingCondition = false

    // MỚI: quét mã QR kiện hàng bằng camera thay vì phải gõ tay
    @State private var showQRScanner = false

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

                // MỚI: quét mã QR bằng camera - vẫn giữ ô nhập tay ở trên để phòng khi
                // camera lỗi hoặc tem QR bị rách/mờ, giống yêu cầu "bổ sung, không thay thế".
                Button {
                    if #available(iOS 16.0, *), QRScannerView.isSupported {
                        showQRScanner = true
                    } else {
                        alertMessage = "QR scanning is not supported on this device (e.g. Simulator). Please enter the code manually."
                    }
                } label: {
                    Label("Scan QR Code", systemImage: "qrcode.viewfinder")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

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

                Divider()

                // ====== MỚI: BÁO CÁO HIỆN TRẠNG HÀNG HÓA LÚC NHẬN HÀNG ======
                VStack(alignment: .leading, spacing: 10) {
                    Text("📸 Report Cargo Condition on Receipt").font(.headline)
                    Text("Take a photo of the goods right when they arrive at the warehouse, and note any damage if present.")
                        .font(.caption).foregroundStyle(.secondary)

                    TextEditor(text: $conditionText)
                        .frame(height: 90)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))

                    if let image = conditionImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    Button {
                        showImageSourceSheet = true
                    } label: {
                        Label(conditionImage == nil ? "Add Cargo Photo" : "Change Photo", systemImage: "camera")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        submitCargoCondition()
                    } label: {
                        if isSubmittingCondition {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("⚠️ Submit Condition Report").bold().frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(isSubmittingCondition)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
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
        .confirmationDialog("Add Cargo Photo", isPresented: $showImageSourceSheet, titleVisibility: .visible) {
            Button("Take Photo") {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    showCamera = true
                } else {
                    alertMessage = "This device/simulator has no camera available. Please use \"Choose from Library\" instead, or test on a real iPhone."
                }
            }
            Button("Choose from Library") { showPhotoPickerTrigger = true }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(isPresented: $showPhotoPickerTrigger, selection: $photosPickerItem, matching: .images)
        .onChange(of: photosPickerItem) { newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    conditionImage = uiImage
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                conditionImage = image
            }
            .ignoresSafeArea()
        }
        .fullScreenCover(isPresented: $showQRScanner) {
            if #available(iOS 16.0, *) {
                QRScannerView { scannedText in
                    barcodeInput = scannedText
                }
                .ignoresSafeArea()
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

    // Tương đương wmsController.updateCargoCondition: cho phép gửi chỉ ghi chú (không
    // bắt buộc phải có ảnh, giống backend chấp nhận damageImagePath rỗng).
    private func submitCargoCondition() {
        let text = conditionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || conditionImage != nil else {
            alertMessage = "Please enter a condition note or add a photo before submitting!"
            return
        }

        isSubmittingCondition = true
        Task {
            do {
                let imageData = conditionImage?.jpegData(compressionQuality: 0.8)
                let res = try await ApiService.shared.updateCargoCondition(
                    orderId: order.id,
                    condition: text,
                    imageData: imageData
                )
                isSubmittingCondition = false
                alertMessage = res.message ?? "⚠️ The damage report has been recorded!"
                conditionText = ""
                conditionImage = nil
            } catch {
                isSubmittingCondition = false
                alertMessage = "Unable to submit the condition report: \(error.localizedDescription)"
            }
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
