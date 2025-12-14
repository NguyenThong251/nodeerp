const mysql = require("@src/Services/MySQL/MySQLClient");
const { checkGPSPermission ,getModuleInfo} = require("@src/Utils/PermissionUtils");
const { createPagination, createResponse } = require("@src/Utils/TimekeepingUtils");
const { createResponseWithDebug } = require("@src/Utils/DebugUtils");
const getListGPS = async (req, res, redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    if (moduleInfo && (!moduleInfo.permission || !moduleInfo.permission.listViewable)) {
      return res.status(403).json(createResponse(false, "Permission is denied for listView"));
    }
    const query = "SELECT id, name, status, employees_allow, latitude, longitude, radius, owner FROM vtiger_timekeeping_gps ORDER BY id DESC";
    const dbResult = await mysql.query(query);
    const listData = [];
    if (dbResult && dbResult.length > 0) {
      for (const row of dbResult) {
        if (checkGPSPermission(row, userId, moduleInfo)) {
          const cleanedRow = {};
          for (const [key, value] of Object.entries(row)) {
            cleanedRow[key] = value !== null ? String(value).replace(/<[^>]*>?/gm, '') : null;
          }
          listData.push(cleanedRow);
        }
      }
    }
    const page = req.body?.page || 1;
    const limit = req.body?.limit || 20;
    const result = createPagination(listData, page, limit);
    return res.status(200).json(createResponse(true, result, moduleInfo));
    //debug
    //return res.status(200).json(createResponseWithDebug(createResponse, true, { success: true, record: userRole }));
  } catch (error) {
    console.error("Error in getListGPS:", error);
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = getListGPS; 