# DonorDex Technical Documentation

## Project Overview

**DonorDex** is a **Progressive Web App (PWA)** for managing and analyzing political contribution data from FEC (Federal Election Commission) CSV files. It's a client-side only application (no backend) that runs entirely in the browser with **IndexedDB persistence via Dexie.js**. Can be installed on macOS, iOS, Android, and Windows as a standalone app with full offline support.

**Tagline**: "Gotta track 'em all!" - A Pokémon-themed political contribution tracker

## Architecture

### Modular Structure

DonorDex uses a modular JavaScript architecture with separate files for different concerns:

```
donordex/
├── index.html              # Main HTML structure with PWA meta tags
├── sw.js                   # Service Worker for offline support
├── manifest.json           # Web App Manifest for PWA
├── icon.svg                # Pokédex logo icon (SVG)
├── generate-icons.html     # Icon generator tool
├── PWA-INSTALL.md          # Installation guide for all platforms
├── css/
│   └── styles.css          # All styles (extracted from inline)
├── js/
│   ├── database.js         # Dexie.js IndexedDB setup & CRUD operations
│   ├── utils.js            # Parsing, formatting, security utilities
│   ├── search.js           # Fuzzy search with Levenshtein matching
│   ├── filters.js          # Browse, filter, sort & pagination
│   ├── import-export.js    # CSV import/export with smart merge
│   ├── ui.js               # Modal & FAB menu controls
│   └── app.js              # Main controller & initialization + PWA logic
├── lib/
│   └── dexie.min.js        # Dexie.js v3.2.4 (IndexedDB wrapper)
└── icons/
    ├── icon-16.png         # Favicon
    ├── icon-32.png         # Favicon
    ├── icon-72.png         # iOS/Android
    ├── icon-96.png         # Shortcuts
    ├── icon-128.png        # PWA
    ├── icon-144.png        # Windows tile
    ├── icon-152.png        # iOS
    ├── icon-180.png        # Apple touch icon
    ├── icon-192.png        # PWA (maskable)
    ├── icon-384.png        # PWA
    └── icon-512.png        # PWA (maskable) + splash screen
```

## Core Functionality

### 1. **Data Import**
- Import via modal popup accessed through FAB menu
- Upload FEC CSV files or paste CSV text directly
- Supports multiple FEC CSV formats with flexible column detection
- Three import modes:
  - **Smart merge**: Combines earmarked contributions (uses transaction IDs to merge IND + PAC/PTY records)
  - **Individual donors only**: Filters to only `entity_type = 'IND'`
  - **Import all**: Includes refunds and all entity types
- Import preview before confirming
- Manual column mapping available if auto-detection fails

### 2. **Search**
- Always-visible search section at top of page
- Fuzzy search using Levenshtein distance algorithm with 150ms debounce
- Similarity threshold of 70% for matching
- Searches on first name, last name, or full name
- Groups contributions by donor name
- Shows match confidence percentage for fuzzy matches
- Expandable cards showing all contributions per donor

### 3. **Browse & Filter**
- Collapsible filter section (collapsed by default)
- Multi-criteria filtering:
  - Committee name
  - State
  - Employer
  - Occupation
  - Amount range (min/max)
  - Date range (from/to)
- Sorting options: date, amount, name (by last name), committee
- Pagination with configurable page sizes (25, 50, 100, or all)
- Export filtered results to CSV
- Results always visible below filter controls

### 4. **Manual Entry**
- Add via modal popup accessed through FAB menu
- Required fields: first name, last name, committee, date, amount
- Optional fields: employer, occupation, city, state
- Form validation ensures all required fields are completed

### 5. **Data Export**
- Export via Import/Export modal (accessed through FAB menu)
- Export all records to CSV
- Export filtered results to CSV
- UTF-8 BOM included for Excel compatibility
- CSV formula injection protection

### 6. **Data Persistence**
- **IndexedDB via Dexie.js** for unlimited storage capacity
- No more 5MB limit - can handle 100k+ records easily
- Instant writes (no debouncing needed)
- Auto-load on page load
- Manual "Clear All" option via FAB menu

### 7. **Progressive Web App (PWA)**
- **Installable** on macOS, iOS, Android, and Windows
- **Offline support** via Service Worker
- **Cached assets** for instant loading
- **Standalone mode** - runs without browser UI
- **Auto-updates** with user prompt
- **Install banner** - prompts users to install
- **App shortcuts** - quick actions for Search & Import (Android/Windows)
- **iOS optimized** - Full home screen support with custom icon

