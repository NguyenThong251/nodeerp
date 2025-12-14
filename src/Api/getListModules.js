const meiliClient = require("@src/Services/Meilisearch/MeilisearchClient");
const mysql = require("@src/Services/MySQL/MySQLClient");
const SortListModule = require("@src/Constants/SortListModule");

// ====== Main Handler ======
const getListModules = async (req, res, redis) => {
  const isGetOnlyData = req?.isGetOnlyData;
  try {
    const { module, q, page = 1, sort, filter = [], facets, limit = 20, isRelatedList = false } = req.body;
    const userId = req?.userId;
    const userRole = req?.userRole;
    
    const defaultFilter = [...(Array.isArray(filter) ? filter : []), "deleted != '1'"];
    const facetsValue = { [module]: facets || [] };

    const ModuleInfo = await getModuleInfoFromRedis(redis, userRole, module);
    const { permission, listviews, fields } = ModuleInfo || {};

    const resNoModule = { success: false, error: "Module not found" };
    if (!ModuleInfo) return isGetOnlyData ? resNoModule : res.status(200).json(resNoModule);
    if (!permission || (!permission.listViewable && (!permission.detailAndSelect || !isRelatedList))) {
      const resNoPermission = { success: false, error: "Permission denied" };
      return isGetOnlyData ? resNoPermission : res.status(200).json(resNoPermission);
    }

    const defaultListview = listviews?.find((listview) => listview?.isDefault);
    const columnRetrieve = defaultListview?.headers?.map((header) => header?.column);
    const customColumn = ["multiowner_r", "multiowner_w", "createdtime_timestamp", "modifiedtime_timestamp", "starred"];
    const crmColumns = ["crmid", "createdtime", "modifiedtime", "smownerid", "smmultiownerid", "label", ...customColumn];
    const hasImages = defaultListview?.headers?.some((column) => column?.column === "imagename");

    const timeColumn = defaultListview?.headers?.reduce((acc, col) => {
      if (["date", "datetime"].includes(col?.type)) acc.push(`${col?.column}_timestamp`);
      return acc;
    }, []) || [];

    const filterPermission = buildFilterPermission(permission, userId);

    const ListDatas = await meiliClient.multiSearch({
      federation: { limit, offset: (page - 1) * limit, facetsByIndex: facetsValue },
      queries: [
        {
          indexUid: module,
          q: q || "",
          attributesToRetrieve: [...columnRetrieve, ...crmColumns, ...timeColumn],
          filter: filterPermission ? [filterPermission, ...defaultFilter] : defaultFilter,
          sort: sort || SortListModule[module] || ["createdtime:desc"],
          attributesToHighlight: q ? ["*"] : null,
        },
      ],
    });
    
    const crmids = ListDatas?.hits?.map(({ crmid }) => crmid) || [];
    // const stars = await fetchStars(mysql, crmids, userId);
    const images = hasImages ? await fetchImages(mysql, crmids) : [];

    const refFields = columnRetrieve?.filter((c) => fields?.some((f) => f?.column === c && f?.type?.name === "reference")) || [];
    const refIds = refFields.flatMap((field) => ListDatas?.hits?.map((item) => item[field])).filter(Boolean);
    const refs = await fetchReferences(mysql, refIds);
    const detailAndSelect = permission?.detailAndSelect;

    const listResult = ListDatas?.hits?.map((item) =>
      transformListItem(item, { userId, images, refFields, refs, permission, hasImages, detailAndSelect })
    );

    const totalHits = ListDatas?.estimatedTotalHits;
    const totalPages = Math.ceil(totalHits / limit);
    const nextPage = page + 1 <= totalPages ? page + 1 : false;
    const timeResponse = ListDatas?.processingTimeMs;
    const facetsByIndex = ListDatas?.facetsByIndex[module]?.distribution;
    
    const returnData = {
        hits: listResult,
        facets: facetsByIndex,
        totalHits,
        totalPages,
        nextPage,
        timeResponse,
    };
    
    const result = { success: true, data: returnData };
    
    if(isGetOnlyData) return result;

    res.status(200).json(result);
  } catch (error) {
    if(isGetOnlyData) return { success: false, error };
    res.status(500).json({ success: false, error });
  }
};

