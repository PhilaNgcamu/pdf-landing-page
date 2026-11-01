const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { requireAuth, requireRole } = require('../middleware/auth');

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Email transporter (configure via .env)
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// All admin routes require authentication
router.use(requireAuth);

// ════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════
router.get('/', (req, res) => {
  const db = req.app.locals.db;

  const stats = {
    totalQuotes: db.prepare('SELECT COUNT(*) as c FROM quotes').get().c,
    newQuotes: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status = 'new'").get().c,
    activeQuotes: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status NOT IN ('completed','cancelled')").get().c,
    totalCustomers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
    totalProducts: db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c,
    quotesToday: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE DATE(created_at) = DATE('now')").get().c,
  };

  const recentQuotes = db.prepare(`
    SELECT q.*, c.name AS customer_name, c.email AS customer_email,
           u.name AS assigned_name
    FROM quotes q
    JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.assigned_to
    ORDER BY q.created_at DESC LIMIT 10
  `).all();

  const recentActivity = db.prepare(`
    SELECT a.*, q.reference
    FROM quote_activity a
    JOIN quotes q ON q.id = a.quote_id
    ORDER BY a.created_at DESC LIMIT 15
  `).all();

  res.render('admin/dashboard', {
    user: req.session.user,
    title: 'Dashboard',
    stats,
    recentQuotes,
    recentActivity,
  });
});

// ════════════════════════════════════════
//  QUOTES
// ════════════════════════════════════════
router.get('/quotes', (req, res) => {
  const db = req.app.locals.db;
  const { status, priority, assigned, search, page = 1 } = req.query;
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND q.status = ?'; params.push(status); }
  if (priority) { where += ' AND q.priority = ?'; params.push(priority); }
  if (assigned) { where += ' AND q.assigned_to = ?'; params.push(assigned); }
  if (search) {
    where += ' AND (q.reference LIKE ? OR c.name LIKE ? OR c.email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM quotes q
    JOIN customers c ON c.id = q.customer_id ${where}
  `).get(...params).c;

  const quotes = db.prepare(`
    SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           u.name AS assigned_name
    FROM quotes q
    JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.assigned_to
    ${where}
    ORDER BY
      CASE q.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      q.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, perPage, offset);

  const staff = db.prepare("SELECT id, name FROM users WHERE active = 1").all();

  res.render('admin/quotes', {
    user: req.session.user,
    title: 'Quote Requests',
    quotes, staff, total,
    page: parseInt(page), perPage,
    filters: { status, priority, assigned, search },
  });
});

router.get('/quotes/:id', (req, res) => {
  const db = req.app.locals.db;
  const quote = db.prepare(`
    SELECT q.*, c.name AS customer_name, c.email AS customer_email,
           c.phone AS customer_phone, c.company AS customer_company,
           c.address AS customer_address, u.name AS assigned_name
    FROM quotes q
    JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.assigned_to
    WHERE q.id = ?
  `).get(req.params.id);

  if (!quote) return res.redirect('/admin/quotes');

  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quote.id);
  const activity = db.prepare(`
    SELECT * FROM quote_activity WHERE quote_id = ? ORDER BY created_at DESC
  `).all(quote.id);
  const staff = db.prepare("SELECT id, name FROM users WHERE active = 1").all();

  res.render('admin/quote-detail', {
    user: req.session.user,
    title: `Quote ${quote.reference}`,
    quote, items, activity, staff,
  });
});

// Update quote status
router.post('/quotes/:id/status', (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.body;
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.redirect('/admin/quotes');

  const oldStatus = quote.status;
  db.prepare('UPDATE quotes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, quote.id);

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description, old_value, new_value)
    VALUES (?, ?, ?, 'status_change', ?, ?, ?)
  `).run(quote.id, req.session.user.id, req.session.user.name,
    `Status changed from "${oldStatus}" to "${status}"`, oldStatus, status);

  res.redirect(`/admin/quotes/${quote.id}`);
});

// Assign quote
router.post('/quotes/:id/assign', (req, res) => {
  const db = req.app.locals.db;
  const { assigned_to } = req.body;
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.redirect('/admin/quotes');

  db.prepare('UPDATE quotes SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(assigned_to || null, quote.id);

  const assignedUser = assigned_to
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(assigned_to)
    : null;

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description, new_value)
    VALUES (?, ?, ?, 'assignment', ?, ?)
  `).run(quote.id, req.session.user.id, req.session.user.name,
    `Assigned to ${assignedUser ? assignedUser.name : 'Unassigned'}`,
    assignedUser ? assignedUser.name : 'Unassigned');

  res.redirect(`/admin/quotes/${quote.id}`);
});

