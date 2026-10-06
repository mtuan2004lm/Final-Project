import SwiftUI

// ĐỢT 1: sheet nhập lý do dùng chung cho "Cancel order" và "Request return".
struct ReasonSheet: View {
    let title: String
    let prompt: String
    let confirmLabel: String
    var onConfirm: (String) async throws -> Void
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text(prompt).font(.subheadline).bold()
                TextEditor(text: $reason)
                    .frame(height: 120)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3)))

                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(.red)
                }

                Button {
                    submit()
                } label: {
                    if isSubmitting { ProgressView().frame(maxWidth: .infinity) }
                    else { Text(confirmLabel).bold().frame(maxWidth: .infinity) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting || reason.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer()
            }
            .padding()
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { Button("Close") { dismiss() } }
            }
        }
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                try await onConfirm(reason)
                isSubmitting = false
                onDone()
                dismiss()
            } catch {
                isSubmitting = false
                errorMessage = error.localizedDescription
            }
        }
    }
}
