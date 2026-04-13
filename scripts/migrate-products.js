#!/usr/bin/env node

const path = require('path');
const { migrateProductsFile } = require('../lib/product-schema');
const { PRODUCTS_FILE } = require('../lib/runtime-paths');

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : PRODUCTS_FILE;

try {
  const result = migrateProductsFile(target);
  if (result.changed) {
    console.log(`[migrate] normalized products file: ${target}`);
  } else {
    console.log(`[migrate] products file already normalized: ${target}`);
  }
} catch (error) {
  console.error(`[migrate] failed for ${target}: ${error.message}`);
  process.exit(1);
}