## Technical Architecture

### Data Structure

Each contribution record contains:
```javascript
{
    id: string,              // Unique ID (crypto.randomUUID or fallback)
    firstName: string,       // Donor first name
    lastName: string,        // Donor last name
    candidateName: string,   // Committee/candidate name
    contributionDate: string, // YYYY-MM-DD format
    contributionEpoch: number, // UTC timestamp for sorting
    amount: number,           // Rounded to 2 decimals
    isRefund: boolean,        // true if amount < 0
    employer: string,
    occupation: string,
    city: string,
    state: string,           // 2-letter uppercase
    entityType: string,      // Optional (IND, PAC, PTY)
    transactionId: string    // Optional (for earmarked merging)
}
```

### Storage (IndexedDB via Dexie.js)

**Database Name:** `DonorDexDB`

**Object Store:** `contributions`

**Indexes:**
- Primary key: `&id` (unique)
- Indexed fields: `lastName`, `candidateName`, `contributionDate`, `contributionEpoch`, `amount`, `state`, `employer`, `occupation`, `entityType`

**State Management:**
- No in-memory arrays - all queries go to IndexedDB
- `filteredRecords[]` - Temporary array for pagination in filters.js
- `pendingImportData` - Staging area for preview before import (in import-export.js)

### Module Responsibilities

**1. database.js (`Database` object)**
- Dexie database initialization
- CRUD operations: `addRecord()`, `bulkAdd()`, `deleteRecord()`, `clearAll()`
- Query operations: `getAllRecords()`, `queryRecords()`, `getRecordsForSearch()`
- Statistics: `getStats()`, `getCount()`, `getUniqueValues()`

**2. utils.js (`Utils` object)**
- `escapeHtml()` - XSS protection
- `safeForCSV()`, `escapeCsvField()` - CSV injection protection
- `parseFecDate()` - Date normalization (multiple formats supported)
- `parseCSV()` - Robust CSV parser (handles quotes, newlines, escaping)
- `parseFullName()` - Name parsing ("Last, First" or "First Last")
- `generateId()` - Unique ID generation
- `levenshteinDistance()`, `similarityScore()` - Fuzzy matching

**3. search.js (`Search` object)**
- `searchDonors()` - Main search function (async, queries IndexedDB)
- `isFuzzyMatch()` - Fuzzy matching with 70% threshold
- `renderSearchResults()` - Build search result HTML
- `formatDate()` - Date display formatting
- `debouncedSearch()` - Debounced search handler (150ms)

**4. filters.js (`Filters` object)**
- `applyFilters()` - Filter, sort, and paginate records (async)
- `displayBrowseResults()` - Render paginated browse view
- `clearFilters()` - Reset all filter inputs
- `exportFiltered()` - Export filtered subset to CSV
- `toggleFilters()` - Collapse/expand filter form
- `previousPage()`, `nextPage()` - Pagination controls

**5. import-export.js (`ImportExport` object)**
- `smartImport()` - CSV import with auto-detection and preview
- `handleFileUpload()` - File upload handling
- `findColumnIdx()` - Column pattern matching
- `showImportPreview()` - Display import preview
- `confirmImport()` - Execute import to IndexedDB (async)
- `cancelImport()` - Cancel pending import
- `exportData()` - Export all records to CSV (async)
- `showManualMapper()` - Manual column selection UI
- Column patterns for FEC CSV formats

**6. ui.js (`UI` object)**
- `toggleFabMenu()`, `closeFabMenu()` - FAB menu controls
- `openAddModal()`, `closeAddModal()` - Add contribution modal
- `openImportExportModal()`, `closeImportExportModal()` - Import/Export modal
- `closeAllModals()` - Close all modals
- `addDonorFromModal()` - Add contribution from modal (async)
- `clearModalForm()` - Reset modal form fields
- `toggleContributions()` - Expand/collapse donor details
- `initializeEventListeners()` - Setup event handlers

**7. app.js (`App` object)**
- `initialize()` - App initialization (async)
  - Opens Dexie database
  - Registers service worker for PWA
  - Sets up install prompt listeners
  - Updates stats on load
  - Initializes UI event listeners
