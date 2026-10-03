import SwiftUI
import Combine

// Tương đương AdminView.vue (sidebar 4 tab bên web -> ở mobile đổi thành thanh
// Picker phân đoạn trên cùng, do màn hình điện thoại hẹp, không đủ chỗ cho sidebar).
// Dữ liệu và endpoint API giữ nguyên 1:1 với web, chỉ khác cách trình bày UI.
struct AdminView: View {
    @EnvironmentObject var session: SessionStore

    enum Tab: String, CaseIterable, Identifiable {
        case pipeline = "Pipeline"
        case revenue = "Revenue"
        case ops = "Ops"
        case reports = "Reports"
        var id: String { rawValue }
    }

    @State private var tab: Tab = .pipeline

    @State private var overview = AdminOverview.empty
    @State private var revenue = RevenueSummary.empty
    @State private var accSummary = AccSummary.empty
    @State private var reports: [AdminReport] = []
    @State private var errorMessage: String?

    @State private var timelineOrder: AdminOrder?
    @State private var orderHistory: [OrderLogEntry] = []
    @State private var showTimeline = false

    @State private var reportDetail: AdminReportDetail?
    @State private var showReportDetail = false

    // MỚI: bộ lọc & tìm kiếm cho danh sách báo cáo (tab Reports), giống bản web
    @State private var reportSearch: String = ""
    @State private var reportSenderFilter: String = ""
    @State private var reportDateFrom: Date?
    @State private var reportDateTo: Date?
    @State private var showReportDateFilter = false

    @State private var csvURL: URL?
    @State private var showShareSheet = false

    // Tương đương setInterval(refreshAllData, 8000) trong AdminView.vue
    private let refreshTimer = Timer.publish(every: 8, on: .main, in: .common).autoconnect()

    private let stepLabels = [
        "Order Placed", "Order Approval (OMS)", "Warehouse Processing (WMS)",
        "Shipping (TMS)", "Delivered", "Completed"
    ]

    var body: some View {
        VStack(spacing: 0) {
            Picker("Tab", selection: $tab) {
                ForEach(Tab.allCases) { t in
                    Text(t.rawValue).tag(t)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            ScrollView {
                switch tab {
                case .pipeline: pipelineSection
                case .revenue: revenueSection
                case .ops: opsSection
                case .reports: reportsSection
                }
            }
        }
        .navigationTitle("SYSTEM ADMINISTRATION")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Logout", role: .destructive) { session.logout() }
            }
        }
        .onAppear { Task { await refreshAll() } }
        .onReceive(refreshTimer) { _ in Task { await refreshAll() } }
        .sheet(isPresented: $showTimeline) {
            NavigationStack {
                AdminOrderTimelineView(order: timelineOrder, history: orderHistory)
            }
        }
        .sheet(isPresented: $showReportDetail) {
            NavigationStack {
                AdminReportDetailView(report: reportDetail)
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = csvURL {
                ShareSheet(activityItems: [url])
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

    // ============ TAB 1: QUY TRÌNH ĐƠN HÀNG ============

    private func stepIndex(_ order: AdminOrder) -> Int {
        let status = (order.status ?? "").uppercased()
        let dept = (order.current_dept ?? "").uppercased()
        if status == "DONE" || dept == "ARCHIVED" { return 6 }
        if status == "DELIVERED" { return 5 }
        if status == "SHIPPING" || dept == "TMS" { return 4 }
        if status == "PACKED" || dept == "WMS" { return 3 }
        if status == "APPROVED" { return 2 }
        return 1
    }

    private var pipelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("All orders in the system (\(overview.totalOrders))")
                .font(.headline)
                .padding(.horizontal)

            ForEach(overview.orders) { order in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("#\(order.id)")
                            .font(.caption).bold()
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.gray.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                        Spacer()
                        Text(order.current_dept ?? "—")
                            .font(.caption2).bold()
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    Text(order.customer_name ?? "").font(.subheadline).bold()
                    Text("\(order.product_name ?? "") (Qty: \(order.quantity))")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if order.status == "RETURNED" {
                        Text("⚠️ Refunded").font(.caption).bold().foregroundStyle(.red)
                    } else {
                        let idx = stepIndex(order)
                        Text("Step \(idx)/6 - \(stepLabels[idx - 1])")
                            .font(.caption).bold()
                            .foregroundStyle(.blue)
                    }

                    Button("🔍 View Log") {
                        Task { await openTimeline(order) }
                    }
                    .font(.caption)
                    .buttonStyle(.bordered)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.horizontal)
            }

            if overview.orders.isEmpty {
                Text("There are no orders in the system yet.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
        }
        .padding(.vertical)
    }

    // ============ TAB 2: TỔNG QUAN DOANH THU ============

    private func formatUSD(_ v: Double) -> String {
        "$\(Int(v.rounded()))"
    }

    private var revenueSection: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                revenueCard(title: "TODAY'S REVENUE", value: revenue.today, colors: [.green, .teal])
                revenueCard(title: "REVENUE THIS MONTH", value: revenue.month, colors: [.blue, .cyan])
            }
            .padding(.horizontal)

            VStack(spacing: 12) {
                summaryRow(icon: "💰", label: "Total Collected from Customers",
                           value: accSummary.collectedCustomerRevenue,
                           sub: "Projected total: \(formatUSD(accSummary.totalCustomerRevenue))",
                           color: .green)
                summaryRow(icon: "⛽", label: "Total E-POD Cost (Fleet)",
                           value: -accSummary.totalEpodCost,
                           sub: "BOT: \(formatUSD(accSummary.totalBotFee)) | Fuel: \(formatUSD(accSummary.totalFuelFee))",
                           color: .red)
                summaryRow(icon: "📈", label: "Net Profit of the Entire Company",
                           value: accSummary.netProfit,
                           sub: "Revenue collected − E-POD expenses",
                           color: accSummary.netProfit >= 0 ? .blue : .orange)
            }
            .padding(.horizontal)
        }
        .padding(.vertical)
    }

