const mysql = require("@src/Services/MySQL/MySQLClient");
const { isUserAdmin, getModuleInfo } = require("@src/Utils/PermissionUtils");
const {
  getRecordById,
  insertRecord,
  updateRecord,
  createResponse
} = require("@src/Utils/TimekeepingUtils");
const saveMAC = async (req, res,redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const TABLE_NAME = "vtiger_timekeeping_mac";
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    const is_admin = isUserAdmin(moduleInfo);
    const fields = {
      device_name: { required: true },
      system_name: { required: true },
      mac_device: { required: true },
      status: { required: false },
      time_update: { required: false },
      owner: { required: false }
    };

    const values = req.body.values;
    const record = req.body.record;
    if (!values) {
      return res.status(200).json(createResponse(false, "Values not found"));
    }
    for (const [field, options] of Object.entries(fields)) {
      if (options.required && !values[field]) {
        return res.status(200).json(createResponse(false, `${field} cannot be empty!`));
      }
    }
    const data = {};
    for (const [field, options] of Object.entries(fields)) {
      if (values[field] !== undefined) {
        data[field] = values[field];
      } else {
        data[field] = ""; 
      }
    }
    data.owner = is_admin ? (data.owner || userId) : userId;
    data.time_update = new Date().toISOString().slice(0, 19).replace('T', ' '); 
    if (record) {
      const existingRecord = await getRecordById(TABLE_NAME, record);
      if (!existingRecord) {
        return res.status(200).json(createResponse(false, "Bản ghi không tồn tại!"));
      }
      const isOwner = existingRecord.owner == userId;
      if (!isOwner && !is_admin) {
        return res.status(200).json(createResponse(false, "Không có quyền cập nhật!"));
      }
      const lastUpdate = existingRecord.time_update;
      const currentTime = new Date();
      const lastUpdateTime = new Date(lastUpdate);
      const diffInSeconds = Math.floor((currentTime - lastUpdateTime) / 1000);
      const secondsIn30Days = 30 * 24 * 60 * 60;
      if (diffInSeconds < secondsIn30Days && !is_admin) {
        const remainingSeconds = secondsIn30Days - diffInSeconds;
        let remaining;

        if (remainingSeconds >= 86400) {
          remaining = Math.floor(remainingSeconds / 86400) + " ngày";
        } else if (remainingSeconds >= 3600) { 
          remaining = Math.floor(remainingSeconds / 3600) + " giờ";
        } else if (remainingSeconds >= 60) {
          remaining = Math.floor(remainingSeconds / 60) + " phút";
        } else { 
          remaining = remainingSeconds + " giây";
        }
        return res.status(200).json(createResponse(false, `Thay đổi chưa được phép, thử lại sau ${remaining}.`));
      }
      data.status = is_admin ? data.status : existingRecord.status;
      await updateRecord(TABLE_NAME, record, data);
      const savedRecord = await getRecordById(TABLE_NAME, record);
      return res.status(200).json(createResponse(true, { success: true, record: savedRecord }, moduleInfo));
    } else {
      const query = `SELECT * FROM ${TABLE_NAME} WHERE owner = ?`;
      const existingMAC = await mysql.query(query, [userId]);

      if (existingMAC && existingMAC.length > 0) {
        const row = existingMAC[0];
        return res.status(200).json(createResponse(false,
          `Tài khoản đã đăng ký ở thiết bị ${row.system_name} ${row.device_name}`));
      }
      const newRecordId = await insertRecord(TABLE_NAME, data);
      const savedRecord = await getRecordById(TABLE_NAME, newRecordId);
      return res.status(200).json(createResponse(true, { success: true, record: savedRecord }, moduleInfo));
    }
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = saveMAC; 