/**
 * DonorDex Import/Export Module
 * CSV import with smart merge, column detection, and export functionality
 */

const ImportExport = {
    // State variables
    pendingImportData: null,
    currentHeaders: null,
    savedColumnMapping: null,

    // Column detection patterns for FEC CSV formats
    COLUMN_PATTERNS: {
        firstName: ['contributor_first_name', 'first_name', 'firstname', 'first', 'contrib_first_name'],
        lastName: ['contributor_last_name', 'last_name', 'lastname', 'last', 'contrib_last_name'],
        fullName: ['contributor_name', 'donor_name', 'name', 'individual_name', 'person_name', 'contributor', 'donor'],
        committee: ['committee_name', 'recipient_name', 'committee', 'candidate_name', 'recipient', 'payee_name', 'committee_id', 'cmte_id'],
        date: ['contribution_receipt_date', 'transaction_date', 'receipt_date', 'date', 'transaction_dt', 'contrib_date'],
        amount: ['contribution_receipt_amount', 'transaction_amount', 'amount', 'receipt_amount', 'total', 'transaction_amt', 'contrib_amount'],
        entity: ['entity_type', 'entity_tp', 'entity_t', 'entity'],
        tranId: ['transaction_id', 'tran_id', 'sub_id', 'transaction_number'],
        employer: ['contributor_employer', 'employer', 'contrib_employer'],
        occupation: ['contributor_occupation', 'occupation', 'contrib_occupation'],
        city: ['contributor_city', 'city', 'contrib_city'],
        state: ['contributor_state', 'state', 'contrib_state', 'contributor_st']
    },

    /**
     * Find column index by matching against pattern candidates
     * @param {Array<string>} headers - Column headers
     * @param {Array<string>} candidates - Pattern candidates to match
     * @returns {number} - Column index or -1 if not found
     */
    findColumnIdx(headers, candidates) {
        const H = headers.map(h => h.toLowerCase().trim());
        for (const c of candidates) {
            const idx = H.findIndex(h => h === c || h.includes(c) || c.includes(h));
            if (idx !== -1) return idx;
        }
        return -1;
    },

    /**
     * Handle CSV file upload
     * @param {Event} event - File input change event
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
            alert('Please upload a CSV or TXT file');
            event.target.value = '';
            return;
        }

        const textarea = document.getElementById('bulkData');
        textarea.value = 'Loading file...';
        textarea.style.background = '#f8fafc';

        const reader = new FileReader();
        reader.onload = function(e) {
            const contents = e.target.result;
            textarea.value = contents;
            textarea.style.background = 'white';

            const fileName = file.name;
            const fileSize = (file.size / 1024).toFixed(1);
            textarea.placeholder = `Loaded: ${fileName} (${fileSize} KB) - Ready to import`;

            alert(`File loaded successfully!\n\nClick "Process Import" to preview before importing.`);
        };
        reader.onerror = function() {
            alert('Error reading file. Please try again.');
            textarea.value = '';
            textarea.style.background = 'white';
            event.target.value = '';
        };
        reader.readAsText(file);
    },

    /**
     * Smart import with auto-detection and preview
     */
    smartImport() {
        const bulkData = document.getElementById('bulkData').value.trim();
        if (!bulkData) {
            alert('Please enter data to import');
            return;
        }

        const rows = Utils.parseCSV(bulkData);
        if (rows.length < 2) {
            alert('Please include headers and at least one data row');
            return;
        }

        const importMode = document.querySelector('input[name="importMode"]:checked')?.value || 'smart';

        const headers = rows[0].map(h => h.toLowerCase().trim());
        this.currentHeaders = headers;
        const dataRows = rows.slice(1);

        // Try to detect name columns (first/last separate, or combined)
        let firstNameCol = -1, lastNameCol = -1, fullNameCol = -1;
        let candidateCol = -1, dateCol = -1, amountCol = -1;
        let entityTypeCol = -1, transactionIdCol = -1;
        let employerCol = -1, occupationCol = -1, cityCol = -1, stateCol = -1;

        // Auto-detect columns using flexible patterns
        firstNameCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.firstName);
        lastNameCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.lastName);
        fullNameCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.fullName);
        candidateCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.committee);
        dateCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.date);
        amountCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.amount);

        // Find optional columns
        employerCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.employer);
        occupationCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.occupation);
        cityCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.city);
        stateCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.state);
        entityTypeCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.entity);
        transactionIdCol = this.findColumnIdx(headers, this.COLUMN_PATTERNS.tranId);

        // Validate that we have either first/last OR full name
        const hasNameData = (firstNameCol !== -1 && lastNameCol !== -1) || fullNameCol !== -1;

        // Validate required columns
        const missing = [];
        if (!hasNameData) missing.push('donor name (need first+last or full name)');
        if (candidateCol === -1) missing.push('candidate/committee name');
        if (dateCol === -1) missing.push('date');
        if (amountCol === -1) missing.push('amount');

        if (missing.length > 0) {
            alert(`Could not auto-detect columns for: ${missing.join(', ')}\n\nClick "Manual Mapping" to specify columns manually.`);
            return;
        }

        // Parse all records
        const allRecords = [];
        const errors = [];

        dataRows.forEach((fields, index) => {
            const rowNum = index + 2;

            // Skip completely empty rows
            if (fields.every(f => !f || f.trim() === '')) {
                return;
            }

            const maxColIdx = Math.max(
                firstNameCol, lastNameCol, fullNameCol,
                candidateCol, dateCol, amountCol
            );
            if (fields.length <= maxColIdx) {
                errors.push(`Row ${rowNum}: Has ${fields.length} columns, need at least ${maxColIdx + 1}`);
                return;
            }

            // Parse name (either first/last separate or combined)
            let firstName = '', lastName = '';
            if (firstNameCol !== -1 && lastNameCol !== -1) {
                // Separate first/last name columns
                firstName = (fields[firstNameCol] || '').trim();
                lastName = (fields[lastNameCol] || '').trim();
            } else if (fullNameCol !== -1) {
                // Combined name column - parse it
                const fullName = (fields[fullNameCol] || '').trim();
                const parsed = Utils.parseFullName(fullName);
                firstName = parsed.firstName;
                lastName = parsed.lastName;
            }

            const candidateName = (fields[candidateCol] || '').trim();
            const rawDate = (fields[dateCol] || '').trim();
            const rawAmount = (fields[amountCol] || '').replace(/[^0-9.-]/g, '');

            // Detailed error reporting
            const missingFields = [];
            if (!candidateName) missingFields.push('committee name');
            if (!rawDate) missingFields.push('date');
            if (!rawAmount) missingFields.push('amount');

            if (missingFields.length > 0) {
                errors.push(`Row ${rowNum}: Missing ${missingFields.join(', ')}`);
                return;
            }

            const { ymd, epoch } = Utils.parseFecDate(rawDate);
            const parsedAmount = parseFloat(rawAmount);

            if (!ymd) {
                errors.push(`Row ${rowNum}: Invalid date format "${rawDate}" (expected YYYY-MM-DD or MM/DD/YYYY)`);
                return;
            }

            if (isNaN(parsedAmount)) {
                errors.push(`Row ${rowNum}: Invalid amount "${rawAmount}"`);
                return;
            }

            const entityType = entityTypeCol !== -1 ? (fields[entityTypeCol] || '').trim().toUpperCase() : '';
            const transactionId = transactionIdCol !== -1 ? (fields[transactionIdCol] || '').trim() : '';
            const employer = employerCol !== -1 ? (fields[employerCol] || '').trim() : '';
            const occupation = occupationCol !== -1 ? (fields[occupationCol] || '').trim() : '';
            const city = cityCol !== -1 ? (fields[cityCol] || '').trim() : '';
            const state = stateCol !== -1 ? (fields[stateCol] || '').trim().toUpperCase() : '';

            allRecords.push({
                firstName,
                lastName,
                candidateName,
                contributionDate: ymd,
                contributionEpoch: epoch,
                amount: Math.round(parsedAmount * 100) / 100,
                isRefund: parsedAmount < 0,
                entityType,
                transactionId,
                employer,
                occupation,
                city,
                state
            });
        });

        // Process based on import mode
        let parsedData = [];

        if (importMode === 'individuals') {
            parsedData = allRecords.filter(r => r.entityType === 'IND' || !r.entityType);

        } else if (importMode === 'smart' && entityTypeCol !== -1 && transactionIdCol !== -1) {
            // Smart merge earmarked contributions
            const transactionGroups = new Map();

            allRecords.forEach(record => {
                const baseId = record.transactionId.replace(/E$/i, '');
                if (!baseId) {
                    transactionGroups.set(Symbol(), [record]);
                } else {
                    if (!transactionGroups.has(baseId)) {
                        transactionGroups.set(baseId, []);
                    }
                    transactionGroups.get(baseId).push(record);
                }
            });

            for (const group of transactionGroups.values()) {
                const individualRecord = group.find(r => r.entityType === 'IND');
                const conduitRecord = group.find(r => ['PAC', 'PTY'].includes(r.entityType));

                if (individualRecord) {
                    parsedData.push({
                        firstName: individualRecord.firstName,
                        lastName: individualRecord.lastName,
                        candidateName: individualRecord.candidateName,
                        contributionDate: conduitRecord ? conduitRecord.contributionDate : individualRecord.contributionDate,
                        contributionEpoch: conduitRecord ? conduitRecord.contributionEpoch : individualRecord.contributionEpoch,
                        amount: individualRecord.amount,
                        isRefund: individualRecord.isRefund,
                        employer: individualRecord.employer,
                        occupation: individualRecord.occupation,
                        city: individualRecord.city,
                        state: individualRecord.state
                    });
                } else if (group.length === 1) {
                    parsedData.push(group[0]);
                }
            }

        } else {
            // Import all records
            parsedData = allRecords;
        }

        this.pendingImportData = parsedData;

        let modeDescription = '';
        if (importMode === 'individuals') {
            modeDescription = 'Individual donors only';
        } else if (importMode === 'smart') {
            modeDescription = 'Smart merge (earmarked contributions combined)';
        } else {
            modeDescription = 'All records (including refunds)';
        }

        // Build mapping description for preview
        const mappingInfo = {
            candidateCol: headers[candidateCol],
            dateCol: headers[dateCol],
            amountCol: headers[amountCol]
        };

        if (firstNameCol !== -1 && lastNameCol !== -1) {
            mappingInfo.firstNameCol = headers[firstNameCol];
            mappingInfo.lastNameCol = headers[lastNameCol];
        } else if (fullNameCol !== -1) {
            mappingInfo.fullNameCol = headers[fullNameCol];
        }

        this.showImportPreview(parsedData, errors, mappingInfo, modeDescription);
    },

    /**
     * Show import preview in modal
     * @param {Array} data - Parsed records
     * @param {Array} errors - Error messages
     * @param {Object} mapping - Column mapping info
     * @param {string} modeDescription - Import mode description
     */
    showImportPreview(data, errors, mapping, modeDescription) {
        const previewDiv = document.getElementById('importPreview');
        const contentDiv = document.getElementById('previewContent');

        let html = `
            <div style="margin-bottom: 15px;">
                <strong>Column Mapping Detected:</strong>
                <div style="margin-top: 8px; font-size: 13px; color: #4a5568;">`;

        if (mapping.firstNameCol && mapping.lastNameCol) {
            html += `• First Name: <code>${Utils.escapeHtml(mapping.firstNameCol)}</code><br>`;
            html += `• Last Name: <code>${Utils.escapeHtml(mapping.lastNameCol)}</code><br>`;
        } else if (mapping.fullNameCol) {
            html += `• Full Name: <code>${Utils.escapeHtml(mapping.fullNameCol)}</code> (will be split)<br>`;
        }

        html += `• Candidate: <code>${Utils.escapeHtml(mapping.candidateCol)}</code><br>
                    • Date: <code>${Utils.escapeHtml(mapping.dateCol)}</code><br>
                    • Amount: <code>${Utils.escapeHtml(mapping.amountCol)}</code>
                </div>
            </div>
        `;

        if (modeDescription) {
            html += `
                <div style="margin-bottom: 15px; padding: 12px; background: #e6f7f3; border: 2px solid #56D2B4; border-radius: 8px; font-size: 13px; color: #174A57;">
                    <strong>Import Mode:</strong> ${Utils.escapeHtml(modeDescription)}
                </div>
            `;
        }

        html += `
            <div style="margin-bottom: 15px;">
                <strong style="color: #174A57;">✓ ${data.length} records ready to import</strong>
        `;

        if (errors.length > 0) {
            html += `<br><strong style="color: #e53e3e;">✗ ${errors.length} errors (rows skipped)</strong>`;
        }

        html += `</div>`;

        if (data.length > 0) {
            html += `<div style="margin-top: 10px;"><strong>Preview (first 3 records):</strong></div>`;
            const previewCount = Math.min(3, data.length);
            for (let i = 0; i < previewCount; i++) {
                const record = data[i];
                const isRefund = record.isRefund || record.amount < 0;
                const fullName = record.firstName + ' ' + record.lastName;
                html += `
                    <div style="margin-top: 8px; padding: 12px; background: white; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px;">
                        <strong>${Utils.escapeHtml(fullName)}</strong> → ${Utils.escapeHtml(record.candidateName)}${isRefund ? ' <span class="refund-badge">REFUND</span>' : ''}<br>
                        ${Utils.escapeHtml(record.contributionDate)} • $${Math.abs(record.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}
                        ${record.employer || record.occupation ? `<br><span style="color: #718096; font-size: 12px;">${Utils.escapeHtml(record.occupation || '')}${record.occupation && record.employer ? ' at ' : ''}${Utils.escapeHtml(record.employer || '')}</span>` : ''}
                        ${record.city || record.state ? `<br><span style="color: #718096; font-size: 12px;">${Utils.escapeHtml(record.city || '')}${record.city && record.state ? ', ' : ''}${Utils.escapeHtml(record.state || '')}</span>` : ''}
                    </div>
                `;
            }
        }

        if (errors.length > 0) {
            html += `<div style="margin-top: 15px; padding: 10px; background: #fff5f5; border: 2px solid #feb2b2; border-radius: 8px; font-size: 12px; color: #c53030;">`;
            html += `<strong>Errors (first 10):</strong><br>`;
            errors.slice(0, 10).forEach(err => {
                html += `• ${Utils.escapeHtml(err)}<br>`;
            });
            if (errors.length > 10) {
                html += `• ... and ${errors.length - 10} more<br>`;
            }

            html += `</div>`;
        }

        contentDiv.innerHTML = html;
        previewDiv.style.display = 'block';

        // Scroll the preview into view within the modal
        previewDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /**
     * Confirm and execute import
     */
    async confirmImport() {
        if (!this.pendingImportData) return;

        // Add records to database
        const recordsWithIds = this.pendingImportData.map(record => ({
            id: Utils.generateId(),
            ...record
        }));

        await Database.bulkAdd(recordsWithIds);
        await App.updateStats();

        document.getElementById('bulkData').value = '';
        document.getElementById('importPreview').style.display = 'none';

        alert(`Successfully added ${this.pendingImportData.length} records to DonorDex!`);
        this.pendingImportData = null;

        // Refresh filters if active
        if (Filters.filteredRecords.length > 0) {
            await Filters.applyFilters();
        }
    },

    /**
     * Cancel import
     */
    cancelImport() {
        this.pendingImportData = null;
        document.getElementById('importPreview').style.display = 'none';
    },

    /**
     * Export all records to CSV
     */
    async exportData() {
        const records = await Database.getAllRecords();

        if (records.length === 0) {
            alert('No data to export');
            return;
        }

        // UTF-8 BOM for Excel compatibility
        let csv = '\uFEFF';
        csv += 'First Name,Last Name,Committee Name,Contribution Date,Amount,Employer,Occupation,City,State\n';

        records.forEach(record => {
            csv += `${Utils.escapeCsvField(record.firstName)},${Utils.escapeCsvField(record.lastName)},${Utils.escapeCsvField(record.candidateName)},${Utils.escapeCsvField(record.contributionDate)},${Utils.escapeCsvField(record.amount)},${Utils.escapeCsvField(record.employer)},${Utils.escapeCsvField(record.occupation)},${Utils.escapeCsvField(record.city)},${Utils.escapeCsvField(record.state)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'donordex-export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Show manual column mapper
     */
    showManualMapper() {
        const bulkData = document.getElementById('bulkData').value.trim();
        if (!bulkData) {
            alert('Please paste CSV data first');
            return;
        }

        const rows = Utils.parseCSV(bulkData);
        if (rows.length < 1) {
            alert('Please paste CSV data with headers');
            return;
        }

        const headers = rows[0];
        this.currentHeaders = headers.map(h => h.toLowerCase());

        const mapperDiv = document.getElementById('manualMapper');
        const contentDiv = document.getElementById('mapperContent');

        let html = `
            <div style="display: grid; gap: 15px;">
                <div class="form-group">
                    <label>Donor/Contributor Name Column</label>
                    <select id="mapDonor" class="mapper-select">
                        <option value="">-- Select Column --</option>
                        ${headers.map((h, i) => `<option value="${i}">${Utils.escapeHtml(h)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Candidate/Committee Name Column</label>
                    <select id="mapCandidate" class="mapper-select">
                        <option value="">-- Select Column --</option>
                        ${headers.map((h, i) => `<option value="${i}">${Utils.escapeHtml(h)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Contribution Date Column</label>
                    <select id="mapDate" class="mapper-select">
                        <option value="">-- Select Column --</option>
                        ${headers.map((h, i) => `<option value="${i}">${Utils.escapeHtml(h)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Contribution Amount Column</label>
                    <select id="mapAmount" class="mapper-select">
                        <option value="">-- Select Column --</option>
                        ${headers.map((h, i) => `<option value="${i}">${Utils.escapeHtml(h)}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="saveMapping" style="width: auto;">
                        <span style="font-size: 13px; font-weight: normal;">Remember this mapping for future imports</span>
                    </label>
                </div>
            </div>
        `;

        contentDiv.innerHTML = html;
        mapperDiv.style.display = 'block';
    }
};

// Export for use in other modules
window.ImportExport = ImportExport;
