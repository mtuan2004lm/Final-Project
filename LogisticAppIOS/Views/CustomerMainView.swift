import SwiftUI

// Tương đương toàn bộ CustomerView.vue. Sidebar 4 nút bên web -> đổi thành
// TabView ở cuối màn hình (chuẩn điều hướng của iOS, giống cách AdminView.swift
// đã đổi sidebar thành Picker phân đoạn).
struct CustomerMainView: View {
    @EnvironmentObject var session: SessionStore
    @StateObject private var store = CustomerStore()

    enum Tab: String, CaseIterable, Identifiable {
        case create = "Create"
        case list = "Orders"
        case history = "History"
        case payment = "Payment"
        case account = "Account"
        var id: String { rawValue }

        var icon: String {
            switch self {
            case .create: return "plus.circle"
            case .list: return "shippingbox"
            case .history: return "clock.arrow.circlepath"
            case .payment: return "creditcard"
            case .account: return "person.crop.circle"
            }
        }
    }

    @State private var tab: Tab = .create
    @State private var showNotifications = false

    var body: some View {
        VStack(spacing: 0) {
            // Giống .notification-box bên web - cảnh báo khi có đơn bị trả lại
            if let returned = store.returnedOrderNotice {
                VStack(alignment: .leading, spacing: 2) {
                    Text("⚠️ Order #\(returned.id) has been returned!")
                        .font(.caption).bold()
                        .foregroundStyle(.white)
                    Text("Reason: \(returned.driver_notes?.isEmpty == false ? returned.driver_notes! : "No specific reason provided yet.")")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.9))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Color.red.opacity(0.85))
            }

            TabView(selection: $tab) {
                CustomerCreateOrderView()
                    .tabItem { Label(Tab.create.rawValue, systemImage: Tab.create.icon) }
                    .tag(Tab.create)

                CustomerOrdersListView()
                    .tabItem { Label(Tab.list.rawValue, systemImage: Tab.list.icon) }
                    .tag(Tab.list)

                CustomerHistoryView()
                    .tabItem { Label(Tab.history.rawValue, systemImage: Tab.history.icon) }
                    .tag(Tab.history)

                CustomerPaymentView()
                    .tabItem { Label(Tab.payment.rawValue, systemImage: Tab.payment.icon) }
                    .tag(Tab.payment)

                CustomerAccountView()
                    .tabItem { Label(Tab.account.rawValue, systemImage: Tab.account.icon) }
                    .tag(Tab.account)
                    .badge(store.unreadNotifications + store.unreadChat)
            }
        }
        .environmentObject(store)
        .navigationTitle("LOGISTICS PRO")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                // Chuông thông báo + số chưa đọc, bấm mở danh sách thông báo
                Button {
                    showNotifications = true
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell")
                        if store.unreadNotifications > 0 {
                            Text("\(min(store.unreadNotifications, 99))")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(3)
                                .background(Color.red)
                                .clipShape(Circle())
                                .offset(x: 8, y: -8)
                        }
                    }
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Logout", role: .destructive) { session.logout() }
            }
        }
        .sheet(isPresented: $showNotifications) {
            NavigationStack {
                CustomerNotificationsView()
                    .toolbar {
                        ToolbarItem(placement: .navigationBarLeading) {
                            Button("Close") { showNotifications = false }
                        }
                    }
            }
            .environmentObject(store)
            .environmentObject(session)
        }
        .onAppear { store.startPolling(username: session.customerUsername) }
        .onDisappear { store.stopPolling() }
    }
}
