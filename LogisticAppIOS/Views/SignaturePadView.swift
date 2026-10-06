import SwiftUI

// ĐỢT 1: ô ký tên bằng ngón tay cho Proof of Delivery (người nhận ký trên màn hình tài xế).
// Dùng SwiftUI Canvas (iOS 15+) + ImageRenderer (iOS 16+) để xuất ra PNG.
struct SignaturePadView: View {
    @Binding var lines: [[CGPoint]]

    var body: some View {
        ZStack {
            Color.white
            Canvas { context, _ in
                for line in lines {
                    var path = Path()
                    guard let first = line.first else { continue }
                    path.move(to: first)
                    for p in line.dropFirst() { path.addLine(to: p) }
                    context.stroke(path, with: .color(.black),
                                   style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if value.translation == .zero {
                            lines.append([value.location])
                        } else if !lines.isEmpty {
                            lines[lines.count - 1].append(value.location)
                        }
                    }
            )
            if lines.isEmpty {
                Text("Receiver signs here")
                    .font(.caption).foregroundStyle(.secondary)
                    .allowsHitTesting(false)
            }
        }
        .frame(height: 160)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.4)))
    }

    // Xuất chữ ký thành chuỗi "data:image/png;base64,..." đúng định dạng backend/web đang hiển thị
    @MainActor
    static func dataURL(lines: [[CGPoint]], size: CGSize) -> String? {
        guard !lines.isEmpty else { return nil }
        let content = Canvas { context, _ in
            for line in lines {
                var path = Path()
                guard let first = line.first else { continue }
                path.move(to: first)
                for p in line.dropFirst() { path.addLine(to: p) }
                context.stroke(path, with: .color(.black),
                               style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size.width, height: size.height)
        .background(Color.white)

        let renderer = ImageRenderer(content: content)
        renderer.scale = 2
        guard let png = renderer.uiImage?.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }
}
