const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const cloneForm = async (req, res, redis) => {
  try {
    const { recordId } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    const createdTime = dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { createable, updateable, deleteable } = permission || {};

    if (!permission || !createable || !updateable || !deleteable) {
      return res.status(200).json({ success: false, error: "Permission denied" });
    }

    // Get form
    const [current] = await mysql.query(`SELECT * FROM danhgiacuoinam_form WHERE formid = ?`, [recordId]);

    if (!current || !current.formid) {
      return res.status(200).json({ success: false, error: "formid not found" });
    }

    const { name, start_date, end_date, multi_owner, multi_owner_write, active, rating } = current || {};
    const cloneName = `${name} - Copy`;
    const startDate = dayjs(start_date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
    const endDate = dayjs(end_date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    // Add new form
    const insertQuery = `INSERT INTO danhgiacuoinam_form (name, start_date, end_date, multi_owner, multi_owner_write, active, rating, created_by, created_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [cloneName, startDate, endDate, multi_owner, multi_owner_write, active, rating, userId, createdTime];

    const result = await mysql.query(insertQuery, params);
    const newFormId = result.insertId;

    // Clone categories
    const categoriesMap = {};
    const categoriesData = await mysql.query(`SELECT * FROM danhgiacuoinam_category WHERE formid = ?`, [recordId]);
    for (const category of categoriesData) {
      const { categoryid, name, description, sequence } = category;
      const insertQuery = `INSERT INTO danhgiacuoinam_category (formid, name, description, sequence, created_by, created_time)
                           VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [newFormId, name, description, sequence, userId, createdTime];
      const resCategory = await mysql.query(insertQuery, params);

      categoriesMap[categoryid] = resCategory.insertId;
    }

    // Clone fields
    const fieldsData = await mysql.query(`SELECT * FROM danhgiacuoinam_field WHERE formid = ?`, [recordId]);
    for (const field of fieldsData) {
      const newCategoryId = categoriesMap[field.categoryid] || null;
      const { name, description, sequence, multi_owner, score, options, highest_score, more_question } = field;
      const insertQuery = `INSERT INTO danhgiacuoinam_field (formid, name, description, multi_owner, sequence, score, options, categoryid, highest_score, more_question, created_by, created_time)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        newFormId,
        name,
        description,
        multi_owner,
        sequence,
        score,
        options,
        newCategoryId,
        highest_score,
        more_question,
        userId,
        createdTime,
      ];

      await mysql.query(insertQuery, params);
    }

    const data = { ...current, formid: result.insertId, created_by: userId, created_time: createdTime };

    return result.affectedRows
      ? res.status(200).json({ success: true, data })
      : res.status(200).json({ success: false, error: "Failed to create form" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = cloneForm;
