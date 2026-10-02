import SwiftUI

// Tương đương AndroidManifest.xml (khai báo app) + điểm khởi chạy launcher activity.
@main
struct LogisticsAppiOSApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

// Tương đương việc LoginActivity là launcher activity (android.intent.action.MAIN)
// trong AndroidManifest.xml - app luôn mở ra màn Login đầu tiên, rồi điều hướng
// sang Warehouse hoặc Driver tùy role trả về từ backend.
struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        switch session.route {
        case .login:
            LoginView()
        case .mainMenu:
            MainMenuView()
        case .warehouse:
            NavigationStack {
                WarehouseView()
            }
        case .driver:
            NavigationStack {
                DriverView()
            }
        }
    }
}
