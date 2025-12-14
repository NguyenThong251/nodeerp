const fs = require("fs");
const path = require("path");

const checkSession = async (req, res, next) => {
  try {
    const match = req.headers.cookie?.match(/PHPSESSID=([a-zA-Z0-9]+)/);
    const _session = req.body?._session;

    if (!match && !_session) {
      return res.status(200).json({
        success: false,
        error: { code: 1501, message: "Login required" },
      });
    }

    const sessionId = _session || match[1];
    const sessionFile = path.join("/tmp", `sess_${sessionId}`);

    // Kiểm tra sự tồn tại của file session
    await fs.promises.access(sessionFile, fs.constants.F_OK);

    // Đọc nội dung file session
    const data = await fs.promises.readFile(sessionFile, "utf8");

    // Kiểm tra xem có _authenticated_user_id trong nội dung không
    const userIdMatch = data.match(/_authenticated_user_id\|s:\d+:"(\d+)"/);
    if (userIdMatch) {
      const roleMatch = data.match(/_authenticated_user_role\|s:\d+:"([^"]+)"/);
      req.userId = userIdMatch?.[1];
      req.userRole = roleMatch?.[1];
      next(); // Nếu có, tiếp tục xử lý request
    } else {
      return res.status(200).json({
        success: false,
        error: { code: 1501, message: "Login required" },
      });
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(200).json({
        success: false,
        error: { code: 1501, message: "Login required" },
      });
    }

    // Nếu có lỗi khác, trả về lỗi nội bộ
    return res.status(500).json({
      success: false,
      error: { code: 500, message: "Internal server error" },
    });
  }
};

module.exports = checkSession;
