// Shared basket utilities — used across all pages
(function () {
  'use strict';

  var BASKET_KEY = 'tg_basket';

  window.TGBasket = {
    getItems: function () {
      try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || []; }
      catch (e) { return []; }
    },

    saveItems: function (items) {
      localStorage.setItem(BASKET_KEY, JSON.stringify(items));
      this.updateCount();
    },

    addItem: function (item) {
      var items = this.getItems();
      item.basket_id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      items.push(item);
      this.saveItems(items);
      return item.basket_id;
    },

    removeItem: function (basketId) {
      var items = this.getItems().filter(function (i) { return i.basket_id !== basketId; });
      this.saveItems(items);
    },

    clear: function () {
      localStorage.removeItem(BASKET_KEY);
      this.updateCount();
    },

    count: function () {
      return this.getItems().length;
    },

    updateCount: function () {
      var countEls = document.querySelectorAll('#basketCount');
      var c = this.count();
      countEls.forEach(function (el) { el.textContent = c; });
    }
  };

  // Update count on load
  document.addEventListener('DOMContentLoaded', function () {
    window.TGBasket.updateCount();
  });
})();
