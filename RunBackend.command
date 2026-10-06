#!/bin/bash
# Chạy backend (cổng 3000). Giữ cửa sổ này mở khi dùng web / app.
cd "$(dirname "$0")/back-end" && node index.js
