// Basket page logic
(function () {
  'use strict';

  renderBasket();

  function renderBasket() {
    var items = window.TGBasket.getItems();
    var emptyEl = document.getElementById('emptyBasket');
    var contentEl = document.getElementById('basketContent');
    var successEl = document.getElementById('successMessage');

    successEl.style.display = 'none';

    if (!items.length) {
      emptyEl.style.display = 'block';
      contentEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    var itemsHtml = items.map(function (item) {
      var details = [];
      if (item.quantity > 1) details.push('Qty: ' + item.quantity);
      if (item.colour) details.push('Colour: ' + item.colour);
      if (item.size) details.push('Size: ' + item.size);
      if (item.branding_method) details.push('Branding: ' + item.branding_method);
      if (item.notes) details.push('Notes: ' + item.notes);

      return '<div class="basket-item">' +
        '<div class="basket-item-info">' +
          '<h4>' + esc(item.product_name) + '</h4>' +
          '<div class="item-details">' + details.map(esc).join(' · ') + '</div>' +
        '</div>' +
        '<div class="basket-item-actions">' +
          '<button data-remove="' + item.basket_id + '">✕ Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    document.getElementById('basketItems').innerHTML =
      '<h3 style="margin-bottom:1rem">Items (' + items.length + ')</h3>' + itemsHtml +
      '<button id="clearBasket" style="margin-top:.5rem;background:none;border:none;color:#dc2626;font-size:.85rem;cursor:pointer;font-weight:600">Clear All Items</button>';

    // Remove buttons
    document.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.TGBasket.removeItem(btn.dataset.remove);
        renderBasket();
      });
    });

    // Clear all
    var clearBtn = document.getElementById('clearBasket');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (confirm('Remove all items from your basket?')) {
          window.TGBasket.clear();
          renderBasket();
        }
      });
    }
  }

  // Quote form submission
  document.getElementById('quoteForm').addEventListener('submit', function (e) {
    e.preventDefault();

    var items = window.TGBasket.getItems();
    if (!items.length) { alert('Your basket is empty.'); return; }

    var submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    var payload = {
      customer: {
        name: document.getElementById('custName').value.trim(),
        email: document.getElementById('custEmail').value.trim(),
        phone: document.getElementById('custPhone').value.trim() || null,
        company: document.getElementById('custCompany').value.trim() || null,
        address: document.getElementById('custAddress').value.trim() || null,
      },
      items: items.map(function (item) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          colour: item.colour,
          size: item.size,
          branding_method: item.branding_method,
          notes: item.notes,
        };
      }),
      delivery_address: document.getElementById('custAddress').value.trim() || null,
      required_date: document.getElementById('custDate').value || null,
      notes: document.getElementById('custNotes').value.trim() || null,
    };

    fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        window.TGBasket.clear();
        document.getElementById('basketContent').style.display = 'none';
        document.getElementById('emptyBasket').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        document.getElementById('quoteRef').textContent = data.reference;
      } else {
        alert(data.error || 'Something went wrong. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Quote Request';
      }
    })
    .catch(function () {
      alert('Connection error. Please check your internet and try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Quote Request';
    });
  });

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
})();
