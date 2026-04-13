const express = require('express');
const fs = require('fs');
const { serializeForScript } = require('../lib/safe-json');
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

  let products;
  try {
    ({ products } = loadProducts());
  } catch (e) {
    return next();
  }

  const product = products.find(p => p.model === model);
  if (!product) return next();

  res.render('product', {
    product,
    productJson: serializeForScript(product)
  });
});

module.exports = router;
