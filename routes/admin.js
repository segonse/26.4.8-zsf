const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '../data/products.json');

// ── 文件上传配置 ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === 'productImage' || file.fieldname === 'certThumbs') {
      cb(null, path.join(__dirname, '../images'));
    } else {
      cb(null, path.join(__dirname, '../certificates'));
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_');
    cb(null, `${base}${ext}`);
  }
});
const upload = multer({ storage });

// ── 数据读写工具 ──────────────────────────────────────────────
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { products: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── 从 req.body 构建产品对象 ──────────────────────────────────
function buildProduct(body, files, existing) {
  const certCount = parseInt(body.certCount || '0', 10);
  const certificates = [];
  for (let i = 0; i < certCount; i++) {
    const nameZh = body[`certs[${i}][nameZh]`] || '';
    const nameEn = body[`certs[${i}][nameEn]`] || '';
    const date   = body[`certs[${i}][date]`] || '';
    const file   = body[`certs[${i}][file]`] || '';
    const thumb  = body[`certs[${i}][thumb]`] || '';
    if (nameZh) {
      certificates.push({ nameZh, nameEn, date, file, thumb });
    }
  }

  if (files && files.productImage && files.productImage[0]) {
    body.image = 'images/' + files.productImage[0].filename;
  }
  if (files && files.certFiles) {
    files.certFiles.forEach((f, i) => {
      if (certificates[i]) certificates[i].file = 'certificates/' + f.filename;
    });
  }
  if (files && files.certThumbs) {
    files.certThumbs.forEach((f, i) => {
      if (certificates[i]) certificates[i].thumb = 'images/' + f.filename;
    });
  }

  return {
    model:      body.model || (existing && existing.model) || '',
    name:       body.name || '',
    nameEn:     body.nameEn || '',
    company:    body.company || '',
    companyEn:  body.companyEn || '',
    address:    body.address || '',
    addressEn:  body.addressEn || '',
    image:      body.image || (existing && existing.image) || '',
    params: {
      battery:        body['params.battery'] || '',
      power:          body['params.power'] || '',
      speed:          body['params.speed'] || '',
      blade:          body['params.blade'] || '',
      bladeEn:        body['params.bladeEn'] || '',
      port:           body['params.port'] || '',
      chargingTime:   body['params.chargingTime'] || '',
      productionDate: body['params.productionDate'] || '',
      weight:         body['params.weight'] || '',
      dimensions:     body['params.dimensions'] || '',
      dimensionsUnit: body['params.dimensionsUnit'] || ''
    },
    pkg: {
      size:    body['pkg.size'] || '',
      qty:     body['pkg.qty'] || '',
      qtyEn:   body['pkg.qtyEn'] || '',
      carton:  body['pkg.carton'] || ''
    },
    patent: {
      no:         body['patent.no'] || '',
      pubNo:      body['patent.pubNo'] || '',
      certNo:     body['patent.certNo'] || '',
      certNoEn:   body['patent.certNoEn'] || '',
      name:       body['patent.name'] || '',
      nameEn:     body['patent.nameEn'] || '',
      owner:      body['patent.owner'] || '',
      designer:   body['patent.designer'] || '',
      applyDate:  body['patent.applyDate'] || '',
      pubDate:    body['patent.pubDate'] || '',
      issuer:     body['patent.issuer'] || '',
      issuerEn:   body['patent.issuerEn'] || '',
      evalDate:   body['patent.evalDate'] || ''
    },
    certificates
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

const uploadFields = upload.fields([
  { name: 'productImage', maxCount: 1 },
  { name: 'certFiles',    maxCount: 10 },
  { name: 'certThumbs',   maxCount: 10 }
]);

// POST /admin/products → 新增产品
router.post('/products', uploadFields, (req, res) => {
  const data = readData();
  const model = (req.body.model || '').trim();
  if (!model) {
    return res.render('admin/form', {
      product: null,
      action: '/admin/products',
      error: '产品型号不能为空'
    });
  }
  if (data.products.find(p => p.model === model)) {
    return res.render('admin/form', {
      product: null,
      action: '/admin/products',
      error: `型号 ${model} 已存在`
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
    return res.status(409).json({ error: '型号已存在' });
  }
  data.products.push(product);
  writeData(data);
  res.status(201).json(product);
});

router.put('/api/products/:model', uploadFields, (req, res) => {
  const data = readData();
  const idx = data.products.findIndex(p => p.model === req.params.model);
  if (idx === -1) return res.status(404).json({ error: '产品不存在' });
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
  if (data.products.length === before) return res.status(404).json({ error: '产品不存在' });
  writeData(data);
  res.json({ ok: true });
});

module.exports = router;
