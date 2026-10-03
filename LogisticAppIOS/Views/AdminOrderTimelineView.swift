import SwiftUI

// Tương đương modal "Order Journey #..." trong AdminView.vue: thanh stepper 6 bước
// + danh sách nhật ký chi tiết (order_logs) của 1 đơn.
struct AdminOrderTimelineView: View {
    let order: AdminOrder?
    let history: [OrderLogEntry]

    @Environment(\.dismiss) private var dismiss

    private let stepLabels = [
        "Order Placed", "Order Approval (OMS)", "Warehouse Processing (WMS)",
        "Shipping (TMS)", "Delivered", "Completed"
    ]

    // Giống hệt getStepIndex() trong AdminView.vue
    private func stepIndex(_ order: AdminOrder?) -> Int {
        guard let order = order else { return 1 }
        let status = (order.status ?? "").uppercased()
        let dept = (order.current_dept ?? "").uppercased()
        if status == "DONE" || dept == "ARCHIVED" { return 6 }
        if status == "DELIVERED" { return 5 }
        if status == "SHIPPING" || dept == "TMS" { return 4 }
        if status == "PACKED" || dept == "WMS" { return 3 }
        if status == "APPROVED" { return 2 }
        return 1
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if order?.status == "RETURNED" {
                    Text("⚠️ This order has been returned to the customer and the standard process has not been followed.")
                        .font(.footnote).bold()
                        .foregroundStyle(.red)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    let idx = stepIndex(order)
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(Array(stepLabels.enumerated()), id: \.offset) { i, label in
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(i + 1 <= idx ? Color.green : Color.gray.opacity(0.3))
                                    .frame(width: 26, height: 26)
                                    .overlay(
                                        Text("\(i + 1)")
                                            .font(.caption2).bold()
                                            .foregroundStyle(.white)
                                    )
                                Text(label)
                                    .font(.caption).bold()
                                    .foregroundStyle(i + 1 == idx ? .primary : .secondary)
                                Spacer()
                            }
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Text("📌 Detailed log of each rotation")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 12) {
                    ForEach(history) { log in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(log.changed_at ?? "")
                                .font(.caption2).bold()
                                .foregroundStyle(.secondary)
                            Text("Status: \(log.old_status ?? "—") ➡️ \(log.new_status ?? "")")
                                .font(.subheadline).bold()
                            if let notes = log.notes, !notes.isEmpty {
                                Text("📝 \(notes)")
                                    .font(.caption)
                                    .padding(8)
                                    .foregroundStyle(.red)
                                    .background(Color.red.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    if history.isEmpty {
                        Text("This order has no recorded shipping history.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Order Journey #\(order?.id ?? 0)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") { dismiss() }
            }
        }
    }
}
