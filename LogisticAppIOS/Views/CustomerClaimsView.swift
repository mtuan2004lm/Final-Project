import SwiftUI

// ĐỢT 4: bảo hiểm hàng hóa + yêu cầu bồi thường (giống tab "Insurance & Claims" bên web).
struct CustomerClaimsView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var claims: [ClaimItem] = []
    @State private var declared: [Int: String] = [:]
    @State private var claimOrder: CustomerOrder?
    @State private var message: String?

    private let reasons = ["Damaged", "Lost", "Delayed", "Other"]

    private var orders: [CustomerOrder] {
        store.orders.filter { !["CANCELLED", "RETURNED"].contains(($0.status ?? "").uppercased()) }
    }
    private var openClaimOrderIds: Set<Int> {
        Set(claims.filter { $0.status == "PENDING" || $0.status == "APPROVED" }.map { $0.order_id })
    }

    var body: some View {
        List {
            Section {
                Text("Insure an order before it is delivered. If something goes wrong you can file a claim up to the insured value.")
                    .font(.footnote).foregroundStyle(.secondary)
            }

            Section("My orders") {
                if orders.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(orders) { o in orderRow(o) }
            }

            Section("My claims") {
                if claims.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary) }
                ForEach(claims) { c in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text("Order #\(c.order_id) · \(c.reason)").font(.subheadline).bold()
                            Spacer()
                            Text(LocalizedStringKey(statusLabel(c.status))).font(.caption).bold().foregroundStyle(statusColor(c.status))
                        }
                        if let d = c.description, !d.isEmpty { Text(d).font(.caption).foregroundStyle(.secondary) }
                        Text(claimSummary(c)).font(.caption)
                        if let n = c.resolver_note, !n.isEmpty { Text("📝 \(n)").font(.caption2).foregroundStyle(.secondary) }
                    }
                }
            }

            if let message { Section { Text(LocalizedStringKey(message)).font(.footnote) } }
        }
        .navigationTitle("Insurance & Claims")
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $claimOrder) { o in
            NavigationStack {
                ClaimFormView(order: o, reasons: reasons) { msg in
                    claimOrder = nil
                    message = msg
                    Task { await load() }
                }
                .environmentObject(session)
            }
        }
    }

    @ViewBuilder
    private func orderRow(_ o: CustomerOrder) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("#\(o.id) · \(o.product_name ?? "")").font(.subheadline).bold()
                Spacer()
                if o.insured == true {
                    Text("🛡️ Insured · \(o.insured_value ?? 0, specifier: "%.2f")").font(.caption).foregroundStyle(.green)
                } else {
                    Text("Not insured").font(.caption).foregroundStyle(.orange)
                }
            }
            let status = (o.status ?? "").uppercased()

            if o.insured != true && !["DELIVERED", "DONE"].contains(status) {
                HStack {
                    TextField("Declared value (USD)", text: Binding(
                        get: { declared[o.id] ?? "" }, set: { declared[o.id] = $0 }))
                        .keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
                    Button("Buy insurance") { Task { await buy(o) } }
                        .buttonStyle(.borderedProminent)
                        .disabled((Double(declared[o.id] ?? "") ?? 0) <= 0)
                }
                if let v = Double(declared[o.id] ?? ""), v > 0 {
                    Text("Fee: \(String(format: "%.2f", max(1, (v * 1.5).rounded() / 100))) USD (1.5%, minimum 1 USD)")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            if o.insured == true && status != "PENDING" && !openClaimOrderIds.contains(o.id) {
                Button("⚠️ File a claim") { claimOrder = o }.font(.subheadline)
            }
        }
        .padding(.vertical, 2)
    }

    private func claimSummary(_ c: ClaimItem) -> String {
        var text = "Claimed " + String(format: "%.2f", c.claimed_amount)
        if let a = c.approved_amount { text += " · Approved " + String(format: "%.2f", a) }
        return text
    }

    private func statusLabel(_ s: String) -> String {
        switch s {
        case "PENDING": return "Pending review"
        case "APPROVED": return "Approved - awaiting payment"
        case "REJECTED": return "Rejected"
        case "PAID": return "Paid"
        default: return s
        }
    }
    private func statusColor(_ s: String) -> Color {
        switch s { case "PAID": return .green; case "APPROVED": return .blue; case "REJECTED": return .red; default: return .orange }
    }

    private func load() async {
        await store.fetchOrders(username: session.customerUsername)
        do { claims = try await ApiService.shared.getClaims(username: session.customerUsername) }
        catch { message = friendlyError(error) }
    }

    private func buy(_ o: CustomerOrder) async {
        guard let v = Double(declared[o.id] ?? ""), v > 0 else { return }
        do {
            try await ApiService.shared.buyInsurance(orderId: o.id, username: session.customerUsername, declaredValue: v)
            declared[o.id] = nil
            message = "Insurance added."
            await load()
        } catch { message = friendlyError(error) }
    }
}

// Form gửi yêu cầu bồi thường cho 1 đơn
struct ClaimFormView: View {
    @EnvironmentObject var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    let order: CustomerOrder
    let reasons: [String]
    var onDone: (String) -> Void

    @State private var reason = "Damaged"
    @State private var descriptionText = ""
    @State private var amount = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section("Order #\(order.id)") {
                Picker("Problem", selection: $reason) {
                    ForEach(reasons, id: \.self) { Text(LocalizedStringKey($0)).tag($0) }
                }
                TextField("Describe what happened...", text: $descriptionText, axis: .vertical).lineLimit(3...6)
                TextField("Claim amount (USD)", text: $amount).keyboardType(.decimalPad)
                Text("Maximum: \(order.insured_value ?? 0, specifier: "%.2f")").font(.caption).foregroundStyle(.secondary)
            }
            if let error { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
            Section {
                Button {
                    Task { await send() }
                } label: { Text("Send claim").bold().frame(maxWidth: .infinity) }
                .disabled(busy || (Double(amount) ?? 0) <= 0 || descriptionText.trimmingCharacters(in: .whitespaces).count < 5)
            }
        }
        .navigationTitle("File a claim")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .navigationBarLeading) { Button("Cancel") { dismiss() } } }
    }

    private func send() async {
        busy = true; error = nil; defer { busy = false }
        do {
            try await ApiService.shared.createClaim(NewClaimRequest(
                username: session.customerUsername, order_id: order.id, reason: reason,
                description: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines), claimed_amount: Double(amount) ?? 0))
            onDone("Claim submitted.")
        } catch { self.error = friendlyError(error) }
    }
}