// ====== Utility Functions ======
async function getModuleInfoFromRedis(redis, userRole, module) {
  const redisData = await redis.hget(`ERP:ModuleInfo:${userRole}`, module);
  return JSON.parse(redisData);
}

// BuildFilterPermission
function buildFilterPermission(permission, userId) {
  const { owners, sharingAccess } = permission || {};
  const isPublicShare = [0, 1, 2].includes(+sharingAccess);

  if (!isPublicShare && sharingAccess) {
    const multiSql = `multiowner_r IN [${userId}] OR multiowner_w IN [${userId}]`;
    return +sharingAccess === 8
      ? `smownerid = '${userId}' OR ${multiSql}`
      : `(smownerid IN [${owners}, ${userId}] OR ${multiSql})`;
  }

  return "";
}

// FetchStars
async function fetchStars(mysql, crmids, userId) {
  if (!crmids.length) return [];
  const query = `SELECT recordid, starred FROM vtiger_crmentity_user_field WHERE recordid IN (${crmids}) AND userid = ${userId}`;
  return mysql.query(query);
}

// FetchImages
async function fetchImages(mysql, crmids) {
  if (!crmids.length) return [];
  const query = `SELECT SA.crmid, name, path, CR.createdtime, CR.smcreatorid, AT.attachmentsid as id
    FROM vtiger_seattachmentsrel AS SA
    LEFT JOIN vtiger_attachments AS AT ON SA.attachmentsid = AT.attachmentsid
    INNER JOIN vtiger_crmentity AS CR ON SA.attachmentsid = CR.crmid
    WHERE SA.crmid IN (${crmids})`;
  return mysql.query(query);
}

// FetchReferences
async function fetchReferences(mysql, refIds) {
  if (!refIds.length) return [];
  const query = `SELECT crmid as value, label, setype as module FROM vtiger_crmentity WHERE crmid IN (${refIds})`;
  return mysql.query(query);
}

// TransformListItem
function transformListItem(item, options) {
  const { userId, images, refFields, refs, permission, hasImages, detailAndSelect } = options;

//   const starred = stars.find(({ recordid }) => recordid == item.crmid)?.starred || "0";
  
  const imagename = hasImages
    ? images.filter(({ crmid }) => +crmid === +item.crmid).map(({ path, id, name, createdtime, smcreatorid }) => ({
        name, path, id, imgUrl: `${path}${id}_${name}`, createdtime, smcreatorid
      }))
    : undefined;

  const referenceFields = refFields.reduce((acc, field) => {
    const ref = refs.find(({ value }) => value == item[field]);
    if (ref) acc[field] = ref;
    return acc;
  }, {});

  const { owners_write, child_users, sharingAccess, updateable } = permission || {};
  const isPublicShareWithEdit = [1, 2].includes(+sharingAccess);
  const isOwner = +item.smownerid === +userId;
  const isMultiownerWrite = (item.multiowner_w || []).includes(userId);
  const isSharedWrite = (owners_write || []).includes(+item.smownerid);
  const isChild = (child_users || []).includes(+item.smownerid);
  const isEditable = updateable && (sharingAccess == null || isPublicShareWithEdit || isOwner || isMultiownerWrite || isSharedWrite || isChild);
  
  const isStarred = item?.starred?.some((user) => +user === +userId);
  const starred = isStarred ? "1" : "0";

  const result = { ...item, ...referenceFields, starred, ...(hasImages && { imagename }), isEditable };

  if (isEditable || detailAndSelect) return result;
  const { crmid, label, smownerid, _federation, _formatted } = result;
  return { crmid, label, starred, smownerid, _federation, _formatted, notPermission: true };
}

module.exports = getListModules;
module.exports.getModuleInfoFromRedis = getModuleInfoFromRedis;
module.exports.buildFilterPermission = buildFilterPermission;
module.exports.fetchStars = fetchStars;
module.exports.fetchImages = fetchImages;
module.exports.fetchReferences = fetchReferences;
module.exports.transformListItem = transformListItem;

