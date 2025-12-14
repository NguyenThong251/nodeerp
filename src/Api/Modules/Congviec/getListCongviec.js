const meiliClient = require("@src/Services/Meilisearch/MeilisearchClient");
const mysql = require("@src/Services/MySQL/MySQLClient");
const getListModules = require("@src/Api/getListModules");
const dayjs = require("dayjs");

// ====== Main Handler ======
const getListCongviec = async (req, res, redis) => {
  try {
    const module = "Congviec";
    const newReq = { ...req, body: { ...(req?.body || {}), module }, isGetOnlyData: true };
    const ListDatas = await getListModules(newReq, res, redis);
    
    if(!ListDatas?.success){
        return res.status(200).json(ListDatas);
    }

    const seen = new Set();
    const listPairs = ListDatas?.data?.hits
      ?.filter(i => i.label.trim() && i.cf_2625)
      .map(i => {
        const key = `${i.label.trim()}___${i.cf_2625}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return `('${i.label.trim()}', '${i.cf_2625}')`;
      })
      .filter(Boolean);

    if (!listPairs.length) {
      return res.status(200).json({ success: true, data: ListDatas?.data?.hits?.map(i => ({ ...i, teams: [] })) });
    }

    const query = `
      SELECT c.label, cf.cf_2625, GROUP_CONCAT(c.smownerid) AS smownerids
      FROM vtiger_crmentity c
      LEFT JOIN vtiger_congvieccf cf ON c.crmid = cf.congviecid
      WHERE (c.label, cf.cf_2625) IN (${listPairs.join(', ')}) AND c.deleted = 0
      GROUP BY c.label, cf.cf_2625
    `;

    const ListTeams = await mysql.query(query);

    const teamMap = new Map();
    ListTeams.forEach(({ label, cf_2625, smownerids }) => {
      const day = cf_2625 ? dayjs(cf_2625).format('YYYY-MM-DD') : "";
      teamMap.set(`${label?.trim()}___${day}`, smownerids ? smownerids.split(',').map(Number) : []);
    });

    const finalHits = ListDatas?.data.hits.map(i => ({...i, teams: teamMap.get(`${i?.label.trim()}___${i?.cf_2625}`) || []}));

    res.status(200).json({ success: true, data: {...ListDatas?.data, hits: finalHits } });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};


module.exports = getListCongviec;