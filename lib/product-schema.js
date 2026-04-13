const fs = require('fs');

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeCertificate(cert) {
  const normalized = {
    nameEn: stringOrEmpty(cert && cert.nameEn),
    date: stringOrEmpty(cert && cert.date),
    file: stringOrEmpty(cert && cert.file),
    thumb: stringOrEmpty(cert && cert.thumb)
  };

  if (!normalized.nameEn && !normalized.date && !normalized.file && !normalized.thumb) {
    return null;
  }

  return normalized;
}

function normalizeProduct(product) {
  const params = product && product.params ? product.params : {};
  const pkg = product && product.pkg ? product.pkg : {};
  const patent = product && product.patent ? product.patent : {};
  const certificates = Array.isArray(product && product.certificates)
    ? product.certificates.map(normalizeCertificate).filter(Boolean)
    : [];

  return {
    model: stringOrEmpty(product && product.model),
    nameEn: stringOrEmpty(product && product.nameEn),
    companyEn: stringOrEmpty(product && product.companyEn),
    addressEn: stringOrEmpty(product && product.addressEn),
    image: stringOrEmpty(product && product.image),
    params: {
      battery: stringOrEmpty(params.battery),
      power: stringOrEmpty(params.power),
      speed: stringOrEmpty(params.speed),
      bladeEn: stringOrEmpty(params.bladeEn),
      port: stringOrEmpty(params.port),
      chargingTime: stringOrEmpty(params.chargingTime),
      productionDate: stringOrEmpty(params.productionDate),
      weight: stringOrEmpty(params.weight),
      dimensions: stringOrEmpty(params.dimensions),
      dimensionsUnit: stringOrEmpty(params.dimensionsUnit)
    },
    pkg: {
      size: stringOrEmpty(pkg.size),
      qtyEn: stringOrEmpty(pkg.qtyEn),
      carton: stringOrEmpty(pkg.carton)
    },
    patent: {
      no: stringOrEmpty(patent.no),
      pubNo: stringOrEmpty(patent.pubNo),
      certNoEn: stringOrEmpty(patent.certNoEn),
      nameEn: stringOrEmpty(patent.nameEn),
      ownerEn: stringOrEmpty(patent.ownerEn),
      designerEn: stringOrEmpty(patent.designerEn),
      applyDate: stringOrEmpty(patent.applyDate),
      pubDate: stringOrEmpty(patent.pubDate),
      issuerEn: stringOrEmpty(patent.issuerEn),
      evalDate: stringOrEmpty(patent.evalDate)
    },
    certificates
  };
}

function normalizeProductsData(data) {
  const products = Array.isArray(data && data.products) ? data.products : [];
  return {
    products: products.map(normalizeProduct).filter((product) => product.model)
  };
}

function readProductsFile(file) {
  if (!fs.existsSync(file)) {
    return { products: [] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function migrateProductsFile(file) {
  const current = readProductsFile(file);
  const normalized = normalizeProductsData(current);
  const before = JSON.stringify(current);
  const after = JSON.stringify(normalized, null, 2);

  if (before !== JSON.stringify(normalized)) {
    fs.writeFileSync(file, `${after}\n`, 'utf8');
    return { changed: true, data: normalized };
  }

  return { changed: false, data: normalized };
}

module.exports = {
  normalizeProductsData,
  migrateProductsFile
};
