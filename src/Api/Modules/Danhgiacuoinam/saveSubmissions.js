const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const saveSubmissions = async (req, res, redis) => {
  try {
    const { recordId, formid, values, note } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    const createdTime = dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { createable, updateable, sharingAccess, owners } = permission || {};

    if (!permission || !createable || !updateable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    if (!formid || values.length === 0 || !values) {
      return res.status(200).json({ success: false, error: "Missing required fields: formid, values" });
    }

    const queryPermission = sharingAccess
      ? `(created_by IN (${owners}, ${userId}) OR JSON_CONTAINS(multi_owner, '${userId}')) AND`
      : "";

    // Check duplicate fieldid
    const duplicateFieldIds = values
      .filter((value, index, self) => index !== self.findIndex((t) => t.fieldid === value.fieldid))
      .map(({ fieldid }) => fieldid)
      .join(",");
    if (duplicateFieldIds) {
      return res.status(200).json({ success: false, error: `Duplicate fieldid: ${duplicateFieldIds}` });
    }

    // Check fields and options
    const fields = await mysql.query(`SELECT * FROM danhgiacuoinam_field WHERE ${queryPermission} formid = ?`, [formid]);
    const fieldsMap = new Map(fields.map((field) => [field.fieldid, field]));

    const invalidFields = values.filter(({ fieldid, option }) => {
      const field = fieldsMap.get(fieldid);
      if (!field) return true;
      const options = JSON.parse(field.options || "[]");
      return !options.some((opt) => opt.value === option);
    });

    if (invalidFields.length > 0) {
      const invalidFieldIds = invalidFields.map(({ fieldid }) => fieldid).join(",");
      return res.status(200).json({ success: false, error: `Invalid fields or options:${invalidFieldIds}` });
    }

    const querySubmit = recordId
      ? `SELECT * FROM danhgiacuoinam_submit WHERE submitid = ? AND formid = ?`
      : `INSERT INTO danhgiacuoinam_submit (formid, data, last_score, created_by, created_time) VALUES (?, ?, ?, ?, ?)`;

    // Calculate last score
    const lastScore = values
      .map(({ fieldid, option }) => {
        const field = fieldsMap.get(fieldid);
        const options = JSON.parse(field.options || "[]");
        const score = options.find((opt) => opt.value === option)?.score || 0;
        return score;
      })
      .reduce((a, b) => a + b, 0);

    if (recordId) {
      // Update
      const [current] = await mysql.query(querySubmit, [recordId, formid]);
      if (!current) return res.status(200).json({ success: false, error: "submitid not found" });

      const prevScore = +current?.prev_score === 0 ? current?.last_score : current?.prev_score;
      const formData = JSON.parse(current.data || "[]");
      const updatedData = formData
        .map((item) => values.find((value) => value.fieldid === item.fieldid) || item)
        .concat(values.filter((value) => !formData.some((item) => item.fieldid === value.fieldid)));

      await saveHistory(recordId, formData, updatedData, userId, createdTime, note);

      const queryUpdate = `UPDATE danhgiacuoinam_submit SET data=?, last_score=?, prev_score=? WHERE submitid = ? AND formid = ?`;
      const result = await mysql.query(queryUpdate, [JSON.stringify(updatedData), lastScore, prevScore, recordId, formid]);
      const data = {
        submitid: recordId,
        data: updatedData,
        last_score: lastScore,
        prev_score: prevScore,
        created_by: userId,
        created_time: createdTime,
      };

      return result.affectedRows
        ? res.status(200).json({ success: true, data })
        : res.status(200).json({ success: false, error: "Failed to update" });
    } else {
      // Create
      const emptyFields = fields.filter((field) => {
        const isMultiOwner = JSON.parse(field.multi_owner || "[]").includes(+userId);
        return isMultiOwner && !values.some((value) => value.fieldid === field.fieldid && value.option);
      });
      if (emptyFields.length > 0) {
        return res
          .status(200)
          .json({ success: false, error: "Fields is required:" + emptyFields.map((f) => f.fieldid).join(", ") });
      }

      // Check has submit
      const queryCheckSubmit = `SELECT submitid FROM danhgiacuoinam_submit WHERE formid = ? AND created_by = ?`;
      const hasSubmit = await mysql.query(queryCheckSubmit, [formid, userId]);
      if (hasSubmit.length > 0) {
        return res.status(200).json({ success: false, error: "Bạn đã tạo đánh giá rồi!" });
      }

      const result = await mysql.query(querySubmit, [formid, JSON.stringify(values), lastScore, userId, createdTime]);
      const data = {
        submitid: result.insertId,
        data: values,
        last_score: lastScore,
        prev_score: 0,
        created_by: userId,
        created_time: createdTime,
      };

      return result.affectedRows
        ? res.status(200).json({ success: true, data })
        : res.status(200).json({ success: false, error: "Failed to create" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
};

// Save history
const saveHistory = async (recordId, formData, updatedData, userId, createdTime, note) => {
  const historyPromises = [];

  updatedData.forEach((newItem) => {
    const oldItem = formData.find((item) => item.fieldid === newItem.fieldid);

    if (oldItem && oldItem.option !== newItem.option) {
      const historyRecord = {
        submitid: recordId,
        fieldid: newItem.fieldid,
        old_value: oldItem.option,
        new_value: newItem.option,
        note,
        created_by: userId,
        created_time: createdTime,
      };

      const queryHistory = `INSERT INTO danhgiacuoinam_history (submitid, fieldid, old_value, new_value, note, created_by, created_time) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`;
      historyPromises.push(mysql.query(queryHistory, Object.values(historyRecord)));
    }
  });

  if (historyPromises.length > 0) {
    await Promise.all(historyPromises);
  }
};

module.exports = saveSubmissions;
