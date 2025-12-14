const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");

const getListSubmissions = async (req, res, redis) => {
  try {
    const { formid, page = 1, sort, filter } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { listViewable, owners, sharingAccess } = permission || {};

    if (!permission || !listViewable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }
    
    // Check form is owner or multi_owner_write
    const checkIsWriteForm = (formArr) => {
        if (!sharingAccess) return true;
        if (!formArr?.length) return false;
    
        const { created_by, multi_owner_write } = formArr[0];
        const writeAccess = JSON.parse(multi_owner_write || "[]").map(Number).includes(+userId);
        const isOwner = [...owners.map(Number), +userId].includes(+created_by);
    
        return writeAccess || isOwner;
    };

    const queryForm = `SELECT formid, created_by, multi_owner_write, is_private FROM danhgiacuoinam_form WHERE formid = ${formid}`;
    const form = await mysql.query(queryForm);
    const isWriteForm = checkIsWriteForm(form);
    const isPrivate = form?.length > 0 && +form?.[0]?.is_private === 1;

    const createdByPermission = isPrivate ? `(${userId})` : `(${owners}, ${userId})`;
    const queryPermission = sharingAccess && !isWriteForm ? `created_by IN ${createdByPermission} AND` : "";

    const queryFilter = filter ? `AND ${filter}` : "";
    const limit = 40;
    const offset = (page - 1) * limit;
    const Total = await mysql.query(
      `SELECT COUNT(*) FROM danhgiacuoinam_submit WHERE ${queryPermission} formid = ${formid} ${queryFilter}`
    );
    const totalHits = Total?.[0]?.["COUNT(*)"] || 0;
    const totalPages = Math.ceil(totalHits / limit);
    const nextPage = page + 1 <= totalPages ? page + 1 : false;

    const sortBy = Array.isArray(sort) && sort?.length > 0 ? sort[0].split(":") : [];
    const orderBy = sortBy?.length > 0 ? `ORDER BY ${sortBy[0]} ${sortBy[1]}` : "ORDER BY created_time DESC";

    const query = `SELECT * FROM danhgiacuoinam_submit WHERE ${queryPermission} formid = ${formid} ${queryFilter} ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    const ListDatas = await mysql.query(query);

    const listResult = ListDatas?.map((item) => {
      const created_time = dayjs(item.created_time).format("YYYY-MM-DD HH:mm:ss");
      const data = JSON.parse(item.data);
      return { ...item, created_time, data };
    });

    const result = { hits: listResult, totalHits, totalPages, nextPage, isWriteForm };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = getListSubmissions;
