const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// ── Login Page ──
router.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/admin');
  res.render('admin/login', { error: null, title: 'Admin Login' });
});

// ── Login Submit ──
router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('admin/login', { error: 'Please enter username and password.', title: 'Admin Login' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('admin/login', { error: 'Invalid username or password.', title: 'Admin Login' });
  }

  // Update last login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  req.session.user = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  res.redirect('/admin');
});

// ── Logout ──
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

module.exports = router;
