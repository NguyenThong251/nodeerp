// server.js
require("module-alias/register");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const apiRouter = require("@src/Routes");
const app = express();
const port = 3000; // Có thể thay đổi thành cổng 80 nếu cần

// Cấu hình CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"], // Các phương thức được phép
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"], // Các header được phép
    credentials: true, // Cho phép gửi cookie và thông tin xác thực
  })
);

// Middleware để phân tích dữ liệu JSON
app.use(bodyParser.json());

// Sử dụng router cho endpoint /erp-api
app.use("/erp-api/api", apiRouter);

// Khởi động server
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
