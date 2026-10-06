const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dopog_prod_secret_2026_super_secure_key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const permitsUploadDir = path.join(uploadsDir, 'permits');
const vehiclesUploadDir = path.join(uploadsDir, 'vehicles');
const paymentsUploadDir = path.join(uploadsDir, 'payments');

[dataDir, uploadsDir, permitsUploadDir, vehiclesUploadDir, paymentsUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.includes('sts') || file.fieldname.includes('dopog')) {
      cb(null, vehiclesUploadDir);
    } else if (file.fieldname.includes('payment')) {
      cb(null, paymentsUploadDir);
    } else {
      cb(null, permitsUploadDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '_' + Math.round(Math.random() * 1e6);
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

const db = new Database(path.join(dataDir, 'dopog.db'));
db.pragma('journal_mode = WAL');

// Инициализация базовых таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    inn TEXT,
    ogrn TEXT,
    legal_address TEXT,
    phone TEXT,
    head_position TEXT,
    head_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    consultant_position TEXT,
    consultant_cert_number TEXT,
    consultant_cert_start TEXT,
    consultant_cert_end TEXT,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    plate TEXT NOT NULL,
    brand TEXT NOT NULL,
    vin TEXT,
    vehicle_type TEXT,
    sts_number TEXT,
    sts_file_name TEXT,
    sts_file_path TEXT,
    dopog_number TEXT,
    dopog_expiry_date TEXT NOT NULL,
    dopog_file_name TEXT,
    dopog_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    route_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    un_codes TEXT NOT NULL,
    points_load TEXT NOT NULL,
    points_unload TEXT NOT NULL,
    route_detail TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS permits (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    number TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    files_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ugadn_applications (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    ugadn_target TEXT,
    payment_requisites TEXT,
    payment_file_name TEXT,
    payment_file_path TEXT,
    period_start TEXT,
    period_end TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );
`);

// АВТОМАТИЧЕСКИЕ МИГРАЦИИ (СОХРАНЯЮТ ДАННЫЕ В СУЩЕСТВУЮЩИХ БАЗАХ)
try { db.exec("ALTER TABLE users ADD COLUMN consultant_position TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN ogrn TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN legal_address TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN head_position TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN head_name TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE vehicles ADD COLUMN vin TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE routes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}

// Аутентификация
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Недействительный токен' });
    req.user = decoded;
    next();
  });
}

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Укажите email и пароль' });

  const user = db.prepare(`
    SELECT u.*, c.name as company_name, c.inn as company_inn, c.ogrn as company_ogrn,
           c.legal_address, c.phone as company_phone, c.head_position, c.head_name
    FROM users u 
    JOIN companies c ON u.company_id = c.id 
    WHERE u.email = ?
  `).get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign(
    { userId: user.id, companyId: user.company_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      consultantPosition: user.consultant_position,
      consultantCertNumber: user.consultant_cert_number,
      consultantCertStart: user.consultant_cert_start,
      consultantCertEnd: user.consultant_cert_end,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
      companyInn: user.company_inn,
      companyOgrn: user.company_ogrn,
      legalAddress: user.legal_address,
      headPosition: user.head_position,
      headName: user.head_name
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { companyName, inn, ogrn, legalAddress, companyPhone, headPosition, headName, email, password, fullName, phone, consultantPosition, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;
  if (!companyName || !email || !password) return res.status(400).json({ error: 'Заполните обязательные поля' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) return res.status(400).json({ error: 'Email уже зарегистрирован' });

  const companyId = 'comp_' + Date.now();
  const userId = 'user_' + Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO companies (id, name, inn, ogrn, legal_address, phone, head_position, head_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, companyName.trim(), inn ? inn.trim() : '', ogrn ? ogrn.trim() : '',
      legalAddress ? legalAddress.trim() : '', companyPhone ? companyPhone.trim() : '',
      headPosition ? headPosition.trim() : '', headName ? headName.trim() : ''
    );

    db.prepare(`
      INSERT INTO users (id, company_id, email, password_hash, full_name, phone, consultant_position, consultant_cert_number, consultant_cert_start, consultant_cert_end, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')
    `).run(
      userId, companyId, email.trim().toLowerCase(), passwordHash,
      fullName || 'Консультант ДОПОГ', phone ? phone.trim() : '',
      consultantPosition || null, consultantCertNumber || null,
      consultantCertStart || null, consultantCertEnd || null
    );
  });
  tx();

  const token = jwt.sign({ userId, companyId, email: email.trim().toLowerCase(), role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.phone, u.consultant_position, u.consultant_cert_number,
           u.consultant_cert_start, u.consultant_cert_end, u.role, u.company_id,
           c.name as company_name, c.inn as company_inn, c.ogrn as company_ogrn,
           c.legal_address, c.phone as company_phone, c.head_position, c.head_name
    FROM users u 
    JOIN companies c ON u.company_id = c.id 
    WHERE u.id = ?
  `).get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { fullName, phone, consultantPosition, companyName, companyInn, companyOgrn, legalAddress, companyPhone, headPosition, headName, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET full_name = ?, phone = ?, consultant_position = ?, consultant_cert_number = ?, consultant_cert_start = ?, consultant_cert_end = ?
      WHERE id = ?
    `).run(
      fullName.trim(), phone || '', consultantPosition || '',
      consultantCertNumber ? consultantCertNumber.trim() : null,
      consultantCertStart || null, consultantCertEnd || null, req.user.userId
    );

    if (companyName) {
      db.prepare(`
        UPDATE companies
        SET name = ?, inn = ?, ogrn = ?, legal_address = ?, phone = ?, head_position = ?, head_name = ?
        WHERE id = ?
      `).run(
        companyName.trim(), companyInn || '', companyOgrn || '', legalAddress || '',
        companyPhone || '', headPosition || '', headName || '', req.user.companyId
      );
    }
  });
  tx();
  res.json({ success: true });
});

// --- МАРШРУТЫ ---

app.get('/api/routes', authMiddleware, (req, res) => {
  const includeArchived = req.query.archived === '1';
  const query = includeArchived
    ? 'SELECT * FROM routes WHERE company_id = ? AND is_archived = 1 ORDER BY route_number ASC'
    : 'SELECT * FROM routes WHERE company_id = ? AND is_archived = 0 ORDER BY route_number ASC';

  const routes = db.prepare(query).all(req.user.companyId);
  const permits = db.prepare(`
    SELECT p.*, v.plate, v.brand 
    FROM permits p 
    JOIN vehicles v ON p.vehicle_id = v.id 
    WHERE p.company_id = ?
  `).all(req.user.companyId);

  const formatted = routes.map(r => {
    const routePermits = permits.filter(p => p.route_id === r.id).map(p => ({
      ...p,
      files: JSON.parse(p.files_json || '[]')
    }));
    return {
      ...r,
      routeNumber: r.route_number,
      unCodes: JSON.parse(r.un_codes || '[]'),
      pointsLoad: JSON.parse(r.points_load || '[]'),
      pointsUnload: JSON.parse(r.points_unload || '[]'),
      permits: routePermits
    };
  });
  res.json({ routes: formatted });
});

app.post('/api/routes', authMiddleware, (req, res) => {
  const { routeNumber, name, unCodes, pointsLoad, pointsUnload, routeDetail } = req.body;
  if (!routeNumber) return res.status(400).json({ error: 'Укажите номер маршрута' });

  const id = 'r_' + Date.now();
  db.prepare(`
    INSERT INTO routes (id, company_id, route_number, name, un_codes, points_load, points_unload, route_detail, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id, req.user.companyId, parseInt(routeNumber, 10),
    name.trim(), JSON.stringify(unCodes || []),
    JSON.stringify(pointsLoad || []), JSON.stringify(pointsUnload || []),
    routeDetail ? routeDetail.trim() : ''
  );

  res.status(201).json({ success: true, id });
});

app.put('/api/routes/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { routeNumber, name, unCodes, pointsLoad, pointsUnload, routeDetail } = req.body;

  db.prepare(`
    UPDATE routes 
    SET route_number = ?, name = ?, un_codes = ?, points_load = ?, points_unload = ?, route_detail = ?
    WHERE id = ? AND company_id = ?
  `).run(
    parseInt(routeNumber, 10), name.trim(),
    JSON.stringify(unCodes || []), JSON.stringify(pointsLoad || []), JSON.stringify(pointsUnload || []),
    routeDetail || '', id, req.user.companyId
  );

  res.json({ success: true });
});

app.patch('/api/routes/:id/archive', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { archive } = req.body;
  db.prepare('UPDATE routes SET is_archived = ? WHERE id = ? AND company_id = ?')
    .run(archive ? 1 : 0, id, req.user.companyId);
  res.json({ success: true });
});

