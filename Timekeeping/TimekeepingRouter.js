const TimekeepingRouter = [
  // { _operation: "testtime", source: "../Api/Modules/Timekeeping/testtime" },

  // GPS APIs
  { _operation: "getListGPS", source: "../Api/Modules/Timekeeping/GPS/getListGPS" },
  { _operation: "deleteGPS", source: "../Api/Modules/Timekeeping/GPS/deleteGPS" },
  { _operation: "saveGPS", source: "../Api/Modules/Timekeeping/GPS/saveGPS" },

  // MAC APIs
  { _operation: "checkMAC", source: "../Api/Modules/Timekeeping/MAC/checkMAC" },
  { _operation: "deleteMAC", source: "../Api/Modules/Timekeeping/MAC/deleteMAC" },
  { _operation: "getListMAC", source: "../Api/Modules/Timekeeping/MAC/getListMAC" },
  { _operation: "saveMAC", source: "../Api/Modules/Timekeeping/MAC/saveMAC" },

  // Timekeeping APIs
  { _operation: "getTimekeeping", source: "../Api/Modules/Timekeeping/getTimekeeping" },
  { _operation: "saveTimekeeping", source: "../Api/Modules/Timekeeping/saveTimekeeping" },
];

module.exports = TimekeepingRouter;
