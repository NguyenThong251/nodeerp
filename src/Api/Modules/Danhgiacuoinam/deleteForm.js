const mysql = require("@src/Services/MySQL/MySQLClient");

const deleteForm = async (req, res, redis) => {
  try {
    const { recordIds } = req.body;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { deleteable } = permission || {};

    if (!permission || !deleteable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    if (!recordIds) {
      return res.status(200).json({ success: false, error: "Missing required fields: recordIds" });
    }

    // Check if form has submissions
    const submissions = await mysql.query(`SELECT * FROM danhgiacuoinam_submit WHERE formid IN (?)`, [recordIds]);
    if (submissions.length > 0) {
      return res.status(200).json({ success: false, error: "Form đã được sử dụng, không thể xóa!" });
    }

    const result = await mysql.query(`DELETE FROM danhgiacuoinam_form WHERE formid IN (?)`, [recordIds]);

    return result.affectedRows
      ? res.status(200).json({ success: true, data: { formid: recordIds } })
      : res.status(200).json({ success: false, error: "Failed to delete form" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = deleteForm;
