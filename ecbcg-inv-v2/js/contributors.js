/**
 * Contributors — Contributor Management Module
 * -----------------------------------------------
 * Real-time CRUD for the 'contributors' Firestore collection.
 * Provides data cache used by Inventory module for contributor dropdown.
 */

const Contributors = {
  data: [],          // Local cache of contributor objects
  unsubscribe: null, // Firestore onSnapshot unsubscribe function

  /**
   * Initialize the Contributors module.
   * Sets up the real-time listener and binds UI events.
   */
  init() {
    try {
      this._bindEvents();
      this._startListener();
      console.log('[Contributors] Initialized.');
    } catch (err) {
      console.error('[Contributors.init] Error:', err);
      Utils.showToast('Failed to initialize contributors.', 'error');
    }
  },

  // ─── Real-time Listener ────────────────────────────────────────────

  _startListener() {
    // Unsubscribe from any existing listener first
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = window.db
      .collection('contributors')
      .orderBy('name')
      .onSnapshot(
        (snapshot) => {
          this.data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          this.render();
        },
        (err) => {
          console.error('[Contributors] Listener error:', err);
          Utils.showToast('Failed to load contributors.', 'error');
        }
      );
  },

  // ─── Render ────────────────────────────────────────────────────────

  render() {
    const tbody = document.getElementById('contributors-table-body');
    if (!tbody) return;

    if (this.data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:20px;color:#6b7280;">No contributors added yet.</td></tr>';
      return;
    }

    // Count linked inventory items per contributor
    const inventoryData = (typeof Inventory !== 'undefined') ? Inventory.data : [];

    tbody.innerHTML = this.data
      .map(
        (c) => {
          const linkedCount = inventoryData.filter((i) => i.contributorId === c.id).length;
          return `
          <tr>
            <td>${this._escapeHtml(c.name)}</td>
            <td>${this._escapeHtml(c.contact || '—')}</td>
            <td>${this._escapeHtml(c.details || '—')}</td>
            <td>${linkedCount}</td>
            <td>
              <button class="btn btn-sm btn-edit" onclick="Contributors.openEditModal('${c.id}')">Edit</button>
              <button class="btn btn-sm btn-delete" onclick="Contributors.delete('${c.id}')">Delete</button>
            </td>
          </tr>`;
        }
      )
      .join('');
  },

  // ─── Modal Operations ─────────────────────────────────────────────

  openAddModal() {
    try {
      const form = document.getElementById('contributor-form');
      if (form) form.reset();

      const hiddenId = document.getElementById('contributor-id-hidden');
      if (hiddenId) hiddenId.value = '';

      const title = document.getElementById('contributor-modal-title');
      if (title) title.textContent = 'Add Contributor';

      Utils.showModal('contributor-modal');
    } catch (err) {
      console.error('[Contributors.openAddModal] Error:', err);
      Utils.showToast('Failed to open form.', 'error');
    }
  },

  openEditModal(id) {
    try {
      const contributor = this.data.find((c) => c.id === id);
      if (!contributor) {
        Utils.showToast('Contributor not found.', 'error');
        return;
      }

      const title = document.getElementById('contributor-modal-title');
      if (title) title.textContent = 'Edit Contributor';

      document.getElementById('contributor-id-hidden').value = id;
      document.getElementById('contributor-name').value = contributor.name || '';
      document.getElementById('contributor-contact').value = contributor.contact || '';
      document.getElementById('contributor-details').value = contributor.details || '';

      Utils.showModal('contributor-modal');
    } catch (err) {
      console.error('[Contributors.openEditModal] Error:', err);
      Utils.showToast('Failed to open form.', 'error');
    }
  },

  // ─── Save (Add or Update) ─────────────────────────────────────────

  async save() {
    try {
      const name = document.getElementById('contributor-name').value.trim();
      const contact = document.getElementById('contributor-contact').value.trim();
      const details = document.getElementById('contributor-details').value.trim();
      const existingId = document.getElementById('contributor-id-hidden').value;

      if (!name) {
        Utils.showToast('Contributor name is required.', 'warning');
        return;
      }

      const saveBtn = document.getElementById('save-contributor-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
      }

      const data = {
        name,
        contact,
        details,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (existingId) {
        // Update existing
        await window.db.collection('contributors').doc(existingId).update(data);
        Utils.showToast('Contributor updated.', 'success');
      } else {
        // Add new
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await window.db.collection('contributors').add(data);
        Utils.showToast('Contributor added.', 'success');
      }

      Utils.hideModal('contributor-modal');
    } catch (err) {
      console.error('[Contributors.save] Error:', err);
      Utils.showToast('Failed to save contributor.', 'error');
    } finally {
      const saveBtn = document.getElementById('save-contributor-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  },

  // ─── Delete ────────────────────────────────────────────────────────

  async delete(id) {
    try {
      const contributor = this.data.find((c) => c.id === id);
      const name = contributor ? contributor.name : 'this contributor';

      if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

      // Check for linked inventory items
      const linkedItems = await window.db
        .collection('inventory')
        .where('contributorId', '==', id)
        .limit(1)
        .get();

      if (!linkedItems.empty) {
        Utils.showToast(
          `Cannot delete "${name}" — they have linked inventory items. Remove or reassign those items first.`,
          'warning'
        );
        return;
      }

      await window.db.collection('contributors').doc(id).delete();
      Utils.showToast('Contributor deleted.', 'success');
    } catch (err) {
      console.error('[Contributors.delete] Error:', err);
      Utils.showToast('Failed to delete contributor.', 'error');
    }
  },

  // ─── Public Accessor ──────────────────────────────────────────────

  /**
   * Returns the cached contributors array. Used by Inventory for the dropdown.
   * @returns {Array}
   */
  getAll() {
    return this.data;
  },

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    const addBtn = document.getElementById('add-contributor-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const saveBtn = document.getElementById('save-contributor-btn');
    if (saveBtn) saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.save();
    });

    const closeBtn = document.getElementById('close-contributor-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => Utils.hideModal('contributor-modal'));

    // Also close on form submit (prevent default)
    const form = document.getElementById('contributor-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
  },

  // ─── Helpers ───────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

console.log('[Contributors] Loaded.');
