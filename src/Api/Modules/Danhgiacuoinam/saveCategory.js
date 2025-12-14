const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const saveCategory = async (req, res, redis) => {
  try {
    const { recordId, values } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    const createdTime = dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { createable, updateable, deleteable } = permission || {};

    if (!permission || !createable || !updateable || !deleteable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    if (!recordId && (!values.formid || !values.name)) {
      return res.status(200).json({ success: false, error: "Missing required fields: formid, name" });
    }

    // Check if the formid exists
    if (values?.formid) {
      const [form] = await mysql.query(`SELECT formid FROM danhgiacuoinam_form WHERE formid = ?`, [values.formid]);
      if (!form) return res.status(200).json({ success: false, error: "formid not found" });
    }

    if (recordId) {
      const [current] = await mysql.query(`SELECT * FROM danhgiacuoinam_category WHERE categoryid = ?`, [recordId]);
      if (!current) return res.status(200).json({ success: false, error: "categoryid not found" });

      const updated = {
        formid: values.formid || current.formid,
        name: values.name || current.name,
        description: values.description || current.description,
        sequence: values.sequence || current.sequence,
      };

      const result = await mysql.query(
        `UPDATE danhgiacuoinam_category SET formid = ?, name = ?, description = ?, sequence = ? WHERE categoryid = ?`,
        [updated.formid, updated.name, updated.description, updated.sequence, recordId]
      );

      const created_time = dayjs(current.created_time).format("YYYY-MM-DD HH:mm:ss");
      const created_by = current.created_by;
      const data = { categoryid: recordId, ...updated, created_by, created_time };

      return result.affectedRows
        ? res.status(200).json({ success: true, data })
        : res.status(200).json({ success: false, error: "Failed to update category" });
    }

    // Add new form
    const insertQuery = `INSERT INTO danhgiacuoinam_category (formid, name, description, sequence, created_by, created_time)
                         VALUES (?, ?, ?, ?, ?, ?)`;

    const params = [values.formid, values.name, values.description, values.sequence, userId, createdTime];

    const result = await mysql.query(insertQuery, params);

    const data = { categoryid: result.insertId, ...values, created_by: userId, created_time: createdTime };

    return result.affectedRows
      ? res.status(200).json({ success: true, data })
      : res.status(200).json({ success: false, error: "Failed to create category" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = saveCategory;