// --- СПЕЦРАЗРЕШЕНИЯ ---

app.get('/api/permits', authMiddleware, (req, res) => {
  const permits = db.prepare(`
    SELECT p.*, r.route_number, r.name as route_name, r.points_load, r.points_unload, r.un_codes, r.route_detail, v.plate, v.brand
    FROM permits p
    JOIN routes r ON p.route_id = r.id
    JOIN vehicles v ON p.vehicle_id = v.id
    WHERE p.company_id = ?
    ORDER BY p.end_date ASC
  `).all(req.user.companyId);

  const formatted = permits.map(p => ({
    ...p,
    routeNumber: p.route_number,
    routeName: p.route_name,
    pointsLoad: JSON.parse(p.points_load || '[]'),
    pointsUnload: JSON.parse(p.points_unload || '[]'),
    unCodes: JSON.parse(p.un_codes || '[]'),
    files: JSON.parse(p.files_json || '[]')
  }));
  res.json({ permits: formatted });
});

app.post('/api/permits', authMiddleware, upload.array('permitFiles', 20), (req, res) => {
  const { routeId, vehicleId, number, startDate, endDate } = req.body;
  if (!routeId || !vehicleId || !number || !startDate || !endDate) {
    return res.status(400).json({ error: 'Заполните обязательные поля СР' });
  }

  const id = 'p_' + Date.now();
  const files = (req.files || []).map(f => ({ name: f.originalname, path: f.filename }));

  db.prepare(`
    INSERT INTO permits (id, company_id, route_id, vehicle_id, number, start_date, end_date, files_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.companyId, routeId, vehicleId, number.trim(), startDate, endDate, JSON.stringify(files));

  res.status(201).json({ success: true, id });
});

app.put('/api/permits/:id', authMiddleware, upload.array('permitFiles', 20), (req, res) => {
  const { id } = req.params;
  const { routeId, vehicleId, number, startDate, endDate, existingFilesJson } = req.body;

  const existing = db.prepare('SELECT * FROM permits WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'СР не найдено' });

  let files = [];
  try { files = JSON.parse(existingFilesJson || existing.files_json || '[]'); } catch (e) {}
  if (req.files && req.files.length > 0) {
    req.files.forEach(f => files.push({ name: f.originalname, path: f.filename }));
  }

  db.prepare(`
    UPDATE permits 
    SET route_id = ?, vehicle_id = ?, number = ?, start_date = ?, end_date = ?, files_json = ?
    WHERE id = ? AND company_id = ?
  `).run(routeId, vehicleId, number.trim(), startDate, endDate, JSON.stringify(files), id, req.user.companyId);

  res.json({ success: true });
});

app.delete('/api/permits/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM permits WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  res.json({ success: true });
});

// --- АВТОПАРК ---

app.get('/api/vehicles', authMiddleware, (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE company_id = ? ORDER BY created_at DESC').all(req.user.companyId);
  res.json({ vehicles });
});

app.post('/api/vehicles', authMiddleware, upload.fields([{ name: 'stsFile', maxCount: 1 }, { name: 'dopogFile', maxCount: 1 }]), (req, res) => {
  const { plate, brand, vin, vehicleType, stsNumber, dopogNumber, dopogExpiryDate } = req.body;
  if (!plate || !brand || !dopogExpiryDate) return res.status(400).json({ error: 'Укажите госномер, марку и срок допуска ДОПОГ' });

  const id = 'v_' + Date.now();
  let stsFileName = null, stsFilePath = null;
  let dopogFileName = null, dopogFilePath = null;

  if (req.files && req.files['stsFile']) {
    stsFileName = req.files['stsFile'][0].originalname;
    stsFilePath = req.files['stsFile'][0].filename;
  }
  if (req.files && req.files['dopogFile']) {
    dopogFileName = req.files['dopogFile'][0].originalname;
    dopogFilePath = req.files['dopogFile'][0].filename;
  }

  db.prepare(`
    INSERT INTO vehicles (id, company_id, plate, brand, vin, vehicle_type, sts_number, sts_file_name, sts_file_path, dopog_number, dopog_expiry_date, dopog_file_name, dopog_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.companyId, plate.trim().toUpperCase(), brand.trim(),
    vin ? vin.trim().toUpperCase() : null, vehicleType ? vehicleType.trim() : null,
    stsNumber ? stsNumber.trim() : null, stsFileName, stsFilePath,
    dopogNumber ? dopogNumber.trim() : null, dopogExpiryDate,
    dopogFileName, dopogFilePath
  );

  res.status(201).json({ success: true, id });
});

app.put('/api/vehicles/:id', authMiddleware, upload.fields([{ name: 'stsFile', maxCount: 1 }, { name: 'dopogFile', maxCount: 1 }]), (req, res) => {
  const { id } = req.params;
  const { plate, brand, vin, vehicleType, stsNumber, dopogNumber, dopogExpiryDate } = req.body;
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'ТС не найдено' });

  let stsFileName = existing.sts_file_name, stsFilePath = existing.sts_file_path;
  let dopogFileName = existing.dopog_file_name, dopogFilePath = existing.dopog_file_path;

  if (req.files && req.files['stsFile']) {
    stsFileName = req.files['stsFile'][0].originalname;
    stsFilePath = req.files['stsFile'][0].filename;
  }
  if (req.files && req.files['dopogFile']) {
    dopogFileName = req.files['dopogFile'][0].originalname;
    dopogFilePath = req.files['dopogFile'][0].filename;
  }

  db.prepare(`
    UPDATE vehicles 
    SET plate = ?, brand = ?, vin = ?, vehicle_type = ?, sts_number = ?, sts_file_name = ?, sts_file_path = ?,
        dopog_number = ?, dopog_expiry_date = ?, dopog_file_name = ?, dopog_file_path = ?
    WHERE id = ? AND company_id = ?
  `).run(
    plate.trim().toUpperCase(), brand.trim(), vin ? vin.trim().toUpperCase() : null, vehicleType ? vehicleType.trim() : null,
    stsNumber ? stsNumber.trim() : null, stsFileName, stsFilePath,
    dopogNumber ? dopogNumber.trim() : null, dopogExpiryDate,
    dopogFileName, dopogFilePath, id, req.user.companyId
  );

  res.json({ success: true });
});

