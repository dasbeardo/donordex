/**
 * DonorDex Utility Functions
 * Parsing, formatting, and security utilities
 */

const Utils = {
    /**
     * XSS Protection - Escape HTML entities
     * @param {*} input - Input to escape
     * @returns {string} - Escaped string
     */
    escapeHtml(input) {
        const s = String(input ?? '');
        return s.replace(/[&<>"'`=\/]/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#x60;',
            '=': '&#x3D;',
            '/': '&#x2F;'
        }[ch]));
    },

    /**
     * CSV Formula Injection Protection
     * @param {*} val - Value to make safe
     * @returns {string} - Safe value
     */
    safeForCSV(val) {
        let s = String(val ?? '');
        // Prefix dangerous characters with a single quote to prevent formula execution
        if (/^[=+\-@]/.test(s)) {
            s = "'" + s;
        }
        return s;
    },

    /**
     * CSV Export with proper escaping
     * @param {*} val - Field value
     * @returns {string} - Escaped CSV field
     */
    escapeCsvField(val) {
        const s = this.safeForCSV(val);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        return (/[",\n]/.test(s)) ? `"${s.replace(/"/g, '""')}"` : s;
    },

    /**
     * Parse FEC date formats into normalized YYYY-MM-DD
     * Supports: YYYY-MM-DD, MM/DD/YYYY, M/D/YY, YYYYMMDD, datetime strings
     * @param {string} input - Date string
     * @returns {Object} - {ymd: 'YYYY-MM-DD', epoch: timestamp} or {ymd: null, epoch: null}
     */
    parseFecDate(input) {
        const t = String(input || '').trim();
        if (!t) return { ymd: null, epoch: null };

        // Remove time portion if present (e.g., "2024-01-15 00:00:00" -> "2024-01-15")
        const dateOnly = t.split(' ')[0].split('T')[0];

        let y, m, d;

        // Handle YYYY-MM-DD format
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateOnly)) {
            const parts = dateOnly.split('-').map(Number);
            y = parts[0];
            m = parts[1];
            d = parts[2];
        }
        // Handle MM/DD/YYYY format
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateOnly)) {
            const parts = dateOnly.split('/').map(Number);
            m = parts[0];
            d = parts[1];
            y = parts[2];
        }
        // Handle M/D/YY format (2-digit year)
        else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateOnly)) {
            const parts = dateOnly.split('/').map(Number);
            m = parts[0];
            d = parts[1];
            y = parts[2];
            // Assume 20xx for years 00-49, 19xx for 50-99
            y = y + (y < 50 ? 2000 : 1900);
        }
        // Handle YYYYMMDD format (no separators)
        else if (/^\d{8}$/.test(dateOnly)) {
            y = parseInt(dateOnly.substr(0, 4));
            m = parseInt(dateOnly.substr(4, 2));
            d = parseInt(dateOnly.substr(6, 2));
        }
        else {
            // Try to parse as a date object as last resort
            const dateObj = new Date(t);
            if (!isNaN(dateObj.getTime())) {
                y = dateObj.getFullYear();
                m = dateObj.getMonth() + 1;
                d = dateObj.getDate();
            } else {
                return { ymd: null, epoch: null };
            }
        }

        // Validate ranges (be lenient with day to allow Feb 30, etc - Date object will fix it)
        if (!y || y < 1900 || y > 2100 || !m || m < 1 || m > 12 || !d || d < 1 || d > 31) {
            return { ymd: null, epoch: null };
        }

        // Create date and let it normalize (e.g., Feb 30 -> Mar 2)
        const dateObj = new Date(y, m - 1, d);
        const normalizedY = dateObj.getFullYear();
        const normalizedM = dateObj.getMonth() + 1;
        const normalizedD = dateObj.getDate();

        const ymd = `${normalizedY.toString().padStart(4, '0')}-${String(normalizedM).padStart(2, '0')}-${String(normalizedD).padStart(2, '0')}`;
        const epoch = Date.UTC(normalizedY, normalizedM - 1, normalizedD);

        return { ymd, epoch };
    },

    /**
     * Robust CSV Parser - handles quotes, newlines, CRLF, embedded commas
     * @param {string} text - CSV text to parse
     * @returns {Array<Array<string>>} - Array of rows (each row is array of fields)
     */
    parseCSV(text) {
        const rows = [];
        let row = [], field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];

            if (inQuotes) {
                if (ch === '"' && next === '"') {
                    field += '"';
                    i++; // Skip next quote
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    field += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    row.push(field.trim());
                    field = '';
                } else if (ch === '\n') {
                    row.push(field.trim());
                    if (row.some(f => f !== '')) { // Only add non-empty rows
                        rows.push(row);
                    }
                    row = [];
                    field = '';
                } else if (ch === '\r') {
                    // Ignore CR (will handle CRLF via the \n case)
                } else {
                    field += ch;
                }
            }
        }

        // Don't forget the last field and row
        row.push(field.trim());
        if (row.some(f => f !== '')) {
            rows.push(row);
        }

        return rows;
    },

    /**
     * Parse full name into first/last components
     * Handles "Last, First" and "First Last" formats
     * @param {string} fullName - Full name string
     * @returns {Object} - {firstName, lastName}
     */
    parseFullName(fullName) {
        if (!fullName) return { firstName: '', lastName: '' };

        const trimmed = fullName.trim();

        // Check for "Last, First" format
        if (trimmed.includes(',')) {
            const [last, first] = trimmed.split(',').map(s => s.trim());
            return { firstName: first || '', lastName: last || '' };
        }

        // Otherwise assume "First Last" or "First Middle Last" format
        const parts = trimmed.split(' ').filter(p => p.length > 0);
        if (parts.length === 0) {
            return { firstName: '', lastName: '' };
        } else if (parts.length === 1) {
            return { firstName: '', lastName: parts[0] };
        } else {
            // Last word is last name, everything else is first name
            const lastName = parts[parts.length - 1];
            const firstName = parts.slice(0, -1).join(' ');
            return { firstName, lastName };
        }
    },

    /**
     * Generate unique ID for records
     * Uses crypto.randomUUID if available, otherwise fallback
     * @returns {string} - Unique ID
     */
    generateId() {
        return (crypto?.randomUUID?.() || ('id_' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
    },

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Edit distance
     */
    levenshteinDistance(str1, str2) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();

        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[len1][len2];
    },

    /**
     * Calculate similarity score (0-1) between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Similarity score (1 = identical, 0 = completely different)
     */
    similarityScore(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return 1 - (distance / maxLength);
    },

    /**
     * Generate SHA-256 hash of a string (for deduplication)
     * @param {string} str - String to hash
     * @returns {Promise<string>} - Hex-encoded SHA-256 hash
     */
    async sha256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    /**
     * Generate timestamp string for filenames
     * Format: YYYYMMDD-HHMMSS
     * @returns {string} - Timestamp string safe for filenames
     */
    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    }
};

// Export for use in other modules
window.Utils = Utils;