// Set priority
router.post('/quotes/:id/priority', (req, res) => {
  const db = req.app.locals.db;
  const { priority } = req.body;
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.redirect('/admin/quotes');

  const oldPriority = quote.priority;
  db.prepare('UPDATE quotes SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(priority, quote.id);

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description, old_value, new_value)
    VALUES (?, ?, ?, 'priority_change', ?, ?, ?)
  `).run(quote.id, req.session.user.id, req.session.user.name,
    `Priority changed from "${oldPriority}" to "${priority}"`, oldPriority, priority);

  res.redirect(`/admin/quotes/${quote.id}`);
});

// Add internal note
router.post('/quotes/:id/notes', (req, res) => {
  const db = req.app.locals.db;
  const { note } = req.body;
  if (!note || !note.trim()) return res.redirect(`/admin/quotes/${req.params.id}`);

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description)
    VALUES (?, ?, ?, 'note', ?)
  `).run(req.params.id, req.session.user.id, req.session.user.name, note.trim());

  db.prepare('UPDATE quotes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

  res.redirect(`/admin/quotes/${req.params.id}`);
});

// Send email to customer
router.post('/quotes/:id/email', async (req, res) => {
  const db = req.app.locals.db;
  const { subject, body } = req.body;
  const quote = db.prepare(`
    SELECT q.*, c.email AS customer_email, c.name AS customer_name
    FROM quotes q JOIN customers c ON c.id = q.customer_id WHERE q.id = ?
  `).get(req.params.id);

  if (!quote) return res.redirect('/admin/quotes');

  // Log the email attempt
  const emailLog = db.prepare(`
    INSERT INTO email_log (quote_id, recipient, subject, body, status) VALUES (?, ?, ?, ?, ?)
  `);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@treegrows.co.za',
        to: quote.customer_email,
        subject: subject || `Tree Grows — Quote ${quote.reference}`,
        text: body,
        html: `<p>Dear ${quote.customer_name},</p><p>${body.replace(/\n/g, '<br>')}</p><p>Kind regards,<br>Tree Grows Ltd</p>`,
      });
      emailLog.run(quote.id, quote.customer_email, subject, body, 'sent');
    } catch (err) {
      emailLog.run(quote.id, quote.customer_email, subject, body, 'failed');
    }
  } else {
    emailLog.run(quote.id, quote.customer_email, subject, body, 'pending');
  }

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description)
    VALUES (?, ?, ?, 'email_sent', ?)
  `).run(quote.id, req.session.user.id, req.session.user.name,
    `Email sent to ${quote.customer_email}: "${subject}"`);

  res.redirect(`/admin/quotes/${quote.id}`);
});

// Update estimated total
router.post('/quotes/:id/price', (req, res) => {
  const db = req.app.locals.db;
  const { total_estimated } = req.body;

  db.prepare('UPDATE quotes SET total_estimated = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(parseFloat(total_estimated) || 0, req.params.id);

  db.prepare(`
    INSERT INTO quote_activity (quote_id, user_id, user_name, action_type, description, new_value)
    VALUES (?, ?, ?, 'price_updated', ?, ?)
  `).run(req.params.id, req.session.user.id, req.session.user.name,
    `Estimated total updated to R${parseFloat(total_estimated).toFixed(2)}`,
    total_estimated);

  res.redirect(`/admin/quotes/${req.params.id}`);
});

// ════════════════════════════════════════
//  CUSTOMERS
// ════════════════════════════════════════
router.get('/customers', (req, res) => {
  const db = req.app.locals.db;
  const { search } = req.query;

  let sql = `
    SELECT c.*, COUNT(q.id) AS quote_count,
           MAX(q.created_at) AS last_quote_date
    FROM customers c
    LEFT JOIN quotes q ON q.customer_id = c.id
  `;
  const params = [];
  if (search) {
    sql += ' WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  sql += ' GROUP BY c.id ORDER BY c.created_at DESC';

  const customers = db.prepare(sql).all(...params);

  res.render('admin/customers', {
    user: req.session.user,
    title: 'Customers',
    customers,
    search: search || '',
  });
});

router.get('/customers/:id', (req, res) => {
  const db = req.app.locals.db;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.redirect('/admin/customers');

  const quotes = db.prepare(`
    SELECT q.*, u.name AS assigned_name
    FROM quotes q LEFT JOIN users u ON u.id = q.assigned_to
    WHERE q.customer_id = ? ORDER BY q.created_at DESC
  `).all(customer.id);

  res.render('admin/customer-detail', {
    user: req.session.user,
    title: customer.name,
    customer, quotes,
  });
});

// ════════════════════════════════════════
//  PRODUCTS (Admin CRUD)
// ════════════════════════════════════════
router.get('/products', (req, res) => {
  const db = req.app.locals.db;
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    ORDER BY c.sort_order, p.name
  `).all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();

  res.render('admin/products', {
    user: req.session.user,
    title: 'Products',
    products, categories,
  });
});

