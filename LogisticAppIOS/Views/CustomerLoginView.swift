import SwiftUI

// Màn đăng nhập/đăng ký dành riêng cho khách hàng (role CUSTOMER), gọi đúng 2
// route gốc của web (api/auth/login, api/auth/register) - KHÁC với LoginView
// (dùng api/auth/mobile-login, chỉ cho phép wms/tms/admin).
struct CustomerLoginView: View {
    @EnvironmentObject var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    enum Mode { case login, register }
    @State private var mode: Mode = .login

    @State private var username = ""
    @State private var password = ""
    @State private var fullName = ""

    @State private var isLoading = false
    @State private var alertMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Picker("Mode", selection: $mode) {
                    Text("Login").tag(Mode.login)
                    Text("Register").tag(Mode.register)
                }
                .pickerStyle(.segmented)
                .padding(.top)

                Text(mode == .login ? "Customer Login" : "Create a Customer Account")
                    .font(.title3).bold()

                VStack(spacing: 12) {
                    TextField("Username", text: $username)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    if mode == .register {
                        TextField("Full Name", text: $fullName)
                            .textFieldStyle(.roundedBorder)
                    }

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        mode == .login ? loginAsCustomer() : registerAsCustomer()
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text(mode == .login ? "Login" : "Register").bold().frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading)
                }
            }
            .padding()
        }
        .navigationTitle("Customer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") { dismiss() }
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

    private func loginAsCustomer() {
        let u = username.trimmingCharacters(in: .whitespaces)
        let p = password.trimmingCharacters(in: .whitespaces)
        guard !u.isEmpty, !p.isEmpty else {
            alertMessage = "Please fill in all the information!"
            return
        }

        isLoading = true
        Task {
            do {
                let res = try await ApiService.shared.customerLogin(username: u, password: p)
                isLoading = false

                // Giống AuthController.login(): không có field "success" - chỉ ném lỗi
                // HTTP 401 khi sai tài khoản/mật khẩu (ApiError.server sẽ bắt ở catch).
                let role = (res.user?.role ?? "").uppercased()
                guard role == "CUSTOMER" else {
                    alertMessage = "This account is not a customer account. Please use the main Login screen instead."
                    return
                }

                session.customerUsername = res.user?.username ?? u
                session.route = .customer
            } catch {
                isLoading = false
                alertMessage = error.localizedDescription
            }
        }
    }

    private func registerAsCustomer() {
        let u = username.trimmingCharacters(in: .whitespaces)
        let p = password.trimmingCharacters(in: .whitespaces)
        let n = fullName.trimmingCharacters(in: .whitespaces)
        guard !u.isEmpty, !p.isEmpty, !n.isEmpty else {
            alertMessage = "Please fill in all the information!"
            return
        }

        isLoading = true
        Task {
            do {
                _ = try await ApiService.shared.customerRegister(username: u, password: p, fullName: n)
                isLoading = false
                alertMessage = "Registration successful! You can now log in."
                mode = .login
                password = ""
            } catch {
                isLoading = false
                alertMessage = error.localizedDescription
            }
        }
    }
}
