const mysql = require("@src/Services/MySQL/MySQLClient");
const { sanitizeRow, createResponse } = require("@src/Utils/TimekeepingUtils");


const getTimekeeping = async (req, res) => {
    try {
        const userId = 207;
        const { dateStart, dateEnd } = req.body;
        const dataTimekeeping = await getTimekeepingData(userId, dateStart, dateEnd);
        const hasData = Object.keys(dataTimekeeping).length !== 0;
        if (!hasData && !dateStart)
            return res.status(200).json(createResponse(false, "not checkin time"));
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



module.exports = { getTimekeeping, getTimekeepingData };
