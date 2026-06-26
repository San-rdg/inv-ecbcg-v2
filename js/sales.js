/**
 * Sales — Sales Display Module
 * ------------------------------
 * Provides a real-time view of today's sales and a historical
 * accordion of past (closed) sales days.
 */

const Sales = {
  todaySales: [],    // Live cache of today's sale docs
  unsubscribe: null, // Firestore onSnapshot unsubscribe function

  /**
   * Initialize the Sales module.
   * Sets up a real-time listener for today's sales and loads past sales.
   */
  init() {
    try {
      this._startListener();
      this.loadPastSales();
      console.log('[Sales] Initialized.');
    } catch (err) {
      console.error('[Sales.init] Error:', err);
      Utils.showToast('Failed to initialize sales.', 'error');
    }
  },

  // ─── Real-time Listener (Today's Sales) ───────────────────────────

  _startListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    const today = Utils.getTodayDateStr();

    this.unsubscribe = window.db
      .collection('sales')
      .where('saleDateStr', '==', today)
      .orderBy('saleDate', 'desc')
      .onSnapshot(
        (snapshot) => {
          this.todaySales = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          this.renderTodaySales();
          this.updateTodayTotal();
          this.updateRegisterStats();
          this._updateDashboardStats();
        },
        (err) => {
          console.error('[Sales] Listener error:', err);
          Utils.showToast('Failed to load today\'s sales.', 'error');
        }
      );
  },

  // ─── Render Today's Sales ─────────────────────────────────────────

  renderTodaySales() {
    const tbody = document.getElementById('today-sales-body');
    if (!tbody) return;

    if (this.todaySales.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:20px;color:#6b7280;">No sales today yet.</td></tr>';
      return;
    }

    tbody.innerHTML = this.todaySales
      .map((sale) => {
        const time = sale.saleDate ? Utils.formatDateTime(sale.saleDate) : '—';
        const itemSummary = (sale.items || [])
          .map((i) => `${this._escapeHtml(i.itemName)} ×${i.quantity}`)
          .join(', ');

        return `
          <tr>
            <td style="font-size:13px;">${time}</td>
            <td>${this._escapeHtml(itemSummary)}</td>
            <td>${(sale.items || []).reduce((s, i) => s + i.quantity, 0)}</td>
            <td>${Utils.formatCurrency(sale.totalAmount)}</td>
            <td>${this._escapeHtml(sale.processedByName || '—')}</td>
            <td>
              <button class="btn btn-sm btn-delete" onclick="Sales.deleteTodaySale('${sale.id}')" title="Delete Sale">✕</button>
            </td>
          </tr>`;
      })
      .join('');
  },

  // ─── Today's Total ────────────────────────────────────────────────

  updateTodayTotal() {
    const totalEl = document.getElementById('today-sales-total');
    if (!totalEl) return;

    const total = this.todaySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    totalEl.textContent = Utils.formatCurrency(total);
  },

  // ─── Dashboard Stats (POS Tab) ────────────────────────────────────

  _updateDashboardStats() {
    const todaySalesEl = document.getElementById('stat-today-sales');
    const todayRevenueEl = document.getElementById('stat-today-revenue');

    if (todaySalesEl) {
      todaySalesEl.textContent = this.todaySales.length;
    }

    if (todayRevenueEl) {
      const revenue = this.todaySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      todayRevenueEl.textContent = Utils.formatCurrency(revenue);
    }
  },

  // ─── Register Stats ───────────────────────────────────────────────

  updateRegisterStats() {
    const dayTotalEl = document.getElementById('register-day-total');
    const itemsSoldEl = document.getElementById('register-items-sold');
    const transactionsEl = document.getElementById('register-transactions');

    const dayTotal = this.todaySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const itemsSold = this.todaySales.reduce(
      (sum, sale) => sum + (sale.items || []).reduce((s, i) => s + i.quantity, 0),
      0
    );

    if (dayTotalEl) dayTotalEl.textContent = Utils.formatCurrency(dayTotal);
    if (itemsSoldEl) itemsSoldEl.textContent = itemsSold;
    if (transactionsEl) transactionsEl.textContent = this.todaySales.length;
  },

  // ─── Past Sales ───────────────────────────────────────────────────

  /**
   * Load past (closed) sales from the 'pastSales' collection.
   */
  async loadPastSales() {
    try {
      const container = document.getElementById('past-sales-container');
      if (!container) return;

      Utils.showLoading('past-sales-container');

      const snapshot = await window.db
        .collection('pastSales')
        .orderBy('closedAt', 'desc')
        .limit(30)
        .get();

      const pastData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      Utils.hideLoading('past-sales-container');
      this.renderPastSales(pastData);
    } catch (err) {
      console.error('[Sales.loadPastSales] Error:', err);
      Utils.hideLoading('past-sales-container');
      const container = document.getElementById('past-sales-container');
      if (container) {
        container.innerHTML =
          '<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load past sales.</p>';
      }
    }
  },

  /**
   * Render past sales in an accordion/expandable format.
   * @param {Array} data - Array of pastSales documents.
   */
  renderPastSales(data) {
    const container = document.getElementById('past-sales-container');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;padding:20px;color:#6b7280;">No past sales records found.</p>';
      return;
    }

    container.innerHTML = data
      .map((day) => {
        const dateLabel = day.id; // The doc ID is the date string YYYY-MM-DD
        const closedAt = day.closedAt ? Utils.formatDateTime(day.closedAt) : '—';
        const sales = day.sales || [];
        const dayTotal = day.dayTotal || 0;
        const totalItemsSold = day.totalItemsSold || 0;

        const salesRows = sales
          .map((sale) => {
            const saleTime = sale.saleDate ? Utils.formatDateTime(sale.saleDate) : '—';
            const items = (sale.items || [])
              .map((i) => `${this._escapeHtml(i.itemName)} ×${i.quantity} @ ${Utils.formatCurrency(i.priceAtSale)}`)
              .join('<br>');

            return `
              <tr>
                <td style="font-size:13px;">${saleTime}</td>
                <td>${items}</td>
                <td style="text-align:right;">${Utils.formatCurrency(sale.totalAmount || 0)}</td>
                <td>${this._escapeHtml(sale.processedByName || '—')}</td>
                <td>
                  <button class="btn btn-sm btn-delete" onclick="Sales.deletePastSale('${sale.saleId || ''}', '${day.id}')" title="Delete Sale">✕</button>
                </td>
              </tr>`;
          })
          .join('');

        return `
          <div class="past-sales-day" style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div class="past-sales-header" 
                 onclick="Sales._toggleAccordion(this)"
                 style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f9fafb;cursor:pointer;user-select:none;">
              <div>
                <strong>${this._escapeHtml(dateLabel)}</strong>
                <span style="color:#6b7280;font-size:13px;margin-left:8px;">
                  ${sales.length} sale(s) · ${totalItemsSold} item(s)
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-weight:600;">${Utils.formatCurrency(dayTotal)}</span>
                <button class="btn btn-sm" onclick="event.stopPropagation(); Sales.printPastSale('${day.id}')" title="Print Report">Print</button>
                <span class="accordion-arrow" style="transition:transform 0.2s;">▼</span>
              </div>
            </div>
            <div class="past-sales-body" style="display:none;padding:12px 16px;">
              <p style="font-size:13px;color:#6b7280;margin-bottom:8px;">
                Closed at: ${closedAt} by ${this._escapeHtml(day.closedByName || '—')}
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead>
                  <tr style="border-bottom:2px solid #e5e7eb;">
                    <th style="text-align:left;padding:6px;">Time</th>
                    <th style="text-align:left;padding:6px;">Items</th>
                    <th style="text-align:right;padding:6px;">Total</th>
                    <th style="text-align:left;padding:6px;">Processed By</th>
                    <th style="text-align:left;padding:6px;">Actions</th>
                  </tr>
                </thead>
                <tbody>${salesRows}</tbody>
              </table>
            </div>
          </div>`;
      })
      .join('');
  },

  /**
   * Toggle an accordion panel open/closed.
   * @param {HTMLElement} headerEl
   */
  _toggleAccordion(headerEl) {
    try {
      const body = headerEl.nextElementSibling;
      const arrow = headerEl.querySelector('.accordion-arrow');
      if (!body) return;

      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
    } catch (err) {
      console.error('[Sales._toggleAccordion] Error:', err);
    }
  },

  // ─── Deletion & Restocking Logic ──────────────────────────────────

  /**
   * Delete a sale from today's live sales and restock its items.
   * @param {string} saleId 
   */
  async deleteTodaySale(saleId) {
    if (!confirm('Are you sure you want to delete this sale? Items will be restocked.')) return;
    try {
      // Find the sale in cache to know what to restock
      const sale = this.todaySales.find((s) => s.id === saleId);
      if (!sale) {
        Utils.showToast('Sale not found.', 'error');
        return;
      }

      const batch = window.db.batch();
      
      // 1. Delete the sale document
      const saleRef = window.db.collection('sales').doc(saleId);
      batch.delete(saleRef);

      // 2. Restock inventory items
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          if (item.itemId) {
            const invRef = window.db.collection('inventory').doc(item.itemId);
            batch.update(invRef, {
              quantity: firebase.firestore.FieldValue.increment(item.quantity)
            });
          }
        });
      }

      await batch.commit();
      Utils.showToast('Sale deleted and items restocked.', 'success');
      // Listener will auto-update the UI
    } catch (err) {
      console.error('[Sales.deleteTodaySale] Error:', err);
      Utils.showToast('Failed to delete sale.', 'error');
    }
  },

  /**
   * Delete a sale from a closed register (past sales) and restock items.
   * @param {string} saleId - The original sale ID
   * @param {string} pastDocId - The date string document ID (e.g., '2026-06-26')
   */
  async deletePastSale(saleId, pastDocId) {
    if (!saleId) {
      Utils.showToast('Cannot delete this older sale format.', 'warning');
      return;
    }
    if (!confirm('Are you sure you want to delete this past sale? Items will be restocked.')) return;

    try {
      const pastRef = window.db.collection('pastSales').doc(pastDocId);
      const docSnap = await pastRef.get();
      if (!docSnap.exists) return;

      const data = docSnap.data();
      const salesArray = data.sales || [];
      const saleIndex = salesArray.findIndex(s => s.saleId === saleId);

      if (saleIndex === -1) {
        Utils.showToast('Sale not found in this register.', 'error');
        return;
      }

      const sale = salesArray[saleIndex];
      
      // Calculate new aggregates
      salesArray.splice(saleIndex, 1);
      const newDayTotal = salesArray.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const newTotalItems = salesArray.reduce((sum, s) => sum + (s.items || []).reduce((is, i) => is + i.quantity, 0), 0);

      const batch = window.db.batch();

      // 1. Update the pastSales document
      if (salesArray.length === 0) {
        // If it was the last sale, delete the whole day record
        batch.delete(pastRef);
      } else {
        batch.update(pastRef, {
          sales: salesArray,
          dayTotal: newDayTotal,
          totalItemsSold: newTotalItems
        });
      }

      // 2. Restock inventory items
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          if (item.itemId) {
            const invRef = window.db.collection('inventory').doc(item.itemId);
            batch.update(invRef, {
              quantity: firebase.firestore.FieldValue.increment(item.quantity)
            });
          }
        });
      }

      await batch.commit();
      Utils.showToast('Past sale deleted and items restocked.', 'success');
      
      // Refresh the past sales UI
      this.loadPastSales();
    } catch (err) {
      console.error('[Sales.deletePastSale] Error:', err);
      Utils.showToast('Failed to delete past sale.', 'error');
    }
  },

  // ─── Printing Logic ───────────────────────────────────────────────

  /**
   * Open a print window for a specific past day's register.
   * @param {string} dateStr - e.g. "2026-06-26"
   */
  async printPastSale(dateStr) {
    try {
      const docSnap = await window.db.collection('pastSales').doc(dateStr).get();
      if (!docSnap.exists) {
        Utils.showToast('Register data not found.', 'error');
        return;
      }
      
      const data = docSnap.data();
      const sales = data.sales || [];

      // Build printable HTML
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Daily Register Report - ${dateStr}</title>
          <style>
            body { font-family: 'Inter', sans-serif, Arial; margin: 40px; color: #111827; }
            h1 { margin-bottom: 5px; }
            .header-info { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
            .summary-box { border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; gap: 40px; }
            .summary-item strong { display: block; font-size: 24px; color: #111827; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid #111827; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            @media print {
              body { margin: 0; }
              @page { margin: 1cm; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="padding:10px 20px;margin-bottom:20px;cursor:pointer;background:#6366f1;color:white;border:none;border-radius:6px;">Print Document</button>
          <h1>Daily Register Report</h1>
          <div class="header-info">Date: ${dateStr} &nbsp;&bull;&nbsp; Closed by: ${this._escapeHtml(data.closedByName || 'Unknown')} &nbsp;&bull;&nbsp; Time: ${data.closedAt ? Utils.formatDateTime(data.closedAt) : '—'}</div>
          
          <div class="summary-box">
            <div class="summary-item">Total Revenue <strong>${Utils.formatCurrency(data.dayTotal || 0)}</strong></div>
            <div class="summary-item">Total Items Sold <strong>${data.totalItemsSold || 0}</strong></div>
            <div class="summary-item">Total Transactions <strong>${sales.length}</strong></div>
          </div>

          <h2>Transaction Log</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Processed By</th>
                <th>Items Purchased</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
      `;

      sales.forEach(sale => {
        const time = sale.saleDate ? Utils.formatDateTime(sale.saleDate) : '—';
        const itemsList = (sale.items || []).map(i => `${this._escapeHtml(i.itemName)} (x${i.quantity})`).join('<br>');
        html += `
          <tr>
            <td style="white-space:nowrap;">${time}</td>
            <td>${this._escapeHtml(sale.processedByName || '—')}</td>
            <td>${itemsList}</td>
            <td style="text-align:right; font-weight:bold;">${Utils.formatCurrency(sale.totalAmount || 0)}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
          <div style="text-align:center; margin-top:50px; font-size:12px; color:#9ca3af;">Generated by Society POS</div>
          
          <script>
            // Auto-trigger print dialog when it loads
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      const printWin = window.open('', '_blank');
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();

    } catch(err) {
      console.error('[Sales.printPastSale] Error:', err);
      Utils.showToast('Failed to generate print document.', 'error');
    }
  },

  // ─── Helpers ──────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

console.log('[Sales] Loaded.');
