const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// ── Helper: generate quote reference  TG-YYYYMMDD-XXXX ──
function generateReference() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TG-${date}-${rand}`;
}

// ════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════

router.get('/categories', (req, res) => {
  const db = req.app.locals.db;
  const categories = db.prepare(
    'SELECT id, name, slug, description, icon FROM categories WHERE active = 1 ORDER BY sort_order'
  ).all();
  res.json(categories);
});

// ════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════

router.get('/products', (req, res) => {
  const db = req.app.locals.db;
  const { category, search, featured } = req.query;

  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
  `;
  const params = [];

  if (category) {
    sql += ' AND c.slug = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (p.name LIKE ? OR p.short_description LIKE ? OR c.name LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (featured === '1') {
    sql += ' AND p.featured = 1';
  }

  sql += ' ORDER BY p.featured DESC, c.sort_order, p.name';

  const products = db.prepare(sql).all(...params);
  products.forEach(p => {
    p.branding_methods = JSON.parse(p.branding_methods || '[]');
    p.colours = JSON.parse(p.colours || '[]');
    p.sizes = JSON.parse(p.sizes || '[]');
  });

  res.json(products);
});

router.get('/products/:slug', (req, res) => {
  const db = req.app.locals.db;
  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND p.active = 1
  `).get(req.params.slug);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  product.branding_methods = JSON.parse(product.branding_methods || '[]');
  product.colours = JSON.parse(product.colours || '[]');
  product.sizes = JSON.parse(product.sizes || '[]');

  // Related products in same category
  const related = db.prepare(`
    SELECT id, name, slug, short_description, price_from, image_url
    FROM products
    WHERE category_id = ? AND id != ? AND active = 1
    ORDER BY RANDOM() LIMIT 3
  `).all(product.category_id, product.id);

  res.json({ ...product, related });
});

// ════════════════════════════════════════
//  QUOTE SUBMISSION (public)
// ════════════════════════════════════════

router.post('/quotes', (req, res) => {
  const db = req.app.locals.db;
  const { customer, items, delivery_address, required_date, notes } = req.body;

  if (!customer || !customer.name || !customer.email) {
    return res.status(400).json({ error: 'Customer name and email are required.' });
  }
  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }

  const result = db.transaction(() => {
    // Upsert customer
    let cust = db.prepare('SELECT id FROM customers WHERE email = ?').get(customer.email);
    if (!cust) {
      const ins = db.prepare(
        'INSERT INTO customers (name, email, phone, company, address) VALUES (?, ?, ?, ?, ?)'
      ).run(customer.name, customer.email, customer.phone || null, customer.company || null, customer.address || null);
      cust = { id: ins.lastInsertRowid };
    } else {
      db.prepare('UPDATE customers SET name=?, phone=?, company=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(customer.name, customer.phone || null, customer.company || null, cust.id);
    }

    // Create quote
    const reference = generateReference();
    const quote = db.prepare(`
      INSERT INTO quotes (reference, customer_id, delivery_address, required_date, customer_notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(reference, cust.id, delivery_address || null, required_date || null, notes || null);

    const quoteId = quote.lastInsertRowid;

    // Insert items
    const insertItem = db.prepare(`
      INSERT INTO quote_items (quote_id, product_id, product_name, quantity, colour, size, branding_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        quoteId,
        item.product_id || null,
        item.product_name || 'Custom Item',
        item.quantity || 1,
        item.colour || null,
        item.size || null,
        item.branding_method || null,
        item.notes || null
      );
    }

    // Activity log
    db.prepare(`
      INSERT INTO quote_activity (quote_id, action_type, description)
      VALUES (?, 'created', ?)
    `).run(quoteId, `Quote ${reference} submitted by ${customer.name} (${customer.email})`);

    return { quoteId, reference };
  })();

  res.status(201).json({
    success: true,
    reference: result.reference,
    message: `Thank you! Your quote reference is ${result.reference}. We'll be in touch within 24 hours.`,
  });
});

// Track a quote by reference (public)
router.get('/quotes/track/:reference', (req, res) => {
  const db = req.app.locals.db;
  const quote = db.prepare(`
    SELECT q.reference, q.status, q.created_at, q.updated_at,
           c.name AS customer_name
    FROM quotes q
    JOIN customers c ON c.id = q.customer_id
    WHERE q.reference = ?
  `).get(req.params.reference);

  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  const statusLabels = {
    new: 'Received — Awaiting Review',
    reviewed: 'Under Review',
    quoted: 'Quotation Sent',
    approved: 'Approved — Preparing',
    in_production: 'In Production',
    quality_check: 'Quality Check',
    ready: 'Ready for Collection / Shipping',
    shipped: 'Shipped',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  res.json({
    reference: quote.reference,
    status: quote.status,
    status_label: statusLabels[quote.status] || quote.status,
    submitted: quote.created_at,
    last_updated: quote.updated_at,
  });
});

module.exports = router;
