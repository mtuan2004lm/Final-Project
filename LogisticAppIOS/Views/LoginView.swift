import SwiftUI

// Tương đương LoginActivity.kt + activity_login.xml
struct LoginView: View {
    @EnvironmentObject var session: SessionStore

    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var alertMessage: String?

    var body: some View {
        VStack(spacing: 16) {
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

            Spacer()
        }
        .padding()
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
                switch (res.role ?? "").lowercased() {
                case "driver", "tms":
                    session.route = .driver
                case "wms":
                    session.route = .warehouse
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
