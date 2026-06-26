/**
 * Utils — Global Utility Functions
 * ---------------------------------
 * Provides toast notifications, currency/date formatting, modal helpers,
 * loading state management, and debounce utility.
 */

const Utils = {

  // ─── Toast Notifications ───────────────────────────────────────────

  /**
   * Show a toast notification that auto-dismisses after 3 seconds.
   * @param {string} message - The message to display.
   * @param {'success'|'error'|'warning'} type - The toast type.
   */
  showToast(message, type = 'success') {
    try {
      // Create container if it doesn't exist
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText =
          'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.style.cssText =
        'padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;min-width:250px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:8px;' +
        'animation:slideIn 0.3s ease;opacity:1;transition:opacity 0.3s ease;';

      const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b'
      };
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
      };

      toast.style.backgroundColor = colors[type] || colors.success;
      toast.innerHTML = `<span style="font-weight:bold;font-size:16px;">${icons[type] || icons.success}</span><span>${message}</span>`;

      container.appendChild(toast);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    } catch (err) {
      console.error('[Utils.showToast] Error:', err);
    }
  },

  // ─── Currency Formatting ───────────────────────────────────────────

  /**
   * Format a number as INR currency string.
   * @param {number} amount
   * @returns {string} e.g. "₹1,234.00"
   */
  formatCurrency(amount) {
    try {
      const num = Number(amount) || 0;
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch (err) {
      console.error('[Utils.formatCurrency] Error:', err);
      return `₹${Number(amount || 0).toFixed(2)}`;
    }
  },

  // ─── Date Formatting ──────────────────────────────────────────────

  /**
   * Format a Firestore Timestamp to a date string.
   * @param {firebase.firestore.Timestamp|Date|string} timestamp
   * @returns {string} e.g. "26 Jun 2026"
   */
  formatDate(timestamp) {
    try {
      let date;
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return '—';
      }
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (err) {
      console.error('[Utils.formatDate] Error:', err);
      return '—';
    }
  },

  /**
   * Format a Firestore Timestamp to a date+time string.
   * @param {firebase.firestore.Timestamp|Date|string} timestamp
   * @returns {string} e.g. "26 Jun 2026, 10:30 PM"
   */
  formatDateTime(timestamp) {
    try {
      let date;
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return '—';
      }
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (err) {
      console.error('[Utils.formatDateTime] Error:', err);
      return '—';
    }
  },

  /**
   * Get today's date as a YYYY-MM-DD string.
   * @returns {string}
   */
  getTodayDateStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // ─── Modal Helpers ─────────────────────────────────────────────────

  /**
   * Show a modal by adding the .active class.
   * @param {string} modalId - The modal element's ID.
   */
  showModal(modalId) {
    try {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
      } else {
        console.warn(`[Utils.showModal] Modal not found: #${modalId}`);
      }
    } catch (err) {
      console.error('[Utils.showModal] Error:', err);
    }
  },

  /**
   * Hide a modal by removing the .active class.
   * @param {string} modalId - The modal element's ID.
   */
  hideModal(modalId) {
    try {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
      } else {
        console.warn(`[Utils.hideModal] Modal not found: #${modalId}`);
      }
    } catch (err) {
      console.error('[Utils.hideModal] Error:', err);
    }
  },

  // ─── Loading State ─────────────────────────────────────────────────

  /**
   * Show a loading indicator inside an element.
   * @param {string} elementId
   */
  showLoading(elementId) {
    try {
      const el = document.getElementById(elementId);
      if (el) {
        el.dataset.originalContent = el.innerHTML;
        el.innerHTML =
          '<div class="loading-spinner" style="text-align:center;padding:20px;">' +
          '<div style="display:inline-block;width:30px;height:30px;border:3px solid #e5e7eb;' +
          'border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
          '<p style="margin-top:8px;color:#6b7280;font-size:14px;">Loading…</p></div>';
      }
    } catch (err) {
      console.error('[Utils.showLoading] Error:', err);
    }
  },

  /**
   * Hide the loading indicator and restore original content.
   * @param {string} elementId
   */
  hideLoading(elementId) {
    try {
      const el = document.getElementById(elementId);
      if (el && el.dataset.originalContent !== undefined) {
        el.innerHTML = el.dataset.originalContent;
        delete el.dataset.originalContent;
      }
    } catch (err) {
      console.error('[Utils.hideLoading] Error:', err);
    }
  },

  // ─── Debounce ──────────────────────────────────────────────────────

  /**
   * Create a debounced version of a function.
   * @param {Function} fn
   * @param {number} delay - Delay in milliseconds.
   * @returns {Function}
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
};

// Inject keyframe animations for toast + spinner
(function injectAnimations() {
  if (document.getElementById('utils-animations')) return;
  const style = document.createElement('style');
  style.id = 'utils-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
})();

console.log('[Utils] Loaded.');