- `registerServiceWorker()` - Register service worker for offline support (async)
- `setupInstallPrompt()` - Setup PWA install prompt listeners
- `showInstallBanner()` - Display PWA install banner
- `hideInstallBanner()` - Hide PWA install banner
- `installPWA()` - Trigger PWA installation (async)
- `showUpdatePrompt()` - Show update prompt for new service worker
- `updateStats()` - Refresh dashboard statistics (async)
- `deleteRecord(id)` - Delete single record (async)
- `clearAllData()` - Clear all data with confirmation (async)

## Key Features Implementation

### 1. **CSV Parsing (`Utils.parseCSV`)**
- Custom parser that handles:
  - Quoted fields with embedded commas
  - Quoted fields with embedded newlines
  - Double-quote escaping (`""`)
  - CRLF and LF line endings
  - Empty rows (skipped)

### 2. **Date Parsing (`Utils.parseFecDate`)**
Supports multiple formats:
- `YYYY-MM-DD`
- `MM/DD/YYYY`
- `M/D/YY` (assumes 20xx for years < 50, 19xx otherwise)
- `YYYYMMDD` (no separators)
- Datetime strings (strips time portion)

Returns object with:
- `ymd`: Normalized YYYY-MM-DD string
- `epoch`: UTC timestamp for sorting

### 3. **Column Detection (`ImportExport.findColumnIdx`)**

Uses pattern matching against known FEC column names:
```javascript
COLUMN_PATTERNS = {
    firstName: ['contributor_first_name', 'first_name', 'fname', ...],
    lastName: ['contributor_last_name', 'last_name', 'lname', ...],
    fullName: ['contributor_name', 'donor_name', 'name', ...],
    committee: ['committee_name', 'recipient_name', ...],
    date: ['contribution_receipt_date', 'transaction_date', ...],
    amount: ['contribution_receipt_amount', 'transaction_amount', ...],
    // ... plus entity, tranId, employer, occupation, city, state
}
```

Matches headers using case-insensitive substring matching.

### 4. **Name Parsing (`Utils.parseFullName`)**
Handles multiple name formats:
- "Last, First" format (splits on comma)
- "First Last" format (last word is last name)
- "First Middle Last" format (everything except last word is first name)
- Single name (assigned to lastName)

### 5. **Smart Merge Algorithm**

For earmarked contributions (when entity_type and transaction_id columns exist):

1. Group records by base transaction ID (strips trailing 'E')
2. Find IND (individual) and conduit (PAC/PTY) records in each group
3. If both exist:
   - Use individual's name/employer/occupation/amount
   - Use conduit's date (when donation reached final committee)
4. If only one record in group, import as-is

### 6. **Fuzzy Search (`Utils.levenshteinDistance` + `Search.isFuzzyMatch`)**

- Calculates edit distance between strings
- Converts to similarity score (0-1)
- Matches on:
  - Exact substring match (score: 1.0)
  - Word-level fuzzy match (≥70% similarity)
  - Full string fuzzy match (≥70% similarity)
- Results sorted by match type (exact first) then score

### 7. **Security Features**

**XSS Protection:**
- `Utils.escapeHtml()` - Escapes all HTML entities in user input
- Applied to all dynamic content rendering
- Character escaping: `& < > " ' ` = /`

**CSV Injection Protection:**
- `Utils.safeForCSV()` - Prefixes formulas with single quote
- Prevents execution of cells starting with: `= + - @`
- `Utils.escapeCsvField()` - Properly quotes/escapes CSV fields

**No Dangerous APIs:**
- No `eval()`, `innerHTML` with unescaped data, or `document.write()`
- Uses DOM methods for dynamic content where possible

### 8. **PWA Implementation**

**Service Worker (sw.js):**
- Cache-first strategy for static assets
- Cache name versioning for updates: `donordex-v1`
- Caches all HTML, CSS, JS, Dexie.js library, and manifest files
- Runtime fetch with cache fallback
- Install event: Pre-caches all static assets
- Activate event: Cleans up old caches
- Fetch event: Serves from cache first, falls back to network

**Web App Manifest (manifest.json):**
- `display: "standalone"` - Removes browser UI
- `theme_color` and `background_color`: `#174A57` (brand teal)
- 12 icon sizes (16px to 512px) for all platforms
- Shortcuts for Search and Import (Android/Windows)
- Categories: politics, finance, productivity
- Display override: standalone → minimal-ui → browser

