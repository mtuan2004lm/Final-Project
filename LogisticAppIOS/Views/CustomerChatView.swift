import SwiftUI

// ĐỢT 2: chat hỗ trợ với OMS (tương đương tab "Support Chat" trên CustomerView.vue).
// Tin nhắn được tải lại mỗi 3 giây khi màn hình đang mở.
struct CustomerChatView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var messages: [SupportMessage] = []
    @State private var input = ""
    @State private var selectedOrderId: Int?
    @State private var isSending = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if messages.isEmpty {
                            Text("No messages yet. Ask our support team anything about your orders.")
                                .font(.caption).foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.top, 60).padding(.horizontal)
                        }
                        ForEach(messages) { m in
                            bubble(m).id(m.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.last?.id) { id in
                    if let id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
                }
            }

            if let errorMessage {
                Text(errorMessage).font(.caption).foregroundStyle(.red).padding(.horizontal)
            }

            Divider()
            HStack {
                Picker("Order", selection: $selectedOrderId) {
                    Text("General question").tag(Int?.none)
                    ForEach(store.orders) { o in
                        Text("Order #\(o.id)").tag(Int?.some(o.id))
                    }
                }
                .pickerStyle(.menu)
                Spacer()
            }
            .padding(.horizontal)

            HStack(spacing: 8) {
                TextField("Type your message...", text: $input, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                Button {
                    send()
                } label: {
                    if isSending { ProgressView() } else { Image(systemName: "paperplane.fill") }
                }
                .buttonStyle(.borderedProminent)
                .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            }
            .padding()
        }
        .navigationTitle("Support Chat")
        .navigationBarTitleDisplayMode(.inline)
        // .task tự hủy khi rời màn hình -> vòng lặp tải tin mới dừng đúng lúc
        .task {
            while !Task.isCancelled {
                await loadNew()
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    @ViewBuilder
    private func bubble(_ m: SupportMessage) -> some View {
        let mine = m.sender == "CUSTOMER"
        HStack {
            if mine { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 2) {
                if let oid = m.order_id {
                    Text("Order #\(oid)").font(.caption2).bold().opacity(0.8)
                }
                Text(m.message).font(.subheadline)
                Text(store.formatDateTime(m.created_at)).font(.caption2).opacity(0.7)
            }
            .padding(10)
            .foregroundStyle(mine ? Color.white : Color.primary)
            .background(mine ? Color.blue : Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            if !mine { Spacer(minLength: 40) }
        }
    }

    private func loadNew() async {
        let user = session.customerUsername
        let lastId = messages.last?.id ?? 0
        guard let fresh = try? await ApiService.shared.getSupportMessages(username: user, after: lastId) else { return }
        if !fresh.isEmpty { messages.append(contentsOf: fresh) }
        // Đang mở màn hình chat -> coi như đã đọc tin của OMS
        if store.unreadChat > 0 || fresh.contains(where: { $0.sender == "OMS" }) {
            try? await ApiService.shared.markSupportRead(username: user)
            store.unreadChat = 0
        }
    }

    private func send() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSending = true
        errorMessage = nil
        Task {
            do {
                try await ApiService.shared.sendSupportMessage(
                    username: session.customerUsername, message: text, orderId: selectedOrderId)
                input = ""
                await loadNew()
            } catch {
                errorMessage = "Unable to send the message: \(error.localizedDescription)"
            }
            isSending = false
        }
    }
}
