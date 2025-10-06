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
     * Close all open modals
     */
    closeAllModals() {
        this.closeAddModal();
        this.closeImportExportModal();
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
