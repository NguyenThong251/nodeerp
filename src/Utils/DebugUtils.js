const createResponseWithDebug = (createResponse, success, data) => {
  const response = createResponse(success, data);
  response.debug = {
    timestamp: new Date().toISOString(),
    requestInfo: true
  };
  return response;
};

module.exports = {
  createResponseWithDebug
}; 