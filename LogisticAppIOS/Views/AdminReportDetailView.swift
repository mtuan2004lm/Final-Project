import SwiftUI

// Tương đương modal xem chi tiết 1 báo cáo Docs gửi lên, trong AdminView.vue.
// MỚI: thêm số liệu tổng hợp (orders/revenue/BOT/fuel + đếm theo status) và ô
// tìm kiếm theo mã đơn/tên khách ngay trong báo cáo, giống bản web đã bổ sung.
struct AdminReportDetailView: View {
    let report: AdminReportDetail?

    @Environment(\.dismiss) private var dismiss
    @State private var search: String = ""

    // Lọc danh sách theo từ khoá tìm kiếm (mã đơn hoặc tên khách hàng)
    private var filteredRows: [AdminReportRow] {
        guard let rows = report?.data else { return [] }
        let keyword = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if keyword.isEmpty { return rows }
        return rows.filter {
            String($0.id).contains(keyword) ||
            ($0.customer_name ?? "").lowercased().contains(keyword)
        }
    }

    // Số liệu tổng hợp, tự tính lại theo đúng những dòng đang hiển thị (có áp dụng tìm kiếm)
    private struct Stats {
        var count = 0
        var totalRevenue: Double = 0
        var totalBot: Double = 0
        var totalFuel: Double = 0
        var statusCounts: [String: Int] = [:]
    }

    private var stats: Stats {
        var s = Stats()
        s.count = filteredRows.count
        for row in filteredRows {
            s.totalRevenue += Double(row.total_cost ?? "") ?? 0
            s.totalBot += Double(row.bot_fee ?? "") ?? 0
            s.totalFuel += Double(row.fuel_fee ?? "") ?? 0
            let status = row.status ?? "OTHER"
            s.statusCounts[status, default: 0] += 1
        }
        return s
    }

    private func fmt(_ v: Double) -> String {
        String(format: "%.2f", v)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Sent by: \(report?.created_by ?? "—")  •  Total \(report?.data.count ?? 0) orders")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                // MỚI: lưới số liệu tổng hợp
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    statBox(label: "ORDERS SHOWN", value: "\(stats.count)", color: .primary)
                    statBox(label: "TOTAL SHIPPING FEE", value: "\(fmt(stats.totalRevenue)) USD", color: .green)
                    statBox(label: "TOTAL BOT FEE", value: "\(fmt(stats.totalBot)) USD", color: .red)
                    statBox(label: "TOTAL FUEL FEE", value: "\(fmt(stats.totalFuel)) USD", color: .red)
                }

                if !stats.statusCounts.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(stats.statusCounts.sorted(by: { $0.key < $1.key }), id: \.key) { status, count in
                                Text("\(status): \(count)")
                                    .font(.caption2).bold()
                                    .padding(.horizontal, 8).padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                        }
                    }
                }

                // MỚI: tìm kiếm theo mã đơn / tên khách trong báo cáo này
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search by order code or customer name...", text: $search)
                        .textFieldStyle(.plain)
                }
                .padding(10)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                ForEach(filteredRows) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("#\(row.id) · \(row.customer_name ?? "")")
                            .font(.subheadline).bold()
                        Text("\(row.product_name ?? "") (Quantity: \(row.quantity))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            Text(row.status ?? "")
                                .font(.caption2).bold()
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.blue.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                            Text(row.current_dept ?? "")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        // MỚI: Warehouse / Route / Truck / Created At - giống các cột mới bên web
                        Text("📦 \(row.warehouse_location ?? "—")  🛣️ \(row.delivery_route ?? "—")  🚚 \(row.assigned_truck ?? "—")")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text("Fee: \(row.total_cost ?? "0") USD · BOT: \(row.bot_fee ?? "0") USD · Fuel: \(row.fuel_fee ?? "0") USD")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        if let created = row.created_at {
                            Text("Created on: \(formatDate(created))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                if filteredRows.isEmpty {
                    Text((report?.data.isEmpty ?? true) ? "This report does not contain order data." : "No orders in this report match your search.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
            .padding()
        }
        .navigationTitle(report?.title ?? "Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") { dismiss() }
            }
        }
    }

    private func statBox(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).bold().foregroundStyle(.secondary)
            Text(value).font(.headline).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func formatDate(_ s: String) -> String {
        if let date = ISO8601DateFormatter().date(from: s) {
            let f = DateFormatter()
            f.dateStyle = .short
            return f.string(from: date)
        }
        return s
    }
}
