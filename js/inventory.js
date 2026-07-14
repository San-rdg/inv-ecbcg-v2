/**
 * Inventory — Inventory Management Module
 * -----------------------------------------
 * Real-time CRUD for the 'inventory' Firestore collection.
 * Renders both the inventory table and the POS catalog grid.
 */

const Inventory = {
  data: [],          // Local cache of inventory items
  unsubscribe: null, // Firestore onSnapshot unsubscribe function

  /**
   * Initialize the Inventory module.
   */
  init() {
    try {
      this._bindEvents();
      this._startListener();
      console.log('[Inventory] Initialized.');
    } catch (err) {
      console.error('[Inventory.init] Error:', err);
      Utils.showToast('Failed to initialize inventory.', 'error');
    }
  },

  // ─── Real-time Listener ────────────────────────────────────────────

  _startListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = window.db
      .collection('inventory')
      .orderBy('name')
      .onSnapshot(
        (snapshot) => {
          this.data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          this.render();
          this.renderCatalog();
          this.updateStats();
        },
        (err) => {
          console.error('[Inventory] Listener error:', err);
          Utils.showToast('Failed to load inventory.', 'error');
        }
      );
  },

  // ─── Render Inventory Table ────────────────────────────────────────

  render(filteredData) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    const items = filteredData || this.data;

    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:20px;color:#6b7280;">No inventory items found.</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map(
        (item) => `
        <tr>
          <td data-label="Name">${this._escapeHtml(item.name)}</td>
          <td data-label="Contributor">${this._escapeHtml(item.contributorName || '-')}</td>
          <td data-label="Price">${Utils.formatCurrency(item.price)}</td>
          <td data-label="Quantity" class="${item.quantity <= 0 ? 'text-danger' : item.quantity <= 5 ? 'text-warning' : ''}">
            ${item.quantity}
          </td>
          <td data-label="Value">${Utils.formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
          <td data-label="Actions" class="row-actions">
            <button class="btn btn-sm btn-edit" onclick="Inventory.openEditModal('${item.id}')">Edit</button>
            <button class="btn btn-sm btn-delete" onclick="Inventory.delete('${item.id}')">Delete</button>
          </td>
        </tr>`
      )
      .join('');
  },

  // ─── Render POS Catalog ───────────────────────────────────────────

  renderCatalog(filteredData) {
    const grid = document.getElementById('pos-catalog-grid');
    if (!grid) return;

    const items = filteredData || this.data;

    if (items.length === 0) {
      grid.innerHTML =
        '<div style="text-align:center;padding:40px;color:#6b7280;grid-column:1/-1;">' +
        '<p>No items found.</p></div>';
      return;
    }

    grid.innerHTML = items
      .map(
        (item) => `
        <div class="catalog-card ${item.quantity <= 0 ? 'out-of-stock' : ''}" 
             ${item.quantity > 0 ? `onclick="POS.addToCart('${item.id}')"` : ''}
             style="${item.quantity <= 0 ? 'opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;'}">
          <h3 class="catalog-card-title">${this._escapeHtml(item.name)}</h3>
          <p class="catalog-card-price">${Utils.formatCurrency(item.price)}</p>
          <p class="catalog-card-stock ${item.quantity <= 0 ? 'out-of-stock' : ''}">
            ${item.quantity > 0 ? `Stock: ${item.quantity}` : 'Out of Stock'}
          </p>
          ${item.quantity > 0
            ? '<button class="btn btn-sm btn-add-cart">+ Add to Cart</button>'
            : '<span class="badge badge-danger">Unavailable</span>'}
        </div>`
      )
      .join('');
  },

  // ─── Contributor Dropdown ──────────────────────────────────────────

  populateContributorDropdown() {
    const select = document.getElementById('item-contributor');
    if (!select) return;

    const contributors = (typeof Contributors !== 'undefined') ? Contributors.getAll() : [];

    select.innerHTML = '<option value="">— Select Contributor —</option>' +
      contributors
        .map((c) => `<option value="${c.id}" data-name="${this._escapeHtml(c.name)}">${this._escapeHtml(c.name)}</option>`)
        .join('');
  },

  // ─── Modal Operations ─────────────────────────────────────────────

  openAddModal() {
    try {
      const form = document.getElementById('item-form');
      if (form) form.reset();

      const hiddenId = document.getElementById('item-id-hidden');
      if (hiddenId) hiddenId.value = '';

      const title = document.getElementById('item-modal-title');
      if (title) title.textContent = 'Add Item';

      this.populateContributorDropdown();
      Utils.showModal('item-modal');
    } catch (err) {
      console.error('[Inventory.openAddModal] Error:', err);
      Utils.showToast('Failed to open form.', 'error');
    }
  },

  openEditModal(id) {
    try {
      const item = this.data.find((i) => i.id === id);
      if (!item) {
        Utils.showToast('Item not found.', 'error');
        return;
      }

      const title = document.getElementById('item-modal-title');
      if (title) title.textContent = 'Edit Item';

      this.populateContributorDropdown();

      document.getElementById('item-id-hidden').value = id;
      document.getElementById('item-name').value = item.name || '';
      document.getElementById('item-price').value = item.price || '';
      document.getElementById('item-quantity').value = item.quantity || 0;

      const select = document.getElementById('item-contributor');
      if (select && item.contributorId) {
        select.value = item.contributorId;
      }

      Utils.showModal('item-modal');
    } catch (err) {
      console.error('[Inventory.openEditModal] Error:', err);
      Utils.showToast('Failed to open form.', 'error');
    }
  },

  // ─── Save (Add or Update) ─────────────────────────────────────────

  async save() {
    try {
      const name = document.getElementById('item-name').value.trim();
      const price = parseFloat(document.getElementById('item-price').value);
      const quantity = parseInt(document.getElementById('item-quantity').value, 10);
      const contributorSelect = document.getElementById('item-contributor');
      const contributorId = contributorSelect ? contributorSelect.value : '';
      const contributorName = contributorSelect && contributorSelect.selectedOptions[0]
        ? contributorSelect.selectedOptions[0].getAttribute('data-name') || contributorSelect.selectedOptions[0].textContent
        : '';
      const existingId = document.getElementById('item-id-hidden').value;

      // Validation
      if (!name) {
        Utils.showToast('Item name is required.', 'warning');
        return;
      }
      if (isNaN(price) || price < 0) {
        Utils.showToast('Please enter a valid price.', 'warning');
        return;
      }
      if (isNaN(quantity) || quantity < 0) {
        Utils.showToast('Please enter a valid quantity.', 'warning');
        return;
      }

      const saveBtn = document.getElementById('save-item-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
      }

      const data = {
        name,
        price,
        quantity,
        contributorId: contributorId || '',
        contributorName: contributorId ? contributorName : '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (existingId) {
        await window.db.collection('inventory').doc(existingId).update(data);
        Utils.showToast('Item updated.', 'success');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await window.db.collection('inventory').add(data);
        Utils.showToast('Item added.', 'success');
      }

      Utils.hideModal('item-modal');
    } catch (err) {
      console.error('[Inventory.save] Error:', err);
      Utils.showToast('Failed to save item.', 'error');
    } finally {
      const saveBtn = document.getElementById('save-item-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  },

  // ─── Delete ────────────────────────────────────────────────────────

  async delete(id) {
    try {
      const item = this.data.find((i) => i.id === id);
      const name = item ? item.name : 'this item';

      if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

      await window.db.collection('inventory').doc(id).delete();
      Utils.showToast('Item deleted.', 'success');
    } catch (err) {
      console.error('[Inventory.delete] Error:', err);
      Utils.showToast('Failed to delete item.', 'error');
    }
  },

  // ─── Search ────────────────────────────────────────────────────────

  search(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.render();
      return;
    }
    const filtered = this.data.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.contributorName && item.contributorName.toLowerCase().includes(q))
    );
    this.render(filtered);
  },

  searchCatalog(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderCatalog();
      return;
    }
    const filtered = this.data.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
    this.renderCatalog(filtered);
  },

  // ─── Stats ─────────────────────────────────────────────────────────

  updateStats() {
    const totalItemsEl = document.getElementById('stat-total-items');
    const totalValueEl = document.getElementById('stat-total-value');

    if (totalItemsEl) {
      const totalQuantity = this.data.reduce((sum, item) => sum + (item.quantity || 0), 0);
      totalItemsEl.textContent = totalQuantity.toLocaleString('en-IN');
    }

    if (totalValueEl) {
      const totalValue = this.data.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
        0
      );
      totalValueEl.textContent = Utils.formatCurrency(totalValue);
    }
  },

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const saveBtn = document.getElementById('save-item-btn');
    if (saveBtn) saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.save();
    });

    const closeBtn = document.getElementById('close-item-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => Utils.hideModal('item-modal'));

    const form = document.getElementById('item-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    // Inventory table search
    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
      invSearch.addEventListener(
        'input',
        Utils.debounce((e) => this.search(e.target.value), 300)
      );
    }
  },

  // ─── Helpers ───────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

console.log('[Inventory] Loaded.');
