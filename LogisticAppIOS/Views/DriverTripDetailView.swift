import SwiftUI

// Tương đương DriverTripDetailActivity.kt + activity_driver_trip_detail.xml
//
// Màn hình chi tiết 1 chuyến hàng cho tài xế: nhập phí BOT/dầu + ghi chú, rồi nộp
// biên bản E-POD về backend (PUT /api/orders/tms/:id/pod-submit). Sau khi nộp
// thành công, đơn chuyển trạng thái DELIVERED và current_dept = ACC (đúng luồng
// nghiệp vụ: TMS bàn giao dữ liệu chi phí sang phòng Kế toán).
struct DriverTripDetailView: View {
    let orderId: Int
    let customer: String
    let product: String
    let route: String
    let truckPlate: String
    let gps: String

    @Environment(\.dismiss) private var dismiss
    @State private var botFee = ""
    @State private var fuelFee = ""
    @State private var notes = ""
    @State private var isSubmitting = false
    @State private var alertMessage: String?

    // ĐỢT 1: Proof of Delivery thật (ảnh + chữ ký + tên người nhận)
    @State private var podImage: UIImage?
    @State private var showCamera = false
    @State private var receivedBy = ""
    @State private var signatureLines: [[CGPoint]] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Package Code: PKG-\(60000 + orderId)").font(.headline)
                Text("Customer: \(customer)")
                Text("Cargo: \(product)")
                Text("🛣️ Route: \(route)")
                Text("🚛 Vehicle: \(truckPlate)")

                Text(gps.isEmpty
                     ? "No GPS signal yet (press 'Start Trip' on the previous screen to enable location tracking)"
                     : gps)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Divider()

                TextField("BOT fee", text: $botFee)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.decimalPad)
                TextField("Fuel fee", text: $fuelFee)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.decimalPad)
                TextField("Driver notes", text: $notes)
                    .textFieldStyle(.roundedBorder)

                Divider()
                Text("📸 Proof of Delivery").font(.headline)

                if let img = podImage {
                    Image(uiImage: img)
                        .resizable().scaledToFit()
                        .frame(maxHeight: 180)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                Button {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        showCamera = true
                    } else {
                        alertMessage = "No camera available on this device."
                    }
                } label: {
                    Label(podImage == nil ? "Take delivery photo" : "Retake photo", systemImage: "camera")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                TextField("Received by (name)", text: $receivedBy)
                    .textFieldStyle(.roundedBorder)

                SignaturePadView(lines: $signatureLines)
                Button("Clear signature") { signatureLines = [] }
                    .font(.caption)

                Button {
                    submit()
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text("Submit E-POD").bold().frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting)
            }
            .padding()
        }
        .navigationTitle("Trip Detail")
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in podImage = image }
                .ignoresSafeArea()
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

    // Tương đương btnSubmit.setOnClickListener trong DriverTripDetailActivity.kt
    private func submit() {
        let bot = botFee.trimmingCharacters(in: .whitespaces)
        let fuel = fuelFee.trimmingCharacters(in: .whitespaces)
        let gpsCoordinates = gps.isEmpty ? "Unknown" : gps

        isSubmitting = true
        let body = PodSubmitRequest(
            bot_fee: bot.isEmpty ? "0" : bot,
            fuel_fee: fuel.isEmpty ? "0" : fuel,
            driver_notes: notes.trimmingCharacters(in: .whitespaces),
            // Chưa tích hợp chụp ảnh thật (ngoài phạm vi hiện tại) -> dùng ảnh
            // placeholder giống hệt cách web/Android đang mô phỏng, giữ đồng bộ dữ liệu demo.
            pod_image: "https://cdn-storage.logistics.pro/pod_600\(orderId).jpg",
            gps_coordinates: gpsCoordinates
        )

        Task {
            do {
                try await ApiService.shared.submitPod(orderId: orderId, body: body)

                // ĐỢT 1: gửi ảnh + chữ ký thật SAU pod-submit, vì pod-submit đang ghi
                // đè pod_image bằng URL placeholder - upload sau sẽ thay bằng ảnh thật.
                let sig = await SignaturePadView.dataURL(lines: signatureLines, size: CGSize(width: 320, height: 160))
                let jpeg = podImage?.jpegData(compressionQuality: 0.8)
                if jpeg != nil || sig != nil {
                    try? await ApiService.shared.submitProofOfDelivery(
                        orderId: orderId, imageData: jpeg, signatureDataURL: sig,
                        receivedBy: receivedBy.trimmingCharacters(in: .whitespaces))
                }
                isSubmitting = false
                // Quay lại DriverView, onAppear ở đó sẽ tự tải lại danh sách chuyến
                // (tương đương finish() trong DriverTripDetailActivity.kt).
                dismiss()
            } catch {
                isSubmitting = false
                alertMessage = "Unable to connect to the server: \(error.localizedDescription)"
            }
        }
    }
}
