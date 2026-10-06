import SwiftUI
import PhotosUI

// Tương đương tab "Create New Order" trong CustomerView.vue (phần currentTab === 'create').
// MỚI so với web: web chỉ có <input type="file">, ở đây cho khách chọn rõ ràng
// giữa "Take Photo" (chụp bằng camera - CameraPicker.swift) và "Choose from Library"
// (PhotosPicker chuẩn của SwiftUI, iOS 16+).
struct CustomerCreateOrderView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var store: CustomerStore

    @State private var customerName = ""
    @State private var productName = ""
    @State private var cargoType = "Hàng hóa thông thường"
    @State private var quantity = 1

    // ĐỢT 1: địa chỉ giao hàng + lịch lấy hàng
    @State private var savedAddresses: [CustomerAddress] = []
    @State private var pickupAddress = ""
    @State private var deliveryAddress = ""
    @State private var receiverName = ""
    @State private var receiverPhone = ""
    @State private var scheduledPickup = false
    @State private var pickupDate = Date().addingTimeInterval(3600)
    @State private var pickupNote = ""

    // ĐỢT 5: mua bảo hiểm ngay khi tạo đơn
    @State private var insureOn = false
    @State private var insuredValueText = ""

    @State private var selectedImage: UIImage?
    @State private var photosPickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showImageSourceSheet = false

    @State private var isSubmitting = false
    @State private var alertMessage: String?

    // MỚI: hiện QR code mã kiện hàng ngay sau khi tạo đơn thành công
    @State private var createdOrderId: Int?

    private var estimatedPrice: Double {
        let rate = store.priceRates[cargoType] ?? 100
        return rate * Double(max(quantity, 1))
    }

    private var insuredValue: Double { Double(insuredValueText.replacingOccurrences(of: ",", with: ".")) ?? 0 }
    private var insuranceFee: Double {
        insuredValue > 0 ? ((max(store.insuranceMinFee, insuredValue * store.insuranceRate)) * 100).rounded() / 100 : 0
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // ====== BẢNG GIÁ DỊCH VỤ (giống .price-table-card bên web) ======
                VStack(alignment: .leading, spacing: 8) {
                    Text("📊 Shipping Service Price List").font(.headline)
                    Text("* Actual price = Unit price by cargo type × Number of packages")
                        .font(.caption2).italic().foregroundStyle(.secondary)

                    ForEach(store.cargoTypes, id: \.0) { key, label, price in
                        HStack {
                            Text(label).font(.subheadline)
                            Spacer()
                            Text(store.formatCurrency(price))
                                .font(.subheadline).bold()
                                .foregroundStyle(.green)
                        }
                        .padding(8)
                        .background(cargoType == key ? Color.green.opacity(0.1) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))

                // ====== FORM KHAI BÁO HÀNG HÓA ======
                VStack(alignment: .leading, spacing: 14) {
                    Text("📝 Cargo Declaration Information").font(.headline)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Customer Name / Business Partner").font(.caption).foregroundStyle(.secondary)
                        TextField("Enter company name...", text: $customerName)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Product Name to Ship").font(.caption).foregroundStyle(.secondary)
                        TextField("E.g.: Wooden crate of components...", text: $productName)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Cargo Category").font(.caption).foregroundStyle(.secondary)
                        Picker("Cargo Category", selection: $cargoType) {
                            ForEach(store.cargoTypes, id: \.0) { key, label, _ in
                                Text(label).tag(key)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    Stepper("Number of Packages: \(quantity)", value: $quantity, in: 1...9999)

                    // ====== ĐỊA CHỈ GIAO HÀNG + LỊCH LẤY HÀNG ======
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Pickup Address (where we collect the goods)").font(.caption).foregroundStyle(.secondary)
                        TextField("Enter pickup address...", text: $pickupAddress)
                            .textFieldStyle(.roundedBorder)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Delivery Address (where we deliver)").font(.caption).foregroundStyle(.secondary)
                        if !savedAddresses.isEmpty {
                            Menu {
                                ForEach(savedAddresses) { a in
                                    Button("\(a.label) - \(a.address)") {
                                        deliveryAddress = a.address
                                        receiverName = a.receiver_name ?? ""
                                        receiverPhone = a.receiver_phone ?? ""
                                    }
                                }
                            } label: {
                                Label("Choose a saved address", systemImage: "mappin.and.ellipse")
                            }
                        }
                        TextField("Enter delivery address...", text: $deliveryAddress)
                            .textFieldStyle(.roundedBorder)
                        TextField("Receiver name", text: $receiverName)
                            .textFieldStyle(.roundedBorder)
                        TextField("Receiver phone", text: $receiverPhone)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.phonePad)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Toggle("Schedule a pickup", isOn: $scheduledPickup)
                        if scheduledPickup {
                            DatePicker("Pickup time", selection: $pickupDate, in: Date()...)
                            TextField("Pickup note (e.g. call before arriving)", text: $pickupNote)
                                .textFieldStyle(.roundedBorder)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Actual Cargo Image").font(.caption).foregroundStyle(.secondary)

                        if let image = selectedImage {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFit()
                                .frame(maxHeight: 180)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }

                        Button {
                            showImageSourceSheet = true
                        } label: {
                            Label(selectedImage == nil ? "Add Cargo Image" : "Change Image", systemImage: "camera")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Toggle("🛡️ Insure this shipment", isOn: $insureOn)
                        if insureOn {
                            TextField("Declared value (USD)", text: $insuredValueText)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                            if insuredValue > 0 {
                                Text("Insurance fee: \(store.formatCurrency(insuranceFee)) · you can claim up to \(store.formatCurrency(insuredValue))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(10)
                    .background(Color.blue.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    HStack {
                        Text("Estimated shipping cost:")
                        Spacer()
                        Text(store.formatCurrency(estimatedPrice + (insureOn ? insuranceFee : 0)))
                            .font(.headline)
                            .foregroundStyle(.orange)
                    }
                    .padding()
                    .background(Color.yellow.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("🚀 Submit Request").bold().frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSubmitting)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .padding()
        }
        .confirmationDialog("Add Cargo Image", isPresented: $showImageSourceSheet, titleVisibility: .visible) {
            Button("Take Photo") {
                // Simulator không có camera thật - báo rõ cho người dùng thay vì để
                // CameraPicker âm thầm chuyển sang thư viện ảnh (dễ gây hiểu lầm là lỗi).
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    showCamera = true
                } else {
                    alertMessage = "This device/simulator has no camera available. Please use \"Choose from Library\" instead, or test on a real iPhone."
                }
            }
            Button("Choose from Library") {
                // PhotosPicker tự mở qua photosPicker modifier bên dưới khi item được set nil->item,
                // nên ta chỉ cần trigger bằng 1 biến riêng - xem showPhotoPicker bên dưới.
                showPhotoPickerTrigger = true
            }
            Button("Cancel", role: .cancel) {}
        }
        .task {
            if let list = try? await ApiService.shared.getAddresses(username: session.customerUsername) {
                savedAddresses = list
            }
        }
        .photosPicker(isPresented: $showPhotoPickerTrigger, selection: $photosPickerItem, matching: .images)
        .onChange(of: photosPickerItem) { newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    selectedImage = uiImage
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                selectedImage = image
            }
            .ignoresSafeArea()
        }
        .alert("Notification", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
        .sheet(isPresented: Binding(
            get: { createdOrderId != nil },
            set: { if !$0 { createdOrderId = nil } }
        )) {
            if let id = createdOrderId {
                OrderQRCodeView(orderId: id)
            }
        }
    }

    // State phụ để trigger PhotosPicker từ confirmationDialog (không thể mở trực tiếp
    // PhotosPicker từ 1 Button action, cần qua modifier .photosPicker(isPresented:)).
    @State private var showPhotoPickerTrigger = false

    private func submit() {
        guard !customerName.trimmingCharacters(in: .whitespaces).isEmpty,
              !productName.trimmingCharacters(in: .whitespaces).isEmpty else {
            alertMessage = "Please fill in all the information!"
            return
        }
        guard !pickupAddress.trimmingCharacters(in: .whitespaces).isEmpty else {
            alertMessage = "Please enter the pickup address!"
            return
        }
        guard !deliveryAddress.trimmingCharacters(in: .whitespaces).isEmpty else {
            alertMessage = "Please enter the delivery address!"
            return
        }
        if insureOn && insuredValue <= 0 {
            alertMessage = "Please enter the declared value of the goods, or turn off the insurance option."
            return
        }
        guard let image = selectedImage, let imageData = image.jpegData(compressionQuality: 0.8) else {
            alertMessage = "⚠️ Please upload an actual image of the cargo to create the yard declaration!"
            return
        }

        isSubmitting = true
        Task {
            do {
                let res = try await ApiService.shared.createCustomerOrder(
                    username: session.customerUsername,
                    customerName: customerName,
                    productName: productName,
                    cargoType: cargoType,
                    quantity: quantity,
                    totalPrice: estimatedPrice,
                    imageData: imageData
                )
                isSubmitting = false

                // ĐỢT 1: gắn địa chỉ giao + lịch lấy hàng vào đơn vừa tạo
                if let newId = res.order?.id {
                    let iso = ISO8601DateFormatter()
                    try? await ApiService.shared.setDeliveryInfo(
                        orderId: newId,
                        body: DeliveryInfoRequest(
                            pickup_address: pickupAddress,
                            delivery_address: deliveryAddress,
                            receiver_name: receiverName,
                            receiver_phone: receiverPhone,
                            pickup_date: scheduledPickup ? iso.string(from: pickupDate) : nil,
                            pickup_note: scheduledPickup ? pickupNote : ""
                        )
                    )
                }
                // ĐỢT 5: mua bảo hiểm cho đơn vừa tạo
                var insuranceNote: String?
                if insureOn, let newId = res.order?.id {
                    do {
                        try await ApiService.shared.buyInsurance(orderId: newId, username: session.customerUsername, declaredValue: insuredValue)
                    } catch {
                        insuranceNote = friendlyError(error) + " - the order was created without insurance. You can buy it later in Account → Insurance & Claims."
                    }
                }
                insureOn = false
                insuredValueText = ""
                pickupAddress = ""
                deliveryAddress = ""
                receiverName = ""
                receiverPhone = ""
                scheduledPickup = false
                pickupNote = ""

                customerName = ""
                productName = ""
                cargoType = "Hàng hóa thông thường"
                quantity = 1
                selectedImage = nil

                await store.fetchOrders(username: session.customerUsername)

                // MỚI: mở popup QR code nếu lấy được id đơn vừa tạo; nếu vì lý do gì đó
                // không có id (server trả thiếu), vẫn báo thành công như cũ để không chặn luồng.
                if let note = insuranceNote {
                    alertMessage = note
                }
                if let newId = res.order?.id {
                    createdOrderId = newId
                } else {
                    alertMessage = "🚀 Consignment request created successfully!"
                }
            } catch {
                isSubmitting = false
                alertMessage = "Error submitting the order to the system: \(error.localizedDescription)"
            }
        }
    }
}
