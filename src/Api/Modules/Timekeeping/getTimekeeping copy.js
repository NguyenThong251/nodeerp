const mysql = require("@src/Services/MySQL/MySQLClient");

const { sanitizeRow, createResponse } = require("@src/Utils/TimekeepingUtils");


const getTimekeeping = async (req, res) => {
    try {
        const userId = 207;
        const { timeBetween } = req.body;
        const now = new Date();

        const settings = await getTimekeepingSettings(userId);
        if (!settings)
            return res.status(200).json(createResponse(false, "user not settings"));

        const dataTimekeeping = await getTimekeepingData(userId, timeBetween);
        console.log(dataTimekeeping);
        const hasData = Object.keys(dataTimekeeping).length !== 0;
        const isWorkDay = checkWorkDay(settings.works_day);
        const isCheckinTimeMin = now.toTimeString().slice(0, 8) > settings.checkin_time_min;

        if (!isWorkDay)
            return res.status(200).json(createResponse(hasData, hasData ? dataTimekeeping : "not work day"));

        if (!hasData && isCheckinTimeMin && !timeBetween?.start)
            return res.status(200).json(createResponse(false, "not checkin time"));

        return res.status(200).json(createResponse(true, dataTimekeeping));
    } catch (error) {
        return res.status(500).json(createResponse(false, error.message || "Internal server error"));
    }
};

function checkWorkDay(works_day) {
    if (!works_day) return false;
    const today = new Date().getDay();
    const workDays = works_day.split(',').map(day => day.trim());
    return workDays.includes(String(today));
}


async function getTimekeepingSettings(userId) {
    const query = "SELECT * FROM vtiger_timekeeping_settings WHERE employees IS NOT NULL AND FIND_IN_SET(?, employees)";
    const result = await mysql.query(query, [userId]);
    if (!result?.length) return null;
    return sanitizeRow(result[0]);
}

async function getTimekeepingData(userId, timeBetween) {
    let query, params;
    if (timeBetween?.start && timeBetween?.end) {
        query = "SELECT * FROM vtiger_timekeeping_v2 WHERE created_by = ? AND DATE(checkin_time) BETWEEN ? AND ? ORDER BY checkin_time";
        params = [userId, timeBetween.start, timeBetween.end];
    } else {
        const day = timeBetween?.start || 'NOW()';
        query = `SELECT * FROM vtiger_timekeeping_v2 WHERE created_by = ? AND DATE(checkin_time) = DATE(${day === 'NOW()' ? 'NOW()' : '?'}) ORDER BY checkin_time`;
        params = day === 'NOW()' ? [userId] : [userId, day];
    }
    const result = await mysql.query(query, params);
    if (!result?.length) return {};
    return result.reduce((acc, row) => {
        const r = sanitizeRow(row);
        if (r?.checkin_time) {
            const dateObject = new Date(r.checkin_time);
            const yyyy = dateObject.getFullYear();
            const mm = String(dateObject.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObject.getDate()).padStart(2, '0');
            const numericDate = `${yyyy}-${mm}-${dd}`;
            if (!acc[numericDate] || r.checkin_time > acc[numericDate].checkin_time) acc[numericDate] = r;
        }
        return acc;
    }, {});
}


module.exports = getTimekeeping;


