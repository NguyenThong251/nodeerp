const mysql = require("@src/Services/MySQL/MySQLClient");
const { createResponse } = require("@src/Utils/TimekeepingUtils");
const { getModuleInfo} = require("@src/Utils/PermissionUtils");
const checkMAC = async (req, res,redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const TABLE_NAME = "vtiger_timekeeping_mac";
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    const mac = req.body.mac;

    if (!mac) {
      return res.status(200).json(createResponse(false, "MAC address is required"));
    }
    let status = 'MAC undefine';
    const query = `SELECT id, status FROM ${TABLE_NAME} WHERE mac_device = ? AND owner = ?`;
    const result = await mysql.query(query, [mac, userId]);
    if (result && result.length > 0) {
      const row = result[0];

      if (row.status === '1') {
        status = 'success';
      } else {
        status = 'MAC suspended';
      }
    }
    return res.status(200).json(createResponse(true, { status }));
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = checkMAC; 