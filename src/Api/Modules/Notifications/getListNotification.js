const mysql = require("@src/Services/MySQL/MySQLClient");
const dayjs = require("dayjs");

const getListNotification = async (req, res, redis) => {
  try {
    const { page = 1, parentId } = req.body;

    const userId = req?.userId;
    const userRole = req?.userRole;
    const module = "ITS4YouQuickReminder";

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, module);
    if (!RedisModuleInfo) {
      return res.status(200).json({ success: false, error: "Module not found" });
    }
    
    const ModuleInfo = JSON.parse(RedisModuleInfo);
    const { permission, listviews, fields } = ModuleInfo || {};
    const { sharingAccess } = permission || {};
    
    const sqlPermission = sharingAccess === 8 || (!parentId && !sharingAccess) ? `AND smownerid = '${userId}'` : "";
    
    const offset = (page - 1) * 20;
    const limit = 20;
    const sqlFilter = parentId ? `its4you_reminder.parent_id = ${parentId} AND` : ``;

    const totalStatus = await mysql.query(
      `SELECT 
        COUNT(CASE WHEN reminderstatus = 'Open' THEN 1 END) as Open,
        COUNT(CASE WHEN reminderstatus = 'Closed' THEN 1 END) as Closed
      FROM its4you_reminder 
      INNER JOIN vtiger_crmentity ON its4you_reminder.its4youquickreminderid = vtiger_crmentity.crmid 
      WHERE ${sqlFilter} deleted = 0 ${sqlPermission}`
    );

    const totalOpen = totalStatus?.[0]?.Open;
    const totalClosed = totalStatus?.[0]?.Closed;
    const totalHits = totalOpen + totalClosed;
    const totalPages = Math.ceil(totalHits / limit);
    const nextPage = page + 1 <= totalPages ? page + 1 : false;

    const sql = `SELECT crmid, subject, reminderstatus, parent_id, createdtime, smownerid FROM its4you_reminder
    INNER JOIN vtiger_crmentity ON its4you_reminder.its4youquickreminderid = vtiger_crmentity.crmid
    WHERE ${sqlFilter} deleted = 0  ${sqlPermission} ORDER BY createdtime DESC LIMIT ${offset}, ${limit}`;

    const ListDatas = await mysql.query(sql);
    const parentIds = ListDatas?.map(({ parent_id }) => parent_id);

    const queryParent = `SELECT vtiger_crmentity.crmid as value, label, vtiger_crmentityrel.module FROM vtiger_crmentity 
    LEFT JOIN vtiger_crmentityrel ON vtiger_crmentityrel.crmid = vtiger_crmentity.crmid
    WHERE vtiger_crmentity.crmid IN (${parentIds})`;
    const parentDatas = parentIds?.length > 0 ? await mysql.query(queryParent) : [];

    const listResult = ListDatas?.map((item) => {
      const subject = item?.subject?.trim() || "";
      const createdtime = dayjs(item.createdtime).format("YYYY-MM-DD HH:mm:ss");
      const parent = parentDatas?.find(({ value }) => value == item.parent_id);
      return { ...item, subject, createdtime, parent_id: parent };
    });

    const facets = { Open: totalOpen, Closed: totalClosed };

    const result = { hits: listResult, totalHits, totalPages, nextPage, facets };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
};

module.exports = getListNotification;
