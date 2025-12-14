const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");

const getListForm = async (req, res, redis) => {
  try {
    const { page = 1, sort, q, filter } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Danhgiacuoinam");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { listViewable, owners, sharingAccess } = permission || {};

    if (!permission || !listViewable) {
      return res.status(200).json({ success: false, error: `Permission denied` });
    }

    const queryPermission = sharingAccess
      ? `(created_by IN (${owners}, ${userId}) OR JSON_CONTAINS(multi_owner, '${userId}') OR JSON_CONTAINS(multi_owner_write, '${userId}')) AND`
      : "";

    const querySearch = q ? `AND name LIKE '%${q}%'` : "";
    const queryFilter = filter ? `AND ${filter}` : "";
    const offset = (page - 1) * 20;
    const limit = 20;
    const Total = await mysql.query(
      `SELECT COUNT(*) FROM danhgiacuoinam_form WHERE ${queryPermission} formid > 0 ${querySearch} ${queryFilter}`
    );
    const totalHits = Total?.[0]?.["COUNT(*)"] || 0;
    const totalPages = Math.ceil(totalHits / limit);
    const nextPage = page + 1 <= totalPages ? page + 1 : false;

    const sortBy = Array.isArray(sort) && sort?.length > 0 ? sort[0].split(":") : [];
    const orderBy = sortBy?.length > 0 ? `ORDER BY ${sortBy[0]} ${sortBy[1]}` : "ORDER BY created_time DESC";

    const query = `SELECT * FROM danhgiacuoinam_form WHERE ${queryPermission} formid > 0 ${querySearch} ${queryFilter} ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    const ListDatas = await mysql.query(query);
    const listFormIds = ListDatas?.map((item) => item.formid);

    if (listFormIds?.length > 0) {
      const querySubmissions = `SELECT submitid, formid FROM danhgiacuoinam_submit WHERE formid IN (${listFormIds?.join(
        ","
      )}) AND created_by = ${userId}`;
      const ListSubmissions = await mysql.query(querySubmissions);
      const listSubmit = ListSubmissions?.map((item) => item);

      const listResult = ListDatas?.map((item) => {
        const start_date = dayjs(item.start_date).format("YYYY-MM-DD");
        const end_date = dayjs(item.end_date).format("YYYY-MM-DD");
        const created_time = dayjs(item.created_time).format("YYYY-MM-DD HH:mm:ss");
        const multi_owner = JSON.parse(item.multi_owner || "[]");
        const multi_owner_write = JSON.parse(item.multi_owner_write || "[]");
        const rating = JSON.parse(item.rating || "[]");
        const yourSubmit = listSubmit.filter((submit) => submit.formid === item.formid);
        return { ...item, start_date, end_date, created_time, multi_owner, multi_owner_write, yourSubmit, rating };
      });
      const result = { hits: listResult, totalHits, totalPages, nextPage };
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(200).json({ success: true, data: { hits: [], totalHits: 0, totalPages: 0, nextPage: false } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = getListForm;
