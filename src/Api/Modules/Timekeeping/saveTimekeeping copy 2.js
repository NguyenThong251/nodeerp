const mysql = require("@src/Services/MySQL/MySQLClient");
const { getTimekeepingData } = require("./getTimekeeping");
const { sanitizeRow, createResponse, formatDateTime, formatDate, } = require("@src/Utils/TimekeepingUtils");

const saveTimekeeping = async (req, res) => {
  try {
    const userId = req.userId;
    const values = req.body.values;
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
async function handleCheckIn(userId, values, settings, nowStr, now) {
  const source = { check_in: values };
  if (nowStr > settings.checkin_time_min || (settings.ot_morning_limit && nowStr < settings.ot_morning_limit)) return false;
  const q = "INSERT INTO vtiger_timekeeping(created_by, checkin_time, source, create_time) VALUES (?, ?, ?, ?)";
  const result = await mysql.query(q, [userId, now, JSON.stringify(source), now]);

  return {
    id: result.insertId,
    created_by: userId,
    checkin_time: formatDateTime(),
    source
  };
}

// HANDLE CHECK OUT
async function handleCheckOut(timekeepingToday, values, now) {
  const id = timekeepingToday.timekeepingid;
  if (!id) return false;
  const source = { ...JSON.parse(timekeepingToday.source), check_out: values };
  const q = "UPDATE vtiger_timekeeping SET checkout_time=?, source=? WHERE timekeepingid = ?";
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

  // const settings = {};
  // for (const r of rows) {
  //   settings[r.setting_key] = r.setting_value;
  // }
  return sanitizeRow(rows);
}


module.exports = saveTimekeeping; 