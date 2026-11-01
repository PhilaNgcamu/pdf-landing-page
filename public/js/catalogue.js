// Catalogue page logic
(function () {
  'use strict';

  var allProducts = [];
  var currentCategory = '';
  var searchTimeout = null;

  // Load categories and products
  Promise.all([
    fetch('/api/categories').then(function (r) { return r.json(); }),
    fetch('/api/products').then(function (r) { return r.json(); }),
  ]).then(function (results) {
    var categories = results[0];
    var products = results[1];
    allProducts = products;
    renderCategoryFilters(categories);
    renderProducts(products);
  }).catch(function () {
    document.getElementById('productsGrid').innerHTML =
      '<div class="loading">Unable to load products. Please try again later.</div>';
  });

  function renderCategoryFilters(categories) {
    var container = document.getElementById('categoryFilters');
    categories.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.category = cat.slug;
      btn.textContent = cat.icon + ' ' + cat.name;
      container.appendChild(btn);
    });

    container.addEventListener('click', function (e) {
      if (!e.target.classList.contains('cat-btn')) return;
      container.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('active'); });
      e.target.classList.add('active');
      currentCategory = e.target.dataset.category || '';
      filterProducts();
    });
  }

  function filterProducts() {
    var search = document.getElementById('searchInput').value.toLowerCase().trim();
    var filtered = allProducts.filter(function (p) {
      var matchesCat = !currentCategory || p.category_slug === currentCategory;
      var matchesSearch = !search ||
        p.name.toLowerCase().includes(search) ||
        (p.short_description || '').toLowerCase().includes(search) ||
        p.category_name.toLowerCase().includes(search);
      return matchesCat && matchesSearch;
    });
    renderProducts(filtered);
  }

  document.getElementById('searchInput').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterProducts, 250);
  });

  function renderProducts(products) {
    var grid = document.getElementById('productsGrid');
    if (!products.length) {
      grid.innerHTML = '<div class="loading">No products match your search.</div>';
      return;
    }

    grid.innerHTML = products.map(function (p) {
      return '<div class="product-card">' +
        '<div class="card-cat">' + escHtml(p.category_name) + '</div>' +
        '<h3>' + escHtml(p.name) + '</h3>' +
        '<div class="card-desc">' + escHtml(p.short_description || '') + '</div>' +
        (p.price_from ? '<div class="card-price">From R' + p.price_from.toFixed(2) + '</div>' : '') +
        '<div class="card-actions">' +
          '<a href="/product.html?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-outline" style="font-size:.85rem">View Details</a>' +
          '<button class="btn btn-primary quick-add" data-id="' + p.id + '" data-name="' + escAttr(p.name) + '" style="font-size:.85rem">+ Add to Quote</button>' +
        '</div>' +
      '</div>';
    }).join('');

    // Quick-add buttons
    grid.querySelectorAll('.quick-add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.TGBasket.addItem({
          product_id: parseInt(btn.dataset.id),
          product_name: btn.dataset.name,
          quantity: 1,
          colour: null,
          size: null,
          branding_method: null,
          notes: null,
        });
        btn.textContent = '✓ Added!';
        btn.disabled = true;
        setTimeout(function () {
          btn.textContent = '+ Add to Quote';
          btn.disabled = false;
        }, 1500);
      });
    });
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
