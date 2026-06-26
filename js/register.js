/**
 * Register — Daily Register Management Module
 * -----------------------------------------------
 * Handles end-of-day register closing: aggregates today's sales
 * into a 'pastSales' archive document and cleans up the live
 * 'sales' collection.
 */

const Register = {

  /**
   * Initialize the Register module.
   * Binds the close-register button and modal controls.
   */
  init() {
    try {
      this._bindEvents();
      console.log('[Register] Initialized.');
    } catch (err) {
      console.error('[Register.init] Error:', err);
      Utils.showToast('Failed to initialize register.', 'error');
    }
  },

  // ─── Open Close-Register Modal ────────────────────────────────────

  /**
   * Fetch today's sales, calculate a summary, and show the
   * close-register confirmation modal.
   */
  async openCloseModal() {
    try {
      const today = Utils.getTodayDateStr();

      // Use cached data from Sales module if available, otherwise query
      let salesData;
      if (typeof Sales !== 'undefined' && Sales.todaySales && Sales.todaySales.length > 0) {
        salesData = Sales.todaySales;
      } else {
        const snapshot = await window.db
          .collection('sales')
          .where('saleDateStr', '==', today)
          .get();
        salesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }

      if (salesData.length === 0) {
        Utils.showToast('No sales to close for today.', 'warning');
        return;
      }

      // Calculate summary
      const totalRevenue = salesData.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalItemsSold = salesData.reduce(
        (sum, s) => sum + (s.items || []).reduce((is, i) => is + i.quantity, 0),
        0
      );

      // Per-contributor breakdown
      const contributorMap = {};
      for (const sale of salesData) {
        for (const item of (sale.items || [])) {
          const key = item.contributorName || 'Unassigned';
          if (!contributorMap[key]) {
            contributorMap[key] = { items: 0, revenue: 0 };
          }
          contributorMap[key].items += item.quantity;
          contributorMap[key].revenue += item.subtotal || (item.priceAtSale * item.quantity);
        }
      }

      // Render summary
      const summaryEl = document.getElementById('close-register-summary');
      if (summaryEl) {
        const contributorRows = Object.entries(contributorMap)
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .map(
            ([name, data]) => `
            <tr>
              <td style="padding:4px 8px;">${this._escapeHtml(name)}</td>
              <td style="padding:4px 8px;text-align:center;">${data.items}</td>
              <td style="padding:4px 8px;text-align:right;">${Utils.formatCurrency(data.revenue)}</td>
            </tr>`
          )
          .join('');

        summaryEl.innerHTML = `
          <div style="margin-bottom:16px;">
            <h4 style="margin:0 0 8px;">Day Summary — ${today}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
              <div style="background:#f0fdf4;padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:13px;color:#6b7280;">Total Revenue</div>
                <div style="font-size:20px;font-weight:700;color:#10b981;">${Utils.formatCurrency(totalRevenue)}</div>
              </div>
              <div style="background:#eff6ff;padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:13px;color:#6b7280;">Items Sold</div>
                <div style="font-size:20px;font-weight:700;color:#3b82f6;">${totalItemsSold}</div>
              </div>
              <div style="background:#fef3c7;padding:12px;border-radius:8px;text-align:center;">
                <div style="font-size:13px;color:#6b7280;">Transactions</div>
                <div style="font-size:20px;font-weight:700;color:#f59e0b;">${salesData.length}</div>
              </div>
            </div>
          </div>
          <div>
            <h4 style="margin:0 0 8px;">Per-Contributor Breakdown</h4>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid #e5e7eb;">
                  <th style="text-align:left;padding:4px 8px;">Contributor</th>
                  <th style="text-align:center;padding:4px 8px;">Items</th>
                  <th style="text-align:right;padding:4px 8px;">Revenue</th>
                </tr>
              </thead>
              <tbody>${contributorRows}</tbody>
              <tfoot>
                <tr style="border-top:2px solid #e5e7eb;font-weight:700;">
                  <td style="padding:4px 8px;">Total</td>
                  <td style="text-align:center;padding:4px 8px;">${totalItemsSold}</td>
                  <td style="text-align:right;padding:4px 8px;">${Utils.formatCurrency(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p style="margin-top:16px;color:#ef4444;font-size:13px;font-weight:600;">
            ⚠ This action will archive today's sales and clear them from the live register. This cannot be undone.
          </p>`;
      }

      Utils.showModal('close-register-modal');
    } catch (err) {
      console.error('[Register.openCloseModal] Error:', err);
      Utils.showToast('Failed to load register summary.', 'error');
    }
  },

  // ─── Close Sales (Archive & Delete) ───────────────────────────────

  /**
   * Close today's sales — CRITICAL FUNCTION.
   * 1. Query all sales for today
   * 2. Calculate aggregates
   * 3. Create a pastSales archive document
   * 4. Batch-delete all individual sale docs
   */
  async closeSales() {
    try {
      const confirmBtn = document.getElementById('confirm-close-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Closing…';
      }

      const today = Utils.getTodayDateStr();

      // Step 1: Query all sales for today (fresh read, not cache)
      const snapshot = await window.db
        .collection('sales')
        .where('saleDateStr', '==', today)
        .get();

      if (snapshot.empty) {
        Utils.showToast('No sales to close for today.', 'warning');
        Utils.hideModal('close-register-modal');
        return;
      }

      const salesDocs = snapshot.docs;
      const salesData = salesDocs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Step 2: Calculate aggregates
      const totalRevenue = salesData.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalItemsSold = salesData.reduce(
        (sum, s) => sum + (s.items || []).reduce((is, i) => is + i.quantity, 0),
        0
      );

      // Prepare sale records for archiving (strip Firestore-specific objects that don't serialize well)
      const archivedSales = salesData.map((sale) => ({
        saleId: sale.id,
        items: sale.items || [],
        totalAmount: sale.totalAmount || 0,
        processedBy: sale.processedBy || '',
        processedByName: sale.processedByName || '',
        saleDate: sale.saleDate || null,
        saleDateStr: sale.saleDateStr || today
      }));

      // Step 3 & 4: Batch — create archive doc + delete all sale docs
      // Firestore batches have a 500 write limit.
      // We'll process in chunks if needed.
      const BATCH_LIMIT = 499; // 1 reserved for the pastSales doc write
      const totalOps = salesDocs.length + 1;

      if (totalOps <= 500) {
        // Single batch
        const batch = window.db.batch();

        // Create pastSales archive document (ID = today's date string)
        const pastSaleRef = window.db.collection('pastSales').doc(today);
        batch.set(pastSaleRef, {
          sales: archivedSales,
          dayTotal: totalRevenue,
          totalItemsSold,
          closedAt: firebase.firestore.FieldValue.serverTimestamp(),
          closedBy: window.currentUser.uid,
          closedByName: window.currentUser.displayName
        });

        // Delete each individual sale document
        for (const doc of salesDocs) {
          batch.delete(doc.ref);
        }

        await batch.commit();
      } else {
        // Multiple batches for large sale volumes
        // First batch: create archive doc + first chunk of deletes
        let batch = window.db.batch();
        let opCount = 0;

        const pastSaleRef = window.db.collection('pastSales').doc(today);
        batch.set(pastSaleRef, {
          sales: archivedSales,
          dayTotal: totalRevenue,
          totalItemsSold,
          closedAt: firebase.firestore.FieldValue.serverTimestamp(),
          closedBy: window.currentUser.uid,
          closedByName: window.currentUser.displayName
        });
        opCount++;

        for (const doc of salesDocs) {
          if (opCount >= 500) {
            await batch.commit();
            batch = window.db.batch();
            opCount = 0;
          }
          batch.delete(doc.ref);
          opCount++;
        }

        if (opCount > 0) {
          await batch.commit();
        }
      }

      // Step 5: Success
      Utils.hideModal('close-register-modal');
      Utils.showToast('Register closed successfully! Sales have been archived.', 'success');

      // Refresh past sales view
      if (typeof Sales !== 'undefined') {
        Sales.loadPastSales();
      }

      console.log('[Register] Closed sales for', today, '— Revenue:', totalRevenue);
    } catch (err) {
      console.error('[Register.closeSales] Error:', err);
      Utils.showToast('Failed to close register. Please try again.', 'error');
    } finally {
      const confirmBtn = document.getElementById('confirm-close-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Close Register';
      }
    }
  },

  // ─── Event Binding ────────────────────────────────────────────────

  _bindEvents() {
    const closeRegBtn = document.getElementById('close-register-btn');
    if (closeRegBtn) closeRegBtn.addEventListener('click', () => this.openCloseModal());

    const confirmBtn = document.getElementById('confirm-close-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => this.closeSales());

    const cancelBtn = document.getElementById('cancel-close-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => Utils.hideModal('close-register-modal'));
  },

  // ─── Helpers ──────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

console.log('[Register] Loaded.');
