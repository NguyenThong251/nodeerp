const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");

const getSubmissions = async (req, res, redis) => {
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

    // get submit
    const querySubmit = `SELECT * FROM danhgiacuoinam_submit WHERE submitid = ${recordId}`;
    const submit = await mysql.query(querySubmit);
    const formId = submit?.[0]?.formid;

    if (!formId) return res.status(200).json({ success: false, error: "formid not found" });

    // Check form is owner or multi_owner_write
    const queryFormPermission = sharingAccess
      ? `(created_by IN (${owners}, ${userId}) OR JSON_CONTAINS(multi_owner_write, '${userId}')) AND`
      : "";
    const queryCheckForm = `SELECT formid FROM danhgiacuoinam_form WHERE ${queryFormPermission} formid = ${formId}`;
    const checkForm = await mysql.query(queryCheckForm);
    const isWriteForm = checkForm?.length > 0;

    const Data =
      sharingAccess && !isWriteForm
        ? submit?.filter((item) => [...(owners || []), userId].includes(`${item.created_by}`))
        : submit;

    if (!Data?.length) return res.status(200).json({ success: true, data: null });

    const queryHistory = `SELECT * FROM danhgiacuoinam_history WHERE submitid = ? ORDER BY created_time DESC`;
    const History = await mysql.query(queryHistory, [recordId]);

    const listResult = Data?.map((item) => {
      const created_time = dayjs(item.created_time).format("YYYY-MM-DD HH:mm:ss");
      const data = JSON.parse(item.data);
      const historys = History?.filter((history) => history.submitid === item.submitid) || [];
      const history = historys?.map((history) => {
        const created_time = dayjs(history.created_time).format("YYYY-MM-DD HH:mm:ss");
        return { ...history, created_time };
      });
      return { ...item, created_time, data, history };
    });

    return res.status(200).json({ success: true, data: listResult?.[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = getSubmissions;
