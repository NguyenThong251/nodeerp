const mysql = require("@src/Services/MySQL/MySQLClient");
const { isUserAdmin, getModuleInfo } = require("@src/Utils/PermissionUtils");
const {
  getRecordById,
  insertRecord,
  updateRecord,
  createResponse
} = require("@src/Utils/TimekeepingUtils");

const saveGPS = async (req, res, redis) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const TABLE_NAME = "vtiger_timekeeping_gps";
    const moduleInfo = await getModuleInfo(redis, userRole, "Timekeeping");
    const is_admin = isUserAdmin(moduleInfo);

    const fields = {
      name: { required: true },
      status: { required: false },
      employees_allow: { required: false },
      latitude: { required: true },
      longitude: { required: true },
      radius: { required: true },
      owner: { required: false }
    };
    const values = req.body.values;
    const record = req.body.record;
    if (!values) {
      return res.status(200).json(createResponse(false, "Values not found"));
    }

    for (const [field, options] of Object.entries(fields)) {
      if (options.required && !values[field]) {
        return res.status(200).json(createResponse(false, `${field} cannot be empty!`));
      }
    }
    const data = {};
    for (const [field, options] of Object.entries(fields)) {
      if (values[field] !== undefined) {
        data[field] = values[field];
      } else {
        data[field] = "";
      }
    }
    data.owner = userId;

    if (record) {
      const existingRecord = await getRecordById(TABLE_NAME, record);
      if (!existingRecord) {
        return res.status(200).json(createResponse(false, "Record not found"));
      }
      if (!is_admin && existingRecord.owner != userId) {
        return res.status(200).json(createResponse(false, "Permission denied: You can only update your own records"));
      }

      if (data.name && data.name !== existingRecord.name) {
        const checkDuplicateQuery = `SELECT id FROM ${TABLE_NAME} WHERE name = ? AND id != ?`;
        const duplicateResult = await mysql.query(checkDuplicateQuery, [data.name, record]);
        if (duplicateResult && duplicateResult.length > 0) {
          return res.status(200).json(createResponse(false, `GPS location với tên "${data.name}" đã tồn tại`));
        }
      }

      await updateRecord(TABLE_NAME, record, data);
      const savedRecord = await getRecordById(TABLE_NAME, record);
      return res.status(200).json(createResponse(true, { success: true, record: savedRecord }));
    } else {
      const checkDuplicateQuery = `SELECT id FROM ${TABLE_NAME} WHERE name = ?`;
      const duplicateResult = await mysql.query(checkDuplicateQuery, [data.name]);
      if (duplicateResult && duplicateResult.length > 0) {
        return res.status(200).json(createResponse(false, `GPS location với tên "${data.name}" đã tồn tại`));
      }

      if (data.latitude && data.longitude) {
        const checkDuplicateLocationQuery = `SELECT id, name FROM ${TABLE_NAME} WHERE latitude = ? AND longitude = ?`;
        const duplicateLocationResult = await mysql.query(checkDuplicateLocationQuery, [data.latitude, data.longitude]);
        if (duplicateLocationResult && duplicateLocationResult.length > 0) {
          const existingName = duplicateLocationResult[0].name;
          return res.status(200).json(createResponse(false, `Đã tồn tại GPS location "${existingName}" với cùng tọa độ`));
        }
      }

      const newRecordId = await insertRecord(TABLE_NAME, data);
      const savedRecord = await getRecordById(TABLE_NAME, newRecordId);
      return res.status(200).json(createResponse(true, { success: true, record: savedRecord }));
    }
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};

module.exports = saveGPS; 