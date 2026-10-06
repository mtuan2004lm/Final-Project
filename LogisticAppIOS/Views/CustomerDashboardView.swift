import SwiftUI
import Charts   // Swift Charts - có sẵn từ iOS 16

// ĐỢT 2: dashboard thống kê cho khách hàng (tương đương tab "My Dashboard" trên CustomerView.vue).
struct CustomerDashboardView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var stats: CustomerStats?
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if let s = stats {
                VStack(spacing: 16) {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        card("Total orders", "\(s.total_orders)", .primary)
                        card("In progress", "\(s.active_orders)", .orange)
                        card("Delivered", "\(s.delivered_orders)", .green)
                        card("Success rate", s.success_rate.map { "\($0)%" } ?? "-", .primary)
                        card("Total shipping cost", store.formatCurrency(s.total_spent), .blue)
                        card("Paid / Refunded",
                             "\(store.formatCurrency(s.total_paid)) / \(store.formatCurrency(s.total_refunded))", .primary,
                             small: true)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Spending in the last 6 months").font(.headline)
                        if s.monthly.isEmpty {
                            Text("No data yet.").font(.caption).foregroundStyle(.secondary)
                        } else {
                            Chart(s.monthly) { m in
                                BarMark(x: .value("Month", m.month), y: .value("Spent", m.spent))
                                    .foregroundStyle(Color.blue.gradient)
                                    .annotation(position: .top) {
                                        Text(store.formatCurrency(m.spent)).font(.caption2)
                                    }
                            }
                            .frame(height: 200)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Spending by cargo category").font(.headline)
                        if s.by_cargo.isEmpty {
                            Text("No data yet.").font(.caption).foregroundStyle(.secondary)
                        }
                        let maxSpent = max(s.by_cargo.map(\.spent).max() ?? 1, 1)
                        ForEach(s.by_cargo) { c in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(c.cargo_type).font(.caption).bold()
                                    Spacer()
                                    Text("\(store.formatCurrency(c.spent)) · \(c.orders)").font(.caption)
                                }
                                ProgressView(value: c.spent, total: maxSpent).tint(.green)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding()
            } else if let errorMessage {
                Text(errorMessage).foregroundStyle(.red).padding()
            } else {
                ProgressView().padding(.top, 60)
            }
        }
        .navigationTitle("My Dashboard")
        .task { await load() }
        .refreshable { await load() }
    }

    private func card(_ title: String, _ value: String, _ color: Color, small: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(.caption2).bold().foregroundStyle(.secondary)
            Text(value)
                .font(small ? .subheadline : .title2).bold()
                .foregroundStyle(color)
                .minimumScaleFactor(0.6).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func load() async {
        do {
            stats = try await ApiService.shared.getCustomerStats(username: session.customerUsername)
            errorMessage = nil
        } catch {
            errorMessage = "Unable to load the dashboard: \(error.localizedDescription)"
        }
    }
}