app.delete('/api/vehicles/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM vehicles WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  res.json({ success: true });
});

// --- ЗАЯВЛЕНИЯ В УГАДН (ХРАНЕНИЕ НЕСКОЛЬКИХ ЗАЯВЛЕНИЙ) ---

app.get('/api/ugadn/route/:routeId', authMiddleware, (req, res) => {
  const { routeId } = req.params;
  const list = db.prepare(`
    SELECT u.*, v.plate, v.brand, v.vin, v.vehicle_type, v.sts_number, v.sts_file_path, v.dopog_number, v.dopog_file_path
    FROM ugadn_applications u
    JOIN vehicles v ON u.vehicle_id = v.id
    WHERE u.company_id = ? AND u.route_id = ?
    ORDER BY u.created_at DESC
  `).all(req.user.companyId, routeId);

  res.json({ applications: list });
});

app.post('/api/ugadn/save', authMiddleware, upload.single('paymentFile'), (req, res) => {
  const { id, routeId, vehicleId, ugadnTarget, paymentRequisites, periodStart, periodEnd } = req.body;
  if (!routeId || !vehicleId) return res.status(400).json({ error: 'Укажите маршрут и автомобиль' });

  let appId = id;
  let paymentFileName = null, paymentFilePath = null;

  if (appId) {
    const existing = db.prepare('SELECT * FROM ugadn_applications WHERE id = ? AND company_id = ?').get(appId, req.user.companyId);
    if (existing) {
      paymentFileName = existing.payment_file_name;
      paymentFilePath = existing.payment_file_path;
    }
  } else {
    appId = 'ugadn_' + Date.now();
  }

  if (req.file) {
    paymentFileName = req.file.originalname;
    paymentFilePath = req.file.filename;
  }

  db.prepare(`
    INSERT OR REPLACE INTO ugadn_applications (id, company_id, route_id, vehicle_id, ugadn_target, payment_requisites, payment_file_name, payment_file_path, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appId, req.user.companyId, routeId, vehicleId,
    ugadnTarget || 'в МТУ Ространснадзора по СФО',
    paymentRequisites || '', paymentFileName, paymentFilePath,
    periodStart || '', periodEnd || ''
  );

  res.json({ success: true, id: appId });
});

app.delete('/api/ugadn/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM ugadn_applications WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  res.json({ success: true });
});

// Скачивание файлов
app.get('/api/files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!['permits', 'vehicles', 'payments'].includes(folder)) {
    return res.status(400).json({ error: 'Неверная папка' });
  }
  const safeFilename = path.basename(filename);
  const targetPath = path.join(uploadsDir, folder, safeFilename);
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Файл не найден' });
  res.download(targetPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DOPOG Online SaaS running on port ${PORT}`);
});