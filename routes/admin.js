const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const {
  PRODUCTS_FILE,
  IMAGES_DIR
} = require('../lib/runtime-paths');
const { normalizeProductsData } = require('../lib/product-schema');
const router = express.Router();

const DATA_FILE = PRODUCTS_FILE;
const DATA_FILE_BACKUP = `${DATA_FILE}.bak`;
const DATA_FILE_TEMP = `${DATA_FILE}.tmp`;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// ── 文件上传配置 ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, IMAGES_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext.toLowerCase()}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'productImage' && IMAGE_MIME_TYPES.has(file.mimetype) && IMAGE_EXTENSIONS.has(ext)) {
      return cb(null, true);
    }

    return cb(new Error('Only JPG/PNG/WEBP product images are allowed'));
  }
});

// ── 数据读写工具 ──────────────────────────────────────────────
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { products: [] };
  try {
    return normalizeProductsData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    console.error('[data] Failed to parse products.json:', error.message);
    if (fs.existsSync(DATA_FILE_BACKUP)) {
      try {
        console.warn('[data] Falling back to backup file:', DATA_FILE_BACKUP);
        return normalizeProductsData(JSON.parse(fs.readFileSync(DATA_FILE_BACKUP, 'utf8')));
      } catch (backupError) {
        console.error('[data] Failed to parse backup products file:', backupError.message);
      }
    }
    return { products: [] };
  }
}
function writeData(data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(DATA_FILE_TEMP, json, 'utf8');
  fs.renameSync(DATA_FILE_TEMP, DATA_FILE);
  fs.writeFileSync(DATA_FILE_BACKUP, json, 'utf8');
}

function buildUploadErrorMessage(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return 'Each uploaded file must be 10MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return 'Certificate uploads are temporarily disabled';
    }
    return 'Upload failed';
  }
  return err.message || 'Upload failed';
}

function readBodyField(body, key) {
  return body[key] || '';
}

// ── 从 req.body 构建产品对象 ──────────────────────────────────
function buildProduct(body, file, existing) {
  const existingCertificates = existing && Array.isArray(existing.certificates)
    ? existing.certificates.map((cert) => ({ ...cert }))
    : [];
  const nextImage = file
    ? `images/${file.filename}`
    : readBodyField(body, 'image') || (existing && existing.image) || '';

  return {
    model:      readBodyField(body, 'model') || (existing && existing.model) || '',
    nameEn:     readBodyField(body, 'nameEn'),
    companyEn:  readBodyField(body, 'companyEn'),
    addressEn:  readBodyField(body, 'addressEn'),
    image:      nextImage,
    params: {
      battery:        readBodyField(body, 'params.battery'),
      power:          readBodyField(body, 'params.power'),
      speed:          readBodyField(body, 'params.speed'),
      materialEn:     readBodyField(body, 'params.materialEn'),
      bladeEn:        readBodyField(body, 'params.bladeEn'),
      port:           readBodyField(body, 'params.port'),
      chargingTime:   readBodyField(body, 'params.chargingTime'),
      usageTime:      readBodyField(body, 'params.usageTime'),
      productionDate: readBodyField(body, 'params.productionDate'),
      weight:         readBodyField(body, 'params.weight')
    },
    pkg: {
      size:    readBodyField(body, 'pkg.size'),
      qtyEn:   readBodyField(body, 'pkg.qtyEn'),
      carton:  readBodyField(body, 'pkg.carton')
    },
    patent: {
      no:         readBodyField(body, 'patent.no'),
      pubNo:      readBodyField(body, 'patent.pubNo'),
      certNoEn:   readBodyField(body, 'patent.certNoEn'),
      nameEn:     readBodyField(body, 'patent.nameEn'),
      ownerEn:    readBodyField(body, 'patent.ownerEn'),
      designerEn: readBodyField(body, 'patent.designerEn'),
      applyDate:  readBodyField(body, 'patent.applyDate'),
      pubDate:    readBodyField(body, 'patent.pubDate'),
      issuerEn:   readBodyField(body, 'patent.issuerEn'),
      evalDate:   readBodyField(body, 'patent.evalDate')
    },
    certificates: existingCertificates
  };
}

