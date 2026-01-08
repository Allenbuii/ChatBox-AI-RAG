# RAG Document Q&A System

Một hệ thống hỏi đáp dựa trên tài liệu (RAG - Retrieval-Augmented Generation) thông minh, hỗ trợ tải lên và trích xuất thông tin từ các định dạng file TXT, MD, PDF và URL trang web.

Dự án này bao gồm:
- **Backend**: Python (FastAPI, LangChain, SQLite, OpenAI)
- **Frontend**: Node.js (React, Vite, Tailwind CSS)

## Yêu cầu

Trước khi cài đặt, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Python** (phiên bản 3.10 trở lên)
- **Node.js** (phiên bản 18 trở lên) & **npm**
- **OpenAI API Key**: Cần thiết để sử dụng các mô hình embedding và chat của OpenAI.

## Hướng dẫn Cài đặt

### Bước 1: Setup Backend

1. Di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```

2. (Khuyến nghị) Tạo và kích hoạt môi trường ảo (Virtual Environment):
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Cài đặt các thư viện phụ thuộc:
   ```bash
   pip install -r requirements.txt
   ```

4. Cấu hình biến môi trường:
   - Tạo file `.env` trong thư mục `backend`.
   - Thêm API Key của bạn vào file `.env`:
     ```env
     OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
     ```
   *(Lưu ý: Thay `sk-proj-...` bằng API Key thực của bạn)*

### Bước 2: Setup Frontend

1. Di chuyển vào thư mục `frontend` (từ thư mục gốc của dự án):
   ```bash
   cd ../frontend
   ```

2. Cài đặt các thư viện Node.js:
   ```bash
   npm install
   ```

## Hướng dẫn Chạy Ứng dụng

Bạn cần chạy cả Backend và Frontend song song (trên 2 cửa sổ terminal khác nhau).

### 1. Khởi chạy Backend
Tại terminal của thư mục `backend` (đã kích hoạt venv):
```bash
python server.py
```
Backend sẽ khởi chạy tại: `http://localhost:8000`
(*API Docs có sẵn tại: http://localhost:8000/docs*)

### 2. Khởi chạy Frontend
Tại terminal của thư mục `frontend`:
```bash
npm run dev
```
Frontend sẽ khởi chạy tại: `http://localhost:5173` (hoặc cổng khác nếu 5173 đang bận).

## Hướng dẫn Sử dụng

1. Mở trình duyệt và truy cập địa chỉ Frontend (ví dụ: `http://localhost:5173`).
2. **Đăng ký / Đăng nhập**: Tạo tài khoản mới để bắt đầu phiên làm việc.
3. **Upload Tài liệu**:
   - Chọn tab Upload.
   - Kéo thả file (PDF, TXT, MD) hoặc dán URL trang web cần đọc.
   - Nhấn "Upload" và đợi hệ thống xử lý.
4. **Hỏi đáp**:
   - Nhập câu hỏi vào khung chat.
   - Hệ thống sẽ trả lời dựa trên nội dung tài liệu bạn đã tải lên.
   - Bạn có thể xem lại lịch sử các câu hỏi trong phần History.

## Cấu trúc Dự án

```
project-ai-rag/
├── backend/                # Server FastAPI
│   ├── rag_system.db       # Cơ sở dữ liệu SQLite
│   ├── server.py           # File chạy chính của Backend
│   ├── requirements.txt    # Danh sách thư viện Python
│   └── .env                # Cấu hình API Key (bạn cần tự tạo)
└── frontend/               # Ứng dụng React/Vite
    ├── src/                # Mã nguồn Frontend
    ├── package.json        # Danh sách thư viện Node.js
    └── vite.config.js      # Cấu hình Vite
```
