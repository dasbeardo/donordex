/**
 * DonorDex Filters Module
 * Browse, filter, sort, and pagination logic
 */

const Filters = {
    // Pagination state
    currentPageNum: 1,
    pageSize: '25',
    filteredRecords: [],

    /**
     * Apply filters and sorting to records
     */
    async applyFilters() {
        const committee = document.getElementById('filterCommittee').value.trim().toLowerCase();
        const state = document.getElementById('filterState').value.trim().toUpperCase();
        const employer = document.getElementById('filterEmployer').value.trim().toLowerCase();
        const occupation = document.getElementById('filterOccupation').value.trim().toLowerCase();
        const minAmount = parseFloat(document.getElementById('filterMinAmount').value) || -Infinity;
        const maxAmount = parseFloat(document.getElementById('filterMaxAmount').value) || Infinity;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const sortBy = document.getElementById('sortBy').value;
        this.pageSize = document.getElementById('pageSize').value;

        // Parse date filters
        const startEpoch = startDate ? Utils.parseFecDate(startDate).epoch : -Infinity;
        const endEpoch = endDate ? Utils.parseFecDate(endDate).epoch : Infinity;

        // Get all records from database
        const allRecords = await Database.getAllRecords();

        // Filter records
        this.filteredRecords = allRecords.filter(record => {
            if (committee && !record.candidateName.toLowerCase().includes(committee)) return false;
            if (state && record.state !== state) return false;
            if (employer && !record.employer?.toLowerCase().includes(employer)) return false;
            if (occupation && !record.occupation?.toLowerCase().includes(occupation)) return false;
            if (record.amount < minAmount || record.amount > maxAmount) return false;
            if (startEpoch !== -Infinity && record.contributionEpoch < startEpoch) return false;
            if (endEpoch !== Infinity && record.contributionEpoch > endEpoch) return false;
            return true;
        });

        // Sort records using numeric comparison for dates
        this.filteredRecords.sort((a, b) => {
            switch(sortBy) {
                case 'date-desc':
                    return b.contributionEpoch - a.contributionEpoch;
                case 'date-asc':
                    return a.contributionEpoch - b.contributionEpoch;
                case 'amount-desc':
                    return b.amount - a.amount;
                case 'amount-asc':
                    return a.amount - b.amount;
                case 'name-asc':
                    // Sort by last name first, then first name
                    const lastCompare = a.lastName.localeCompare(b.lastName);
                    return lastCompare !== 0 ? lastCompare : a.firstName.localeCompare(b.firstName);
                case 'name-desc':
                    // Sort by last name first (descending), then first name
                    const lastCompareDesc = b.lastName.localeCompare(a.lastName);
                    return lastCompareDesc !== 0 ? lastCompareDesc : b.firstName.localeCompare(a.firstName);
                case 'committee-asc':
                    return a.candidateName.localeCompare(b.candidateName);
                default:
                    return 0;
            }
        });

        const totalAmount = this.filteredRecords.reduce((sum, r) => sum + r.amount, 0);
        document.getElementById('browseTotal').textContent = `• Total: $${totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        this.currentPageNum = 1;
        this.displayBrowseResults();
    },

    /**
     * Display paginated browse results
     */
    displayBrowseResults() {
        const container = document.getElementById('browseContainer');

        if (this.filteredRecords.length === 0) {
            container.innerHTML = '<div class="no-results">No contributions match your filters</div>';
            document.getElementById('pagination').style.display = 'none';
            document.getElementById('browseCount').textContent = '0';
            return;
        }

        document.getElementById('browseCount').textContent = this.filteredRecords.length.toLocaleString();

        const actualPageSize = this.pageSize === 'all' ? this.filteredRecords.length : parseInt(this.pageSize);
        const totalPages = Math.ceil(this.filteredRecords.length / actualPageSize);
        const startIdx = (this.currentPageNum - 1) * actualPageSize;
        const endIdx = Math.min(startIdx + actualPageSize, this.filteredRecords.length);
        const pageRecords = this.filteredRecords.slice(startIdx, endIdx);

        if (this.pageSize !== 'all' && totalPages > 1) {
            document.getElementById('pagination').style.display = 'flex';
            document.getElementById('currentPage').textContent = this.currentPageNum;
            document.getElementById('totalPages').textContent = totalPages;
            document.getElementById('prevBtn').disabled = this.currentPageNum === 1;
            document.getElementById('nextBtn').disabled = this.currentPageNum === totalPages;
        } else {
            document.getElementById('pagination').style.display = 'none';
        }

        // Build results using XSS-safe escaping
        let html = '';
        pageRecords.forEach(record => {
            const isRefund = record.isRefund || record.amount < 0;
            const fullName = record.firstName + ' ' + record.lastName;
            html += `
            <div class="result-item" style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div class="donor-name">${Utils.escapeHtml(fullName)}${isRefund ? ' <span class="refund-badge">REFUND</span>' : ''}</div>
                    <div style="font-size: 18px; font-weight: 700; color: #174A57;">$${Math.abs(record.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="donation-info">
                    <div class="info-item">
                        <div class="info-label">Committee</div>
                        <div class="info-value">${Utils.escapeHtml(record.candidateName)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Date</div>
                        <div class="info-value">${Utils.escapeHtml(Search.formatDate(record.contributionDate))}</div>
                    </div>`;

            if (record.employer) {
                html += `
                    <div class="info-item">
                        <div class="info-label">Employer</div>
                        <div class="info-value">${Utils.escapeHtml(record.employer)}</div>
                    </div>`;
            }

            if (record.occupation) {
                html += `
                    <div class="info-item">
                        <div class="info-label">Occupation</div>
                        <div class="info-value">${Utils.escapeHtml(record.occupation)}</div>
                    </div>`;
            }

            if (record.city || record.state) {
                const loc = `${record.city || ''}${record.city && record.state ? ', ' : ''}${record.state || ''}`;
                html += `
                    <div class="info-item">
                        <div class="info-label">Location</div>
                        <div class="info-value">${Utils.escapeHtml(loc)}</div>
                    </div>`;
            }

            html += `
                    <div class="info-item">
                        <button class="delete-btn" onclick="App.deleteRecord('${record.id}')">Delete</button>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    },

    /**
     * Clear all filter inputs
     */
    clearFilters() {
        document.getElementById('filterCommittee').value = '';
        document.getElementById('filterState').value = '';
        document.getElementById('filterEmployer').value = '';
        document.getElementById('filterOccupation').value = '';
        document.getElementById('filterMinAmount').value = '';
        document.getElementById('filterMaxAmount').value = '';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('sortBy').value = 'date-desc';
        document.getElementById('browseContainer').innerHTML = '<div class="no-results">Click "Apply Filters" to browse</div>';
        document.getElementById('browseCount').textContent = '0';
        document.getElementById('browseTotal').textContent = '';
        document.getElementById('pagination').style.display = 'none';
    },

    /**
     * Export filtered results to CSV
     */
    exportFiltered() {
        if (this.filteredRecords.length === 0) {
            alert('No filtered records to export. Please apply filters first.');
            return;
        }

        // UTF-8 BOM for Excel compatibility
        let csv = '\uFEFF';
        // Use FEC-style headers for seamless re-import (include importHash for deduplication)
        csv += 'contributor_first_name,contributor_last_name,committee_name,contribution_receipt_date,contribution_receipt_amount,contributor_employer,contributor_occupation,contributor_city,contributor_state,import_hash\n';

        this.filteredRecords.forEach(record => {
            csv += `${Utils.escapeCsvField(record.firstName)},${Utils.escapeCsvField(record.lastName)},${Utils.escapeCsvField(record.candidateName)},${Utils.escapeCsvField(record.contributionDate)},${Utils.escapeCsvField(record.amount)},${Utils.escapeCsvField(record.employer)},${Utils.escapeCsvField(record.occupation)},${Utils.escapeCsvField(record.city)},${Utils.escapeCsvField(record.state)},${Utils.escapeCsvField(record.importHash || '')}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = Utils.getTimestamp();
        a.download = `donordex-filtered-${timestamp}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPageNum > 1) {
            this.currentPageNum--;
            this.displayBrowseResults();
        }
    },

    /**
     * Go to next page
     */
    nextPage() {
        const actualPageSize = this.pageSize === 'all' ? this.filteredRecords.length : parseInt(this.pageSize);
        const totalPages = Math.ceil(this.filteredRecords.length / actualPageSize);
        if (this.currentPageNum < totalPages) {
            this.currentPageNum++;
            this.displayBrowseResults();
        }
    },

    /**
     * Toggle filter form visibility
     */
    toggleFilters() {
        const filterForm = document.getElementById('filterForm');
        const toggleIcon = document.getElementById('filterToggleIcon');

        if (filterForm.style.display === 'none') {
            filterForm.style.display = 'grid';
            toggleIcon.textContent = '▼';
            toggleIcon.style.transform = 'rotate(0deg)';
        } else {
            filterForm.style.display = 'none';
            toggleIcon.textContent = '▶';
            toggleIcon.style.transform = 'rotate(-90deg)';
        }
    }
};

// Export for use in other modules
window.Filters = Filters;