**Install Prompt Flow:**
1. Browser fires `beforeinstallprompt` event
2. App prevents default and stores event in `App.deferredPrompt`
3. Shows custom install banner at top of page
4. User clicks "Install" → triggers `App.installPWA()`
5. Shows native browser install dialog
6. On success, hides banner and clears deferred prompt
7. `appinstalled` event fires on successful installation

**Update Detection:**
- Service worker detects new versions via `updatefound` event
- Shows confirmation dialog when new version is available
- User clicks "Reload" → `window.location.reload()` activates new worker
- Seamless update process without losing data (IndexedDB persists)

**iOS-Specific Optimizations:**
- `apple-mobile-web-app-capable: yes` meta tag
- `apple-mobile-web-app-status-bar-style: black-translucent`
- Dedicated 180x180 apple-touch-icon
- Viewport meta with `viewport-fit=cover` for notch support

## UI Structure

### PWA Install Banner
- **Fixed position** at top of page (shows only when installation available)
- **Install button** - Triggers PWA installation prompt
- **Dismiss button** - Hides banner ("Later")
- Auto-hides after successful installation

### Header
- **Pokédex-themed logo** (80x80px SVG) with animated power light
- **Title**: "DonorDex" with gradient styling
- **Tagline**: "Gotta track 'em all!"

### Statistics Bar
Below header with right-aligned stats:
- Total unique contributors (by last name)
- Total contributions count
- Total unique committees

### Main Sections
1. **Search** - Always visible, auto-completes as you type
2. **Browse & Filter** - Collapsible (collapsed by default), results always visible

### Floating Action Button (FAB)
Bottom-right menu button with 3 options:
- ➕ Add Contribution (opens modal)
- 📁 Import/Export (opens modal)
- 🗑️ Clear All (confirmation required)

### Import Preview Workflow (within modal)
1. User uploads file or pastes CSV in Import/Export modal
2. Select import mode (Smart merge, Individuals only, or All)
3. Click "Process Import" → shows preview within modal
4. Preview displays:
   - Detected column mapping
   - Import mode description
   - First 3 records
   - Error list (if any)
5. User can:
   - Confirm import
   - Adjust mapping (opens manual mapper within modal)
   - Cancel

### Manual Mapping (within modal)
- Shown if auto-detection fails or user clicks "Manual Mapping"
- Dropdown selectors for each required column
- Supports both separate first/last name columns and combined full name column
- Optional "Remember mapping" checkbox for future imports

## Styling & Design

**Theme:**
- Primary color: `#174A57` (dark teal)
- Accent color: `#56D2B4` (mint green)
- Gradients used throughout for modern look
- Responsive design with mobile-first approach

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1023px
- Desktop: ≥ 1024px

**Special Badges:**
- Yellow "match badge" for fuzzy search results with % score
- Red "refund badge" for negative amounts

## API Reference

### Database Module (`Database`)
All functions return Promises (async operations):

- `Database.addRecord(record)` - Add single record
- `Database.bulkAdd(records)` - Bulk import records
- `Database.deleteRecord(id)` - Delete by ID
- `Database.clearAll()` - Delete all records
- `Database.getAllRecords()` - Get all records
- `Database.getCount()` - Get total count
- `Database.queryRecords(filters)` - Query with filters
- `Database.getRecordsForSearch()` - Get all for search
- `Database.getStats()` - Get dashboard statistics
- `Database.getUniqueValues(field)` - Get unique values for field

### Utils Module (`Utils`)
Pure utility functions (synchronous):

- `Utils.escapeHtml(input)` - XSS prevention
- `Utils.safeForCSV(val)` - CSV injection prevention
- `Utils.escapeCsvField(val)` - CSV field escaping
- `Utils.parseFecDate(input)` - Parse date to {ymd, epoch}
- `Utils.parseCSV(text)` - Parse CSV text to array
- `Utils.parseFullName(fullName)` - Parse to {firstName, lastName}
- `Utils.generateId()` - Generate unique ID
- `Utils.levenshteinDistance(str1, str2)` - Calculate edit distance
- `Utils.similarityScore(str1, str2)` - Calculate similarity (0-1)

### Search Module (`Search`)
- `Search.searchDonors()` - Execute fuzzy search (async)
- `Search.isFuzzyMatch(term, first, last, threshold)` - Check match
- `Search.renderSearchResults(results, container)` - Render results
- `Search.formatDate(dateString)` - Format date for display
- `Search.debouncedSearch()` - Debounced search handler

