const { isUserAdmin,getModuleInfo } = require("@src/Utils/PermissionUtils");
const { getRecordById, deleteRecord, createResponse } = require("@src/Utils/TimekeepingUtils");
const deleteMAC = async (req, res, redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const TABLE_NAME = "vtiger_timekeeping_mac";
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    let records = req.body.records;
    if (!records || !records.length) {
      const record = req.body.record;
      if (!record) {
        return res.status(200).json(createResponse(false, "No records provided"));
      }
      records = [record];
    }
    const deleted = [];
    for (const recordId of records) {
      const existingRecord = await getRecordById(TABLE_NAME, recordId);
      if (!existingRecord) {
        return res.status(200).json(createResponse(false, `Record ${recordId} not found`));
      }
      await deleteRecord(TABLE_NAME, recordId);
      deleted.push(recordId);
    }
    return res.status(200).json(createResponse(true, { deleted }));
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = deleteMAC; 