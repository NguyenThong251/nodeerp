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
    const hasRange = !!(timeBetween?.start && timeBetween?.end);
    const day = timeBetween?.start;

    if (hasRange) {
        query = `
            SELECT t.*, o.*
            FROM vtiger_timekeeping_v2 t
            LEFT JOIN vtiger_tkpovertime o ON t.id = o.timekeepingid
            WHERE t.created_by = ? 
            AND (
                (t.checkin_time IS NOT NULL AND DATE(t.checkin_time) BETWEEN ? AND ?)
                OR (t.checkin_time IS NULL AND DATE(t.create_time) BETWEEN ? AND ?)
            )
            ORDER BY COALESCE(t.checkin_time, t.create_time), o.tkpovertimeid
        `;
        params = [userId, timeBetween.start, timeBetween.end, timeBetween.start, timeBetween.end];
    } else {
        query = `
            SELECT t.*, o.*
            FROM vtiger_timekeeping_v2 t
            LEFT JOIN vtiger_tkpovertime o ON t.id = o.timekeepingid
            WHERE t.created_by = ? 
            AND (
                (t.checkin_time IS NOT NULL AND DATE(t.checkin_time) = DATE(${day ? "?" : "NOW()"}))
                OR (t.checkin_time IS NULL AND DATE(t.create_time) = DATE(${day ? "?" : "NOW()"}))
            )
            ORDER BY COALESCE(t.checkin_time, t.create_time), o.tkpovertimeid
        `;
        params = day ? [userId, day, day] : [userId];
    }

    const result = await mysql.query(query, params);
    if (!result?.length) return {};

    const data = {};

    for (const row of result) {
        const id = row.id;
        if (!id) continue;

        // Initialize or update record
        if (!data[id]) {
            let base = sanitizeRow({ ...row, overtime: {} });
            for (const k of Object.keys(base)) {
                if (k.startsWith('tkpovertime') || [
                    'type', 'reason', 'date', 'time_start', 'time_end', 'employees', 'reviews', 'work_location', 'status',
                    'create_by', 'modify_by', 'modify_time'
                ].includes(k)) {
                    delete base[k];
                }
            }
            data[id] = base;
        }

        // Overtime
        if (row.tkpovertimeid) {
            const idx = Object.keys(data[id].overtime).length;
            const fields = {};
            for (const k of Object.keys(row)) {
                if (
                    k.startsWith('tkpovertime') || [
                        'type', 'reason', 'date', 'time_start', 'time_end', 'employees', 'reviews',
                        'work_location', 'status', 'create_time', 'create_by', 'modify_by', 'modify_time', 'timekeepingid'
                    ].includes(k)
                ) {
                    fields[k] = row[k];
                }
            }
            data[id].overtime[idx] = sanitizeRow(fields);
        }
    }

    // Helper function to convert date to YYYY-MM-DD format
    const formatDateKey = (dateValue) => {
        const dateObject = new Date(dateValue);
        const yyyy = dateObject.getFullYear();
        const mm = String(dateObject.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObject.getDate()).padStart(2, '0');
        const numericDate = `${yyyy}-${mm}-${dd}`;
        return numericDate;

    };

    const resultObj = {};
    Object.values(data).forEach(r => {
        const hasCheck = r.checkin_time != null || r.checkout_time != null;
        const hasOver = Object.keys(r.overtime).length > 0;

        // Tạo base record (copy tất cả trừ overtime)
        const baseRecord = { ...r };
        delete baseRecord.overtime;

        // Tập hợp các ngày cần tạo entry
        const daysSet = new Set();

        // 1. Thêm ngày của checkin_time (nếu có)
        if (r.checkin_time) {
            const checkinDay = formatDateKey(r.checkin_time);
            if (checkinDay) daysSet.add(checkinDay);
        }

        // 2. Thêm ngày của create_time (nếu không có checkin_time)
        if (!r.checkin_time && r.create_time) {
            const createDay = formatDateKey(r.create_time);
            if (createDay) daysSet.add(createDay);
        }

        // 3. Thêm tất cả các ngày từ overtime
        if (hasOver) {
            Object.values(r.overtime).forEach(ot => {
                if (ot.date) {
                    const otDay = formatDateKey(ot.date);
                    if (otDay) daysSet.add(otDay);
                }
            });
        }

        // Tạo entry cho mỗi ngày
        daysSet.forEach(dayKey => {
            // Tạo record cho ngày này
            const dayRecord = { ...baseRecord };

            // Lọc overtime chỉ giữ lại những overtime có date = dayKey
            const dayOvertimes = {};
            if (hasOver) {
                let idx = 0;
                Object.values(r.overtime).forEach(ot => {
                    if (ot && ot.date) {
                        const otDay = formatDateKey(ot.date);
                        if (otDay === dayKey) {
                            dayOvertimes[idx] = ot;
                            idx++;
                        }
                    }
                });
            }

            // Đảm bảo: nếu không có overtime cho ngày này thì set null, ngược lại set object
            dayRecord.overtime = Object.keys(dayOvertimes).length > 0 ? dayOvertimes : null;

            // Chỉ thêm nếu có checkin/checkout hoặc có overtime cho ngày này
            if (hasCheck || dayRecord.overtime !== null) {
                // Nếu đã có entry cho ngày này, giữ bản ghi có checkin_time mới hơn
                if (!resultObj[dayKey] ||
                    (r.checkin_time && resultObj[dayKey].checkin_time &&
                        new Date(r.checkin_time) > new Date(resultObj[dayKey].checkin_time))) {
                    resultObj[dayKey] = dayRecord;
                }
            }
        });
    });
    return resultObj;
}




module.exports = getTimekeeping; 