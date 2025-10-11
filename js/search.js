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
     * Supports wildcards: @team and @opp for filtering by committee label
     * Uses 150ms debounce
     */
    async searchDonors() {
        const rawInput = document.getElementById('searchInput').value.trim();
        const resultsContainer = document.getElementById('resultsContainer');

        if (!rawInput) {
            resultsContainer.innerHTML = '<div class="no-results">Enter a donor name to begin search</div>';
            return;
        }

        // Parse wildcard filter
        let labelFilter = null;
        let searchTerm = rawInput.toLowerCase();

        if (searchTerm.startsWith('@team ') || searchTerm === '@team') {
            labelFilter = 'team';
            searchTerm = searchTerm.replace(/^@team\s*/, '').trim();
        } else if (searchTerm.startsWith('@opp ') || searchTerm === '@opp') {
            labelFilter = 'opposition';
            searchTerm = searchTerm.replace(/^@opp\s*/, '').trim();
        }

        // If only wildcard with no search term, show all contributions for that label
        if (labelFilter && !searchTerm) {
            resultsContainer.innerHTML = `<div class="no-results">Enter a donor name after <code>@${labelFilter === 'team' ? 'team' : 'opp'}</code><br><small style="margin-top: 10px; display: block;">Example: @${labelFilter === 'team' ? 'team' : 'opp'} john smith</small></div>`;
            return;
        }

        // Get all records from database
        const allRecords = await Database.getRecordsForSearch();

        // If label filter is active, get committees with that label
        let labeledCommittees = null;
        if (labelFilter) {
            labeledCommittees = new Set(await Database.getCommitteesByLabel(labelFilter));
        }

        // Apply fuzzy matching
        const results = allRecords.map(record => {
            const matchResult = this.isFuzzyMatch(searchTerm, record.firstName, record.lastName);
            return {
                ...record,
                matchScore: matchResult.score,
                matchType: matchResult.match ? matchResult.type : 'none',
                isMatch: matchResult.match
            };
        }).filter(r => {
            // Filter by name match AND committee label (if applicable)
            if (!r.isMatch) return false;
            if (labelFilter && !labeledCommittees.has(r.candidateName)) return false;
            return true;
        });

        // Sort by match type (exact first) then score
        results.sort((a, b) => {
            if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
            if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
            return b.matchScore - a.matchScore;
        });

        if (results.length === 0) {
            let message = 'No donors found in DonorDex';
            if (labelFilter) {
                const labelText = labelFilter === 'team' ? 'team committees' : 'opposition committees';
                message += ` (${labelText} only)`;
            }
            resultsContainer.innerHTML = `<div class="no-results">${message}<br><small style="margin-top: 10px; display: block;">Try adjusting your search term</small></div>`;
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
        await this.renderSearchResults(groupedResults, resultsContainer, labelFilter);
    },

    /**
     * Render search results to DOM
     * @param {Object} groupedResults - Results grouped by donor name
     * @param {HTMLElement} container - Container element
     * @param {string|null} labelFilter - Active label filter (for messaging)
     */
    async renderSearchResults(groupedResults, container, labelFilter = null) {
        container.innerHTML = '';

        // Load committee labels for badges
        const allLabels = await Database.getAllCommitteeLabels();
        const labelMap = new Map(allLabels.map(l => [l.committeeName, l.label]));

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
                const committeeLabel = labelMap.get(record.candidateName);
                let labelBadge = '';
                if (committeeLabel === 'team') {
                    labelBadge = ' <span style="display: inline-block; padding: 2px 8px; background: #2563eb; color: white; border-radius: 4px; font-size: 10px; font-weight: 700; vertical-align: middle; margin-left: 6px;">TEAM</span>';
                } else if (committeeLabel === 'opposition') {
                    labelBadge = ' <span style="display: inline-block; padding: 2px 8px; background: #dc2626; color: white; border-radius: 4px; font-size: 10px; font-weight: 700; vertical-align: middle; margin-left: 6px;">OPP</span>';
                }

                html += `
                <div class="contribution-item">
                    <div style="font-size: 11px; color: #a0aec0; margin-bottom: 8px; font-weight: 600;">CONTRIBUTION #${index + 1}${isRefund ? ' <span class="refund-badge">REFUND</span>' : ''}</div>
                    <div class="donation-info">
                        <div class="info-item">
                            <div class="info-label">Committee</div>
                            <div class="info-value">${Utils.escapeHtml(record.candidateName)}${labelBadge}</div>
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
