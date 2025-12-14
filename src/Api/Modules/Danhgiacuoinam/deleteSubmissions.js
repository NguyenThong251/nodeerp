const mysql = require("@src/Services/MySQL/MySQLClient");

const deleteSubmissions = async (req, res, redis) => {
  try {
    const { recordIds } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { deleteable } = permission || {};

    if (!permission || !deleteable || userId != 1) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    if (!recordIds) {
      return res.status(200).json({ success: false, error: "Missing required fields: recordIds" });
    }

    const result = await mysql.query(`DELETE FROM danhgiacuoinam_submit WHERE submitid IN (?)`, [recordIds]);

    return result.affectedRows
      ? res.status(200).json({ success: true, data: { submitid: recordIds } })
      : res.status(200).json({ success: false, error: "Failed to delete submissions" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = deleteSubmissions;
