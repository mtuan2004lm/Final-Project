import SwiftUI

// Tương đương DriverActivity.kt + activity_driver.xml + item_trip_row.xml
struct DriverView: View {
    @EnvironmentObject var session: SessionStore
    @ObservedObject private var locationManager = LocationManager.shared

    @State private var driverName: String = ""
    @State private var truckPlate: String = ""
    @State private var trips: [TripOrder] = []
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TextField("Driver name", text: $driverName)
                    .textFieldStyle(.roundedBorder)
                TextField("License plate", text: $truckPlate)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()

                HStack {
                    Button("Start Trip") { startTrip() }
                        .buttonStyle(.borderedProminent)
                    Button("Stop Trip") { locationManager.stopTracking() }
                        .buttonStyle(.bordered)
                }

                // Tương đương txtLiveGps, cập nhật từ broadcast "GPS_UPDATE_ACTION" bên Android
                if locationManager.isTracking, let lat = locationManager.lastLatitude, let lng = locationManager.lastLongitude {
                    Text("Latitude (Lat): \(lat)\nLongitude (Lng): \(lng)")
                        .font(.footnote)
                } else {
                    Text("Latitude (Lat): Stopped\nLongitude (Lng): Stopped")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Divider()

                HStack {
                    Text("Assigned trips").font(.headline)
                    Spacer()
                    Button("Refresh") { Task { await refreshTrips() } }
                }

                if trips.isEmpty {
                    Text("No trips assigned to this vehicle yet.")
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                } else {
                    ForEach(trips) { trip in
                        tripRow(trip)
                        Divider()
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Driver (TMS)")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Logout", role: .destructive) { session.logout() }
            }
        }
        // Tương đương onResume() trong DriverActivity.kt: mỗi lần quay lại màn này
        // (ví dụ sau khi nộp POD xong ở màn chi tiết) tự tải lại danh sách chuyến,
        // để đơn vừa giao xong biến mất khỏi danh sách SHIPPING.
        .onAppear {
            driverName = session.driverName
            truckPlate = session.truckPlate
            if !truckPlate.isEmpty {
                Task { await refreshTrips() }
            }
        }
        .alert("Notification", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private func tripRow(_ trip: TripOrder) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(trip.stop_sequence.map { "Stop \($0)  •  " } ?? "")PKG-\(60000 + trip.id)  •  \(trip.customer_name)  (\(trip.product_name) Qty:\(trip.quantity))")
                .font(.subheadline).bold()
            if let addr = trip.delivery_address, !addr.isEmpty {
                Text("📍 \(addr)").font(.caption)
            }
            if let rn = trip.receiver_name, !rn.isEmpty {
                Text("👤 \(rn)\((trip.receiver_phone ?? "").isEmpty ? "" : " • \(trip.receiver_phone!)")").font(.caption)
            }
            Text("🛣️ \(trip.delivery_route ?? "")")
                .font(.caption)
            Text("Status: \(trip.status)  •  Vehicle: \(trip.assigned_truck ?? truckPlate)")
                .font(.caption)
                .foregroundStyle(.secondary)

            NavigationLink("Trip Detail") {
                DriverTripDetailView(
                    orderId: trip.id,
                    customer: trip.customer_name,
                    product: "\(trip.product_name) (Qty: \(trip.quantity))",
                    route: trip.delivery_route ?? "",
                    truckPlate: truckPlate,
                    gps: currentGpsString()
                )
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 6)
    }

    private func currentGpsString() -> String {
        guard let lat = locationManager.lastLatitude, let lng = locationManager.lastLongitude else { return "" }
        return "\(lat), \(lng)"
    }

    // Tương đương btnStart.setOnClickListener trong DriverActivity.kt: validate,
    // lưu tên tài xế/biển số vào "prefs", bắt đầu dịch vụ định vị, tải danh sách chuyến.
    private func startTrip() {
        let name = driverName.trimmingCharacters(in: .whitespaces)
        let plate = truckPlate.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !plate.isEmpty else {
            errorMessage = "Please fill in all the information!"
            return
        }
        session.driverName = name
        session.truckPlate = plate
        locationManager.startTracking(licensePlate: plate)
        Task { await refreshTrips() }
    }

    // Tương đương loadDriverTrips(licensePlate) trong DriverActivity.kt:
    // gọi GET /api/orders/tms/driver/{license_plate}
    private func refreshTrips() async {
        let plate = truckPlate.trimmingCharacters(in: .whitespaces)
        guard !plate.isEmpty else {
            errorMessage = "Enter the license plate first!"
            return
        }
        do {
            trips = try await ApiService.shared.getDriverTrips(licensePlate: plate)
        } catch {
            errorMessage = "Unable to connect to the server: \(error.localizedDescription)"
        }
    }
}
