/**
 * E-commerce GA4 Events Handler
 * Handles all e-commerce event tracking for the shop demo
 */

(function() {
  'use strict';

  // Ensure gtag is available
  window.gtag = window.gtag || function() {};

  /**
   * Track view_item event for product detail views
   */
  window.trackViewItem = function(productId, productName, price, category) {
    gtag('event', 'view_item', {
      currency: 'JPY',
      items: [{
        item_id: productId,
        item_name: productName,
        item_category: category,
        price: price
      }]
    });

    logToDebugPanel('view_item', {
      product_id: productId,
      product_name: productName,
      price: price
    });
  };

  /**
   * Track view_item_list event when products are displayed
   */
  window.trackViewItemList = function(items, listName = 'products') {
    gtag('event', 'view_item_list', {
      item_list_name: listName,
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        item_list_position: item.position || undefined
      }))
    });

    logToDebugPanel('view_item_list', {
      list_name: listName,
      items_count: items.length
    });
  };

  /**
   * Track select_item event when user selects/clicks a product
   */
  window.trackSelectItem = function(productId, productName, category, listName = 'products') {
    gtag('event', 'select_item', {
      item_list_name: listName,
      items: [{
        item_id: productId,
        item_name: productName,
        item_category: category
      }]
    });

    logToDebugPanel('select_item', {
      product_id: productId,
      product_name: productName,
      list_name: listName
    });
  };

  /**
   * Track add_to_cart event
   * Called from shop.html addToCart function
   */
  window.trackAddToCart = function(productId, productName, price, quantity = 1, category) {
    gtag('event', 'add_to_cart', {
      currency: 'JPY',
      items: [{
        item_id: productId,
        item_name: productName,
        item_category: category,
        price: price,
        quantity: quantity
      }]
    });

    logToDebugPanel('add_to_cart', {
      product_id: productId,
      product_name: productName,
      quantity: quantity,
      price: price
    });
  };

  /**
   * Track remove_from_cart event
   */
  window.trackRemoveFromCart = function(productId, productName, price, quantity = 1, category) {
    gtag('event', 'remove_from_cart', {
      currency: 'JPY',
      items: [{
        item_id: productId,
        item_name: productName,
        item_category: category,
        price: price,
        quantity: quantity
      }]
    });

    logToDebugPanel('remove_from_cart', {
      product_id: productId,
      product_name: productName,
      quantity: quantity
    });
  };

  /**
   * Track view_cart event
   */
  window.trackViewCart = function(cartItems, cartTotal) {
    gtag('event', 'view_cart', {
      currency: 'JPY',
      value: cartTotal,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    });

    logToDebugPanel('view_cart', {
      items_count: cartItems.length,
      cart_total: cartTotal
    });
  };

  /**
   * Track begin_checkout event
   * Called when user initiates checkout
   */
  window.trackBeginCheckout = function(cartItems, cartTotal) {
    gtag('event', 'begin_checkout', {
      currency: 'JPY',
      value: cartTotal,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    });

    logToDebugPanel('begin_checkout', {
      items_count: cartItems.length,
      value: cartTotal
    });
  };

  /**
   * Track add_shipping_info event
   */
  window.trackAddShippingInfo = function(cartItems, cartTotal, shippingTier = 'standard') {
    gtag('event', 'add_shipping_info', {
      currency: 'JPY',
      value: cartTotal,
      shipping_tier: shippingTier,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    });

    logToDebugPanel('add_shipping_info', {
      shipping_tier: shippingTier,
      value: cartTotal
    });
  };

  /**
   * Track add_payment_info event
   */
  window.trackAddPaymentInfo = function(cartItems, cartTotal, paymentType = 'credit_card') {
    gtag('event', 'add_payment_info', {
      currency: 'JPY',
      value: cartTotal,
      payment_type: paymentType,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    });

    logToDebugPanel('add_payment_info', {
      payment_type: paymentType,
      value: cartTotal
    });
  };

  /**
   * Track purchase event
   * This is the most important e-commerce event
   */
  window.trackPurchase = function(transactionId, cartItems, cartTotal, affiliation = '') {
    const purchaseData = {
      transaction_id: transactionId,
      currency: 'JPY',
      value: cartTotal,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    };

    if (affiliation) {
      purchaseData.affiliation = affiliation;
    }

    gtag('event', 'purchase', purchaseData);

    logToDebugPanel('purchase', {
      transaction_id: transactionId,
      value: cartTotal,
      items_count: cartItems.length
    });
  };

  /**
   * Track refund event
   */
  window.trackRefund = function(transactionId, cartItems, refundAmount) {
    gtag('event', 'refund', {
      currency: 'JPY',
      transaction_id: transactionId,
      value: refundAmount,
      items: cartItems.map(item => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity
      }))
    });

    logToDebugPanel('refund', {
      transaction_id: transactionId,
      refund_amount: refundAmount
    });
  };

  /**
   * Log event to GA4 Debug Panel (helper function)
   */
  function logToDebugPanel(eventName, params) {
    if (window.logGA4EventToDebugPanel) {
      window.logGA4EventToDebugPanel(eventName, params);
    }
  }

  /**
   * Initialize GA4 e-commerce measurement
   * Should be called on page load
   */
  window.initializeEcommerceMeasurement = function() {
    // Track view_item_list event when products are visible
    const productCards = document.querySelectorAll('.product-card');
    if (productCards.length > 0) {
      const products = Array.from(productCards).map((card, index) => ({
        id: card.dataset.productId,
        name: card.querySelector('.card-title')?.textContent || 'Unknown Product',
        category: card.querySelector('.badge')?.textContent || 'general',
        price: parseInt(
          card.querySelector('.product-price')?.textContent?.replace(/[^\d]/g, '') || '0'
        ),
        position: index + 1
      }));

      trackViewItemList(products, 'products_page');
    }

    // Add click tracking to product cards
    productCards.forEach((card, index) => {
      card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) {
          const productId = card.dataset.productId;
          const productName = card.querySelector('.card-title')?.textContent;
          const category = card.querySelector('.badge')?.textContent;

          trackSelectItem(productId, productName, category, 'products_page');
        }
      });
    });

    // Track cart button click
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
      cartBtn.addEventListener('click', function() {
        const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
        const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (cartItems.length > 0) {
          trackViewCart(cartItems, cartTotal);
        }
      });
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initializeEcommerceMeasurement);
  } else {
    window.initializeEcommerceMeasurement();
  }

})();
