import SwiftUI
import MapKit

// Tương đương tab "Current Orders" trong CustomerView.vue (currentTab === 'list').
// Phần bản đồ GPS trực tiếp dùng MapKit native thay cho <iframe OpenStreetMap>
// bên web - trải nghiệm mượt hơn và không cần internet tải iframe riêng.
struct CustomerOrdersListView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var qrOrderId: Int?
    @State private var cancelOrder: CustomerOrder?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                ForEach(store.activeOrders) { order in
                    CustomerOrderCard(order: order, store: store,
                                      onViewQR: { qrOrderId = order.id },
                                      onCancel: { cancelOrder = order })
                }

                if store.activeOrders.isEmpty {
                    Text("There are no orders currently being processed.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .padding()
        }
        .refreshable { await store.fetchOrders(username: session.customerUsername) }
        .navigationTitle("Current Orders")
        .sheet(isPresented: Binding(
            get: { qrOrderId != nil },
            set: { if !$0 { qrOrderId = nil } }
        )) {
            if let id = qrOrderId {
                OrderQRCodeView(orderId: id)
            }
        }
        .sheet(item: $cancelOrder) { order in
            ReasonSheet(
                title: "Cancel Order #\(order.id)",
                prompt: "Reason for cancelling this order:",
                confirmLabel: "✖ Confirm Cancellation",
                onConfirm: { reason in
                    try await ApiService.shared.cancelOrder(orderId: order.id, reason: reason)
                },
                onDone: {
                    Task { await store.fetchOrders(username: session.customerUsername) }
                }
            )
        }
    }
}

// 1 điểm đánh dấu xe trên bản đồ - dùng Identifiable cho Map(annotationItems:)
// (API tương thích iOS 16, thay vì Map(position:)/Marker chỉ có từ iOS 17).
private struct TruckPin: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
}

private struct CustomerOrderCard: View {
    let order: CustomerOrder
    let store: CustomerStore
    var onViewQR: () -> Void
    var onCancel: () -> Void

    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
        span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
    )

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(order.id)").font(.caption).bold()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.gray.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Spacer()
                Text(store.translateStatus(order.status))
                    .font(.caption2).bold()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                // MỚI: xem lại mã QR của đơn này bất cứ lúc nào (vd: in lại nếu làm mất)
                Button {
                    onViewQR()
                } label: {
                    Image(systemName: "qrcode")
                }
                .buttonStyle(.borderless)
            }

            Text(order.product_name ?? "").font(.subheadline).bold()
            Text("Customer: \(order.customer_name ?? "") · Qty: \(order.quantity)")
                .font(.caption).foregroundStyle(.secondary)

            HStack {
                Text(order.cargo_type ?? "Hàng hóa thông thường")
                    .font(.caption2).bold()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.blue.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                Spacer()
                Text(store.formatCurrency(store.getOrderPrice(order)))
                    .font(.subheadline).bold()
            }

            // ====== ĐỢT 1: địa chỉ giao, lịch lấy hàng, hủy đơn ======
            if let addr = order.delivery_address, !addr.isEmpty {
                Text("📍 \(addr)").font(.caption)
            }
            if let name = order.receiver_name, !name.isEmpty {
                Text("👤 \(name) \(order.receiver_phone ?? "")").font(.caption2).foregroundStyle(.secondary)
            }
            if let pickup = order.pickup_date, !pickup.isEmpty {
                Text("🕒 Pickup: \(store.formatDateTime(pickup))").font(.caption2).foregroundStyle(.secondary)
            }
            HStack {
                if order.status == "NEW" || order.status == "RETURNED" {
                    Button(role: .destructive) { onCancel() } label: {
                        Label("Cancel Order", systemImage: "xmark.circle")
                    }
                    .buttonStyle(.bordered)
                }
                // ĐỢT 2: vận đơn (mở bằng Safari, có nút Print / Save as PDF)
                if let url = ApiService.shared.documentURL(type: "waybill", orderId: order.id) {
                    Link(destination: url) {
                        Label("Waybill", systemImage: "doc.text")
                    }
                    .buttonStyle(.bordered)
                }
            }

            // ====== VỊ TRÍ XE THỜI GIAN THỰC (giống .live-map-cell bên web) ======
            if order.status == "SHIPPING", let lat = order.truck_lat, let lng = order.truck_lng {
                let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
                Map(coordinateRegion: $region, annotationItems: [TruckPin(coordinate: coordinate)]) { pin in
                    MapMarker(coordinate: pin.coordinate, tint: .red)
                }
                .frame(height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .onAppear {
                    region = MKCoordinateRegion(center: coordinate, span: region.span)
                }
                .onChange(of: lat) { _ in
                    region = MKCoordinateRegion(center: coordinate, span: region.span)
                }

                HStack {
                    Link("🔗 Open in Maps", destination: URL(string: "https://www.google.com/maps?q=\(lat),\(lng)")!)
                        .font(.caption2)
                    Spacer()
                    Text("📍 Updated: \(store.formatDateTime(order.truck_gps_updated_at))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } else if order.status == "SHIPPING" {
                Text("⏳ Waiting for GPS signal from the vehicle...")
                    .font(.caption2).italic()
                    .foregroundStyle(.secondary)
            } else {
                Text("Not yet shipped")
                    .font(.caption2).italic()
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
