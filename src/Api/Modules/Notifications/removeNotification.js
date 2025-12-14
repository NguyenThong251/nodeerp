const mysql = require("@src/Services/MySQL/MySQLClient");

const removeNotification = async (req, res, redis) => {
  try {
    const { ids, mode, parentId } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    const module = "ITS4YouQuickReminder";

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, module);
    if (!RedisModuleInfo) {
      return res.status(200).json({ success: false, error: "Module not found" });
    }

    // Get notification active
    let queryUpdate = "";
    let notiActive = [];

    if (mode === "all") {
        const sqlFilter = parentId ? `its4you_reminder.parent_id = ${parentId} AND` : "";
        
        notiActive = await mysql.query(
            `SELECT crmid FROM its4you_reminder 
            INNER JOIN vtiger_crmentity 
            ON its4you_reminder.its4youquickreminderid = vtiger_crmentity.crmid 
            WHERE ${sqlFilter} deleted = 0 AND smownerid = ${userId}`
        );

        if (notiActive?.length) {
            const crmids = notiActive.map((item) => item.crmid).join(",");
            queryUpdate = `UPDATE vtiger_crmentity SET deleted = 1 WHERE crmid IN (${crmids}) AND setype = 'ITS4YouQuickReminder'`;
            await mysql.query(queryUpdate);
        }
    } else if (ids?.length) {
      queryUpdate = `UPDATE vtiger_crmentity SET deleted = 1 WHERE crmid IN (${ids}) AND setype = 'ITS4YouQuickReminder'`;
      await mysql.query(queryUpdate);
    }

    const result = { data: mode === "all" ? notiActive?.length : ids?.length, message: "success" };

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
};

module.exports = removeNotification;
