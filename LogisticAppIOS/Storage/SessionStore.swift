import Foundation
import Combine

// Tương đương việc điều hướng bằng Intent/startActivity/finish() giữa các Activity
// bên Android. Vì SwiftUI dùng cây View khai báo thay vì chồng Activity, ta dùng
// 1 state "route" làm nguồn sự thật duy nhất cho RootView quyết định hiển thị màn nào.
enum AppRoute {
    case login
    case mainMenu   // Tương đương MainActivity - KHÔNG được LoginActivity trỏ tới trên Android
                    // (xem AndroidManifest.xml: launcher thật là LoginActivity), giữ lại cho đối chiếu.
    case warehouse
    case driver
}

// Tương đương SharedPreferences("driver_prefs", MODE_PRIVATE) trong DriverActivity.kt
// (lưu driver_name / truck_plate để khỏi phải gõ lại mỗi lần mở app).
final class SessionStore: ObservableObject {
    @Published var route: AppRoute = .login

    private let defaults = UserDefaults.standard
    private let keyDriverName = "driver_name"
    private let keyTruckPlate = "truck_plate"

    var driverName: String {
        get { defaults.string(forKey: keyDriverName) ?? "" }
        set { defaults.set(newValue, forKey: keyDriverName) }
    }

    var truckPlate: String {
        get { defaults.string(forKey: keyTruckPlate) ?? "" }
        set { defaults.set(newValue, forKey: keyTruckPlate) }
    }

    private func clearDriverPrefs() {
        defaults.removeObject(forKey: keyDriverName)
        defaults.removeObject(forKey: keyTruckPlate)
    }

    // Giống performLogout() trong DriverActivity.kt / btnLogout trong WarehouseActivity.kt:
    // tắt GPS đang chạy ngầm (nếu có), xóa prefs, rồi quay về Login (tương đương
    // FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK - xóa sạch back stack).
    func logout() {
        LocationManager.shared.stopTracking()
        clearDriverPrefs()
        route = .login
    }
}
