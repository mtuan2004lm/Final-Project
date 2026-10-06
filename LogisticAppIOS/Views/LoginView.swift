import SwiftUI

// Tương đương LoginActivity.kt + activity_login.xml
struct LoginView: View {
    @EnvironmentObject var session: SessionStore

    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var alertMessage: String?

    // MỚI: điều hướng sang màn đăng nhập/đăng ký riêng của khách hàng
    // (CustomerLoginView) - tài khoản khách hàng KHÔNG dùng được form này vì
    // /api/auth/mobile-login chặn role customer, xem CustomerLoginView.swift.
    @State private var showCustomerLogin = false
    @State private var showForgot = false   // ĐỢT 4

    var body: some View {
        VStack(spacing: 16) {
            LanguagePicker()
            Spacer()

            Text("LOGISTICS PRO")
                .font(.largeTitle).bold()
            Text("Mobile App - Warehouse & Driver")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("Username", text: $username)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)

                Button {
                    login()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Login").bold().frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)
            }
            .padding(.top, 24)

            Button("Forgot password?") { showForgot = true }
                .font(.footnote)

            Divider().padding(.vertical, 8)

            VStack(spacing: 8) {
                Text("Are you a customer?")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Customer Login / Register") {
                    showCustomerLogin = true
                }
                .font(.subheadline).bold()
            }

            Spacer()
        }
        .padding()
        .sheet(isPresented: $showForgot) {
            NavigationStack { ForgotPasswordView() }
        }
        .sheet(isPresented: $showCustomerLogin) {
            NavigationStack {
                CustomerLoginView()
            }
        }
        .alert("Notification", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    // Giống hành vi btnLogin.setOnClickListener trong LoginActivity.kt:
    // validate rỗng -> gọi API /api/auth/mobile-login -> điều hướng theo role.
    private func login() {
        let u = username.trimmingCharacters(in: .whitespaces)
        let p = password.trimmingCharacters(in: .whitespaces)

        guard !u.isEmpty, !p.isEmpty else {
            alertMessage = "Please fill in all the information!"
            return
        }

        isLoading = true
        Task {
            do {
                let res = try await ApiService.shared.login(username: u, password: p)
                isLoading = false

                guard res.success else {
                    alertMessage = res.message.isEmpty ? "Incorrect username or password!" : res.message
                    return
                }

                // "tms": tài khoản phòng TMS dùng chung cho cả điều phối lẫn tài xế
                // -> đăng nhập mobile mở màn tài xế.
                // "driver": giữ lại phòng trường hợp sau này tách riêng role tài xế khỏi "tms".
                session.staffUsername = u
                session.staffRole = (res.role ?? "").lowercased()
                switch (res.role ?? "").lowercased() {
                case "driver", "tms":
                    session.route = .driver
                case "wms":
                    session.route = .warehouse
                case "admin":
                    // MỚI: tài khoản quản trị -> mở màn Admin (tổng quan toàn hệ thống,
                    // giống AdminView.vue bên web).
                    session.route = .admin
                case "oms", "acc", "docs":
                    session.route = .staff
                default:
                    alertMessage = "This account does not have access to the Mobile app!"
                }
            } catch {
                isLoading = false
                alertMessage = error.localizedDescription
            }
        }
    }
}
