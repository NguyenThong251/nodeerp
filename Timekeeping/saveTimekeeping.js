const mysql = require("@src/Services/MySQL/MySQLClient");
const { getTimekeepingData } = require("./getTimekeeping");
const { createResponse, formatDateTime, formatDate, } = require("@src/Utils/TimekeepingUtils");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const saveTimekeeping = async (req, res, redis) => {
  try {
    const userId = req.userId;
    const userRole = req?.userRole;
    const now = dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");
    const today = dayjs().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
    const time = dayjs().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss");
    const values = req.body.values;
    const { dateStart } = req.body;


    //CHECK PERMISSION
    const RedisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, "Timekeeping");
    const { permission } = JSON.parse(RedisModuleInfo) || {};
    const { createable, updateable, deleteable } = permission || {};

    if (!permission || !createable || !updateable || !deleteable) {
      return res.status(200).json(createResponse(false, { code: 'PERMISSION_DENIED', message: 'Permission denied' }));
    }


    // CHECK FACE VERIFY
    const token = "DfJbIhGa5DScX5HL@redisfaceinfo";
    const redisKey = `face:verify:${userId}:${token}`;
    const exists = await redis.get(redisKey);
    if (!exists) {
      return res.status(200).json(createResponse(false, { code: 'FACE_VERIFY_EXPIRED', message: 'Face verification expired or invalid' }));
    }
    // await redis.del(redisKey); /// note

    if (!values)
      return res.status(200).json(createResponse(false, { code: 'VALIDATION_FAILED', message: 'Values not found' }));

    const settings = await getTimekeepingSettings(userId);
    if (!settings)
      return res.status(200).json(createResponse(false, { code: 'NOT_SETTINGS', message: 'Not settings' }));

    const timekeepingData = await getTimekeepingData(userId, dateStart);
    const timekeepingToday = timekeepingData?.[today];

    // CHECKIN
    if (!timekeepingToday?.checkin_time) {
      const checkIn = await handleCheckIn({ userId, values, settings, time, now });
      if (!checkIn)
        return res.status(200).json(createResponse(false, { code: 'CHECKIN_FAILED', message: 'Checkin failed' }));
      return res.status(200).json(createResponse(true, checkIn));
    }

    // CHECKOUT
    if (!timekeepingToday?.checkout_time) {
      const checkInTime = new Date(timekeepingToday.checkin_time);
      const diffMinutes = Math.floor((Date.now() - checkInTime.getTime()) / 60000);

      if (diffMinutes <= 5)
        return res.status(200).json(createResponse(false, { code: 'CHECKOUT_WAIT', message: `${6 - diffMinutes}` }));

      const checkOut = await handleCheckOut({ timekeepingToday, values, now });
      if (!checkOut)
        return res.status(200).json(createResponse(false, { code: 'CHECKOUT_FAILED', message: 'Checkout failed' }));
      return res.status(200).json(createResponse(true, checkOut));
    }

    // COMPLETED TIMEKEEPING TODAY
    return res.status(200).json(createResponse(true, timekeepingToday));
  } catch (error) {
    return res.status(500).json(createResponse(false, error.message || "Internal server error"));
  }
};


// HANDLE CHECK IN
async function handleCheckIn({ userId, values, settings, time, now }) {
  const source = { check_in: values };
  if (time > settings.checkin_time_min || (settings.ot_morning_limit && time < settings.ot_morning_limit)) return false;
  const q = "INSERT INTO vtiger_timekeeping(created_by, checkin_time, source, create_time) VALUES (?, ?, ?, ?)";
  const result = await mysql.query(q, [userId, now, JSON.stringify(source), now]);

  return {
    id: result.insertId,
    created_by: userId,
    checkin_time: now,
    source
  };
}

// HANDLE CHECK OUT
async function handleCheckOut({ timekeepingToday, values, now }) {
  const id = timekeepingToday.timekeepingid;
  if (!id) return false;
  const source = { ...JSON.parse(timekeepingToday.source), check_out: values };
  const q = "UPDATE vtiger_timekeeping SET checkout_time=?, source=? WHERE timekeepingid = ?";
  const result = await mysql.query(q, [now, JSON.stringify(source), id]);
  if (!result) return false;

  return {
    id,
    created_by: timekeepingToday.created_by,
    checkin_time: dayjs(timekeepingToday.checkin_time).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss"),
    checkout_time: now,
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


module.exports = saveTimekeeping;;     