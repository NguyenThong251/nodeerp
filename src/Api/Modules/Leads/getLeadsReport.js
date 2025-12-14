const meiliClient = require("@src/Services/Meilisearch/MeilisearchClient");
const mysql = require("@src/Services/MySQL/MySQLClient");
const getListModules = require("@src/Api/getListModules");
const dayjs = require("dayjs");

// ====== Main Handler ======
const getLeadsReport = async (req, res, redis) => {
  try {
    const module = "Leads";
    const newReq = { ...req, body: { ...(req?.body || {}), module }, isGetOnlyData: true };
    const ListDatas = await getListModules(newReq, res, redis);

    if (!ListDatas?.success) {
      return res.status(200).json(ListDatas);
    }

    // Get all crmids from the leads data
    const leads = ListDatas?.data?.hits || [];
    const crmids = leads.map((lead) => lead.crmid).filter((id) => id);

    // Enhanced leads data with account relationship info
    let enhancedLeads = leads;

    if (crmids.length > 0) {
      try {
        // Query for Accounts (with deleted check, label and createdtime)
        const accountFindInSetConditions = crmids.map(() => `FIND_IN_SET(?, acf.cf_from_leads)`).join(" OR ");
        const accountQuery = `
          SELECT acf.accountid, acf.cf_from_leads, ce.crmid, ce.label, ce.createdtime
          FROM vtiger_accountscf acf
          INNER JOIN vtiger_crmentity ce ON ce.crmid = acf.accountid
          WHERE acf.cf_from_leads IS NOT NULL 
          AND acf.cf_from_leads != ''
          AND ce.deleted = 0
          AND (${accountFindInSetConditions})
        `;

        // Query for Contacts (with deleted check, label and createdtime)
        const contactFindInSetConditions = crmids.map(() => `FIND_IN_SET(?, ccf.cf_from_leads)`).join(" OR ");
        const contactQuery = `
          SELECT ccf.contactid, ccf.cf_from_leads, ce.crmid, ce.label, ce.createdtime
          FROM vtiger_contactscf ccf
          INNER JOIN vtiger_crmentity ce ON ce.crmid = ccf.contactid
          WHERE ccf.cf_from_leads IS NOT NULL 
          AND ccf.cf_from_leads != ''
          AND ce.deleted = 0
          AND (${contactFindInSetConditions})
        `;

        const [accountsData, contactsData] = await Promise.all([
          mysql.query(accountQuery, crmids),
          mysql.query(contactQuery, crmids),
        ]);

        // Create mappings
        const crmidToAccountMap = new Map();
        const crmidToContactMap = new Map();

        // Create leads time mapping from existing data
        const leadTimeMap = new Map();
        leads.forEach((lead) => {
          leadTimeMap.set(String(lead.crmid), lead.createdtime);
        });

        // Process accounts data
        accountsData.forEach((account) => {
          const leadIds = account.cf_from_leads.split(",").map((id) => id.trim());
          leadIds.forEach((leadId) => {
            const leadIdStr = String(leadId);
            const crmidsStr = crmids.map((id) => String(id));

            if (crmidsStr.includes(leadIdStr)) {
              const leadCreatedTime = leadTimeMap.get(leadIdStr);
              const accountCreatedTime = account.createdtime;

              // Determine conversion type by comparing created times
              let conversionType = "unknown";
              if (leadCreatedTime && accountCreatedTime) {
                const leadTime = new Date(leadCreatedTime);
                const accountTime = new Date(accountCreatedTime);

                // If account created after lead, it's a new conversion
                // If account created before/same time as lead, it's an update to existing account
                conversionType = accountTime > leadTime ? "new" : "update";
              }

              crmidToAccountMap.set(leadIdStr, {
                value: account.crmid,
                label: account.label,
                module: "Accounts",
                cf_from_leads: account.cf_from_leads,
                conversionType: conversionType,
              });
            }
          });
        });

        // Process contacts data
        contactsData.forEach((contact) => {
          const leadIds = contact.cf_from_leads.split(",").map((id) => id.trim());
          leadIds.forEach((leadId) => {
            const leadIdStr = String(leadId);
            const crmidsStr = crmids.map((id) => String(id));

            if (crmidsStr.includes(leadIdStr)) {
              const leadCreatedTime = leadTimeMap.get(leadIdStr);
              const contactCreatedTime = contact.createdtime;

              // Determine conversion type by comparing created times
              let conversionType = "unknown";
              if (leadCreatedTime && contactCreatedTime) {
                const leadTime = new Date(leadCreatedTime);
                const contactTime = new Date(contactCreatedTime);

                // If contact created after lead, it's a new conversion
                // If contact created before/same time as lead, it's an update to existing contact
                conversionType = contactTime > leadTime ? "new" : "update";
              }

              crmidToContactMap.set(leadIdStr, {
                value: contact.crmid,
                label: contact.label,
                module: "Contacts",
                cf_from_leads: contact.cf_from_leads,
                conversionType: conversionType,
              });
            }
          });
        });

        // Enhance leads data
        enhancedLeads = leads.map((lead) => {
          const leadCrmidStr = String(lead.crmid);
          return {
            ...lead,
            relatedAccount: crmidToAccountMap.get(leadCrmidStr) || null,
            relatedContact: crmidToContactMap.get(leadCrmidStr) || null,
          };
        });
      } catch (mysqlError) {
        console.error("MySQL query error:", mysqlError);
        // If MySQL query fails, return original data without enhancement
        enhancedLeads = leads.map((lead) => ({
          ...lead,
          relatedAccount: null,
          relatedContact: null,
        }));
      }
    }

    const enhancedData = {
      ...ListDatas.data,
      hits: enhancedLeads,
    };

    res.status(200).json({ success: true, data: enhancedData });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

module.exports = getLeadsReport;
