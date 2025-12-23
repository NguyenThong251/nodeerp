Changelog

yarn add axios

nodejs\src\Api\Modules\Timekeeping\getTimekeeping.js
nodejs\src\Api\Modules\Timekeeping\saveTimekeeping.js
nodejs\src\Utils\TimekeepingUtils.js
nodejs\src\Utils\OvertimeUtils.js

nodejs\src\Routes\index.js

<!-- start  -->

if (route) {
const handlerModule = require(route.source); // Nhập file thực thi
const handler = typeof handlerModule === "function"
? handlerModule
: handlerModule?.[_operation] || handlerModule?.handler;

    if (!handler || typeof handler !== "function")
      return res.status(500).json({ success: false, error: { code: 1500, message: `Handler not found for operation: ${_operation}` } });
    // return await handler(req, res, redis); // Gọi handler
    return await handler(req, res); // Gọi handler

}

<!-- end -->

Api Modules

getTimekeeping

{
"\_operation": "getTimekeeping",
"\_session": "...",
"timeStart" : "2025-12-22"
"dateEnd": "2025-12-22"
// if not dateEnd and timeStart get data today
}

saveTimekeeping

{
"\_operation": "saveTimekeeping",
"\_session": "...",
"values": {
"location": "1234.123",
"type": "QR"
}
}
