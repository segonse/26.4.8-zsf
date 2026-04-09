const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

function loadProducts() {
  const file = path.join(__dirname, '../data/products.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

  res.render('product', { product });
});

module.exports = router;
