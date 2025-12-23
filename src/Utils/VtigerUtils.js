const axios = require('axios');
const VTIGER_API_URL = "https://vtiger.soontech.click/vtigercrm/modules/erp-api/api.php";



const saveVRecord = async (req, module, values) => {
    // Get session from body or cookie
    const sessionId = req.body._session || req.headers.cookie?.match(/PHPSESSID=([a-zA-Z0-9]+)/)?.[1];

    const payload = {
        _operation: "saveRecordSpecialModule",
        module: module,
        isAjax: false,
        record: "",
        imageDeletedId: "",
        values: values
    };

    return axios.post(VTIGER_API_URL, new URLSearchParams({
        _operation: payload._operation,
        module: payload.module,
        isAjax: payload.isAjax,
        record: payload.record,
        imageDeletedId: payload.imageDeletedId,
        values: JSON.stringify(values)
    }), {
        headers: {
            'Cookie': `PHPSESSID=${sessionId}`
        }
    });
}

const updateVRecord = async (req, module, payload) => {
    // Get session from body or cookie
    const sessionId = req.body._session || req.headers.cookie?.match(/PHPSESSID=([a-zA-Z0-9]+)/)?.[1];

    // Extract record ID from payload
    const recordId = payload.id || payload.record;
    const valuesObj = { ...payload };
    delete valuesObj.id;
    delete valuesObj.record;

    const requestPayload = {
        _operation: "saveRecordSpecialModule",
        module: module,
        isAjax: false,
        record: recordId,
        imageDeletedId: "",
        values: valuesObj
    };

    return axios.post(VTIGER_API_URL, new URLSearchParams({
        _operation: requestPayload._operation,
        module: requestPayload.module,
        isAjax: requestPayload.isAjax,
        record: requestPayload.record,
        imageDeletedId: requestPayload.imageDeletedId,
        values: JSON.stringify(valuesObj)
    }), {
        headers: {
            'Cookie': `PHPSESSID=${sessionId}`
        }
    });
}

module.exports = {
    saveVRecord,
    updateVRecord
}