import SwiftUI

// Tương đương tab "Invoice Payment Gateway" trong CustomerView.vue (currentTab === 'payment').
struct CustomerPaymentView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var selectedOrder: CustomerOrder?
    @State private var isConfirming = false
    @State private var alertMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("💳 Invoices Pending Freight Settlement").font(.headline)

                ForEach(store.unpaidOrders) { order in
                    Button {
                        selectedOrder = order
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("#\(order.id) · \(order.product_name ?? "")").font(.subheadline).bold()
                                Text(order.cargo_type ?? "Hàng hóa thông thường")
                                    .font(.caption2).bold()
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                            Spacer()
                            Text(store.formatCurrency(store.getOrderPrice(order)))
                                .font(.subheadline).bold()
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(selectedOrder?.id == order.id ? Color.blue.opacity(0.08) : Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }

                if store.unpaidOrders.isEmpty {
                    Text("No outstanding invoices.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }

                if let order = selectedOrder {
                    VStack(spacing: 12) {
                        Text("📥 QR CODE BANK TRANSFER INFORMATION").font(.headline)
                        Text("Invoice Code: #\(order.id)").font(.caption)
                        Text("Amount: \(store.formatCurrency(store.getOrderPrice(order)))")
                            .font(.subheadline).bold().foregroundStyle(.red)

                        if let url = store.generateQRUrl(order) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                ProgressView()
                            }
                            .frame(width: 200, height: 200)
                        }

                        Text("Open your Banking app to scan and pay quickly")
                            .font(.caption2).italic().foregroundStyle(.secondary)

                        Button {
                            confirmPayment(order)
                        } label: {
                            if isConfirming {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Text("✓ I have completed the transfer").bold().frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isConfirming)
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding()
        }
        .refreshable { await store.fetchOrders(username: session.customerUsername) }
        .navigationTitle("Payment")
        .alert("Notification", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private func confirmPayment(_ order: CustomerOrder) {
        isConfirming = true
        Task {
            do {
                try await ApiService.shared.confirmPaymentSubmitted(orderId: order.id)
                isConfirming = false
                alertMessage = "✅ Payment confirmation request sent successfully!"
                selectedOrder = nil
                await store.fetchOrders(username: session.customerUsername)
            } catch {
                isConfirming = false
                alertMessage = "Operation failed!"
            }
        }
    }
}
