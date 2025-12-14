const mysql = require("@src/Services/MySQL/MySQLClient");

const checkNotification = async (req, res, redis) => {
  try {
    const userId = req?.userId;
    const userRole = req?.userRole;
    const module = "ITS4YouQuickReminder";

    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, module);
    if (!RedisModuleInfo) {
      return res.status(200).json({ success: false, error: "Module not found" });
    }

    const totalStatus = await mysql.query(
      `SELECT 
        COUNT(CASE WHEN reminderstatus = 'Open' THEN 1 END) as Open,
        COUNT(CASE WHEN reminderstatus = 'Closed' THEN 1 END) as Closed
      FROM its4you_reminder 
      INNER JOIN vtiger_crmentity ON its4you_reminder.its4youquickreminderid = vtiger_crmentity.crmid 
      WHERE smownerid = ${userId} AND deleted = 0`
    );

    const totalOpen = totalStatus?.[0]?.Open;
    const totalClosed = totalStatus?.[0]?.Closed;
    const totalHits = totalOpen + totalClosed;

    const result = { totalHits, totalOpen, totalClosed };

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error });
  }
};

module.exports = checkNotification;
