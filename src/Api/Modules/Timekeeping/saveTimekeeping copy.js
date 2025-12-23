const mysql = require("@src/Services/MySQL/MySQLClient");
const { getTimekeepingData } = require("./getTimekeeping");
const { findRecord, sanitizeRow, createResponse, formatDateTime, formatDate, addMinutesToTime, diffMinutes, roundMinutes, diffMinutesToTime } = require("@src/Utils/TimekeepingUtils");
const { saveVRecord, updateVRecord } = require("@src/Utils/VtigerUtils");


// ot_morning_limit/ot_night_limit dung de tinh  overtime morning va night bam vao nut checkin hien thi thong bao checkin ovt , co 1 api goi truoc ngay do nghi doi voi overtime nguyeên ngay off la se tao don ovt yeu cau cap nhat bam xac nhanj thi moi checkin/out
// kiem tra them dieu kien cho checkin vao khung gio nao ...
// save module vtiger 
const saveTimekeeping = async (req, res) => {
  try {
    // const userId = req.userId;
    const userId = 207;
    // const userRole = req.userRole;
    const values = req.body.values;
    // overtime morning and night 
    const { dateStart } = req.body;
    const now = new Date();
    const nowStr = now.toTimeString().slice(0, 8);

    if (!values)
      return res.status(200).json(createResponse(false, "Values not found"));

    const settings = await getTimekeepingSettings(userId);
    if (!settings)
      return res.status(200).json(createResponse(false, "User not settings"));

    const today = formatDate();

    const timekeepingData = await getTimekeepingData(userId, dateStart);
    const timekeepingToday = timekeepingData?.[today];

    // CHECKIN
    if (!timekeepingToday?.checkin_time) {
      const checkIn = await handleCheckIn(req, userId, today, values, settings, nowStr, now);
      if (!checkIn)
        return res.status(200).json(createResponse(false, "Checkin failed!"));
      return res.status(200).json(createResponse(true, checkIn));
    }

    // CHECKOUT
    if (!timekeepingToday?.checkout_time) {
      const checkInTime = new Date(timekeepingToday.checkin_time);
      const diffMinutes = Math.floor((Date.now() - checkInTime.getTime()) / 60000);

      if (diffMinutes <= 5)
        return res.status(200).json(createResponse(false, `Đợi ${6 - diffMinutes} phút trước khi chấm ra!`));

      const checkOut = await handleCheckOut(req, userId, today, timekeepingToday, values, settings, nowStr, now);
      if (!checkOut)
        return res.status(200).json(createResponse(false, "Chấm ra không thành công!"));
      return res.status(200).json(createResponse(true, checkOut));
    }

    // COMPLETED TIMEKEEPING TODAY
    return res.status(200).json(createResponse(true, timekeepingToday));
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};



// HANDLE CHECK IN
async function handleCheckIn(req, userId, today, values, settings, nowStr, now) {
  if (nowStr > settings.checkin_time_min || (settings.ot_morning_limit && nowStr < settings.ot_morning_limit)) return false;

  // const timeCal = nowStr > settings.breakfast_timestart ? settings.breakfast_timeend : settings.checkin_time;
  // const grace = addMinutesToTime(timeCal, settings.grace_time);
  // const diff = diffMinutes(nowStr, grace);

  const source = { check_in: values };
  // const isWorkDay = await checkWorkDay(settings.works_day);

  // if (!isWorkDay) {
  //   const res = await saveOvertime({
  //     req,
  //     userId,
  //     today,
  //     timeStart: nowStr,
  //     type: "Offday",
  //     ovsource: JSON.stringify(source)
  //   });
  //   if (res === false) return false;
  // }

  const q = "INSERT INTO vtiger_timekeeping(created_by, checkin_time, source, create_time)VALUES ( ?, ?, ?, ?)";
  // const tkSource = isWorkDay ? JSON.stringify(source) : null;
  // const lateMinutes = isWorkDay && diff > 0 && diff <= settings.lateearly_time_max
  //   ? roundMinutes(diff, settings.lateearly_time_round)
  //   : null;
  const result = await mysql.query(q, [userId, now, JSON.stringify(source), now]);

  return {
    id: result.insertId,
    created_by: userId,
    checkin_time: formatDateTime(),
    source
  };
}

// HANDLE CHECK OUT
async function handleCheckOut(req, userId, today, timekeepingToday, values, settings, nowStr, now) {
  if (!timekeepingToday?.timekeepingid) return false;
  const id = timekeepingToday.timekeepingid;
  const source = { ...JSON.parse(timekeepingToday.source), check_out: values };

  // const timeCal = nowStr < settings.breakfast_timestart ? settings.breakfast_timestart : settings.checkout_time;
  // const graceLimit = diffMinutesToTime(timeCal, settings.grace_time);

  // const isWorkDay = await checkWorkDay(settings.works_day);
  // if (!isWorkDay) {
  //   const res = await saveOvertime({ req, userId, today, type: "Offday", timeEnd: nowStr, ovsource: source });
  //   if (res === false) return false;
  // }

  const q = "UPDATE vtiger_timekeeping SET checkout_time=?, source=? WHERE timekeepingid = ?";
  // const tkSource = isWorkDay ? JSON.stringify(source) : null;
  // const earlyMinutes = isWorkDay && nowStr < graceLimit ? roundMinutes(-diffMinutes(nowStr, graceLimit), settings.lateearly_time_round) : null;
  const result = await mysql.query(q, [now, JSON.stringify(source), id]);
  if (!result) return false;

  return {
    id,
    created_by: timekeepingToday.created_by,
    checkin_time: formatDateTime(timekeepingToday.checkin_time),
    checkout_time: formatDateTime(),
    source
  };
}





async function getTimekeepingSettings(userId) {
  const rows = await mysql.query(`
    SELECT setting_key, setting_value, scope
    FROM vtiger_timekeeping_settings
    WHERE status='active'
      AND (
        (scope='global')
        OR (scope='user' AND scope_id=?)
      )
    ORDER BY FIELD(scope,'user','global')
  `, [userId]);

  const settings = {};
  for (const r of rows) {
    settings[r.setting_key] = r.setting_value;
  }
  return settings;
}


// async function getTimekeepingSettings(userId) {
//   const query = "SELECT * FROM vtiger_timekeeping_settings WHERE employees IS NOT NULL AND FIND_IN_SET(?, employees)";
//   const result = await mysql.query(query, [userId]);
//   if (!result?.length) return null;
//   return sanitizeRow(result[0]);
// }



async function checkWorkDay(works_day) {
  if (!works_day) return false;
  const today = new Date().getDay();
  const workDays = works_day.split(',').map(day => day.trim());
  return workDays.includes(String(today));
}



async function saveOvertime({ req, userId, today, timeStart, timeEnd = null, type = null, ovsource }) {
  const module = 'Overtime';
  const table = 'vtiger_overtime';
  const payload = { time_start: timeStart, time_end: timeEnd, ovsource };

  const overtime = await findRecord(today, userId, table, type);

  if (overtime) {
    return (await updateVRecord(req, module, { ...payload, record: overtime.crmid })).data.success;
  }
  return (await saveVRecord(req, module, {
    ...payload,
    reason: `Làm thêm ngày ${today}`,
    date: today,
    type
  })).data.success;
}



module.exports = saveTimekeeping; 