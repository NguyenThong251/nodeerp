const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const saveForm = async (req, res, redis) => {
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

    if (!recordId && (!values.name || !values.start_date || !values.end_date)) {
      return res.status(200).json({ success: false, error: "Missing required fields: name, start_date, end_date" });
    }

    // Update form
    if (recordId) {
      const [current] = await mysql.query(`SELECT * FROM danhgiacuoinam_form WHERE formid = ?`, [recordId]);
      if (!current) return res.status(200).json({ success: false, error: "formid not found" });

      const updated = {
        name: values.name || current.name,
        start_date: values.start_date || current.start_date,
        end_date: values.end_date || current.end_date,
        multi_owner: values.multi_owner ? JSON.stringify(values.multi_owner || []) : current.multi_owner,
        multi_owner_write: values.multi_owner_write ? JSON.stringify(values.multi_owner_write || []) : current.multi_owner_write,
        active: values.active !== undefined ? values.active : current.active,
        is_private: values.is_private !== undefined ? values.is_private : current.is_private,
        rating: values.rating ? JSON.stringify(values.rating || []) : current.rating,
      };

      const result = await mysql.query(
        `UPDATE danhgiacuoinam_form SET name = ?, start_date = ?, end_date = ?, multi_owner = ?, multi_owner_write = ?, active = ?, is_private = ?, rating = ? WHERE formid = ?`,
        [
          updated.name,
          updated.start_date,
          updated.end_date,
          updated.multi_owner,
          updated.multi_owner_write,
          updated.active,
          updated.is_private,
          updated.rating,
          recordId,
        ]
      );

      const start_date = dayjs(updated.start_date).format("YYYY-MM-DD");
      const end_date = dayjs(updated.end_date).format("YYYY-MM-DD");
      const multi_owner = JSON.parse(updated.multi_owner || "[]");
      const multi_owner_write = JSON.parse(updated.multi_owner_write || "[]");
      const rating = JSON.parse(updated.rating || "[]");
      const created_time = dayjs(current.created_time).format("YYYY-MM-DD HH:mm:ss");
      const created_by = current.created_by;
      const data = {
        formid: recordId,
        ...updated,
        created_by,
        created_time,
        start_date,
        end_date,
        multi_owner,
        multi_owner_write,
        rating,
      };

      return result.affectedRows
        ? res.status(200).json({ success: true, data })
        : res.status(200).json({ success: false, error: "Failed to update form" });
    }

    // Add new form
    const insertQuery = `INSERT INTO danhgiacuoinam_form (name, start_date, end_date, multi_owner, multi_owner_write, active, is_private, rating, created_by, created_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const multiOwner = JSON.stringify(values.multi_owner || []);
    const multiOwnerWrite = JSON.stringify(values.multi_owner_write || []);
    const rating = JSON.stringify(values.rating || []);
    const params = [
      values.name,
      values.start_date,
      values.end_date,
      multiOwner,
      multiOwnerWrite,
      values.active,
      values.is_private,
      rating,
      userId,
      createdTime,
    ];

    const result = await mysql.query(insertQuery, params);

    const data = { formid: result.insertId, ...values, created_by: userId, created_time: createdTime };

    return result.affectedRows
      ? res.status(200).json({ success: true, data })
      : res.status(200).json({ success: false, error: "Failed to create form" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = saveForm;
