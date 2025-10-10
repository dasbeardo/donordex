/**
 * DonorDex Dark Mode Module
 * Automatically follows system dark mode preference
 *
 * CURRENTLY DISABLED - Code preserved for future implementation
 */

const DarkMode = {
    /**
     * Initialize dark mode based on system preference
     * DISABLED: Currently does nothing
     */
    initialize() {
        // Dark mode disabled - keeping code for future use
        console.log('[Dark Mode] Currently disabled');

        /* DISABLED CODE - Uncomment to re-enable:

        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Apply dark mode if system prefers it
        if (prefersDark) {
            document.body.classList.add('dark-mode');
        }

        // Listen for system preference changes and update automatically
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });

        */
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
