import SwiftUI

// Tương đương MainActivity.kt + activity_main.xml.
//
// GHI CHÚ QUAN TRỌNG: giống hệt bên Android (xem AndroidManifest.xml), màn hình
// này tồn tại trong code nhưng KHÔNG nằm trên luồng điều hướng thật của app -
// launcher activity thật là LoginActivity, và LoginActivity không bao giờ mở
// MainActivity. Đây là màn "chọn vai trò trực tiếp, bỏ qua đăng nhập" được giữ
// lại trong code (dead code) để đối chiếu 1:1 với bản Android. Giữ nguyên ở đây
// nhưng RootView hiện tại không có đường dẫn nào trỏ tới .mainMenu.
struct MainMenuView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        VStack(spacing: 20) {
            Text("LOGISTICS PRO")
                .font(.title).bold()

            Button("Go to Driver") {
                session.route = .driver
            }
            .buttonStyle(.borderedProminent)

            Button("Go to Warehouse") {
                session.route = .warehouse
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
