const mysql = require("@src/Services/MySQL/MySQLClient");


const sanitizeRow = (row) => {
    if (!row) return null;
    const cleanedRow = {};
    for (const [key, value] of Object.entries(row)) {
        cleanedRow[key] = value === null || (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value))
            ? value
            : String(value).replace(/<[^>]*>?/gm, '');
    }
    return cleanedRow;
};

const formatDateTime = (date) => {
    const dateObject = date ? new Date(date) : new Date();
    const yyyy = dateObject.getFullYear();
    const mm = String(dateObject.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObject.getDate()).padStart(2, '0');
    const hh = String(dateObject.getHours()).padStart(2, '0');
    const mi = String(dateObject.getMinutes()).padStart(2, '0');
    const ss = String(dateObject.getSeconds()).padStart(2, '0');
    const numericDate = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    return numericDate;
}

const formatDate = (date) => {
    const dateObject = date ? new Date(date) : new Date();
    const yyyy = dateObject.getFullYear();
    const mm = String(dateObject.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObject.getDate()).padStart(2, '0');
    const numericDate = `${yyyy}-${mm}-${dd}`;
    return numericDate;
}


const checkWorkDay = (works_day) => {
    if (!works_day) return false;
    const today = new Date().getDay();
    const workDays = works_day.split(',').map(day => day.trim());
    return workDays.includes(String(today));
}


const addMinutesToTime = (timeStr, minutes) => {
    const [hh, mm, ss = 0] = timeStr.split(":").map(Number);
    const mins = Number(minutes);
    const date = new Date(0, 0, 0, hh, mm, ss);
    date.setMinutes(date.getMinutes() + mins);

    return date.toTimeString().slice(0, 8);
};

const diffMinutesToTime = (timeStr, minutes) => {
    const [hh, mm, ss = 0] = timeStr.split(":").map(Number);
    const mins = Number(minutes);
    const date = new Date(0, 0, 0, hh, mm, ss);
    date.setMinutes(date.getMinutes() - mins);

    return date.toTimeString().slice(0, 8);
};


const diffMinutes = (timeStr1, timeStr2) => {
    const [h1, m1, s1 = 0] = timeStr1.split(':').map(Number);
    const [h2, m2, s2 = 0] = timeStr2.split(':').map(Number);
    const date1 = new Date(0, 0, 0, h1, m1, s1);
    const date2 = new Date(0, 0, 0, h2, m2, s2);
    return Math.round((date1 - date2) / 60000);
}

//SETTING TIME ROUND
const roundMinutes = (minutes, setting) => {
    if (!setting || setting.status !== "enable") return minutes;
    const m = Number(setting.minute);
    if (!setting.type || setting.type === "default" || !m) {
        return Math.round(minutes);
    }
    if (setting.type === "up") {
        return Math.ceil(minutes / m) * m;
    }
    if (setting.type === "down") {
        return Math.floor(minutes / m) * m;
    }
    return minutes;
};


const findRecord = async (date, userId, table, type) => {
    const idField = `${table.replace('vtiger_', '')}id`;
    const query = `
      SELECT ce.crmid
      FROM ${table} o
      INNER JOIN vtiger_crmentity ce ON ce.crmid = o.${idField}
      WHERE DATE(o.date) = DATE(?)
        AND ce.smownerid = ?
        AND ce.deleted = 0
        AND (o.type = ? OR o.type IS NULL)
      LIMIT 1
    `;
    const result = await mysql.query(query, [date, userId, type]);
    return result?.length ? sanitizeRow(result[0]) : null;
};

const processQueryResults = (results) => {
    if (!results || !results.length) return [];
    return results.map(row => sanitizeRow(row));
};


const createPagination = (data, page = 1, limit = 20) => {
    const totalHits = data?.length || 0;
    const totalPages = Math.ceil(totalHits / limit);
    const nextPage = page + 1 <= totalPages ? page + 1 : false;

    return {
        hits: data || [],
        totalHits,
        totalPages,
        nextPage,
        timeResponse: 0
    };
};

const isRecordOwner = async (table, recordId, userId) => {
    try {
        const query = `SELECT owner FROM ${table} WHERE id = ?`;
        const result = await mysql.query(query, [recordId]);
        return result && result.length > 0 && result[0].owner == userId;
    } catch (error) {
        return false;
    }
};


const getRecordById = async (table, recordId) => {
    try {
        const query = `SELECT * FROM ${table} WHERE id = ?`;
        const result = await mysql.query(query, [recordId]);
        if (result && result.length > 0) {
            return sanitizeRow(result[0]);
        }
        return null;
    } catch (error) {
        return null;
    }
};
const insertRecord = async (table, data) => {
    try {
        const fields = Object.keys(data);
        const placeholders = Array(fields.length).fill('?').join(', ');
        const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;

        const result = await mysql.query(query, Object.values(data));
        return result.insertId;
    } catch (error) {
        console.error(`Error in insertRecord for ${table}:`, error);
        throw error;
    }
};

const updateRecord = async (table, recordId, data) => {
    try {
        const fields = [];
        const params = [];

        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            params.push(value);
        }
        params.push(recordId);
        const updateQuery = `UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`;
        await mysql.query(updateQuery, params);
    } catch (error) {
        throw error;
    }
};

const deleteRecord = async (table, recordId) => {
    try {
        const query = `DELETE FROM ${table} WHERE id = ?`;
        const result = await mysql.query(query, [recordId]);
        return result.affectedRows > 0;
    } catch (error) {
        throw error;
    }
};

const createResponse = (success, data, moduleInfo = null) => {
    return {
        success,
        ...(success ? { data } : { error: data }),
        ...(moduleInfo && { moduleInfo: { ModuleInfo: moduleInfo } })
    };
};

module.exports = {
    sanitizeRow,
    formatDateTime,
    formatDate,
    diffMinutes,
    diffMinutesToTime,
    roundMinutes,
    addMinutesToTime,
    findRecord,
    processQueryResults,
    createPagination,
    isRecordOwner,
    getRecordById,
    insertRecord,
    updateRecord,
    deleteRecord,
    createResponse,
    checkWorkDay
};