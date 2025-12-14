const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const saveField = async (req, res, redis) => {
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

    if (!recordId && (!values.formid || !values.name || !values.categoryid || !values.options?.length)) {
      return res.status(200).json({ success: false, error: "Missing required fields: formid, name, categoryid, options" });
    }

    // Check if the formid exists
    if (values?.formid || values?.multi_owner) {
      const [form] = await mysql.query(`SELECT formid, multi_owner FROM danhgiacuoinam_form WHERE formid = ?`, [values.formid]);
      if (!form) return res.status(200).json({ success: false, error: "formid not found" });

      // check all multiOwnerValues in multiOwnerForm
      if (values?.multi_owner) {
        const multiOwnerForm = Array.isArray(form.multi_owner) ? form.multi_owner : JSON.parse(form.multi_owner || "[]");
        const multiOwnerValues = Array.isArray(values.multi_owner) ? values.multi_owner : [];
        const isInMultiOwner = multiOwnerValues.every((owner) => multiOwnerForm.includes(owner));
        if (!isInMultiOwner) return res.status(200).json({ success: false, error: "User not in form" });
      }
    }

    // Check if the categoryid exists
    if (values?.categoryid) {
      const [category] = await mysql.query(`SELECT categoryid FROM danhgiacuoinam_category WHERE categoryid = ?`, [
        values.categoryid,
      ]);
      if (!category) return res.status(200).json({ success: false, error: "categoryid not found" });
    }

    // Check if field has submissions
    const submissions = await mysql.query(`SELECT * FROM danhgiacuoinam_submit WHERE formid IN (?)`, [values?.formid]);
    if (submissions.length > 0) {
      return res.status(200).json({ success: false, error: "Form đã được sử dụng, không thể sửa đổi!" });
    }

    if (values?.options?.length > 0) {
      const isDuplicate = values.options.some((option) => values.options.filter((opt) => opt.value === option.value).length > 1);
      if (isDuplicate) return res.status(200).json({ success: false, error: "Duplicate option value" });
    }

    // Update field
    if (recordId) {
      const [current] = await mysql.query(`SELECT * FROM danhgiacuoinam_field WHERE fieldid = ?`, [recordId]);
      if (!current) return res.status(200).json({ success: false, error: "Field not found" });

      const updated = {
        formid: values.formid || current.formid,
        categoryid: values.categoryid || current.categoryid,
        name: values.name || current.name,
        description: values.description || current.description,
        multi_owner: values.multi_owner ? JSON.stringify(values.multi_owner || []) : current.multi_owner,
        sequence: values.sequence || current.sequence,
        score: values.score || current.score,
        highest_score: values.highest_score === undefined ? current.highest_score : values.highest_score,
        options: values.options ? JSON.stringify(values.options || []) : current.options,
        more_question: values.more_question === undefined ? current.more_question : values.more_question,
      };

      const { formid, name, description, multi_owner, sequence, score, options, categoryid, highest_score, more_question } =
        updated;
      const param_1 = [formid, name, description, multi_owner, sequence, score];
      const params = [...param_1, options, categoryid, highest_score, more_question, recordId];
      const result = await mysql.query(
        `UPDATE danhgiacuoinam_field SET formid = ?, name = ?, description = ?, multi_owner = ?, sequence = ?, score = ?, options = ?, categoryid = ?, highest_score = ?, more_question = ? WHERE fieldid = ?`,
        params
      );

      const multiOwner = JSON.parse(updated.multi_owner || "[]");
      const optionsData = JSON.parse(updated.options || "[]");
      const created_time = dayjs(current.created_time).format("YYYY-MM-DD HH:mm:ss");
      const created_by = current.created_by;
      const data = { fieldid: recordId, ...updated, created_by, created_time, multi_owner: multiOwner, options: optionsData };

      return result.affectedRows
        ? res.status(200).json({ success: true, data })
        : res.status(200).json({ success: false, error: "Failed to update field" });
    }

    // Add new field
    const insertQuery = `INSERT INTO danhgiacuoinam_field (formid, name, description, multi_owner, sequence, score, options, categoryid, highest_score, more_question, created_by, created_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const options = JSON.stringify(values.options || []);
    const multiOwner = JSON.stringify(values.multi_owner || []);
    const { formid, name, description, sequence, score, categoryid, highest_score, more_question } = values;
    const param_1 = [formid, name, description, multiOwner, sequence, score];
    const params = [...param_1, options, categoryid, highest_score, more_question, userId, createdTime];

    const result = await mysql.query(insertQuery, params);

    const data = { fieldid: result.insertId, ...values, created_by: userId, created_time: createdTime };

    return result.affectedRows
      ? res.status(200).json({ success: true, data })
      : res.status(200).json({ success: false, error: "Failed to create field" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = saveField;
