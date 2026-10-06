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
                        if (order.pod_image ?? "").isEmpty == false || (order.pod_signature ?? "").isEmpty == false {
                            Button("📸 View Proof of Delivery") { podOrder = order }
                                .buttonStyle(.bordered)
                        }

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

// Hiển thị ảnh giao hàng + chữ ký người nhận mà tài xế đã nộp
private struct ProofOfDeliveryView: View {
    let order: CustomerOrder
    @Environment(\.dismiss) private var dismiss

    private var signatureImage: UIImage? {
        guard let s = order.pod_signature,
              let comma = s.firstIndex(of: ","),
              let data = Data(base64Encoded: String(s[s.index(after: comma)...])) else { return nil }
        return UIImage(data: data)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if let path = order.pod_image, !path.isEmpty,
                       let url = URL(string: ApiConfig.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) {
                        AsyncImage(url: url) { img in
                            img.resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 10))
                        } placeholder: { ProgressView() }
                    }
                    if let name = order.pod_received_by, !name.isEmpty {
                        Text("Received by: \(name)").font(.headline)
                    }
                    if let sig = signatureImage {
                        Image(uiImage: sig)
                            .resizable().scaledToFit()
                            .frame(maxHeight: 160)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))
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
