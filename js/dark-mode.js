/**
 * DonorDex Dark Mode Module
 * Handles dark mode toggle, persistence, and system preference detection
 */

const DarkMode = {
    /**
     * Initialize dark mode
     * - Check localStorage for saved preference
     * - Fall back to system preference
     * - Set up toggle button
     */
    initialize() {
        // Check for saved preference, otherwise use system preference
        const savedMode = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Apply dark mode if saved preference is 'enabled' or if no preference and system prefers dark
        if (savedMode === 'enabled' || (!savedMode && prefersDark)) {
            this.enable();
        }

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't set a manual preference
            if (!localStorage.getItem('darkMode')) {
                if (e.matches) {
                    this.enable();
                } else {
                    this.disable();
                }
            }
        });

        // Set up toggle button event listener
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    },

    /**
     * Enable dark mode
     */
    enable() {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
        this.updateIcon(true);
    },

    /**
     * Disable dark mode
     */
    disable() {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
        this.updateIcon(false);
    },

    /**
     * Toggle dark mode
     */
    toggle() {
        if (document.body.classList.contains('dark-mode')) {
            this.disable();
        } else {
            this.enable();
        }
    },

    /**
     * Update toggle button icon
     * @param {boolean} isDark - Whether dark mode is enabled
     */
    updateIcon(isDark) {
        const icon = document.getElementById('darkModeIcon');
        if (icon) {
            icon.textContent = isDark ? '☀️' : '🌙';
        }
    },

    /**
     * Check if dark mode is currently enabled
     * @returns {boolean}
     */
    isEnabled() {
        return document.body.classList.contains('dark-mode');
    }
};

// Export for use in other modules
window.DarkMode = DarkMode;
