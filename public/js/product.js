// Product detail page
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) { window.location.href = '/catalogue.html'; return; }

  fetch('/api/products/' + encodeURIComponent(slug))
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(renderProduct)
    .catch(function () {
      document.getElementById('productDetail').innerHTML =
        '<div class="loading">Product not found. <a href="/catalogue.html" style="color:#16a34a">Back to catalogue</a></div>';
    });

  function renderProduct(product) {
    document.title = product.name + ' — Tree Grows Ltd';
    document.getElementById('breadcrumbProduct').textContent = product.name;

    var colourOptions = product.colours.length
      ? '<div class="option-group"><label>Colour</label><select id="optColour"><option value="">Select colour</option>' +
        product.colours.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
        '</select></div>'
      : '';

    var sizeOptions = product.sizes.length
      ? '<div class="option-group"><label>Size</label><select id="optSize"><option value="">Select size</option>' +
        product.sizes.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('') +
        '</select></div>'
      : '';

    var brandingOptions = product.branding_methods.length
      ? '<div class="option-group"><label>Branding Method</label><select id="optBranding"><option value="">Select method</option>' +
        product.branding_methods.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('') +
        '</select></div>'
      : '';

    var categoryIcons = {
      'printing': '🖨️', 'branded-apparel': '👕', 'promotional-gifts': '🎁',
      'graduation-gowns': '🎓', 'signage-displays': '🏷️', 'packaging': '📦'
    };
    var icon = categoryIcons[product.category_slug] || '📦';

    document.getElementById('productDetail').innerHTML =
      '<div class="product-image">' + icon + '</div>' +
      '<div class="product-info">' +
        '<div class="product-cat">' + esc(product.category_name) + '</div>' +
        '<h1>' + esc(product.name) + '</h1>' +
        '<p class="product-desc">' + esc(product.description || product.short_description || '') + '</p>' +
        (product.price_from ? '<div class="price-tag">From R' + product.price_from.toFixed(2) + ' per unit</div>' : '') +
        (product.min_quantity > 1 ? '<p style="font-size:.85rem;color:#6b7280;margin-bottom:1rem">Minimum quantity: ' + product.min_quantity + '</p>' : '') +
        colourOptions + sizeOptions + brandingOptions +
        '<div class="option-group"><label>Quantity</label><input type="number" id="optQty" min="' + product.min_quantity + '" value="' + product.min_quantity + '"/></div>' +
        '<div class="option-group"><label>Notes (optional)</label><textarea id="optNotes" rows="2" placeholder="Special requirements, logo details, etc." style="width:100%;max-width:300px;padding:.6rem .75rem;border:1px solid #d1d5db;border-radius:.5rem;font-family:inherit;font-size:.9rem"></textarea></div>' +
        '<button class="btn btn-primary btn-lg add-to-basket-btn" id="addToBasketBtn">Add to Quote Basket</button>' +
      '</div>';

    // Add to basket
    document.getElementById('addToBasketBtn').addEventListener('click', function () {
      var colour = document.getElementById('optColour');
      var size = document.getElementById('optSize');
      var branding = document.getElementById('optBranding');
      var qty = parseInt(document.getElementById('optQty').value) || product.min_quantity;
      var notes = document.getElementById('optNotes').value.trim();

      window.TGBasket.addItem({
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        colour: colour ? colour.value : null,
        size: size ? size.value : null,
        branding_method: branding ? branding.value : null,
        notes: notes || null,
      });

      var btn = document.getElementById('addToBasketBtn');
      btn.textContent = '✓ Added to Basket!';
      btn.style.background = '#059669';
      setTimeout(function () {
        btn.textContent = 'Add to Quote Basket';
        btn.style.background = '';
      }, 2000);
    });

    // Related products
    if (product.related && product.related.length) {
      document.getElementById('relatedSection').style.display = 'block';
      document.getElementById('relatedGrid').innerHTML = product.related.map(function (r) {
        return '<div class="product-card">' +
          '<h3>' + esc(r.name) + '</h3>' +
          '<div class="card-desc">' + esc(r.short_description || '') + '</div>' +
          (r.price_from ? '<div class="card-price">From R' + r.price_from.toFixed(2) + '</div>' : '') +
          '<div class="card-actions"><a href="/product.html?slug=' + encodeURIComponent(r.slug) + '" class="btn btn-outline" style="flex:1;font-size:.85rem">View Details</a></div>' +
        '</div>';
      }).join('');
    }
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
})();
