/**
 * DonorDex UI Module
 * Modal controls, FAB menu, and UI state management
 */

const UI = {
    /**
     * Toggle FAB menu visibility
     */
    toggleFabMenu() {
        const menu = document.getElementById('fabMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    },

    /**
     * Close FAB menu
     */
    closeFabMenu() {
        document.getElementById('fabMenu').style.display = 'none';
    },

    /**
     * Open Add Contribution modal
     */
    openAddModal() {
        document.getElementById('addModal').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
    },

    /**
     * Close Add Contribution modal
     */
    closeAddModal() {
        document.getElementById('addModal').style.display = 'none';
        document.getElementById('modalBackdrop').style.display = 'none';
    },

    /**
     * Open Import/Export modal
     */
    openImportExportModal() {
        document.getElementById('importExportModal').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
    },

    /**
     * Close Import/Export modal
     */
    closeImportExportModal() {
        document.getElementById('importExportModal').style.display = 'none';
        document.getElementById('modalBackdrop').style.display = 'none';
    },

    /**
     * Open Committee Manager modal
     */
    async openCommitteeManager() {
        document.getElementById('committeeManagerModal').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
        await this.loadCommitteeList();

        // Setup search box listener
        const searchBox = document.getElementById('committeeSearchBox');
        searchBox.value = '';
        searchBox.oninput = () => this.filterCommitteeList();
    },

    /**
     * Close Committee Manager modal
     */
    closeCommitteeManager() {
        document.getElementById('committeeManagerModal').style.display = 'none';
        document.getElementById('modalBackdrop').style.display = 'none';
    },

    /**
     * Load and display committee list with labels
     */
    async loadCommitteeList() {
        const committees = await Database.getUniqueCommittees();
        const labels = await Database.getAllCommitteeLabels();
        const labelMap = new Map(labels.map(l => [l.committeeName, l.label]));

        this.committeeData = committees.map(name => ({
            name: name,
            label: labelMap.get(name) || null
        }));

        this.renderCommitteeList(this.committeeData);
    },

    /**
     * Render committee list
     * @param {Array} committees - Array of {name, label} objects
     */
    renderCommitteeList(committees) {
        const container = document.getElementById('committeeList');

        if (committees.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #718096;">No committees found</div>';
            return;
        }

        let html = '';
        committees.forEach(committee => {
            const isTeam = committee.label === 'team';
            const isOpp = committee.label === 'opposition';

            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #e2e8f0; gap: 15px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #2c3e50; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${Utils.escapeHtml(committee.name)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button
                            onclick="UI.setLabel('${Utils.escapeHtml(committee.name).replace(/'/g, "\\'")}', 'team')"
                            style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 2px solid; ${isTeam ? 'background: #2563eb; color: white; border-color: #2563eb;' : 'background: white; color: #2563eb; border-color: #2563eb;'}"
                            onmouseover="if(!this.style.background.includes('2563eb')) { this.style.background='#eff6ff'; }"
                            onmouseout="if(!this.style.background.includes('2563eb')) { this.style.background='white'; }"
                        >
                            ${isTeam ? '✓ ' : ''}Team
                        </button>
                        <button
                            onclick="UI.setLabel('${Utils.escapeHtml(committee.name).replace(/'/g, "\\'")}', null)"
                            style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 2px solid; ${!isTeam && !isOpp ? 'background: #6b7280; color: white; border-color: #6b7280;' : 'background: white; color: #6b7280; border-color: #6b7280;'}"
                            onmouseover="if(!this.style.background.includes('6b7280')) { this.style.background='#f3f4f6'; }"
                            onmouseout="if(!this.style.background.includes('6b7280')) { this.style.background='white'; }"
                        >
                            ${!isTeam && !isOpp ? '✓ ' : ''}None
                        </button>
                        <button
                            onclick="UI.setLabel('${Utils.escapeHtml(committee.name).replace(/'/g, "\\'")}', 'opposition')"
                            style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 2px solid; ${isOpp ? 'background: #dc2626; color: white; border-color: #dc2626;' : 'background: white; color: #dc2626; border-color: #dc2626;'}"
                            onmouseover="if(!this.style.background.includes('dc2626')) { this.style.background='#fef2f2'; }"
                            onmouseout="if(!this.style.background.includes('dc2626')) { this.style.background='white'; }"
                        >
                            ${isOpp ? '✓ ' : ''}Opp
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /**
     * Filter committee list based on search input
     */
    filterCommitteeList() {
        const searchTerm = document.getElementById('committeeSearchBox').value.toLowerCase().trim();

        if (!searchTerm) {
            this.renderCommitteeList(this.committeeData);
            return;
        }

        const filtered = this.committeeData.filter(c =>
            c.name.toLowerCase().includes(searchTerm)
        );
        this.renderCommitteeList(filtered);
    },

    /**
     * Set label for a committee
     * @param {string} committeeName - Committee name
     * @param {string|null} label - Label ("team", "opposition", or null to remove)
     */
    async setLabel(committeeName, label) {
        try {
            if (label === null) {
                await Database.removeCommitteeLabel(committeeName);
            } else {
                await Database.setCommitteeLabel(committeeName, label);
            }

            // Update local data
            const committee = this.committeeData.find(c => c.name === committeeName);
            if (committee) {
                committee.label = label;
            }

            // Re-render the list to show updated button states
            this.filterCommitteeList();
        } catch (error) {
            console.error('Error setting label:', error);
            alert('Error setting label. Please try again.');
        }
    },

    /**
     * Close all open modals
     */
    closeAllModals() {
        this.closeAddModal();
        this.closeImportExportModal();
        this.closeCommitteeManager();
    },

    /**
     * Add contribution from modal form
     */
    async addDonorFromModal() {
        // Get values from modal form (with 'modal' prefix to avoid ID conflicts)
        const firstName = document.getElementById('modalFirstName').value.trim();
        const lastName = document.getElementById('modalLastName').value.trim();
        const candidateName = document.getElementById('modalCandidateName').value.trim();
        const contributionDate = document.getElementById('modalContributionDate').value;
        const amount = parseFloat(document.getElementById('modalTotalAmount').value);
        const employer = document.getElementById('modalEmployer').value.trim();
        const occupation = document.getElementById('modalOccupation').value.trim();
        const city = document.getElementById('modalCity').value.trim();
        const state = document.getElementById('modalState').value.trim().toUpperCase();

        if (!firstName || !lastName || !candidateName || !contributionDate || isNaN(amount)) {
            alert('Please fill in all required fields (marked with *)');
            return;
        }

        const { ymd, epoch } = Utils.parseFecDate(contributionDate);
        if (!ymd) {
            alert('Invalid date format. Please use YYYY-MM-DD format.');
            return;
        }

        const newRecord = {
            id: Utils.generateId(),
            firstName: firstName,
            lastName: lastName,
            candidateName: candidateName,
            contributionDate: ymd,
            contributionEpoch: epoch,
            amount: Math.round(amount * 100) / 100,
            isRefund: amount < 0,
            employer: employer,
            occupation: occupation,
            city: city,
            state: state
        };

        await Database.addRecord(newRecord);
        await App.updateStats();
        this.clearModalForm();

        document.getElementById('searchInput').value = firstName + ' ' + lastName;
        await Search.searchDonors();

        this.closeAddModal();
    },

    /**
     * Clear modal form fields
     */
    clearModalForm() {
        document.getElementById('modalFirstName').value = '';
        document.getElementById('modalLastName').value = '';
        document.getElementById('modalCandidateName').value = '';
        document.getElementById('modalContributionDate').value = '';
        document.getElementById('modalTotalAmount').value = '';
        document.getElementById('modalEmployer').value = '';
        document.getElementById('modalOccupation').value = '';
        document.getElementById('modalCity').value = '';
        document.getElementById('modalState').value = '';
    },

    /**
     * Toggle contribution details in search results
     * @param {string} donorId - Donor ID for toggling
     */
    toggleContributions(donorId) {
        const contributionsList = document.getElementById('contributions-' + donorId);
        const indicator = document.getElementById('indicator-' + donorId);
        const expandText = document.getElementById('expand-text-' + donorId);

        if (contributionsList && indicator && expandText) {
            if (contributionsList.classList.contains('expanded')) {
                contributionsList.classList.remove('expanded');
                indicator.classList.remove('expanded');
                expandText.textContent = 'Click to expand ↓';
            } else {
                contributionsList.classList.add('expanded');
                indicator.classList.add('expanded');
                expandText.textContent = 'Click to collapse ↑';
            }
        }
    },

    /**
     * Initialize event listeners for UI
     */
    initializeEventListeners() {
        // Close FAB menu when clicking outside
        document.addEventListener('click', function(e) {
            const fab = document.querySelector('.fab');
            const menu = document.getElementById('fabMenu');
            if (menu && fab && !fab.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        // Search input with debounce
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => Search.debouncedSearch());
        }
    }
};

// Export for use in other modules
window.UI = UI;
