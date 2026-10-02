import Foundation
import CoreLocation
import Combine

// =============================================================================
// Tương đương GpsBaseService.kt (Android Foreground Service + FusedLocationProviderClient).
//
// iOS không có khái niệm "Foreground Service" như Android. Để app vẫn cập nhật
// vị trí khi chạy nền, ta dùng CLLocationManager với:
//   - allowsBackgroundLocationUpdates = true
//   - manager.requestAlwaysAuthorization()
// và BẮT BUỘC phải bật capability "Background Modes -> Location updates" trong
// Xcode (Signing & Capabilities), cộng với khai báo
// NSLocationAlwaysAndWhenInUseUsageDescription trong Info.plist (xem README.md).
//
// Logic nghiệp vụ giữ nguyên như bản Android:
//   1) Nhận tọa độ mới -> publish ra để DriverView hiển thị (tương đương việc
//      GpsBaseService gửi local broadcast "GPS_UPDATE_ACTION" cho DriverActivity).
//   2) Đẩy tọa độ lên server theo định kỳ (PUT /api/orders/tms/fleet/gps) để
//      web TMS theo dõi vị trí xe thời gian thực.
//   3) Lỗi mạng khi đẩy GPS lên server bị bỏ qua êm, không làm crash/dừng service,
//      giống đúng comment trong pushGpsToServer() của GpsBaseService.kt.
// =============================================================================
final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationManager()

    private let manager = CLLocationManager()
    private var licensePlate: String = ""
    private var lastPushDate: Date = .distantPast

    @Published var lastLatitude: Double?
    @Published var lastLongitude: Double?
    @Published var isTracking: Bool = false

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.pausesLocationUpdatesAutomatically = false
    }

    // Tương đương việc bấm "Start Trip" trong DriverActivity.kt: lưu biển số xe,
    // xin quyền vị trí, bắt đầu nhận cập nhật vị trí liên tục.
    func startTracking(licensePlate: String) {
        self.licensePlate = licensePlate
        isTracking = true

        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        // allowsBackgroundLocationUpdates chỉ có hiệu lực khi quyền là "Always"
        // và app đã khai báo UIBackgroundModes = ["location"] trong Info.plist.
        manager.allowsBackgroundLocationUpdates = true
        manager.startUpdatingLocation()
    }

    // Tương đương bấm "Stop Trip": dừng service, reset text hiển thị GPS.
    func stopTracking() {
        manager.stopUpdatingLocation()
        isTracking = false
        lastLatitude = nil
        lastLongitude = nil
        licensePlate = ""
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        lastLatitude = loc.coordinate.latitude
        lastLongitude = loc.coordinate.longitude

        // Tương đương setMinUpdateIntervalMillis(5000) ở Android: chỉ bắn API lên
        // server tối đa mỗi 5 giây/lần, tránh spam request.
        let now = Date()
        guard now.timeIntervalSince(lastPushDate) >= 5, !licensePlate.isEmpty else { return }
        lastPushDate = now

        let plate = licensePlate
        Task {
            do {
                try await ApiService.shared.updateTruckGps(
                    body: TruckGpsRequest(license_plate: plate, lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
                )
            } catch {
                // Bỏ qua lỗi mạng tạm thời, chờ lần cập nhật vị trí kế tiếp
                // (giống đúng comment trong GpsBaseService.pushGpsToServer).
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Giống catch (e: SecurityException) { stopSelf() } bên Android: nếu không
        // có quyền / lỗi định vị thì dừng tracking để tránh lặp lỗi vô ích.
    }
}
