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
    processQueryResults,
    createPagination,
    isRecordOwner,
    getRecordById,
    insertRecord,
    updateRecord,
    deleteRecord,
    createResponse
};