// ── 页面路由 ──────────────────────────────────────────────────

// GET /admin → 产品列表
router.get('/', (req, res) => {
  const { products } = readData();
  res.render('admin/index', { products });
});

// GET /admin/new → 新增产品表单
router.get('/new', (req, res) => {
  res.render('admin/form', { product: null, action: '/admin/products', error: null });
});

// GET /admin/:model/edit → 编辑产品表单
router.get('/:model/edit', (req, res) => {
  const { products } = readData();
  const product = products.find(p => p.model === req.params.model);
  if (!product) return res.redirect('/admin');
  res.render('admin/form', {
    product,
    action: `/admin/products/${product.model}/update`,
    error: null
  });
});

// ── 表单提交路由 ───────────────────────────────────────────────

const uploadProductImage = upload.single('productImage');

// POST /admin/products → 新增产品
router.post('/products', uploadProductImage, (req, res) => {
  const data = readData();
  const model = (req.body.model || '').trim();
  if (!model) {
    return res.render('admin/form', {
      product: null,
      action: '/admin/products',
      error: 'Product model is required'
    });
  }
  if (data.products.find(p => p.model === model)) {
    return res.render('admin/form', {
      product: null,
      action: '/admin/products',
      error: `Product model ${model} already exists`
    });
  }
  const product = buildProduct(req.body, req.file, null);
  data.products.push(product);
  writeData(data);
  res.redirect('/admin');
});

// POST /admin/products/:model/update → 更新产品
router.post('/products/:model/update', uploadProductImage, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex(p => p.model === req.params.model);
  if (idx === -1) return res.redirect('/admin');
  const updated = buildProduct(req.body, req.file, data.products[idx]);
  updated.model = data.products[idx].model; // model 不可修改
  data.products[idx] = updated;
  writeData(data);
  res.redirect('/admin');
});

// POST /admin/products/:model/delete → 删除产品
router.post('/products/:model/delete', (req, res) => {
  const data = readData();
  data.products = data.products.filter(p => p.model !== req.params.model);
  writeData(data);
  res.redirect('/admin');
});

// ── JSON API ──────────────────────────────────────────────────

router.get('/api/products', (req, res) => {
  res.json(readData());
});

router.post('/api/products', uploadProductImage, (req, res) => {
  const data = readData();
  const product = buildProduct(req.body, req.file, null);
  if (data.products.find(p => p.model === product.model)) {
    return res.status(409).json({ error: 'Product model already exists' });
  }
  data.products.push(product);
  writeData(data);
  res.status(201).json(product);
});

router.put('/api/products/:model', uploadProductImage, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex(p => p.model === req.params.model);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  const updated = buildProduct(req.body, req.file, data.products[idx]);
  updated.model = data.products[idx].model;
  data.products[idx] = updated;
  writeData(data);
  res.json(updated);
});

router.delete('/api/products/:model', (req, res) => {
  const data = readData();
  const before = data.products.length;
  data.products = data.products.filter(p => p.model !== req.params.model);
  if (data.products.length === before) return res.status(404).json({ error: 'Product not found' });
  writeData(data);
  res.json({ ok: true });
});

router.use((err, req, res, next) => {
  if (!err) return next();

  const error = buildUploadErrorMessage(err);
  if (req.originalUrl.startsWith('/admin/api/')) {
    return res.status(400).json({ error });
  }

  let product = null;
  let action = '/admin/products';
  if (req.params.model) {
    const { products } = readData();
    const existing = products.find(p => p.model === req.params.model) || null;
    action = `/admin/products/${req.params.model}/update`;
    if (req.body && Object.keys(req.body).length > 0) {
      product = buildProduct(req.body, null, existing);
      if (existing) product.model = existing.model;
    } else {
      product = existing;
    }
  } else if (req.body && Object.keys(req.body).length > 0) {
    product = buildProduct(req.body, null, null);
  }

  return res.status(400).render('admin/form', { product, action, error });
});

module.exports = router;
