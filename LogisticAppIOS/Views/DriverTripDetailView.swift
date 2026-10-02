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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Package Code: PKG-600\(orderId)").font(.headline)
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
