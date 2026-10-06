import SwiftUI

// ĐỢT 4: nhật ký hoạt động (audit log) cho Admin - ai đã làm gì, lúc nào.
struct AdminAuditView: View {
    @State private var entries: [AuditEntry] = []
    @State private var actor = ""
    @State private var query = ""
    @State private var error: String?

    var body: some View {
        List {
            Section {
                TextField("Filter by user", text: $actor).autocorrectionDisabled().textInputAutocapitalization(.never)
                TextField("Search action / details / order id", text: $query).autocorrectionDisabled().textInputAutocapitalization(.never)
                Button("Search") { Task { await load() } }
            }
            if let error { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
            Section {
                if entries.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(entries) { e in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(e.action).font(.subheadline).bold()
                                .foregroundStyle((e.action.hasSuffix("FAILED") || (e.status_code ?? 0) >= 400) ? Color.red : Color.primary)
                            Spacer()
                            if let s = e.status_code { Text("\(s)").font(.caption2).foregroundStyle(.secondary) }
                        }
                        Text("\(e.actor ?? "—")\(e.entity_id.map { " · #\($0)" } ?? "") · \(e.created_at ?? "")")
                            .font(.caption2).foregroundStyle(.secondary)
                        if let d = e.detail, !d.isEmpty { Text(d).font(.caption2).foregroundStyle(.secondary).lineLimit(3) }
                    }
                }
            }
        }
        .navigationTitle("Audit Log")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do { entries = try await ApiService.shared.getAuditLog(actor: actor, query: query); error = nil }
        catch { self.error = friendlyError(error) }
    }
}
