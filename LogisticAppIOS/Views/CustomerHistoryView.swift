import SwiftUI

// Tương đương tab "Order History & Reviews" trong CustomerView.vue (currentTab === 'history').
struct CustomerHistoryView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var reviewOrder: CustomerOrder?

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
