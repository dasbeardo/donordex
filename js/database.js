/**
 * DonorDex Database Module
 * IndexedDB wrapper using Dexie.js for contribution records
 */

// Initialize Dexie database
const db = new Dexie('DonorDexDB');

// Define schema
db.version(1).stores({
    contributions: '&id, lastName, candidateName, contributionDate, contributionEpoch, amount, state, employer, occupation, entityType'
});

// Schema v2: Add importHash for deduplication
db.version(2).stores({
    contributions: '&id, lastName, candidateName, contributionDate, contributionEpoch, amount, state, employer, occupation, entityType, importHash'
});

/**
 * Database operations
 */
const Database = {
    /**
     * Add a single contribution record
     * @param {Object} record - Contribution record object
     * @returns {Promise<string>} - ID of added record
     */
    async addRecord(record) {
        return await db.contributions.add(record);
    },

    /**
     * Add multiple contribution records in bulk
     * @param {Array} records - Array of contribution records
     * @returns {Promise<string>} - Last key added
     */
    async bulkAdd(records) {
        return await db.contributions.bulkAdd(records);
    },

    /**
     * Delete a single record by ID
     * @param {string} id - Record ID
     * @returns {Promise<void>}
     */
    async deleteRecord(id) {
        return await db.contributions.delete(id);
    },

    /**
     * Delete all records
     * @returns {Promise<void>}
     */
    async clearAll() {
        return await db.contributions.clear();
    },

    /**
     * Get all contribution records
     * @returns {Promise<Array>} - Array of all records
     */
    async getAllRecords() {
        return await db.contributions.toArray();
    },

    /**
     * Get total count of records
     * @returns {Promise<number>}
     */
    async getCount() {
        return await db.contributions.count();
    },

    /**
     * Query records with filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} - Filtered records
     */
    async queryRecords(filters = {}) {
        let collection = db.contributions;

        // Apply filters
        if (filters.committee) {
            collection = collection.filter(r =>
                r.candidateName.toLowerCase().includes(filters.committee.toLowerCase())
            );
        }

        if (filters.state) {
            collection = collection.filter(r =>
                r.state && r.state.toUpperCase() === filters.state.toUpperCase()
            );
        }

        if (filters.employer) {
            collection = collection.filter(r =>
                r.employer && r.employer.toLowerCase().includes(filters.employer.toLowerCase())
            );
        }

        if (filters.occupation) {
            collection = collection.filter(r =>
                r.occupation && r.occupation.toLowerCase().includes(filters.occupation.toLowerCase())
            );
        }

        if (filters.minAmount !== undefined && filters.minAmount !== '') {
            const min = parseFloat(filters.minAmount);
            collection = collection.filter(r => r.amount >= min);
        }

        if (filters.maxAmount !== undefined && filters.maxAmount !== '') {
            const max = parseFloat(filters.maxAmount);
            collection = collection.filter(r => r.amount <= max);
        }

        if (filters.fromDate) {
            collection = collection.filter(r => r.contributionDate >= filters.fromDate);
        }

        if (filters.toDate) {
            collection = collection.filter(r => r.contributionDate <= filters.toDate);
        }

        return await collection.toArray();
    },

    /**
     * Search records by name (first, last, or full)
     * Used by fuzzy search - returns all records for client-side matching
     * @returns {Promise<Array>} - All records for searching
     */
    async getRecordsForSearch() {
        return await db.contributions.toArray();
    },

    /**
     * Get unique values for a field (for filter dropdowns/stats)
     * @param {string} field - Field name
     * @returns {Promise<Array>} - Unique values
     */
    async getUniqueValues(field) {
        const records = await db.contributions.toArray();
        const values = new Set();
        records.forEach(r => {
            if (r[field]) values.add(r[field]);
        });
        return Array.from(values).sort();
    },

    /**
     * Get statistics for dashboard
     * @returns {Promise<Object>} - Stats object
     */
    async getStats() {
        const records = await db.contributions.toArray();

        const uniqueContributors = new Set();
        const uniqueCommittees = new Set();

        records.forEach(r => {
            if (r.lastName) {
                uniqueContributors.add(r.lastName.toLowerCase());
            }
            if (r.candidateName) {
                uniqueCommittees.add(r.candidateName);
            }
        });

        return {
            totalRecords: records.length,
            uniqueContributors: uniqueContributors.size,
            uniqueCommittees: uniqueCommittees.size
        };
    },

    /**
     * Check if an import hash already exists (for deduplication)
     * @param {string} hash - SHA-256 hash to check
     * @returns {Promise<boolean>} - True if hash exists
     */
    async hashExists(hash) {
        if (!hash) return false;
        const record = await db.contributions.where('importHash').equals(hash).first();
        return !!record;
    },

    /**
     * Get all existing import hashes (for bulk deduplication check)
     * @returns {Promise<Set>} - Set of all import hashes
     */
    async getExistingHashes() {
        const records = await db.contributions.toArray();
        const hashes = new Set();
        records.forEach(r => {
            if (r.importHash) hashes.add(r.importHash);
        });
        return hashes;
    }
};

// Export for use in other modules
window.Database = Database;
window.db = db;
