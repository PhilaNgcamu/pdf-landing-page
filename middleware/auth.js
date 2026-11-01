// Authentication middleware for admin routes

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.user = req.session.user;
    return next();
  }
  if (req.xhr || req.path.startsWith('/api')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  return res.redirect('/admin/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/admin/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('admin/error', {
        user: req.session.user,
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
      });
    }
    res.locals.user = req.session.user;
    next();
  };
}

module.exports = { requireAuth, requireRole };