router.get('/products/new', requireRole('admin', 'manager'), (req, res) => {
  const db = req.app.locals.db;
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/product-form', {
    user: req.session.user,
    title: 'New Product',
    product: null, categories,
  });
});

router.post('/products', requireRole('admin', 'manager'), (req, res) => {
  const db = req.app.locals.db;
  const { name, category_id, slug, short_description, description, min_quantity,
    branding_methods, colours, sizes, price_from, featured } = req.body;

  const productSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  db.prepare(`
    INSERT INTO products (category_id, name, slug, short_description, description,
      min_quantity, branding_methods, colours, sizes, price_from, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category_id, name, productSlug, short_description || '', description || '',
    parseInt(min_quantity) || 1,
    JSON.stringify((branding_methods || '').split(',').map(s => s.trim()).filter(Boolean)),
    JSON.stringify((colours || '').split(',').map(s => s.trim()).filter(Boolean)),
    JSON.stringify((sizes || '').split(',').map(s => s.trim()).filter(Boolean)),
    parseFloat(price_from) || 0,
    featured ? 1 : 0
  );

  res.redirect('/admin/products');
});

router.get('/products/:id/edit', requireRole('admin', 'manager'), (req, res) => {
  const db = req.app.locals.db;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/products');

  product.branding_methods = JSON.parse(product.branding_methods || '[]');
  product.colours = JSON.parse(product.colours || '[]');
  product.sizes = JSON.parse(product.sizes || '[]');

  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/product-form', {
    user: req.session.user,
    title: `Edit: ${product.name}`,
    product, categories,
  });
});

router.post('/products/:id', requireRole('admin', 'manager'), (req, res) => {
  const db = req.app.locals.db;
  const { name, category_id, slug, short_description, description, min_quantity,
    branding_methods, colours, sizes, price_from, featured, active } = req.body;

  db.prepare(`
    UPDATE products SET category_id=?, name=?, slug=?, short_description=?, description=?,
      min_quantity=?, branding_methods=?, colours=?, sizes=?, price_from=?, featured=?, active=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    category_id, name, slug,
    short_description || '', description || '',
    parseInt(min_quantity) || 1,
    JSON.stringify((branding_methods || '').split(',').map(s => s.trim()).filter(Boolean)),
    JSON.stringify((colours || '').split(',').map(s => s.trim()).filter(Boolean)),
    JSON.stringify((sizes || '').split(',').map(s => s.trim()).filter(Boolean)),
    parseFloat(price_from) || 0,
    featured ? 1 : 0,
    active !== undefined ? (active ? 1 : 0) : 1,
    req.params.id
  );

  res.redirect('/admin/products');
});

// ════════════════════════════════════════
//  STAFF MANAGEMENT (admin only)
// ════════════════════════════════════════
router.get('/staff', requireRole('admin'), (req, res) => {
  const db = req.app.locals.db;
  const staff = db.prepare('SELECT id, username, name, email, role, active, last_login, created_at FROM users ORDER BY role, name').all();
  res.render('admin/staff', {
    user: req.session.user,
    title: 'Staff Management',
    staff,
  });
});

router.post('/staff', requireRole('admin'), (req, res) => {
  const db = req.app.locals.db;
  const { username, password, name, email, role } = req.body;

  if (!username || !password || !name) {
    return res.redirect('/admin/staff?error=All+fields+required');
  }

  const hash = bcrypt.hashSync(password, 12);
  try {
    db.prepare('INSERT INTO users (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)')
      .run(username, hash, name, email || null, role || 'staff');
  } catch (e) {
    return res.redirect('/admin/staff?error=Username+already+exists');
  }
  res.redirect('/admin/staff');
});

router.post('/staff/:id/toggle', requireRole('admin'), (req, res) => {
  const db = req.app.locals.db;
  const user = db.prepare('SELECT active FROM users WHERE id = ?').get(req.params.id);
  if (user) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(user.active ? 0 : 1, req.params.id);
  }
  res.redirect('/admin/staff');
});

router.post('/staff/:id/password', requireRole('admin'), (req, res) => {
  const db = req.app.locals.db;
  const { password } = req.body;
  if (password && password.length >= 6) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  }
  res.redirect('/admin/staff');
});

module.exports = router;
