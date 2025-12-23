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


module.exports = {
    sanitizeRow,
    formatDateTime,
    formatDate,
    processQueryResults,
    createPagination,
    getRecordById,
    insertRecord,
    updateRecord,
    deleteRecord,
    createResponse,
};