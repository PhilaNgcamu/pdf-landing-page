const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { createDatabase } = require('./setup');

const db = createDatabase();

console.log('🌱 Seeding Tree Grows database...\n');

// ── Categories ──
const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
);

const categories = [
  ['Printing', 'printing', 'Business cards, flyers, banners, posters, brochures, and large-format printing.', '🖨️', 1],
  ['Branded Apparel', 'branded-apparel', 'Custom-branded T-shirts, golf shirts, jackets, caps, and workwear.', '👕', 2],
  ['Promotional Gifts', 'promotional-gifts', 'Branded pens, mugs, USB drives, notebooks, bags, and premium gift sets.', '🎁', 3],
  ['Graduation Gowns', 'graduation-gowns', 'High-quality graduation gowns for purchase or rental, with caps and accessories.', '🎓', 4],
  ['Signage & Displays', 'signage-displays', 'Pull-up banners, wall graphics, vehicle wraps, and exhibition displays.', '🏷️', 5],
  ['Packaging', 'packaging', 'Custom branded packaging, labels, stickers, and presentation boxes.', '📦', 6],
];

const insertCategoriesTx = db.transaction(() => {
  for (const cat of categories) insertCategory.run(...cat);
});
insertCategoriesTx();
console.log(`✅ ${categories.length} categories seeded`);

// ── Products ──
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products
    (category_id, name, slug, short_description, description, min_quantity,
     branding_methods, colours, sizes, price_from, featured)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getCatId = db.prepare('SELECT id FROM categories WHERE slug = ?');

function catId(slug) { return getCatId.get(slug).id; }

