/**
 * Export — CSV Export Module
 * ---------------------------
 * Generates and downloads CSV files for inventory and sales data.
 * Handles proper CSV escaping for fields containing commas/quotes.
 */

const Export = {

  /**
   * Initialize the Export module.
   * Binds export buttons.
   */
  init() {
    try {
      this._bindEvents();
      console.log('[Export] Initialized.');
    } catch (err) {
      console.error('[Export.init] Error:', err);
      Utils.showToast('Failed to initialize export.', 'error');
    }
  },

  // ─── Inventory CSV Export ─────────────────────────────────────────

  /**
   * Export current inventory data as a CSV file.
   */
  exportInventoryCSV() {
    try {
      const data = (typeof Inventory !== 'undefined') ? Inventory.data : [];

      if (data.length === 0) {
        Utils.showToast('No inventory data to export.', 'warning');
        return;
      }

      const headers = ['Item Name', 'Price (₹)', 'Quantity', 'Contributor'];
      const rows = data.map((item) => [
        item.name || '',
        (item.price || 0).toFixed(2),
        String(item.quantity || 0),
        item.contributorName || ''
      ]);

      const csv = this.generateCSV(headers, rows);
      const filename = `inventory_${Utils.getTodayDateStr()}.csv`;
      this.downloadCSV(csv, filename);

      Utils.showToast(`Inventory exported (${data.length} items).`, 'success');
    } catch (err) {
      console.error('[Export.exportInventoryCSV] Error:', err);
      Utils.showToast('Failed to export inventory.', 'error');
    }
  },

  // ─── Sales CSV Export ─────────────────────────────────────────────

  /**
   * Export sales data (today + past) as a CSV file.
   * Queries both live 'sales' and archived 'pastSales' collections.
   */
  async exportSalesCSV() {
    try {
      Utils.showToast('Preparing sales export…', 'success');

      const allRows = [];

      // 1. Today's sales (from cache or Firestore)
      let todaySales;
      if (typeof Sales !== 'undefined' && Sales.todaySales) {
        todaySales = Sales.todaySales;
      } else {
        const snapshot = await window.db
          .collection('sales')
          .where('saleDateStr', '==', Utils.getTodayDateStr())
          .get();
        todaySales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }

      // Process today's sales
      for (const sale of todaySales) {
        const saleDate = sale.saleDate ? this._formatTimestampForCSV(sale.saleDate) : (sale.saleDateStr || '');
        for (const item of (sale.items || [])) {
          allRows.push([
            sale.id || '',
            saleDate,
            item.itemName || '',
            String(item.quantity || 0),
            (item.priceAtSale || 0).toFixed(2),
            (item.subtotal || (item.priceAtSale * item.quantity) || 0).toFixed(2),
            item.contributorName || '',
            (sale.totalAmount || 0).toFixed(2),
            sale.processedByName || ''
          ]);
        }
      }

      // 2. Past sales (from pastSales collection)
      const pastSnapshot = await window.db
        .collection('pastSales')
        .orderBy('closedAt', 'desc')
        .get();

      for (const doc of pastSnapshot.docs) {
        const dayData = doc.data();
        const sales = dayData.sales || [];

        for (const sale of sales) {
          const saleDate = sale.saleDate ? this._formatTimestampForCSV(sale.saleDate) : (sale.saleDateStr || doc.id);
          for (const item of (sale.items || [])) {
            allRows.push([
              sale.saleId || '',
              saleDate,
              item.itemName || '',
              String(item.quantity || 0),
              (item.priceAtSale || 0).toFixed(2),
              (item.subtotal || (item.priceAtSale * item.quantity) || 0).toFixed(2),
              item.contributorName || '',
              (sale.totalAmount || 0).toFixed(2),
              sale.processedByName || ''
            ]);
          }
        }
      }

      if (allRows.length === 0) {
        Utils.showToast('No sales data to export.', 'warning');
        return;
      }

      const headers = [
        'Sale ID',
        'Date',
        'Item Name',
        'Quantity',
        'Price (₹)',
        'Subtotal (₹)',
        'Contributor',
        'Sale Total (₹)',
        'Processed By'
      ];

      const csv = this.generateCSV(headers, allRows);
      const filename = `sales_${Utils.getTodayDateStr()}.csv`;
      this.downloadCSV(csv, filename);

      Utils.showToast(`Sales exported (${allRows.length} rows).`, 'success');
    } catch (err) {
      console.error('[Export.exportSalesCSV] Error:', err);
      Utils.showToast('Failed to export sales.', 'error');
    }
  },

  // ─── CSV Generation Utilities ─────────────────────────────────────

  /**
   * Generate a CSV string from headers and row data.
   * Handles proper escaping of fields containing commas, quotes, or newlines.
   * @param {string[]} headers - Column header names.
   * @param {string[][]} rows - Array of row arrays (each cell is a string).
   * @returns {string} CSV formatted string.
   */
  generateCSV(headers, rows) {
    const escapeField = (field) => {
      const str = String(field == null ? '' : field);
      // If the field contains a comma, double quote, or newline, wrap in quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const lines = [];
    lines.push(headers.map(escapeField).join(','));
    for (const row of rows) {
      lines.push(row.map(escapeField).join(','));
    }

    return lines.join('\r\n');
  },

  /**
   * Trigger a CSV file download in the browser.
   * @param {string} csvString - The CSV content.
   * @param {string} filename - The download filename.
   */
  downloadCSV(csvString, filename) {
    // Add BOM for Excel compatibility with Unicode characters (₹ symbol)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // ─── Event Binding ────────────────────────────────────────────────

  _bindEvents() {
    const exportInvBtn = document.getElementById('export-inventory-btn');
    if (exportInvBtn) exportInvBtn.addEventListener('click', () => this.exportInventoryCSV());

    const exportSalesBtn = document.getElementById('export-sales-btn');
    if (exportSalesBtn) exportSalesBtn.addEventListener('click', () => this.exportSalesCSV());
  },

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Format a Firestore timestamp for CSV output.
   * @param {*} timestamp
   * @returns {string}
   */
  _formatTimestampForCSV(timestamp) {
    try {
      let date;
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp && timestamp.seconds) {
        // Raw Firestore timestamp object { seconds, nanoseconds }
        date = new Date(timestamp.seconds * 1000);
      } else {
        return '';
      }
      // ISO-like format for CSV readability
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${mins}`;
    } catch (err) {
      return '';
    }
  }
};

console.log('[Export] Loaded.');
