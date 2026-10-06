import SwiftUI

// ĐỢT 1: quản lý địa chỉ giao hàng (tab "Delivery Addresses" bên CustomerView.vue).
struct CustomerAddressesView: View {
    @EnvironmentObject var session: SessionStore

    @State private var addresses: [CustomerAddress] = []
    @State private var label = ""
    @State private var address = ""
    @State private var receiverName = ""
    @State private var receiverPhone = ""
    @State private var isDefault = false
    @State private var isSaving = false
    @State private var alertMessage: String?

    var body: some View {
        List {
            Section("Add new address") {
                TextField("Label (Warehouse, Shop, Home...)", text: $label)
                TextField("Full address", text: $address)
                TextField("Receiver name", text: $receiverName)
                TextField("Receiver phone", text: $receiverPhone).keyboardType(.phonePad)
                Toggle("Set as default", isOn: $isDefault)
                Button {
                    save()
                } label: {
                    if isSaving { ProgressView().frame(maxWidth: .infinity) }
                    else { Text("➕ Save Address").bold().frame(maxWidth: .infinity) }
                }
                .disabled(isSaving || label.trimmingCharacters(in: .whitespaces).isEmpty
                          || address.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            Section("Saved addresses") {
                ForEach(addresses) { a in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(a.label)\(a.is_default == true ? " ⭐" : "")").bold()
                        Text(a.address).font(.caption)
                        if let n = a.receiver_name, !n.isEmpty {
                            Text("👤 \(n) \(a.receiver_phone ?? "")")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { idx in
                    for i in idx { delete(addresses[i]) }
                }
                if addresses.isEmpty {
                    Text("No saved addresses.").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Addresses")
        .task { await load() }
        .refreshable { await load() }
        .alert("Notification", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK") { alertMessage = nil }
        } message: { Text(alertMessage ?? "") }
    }

    private func load() async {
        do { addresses = try await ApiService.shared.getAddresses(username: session.customerUsername) }
        catch { print("🔴 Error loading addresses: \(error.localizedDescription)") }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                try await ApiService.shared.addAddress(NewAddressRequest(
                    username: session.customerUsername, label: label, address: address,
                    receiver_name: receiverName, receiver_phone: receiverPhone, is_default: isDefault))
                label = ""; address = ""; receiverName = ""; receiverPhone = ""; isDefault = false
                await load()
            } catch {
                alertMessage = "Unable to save the address: \(error.localizedDescription)"
            }
            isSaving = false
        }
    }

    private func delete(_ a: CustomerAddress) {
        Task {
            do {
                try await ApiService.shared.deleteAddress(id: a.id)
                await load()
            } catch {
                alertMessage = "Unable to delete the address."
            }
        }
    }
}
