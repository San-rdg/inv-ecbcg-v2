/**
 * POS — Point of Sale Module
 * ----------------------------
 * Manages the shopping cart, POS catalog search, and checkout flow.
 * Checkout uses atomic Firestore batch writes to record the sale
 * and decrement inventory stock simultaneously.
 */

const POS = {
  /**
   * Cart items array.
   * Each entry: { itemId, itemName, price, quantity, contributorId, contributorName, maxStock }
   */
  cart: [],

  /**
   * Initialize the POS module.
   * Binds search, checkout, and clear-cart events.
   */
  init() {
    try {
      this._bindEvents();
      this.renderCart();
      console.log('[POS] Initialized.');
    } catch (err) {
      console.error('[POS.init] Error:', err);
      Utils.showToast('Failed to initialize POS.', 'error');
    }
  },

  // ─── Cart Operations ─────────────────────────────────────────────

  /**
   * Add an item to the cart (or increment if already present).
   * @param {string} itemId - Inventory document ID.
   */
  addToCart(itemId) {
    try {
      const item = Inventory.data.find((i) => i.id === itemId);
      if (!item) {
        Utils.showToast('Item not found in inventory.', 'error');
        return;
      }

      if (item.quantity <= 0) {
        Utils.showToast(`"${item.name}" is out of stock.`, 'warning');
        return;
      }

      // Check if already in cart
      const existing = this.cart.find((c) => c.itemId === itemId);
      if (existing) {
        if (existing.quantity >= item.quantity) {
          Utils.showToast(`Cannot add more — only ${item.quantity} in stock.`, 'warning');
          return;
        }
        existing.quantity += 1;
        // Sync the latest price and stock from inventory cache
        existing.price = item.price;
        existing.maxStock = item.quantity;
      } else {
        this.cart.push({
          itemId: item.id,
          itemName: item.name,
          price: item.price,
          quantity: 1,
          contributorId: item.contributorId || '',
          contributorName: item.contributorName || '',
          maxStock: item.quantity
        });
      }

      this.renderCart();
      Utils.showToast(`Added "${item.name}" to cart.`, 'success');
    } catch (err) {
      console.error('[POS.addToCart] Error:', err);
      Utils.showToast('Failed to add item to cart.', 'error');
    }
  },

  /**
   * Remove an item from the cart by index.
   * @param {number} index
   */
  removeFromCart(index) {
    try {
      if (index < 0 || index >= this.cart.length) return;
      const removed = this.cart.splice(index, 1)[0];
      this.renderCart();
      Utils.showToast(`Removed "${removed.itemName}" from cart.`, 'success');
    } catch (err) {
      console.error('[POS.removeFromCart] Error:', err);
      Utils.showToast('Failed to remove item.', 'error');
    }
  },

  /**
   * Update the quantity for a cart item.
   * @param {number} index - Cart array index.
   * @param {number} newQty - New quantity value.
   */
  updateQuantity(index, newQty) {
    try {
      if (index < 0 || index >= this.cart.length) return;

      const cartItem = this.cart[index];
      const qty = parseInt(newQty, 10);

      if (isNaN(qty) || qty < 1) {
        // Remove from cart if quantity drops to 0 or invalid
        this.removeFromCart(index);
        return;
      }

      // Re-read max stock from inventory cache for freshness
      const inventoryItem = Inventory.data.find((i) => i.id === cartItem.itemId);
      const maxStock = inventoryItem ? inventoryItem.quantity : cartItem.maxStock;

      if (qty > maxStock) {
        Utils.showToast(`Only ${maxStock} in stock for "${cartItem.itemName}".`, 'warning');
        cartItem.quantity = maxStock;
      } else {
        cartItem.quantity = qty;
      }

      this.renderCart();
    } catch (err) {
      console.error('[POS.updateQuantity] Error:', err);
      Utils.showToast('Failed to update quantity.', 'error');
    }
  },

  // ─── Render Cart ──────────────────────────────────────────────────

  renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartTotalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Cart count badge
    const totalItems = this.cart.reduce((sum, c) => sum + c.quantity, 0);
    if (cartCountEl) cartCountEl.textContent = totalItems;

    // Total
    const total = this.calculateTotal();
    if (cartSubtotalEl) cartSubtotalEl.textContent = Utils.formatCurrency(total);
    if (cartTotalEl) cartTotalEl.textContent = Utils.formatCurrency(total);

    // Enable/disable checkout
    if (checkoutBtn) checkoutBtn.disabled = this.cart.length === 0;

    // Render cart items list
    if (!cartItemsEl) return;

    if (this.cart.length === 0) {
      cartItemsEl.innerHTML =
        '<div style="text-align:center;padding:30px;color:#6b7280;">' +
        '<p>Your cart is empty.</p>' +
        '<p style="font-size:13px;">Click items in the catalog to add them.</p></div>';
      return;
    }

    cartItemsEl.innerHTML = this.cart
      .map(
        (item, index) => `
        <div class="cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <div style="flex:1;">
            <div style="font-weight:600;">${this._escapeHtml(item.itemName)}</div>
            <div style="font-size:13px;color:#6b7280;">${Utils.formatCurrency(item.price)} each</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-sm" onclick="POS.updateQuantity(${index}, ${item.quantity - 1})" style="min-width:28px;">−</button>
            <span style="min-width:24px;text-align:center;font-weight:600;">${item.quantity}</span>
            <button class="btn btn-sm" onclick="POS.updateQuantity(${index}, ${item.quantity + 1})" style="min-width:28px;">+</button>
          </div>
          <div style="min-width:80px;text-align:right;font-weight:600;">
            ${Utils.formatCurrency(item.price * item.quantity)}
          </div>
          <button class="btn btn-sm btn-delete" onclick="POS.removeFromCart(${index})" style="margin-left:8px;" title="Remove">✕</button>
        </div>`
      )
      .join('');
  },

  // ─── Calculations ─────────────────────────────────────────────────

  /**
   * Calculate the cart total.
   * @returns {number}
   */
  calculateTotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  // ─── Checkout ─────────────────────────────────────────────────────

  /**
   * Open the checkout confirmation modal with a summary.
   */
  openCheckout() {
    try {
      if (this.cart.length === 0) {
        Utils.showToast('Cart is empty.', 'warning');
        return;
      }

      const summaryEl = document.getElementById('checkout-summary');
      const totalEl = document.getElementById('checkout-total');

      if (summaryEl) {
        summaryEl.innerHTML =
          '<table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr style="border-bottom:2px solid #e5e7eb;">' +
          '<th style="text-align:left;padding:6px;">Item</th>' +
          '<th style="text-align:center;padding:6px;">Qty</th>' +
          '<th style="text-align:right;padding:6px;">Subtotal</th>' +
          '</tr></thead><tbody>' +
          this.cart
            .map(
              (item) => `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:6px;">${this._escapeHtml(item.itemName)}</td>
                <td style="text-align:center;padding:6px;">${item.quantity}</td>
                <td style="text-align:right;padding:6px;">${Utils.formatCurrency(item.price * item.quantity)}</td>
              </tr>`
            )
            .join('') +
          '</tbody></table>';
      }

      if (totalEl) totalEl.textContent = Utils.formatCurrency(this.calculateTotal());

      Utils.showModal('checkout-modal');
    } catch (err) {
      console.error('[POS.openCheckout] Error:', err);
      Utils.showToast('Failed to open checkout.', 'error');
    }
  },

  /**
   * Process the checkout — CRITICAL atomic operation.
   * 1. Re-validates stock from Firestore
   * 2. Creates a sale document
   * 3. Decrements inventory quantities
   * 4. All via a Firestore batch write
   */
  async processCheckout() {
    try {
      if (this.cart.length === 0) {
        Utils.showToast('Cart is empty.', 'warning');
        return;
      }

      const confirmBtn = document.getElementById('confirm-checkout-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing…';
      }

      // Step 1: Re-validate stock for every cart item
      const stockErrors = [];
      for (const cartItem of this.cart) {
        const doc = await window.db.collection('inventory').doc(cartItem.itemId).get();
        if (!doc.exists) {
          stockErrors.push(`"${cartItem.itemName}" no longer exists.`);
          continue;
        }
        const currentStock = doc.data().quantity || 0;
        if (cartItem.quantity > currentStock) {
          stockErrors.push(
            `"${cartItem.itemName}" — only ${currentStock} left (you have ${cartItem.quantity}).`
          );
        }
      }

      if (stockErrors.length > 0) {
        Utils.showToast('Stock issues:\n' + stockErrors.join('\n'), 'error');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Sale';
        }
        return;
      }

      // Step 2: Build batch
      const batch = window.db.batch();

      // Build sale items array
      const saleItems = this.cart.map((cartItem) => ({
        itemId: cartItem.itemId,
        itemName: cartItem.itemName,
        priceAtSale: cartItem.price,
        quantity: cartItem.quantity,
        contributorId: cartItem.contributorId,
        contributorName: cartItem.contributorName,
        subtotal: cartItem.price * cartItem.quantity
      }));

      const totalAmount = this.calculateTotal();

      // Create sale document
      const saleRef = window.db.collection('sales').doc();
      batch.set(saleRef, {
        items: saleItems,
        totalAmount,
        processedBy: window.currentUser.uid,
        processedByName: window.currentUser.displayName,
        saleDate: firebase.firestore.FieldValue.serverTimestamp(),
        saleDateStr: Utils.getTodayDateStr()
      });

      // Step 3: Decrement inventory for each cart item
      for (const cartItem of this.cart) {
        const inventoryRef = window.db.collection('inventory').doc(cartItem.itemId);
        batch.update(inventoryRef, {
          quantity: firebase.firestore.FieldValue.increment(-cartItem.quantity),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // Step 4: Commit the batch atomically
      await batch.commit();

      // Step 5: Success — clear cart, close modal, toast
      this.cart = [];
      this.renderCart();
      Utils.hideModal('checkout-modal');
      Utils.showToast('Sale completed successfully!', 'success');

      console.log('[POS] Checkout completed. Sale ID:', saleRef.id);
    } catch (err) {
      console.error('[POS.processCheckout] Error:', err);
      Utils.showToast('Checkout failed. Please try again.', 'error');
    } finally {
      const confirmBtn = document.getElementById('confirm-checkout-btn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Sale';
      }
    }
  },

  /**
   * Clear the entire cart.
   */
  clearCart() {
    try {
      if (this.cart.length === 0) return;
      if (!confirm('Clear all items from the cart?')) return;
      this.cart = [];
      this.renderCart();
      Utils.showToast('Cart cleared.', 'success');
    } catch (err) {
      console.error('[POS.clearCart] Error:', err);
    }
  },

  // ─── Event Binding ────────────────────────────────────────────────

  _bindEvents() {
    // POS catalog search
    const posSearch = document.getElementById('pos-search');
    if (posSearch) {
      posSearch.addEventListener(
        'input',
        Utils.debounce((e) => {
          if (typeof Inventory !== 'undefined') {
            Inventory.searchCatalog(e.target.value);
          }
        }, 300)
      );
    }

    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.openCheckout());

    // Clear cart button
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) clearCartBtn.addEventListener('click', () => this.clearCart());

    // Checkout modal — confirm
    const confirmBtn = document.getElementById('confirm-checkout-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => this.processCheckout());

    // Checkout modal — cancel
    const cancelBtn = document.getElementById('cancel-checkout-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => Utils.hideModal('checkout-modal'));
  },

  // ─── Helpers ──────────────────────────────────────────────────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
};

console.log('[POS] Loaded.');
