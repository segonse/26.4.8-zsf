const express = require('express');
const fs = require('fs');
const { PRODUCTS_FILE } = require('../lib/runtime-paths');
const { normalizeProductsData } = require('../lib/product-schema');
const router = express.Router();

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    return { products: [] };
  }
  return normalizeProductsData(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')));
}

router.get('/:model', (req, res, next) => {
  const raw = req.params.model;
  const model = raw.endsWith('.html') ? raw.slice(0, -5) : raw;
  const lang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : '';

  if (lang !== 'zh' && lang !== 'en') {
    const params = new URLSearchParams(req.query);
    params.set('lang', 'en');
    return res.redirect(302, `/${raw}?${params.toString()}`);
  }

  let products;
  try {
    ({ products } = loadProducts());
  } catch (e) {
    return next();
  }

  const product = products.find(p => p.model === model);
  if (!product) return next();

  res.render('product', { product });
});

module.exports = router;
