import SwiftUI

// Tương đương WmsLogsActivity.kt + activity_wms_logs.xml
struct WmsLogsView: View {
    @State private var allLogs: [WarehouseLog] = []
    @State private var searchText = ""
    @State private var errorMessage: String?

    // Tương đương logic lọc trong btnSearchLog.setOnClickListener: khớp ID đơn
    // thuần (VD "1") hoặc mã đầy đủ dạng số PKG (VD "60001").
    private var filteredLogs: [WarehouseLog] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return allLogs }
        return allLogs.filter { String($0.orderId) == query || String(60000 + $0.orderId) == query }
    }

    var body: some View {
        VStack {
            HStack {
                TextField("Search by order code (e.g. 60001)", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                Button("Search") { }
                    .buttonStyle(.bordered)
            }
            .padding([.horizontal, .top])

            List(filteredLogs) { log in
                VStack(alignment: .leading, spacing: 4) {
                    Text("📦 Order: PKG-\(60000 + log.orderId) | \(log.notes ?? "")")
                        .font(.subheadline).bold()
                        .foregroundStyle(Color(red: 0.17, green: 0.24, blue: 0.31))

                    Text("Timeline: \(log.oldStatus ?? "") ➡️ \(log.newStatus ?? "")\nTime: \(log.changedAt ?? "")")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.5, green: 0.55, blue: 0.55))
                }
            }
        }
        .navigationTitle("Warehouse Logs")
        .onAppear { Task { await fetchWarehouseLogs() } }
        .alert("Notification", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func fetchWarehouseLogs() async {
        do {
            allLogs = try await ApiService.shared.getWmsLogs()
        } catch {
            errorMessage = "Lost connection to the log data server!"
        }
    }
}
