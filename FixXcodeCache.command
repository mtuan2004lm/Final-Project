#!/bin/bash
# Xóa bộ nhớ đệm Xcode (DerivedData) rồi mở lại project iOS - dùng khi Xcode báo lỗi cũ dù code đã đúng.
osascript -e 'tell application "Xcode" to quit' 2>/dev/null
sleep 2
rm -rf ~/Library/Developer/Xcode/DerivedData/LogisticAppIOS-*
echo "Đã xóa DerivedData. Đang mở lại project..."
open "$(dirname "$0")/LogisticAppIOS/LogisticAppIOS.xcodeproj"
echo "Trong Xcode: bấm Product > Clean Build Folder (Shift+Cmd+K), rồi Run (Cmd+R)."
