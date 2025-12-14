const mysql = require("@src/Services/MySQL/MySQLClient");

const saveTimekeeping = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const values = req.body.values;
    

    if (!values) {
      return res.status(200).json({
        success: false,
        error: "Values not found"
      });
    }
    

    const timekeepingToday = await getTimekeepingToday();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS
    
    let result = {};
    
    // Check-in
    if (!timekeepingToday || !timekeepingToday?.check_in) {
      const checkIn = await handleCheckIn(userId, values);
      if (!checkIn) {
        return res.status(200).json({
          success: false,
          error: "Đã quá thời gian chấm vào!"
        });
      }
      
      result = checkIn;
    }
    // Check-out
    else if (!timekeepingToday?.check_out) {
    
      const checkInTime = new Date(timekeepingToday?.check_in);
      const checkOutTime = new Date();
      const diffMinutes = Math.floor((checkOutTime - checkInTime) / (1000 * 60));

      if (diffMinutes <= 5) {
        const countDown = 6 - diffMinutes;
        return res.status(200).json({
          success: false,
          error: `Đợi ${countDown} phút trước khi chấm ra!`
        });
      }
      
      const checkOut = await handleCheckOut(timekeepingToday, values);
      if (!checkOut) {
        return res.status(200).json({
          success: false,
          error: "Chấm ra không thành công!"
        });
      }
      
      result = checkOut;
    }
    // Timekeeping already completed
    else {
      timekeepingToday.source = JSON.parse(timekeepingToday?.source);
      result = timekeepingToday;
    }
    
    return res.status(200).json({
      success: true,
      data: { record: result }
    });
  } catch (error) {
    console.error("Error in saveTimekeeping:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
};

/**
 * Xử lý check-in
 */
async function handleCheckIn(userId, values) {
  const now = new Date();
  const endLateAfternoon = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    15, 0, 0 // 15:00:00
  );
  
  // > check in
  if (now > endLateAfternoon) return false;
  
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
  const source = { check_in: values };
  
  const query = "INSERT INTO vtiger_timekeeping_v2 (owner, check_in, source) VALUES (?, ?, ?)";
  const result = await mysql.query(query, [userId, nowStr, JSON.stringify(source)]);
  
  return {
    id: result.insertId,
    owner: userId,
    check_in: nowStr,
    source: source
  };
}

/**
 * check-out
 */
async function handleCheckOut(timekeepingToday, values) {
  if (!timekeepingToday?.id) {
    return false;
  }
  
  const id = timekeepingToday?.id;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  
  const sourceCheckIn = JSON.parse(timekeepingToday?.source);
  sourceCheckIn.check_out = values;

  const updateQuery = "UPDATE vtiger_timekeeping_v2 SET check_out=NOW(), source=? WHERE id = ?";
  const result = await mysql.query(updateQuery, [JSON.stringify(sourceCheckIn), id]);
  
  if (result) {
    return {
      id: id,
      owner: timekeepingToday.owner,
      check_in: timekeepingToday.check_in,
      check_out: now,
      source: sourceCheckIn
    };
  } else {
    return false;
  }
}


async function getTimekeepingToday() {
  const today = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
  const query = "SELECT * FROM vtiger_timekeeping_v2 WHERE DATE(check_in) = ?";
  const result = await mysql.query(query, [today]);
  
  if (result && result.length > 0) {
    const row = result[0];
    const cleanedRow = {};
    
    for (const [key, value] of Object.entries(row)) {
      cleanedRow[key] = value !== null ? String(value).replace(/<[^>]*>?/gm, '') : null;
    }
    
    return cleanedRow;
  }
  
  return null;
}

module.exports = saveTimekeeping; 