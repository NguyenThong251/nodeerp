const mysql = require("@src/Services/MySQL/MySQLClient");

const getUserNotSubmissions = async (req, res, redis) => {
  try {
    const { formid } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { listViewable, createable, updateable, deleteable } = permission || {};

    if (!permission || !listViewable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    const query = `SELECT multi_owner, multi_owner_write FROM danhgiacuoinam_form WHERE formid = ${formid}`;
    const ListDatas = await mysql.query(query);

    const multi_owner = ListDatas?.map((item) => JSON.parse(item.multi_owner))?.[0] || [];
    const multi_owner_write = ListDatas?.map((item) => JSON.parse(item.multi_owner_write || "[]"))?.[0] || [];
    const isWriteForm = multi_owner_write?.includes(+userId);

    if (!isWriteForm && (!createable || !updateable || !deleteable)) {
      return res.status(200).json({ success: false, error: "Permission denied" });
    }

    const ListSubmissions = await mysql.query(`SELECT created_by FROM danhgiacuoinam_submit WHERE formid = ${formid}`);
    const listSubmit = ListSubmissions?.map((item) => item.created_by);
    const listOwnerNotSubmit = multi_owner?.filter((item) => !listSubmit.includes(item));
    const listOwnerWriteNotSubmit = multi_owner_write?.filter((item) => !listSubmit.includes(item));

    return res.status(200).json({ success: true, data: { owner: listOwnerNotSubmit, ownerWrite: listOwnerWriteNotSubmit } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = getUserNotSubmissions;
