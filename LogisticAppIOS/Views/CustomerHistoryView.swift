import SwiftUI

// Tương đương tab "Order History & Reviews" trong CustomerView.vue (currentTab === 'history').
struct CustomerHistoryView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var reviewOrder: CustomerOrder?
    @State private var returnOrder: CustomerOrder?
    @State private var podOrder: CustomerOrder?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                ForEach(store.completedOrders) { order in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("#\(order.id)").font(.caption).bold()
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.gray.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                            Spacer()
                            Text("🏁 COMPLETED")
                                .font(.caption2).bold()
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.green.opacity(0.15))
                                .foregroundStyle(.green)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }

                        Text(order.product_name ?? "").font(.subheadline).bold()
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

                        if let rating = order.rating, rating > 0 {
                            Text(String(repeating: "⭐", count: rating))
                                .font(.subheadline)
                            if let feedback = order.feedback, !feedback.isEmpty {
                                Text("💬 \(feedback)")
                                    .font(.caption).italic()
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Button("⭐ Write a Review") { reviewOrder = order }
                                .buttonStyle(.bordered)
                        }

                        // ====== ĐỢT 2: hóa đơn + vận đơn (mở bằng Safari, có nút Print / Save as PDF) ======
                        HStack {
                            if let url = ApiService.shared.documentURL(type: "invoice", orderId: order.id) {
                                Link(destination: url) { Label("Invoice", systemImage: "doc.plaintext") }
                                    .buttonStyle(.bordered)
                            }
                            if let url = ApiService.shared.documentURL(type: "waybill", orderId: order.id) {
                                Link(destination: url) { Label("Waybill", systemImage: "doc.text") }
                                    .buttonStyle(.bordered)
                            }
                        }

                        // ====== ĐỢT 1: Proof of Delivery + yêu cầu trả hàng / hoàn tiền ======
                        Button("📸 View Proof of Delivery") { podOrder = order }
                            .buttonStyle(.bordered)

                        switch order.return_status ?? "NONE" {
                        case "REQUESTED":
                            Text("↩ Return requested - waiting for OMS").font(.caption).foregroundStyle(.orange)
                        case "APPROVED":
                            Text(order.refund_status == "REFUNDED" ? "↩ Return approved - refunded" : "↩ Return approved - refund pending")
                                .font(.caption).foregroundStyle(.green)
                        case "REJECTED":
                            Text("↩ Return rejected: \(order.return_reject_note ?? "")").font(.caption).foregroundStyle(.red)
                        default:
                            Button("↩ Request Return") { returnOrder = order }
                                .buttonStyle(.bordered)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                if store.completedOrders.isEmpty {
                    Text("No orders have completed the logistics supply chain yet.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .padding()
        }
        .refreshable { await store.fetchOrders(username: session.customerUsername) }
        .navigationTitle("History")
        .sheet(item: $reviewOrder) { order in
            NavigationStack {
                ReviewSheet(order: order) {
                    Task { await store.fetchOrders(username: session.customerUsername) }
                }
            }
        }
        .sheet(item: $returnOrder) { order in
            ReasonSheet(
                title: "Return Order #\(order.id)",
                prompt: "Reason for returning this order:",
                confirmLabel: "↩ Send Return Request",
                onConfirm: { reason in
                    try await ApiService.shared.requestReturn(orderId: order.id, reason: reason)
                },
                onDone: {
                    Task { await store.fetchOrders(username: session.customerUsername) }
                }
            )
        }
        .sheet(item: $podOrder) { order in
            ProofOfDeliveryView(order: order)
        }
    }
}

// Ảnh POD thật do tài xế tải lên (/uploads/...). Bỏ qua đường dẫn mô phỏng (cdn-storage...) do pod-submit ghi tạm.
func podRealImageURL(_ path: String?) -> URL? {
    guard let p = path, !p.isEmpty, !p.contains("cdn-storage.logistics.pro") else { return nil }
    if p.hasPrefix("http") { return URL(string: p) }
    let base = ApiConfig.baseURL.hasSuffix("/") ? String(ApiConfig.baseURL.dropLast()) : ApiConfig.baseURL
    return URL(string: base + (p.hasPrefix("/") ? p : "/" + p))
}

func podHasContent(_ o: CustomerOrder) -> Bool {
    podRealImageURL(o.pod_image) != nil || !(o.pod_signature ?? "").isEmpty
}

// Hiển thị ảnh giao hàng + chữ ký người nhận mà tài xế đã nộp
private struct ProofOfDeliveryView: View {
    let order: CustomerOrder
    @Environment(\.dismiss) private var dismiss

    private var signatureImage: UIImage? {
        guard let s = order.pod_signature, !s.isEmpty else { return nil }
        let b64 = s.contains(",") ? String(s[s.index(after: s.firstIndex(of: ",")!)...]) : s
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if let url = podRealImageURL(order.pod_image) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img):
                                img.resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 10))
                            case .failure:
                                Text("Unable to load the delivery photo.").font(.footnote).foregroundStyle(.red)
                            default:
                                ProgressView()
                            }
                        }
                    }
                    if let name = order.pod_received_by, !name.isEmpty {
                        Text("Received by: \(name)").font(.headline)
                    }
                    if let at = order.pod_at, !at.isEmpty {
                        Text("Delivered at: \(at)").font(.caption).foregroundStyle(.secondary)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        if let truck = order.assigned_truck, !truck.isEmpty {
                            Text("🚛 Vehicle: \(truck)\(order.driver_name.map { $0.isEmpty ? "" : " · Driver: " + $0 } ?? "")")
                        }
                        if let gps = order.gps_coordinates, !gps.isEmpty, gps != "Unknown" {
                            Text("📍 GPS: \(gps)")
                            let digits = gps.filter { "0123456789.,-".contains($0) }
                            if let u = URL(string: "https://www.google.com/maps?q=" + digits) {
                                Link("Open in Maps", destination: u)
                            }
                        }
                        if let n = order.driver_notes, !n.isEmpty { Text("📝 Driver notes: \(n)") }
                        Text("💰 Order total: $\(String(format: "%.2f", order.total_price ?? 0))\((order.insurance_fee ?? 0) > 0 ? " · 🛡️ Insurance: $" + String(format: "%.2f", order.insurance_fee ?? 0) : "")")
                        Text("🛣️ BOT fee: $\(String(format: "%.2f", order.bot_fee ?? 0)) · ⛽ Fuel fee: $\(String(format: "%.2f", order.fuel_fee ?? 0))")
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let sig = signatureImage {
                        Image(uiImage: sig)
                            .resizable().scaledToFit()
                            .frame(maxHeight: 160)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))
                    }
                    if !podHasContent(order) {
                        Text("No photo or signature was recorded for this delivery.").foregroundStyle(.secondary)
                    }
                }
                .padding()
            }
            .navigationTitle("POD - Order #\(order.id)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } }
            }
        }
    }
}