### Filters Module (`Filters`)
- `Filters.applyFilters()` - Apply filters and sort (async)
- `Filters.displayBrowseResults()` - Render paginated results
- `Filters.clearFilters()` - Reset filter form
- `Filters.exportFiltered()` - Export filtered CSV
- `Filters.previousPage()` - Go to previous page
- `Filters.nextPage()` - Go to next page
- `Filters.toggleFilters()` - Toggle filter form visibility

### ImportExport Module (`ImportExport`)
- `ImportExport.handleFileUpload(event)` - Handle file upload
- `ImportExport.smartImport()` - Process import with auto-detection
- `ImportExport.showImportPreview(data, errors, mapping, mode)` - Show preview
- `ImportExport.confirmImport()` - Confirm and execute import (async)
- `ImportExport.cancelImport()` - Cancel pending import
- `ImportExport.exportData()` - Export all to CSV (async)
- `ImportExport.showManualMapper()` - Show manual column mapper

### UI Module (`UI`)
- `UI.toggleFabMenu()` - Toggle FAB menu
- `UI.closeFabMenu()` - Close FAB menu
- `UI.openAddModal()` - Open add modal
- `UI.closeAddModal()` - Close add modal
- `UI.openImportExportModal()` - Open import/export modal
- `UI.closeImportExportModal()` - Close import/export modal
- `UI.closeAllModals()` - Close all modals
- `UI.addDonorFromModal()` - Add from modal form (async)
- `UI.clearModalForm()` - Clear modal form
- `UI.toggleContributions(donorId)` - Toggle contribution details
- `UI.initializeEventListeners()` - Setup event listeners

### App Module (`App`)
- `App.initialize()` - Initialize application (async)
- `App.updateStats()` - Update dashboard stats (async)
- `App.deleteRecord(id)` - Delete record (async)
- `App.clearAllData()` - Clear all data (async)

## Known Limitations

1. **Client-side only** - No backend, everything runs in browser
2. **No user authentication** - Public access to anyone with URL
3. **Browser-specific** - Data not synced across browsers or devices (PWA data is per-device)
4. **Browser compatibility** - Requires IndexedDB and Service Worker support (all modern browsers)
5. **HTTPS required** - PWA features require HTTPS (or localhost for development)

## Benefits of IndexedDB Migration

1. **No storage limits** - Handle 100k+ records easily (vs 20k-30k with localStorage)
2. **Better performance** - Indexed queries are much faster than array filtering
3. **Instant writes** - No need for debounced saves
4. **Transactions** - Bulk operations are atomic
5. **Future-proof** - Easy to add new indexes and schema migrations

## Browser Compatibility

**Minimum Requirements:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support (all modern browsers)
- IndexedDB support (all modern browsers)
- Service Worker support (required for PWA features)
- Uses `crypto.randomUUID()` with fallback
- No polyfills included

**PWA Installation Support:**
- **Safari:** iOS 11.3+ / macOS 11.1+
- **Chrome:** Version 73+
- **Edge:** Version 79+
- **Firefox:** Version 44+ (limited PWA support)

**HTTPS Requirement:**
- Service workers require HTTPS for security
- `localhost` works without HTTPS for development
- `file://` protocol does NOT support service workers

## File Size & Performance

- Total size: ~150KB (HTML + CSS + JS modules + Service Worker)
- External dependency: Dexie.js (~80KB minified)
- Service Worker cache: ~100KB (all static assets)
- Renders 1000+ records smoothly with pagination
- Fuzzy search debounced (150ms) for better performance
- Can handle 100k+ records without performance issues
- IndexedDB queries are highly optimized with indexes
- **Offline support:** All static assets cached, data persists in IndexedDB
- **Fast startup:** Cached assets load instantly when installed as PWA

## Future Enhancement Opportunities

1. Implement data validation rules (e.g., FEC contribution limits)
2. Add contribution limit warnings and aggregation by election cycle
3. Chart/visualization features (donor trends, geographic heat maps)
4. Advanced duplicate detection and merge capabilities
5. Backend API for multi-user access and cloud sync
6. Advanced reporting/analytics dashboard
7. Bulk edit capabilities
8. Import history/audit log
9. Address normalization and geocoding
10. Export to other formats (JSON, Excel, PDF reports)
11. ~~Offline PWA support with service workers~~ ✅ **COMPLETED**
12. Advanced search with boolean operators and field-specific queries
13. Background sync for data updates when back online
14. Push notifications for contribution updates (requires backend)
15. Periodic background sync to refresh data automatically
