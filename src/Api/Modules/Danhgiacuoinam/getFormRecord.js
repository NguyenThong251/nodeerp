const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");

const getFormRecord = async (req, res, redis) => {
  try {
    const { recordId } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { listViewable, owners, sharingAccess } = permission || {};

    if (!permission || !listViewable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    const queryFormPermission = sharingAccess
      ? `(created_by IN (${owners}, ${userId}) OR JSON_CONTAINS(multi_owner, '${userId}') OR JSON_CONTAINS(multi_owner_write, '${userId}')) AND`
      : "";

    const [form] = await mysql.query(`SELECT * FROM danhgiacuoinam_form WHERE ${queryFormPermission} formid = ?`, [recordId]);
    if (!form) return res.status(200).json({ success: false, error: "formid not found or permission denied" });
    const isWriteForm = JSON.parse(form?.multi_owner_write || "[]")?.includes(+userId);

    let categorys = [];
    let fields = [];
    if (form?.formid) {
      const queryCategory = `SELECT * FROM danhgiacuoinam_category WHERE formid = ? ORDER BY sequence ASC`;
      categorys = await mysql.query(queryCategory, [recordId]);

      const queryFieldPermission =
        sharingAccess && !isWriteForm
          ? `(created_by IN (${owners}, ${userId}) OR JSON_CONTAINS(multi_owner, '${userId}')) AND`
          : "";

      const queryFields = `SELECT * FROM danhgiacuoinam_field WHERE ${queryFieldPermission} formid = ? ORDER BY sequence ASC`;
      fields = await mysql.query(queryFields, [recordId]);

      categorys = categorys?.map((item) => {
        const created_time = dayjs(item.created_time).format("DD-MM-YYYY HH:mm:ss");
        const fieldFilter = fields?.filter((field) => field.categoryid === item.categoryid);
        const fieldData = fieldFilter?.map((field) => {
          const created_time = dayjs(field.created_time).format("DD-MM-YYYY HH:mm:ss");
          const options = JSON.parse(field.options || "[]");
          const optionsSort = options?.sort((a, b) => a.sequence - b.sequence);
          const multi_owner = JSON.parse(field.multi_owner || "[]");
          return { ...field, created_time, options: optionsSort, multi_owner };
        });
        return { ...item, created_time, fields: fieldData };
      });
    }

    // Check if form has submission
    const submit = await mysql.query(`SELECT * FROM danhgiacuoinam_submit WHERE formid IN (?)`, [recordId]);
    const submissions = submit?.length > 0;

    // Return data
    const result = {
      ...form,
      start_date: dayjs(form.start_date).format("YYYY-MM-DD"),
      end_date: dayjs(form.end_date).format("YYYY-MM-DD"),
      created_time: dayjs(form.created_time).format("YYYY-MM-DD HH:mm:ss"),
      multi_owner: JSON.parse(form.multi_owner || "[]"),
      multi_owner_write: JSON.parse(form.multi_owner_write || "[]"),
      rating: JSON.parse(form.rating || "[]"),
      categorys,
      submissions,
    };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = getFormRecord;
