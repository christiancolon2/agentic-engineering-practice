/**
 * Checks whether a value looks like a valid email address
 * (non-whitespace text, an "@", a domain, a ".", and a TLD).
 *
 * @param {string} email - The value to test.
 * @returns {boolean} True if the value matches the email pattern, false otherwise.
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Checks whether a value is a string containing at least one non-whitespace character.
 *
 * @param {*} val - The value to test.
 * @returns {boolean} True if the value is a string with non-whitespace content, false otherwise.
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

module.exports = { validateEmail, isNonEmptyString };
