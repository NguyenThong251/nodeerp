const NotificationRouter = require("./Modules/NotificationRouter");
const DanhgiacuoinamRouter = require("./Modules/DanhgiacuoinamRouter");
const CongviecRouter = require("./Modules/CongviecRouter");
const LeadsRouter = require("./Modules/LeadsRouter");
const TimekeepingRouter = require("./Modules/TimekeepingRouter");

const routers = [
  { _operation: "getListModules", source: "../Api/getListModules" },
  { _operation: "getRecordIdByNo", source: "../Api/getRecordIdByNo" },
  // Notifications
  ...NotificationRouter,
  ...DanhgiacuoinamRouter,
  ...CongviecRouter,
  ...TimekeepingRouter,
  ...LeadsRouter,
];

module.exports = routers;
