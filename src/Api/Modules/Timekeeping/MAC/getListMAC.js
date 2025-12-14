const mysql = require("@src/Services/MySQL/MySQLClient");
const { isUserAdmin, getModuleInfo } = require("@src/Utils/PermissionUtils");
const { processQueryResults, createPagination, createResponse } = require("@src/Utils/TimekeepingUtils");

const getListMAC = async (req, res,redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const TABLE_NAME = "vtiger_timekeeping_mac";
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    const is_admin = isUserAdmin(moduleInfo);
    const whereSql = is_admin ? "" : " WHERE owner = ?";
    const params = is_admin ? [] : [userId];
    const query = `SELECT id, device_name, system_name, mac_device, status, time_update, owner FROM ${TABLE_NAME}${whereSql} ORDER BY id DESC`;
    const result = await mysql.query(query, params);
    const listData = processQueryResults(result);
    const page = req.body?.page || 1;
    const limit = req.body?.limit || 20;
    const paginationResult = createPagination(listData, page, limit);
    return res.status(200).json(createResponse(true, paginationResult, moduleInfo));
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = getListMAC; 