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

                // Check for updates immediately on load
                registration.update().catch(err => {
                    console.log('Update check failed (might be offline):', err);
                });

                // Check for updates every 60 seconds while app is open
                setInterval(() => {
                    registration.update().catch(err => {
                        console.log('Periodic update check failed:', err);
                    });
                }, 60000);

                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found!');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, show update prompt immediately
                            console.log('New Service Worker installed, prompting user to update');
                            this.showUpdatePrompt();
                        }
                    });
                });

                // Also check if there's a waiting service worker on load
                if (registration.waiting) {
                    console.log('Service Worker update already waiting, prompting user');
                    this.showUpdatePrompt();
                }
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
        const message = 'A new version of DonorDex is available with important updates!\n\n' +
                       'Click OK to reload and get the latest version.\n\n' +
                       '(Your data is safe and will not be lost)';

        if (confirm(message)) {
            // Tell the waiting service worker to skip waiting and activate immediately
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            }
            // Reload after a brief delay to let the service worker activate
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } else {
            // If user declines, show a banner so they can update later
            this.showUpdateBanner();
        }
    },

    /**
     * Show persistent update banner (if user declined the prompt)
     */
    showUpdateBanner() {
        // Check if banner already exists
        if (document.getElementById('updateBanner')) return;

        const banner = document.createElement('div');
        banner.id = 'updateBanner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #174A57 0%, #2a6f7e 100%);
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        `;
        banner.innerHTML = `
            <span>📱 Update available!</span>
            <button onclick="App.showUpdatePrompt()" style="
                background: #56D2B4;
                color: #174A57;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                font-size: 13px;
            ">Update Now</button>
        `;
        document.body.prepend(banner);
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
