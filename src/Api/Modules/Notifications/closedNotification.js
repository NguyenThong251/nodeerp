const mysql = require("@src/Services/MySQL/MySQLClient");

const closedNotification = async (req, res, redis) => {
  try {
    const { ids, mode, parentId } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    const module = "ITS4YouQuickReminder";

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, module);
    if (!RedisModuleInfo) {
      return res.status(200).json({ success: false, error: "Module not found" });
    }

    // Get notification open
    let queryUpdate = "";
    let notiOpen = [];

    if (mode === "all") {
        const sqlFilter = parentId ? `its4you_reminder.parent_id = ${parentId} AND` : ``;
        
        notiOpen = await mysql.query(
            `SELECT crmid FROM its4you_reminder 
            INNER JOIN vtiger_crmentity 
            ON its4you_reminder.its4youquickreminderid = vtiger_crmentity.crmid 
            WHERE ${sqlFilter} deleted = 0 AND reminderstatus = 'Open' AND smownerid = ${userId}`
        );

        if (notiOpen?.length) {
            const crmids = notiOpen.map((item) => item.crmid).join(",");
            queryUpdate = `UPDATE its4you_reminder SET reminderstatus = 'Closed' WHERE its4youquickreminderid IN (${crmids})`;
            await mysql.query(queryUpdate);
        }
    } else if (ids?.length) {
      queryUpdate = `UPDATE its4you_reminder SET reminderstatus = 'Closed' WHERE its4youquickreminderid IN (${ids})`;
      await mysql.query(queryUpdate);
    }

    const result = { data: mode === "all" ? notiOpen?.length : ids?.length, message: "success" };

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
};

module.exports = closedNotification;
