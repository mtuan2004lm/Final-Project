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
    case admin   // MỚI: dành cho tài khoản role "admin" - xem AdminView.swift
    case staff   // OMS / ACC / DOCS: công cụ nhân viên (StaffToolsView.swift)
    case customer   // MỚI: dành cho khách hàng - xem CustomerMainView.swift
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

    // MỚI: lưu username khách hàng đang đăng nhập, tương đương
    // localStorage.getItem('username') bên CustomerView.vue.
    // Tài khoản nhân viên (Admin/OMS/ACC/DOCS) đang đăng nhập: dùng làm "actor" khi gọi API quản trị.
    var staffUsername: String {
        get { defaults.string(forKey: "staff_username") ?? "" }
        set { defaults.set(newValue, forKey: "staff_username") }
    }
    var staffRole: String {
        get { defaults.string(forKey: "staff_role") ?? "" }
        set { defaults.set(newValue, forKey: "staff_role") }
    }

    private let keyCustomerUsername = "customer_username"

    var customerUsername: String {
        get { defaults.string(forKey: keyCustomerUsername) ?? "" }
        set { defaults.set(newValue, forKey: keyCustomerUsername) }
    }

    // Giống performLogout() trong DriverActivity.kt / btnLogout trong WarehouseActivity.kt:
    // tắt GPS đang chạy ngầm (nếu có), xóa prefs, rồi quay về Login (tương đương
    // FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK - xóa sạch back stack).
    func logout() {
        LocationManager.shared.stopTracking()
        clearDriverPrefs()
        defaults.removeObject(forKey: keyCustomerUsername)
        defaults.removeObject(forKey: "staff_username")
        defaults.removeObject(forKey: "staff_role")
        route = .login
    }
}
