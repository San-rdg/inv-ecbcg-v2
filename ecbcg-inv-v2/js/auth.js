/**
 * Auth — Authentication & Session Management
 * --------------------------------------------
 * Handles login/logout, onAuthStateChanged, user profile loading,
 * and module initialization depending on the current page.
 */

const Auth = {

  /**
   * Initialize auth module. Detects the current page and sets up
   * the appropriate listeners and handlers.
   */
  init() {
    try {
      // Determine which page we're on by checking for key elements
      const loginForm = document.getElementById('login-form');
      const logoutBtn = document.getElementById('logout-btn');
      const guestCatalog = document.getElementById('guest-catalog-grid');

      if (loginForm) {
        // ── index.html (Login Page) ──
        this._initLoginPage(loginForm);
      } else if (guestCatalog) {
        // ── guest.html (Guest Catalog) ──
        this._initGuestPage();
      } else if (logoutBtn) {
        // ── dashboard.html (Main App) ──
        this._initDashboardPage(logoutBtn);
      }
    } catch (err) {
      console.error('[Auth.init] Error:', err);
    }
  },

  // ─── Login Page ────────────────────────────────────────────────────

  _initLoginPage(loginForm) {
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        if (loginError) {
          loginError.textContent = 'Please enter email and password.';
          loginError.style.display = 'block';
        }
        return;
      }

      // Disable button during login
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in…';
      }
      if (loginError) loginError.style.display = 'none';

      try {
        await window.auth.signInWithEmailAndPassword(email, password);
        // Redirect to dashboard on success
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error('[Auth] Login failed:', err);
        let message = 'Login failed. Please try again.';
        switch (err.code) {
          case 'auth/user-not-found':
            message = 'No account found with this email.';
            break;
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            message = 'Invalid email or password.';
            break;
          case 'auth/invalid-email':
            message = 'Invalid email format.';
            break;
          case 'auth/too-many-requests':
            message = 'Too many failed attempts. Please try later.';
            break;
        }
        if (loginError) {
          loginError.textContent = message;
          loginError.style.display = 'block';
        }
      } finally {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = 'Sign In';
        }
      }
    });

    // If already logged in, redirect straight to dashboard
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.href = 'dashboard.html';
      }
    });
  },

  // ─── Guest Page ────────────────────────────────────────────────────

  _initGuestPage() {
    // Load a read-only catalog for guests (no authentication required)
    this._loadGuestCatalog();
  },

  async _loadGuestCatalog() {
    try {
      const grid = document.getElementById('guest-catalog-grid');
      const searchInput = document.getElementById('guest-search');
      if (!grid) return;

      let items = [];

      const snapshot = await window.db.collection('inventory').orderBy('name').get();
      items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const renderGuest = (data) => {
        if (data.length === 0) {
          grid.innerHTML =
            '<div style="text-align:center;padding:40px;color:#6b7280;grid-column:1/-1;">' +
            '<p>No items found.</p></div>';
          return;
        }
        grid.innerHTML = data
          .map(
            (item) => `
          <div class="catalog-card">
            <h3 class="catalog-card-title">${this._escapeHtml(item.name)}</h3>
            <p class="catalog-card-price">${Utils.formatCurrency(item.price)}</p>
            <p class="catalog-card-stock ${item.quantity <= 0 ? 'out-of-stock' : ''}">
              ${item.quantity > 0 ? `In Stock: ${item.quantity}` : 'Out of Stock'}
            </p>
          </div>`
          )
          .join('');
      };

      renderGuest(items);

      if (searchInput) {
        searchInput.addEventListener(
          'input',
          Utils.debounce((e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
              renderGuest(items);
            } else {
              renderGuest(
                items.filter((i) => i.name.toLowerCase().includes(query))
              );
            }
          }, 300)
        );
      }
    } catch (err) {
      console.error('[Auth] Guest catalog error:', err);
      const grid = document.getElementById('guest-catalog-grid');
      if (grid)
        grid.innerHTML =
          '<p style="text-align:center;color:#ef4444;padding:20px;">Failed to load catalog.</p>';
    }
  },

  // ─── Dashboard Page ────────────────────────────────────────────────

  _initDashboardPage(logoutBtn) {
    // Bind logout
    logoutBtn.addEventListener('click', async () => {
      try {
        // Cleanup real-time listeners before signing out
        this._cleanupListeners();
        await window.auth.signOut();
        window.location.href = 'index.html';
      } catch (err) {
        console.error('[Auth] Sign out error:', err);
        Utils.showToast('Failed to sign out.', 'error');
      }
    });

    // Bind sidebar navigation
    this._initSidebarNav();

    // Auth state listener
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }
      await this._loadUserProfile(user);
    });
  },

  /**
   * Load user profile from 'users' collection and initialize all modules.
   */
  async _loadUserProfile(user) {
    try {
      const userDoc = await window.db.collection('users').doc(user.uid).get();

      if (userDoc.exists) {
        const data = userDoc.data();
        window.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: data.displayName || user.displayName || user.email,
          role: data.role || 'staff'
        };
      } else {
        // Fallback if no user doc exists
        window.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          role: 'staff'
        };
      }

      // Update header UI
      const nameEl = document.getElementById('user-name');
      const roleEl = document.getElementById('user-role-badge');
      if (nameEl) nameEl.textContent = window.currentUser.displayName;
      if (roleEl) {
        roleEl.textContent = window.currentUser.role.charAt(0).toUpperCase() +
          window.currentUser.role.slice(1);
      }

      // Initialize all modules
      this._initModules();

      console.log('[Auth] User loaded:', window.currentUser.displayName, `(${window.currentUser.role})`);
    } catch (err) {
      console.error('[Auth] Failed to load user profile:', err);
      Utils.showToast('Failed to load user profile.', 'error');
    }
  },

  /**
   * Initialize all application modules after auth.
   */
  _initModules() {
    try {
      if (typeof Contributors !== 'undefined') Contributors.init();
      if (typeof Inventory !== 'undefined') Inventory.init();
      if (typeof POS !== 'undefined') POS.init();
      if (typeof Sales !== 'undefined') Sales.init();
      if (typeof Register !== 'undefined') Register.init();
      if (typeof Export !== 'undefined') Export.init();
    } catch (err) {
      console.error('[Auth] Module init error:', err);
      Utils.showToast('Error initializing modules.', 'error');
    }
  },

  /**
   * Cleanup all real-time listeners before sign-out.
   */
  _cleanupListeners() {
    try {
      if (typeof Contributors !== 'undefined' && Contributors.unsubscribe) {
        Contributors.unsubscribe();
        Contributors.unsubscribe = null;
      }
      if (typeof Inventory !== 'undefined' && Inventory.unsubscribe) {
        Inventory.unsubscribe();
        Inventory.unsubscribe = null;
      }
      if (typeof Sales !== 'undefined' && Sales.unsubscribe) {
        Sales.unsubscribe();
        Sales.unsubscribe = null;
      }
    } catch (err) {
      console.error('[Auth] Cleanup error:', err);
    }
  },

  // ─── Sidebar Navigation ───────────────────────────────────────────

  _initSidebarNav() {
    const links = document.querySelectorAll('.sidebar-link');
    const panels = document.querySelectorAll('.tab-content');

    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = link.getAttribute('data-tab');
        if (!targetTab) return;

        // Remove active from all links and panels
        links.forEach((l) => l.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));

        // Activate selected link and panel
        link.classList.add('active');
        const panel = document.getElementById(targetTab);
        if (panel) panel.classList.add('active');
      });
    });
  },

  // ─── Helpers ───────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});

console.log('[Auth] Loaded.');