const products = [
  // Printing
  [catId('printing'), 'Business Cards', 'business-cards',
    'Professional business cards in various finishes.',
    'High-quality business cards printed on premium card stock. Available in matte, gloss, soft-touch, and spot UV finishes. Single or double-sided with full-colour printing.',
    100, '["Digital Print","Litho Print"]', '["White","Cream","Kraft"]', '["90x50mm","85x55mm"]', 1.50, 1],
  [catId('printing'), 'Flyers & Leaflets', 'flyers-leaflets',
    'Full-colour flyers in A4, A5, and DL sizes.',
    'Vibrant full-colour flyers perfect for promotions, events, and marketing campaigns. Printed on quality paper stock with options for matte or gloss finish.',
    100, '["Digital Print","Litho Print"]', '[]', '["A4","A5","DL"]', 0.85, 0],
  [catId('printing'), 'Posters', 'posters',
    'Large-format posters for indoor and outdoor use.',
    'Eye-catching posters in sizes from A3 to A0. Printed on high-quality paper or synthetic material for durability. Perfect for advertising, events, and décor.',
    1, '["Digital Print","Large Format"]', '[]', '["A3","A2","A1","A0"]', 35.00, 0],
  [catId('printing'), 'Brochures & Booklets', 'brochures-booklets',
    'Multi-page brochures and saddle-stitched booklets.',
    'Professional brochures and booklets with fold options including bi-fold, tri-fold, and saddle-stitched. Full-colour on quality paper stock.',
    50, '["Digital Print","Litho Print"]', '[]', '["A4","A5","DL"]', 4.50, 0],
  [catId('printing'), 'Banners', 'banners',
    'PVC and fabric banners with eyelets or pole pockets.',
    'Durable indoor and outdoor banners printed in full colour. Available in PVC or fabric with finishing options including eyelets, pole pockets, and hemming.',
    1, '["Large Format","Dye Sublimation"]', '[]', '["1m x 0.5m","2m x 1m","3m x 1m","Custom"]', 120.00, 1],

  // Branded Apparel
  [catId('branded-apparel'), 'T-Shirts', 't-shirts',
    'Cotton T-shirts with custom branding.',
    'Quality cotton and poly-cotton T-shirts available in a wide range of colours. Branded with your logo using screen printing, embroidery, or digital transfer.',
    10, '["Screen Print","Embroidery","Digital Transfer","DTG Print"]',
    '["White","Black","Navy","Red","Grey","Royal Blue","Green","Yellow","Orange","Pink"]',
    '["XS","S","M","L","XL","2XL","3XL"]', 45.00, 1],
  [catId('branded-apparel'), 'Golf Shirts', 'golf-shirts',
    'Piqué golf shirts with embroidered logos.',
    'Classic piqué knit golf shirts ideal for corporate wear. Comfortable and smart with ribbed collar and cuffs. Perfect for embroidered company logos.',
    10, '["Embroidery","Screen Print","Digital Transfer"]',
    '["White","Black","Navy","Red","Grey","Royal Blue","Khaki","Stone"]',
    '["S","M","L","XL","2XL","3XL"]', 85.00, 1],
  [catId('branded-apparel'), 'Jackets & Hoodies', 'jackets-hoodies',
    'Branded jackets, hoodies, and fleece tops.',
    'Keep your team warm and on-brand with custom jackets, zip-up hoodies, and fleece tops. Multiple fabric options with embroidery or print branding.',
    5, '["Embroidery","Screen Print","Digital Transfer"]',
    '["Black","Navy","Grey","Charcoal","Royal Blue"]',
    '["S","M","L","XL","2XL","3XL"]', 180.00, 0],
  [catId('branded-apparel'), 'Caps & Beanies', 'caps-beanies',
    'Branded caps, beanies, and bucket hats.',
    'Promotional and corporate headwear including baseball caps, 5-panel caps, truckers, beanies, and bucket hats. Embroidered or printed with your logo.',
    20, '["Embroidery","Screen Print","Patch"]',
    '["White","Black","Navy","Red","Grey","Khaki","Camo"]',
    '["One Size","S/M","L/XL"]', 35.00, 0],
  [catId('branded-apparel'), 'Workwear', 'workwear',
    'Durable branded workwear and safety clothing.',
    'Industrial-grade workwear including overalls, dust coats, reflective vests, and chef jackets. Branded with embroidery or printed logos for professional identification.',
    5, '["Embroidery","Screen Print","Reflective Print"]',
    '["Navy","Royal Blue","Orange","White","Khaki"]',
    '["S","M","L","XL","2XL","3XL"]', 150.00, 0],

  // Promotional Gifts
  [catId('promotional-gifts'), 'Branded Pens', 'branded-pens',
    'Logo-printed pens in various styles.',
    'Quality branded pens including ballpoints, roller balls, and executive pens. Available in plastic, metal, and eco-friendly materials. Printed or engraved with your logo.',
    50, '["Pad Print","Laser Engraving","Digital Print"]',
    '["Black","Blue","White","Red","Silver","Gold"]',
    '[]', 5.50, 0],
  [catId('promotional-gifts'), 'Mugs & Drinkware', 'mugs-drinkware',
    'Branded mugs, water bottles, and travel cups.',
    'Ceramic mugs, stainless steel water bottles, travel tumblers, and glass drinkware. Full-colour print, wrap-around designs, or laser engraving available.',
    20, '["Full Colour Print","Laser Engraving","Pad Print"]',
    '["White","Black","Silver","Blue","Red","Green"]',
    '["250ml","330ml","500ml","750ml"]', 25.00, 1],
  [catId('promotional-gifts'), 'USB Drives', 'usb-drives',
    'Custom branded USB flash drives.',
    'Portable USB flash drives in classic, card, and novelty shapes. Branded with your logo and optionally pre-loaded with company documents or presentations.',
    25, '["Pad Print","Laser Engraving","Full Colour Print"]',
    '["Black","White","Silver","Red","Blue"]',
    '["8GB","16GB","32GB","64GB"]', 45.00, 0],
  [catId('promotional-gifts'), 'Notebooks & Journals', 'notebooks-journals',
    'Branded notebooks and executive journals.',
    'A5 and A4 notebooks with soft-touch or hardcover binding. Custom cover printing, debossing, or foiling with elastic closures and ribbon bookmarks.',
    20, '["Debossing","Screen Print","Foiling","Full Colour Print"]',
    '["Black","Navy","Brown","Red","Green","Grey"]',
    '["A5","A4"]', 38.00, 0],
  [catId('promotional-gifts'), 'Gift Sets', 'gift-sets',
    'Curated branded gift sets and hampers.',
    'Premium gift sets combining selected branded items in custom presentation boxes. Perfect for client appreciation, employee rewards, and corporate events.',
    10, '["Multiple Methods"]',
    '[]', '["Standard","Premium","Executive"]', 120.00, 1],

  // Graduation Gowns
  [catId('graduation-gowns'), 'Standard Graduation Gown — Purchase', 'grad-gown-standard-purchase',
    'Classic graduation gown for purchase.',
    'Traditional matte-finish graduation gown in black. Made from durable polyester fabric. Includes gown only — cap and sash sold separately. Ideal for institutions or individuals.',
    1, '[]',
    '["Black"]',
    '["XS (150-160cm)","S (160-170cm)","M (170-175cm)","L (175-180cm)","XL (180-188cm)","2XL (188cm+)"]', 350.00, 1],
  [catId('graduation-gowns'), 'Premium Graduation Gown — Purchase', 'grad-gown-premium-purchase',
    'Premium quality graduation gown for purchase.',
    'Premium graduation gown with satin-finish panels. Superior fabric weight and tailored fit. Includes gown, mortarboard cap, and tassel. Available in black and navy.',
    1, '[]',
    '["Black","Navy"]',
    '["XS (150-160cm)","S (160-170cm)","M (170-175cm)","L (175-180cm)","XL (180-188cm)","2XL (188cm+)"]', 550.00, 0],
  [catId('graduation-gowns'), 'Graduation Gown — Rental', 'grad-gown-rental',
    'Graduation gown rental package.',
    'Full graduation gown rental package including gown, cap, and tassel. Professionally cleaned and pressed for each event. Rental period covers the ceremony day plus one extra day. Bulk discounts available for institutions.',
    1, '[]',
    '["Black"]',
    '["XS (150-160cm)","S (160-170cm)","M (170-175cm)","L (175-180cm)","XL (180-188cm)","2XL (188cm+)"]', 150.00, 1],
  [catId('graduation-gowns'), 'Graduation Accessories', 'grad-accessories',
    'Caps, sashes, honour cords, and stoles.',
    'Complete your graduation look with mortarboard caps, colour sashes, honour cords, and faculty stoles. Available in a range of institutional colours.',
    1, '[]',
    '["Black","Navy","Maroon","Royal Blue","Gold","White","Red","Green"]',
    '["One Size"]', 45.00, 0],

  // Signage & Displays
  [catId('signage-displays'), 'Pull-Up Banners', 'pull-up-banners',
    'Retractable pull-up display banners.',
    'Professional retractable pull-up banners with aluminium cassette and carry bag. Full-colour print on premium banner material. Quick setup for events and exhibitions.',
    1, '["Large Format"]', '[]', '["850x2000mm","1000x2000mm","1200x2000mm"]', 450.00, 1],
  [catId('signage-displays'), 'Wall Graphics & Decals', 'wall-graphics',
    'Custom wall wraps, murals, and vinyl decals.',
    'Transform your space with custom-printed wall graphics. Suitable for offices, shops, and events. Easy to apply and remove. Available in vinyl, fabric, and wallpaper materials.',
    1, '["Large Format","Vinyl Cut"]', '[]', '["Custom Size"]', 200.00, 0],
  [catId('signage-displays'), 'Vehicle Wraps', 'vehicle-wraps',
    'Full and partial vehicle branding wraps.',
    'High-impact vehicle branding using premium cast vinyl. Partial branding (doors, bonnet) or full wraps available. Includes professional design, print, and installation.',
    1, '["Vehicle Wrap"]', '[]', '["Partial Wrap","Half Wrap","Full Wrap"]', 2500.00, 0],

  // Packaging
  [catId('packaging'), 'Custom Boxes', 'custom-boxes',
    'Branded presentation and product boxes.',
    'Custom-printed boxes for product packaging, gifts, and retail. Available in corrugated, rigid, and folding carton options. Full-colour printing with custom die-cut shapes.',
    50, '["Digital Print","Litho Print","Foiling"]', '[]', '["Small","Medium","Large","Custom"]', 12.00, 0],
  [catId('packaging'), 'Labels & Stickers', 'labels-stickers',
    'Custom printed labels and stickers.',
    'Self-adhesive labels and stickers for products, packaging, and promotions. Die-cut or roll format. Available in paper, vinyl, and clear materials.',
    100, '["Digital Print"]',
    '["White","Clear","Kraft"]',
    '["30x30mm","50x50mm","80x40mm","100x100mm","Custom"]', 1.20, 0],
  [catId('packaging'), 'Gift Bags', 'gift-bags',
    'Branded gift bags and tissue paper.',
    'Luxury gift bags in paper or fabric with ribbon handles. Custom-printed or branded with stickers and tissue paper. Perfect for events and corporate gifting.',
    25, '["Screen Print","Digital Print","Foiling"]',
    '["White","Black","Kraft","Navy","Red"]',
    '["Small","Medium","Large"]', 15.00, 0],
];

const insertProductsTx = db.transaction(() => {
  for (const prod of products) insertProduct.run(...prod);
});
insertProductsTx();
console.log(`✅ ${products.length} products seeded`);

// ── Admin User ──
const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)'
);

const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'TreeGrows2026!', 12);
insertUser.run('admin', adminHash, 'Administrator', 'admin@treegrows.co.za', 'admin');

const staffHash = bcrypt.hashSync('Staff2026!', 12);
insertUser.run('staff1', staffHash, 'Sipho Ndlovu', 'sipho@treegrows.co.za', 'staff');
insertUser.run('manager1', staffHash, 'Lindiwe Mthembu', 'lindiwe@treegrows.co.za', 'manager');

console.log('✅ Admin and staff users seeded');
console.log('   Admin login: admin / TreeGrows2026!');
console.log('   Staff login: staff1 / Staff2026!');
console.log('   Manager login: manager1 / Staff2026!\n');

db.close();
console.log('🌳 Database seeding complete!\n');
