import SwiftUI
import UniformTypeIdentifiers

// ĐỢT 3: nhập nhiều đơn từ file CSV (giống tab Bulk của web).
// Cột: product_name, quantity, cargo_type, delivery_address, receiver_name, receiver_phone, customer_name (tùy chọn).
struct CustomerBulkImportView: View {
    @EnvironmentObject var session: SessionStore

    struct Row: Identifiable {
        let id = UUID()
        var data: BulkOrderRow
        var error: String?
    }

    @State private var rows: [Row] = []
    @State private var showPicker = false
    @State private var message: String?
    @State private var sending = false

    private let cargoAliases: [String: String] = [
        "normal": "Hàng hóa thông thường", "thông thường": "Hàng hóa thông thường", "hàng hóa thông thường": "Hàng hóa thông thường",
        "electronics": "Hàng hóa điện tử", "điện tử": "Hàng hóa điện tử", "hàng hóa điện tử": "Hàng hóa điện tử",
        "dangerous": "Hàng hóa nguy hiểm", "nguy hiểm": "Hàng hóa nguy hiểm", "hàng hóa nguy hiểm": "Hàng hóa nguy hiểm",
        "express": "Hàng hóa nhanh", "fast": "Hàng hóa nhanh", "nhanh": "Hàng hóa nhanh", "hàng hóa nhanh": "Hàng hóa nhanh"
    ]

    private var validCount: Int { rows.filter { $0.error == nil }.count }

    var body: some View {
        List {
            Section {
                Button { showPicker = true } label: { Label("Choose CSV file", systemImage: "doc.badge.plus") }
                Text("Header: product_name, quantity, cargo_type (Normal / Electronics / Dangerous / Express), delivery_address, receiver_name, receiver_phone. Max 200 rows. Prices are calculated by the server.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if let message { Section { Text(message).font(.footnote) } }
            if !rows.isEmpty {
                Section("Preview - \(validCount)/\(rows.count) valid") {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(i + 1). \(r.data.product_name) × \(r.data.quantity)").font(.subheadline).bold()
                            Text("\(r.data.cargo_type) • \(r.data.delivery_address)").font(.caption).foregroundStyle(.secondary)
                            if let e = r.error { Text("⚠️ \(e)").font(.caption).foregroundStyle(.red) }
                        }
                    }
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        Text(sending ? "Creating..." : "Create \(rows.count) order(s)").frame(maxWidth: .infinity)
                    }
                    .disabled(sending || validCount != rows.count)
                }
            }
        }
        .navigationTitle("Bulk Import")
        .fileImporter(isPresented: $showPicker, allowedContentTypes: [.commaSeparatedText, .plainText, .text]) { result in
            switch result {
            case .success(let url): load(url)
            case .failure(let e): message = e.localizedDescription
            }
        }
    }

    private func load(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
            message = "Cannot read the file."; return
        }
        parse(text)
    }

    // Phân tích CSV: hỗ trợ dấu ngoặc kép, dấu , hoặc ; làm phân cách, BOM, xuống dòng trong ô
    private func parseCSV(_ raw: String) -> [[String]] {
        var text = raw
        if text.hasPrefix("\u{FEFF}") { text.removeFirst() }
        let firstLine = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let delim: Character = firstLine.filter({ $0 == ";" }).count > firstLine.filter({ $0 == "," }).count ? ";" : ","
        var out: [[String]] = [], row: [String] = [], cell = "", inQ = false
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if inQ {
                if c == "\"" { if i + 1 < chars.count, chars[i + 1] == "\"" { cell.append("\""); i += 1 } else { inQ = false } }
                else { cell.append(c) }
            } else if c == "\"" { inQ = true }
            else if c == delim { row.append(cell); cell = "" }
            else if c == "\n" || c == "\r\n" || c == "\r" {
                row.append(cell); cell = ""
                if row.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) { out.append(row) }
                row = []
            } else { cell.append(c) }
            i += 1
        }
        row.append(cell)
        if row.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) { out.append(row) }
        return out
    }

    private func parse(_ text: String) {
        let table = parseCSV(text)
        guard table.count >= 2 else { message = "The file needs a header row and at least one data row."; rows = []; return }
        let headers = table[0].map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        func idx(_ names: [String]) -> Int? { headers.firstIndex { names.contains($0) } }
        let iProd = idx(["product_name", "product", "tên hàng"]), iQty = idx(["quantity", "qty", "số lượng"])
        let iCargo = idx(["cargo_type", "cargo", "loại hàng"]), iAddr = idx(["delivery_address", "address", "địa chỉ"])
        let iRN = idx(["receiver_name", "receiver"]), iRP = idx(["receiver_phone", "phone"]), iCust = idx(["customer_name", "customer"])
        guard iProd != nil, iQty != nil, iCargo != nil else { message = "Missing required columns: product_name, quantity, cargo_type."; rows = []; return }

        func cell(_ r: [String], _ i: Int?) -> String { (i != nil && i! < r.count) ? r[i!].trimmingCharacters(in: .whitespaces) : "" }
        rows = table.dropFirst().prefix(200).map { r in
            let prod = cell(r, iProd), qty = Int(cell(r, iQty)) ?? 0
            let cargoRaw = cell(r, iCargo), cargo = cargoAliases[cargoRaw.lowercased()]
            var err: String?
            if prod.isEmpty { err = "Missing product_name" }
            else if qty < 1 || qty > 9999 { err = "quantity must be 1-9999" }
            else if cargo == nil { err = "Unknown cargo_type \"\(cargoRaw)\"" }
            let cust = cell(r, iCust)
            return Row(data: BulkOrderRow(customer_name: cust.isEmpty ? session.customerUsername : cust, product_name: prod, quantity: qty,
                                          cargo_type: cargo ?? cargoRaw, delivery_address: cell(r, iAddr),
                                          receiver_name: cell(r, iRN), receiver_phone: cell(r, iRP)), error: err)
        }
        message = table.count - 1 > 200 ? "Only the first 200 rows were loaded." : nil
    }

    private func submit() async {
        sending = true; defer { sending = false }
        do {
            let r = try await ApiService.shared.createBulkOrders(username: session.customerUsername, rows: rows.map { $0.data })
            message = "✅ " + (r.message ?? "Orders created")
            rows = []
        } catch {
            message = "Error: \(error.localizedDescription)"
        }
    }
}