private struct ReviewSheet: View {
    let order: CustomerOrder
    var onSubmitted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rating = 5
    @State private var feedback = ""
    @State private var isSubmitting = false
    @State private var alertMessage: String?

    var body: some View {
        VStack(spacing: 20) {
            Text("Your satisfaction level:").font(.subheadline).bold()
            HStack(spacing: 10) {
                ForEach(1...5, id: \.self) { star in
                    Image(systemName: star <= rating ? "star.fill" : "star")
                        .font(.title)
                        .foregroundStyle(.yellow)
                        .onTapGesture { rating = star }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Feedback content:").font(.subheadline).bold()
                TextEditor(text: $feedback)
                    .frame(height: 120)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))
            }

            Button {
                submit()
            } label: {
                if isSubmitting {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("🚀 Submit Service Review").bold().frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSubmitting)

            Spacer()
        }
        .padding()
        .navigationTitle("Review Order #\(order.id)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") { dismiss() }
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

    private func submit() {
        isSubmitting = true
        Task {
            do {
                try await ApiService.shared.submitFeedback(
                    orderId: order.id,
                    body: FeedbackRequest(rating: rating, feedback: feedback)
                )
                isSubmitting = false
                onSubmitted()
                dismiss()
            } catch {
                isSubmitting = false
                alertMessage = "Unable to submit the review, please try again later!"
            }
        }
    }
}
