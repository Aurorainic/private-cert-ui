/**
 * Validation helpers for path parameters.
 *
 * @param {string} name - CA name
 * @returns {boolean}
 */
function isValidCaName(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Validate a certificate serial number (hex string).
 *
 * @param {string} serial
 * @returns {boolean}
 */
function isValidSerial(serial) {
  return /^[0-9A-Fa-f]+$/.test(serial);
}

module.exports = { isValidCaName, isValidSerial };
