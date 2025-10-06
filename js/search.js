/**
 * DonorDex Search Module
 * Fuzzy search with Levenshtein distance matching
 */

const Search = {
    // Debounce timer
    searchTimeout: null,

    /**
     * Check if search term fuzzy matches a donor name
     * @param {string} searchTerm - Search query
     * @param {string} firstName - Donor first name
     * @param {string} lastName - Donor last name
     * @param {number} threshold - Similarity threshold (default 0.7)
     * @returns {Object} - {match: boolean, score: number, type: 'exact'|'fuzzy'|'none'}
     */
    isFuzzyMatch(searchTerm, firstName, lastName, threshold = 0.7) {
        searchTerm = searchTerm.toLowerCase();
        const fullName = (firstName + ' ' + lastName).toLowerCase();
        firstName = firstName.toLowerCase();
        lastName = lastName.toLowerCase();

        // Exact substring match on full name
        if (fullName.includes(searchTerm)) {
            return { match: true, score: 1.0, type: 'exact' };
        }

        // Exact match on first or last name separately
        if (firstName.includes(searchTerm) || lastName.includes(searchTerm)) {
            return { match: true, score: 1.0, type: 'exact' };
        }

        // Word-level fuzzy matching
        const donorWords = fullName.split(' ');
        const searchWords = searchTerm.split(' ');

        for (const donorWord of donorWords) {
            for (const searchWord of searchWords) {
                const score = Utils.similarityScore(searchWord, donorWord);
                if (score >= threshold) {
                    return { match: true, score: score, type: 'fuzzy' };
                }
            }
        }

        // Full string fuzzy matching
        if (searchTerm.length >= 3) {
            const fullScore = Utils.similarityScore(searchTerm, fullName);
            if (fullScore >= threshold) {
                return { match: true, score: fullScore, type: 'fuzzy' };
            }
        }

        return { match: false, score: 0, type: 'none' };
    },

    /**
     * Search donors with fuzzy matching and display results
     * Uses 150ms debounce
     */
    async searchDonors() {
        const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
        const resultsContainer = document.getElementById('resultsContainer');

        if (!searchTerm) {
            resultsContainer.innerHTML = '<div class="no-results">Enter a donor name to begin search</div>';
            return;
        }

        // Get all records from database
        const allRecords = await Database.getRecordsForSearch();

        // Apply fuzzy matching
        const results = allRecords.map(record => {
            const matchResult = this.isFuzzyMatch(searchTerm, record.firstName, record.lastName);
            return {
                ...record,
                matchScore: matchResult.score,
                matchType: matchResult.match ? matchResult.type : 'none',
                isMatch: matchResult.match
            };
        }).filter(r => r.isMatch);

        // Sort by match type (exact first) then score
        results.sort((a, b) => {
            if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
            if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
            return b.matchScore - a.matchScore;
        });

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No donors found in DonorDex<br><small style="margin-top: 10px; display: block;">Try adjusting your search term</small></div>';
            return;
        }

        // Group results by donor name
        const groupedResults = {};
        results.forEach(record => {
            const fullName = record.firstName + ' ' + record.lastName;
            if (!groupedResults[fullName]) {
                groupedResults[fullName] = {
                    donations: [],
                    matchType: record.matchType,
                    matchScore: record.matchScore
                };
            }
            groupedResults[fullName].donations.push(record);
        });

        // Render results
        this.renderSearchResults(groupedResults, resultsContainer);
    },

    /**
     * Render search results to DOM
     * @param {Object} groupedResults - Results grouped by donor name
     * @param {HTMLElement} container - Container element
     */
    renderSearchResults(groupedResults, container) {
        container.innerHTML = '';

        Object.keys(groupedResults).forEach(fullName => {
            const group = groupedResults[fullName];
            const donations = group.donations;
            const totalAcrossAll = donations.reduce((sum, d) => sum + d.amount, 0);

            const committees = [...new Set(donations.map(d => d.candidateName))];
            const committeeList = committees.join(', ');

            const location = donations[0].city || donations[0].state
                ? `${donations[0].city || ''}${donations[0].city && donations[0].state ? ', ' : ''}${donations[0].state || ''}`
                : 'Location not available';

            const donorId = Utils.generateId();

            // Create result item
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-item';

            // Build safe HTML
            let html = `<div class="donor-summary" onclick="UI.toggleContributions('${donorId}')">
                <div class="donor-header">
                    <div class="donor-name">${Utils.escapeHtml(fullName)}`;

            if (group.matchType === 'fuzzy') {
                html += `<span class="match-badge">~${Math.round(group.matchScore * 100)}% match</span>`;
            }

            html += `</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="font-size: 20px; font-weight: 800; color: #174A57;">$${totalAcrossAll.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                        <span class="expand-indicator" id="indicator-${donorId}">▼</span>
                    </div>
                </div>
                <div style="font-size: 13px; color: #718096; margin-bottom: 8px; font-weight: 500;">
                    ${donations.length} contribution${donations.length > 1 ? 's' : ''} • ${Utils.escapeHtml(committeeList)}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12px; color: #a0aec0;">
                        📍 ${Utils.escapeHtml(location)}
                    </div>
                    <div style="font-size: 11px; color: #56D2B4; font-style: italic; font-weight: 600;" id="expand-text-${donorId}">
                        Click to expand ↓
                    </div>
                </div>
            </div>

            <div class="contributions-list" id="contributions-${donorId}">`;

            donations.forEach((record, index) => {
                const isRefund = record.isRefund || record.amount < 0;
                html += `
                <div class="contribution-item">
                    <div style="font-size: 11px; color: #a0aec0; margin-bottom: 8px; font-weight: 600;">CONTRIBUTION #${index + 1}${isRefund ? ' <span class="refund-badge">REFUND</span>' : ''}</div>
                    <div class="donation-info">
                        <div class="info-item">
                            <div class="info-label">Committee</div>
                            <div class="info-value">${Utils.escapeHtml(record.candidateName)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Date</div>
                            <div class="info-value">${Utils.escapeHtml(this.formatDate(record.contributionDate))}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Amount</div>
                            <div class="info-value">$${Math.abs(record.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
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

            html += `</div>`;

            resultDiv.innerHTML = html;
            container.appendChild(resultDiv);
        });
    },

    /**
     * Format date for display
     * @param {string} dateString - YYYY-MM-DD date string
     * @returns {string} - Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    /**
     * Debounced search handler
     */
    debouncedSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.searchDonors(), 150);
    }
};

// Export for use in other modules
window.Search = Search;
