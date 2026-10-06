import SwiftUI

// ĐỢT 2: tab "Account" gom các chức năng phụ để thanh tab dưới không bị quá nhiều nút:
// Thông báo, Chat hỗ trợ, Dashboard, Địa chỉ giao hàng.
// LƯU Ý: màn hình được đẩy bằng NavigationLink KHÔNG tự thừa hưởng environmentObject đặt bên trong
// NavigationStack, nên phải truyền store/session tường minh cho từng màn hình đích (nếu không app sẽ crash
// với lỗi "No ObservableObject of type CustomerStore found").
struct CustomerAccountView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore
    @EnvironmentObject var language: AppLanguage

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.fill").font(.largeTitle).foregroundStyle(.blue)
                    VStack(alignment: .leading) {
                        Text(session.customerUsername).font(.headline)
                        Text("Customer account").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }

            Section {
                NavigationLink {
                    CustomerNotificationsView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("Notifications", icon: "bell", badge: store.unreadNotifications)
                }
                NavigationLink {
                    CustomerChatView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("Support Chat", icon: "bubble.left.and.bubble.right", badge: store.unreadChat)
                }
                NavigationLink {
                    CustomerDashboardView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("My Dashboard", icon: "chart.bar")
                }
                NavigationLink {
                    CustomerAddressesView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("Delivery Addresses", icon: "mappin.and.ellipse")
                }
                NavigationLink {
                    CustomerClaimsView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("Insurance & Claims", icon: "shield.lefthalf.filled")
                }
                NavigationLink {
                    CustomerBulkImportView()
                        .environmentObject(store)
                        .environmentObject(session)
                } label: {
                    row("Bulk Import (CSV)", icon: "square.and.arrow.down.on.square")
                }
            }
        }
        .navigationTitle("Account")
        .safeAreaInset(edge: .bottom) {
            LanguagePicker().padding(.horizontal).padding(.vertical, 8).background(.bar)
        }
    }

    private func row(_ title: String, icon: String, badge: Int = 0) -> some View {
        HStack {
            Label(LocalizedStringKey(title), systemImage: icon)
            Spacer()
            if badge > 0 {
                Text("\(badge)")
                    .font(.caption2).bold().foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Color.red).clipShape(Capsule())
            }
        }
    }
}
