/**
 * HTML escaping utility — prevents XSS when injecting data into innerHTML
 *
 * Use this for ANY user-generated content inserted into HTML templates.
 * Note content uses DOMPurify + marked (already safe).
 * Everything else (titles, descriptions, languages, code) must go through escape().
 */

/**
 * Escapes a string for safe injection into HTML content or attributes.
 * Converts special HTML characters to their entity equivalents.
 *
 * @param {*} value - Value to escape (will be coerced to string)
 * @returns {string} - HTML-safe string
 *
 * @example
 * escape('<script>alert(1)</script>') // → '&lt;script&gt;alert(1)&lt;/script&gt;'
 * escape('"quoted"')                  // → '&quot;quoted&quot;'
 */
export function escape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
