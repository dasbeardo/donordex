/**
 * DonorDex Main Application Controller
 * Initialization, stats updates, and coordination between modules
 */

const App = {
    // PWA install prompt event
    deferredPrompt: null,

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Initialize dark mode FIRST (before any rendering)
            DarkMode.initialize();

            // Initialize Dexie database
            await db.open();
            console.log('Database initialized successfully');

            // Register service worker for PWA support
            await this.registerServiceWorker();

            // Setup PWA install prompt
            this.setupInstallPrompt();

            // Update stats on load
            await this.updateStats();

            // Initialize UI event listeners
            UI.initializeEventListeners();

            console.log('DonorDex initialized successfully');
        } catch (error) {
            console.error('Error initializing DonorDex:', error);
            alert('Error initializing database. Please refresh the page.');
        }
    },

    /**
     * Register service worker for offline support
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, show update prompt
                            this.showUpdatePrompt();
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    },

    /**
     * Setup PWA install prompt
     */
    setupInstallPrompt() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            // Show install button/banner
            this.showInstallBanner();
        });

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed successfully');
            this.deferredPrompt = null;
            this.hideInstallBanner();
        });
    },

    /**
     * Show install banner
     */
    showInstallBanner() {
        const banner = document.getElementById('installBanner');
        if (banner) {
            banner.style.display = 'flex';
        }
    },

    /**
     * Hide install banner
     */
    hideInstallBanner() {
        const banner = document.getElementById('installBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    },

    /**
     * Trigger PWA install
     */
    async installPWA() {
        if (!this.deferredPrompt) {
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        // Clear the deferred prompt
        this.deferredPrompt = null;
        this.hideInstallBanner();
    },

    /**
     * Show update prompt for new service worker
     */
    showUpdatePrompt() {
        if (confirm('A new version of DonorDex is available. Reload to update?')) {
            window.location.reload();
        }
    },

    /**
     * Update dashboard statistics
     */
    async updateStats() {
        const stats = await Database.getStats();

        document.getElementById('totalDonors').textContent = stats.uniqueContributors;
        document.getElementById('totalRecords').textContent = stats.totalRecords;
        document.getElementById('totalCandidates').textContent = stats.uniqueCommittees;
    },

    /**
     * Delete a single record
     * @param {string} id - Record ID to delete
     */
    async deleteRecord(id) {
        if (confirm('Are you sure you want to delete this record?')) {
            await Database.deleteRecord(id);
            await this.updateStats();

            // Refresh search if there's a search term
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value.trim()) {
                await Search.searchDonors();
            }

            // Refresh filters if they're active
            if (Filters.filteredRecords.length > 0) {
                await Filters.applyFilters();
            }
        }
    },

    /**
     * Clear all data from database
     */
    async clearAllData() {
        if (confirm('Are you sure you want to clear all DonorDex records? This cannot be undone.')) {
            await Database.clearAll();
            Filters.filteredRecords = [];
            await this.updateStats();

            document.getElementById('searchInput').value = '';
            document.getElementById('resultsContainer').innerHTML = '<div class="no-results">Enter a donor name to begin search</div>';
            document.getElementById('browseContainer').innerHTML = '<div class="no-results">Click "Apply Filters" to browse</div>';
            document.getElementById('browseCount').textContent = '0';
            document.getElementById('browseTotal').textContent = '';
            document.getElementById('pagination').style.display = 'none';

            alert('All records cleared successfully.');
        }
    }
};

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.initialize());
} else {
    App.initialize();
}

// Export for use in other modules
window.App = App;
