const mysql = require("@src/Services/MySQL/MySQLClient");
const { sanitizeRow, createResponse } = require("@src/Utils/TimekeepingUtils");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const getTimekeeping = async (req, res, redis) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Timekeeping");
        const { permission } = JSON.parse(RedisModuleInfo) || {};
        const { createable, updateable, deleteable } = permission || {};

        if (!permission || !createable || !updateable || !deleteable) {
            return res.status(200).json(createResponse(false, { code: 'PERMISSION_DENIED', message: 'Permission denied' }));
        }

        const { dateStart, dateEnd } = req.body;
        const dataTimekeeping = await getTimekeepingData(userId, dateStart, dateEnd);
        const hasData = Object.keys(dataTimekeeping).length !== 0;
        if (!hasData)
            return res.status(200).json(createResponse(false, { code: 'NOT_DATA_TIMEKEEPING', message: 'not data timekeeping' }));
        return res.status(200).json(createResponse(true, dataTimekeeping));
    } catch (error) {
        return res.status(500).json(createResponse(false, error.message || "Internal server error"));
    }
};

const getTimekeepingData = async (userId, dateStart, dateEnd) => {
    let query, params;
    if (dateStart && dateEnd) {
        query = "SELECT * FROM vtiger_timekeeping WHERE created_by = ? AND DATE(checkin_time) BETWEEN ? AND ? ORDER BY checkin_time";
        params = [userId, dateStart, dateEnd];
    } else {
        const day = dateStart || 'NOW()';
        query = `SELECT * FROM vtiger_timekeeping WHERE created_by = ? AND DATE(checkin_time) = DATE(${day === 'NOW()' ? 'NOW()' : '?'}) ORDER BY checkin_time`;
        params = day === 'NOW()' ? [userId] : [userId, day];
    }
    const result = await mysql.query(query, params);
    if (!result?.length) return {};
    return result.reduce((acc, row) => {
        const r = sanitizeRow(row);
        if (r?.checkin_time) {
            const date = dayjs(r.checkin_time).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
            if (!acc[date] || r.checkin_time > acc[date].checkin_time) acc[date] = r;
        }
        return acc;
    }, {});
}

module.exports = getTimekeeping;
module.exports.getTimekeepingData = getTimekeepingData;