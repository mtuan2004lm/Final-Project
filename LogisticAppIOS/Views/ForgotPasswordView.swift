import SwiftUI

// ĐỢT 4: quên mật khẩu - 3 bước: nhập tài khoản -> nhập mã OTP 6 số -> đặt mật khẩu mới.
struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss

    enum Step { case username, otp, newPassword, done }

    @State private var step: Step = .username
    @State private var username = ""
    @State private var otp = ""
    @State private var password1 = ""
    @State private var password2 = ""
    @State private var resetToken = ""
    @State private var devOtp: String?
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        Form {
            switch step {
            case .username:
                Section {
                    Text("Enter your username and we will send a 6-digit code.").font(.footnote)
                    TextField("Username", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Send code") { Task { await sendCode() } }.disabled(busy || username.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            case .otp:
                Section {
                    Text("Enter the 6-digit code (valid for 10 minutes).").font(.footnote)
                    if let devOtp {
                        Text("Test mode code: \(devOtp)").font(.footnote).bold().foregroundStyle(.orange)
                    }
                    TextField("6-digit code", text: $otp).keyboardType(.numberPad)
                    Button("Verify") { Task { await verify() } }.disabled(busy || otp.count != 6)
                    Button("Send a new code") { Task { await sendCode() } }.disabled(busy)
                }
            case .newPassword:
                Section {
                    Text("Choose a new password.").font(.footnote)
                    SecureField("New password (min 6 characters)", text: $password1)
                    SecureField("Confirm new password", text: $password2)
                    Button("Change password") { Task { await reset() } }.disabled(busy || password1.count < 6)
                }
            case .done:
                Section {
                    Label("Password changed. You can now sign in.", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Button("Back to login") { dismiss() }
                }
            }

            if let message {
                Section { Text(LocalizedStringKey(message)).foregroundStyle(.red).font(.footnote) }
            }
        }
        .navigationTitle("Reset Password")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } }
        }
    }

    private func sendCode() async {
        busy = true; message = nil; defer { busy = false }
        do {
            let r = try await ApiService.shared.forgotPassword(username: username.trimmingCharacters(in: .whitespaces))
            devOtp = r.dev_otp
            otp = ""
            step = .otp
        } catch { message = friendlyError(error) }
    }

    private func verify() async {
        busy = true; message = nil; defer { busy = false }
        do {
            let r = try await ApiService.shared.verifyOtp(username: username.trimmingCharacters(in: .whitespaces), otp: otp)
            resetToken = r.reset_token
            step = .newPassword
        } catch { message = friendlyError(error) }
    }

    private func reset() async {
        guard password1 == password2 else { message = "Passwords do not match."; return }
        busy = true; message = nil; defer { busy = false }
        do {
            try await ApiService.shared.resetPassword(username: username.trimmingCharacters(in: .whitespaces), token: resetToken, newPassword: password1)
            step = .done
        } catch { message = friendlyError(error) }
    }
}
