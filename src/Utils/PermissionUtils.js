/**
 * Utility functions for checking permissions across different modules
 */

/**
 * Check if user has edit permission for a record
 * @param {Object} record - The record to check permission for
 * @param {Object} permission - Permission configuration
 * @param {string} userId - Current user ID
 * @returns {boolean} - Whether user has edit permission
 */
const checkRecordEditPermission = (record, permission, userId) => {
  const { owners_write, child_users, sharingAccess } = permission || {};
  
  const isPublicShareWithEdit = [1, 2].some((id) => +id === +sharingAccess);
  const isOwner = +record?.smownerid == +userId;
  const isMultiownerWrite = [...(record?.multiowner_w || [])].some((id) => +id == +record?.smownerid);
  const isSharedWrite = [...(owners_write || [])].some((id) => +id == +record?.smownerid);
  const isChild = [...(child_users || [])].some((id) => +id == +record?.smownerid);
  
  const isUpdateable = permission?.updateable;
  const checkEditable = sharingAccess == null || isPublicShareWithEdit || 
                        isOwner || isMultiownerWrite || isSharedWrite || isChild;
  
  return isUpdateable && checkEditable;
};

/**
 * Create permission filter based on user's access rights
 * @param {Object} permission - Permission configuration
 * @param {string} userId - Current user ID
 * @returns {string} - Filter string for queries
 */
const createPermissionFilter = (permission, userId) => {
  const { owners, sharingAccess } = permission || {};
  
  const isPublicShare = [0, 1, 2].some((id) => +id === +sharingAccess);
  
  if (!isPublicShare && sharingAccess) {
    let filterPermission = `(smownerid IN [${owners}, ${userId}] OR multiowner_r IN [${userId}] OR multiowner_w IN [${userId}])`;
    
    if (sharingAccess === 8) {
      filterPermission = `${filterPermission} AND (smownerid = '${userId}')`;
    }
    
    return filterPermission;
  }
  
  return "";
};

/**
 * Validate permissions for accessing a module
 * @param {Object} moduleInfo - Module configuration
 * @param {boolean} isRelatedList - Whether this is a related list view
 * @returns {Object} - Validation result
 */
const validateModulePermissions = (moduleInfo, isRelatedList) => {
  const { permission } = moduleInfo || {};
  
  if (!permission) {
    return { isValid: false, error: "Permission denied" };
  }
  
  const hasViewPermission = permission.listViewable || 
                          (permission.detailAndSelect && isRelatedList);
                          
  if (!hasViewPermission) {
    return { isValid: false, error: "Permission denied" };
  }
  
  return { isValid: true, permission };
};

/**
 * Check if user is admin based on moduleInfo
 * @param {Object} moduleInfo - Module information from Redis
 * @returns {boolean} - Whether user has admin permissions
 */
const isUserAdmin = (moduleInfo) => {
  if (!moduleInfo || !moduleInfo.permission) return false;
  
  // Check if user has full permissions in the module
  const { permission } = moduleInfo;
  return permission.listViewable && 
         permission.detailView && 
         permission.updateable && 
         permission.createable && 
         permission.deleteable;
};

/**
 * Check GPS permission for Timekeeping module
 * @param {Object} gpsRecord - GPS record
 * @param {string} userId - Current user ID 
 * @param {Object} moduleInfo - Module info from Redis
 * @returns {boolean} - Whether user has permission to view GPS record
 */
const checkGPSPermission = (gpsRecord, userId, moduleInfo) => {
  // Check if user is admin based on moduleInfo
  if (moduleInfo && isUserAdmin(moduleInfo)) {
    return true;
  }
  
  // For non-admin users, check if they're in the allowed employees list and status is active
  const employeesAllow = gpsRecord.employees_allow ? gpsRecord.employees_allow.split(',') : [];
  return employeesAllow.includes(userId.toString()) && gpsRecord.status === '1';
};



const getModuleInfo = async (redis, userRole, moduleName) => {
  if (!redis) return null;
  const redisModuleInfo = await redis.hget(`ERP:ModuleInfo:${userRole}`, moduleName);
  if (redisModuleInfo) {
    return JSON.parse(redisModuleInfo);
  }
  return null;
};

module.exports = {
  checkRecordEditPermission,
  createPermissionFilter,
  validateModulePermissions,
  checkGPSPermission,
  isUserAdmin,
  getModuleInfo
}; 