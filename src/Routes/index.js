const express = require("express");
const routers = require("./routers");
// const redis = require("../Services/Redis/RedisClient");
const checkSession = require("../Middleware/checkSession");

const router = express.Router();

const multer = require("multer");
const upload = multer();
router.post("/hikvision-event", upload.any(), (req, res) => {
  const rawString = req.body.event_log;

  let parsed = {};
  try {
    parsed = JSON.parse(rawString); // ← CHUYỂN string → object
    const event = parsed.AccessControllerEvent;
    if (parsed.eventType === "AccessControllerEvent" && event?.currentVerifyMode === "faceOrFpOrCardOrPw") {
      // console.log("📷 Có người quét khuôn mặt:", parsed);
    }
  } catch (err) {
    console.error("❌ Lỗi parse event_log:", err);
  }

  //   console.log("📥 Nhận sự kiện từ Hikvision:", data);

  // Ghi log nếu cần
  //   const fs = require("fs");
  //   fs.appendFileSync("hikvision_event.log", `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`);

  res.json({ status: "received" });
});

// Sử dụng middleware kiểm tra session trước khi đến router
// router.post("/", checkSession, async (req, res) => {
router.post("/", async (req, res) => {
  const { _operation } = req.body;

  // Tìm router tương ứng với _operation
  const route = routers.find((r) => r._operation === _operation);

  if (route) {
    const handlerModule = require(route.source); // Nhập file thực thi
    const handler = typeof handlerModule === "function"
      ? handlerModule
      : handlerModule?.[_operation] || handlerModule?.handler;

    if (!handler || typeof handler !== "function")
      return res.status(500).json({ success: false, error: { code: 1500, message: `Handler not found for operation: ${_operation}` } });
    // return await handler(req, res, redis); // Gọi handler
    return await handler(req, res); // Gọi handler
  }

  return res.status(200).json({
    success: false,
    error: { code: 1404, message: `Operation not found: ${_operation}` },
  });
});

module.exports = router;
