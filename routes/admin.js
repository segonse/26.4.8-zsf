const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const {
  PRODUCTS_FILE,
  IMAGES_DIR,
  CERTIFICATES_DIR
} = require('../lib/runtime-paths');
const { normalizeProductsData } = require('../lib/product-schema');
const router = express.Router();

const DATA_FILE = PRODUCTS_FILE;
const DATA_FILE_BACKUP = `${DATA_FILE}.bak`;
const DATA_FILE_TEMP = `${DATA_FILE}.tmp`;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PDF_MIME_TYPES = new Set(['application/pdf', 'application/octet-stream']);

function isProductImageField(fieldname) {
  return fieldname === 'productImage';
}

function isCertFileField(fieldname) {
  return /^certFiles\[\d+\]$/.test(fieldname);
}

function isCertThumbField(fieldname) {
  return /^certThumbs\[\d+\]$/.test(fieldname);
}

function findUploadedFile(files, fieldname) {
  if (!Array.isArray(files)) return null;
  return files.find(file => file.fieldname === fieldname) || null;
}

// ── 文件上传配置 ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (isProductImageField(file.fieldname) || isCertThumbField(file.fieldname)) {
      cb(null, IMAGES_DIR);
    } else {
      cb(null, CERTIFICATES_DIR);
    }
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
    const isImageField = isProductImageField(file.fieldname) || isCertThumbField(file.fieldname);
    const isPdfField = isCertFileField(file.fieldname);

    if (isImageField && IMAGE_MIME_TYPES.has(file.mimetype) && IMAGE_EXTENSIONS.has(ext)) {
      return cb(null, true);
    }

    if (isPdfField && PDF_MIME_TYPES.has(file.mimetype) && ext === '.pdf') {
      return cb(null, true);
    }

    return cb(new Error('Only PDF files and JPG/PNG/WEBP images are allowed'));
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
    return 'Upload failed';
  }
  return err.message || 'Upload failed';
}

function readBodyField(body, key) {
  return body[key] || '';
}

function readCertField(body, index, key) {
  const nested = body.certs;
  if (Array.isArray(nested) && nested[index] && nested[index][key] !== undefined) {
    return nested[index][key] || '';
  }
  if (nested && typeof nested === 'object') {
    const row = nested[index] || nested[String(index)];
    if (row && row[key] !== undefined) {
      return row[key] || '';
    }
  }
  return body[`certs[${index}][${key}]`] || '';
}

// ── 从 req.body 构建产品对象 ──────────────────────────────────
function buildProduct(body, files, existing) {
  const nestedCerts = body.certs;
  const nestedCertCount = Array.isArray(nestedCerts)
    ? nestedCerts.length
    : nestedCerts && typeof nestedCerts === 'object'
      ? Object.keys(nestedCerts).length
      : 0;
  const certCount = Math.max(parseInt(body.certCount || '0', 10), nestedCertCount);
  const certificates = new Array(certCount);
  for (let i = 0; i < certCount; i++) {
    certificates[i] = {
      nameEn: readCertField(body, i, 'nameEn').trim(),
      date: readCertField(body, i, 'date').trim(),
      file: readCertField(body, i, 'file').trim(),
      thumb: readCertField(body, i, 'thumb').trim()
    };
  }

  const uploadedFiles = Array.isArray(files)
    ? files
    : files
      ? Object.values(files).flat()
      : [];

  const productImageFile = findUploadedFile(uploadedFiles, 'productImage');
  if (productImageFile) {
    body.image = 'images/' + productImageFile.filename;
  }

  for (let i = 0; i < certCount; i++) {
    const certFile = findUploadedFile(uploadedFiles, `certFiles[${i}]`);
    if (certFile && certificates[i]) {
      certificates[i].file = 'certificates/' + certFile.filename;
    }

    const certThumb = findUploadedFile(uploadedFiles, `certThumbs[${i}]`);
    if (certThumb && certificates[i]) {
      certificates[i].thumb = 'images/' + certThumb.filename;
    }
  }

  return {
    model:      readBodyField(body, 'model') || (existing && existing.model) || '',
    nameEn:     readBodyField(body, 'nameEn'),
    companyEn:  readBodyField(body, 'companyEn'),
    addressEn:  readBodyField(body, 'addressEn'),
    image:      readBodyField(body, 'image') || (existing && existing.image) || '',
    params: {
      battery:        readBodyField(body, 'params.battery'),
      power:          readBodyField(body, 'params.power'),
      speed:          readBodyField(body, 'params.speed'),
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
    certificates: certificates.filter(cert =>
      cert.nameEn || cert.date || cert.file || cert.thumb)
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

const uploadFields = upload.any();

// POST /admin/products → 新增产品
router.post('/products', uploadFields, (req, res) => {
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
  const product = buildProduct(req.body, req.files, null);
  data.products.push(product);
  writeData(data);
  res.redirect('/admin');
});

// POST /admin/products/:model/update → 更新产品
router.post('/products/:model/update', uploadFields, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex(p => p.model === req.params.model);
  if (idx === -1) return res.redirect('/admin');
  const updated = buildProduct(req.body, req.files, data.products[idx]);
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

router.post('/api/products', uploadFields, (req, res) => {
  const data = readData();
  const product = buildProduct(req.body, req.files, null);
  if (data.products.find(p => p.model === product.model)) {
    return res.status(409).json({ error: 'Product model already exists' });
  }
  data.products.push(product);
  writeData(data);
  res.status(201).json(product);
});

router.put('/api/products/:model', uploadFields, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex(p => p.model === req.params.model);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  const updated = buildProduct(req.body, req.files, data.products[idx]);
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
