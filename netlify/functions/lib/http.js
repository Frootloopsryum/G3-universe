function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function ok(body) {
  return json(200, body);
}

function badRequest(message) {
  return json(400, { error: message });
}

function serverError(message) {
  return json(500, { error: message });
}

function handleOptions(method) {
  if (method !== 'OPTIONS') return null;
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
  };
}

module.exports = {
  json,
  ok,
  badRequest,
  serverError,
  handleOptions,
};
