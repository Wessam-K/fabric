// Phase 1.4: Magic byte validation using file-type library
const { fromFile } = require('file-type');
const fs = require('fs');

/**
 * Validate uploaded file's actual content matches allowed MIME types.
 * Uses file-type library for magic byte detection (not just extension/header).
 * @param {string} filePath - Path to the uploaded file
 * @param {string[]} allowedMimes - Array of allowed MIME types (e.g. ['image/jpeg', 'image/png'])
 * @returns {Promise<{valid: boolean, detectedMime: string|null}>}
 */
async function validateFileType(filePath, allowedMimes) {
  try {
    const result = await fromFile(filePath);
    if (!result) {
      // file-type couldn't detect — could be plain text (CSV) or unknown format
      return { valid: false, detectedMime: null };
    }
    return { valid: allowedMimes.includes(result.mime), detectedMime: result.mime };
  } catch {
    return { valid: false, detectedMime: null };
  }
}

/**
 * Validate and remove uploaded file if it fails magic byte check.
 * @param {string} filePath - Path to uploaded file
 * @param {string[]} allowedMimes - Allowed MIME types
 * @returns {Promise<{valid: boolean, detectedMime: string|null}>}
 */
async function validateOrRemove(filePath, allowedMimes) {
  const result = await validateFileType(filePath, allowedMimes);
  if (!result.valid) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  return result;
}

module.exports = { validateFileType, validateOrRemove };
