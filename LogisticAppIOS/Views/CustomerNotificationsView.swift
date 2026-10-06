import SwiftUI

// ĐỢT 2: trung tâm thông báo (tương đương tab "Notifications" trên CustomerView.vue).
// Thông báo do server tự tạo mỗi khi đơn đổi trạng thái / thanh toán / trả hàng / hoàn tiền.
struct CustomerNotificationsView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    var body: some View {
        List {
            if store.notifications.isEmpty {
                Text("No notifications yet. They appear here when your orders change status.")
                    .foregroundStyle(.secondary)
            }
            ForEach(store.notifications) { n in
                Button {
                    Task { await store.markNotificationRead(n, username: session.customerUsername) }
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(n.title).font(.subheadline).bold()
                            if !n.is_read {
                                Circle().fill(Color.red).frame(width: 8, height: 8)
                            }
                        }
                        Text(n.message).font(.caption).foregroundStyle(.primary)
                        Text(store.formatDateTime(n.created_at)).font(.caption2).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .listRowBackground(n.is_read ? Color.clear : Color.orange.opacity(0.12))
            }
        }
        .navigationTitle("Notifications")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Mark all read") {
                    Task { await store.markAllNotificationsRead(username: session.customerUsername) }
                }
                .disabled(store.unreadNotifications == 0)
            }
        }
        .refreshable { await store.fetchExtras(username: session.customerUsername) }
    }
}
