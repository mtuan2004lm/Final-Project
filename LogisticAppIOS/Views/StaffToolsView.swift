import SwiftUI

// Các công cụ nhân viên (Admin / Kế toán / OMS / Docs) – tương đương các tab bên web.
// Dùng JSON động (không cần struct Codable) gọi thẳng router /api/ext của backend.

struct JRow: Identifiable {
    let id: Int
    let d: [String: Any]
    func s(_ k: String) -> String {
        if let v = d[k], !(v is NSNull) { return "\(v)" }
        return ""
    }
    func n(_ k: String) -> Double {
        if let v = d[k] as? Double { return v }
        if let v = d[k] as? Int { return Double(v) }
        if let v = d[k] as? String, let x = Double(v) { return x }
        return 0
    }
    func b(_ k: String) -> Bool { (d[k] as? Bool) ?? false }
    func rows(_ k: String) -> [JRow] { JSON.rows(d[k] ?? []) }
}

enum JSON {
    static func call(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Any {
        let data = try await raw(path, method: method, body: body)
        return (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) ?? [String: Any]()
    }

    static func raw(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
        guard let url = URL(string: ApiConfig.baseURL + path) else { throw ApiError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let body = body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if !(200...299).contains(code) {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let msg = (obj?["error"] as? String) ?? "Error \(code)"
            throw NSError(domain: "api", code: code, userInfo: [NSLocalizedDescriptionKey: msg])
        }
        return data
    }

    static func rows(_ any: Any) -> [JRow] {
        let arr = (any as? [[String: Any]]) ?? []
        return arr.enumerated().map { JRow(id: $0.offset, d: $0.element) }
    }
    static func dict(_ any: Any) -> JRow { JRow(id: 0, d: (any as? [String: Any]) ?? [:]) }
}

func money(_ v: Double) -> String { String(format: "%.2f", v) }

// ===================== HUB =====================
struct StaffHubView: View {
    @EnvironmentObject var session: SessionStore
    let role: String   // admin | oms | acc | docs

    var body: some View {
        List {
            if role == "admin" {
                Section("Admin") {
                    NavigationLink("User Management") { AdminUsersView() }
                    NavigationLink("Pricing & Settings") { AdminPricingView() }
                    NavigationLink("Alerts") { AdminAlertsView() }
                    NavigationLink("Performance") { AdminPerformanceView() }
                    NavigationLink("Audit Log") { AdminAuditView() }
                }
            }
            if role == "admin" || role == "oms" {
                Section("OMS") {
                    NavigationLink("Claims review") { OmsClaimsView() }
                }
            }
            if role == "admin" || role == "acc" {
                Section("Accounting") {
                    NavigationLink("Receivables") { AccReceivablesView() }
                    NavigationLink("Invoices") { AccInvoicesView() }
                    NavigationLink("Claims payout") { AccClaimsPayView() }
                    NavigationLink("Bank reconciliation") { AccReconcileView() }
                    NavigationLink("Export CSV") { AccExportView() }
                }
            }
            if role == "admin" || role == "docs" {
                Section("Docs") {
                    NavigationLink("Search records") { DocsSearchView() }
                }
            }
        }
        .navigationTitle("Tools")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// Màn gốc cho tài khoản OMS / ACC / DOCS đăng nhập bằng app
struct StaffRootView: View {
    @EnvironmentObject var session: SessionStore
    var body: some View {
        StaffHubView(role: session.staffRole)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Logout", role: .destructive) { session.logout() }
                }
            }
    }
}

// ===================== ADMIN: USERS =====================
struct AdminUsersView: View {
    @EnvironmentObject var session: SessionStore
    @State private var users: [JRow] = []
    @State private var filter = ""
    @State private var message: String?
    @State private var nUser = ""
    @State private var nName = ""
    @State private var nRole = "OMS"
    @State private var nPass = ""
    @State private var resetFor: JRow?
    @State private var resetPw = ""
    private let roles = ["CUSTOMER", "OMS", "WMS", "TMS", "ACC", "DOCS", "ADMIN"]

    private var shown: [JRow] {
        let q = filter.lowercased()
        return users.filter { q.isEmpty || "\($0.s("username")) \($0.s("full_name")) \($0.s("role"))".lowercased().contains(q) }
    }

    var body: some View {
        List {
            Section("Create account") {
                TextField("Username", text: $nUser).textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Full name", text: $nName)
                Picker("Role", selection: $nRole) { ForEach(roles, id: \.self) { Text($0).tag($0) } }
                TextField("Initial password (min 6)", text: $nPass).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button("Create") { Task { await create() } }
            }
            if let message { Section { Text(message).font(.footnote) } }
            Section {
                TextField("Filter by name, username or role", text: $filter)
                ForEach(shown) { u in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(u.s("username")).bold()
                            Text("· \(u.s("role"))").foregroundStyle(.secondary)
                            Spacer()
                            Text(u.b("active") ? "Active" : "Disabled").font(.caption).bold()
                                .foregroundStyle(u.b("active") ? Color.green : Color.gray)
                        }
                        Text(u.s("full_name")).font(.caption).foregroundStyle(.secondary)
                        HStack {
                            Button(u.b("active") ? "Disable" : "Enable") {
                                Task { await update(u, ["active": !u.b("active")]) }
                            }.buttonStyle(.bordered)
                            Button("Reset password") { resetFor = u; resetPw = "" }.buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
        .navigationTitle("User Management")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .alert("Reset password", isPresented: Binding(get: { resetFor != nil }, set: { if !$0 { resetFor = nil } })) {
            TextField("New password", text: $resetPw)
            Button("Cancel", role: .cancel) {}
            Button("Save") { Task { await doReset() } }
        } message: { Text(resetFor?.s("username") ?? "") }
    }

    private func load() async {
        do { users = JSON.rows(try await JSON.call("api/ext/admin/users")) }
        catch { message = error.localizedDescription }
    }
    private func create() async {
        do {
            _ = try await JSON.call("api/ext/admin/users", method: "POST",
                body: ["username": nUser, "full_name": nName, "role": nRole, "password": nPass, "actor": session.staffUsername])
            message = "Account created."; nUser = ""; nName = ""; nPass = ""
            await load()
        } catch { message = error.localizedDescription }
    }
    private func update(_ u: JRow, _ patch: [String: Any]) async {
        var body = patch
        body["actor"] = session.staffUsername
        do { _ = try await JSON.call("api/ext/admin/users/\(u.s("id"))", method: "PUT", body: body) }
        catch { message = error.localizedDescription }
        await load()
    }
    private func doReset() async {
        guard let u = resetFor else { return }
        do {
            _ = try await JSON.call("api/ext/admin/users/\(u.s("id"))/reset-password", method: "POST",
                body: ["new_password": resetPw, "actor": session.staffUsername])
            message = "Password reset."
        } catch { message = error.localizedDescription }
        resetFor = nil
    }
}

// ===================== ADMIN: PRICING =====================
struct AdminPricingView: View {
    @EnvironmentObject var session: SessionStore
    @State private var rates: [String: String] = [:]
    @State private var insRate = ""
    @State private var insMin = ""
    @State private var vat = ""
    @State private var overdue = ""
    @State private var message: String?

    var body: some View {
        Form {
            Section("Rates per unit (USD)") {
                ForEach(rates.keys.sorted(), id: \.self) { k in
                    HStack {
                        Text(k)
                        TextField("0", text: Binding(get: { rates[k] ?? "" }, set: { rates[k] = $0 }))
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }
            }
            Section("Settings") {
                HStack { Text("Insurance rate (0.015 = 1.5%)"); TextField("", text: $insRate).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                HStack { Text("Minimum insurance fee"); TextField("", text: $insMin).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                HStack { Text("VAT rate (0.10 = 10%)"); TextField("", text: $vat).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                HStack { Text("Overdue after (days)"); TextField("", text: $overdue).keyboardType(.numberPad).multilineTextAlignment(.trailing) }
            }
            if let message { Section { Text(message).font(.footnote) } }
            Section { Button("Save") { Task { await save() } } }
        }
        .navigationTitle("Pricing & Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        do {
            let r = JSON.dict(try await JSON.call("api/ext/pricing"))
            var m: [String: String] = [:]
            if let d = r.d["rates"] as? [String: Any] { for (k, v) in d { m[k] = "\(v)" } }
            rates = m
            insRate = r.s("insurance_rate"); insMin = r.s("insurance_min_fee")
            vat = r.s("vat_rate"); overdue = r.s("overdue_days")
        } catch { message = error.localizedDescription }
    }
    private func save() async {
        var rd: [String: Any] = [:]
        for (k, v) in rates { rd[k] = Double(v) ?? 0 }
        let body: [String: Any] = [
            "rates": rd, "insurance_rate": Double(insRate) ?? 0, "insurance_min_fee": Double(insMin) ?? 0,
            "vat_rate": Double(vat) ?? 0, "overdue_days": Int(overdue) ?? 7, "actor": session.staffUsername
        ]
        do { _ = try await JSON.call("api/ext/admin/pricing", method: "PUT", body: body); message = "Pricing saved." }
        catch { message = error.localizedDescription }
    }
}

// ===================== ADMIN: ALERTS =====================
struct AdminAlertsView: View {
    @State private var data = JRow(id: 0, d: [:])
    @State private var message: String?

    var body: some View {
        List {
            if let message { Section { Text(message).foregroundStyle(.red).font(.footnote) } }
            Section("Overdue unpaid orders") { Text("\(Int(data.n("unpaidOverdue")))") }
            Section("Orders stuck too long") {
                if data.rows("stuck").isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(data.rows("stuck")) { o in
                    Text("#\(o.s("id")) · \(o.s("customer_name")) · \(o.s("status")) · \(Int(o.n("hours")))h")
                }
            }
            Section("Claims pending over 48h") {
                if data.rows("oldClaims").isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(data.rows("oldClaims")) { c in
                    Text("Claim #\(c.s("id")) · order #\(c.s("order_id")) · \(money(c.n("claimed_amount"))) · \(Int(c.n("hours")))h")
                }
            }
            Section("Repeated failed logins (24h)") {
                if data.rows("failedLogins").isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(data.rows("failedLogins")) { f in
                    Text("\(f.s("actor")) · \(Int(f.n("attempts"))) attempts")
                }
            }
        }
        .navigationTitle("Alerts")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }
    private func load() async {
        do { data = JSON.dict(try await JSON.call("api/ext/admin/alerts")) }
        catch { message = error.localizedDescription }
    }
}

// ===================== ADMIN: PERFORMANCE =====================
struct AdminPerformanceView: View {
    @State private var days = 30
    @State private var data = JRow(id: 0, d: [:])
    @State private var message: String?

    var body: some View {
        List {
            Picker("Period", selection: $days) {
                Text("7 days").tag(7); Text("30 days").tag(30); Text("90 days").tag(90)
            }.pickerStyle(.segmented)
            if let message { Section { Text(message).foregroundStyle(.red).font(.footnote) } }
            Section("Summary") {
                Text("Total orders: \(Int(data.n("total_orders")))")
                Text("Delivered: \(rate("delivered_rate"))  ·  Cancelled: \(rate("cancelled_rate"))  ·  Returned: \(rate("returned_rate"))")
                    .font(.footnote)
            }
            Section("Average hours in each status") {
                ForEach(data.rows("per_status")) { s in
                    Text("\(s.s("status")): \(String(format: "%.1f", s.n("avg_hours")))h (\(Int(s.n("samples"))))")
                }
            }
            Section("Driver ranking") {
                ForEach(data.rows("drivers")) { d in
                    VStack(alignment: .leading) {
                        Text("\(d.s("driver")) · \(d.s("truck"))").bold()
                        Text("Delivered \(Int(d.n("delivered"))) · Rating \(d.s("avg_rating")) · Road cost \(money(d.n("road_cost")))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Performance")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: days) { await load() }
    }
    private func rate(_ k: String) -> String { data.d[k] is NSNull || data.d[k] == nil ? "—" : "\(data.n(k))%" }
    private func load() async {
        do { data = JSON.dict(try await JSON.call("api/ext/admin/performance?days=\(days)")) }
        catch { message = error.localizedDescription }
    }
}

// ===================== OMS: CLAIMS =====================
struct OmsClaimsView: View {
    @EnvironmentObject var session: SessionStore
    @State private var claims: [JRow] = []
    @State private var message: String?
    @State private var target: JRow?
    @State private var approve = true
    @State private var amount = ""
    @State private var note = ""

    var body: some View {
        List {
            if let message { Section { Text(message).font(.footnote) } }
            if claims.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
            ForEach(claims) { c in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Claim #\(c.s("id")) · order #\(c.s("order_id"))").bold()
                        Spacer()
                        Text(c.s("status")).font(.caption).bold()
                            .foregroundStyle(c.s("status") == "PENDING" ? Color.orange : Color.secondary)
                    }
                    Text("\(c.s("username")) · \(c.s("reason")) · claimed \(money(c.n("claimed_amount"))) / insured \(money(c.n("insured_value")))")
                        .font(.caption)
                    if !c.s("description").isEmpty { Text(c.s("description")).font(.caption).foregroundStyle(.secondary) }
                    if c.s("status") == "PENDING" {
                        HStack {
                            Button("Approve") { target = c; approve = true; amount = money(c.n("claimed_amount")); note = "" }
                                .buttonStyle(.borderedProminent)
                            Button("Reject") { target = c; approve = false; note = "" }
                                .buttonStyle(.bordered).tint(.red)
                        }
                    }
                }
            }
        }
        .navigationTitle("Claims review")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: Binding(get: { target != nil }, set: { if !$0 { target = nil } })) {
            NavigationStack {
                Form {
                    if approve { TextField("Approved amount", text: $amount).keyboardType(.decimalPad) }
                    TextField(approve ? "Note (optional)" : "Reason (required)", text: $note, axis: .vertical)
                    Button(approve ? "Approve claim" : "Reject claim") { Task { await decide() } }
                }
                .navigationTitle(approve ? "Approve" : "Reject")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }
    private func load() async {
        do { claims = JSON.rows(try await JSON.call("api/ext/oms/claims")) }
        catch { message = error.localizedDescription }
    }
    private func decide() async {
        guard let c = target else { return }
        var body: [String: Any] = ["decision": approve ? "approve" : "reject", "note": note, "resolved_by": session.staffUsername]
        if approve { body["approved_amount"] = Double(amount) ?? 0 }
        do {
            _ = try await JSON.call("api/ext/oms/claims/\(c.s("id"))", method: "PUT", body: body)
            message = approve ? "Claim approved." : "Claim rejected."
        } catch { message = error.localizedDescription }
        target = nil
        await load()
    }
}

// ===================== ACC: RECEIVABLES =====================
struct AccReceivablesView: View {
    @EnvironmentObject var session: SessionStore
    @State private var data = JRow(id: 0, d: [:])
    @State private var message: String?

    var body: some View {
        List {
            Section {
                Text("Total receivable: \(money(data.n("total_receivable"))) USD")
                Text("Overdue: \(money(data.n("total_overdue"))) USD").foregroundStyle(.red)
            }
            if let message { Section { Text(message).font(.footnote) } }
            Section("Customers") {
                ForEach(data.rows("customers")) { c in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(c.s("customer_name").isEmpty ? c.s("username") : c.s("customer_name")).bold()
                        Text("Owes \(money(c.n("total"))) · overdue \(money(c.n("overdue_total"))) · oldest \(Int(c.n("oldest_days")))d")
                            .font(.caption)
                        if c.n("overdue_total") > 0 && !c.s("username").isEmpty {
                            Button("Send reminder") { Task { await remind(c.s("username")) } }.buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
        .navigationTitle("Receivables")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }
    private func load() async {
        do { data = JSON.dict(try await JSON.call("api/ext/acc/receivables")) }
        catch { message = error.localizedDescription }
    }
    private func remind(_ u: String) async {
        do {
            let r = JSON.dict(try await JSON.call("api/ext/acc/receivables/remind", method: "POST",
                                                  body: ["username": u, "actor": session.staffUsername]))
            message = r.s("message")
        } catch { message = error.localizedDescription }
    }
}

// ===================== ACC: INVOICES =====================
struct AccInvoicesView: View {
    @EnvironmentObject var session: SessionStore
    @State private var invoices: [JRow] = []
    @State private var orderId = ""
    @State private var message: String?
    @State private var cancelFor: JRow?
    @State private var cancelReason = ""

    var body: some View {
        List {
            Section("Issue invoice") {
                TextField("Order ID", text: $orderId).keyboardType(.numberPad)
                Button("Issue") { Task { await issue() } }
            }
            if let message { Section { Text(message).font(.footnote) } }
            Section("Invoices") {
                ForEach(invoices) { i in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(i.s("invoice_no")).bold()
                            Spacer()
                            Text(i.s("status")).font(.caption).bold()
                                .foregroundStyle(i.s("status") == "ISSUED" ? Color.green : Color.red)
                        }
                        Text("Order #\(i.s("order_id")) · \(i.s("customer_name")) · total \(money(i.n("total"))) (VAT \(money(i.n("vat_amount"))))")
                            .font(.caption)
                        if i.s("status") == "ISSUED" {
                            HStack {
                                if let url = URL(string: ApiConfig.baseURL + "api/ext/documents/invoice-official/\(i.s("id"))") {
                                    Link("Open / print", destination: url)
                                }
                                Button("Cancel") { cancelFor = i; cancelReason = "" }.foregroundStyle(.red)
                            }.font(.caption)
                        }
                    }
                }
            }
        }
        .navigationTitle("Invoices")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .alert("Cancel invoice", isPresented: Binding(get: { cancelFor != nil }, set: { if !$0 { cancelFor = nil } })) {
            TextField("Reason", text: $cancelReason)
            Button("Back", role: .cancel) {}
            Button("Cancel invoice", role: .destructive) { Task { await doCancel() } }
        }
    }
    private func load() async {
        do { invoices = JSON.rows(try await JSON.call("api/ext/acc/invoices")) }
        catch { message = error.localizedDescription }
    }
    private func issue() async {
        guard let id = Int(orderId) else { message = "Enter a valid order ID."; return }
        do {
            let r = JSON.dict(try await JSON.call("api/ext/acc/invoices", method: "POST",
                                                  body: ["order_id": id, "issued_by": session.staffUsername]))
            message = "Issued \(r.s("invoice_no"))"; orderId = ""
            await load()
        } catch { message = error.localizedDescription }
    }
    private func doCancel() async {
        guard let i = cancelFor else { return }
        do {
            _ = try await JSON.call("api/ext/acc/invoices/\(i.s("id"))/cancel", method: "POST",
                                    body: ["reason": cancelReason, "actor": session.staffUsername])
            message = "Invoice cancelled."
        } catch { message = error.localizedDescription }
        cancelFor = nil
        await load()
    }
}

// ===================== ACC: CLAIMS PAYOUT =====================
struct AccClaimsPayView: View {
    @EnvironmentObject var session: SessionStore
    @State private var claims: [JRow] = []
    @State private var message: String?

    var body: some View {
        List {
            if let message { Section { Text(message).font(.footnote) } }
            if claims.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
            ForEach(claims) { c in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Claim #\(c.s("id")) · order #\(c.s("order_id"))").bold()
                        Spacer()
                        Text(c.s("status")).font(.caption).bold()
                            .foregroundStyle(c.s("status") == "PAID" ? Color.green : Color.blue)
                    }
                    Text("\(c.s("username")) · \(c.s("reason")) · approved \(money(c.n("approved_amount")))").font(.caption)
                    if c.s("status") == "APPROVED" {
                        Button("Mark as paid") { Task { await pay(c) } }.buttonStyle(.borderedProminent)
                    }
                }
            }
        }
        .navigationTitle("Claims payout")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }
    private func load() async {
        do { claims = JSON.rows(try await JSON.call("api/ext/acc/claims")) }
        catch { message = error.localizedDescription }
    }
    private func pay(_ c: JRow) async {
        do {
            _ = try await JSON.call("api/ext/acc/claims/\(c.s("id"))/pay", method: "PUT", body: ["username": session.staffUsername])
            message = "Marked as paid."
        } catch { message = error.localizedDescription }
        await load()
    }
}

// ===================== ACC: BANK RECONCILIATION =====================
struct AccReconcileView: View {
    @EnvironmentObject var session: SessionStore
    @State private var text = ""
    @State private var results: [JRow] = []
    @State private var message: String?

    private var matchedIds: [Int] { results.filter { $0.s("status") == "matched" }.compactMap { Int($0.s("order_id")) } }

    var body: some View {
        List {
            Section("Paste bank statement (one line per payment: date, description, amount)") {
                TextEditor(text: $text).frame(minHeight: 120).font(.system(.footnote, design: .monospaced))
                Button("Check") { Task { await check() } }
            }
            if let message { Section { Text(message).font(.footnote) } }
            if !results.isEmpty {
                Section("Results") {
                    ForEach(results) { r in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(r.s("description")) · \(money(r.n("amount")))").font(.caption)
                            Text(label(r)).font(.caption2).bold()
                                .foregroundStyle(r.s("status") == "matched" ? Color.green : Color.orange)
                        }
                    }
                    if !matchedIds.isEmpty {
                        Button("Confirm \(matchedIds.count) matched payment(s)") { Task { await confirm() } }
                            .buttonStyle(.borderedProminent)
                    }
                }
            }
        }
        .navigationTitle("Bank reconciliation")
        .navigationBarTitleDisplayMode(.inline)
    }
    private func label(_ r: JRow) -> String {
        switch r.s("status") {
        case "matched": return "✓ Matches order #\(r.s("order_id"))"
        case "no_code": return "No PKG code found"
        case "no_order": return "Order not found"
        case "already_paid": return "Order #\(r.s("order_id")) already paid"
        case "duplicate": return "Duplicate of an earlier line"
        case "amount_mismatch": return "Amount differs (expected \(money(r.n("expected"))))"
        default: return r.s("status")
        }
    }
    private func check() async {
        var rows: [[String: Any]] = []
        for line in text.split(whereSeparator: \.isNewline) {
            let p = line.split(separator: ",", omittingEmptySubsequences: false).map { String($0).trimmingCharacters(in: .whitespaces) }
            guard p.count >= 3 else { continue }
            rows.append(["date": p[0], "description": p[1..<(p.count - 1)].joined(separator: ","), "amount": p[p.count - 1]])
        }
        if rows.isEmpty { message = "No valid lines. Use: date, description, amount"; return }
        do {
            let r = JSON.dict(try await JSON.call("api/ext/acc/reconcile", method: "POST", body: ["rows": rows]))
            results = r.rows("results"); message = "\(Int(r.n("matched"))) matched."
        } catch { message = error.localizedDescription }
    }
    private func confirm() async {
        do {
            let r = JSON.dict(try await JSON.call("api/ext/acc/reconcile/confirm", method: "POST",
                                                  body: ["order_ids": matchedIds, "actor": session.staffUsername]))
            message = r.s("message"); results = []
        } catch { message = error.localizedDescription }
    }
}

// ===================== ACC: EXPORT CSV =====================
struct AccExportView: View {
    @State private var kind = "orders"
    @State private var from = ""
    @State private var to = ""
    @State private var fileURL: URL?
    @State private var showShare = false
    @State private var message: String?
    private let kinds = ["orders", "refunds", "claims", "invoices", "fleet-costs"]

    var body: some View {
        Form {
            Picker("Report", selection: $kind) { ForEach(kinds, id: \.self) { Text($0).tag($0) } }
            TextField("From (YYYY-MM-DD, optional)", text: $from).autocorrectionDisabled().textInputAutocapitalization(.never)
            TextField("To (YYYY-MM-DD, optional)", text: $to).autocorrectionDisabled().textInputAutocapitalization(.never)
            Button("Download CSV") { Task { await export() } }
            if let message { Text(message).font(.footnote).foregroundStyle(.red) }
        }
        .navigationTitle("Export CSV")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showShare) { if let u = fileURL { ShareSheet(activityItems: [u]) } }
    }
    private func export() async {
        var path = "api/ext/acc/export/\(kind)"
        var q: [String] = []
        if !from.isEmpty { q.append("from=\(from)") }
        if !to.isEmpty { q.append("to=\(to)") }
        if !q.isEmpty { path += "?" + q.joined(separator: "&") }
        do {
            let data = try await JSON.raw(path)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(kind).csv")
            try data.write(to: url)
            fileURL = url; showShare = true; message = nil
        } catch { message = error.localizedDescription }
    }
}

// ===================== DOCS: SEARCH =====================
struct DocsSearchView: View {
    @EnvironmentObject var session: SessionStore
    @State private var q = ""
    @State private var status = ""
    @State private var rows: [JRow] = []
    @State private var message: String?
    @State private var selected: JRow?

    var body: some View {
        List {
            Section {
                TextField("Search customer, product, route, truck, order #", text: $q)
                    .autocorrectionDisabled().textInputAutocapitalization(.never)
                TextField("Status (optional, e.g. DELIVERED)", text: $status)
                    .autocorrectionDisabled().textInputAutocapitalization(.never)
                Button("Search") { Task { await search() } }
            }
            if let message { Section { Text(message).font(.footnote).foregroundStyle(.red) } }
            Section {
                ForEach(rows) { o in
                    Button { selected = o } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("#\(o.s("id")) · \(o.s("product_name")) × \(o.s("quantity"))").bold()
                            Text("\(o.s("customer_name")) · \(o.s("status")) · \(o.s("current_dept")) · \(money(o.n("amount"))) USD · \(Int(o.n("files"))) file(s)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }.foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle("Search records")
        .navigationBarTitleDisplayMode(.inline)
        .task { await search() }
        .sheet(item: Binding(get: { selected.map { SelectedRow(row: $0) } }, set: { if $0 == nil { selected = nil } })) { s in
            NavigationStack { DocsOrderDetailView(order: s.row).environmentObject(session) }
        }
    }
    private func search() async {
        var items: [String] = []
        if !q.isEmpty { items.append("q=" + (q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q)) }
        if !status.isEmpty { items.append("status=" + (status.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status)) }
        let path = "api/ext/docs/search" + (items.isEmpty ? "" : "?" + items.joined(separator: "&"))
        do { rows = JSON.rows(try await JSON.call(path)); message = nil }
        catch { message = error.localizedDescription }
    }
}

struct SelectedRow: Identifiable, Equatable {
    let row: JRow
    var id: Int { row.id }
    static func == (a: SelectedRow, b: SelectedRow) -> Bool { a.row.id == b.row.id }
}

struct DocsOrderDetailView: View {
    @EnvironmentObject var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    let order: JRow
    @State private var files: [JRow] = []
    @State private var history: [JRow] = []
    @State private var reason = ""
    @State private var message: String?

    private var sealed: Bool { order.s("current_dept").uppercased() == "ARCHIVED" }

    var body: some View {
        List {
            Section("Order #\(order.s("id"))") {
                Text("\(order.s("product_name")) · \(order.s("customer_name")) · \(order.s("status"))")
                if let h = URL(string: ApiConfig.baseURL + "api/ext/documents/handover/\(order.s("id"))") { Link("Handover form", destination: h) }
                if let d = URL(string: ApiConfig.baseURL + "api/ext/documents/damage/\(order.s("id"))") { Link("Damage report", destination: d) }
            }
            if let message { Section { Text(message).font(.footnote) } }
            Section("Attached files") {
                if files.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(files) { f in
                    if let u = URL(string: ApiConfig.baseURL + String(f.s("url").dropFirst())) {
                        Link("\(f.s("doc_type")) · \(f.s("original_name"))", destination: u)
                    }
                }
            }
            Section("Seal history") {
                if history.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(history) { h in
                    Text("\(h.s("action")) · \(h.s("actor")) · \(h.s("created_at"))\(h.s("reason").isEmpty ? "" : " · " + h.s("reason"))")
                        .font(.caption)
                }
            }
            if sealed && session.staffRole == "admin" {
                Section("Reopen sealed record (Admin)") {
                    TextField("Reason (min 5 characters)", text: $reason)
                    Button("Reopen") { Task { await reopen() } }
                }
            }
        }
        .navigationTitle("Record")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } } }
        .task { await load() }
    }
    private func load() async {
        do {
            files = JSON.rows(try await JSON.call("api/ext/docs/orders/\(order.s("id"))/files"))
            history = JSON.rows(try await JSON.call("api/ext/docs/orders/\(order.s("id"))/archive-history"))
        } catch { message = error.localizedDescription }
    }
    private func reopen() async {
        do {
            _ = try await JSON.call("api/ext/admin/archive/\(order.s("id"))/reopen", method: "POST",
                                    body: ["actor": session.staffUsername, "reason": reason])
            message = "Record reopened."; reason = ""
        } catch { message = error.localizedDescription }
    }
}