    private func revenueCard(title: String, value: Double, colors: [Color]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption2).bold().foregroundStyle(.white.opacity(0.9))
            Text(formatUSD(value)).font(.title2).bold().foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func summaryRow(icon: String, label: String, value: Double, sub: String, color: Color) -> some View {
        HStack(spacing: 14) {
            Text(icon).font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption).foregroundStyle(.secondary)
                Text(formatUSD(value)).font(.headline).foregroundStyle(color)
                Text(sub).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // ============ TAB 3: TỔNG QUAN VẬN HÀNH ============

    private var opsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Overview by Department").font(.headline)
                Spacer()
                Button("📥 Export CSV") { exportCSV() }
                    .font(.caption)
                    .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 12) {
                ForEach(overview.deptCounts.sorted(by: { $0.key < $1.key }), id: \.key) { dept, count in
                    VStack {
                        Text("\(count)").font(.title2).bold()
                        Text(dept).font(.caption2).bold().foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal)

            if overview.deptCounts.isEmpty {
                Text("Department data is not yet available.")
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }

            Text("Order list overview")
                .font(.headline)
                .padding(.horizontal)
                .padding(.top, 8)
            Text("For shelf locations, scan status, etc., use the dedicated WMS/TMS screens.")
                .font(.caption2).italic()
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            VStack(spacing: 0) {
                ForEach(overview.orders) { order in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("#\(order.id) · \(order.customer_name ?? "")").font(.subheadline).bold()
                            Text("\(order.product_name ?? "") · Qty: \(order.quantity)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(order.status ?? "").font(.caption2).bold()
                            Text(order.current_dept ?? "—").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    Divider().padding(.horizontal)
                }
                if overview.orders.isEmpty {
                    Text("No orders have been received yet.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
        }
        .padding(.vertical)
    }

    // ============ TAB 4: BÁO CÁO TỪ DOCS ============

    // Danh sách người gửi (Docs) duy nhất, lấy từ chính danh sách báo cáo đã tải về
    private var reportSenders: [String] {
        Array(Set(reports.compactMap { $0.created_by })).sorted()
    }

    private func parseReportDate(_ s: String?) -> Date? {
        guard let s = s else { return nil }
        return ISO8601DateFormatter().date(from: s)
    }

    // MỚI: áp dụng tìm kiếm theo tiêu đề + lọc theo người gửi + khoảng ngày gửi
    private var filteredReports: [AdminReport] {
        reports.filter { report in
            if !reportSearch.isEmpty,
               !(report.title ?? "").lowercased().contains(reportSearch.lowercased()) {
                return false
            }
            if !reportSenderFilter.isEmpty, report.created_by != reportSenderFilter {
                return false
            }
            if let from = reportDateFrom, let d = parseReportDate(report.created_at), d < from {
                return false
            }
            if let to = reportDateTo, let d = parseReportDate(report.created_at) {
                let endOfDay = Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: to) ?? to
                if d > endOfDay { return false }
            }
            return true
        }
    }

    private var hasActiveReportFilters: Bool {
        !reportSearch.isEmpty || !reportSenderFilter.isEmpty || reportDateFrom != nil || reportDateTo != nil
    }

    private var reportsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reports from Docs (\(filteredReports.count)/\(reports.count))")
                .font(.headline)
                .padding(.horizontal)

            // MỚI: thanh tìm kiếm + lọc theo người gửi + khoảng ngày
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search by report title...", text: $reportSearch)
                        .textFieldStyle(.plain)
                }
                .padding(10)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                if !reportSenders.isEmpty {
                    Picker("Sender", selection: $reportSenderFilter) {
                        Text("All senders").tag("")
                        ForEach(reportSenders, id: \.self) { sender in
                            Text(sender).tag(sender)
                        }
                    }
                    .pickerStyle(.menu)
                }

                DisclosureGroup("📅 Filter by date sent", isExpanded: $showReportDateFilter) {
                    VStack(spacing: 8) {
                        DatePicker("From", selection: Binding(
                            get: { reportDateFrom ?? Date() },
                            set: { reportDateFrom = $0 }
                        ), displayedComponents: .date)
                        DatePicker("To", selection: Binding(
                            get: { reportDateTo ?? Date() },
                            set: { reportDateTo = $0 }
                        ), displayedComponents: .date)
                    }
                    .font(.caption)
                }

                if hasActiveReportFilters {
                    Button("✕ Clear filters") {
                        reportSearch = ""
                        reportSenderFilter = ""
                        reportDateFrom = nil
                        reportDateTo = nil
                    }
                    .font(.caption)
                }
            }
            .padding(.horizontal)

            ForEach(filteredReports) { report in
                Button {
                    Task { await openReport(report.id) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(report.title ?? "").font(.subheadline).bold()
                        Text("Sender: \(report.created_by ?? "")").font(.caption).foregroundStyle(.secondary)
                        Text(formatDateTime(report.created_at)).font(.caption2).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .padding(.horizontal)
            }

            if filteredReports.isEmpty {
                Text(reports.isEmpty ? "No report has been submitted by Docs yet." : "No reports match the current filters.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
        }
        .padding(.vertical)
    }

    // ============ NETWORKING ============

    private func refreshAll() async {
        async let ov: () = fetchOverview()
        async let rv: () = fetchRevenue()
        async let ac: () = fetchAccSummary()
        async let rp: () = fetchReports()
        _ = await (ov, rv, ac, rp)
    }

    private func fetchOverview() async {
        do {
            overview = try await ApiService.shared.getAdminOverview()
        } catch {
            errorMessage = "Order overview loading error: \(error.localizedDescription)"
        }
    }

    // Giống web: lỗi tải doanh thu/kế toán/report chỉ log, không chặn cả màn hình bằng alert
    private func fetchRevenue() async {
        revenue = (try? await ApiService.shared.getRevenue()) ?? revenue
    }

    private func fetchAccSummary() async {
        accSummary = (try? await ApiService.shared.getAccSummary()) ?? accSummary
    }

    private func fetchReports() async {
        reports = (try? await ApiService.shared.getAdminReports()) ?? reports
    }

    // Giống openTimeline() trong AdminView.vue - gọi GET /api/orders/history/:id
    private func openTimeline(_ order: AdminOrder) async {
        timelineOrder = order
        do {
            orderHistory = try await ApiService.shared.getOrderHistory(id: order.id)
            showTimeline = true
        } catch {
            errorMessage = "Unable to load the order history for this order!"
        }
    }

    private func openReport(_ id: Int) async {
        do {
            reportDetail = try await ApiService.shared.getAdminReportDetail(id: id)
            showReportDetail = true
        } catch {
            errorMessage = "This report cannot be opened!"
        }
    }

    private func formatDateTime(_ s: String?) -> String {
        guard let s = s else { return "—" }
        if let date = ISO8601DateFormatter().date(from: s) {
            let f = DateFormatter()
            f.dateStyle = .short
            f.timeStyle = .short
            return f.string(from: date)
        }
        return s
    }

    // Tương đương exportOrdersReport() trong AdminView.vue, nhưng dùng Share Sheet
    // của iOS thay cho tải file trực tiếp xuống Downloads (web không có khái niệm đó).
    private func exportCSV() {
        let list = overview.orders
        guard !list.isEmpty else {
            errorMessage = "There are no orders to generate a report for!"
            return
        }

        func esc(_ s: String) -> String {
            if s.contains(",") || s.contains("\"") || s.contains("\n") {
                return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\""
            }
            return s
        }

        var csv = "Order Code,Customer,Goods,Quantity,Status,Current Department,Warehouse Location,Route,Vehicle,BOT Fee,Fuel Fee,Fee,Payment Status,Creation Date\r\n"
        for o in list {
            let row = [
                String(o.id), o.customer_name ?? "", o.product_name ?? "", String(o.quantity),
                o.status ?? "", o.current_dept ?? "", o.warehouse_location ?? "", o.delivery_route ?? "",
                o.assigned_truck ?? "", o.bot_fee ?? "", o.fuel_fee ?? "", o.total_cost ?? "",
                o.payment_status ?? "", o.created_at ?? ""
            ].map(esc).joined(separator: ",")
            csv += row + "\r\n"
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let stamp = formatter.string(from: Date())
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("AdminOverviewReport\(stamp).csv")

        do {
            try csv.write(to: url, atomically: true, encoding: .utf8)
            csvURL = url
            showShareSheet = true
        } catch {
            errorMessage = "Unable to export the CSV file."
        }
    }
}
