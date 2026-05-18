const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes'); // <--- Thêm dòng này nếu chưa có
const orderRoutes = require('./routes/orderRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Nạp các tuyến đường API công việc
app.use('/api/auth', authRoutes);   // <--- Khai báo để xử lý login/register
app.use('/api/orders', orderRoutes); // Xử lý đơn hàng các phòng ban

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});