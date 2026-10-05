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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Папки для данных и файлов
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const permitsUploadDir = path.join(uploadsDir, 'permits');
const vehiclesUploadDir = path.join(uploadsDir, 'vehicles');

[dataDir, uploadsDir, permitsUploadDir, vehiclesUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Настройка Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.includes('sts') || file.fieldname.includes('dopog')) {
      cb(null, vehiclesUploadDir);
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

// Инициализация SQLite
const db = new Database(path.join(dataDir, 'dopog.db'));
db.pragma('journal_mode = WAL');

// Создание структуры таблиц с реестром маршрутов
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    inn TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
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
`);

// Создание демо-компании и начальных данных при первом старте
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const companyId = 'comp_demo_1';
  const userId = 'user_admin_1';
  const hashedPassword = bcrypt.hashSync('admin123', 10);

  db.prepare(`
    INSERT INTO companies (id, name, inn) VALUES (?, ?, ?)
  `).run(companyId, 'ООО "Сибирь-Транс-ДОПОГ"', '5501234567');

  db.prepare(`
    INSERT INTO users (id, company_id, email, password_hash, full_name, consultant_cert_number, consultant_cert_start, consultant_cert_end, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, companyId, 'admin@dopog.ru', hashedPassword, 'Иванов Алексей Сергеевич', 'ДОПОГ-КОНС № 55/00142', '2024-06-10', '2029-06-09', 'admin');

  const today = new Date();
  const addDays = (d) => {
    const res = new Date(today);
    res.setDate(res.getDate() + d);
    return res.toISOString().split('T')[0];
  };

  // Автопарк
  db.prepare(`
    INSERT INTO vehicles (id, company_id, plate, brand, sts_number, dopog_number, dopog_expiry_date)
    VALUES 
    ('v_1', ?, 'У 511 НС 155', 'КАМАЗ-5490 NEO', '55 12 345678', 'ДОПОГ № 55-0012', ?),
    ('v_2', ?, 'А 741 ТР 77', 'Scania G400 (фургон)', '77 34 987654', 'ДОПОГ № 77-0941', ?),
    ('v_3', ?, 'О 328 МХ 116', 'ГАЗель NEXT', '16 99 112233', 'ДОПОГ № 16-0442', ?)
  `).run(companyId, addDays(190), companyId, addDays(21), companyId, addDays(-5));

  // Маршруты
  db.prepare(`
    INSERT INTO routes (id, company_id, route_number, name, un_codes, points_load, points_unload, route_detail)
    VALUES
    ('r_1', ?, 5, 'Омск — Новосибирск', ?, ?, ?, 'г. Омск, погрузка: Нефтезавод цех 3 -> а/д Р-254 Иртыш -> г. Барабинск -> г. Новосибирск, разгрузка: Терминал Восток'),
    ('r_2', ?, 12, 'Казань — Набережные Челны', ?, ?, ?, 'г. Казань, отгрузка: Химзавод склад 2 -> а/д М-7 Волга -> г. Елабуга -> г. Набережные Челны, разгрузка: Промбаза')
  `).run(
    companyId, JSON.stringify(['1202', '1203', '1223']), JSON.stringify(['г. Омск, ПАО Газпромнефть-ОНПЗ']), JSON.stringify(['г. Новосибирск, Промплощадка №4']),
    companyId, JSON.stringify(['1005', '1017']), JSON.stringify(['г. Казань, Завод Реагент']), JSON.stringify(['г. Набережные Челны, Склад Химсырья'])
  );

  // Спецразрешения (к маршруту №5 привязано 2 авто)
  db.prepare(`
    INSERT INTO permits (id, company_id, route_id, vehicle_id, number, start_date, end_date, files_json)
    VALUES
    ('p_1', ?, 'r_1', 'v_1', '55 004521/э', ?, ?, '[]'),
    ('p_2', ?, 'r_1', 'v_2', '55 004522/э', ?, ?, '[]'),
    ('p_3', ?, 'r_2', 'v_3', '16 001994/э', ?, ?, '[]')
  `).run(
    companyId, addDays(-60), addDays(220),
    companyId, addDays(-345), addDays(20),
    companyId, addDays(-370), addDays(-5)
  );
}

// Проверка JWT токена
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
    SELECT u.*, c.name as company_name, c.inn as company_inn 
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
      consultantCertNumber: user.consultant_cert_number,
      consultantCertStart: user.consultant_cert_start,
      consultantCertEnd: user.consultant_cert_end,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
      companyInn: user.company_inn
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { companyName, inn, email, password, fullName, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;
  if (!companyName || !email || !password) return res.status(400).json({ error: 'Заполните обязательные поля' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) return res.status(400).json({ error: 'Email уже зарегистрирован' });

  const companyId = 'comp_' + Date.now();
  const userId = 'user_' + Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO companies (id, name, inn) VALUES (?, ?, ?)').run(companyId, companyName.trim(), inn ? inn.trim() : '');
    db.prepare(`
      INSERT INTO users (id, company_id, email, password_hash, full_name, consultant_cert_number, consultant_cert_start, consultant_cert_end, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, companyId, email.trim().toLowerCase(), passwordHash, fullName || 'Консультант ДОПОГ', consultantCertNumber || null, consultantCertStart || null, consultantCertEnd || null, 'admin');
  });
  tx();

  const token = jwt.sign({ userId, companyId, email: email.trim().toLowerCase(), role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({
    token,
    user: { id: userId, email: email.trim().toLowerCase(), fullName, companyName, companyInn: inn, consultantCertNumber, consultantCertStart, consultantCertEnd }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.consultant_cert_number, u.consultant_cert_start, u.consultant_cert_end, u.role, u.company_id, c.name as company_name, c.inn as company_inn 
    FROM users u 
    JOIN companies c ON u.company_id = c.id 
    WHERE u.id = ?
  `).get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { fullName, companyName, companyInn, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET full_name = ?, consultant_cert_number = ?, consultant_cert_start = ?, consultant_cert_end = ? WHERE id = ?')
      .run(fullName.trim(), consultantCertNumber ? consultantCertNumber.trim() : null, consultantCertStart || null, consultantCertEnd || null, req.user.userId);
    if (companyName) {
      db.prepare('UPDATE companies SET name = ?, inn = ? WHERE id = ?').run(companyName.trim(), companyInn ? companyInn.trim() : '', req.user.companyId);
    }
  });
  tx();
  res.json({ success: true });
});

// --- РЕЕСТР МАРШРУТОВ (ROUTES API) ---

app.get('/api/routes', authMiddleware, (req, res) => {
  const routes = db.prepare('SELECT * FROM routes WHERE company_id = ? ORDER BY route_number ASC').all(req.user.companyId);
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
  const unJson = JSON.stringify(unCodes || []);
  const loadJson = JSON.stringify(pointsLoad || []);
  const unloadJson = JSON.stringify(pointsUnload || []);
  const routeName = name || ((pointsLoad && pointsLoad[0] ? pointsLoad[0] : 'Пункт А') + ' ➔ ' + (pointsUnload && pointsUnload[0] ? pointsUnload[0] : 'Пункт Б'));

  db.prepare(`
    INSERT INTO routes (id, company_id, route_number, name, un_codes, points_load, points_unload, route_detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.companyId, parseInt(routeNumber, 10), routeName, unJson, loadJson, unloadJson, routeDetail ? routeDetail.trim() : '');

  res.status(201).json({ success: true, id });
});

app.put('/api/routes/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { routeNumber, name, unCodes, pointsLoad, pointsUnload, routeDetail } = req.body;

  db.prepare(`
    UPDATE routes 
    SET route_number = ?, name = ?, un_codes = ?, points_load = ?, points_unload = ?, route_detail = ?
    WHERE id = ? AND company_id = ?
  `).run(parseInt(routeNumber, 10), name, JSON.stringify(unCodes || []), JSON.stringify(pointsLoad || []), JSON.stringify(pointsUnload || []), routeDetail || '', id, req.user.companyId);

  res.json({ success: true });
});

app.delete('/api/routes/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM routes WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  res.json({ success: true });
});

// --- РЕЕСТР СПЕЦРАЗРЕШЕНИЙ (PERMITS API С МНОЖЕСТВЕННЫМИ ФАЙЛАМИ) ---

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

app.post('/api/permits', authMiddleware, upload.array('permitFiles', 15), (req, res) => {
  const { routeId, vehicleId, number, startDate, endDate } = req.body;
  if (!routeId || !vehicleId || !number || !startDate || !endDate) {
    return res.status(400).json({ error: 'Заполните обязательные поля СР' });
  }

  const id = 'p_' + Date.now();
  const files = (req.files || []).map(f => ({
    name: f.originalname,
    path: f.filename
  }));

  db.prepare(`
    INSERT INTO permits (id, company_id, route_id, vehicle_id, number, start_date, end_date, files_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.companyId, routeId, vehicleId, number.trim(), startDate, endDate, JSON.stringify(files));

  res.status(201).json({ success: true, id });
});

app.put('/api/permits/:id', authMiddleware, upload.array('permitFiles', 15), (req, res) => {
  const { id } = req.params;
  const { routeId, vehicleId, number, startDate, endDate, existingFilesJson } = req.body;

  const existing = db.prepare('SELECT * FROM permits WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'СР не найдено' });

  let files = [];
  try {
    files = JSON.parse(existingFilesJson || existing.files_json || '[]');
  } catch (e) {}

  if (req.files && req.files.length > 0) {
    req.files.forEach(f => {
      files.push({ name: f.originalname, path: f.filename });
    });
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

// --- АВТОПАРК (VEHICLES API) ---

app.get('/api/vehicles', authMiddleware, (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE company_id = ? ORDER BY created_at DESC').all(req.user.companyId);
  res.json({ vehicles });
});

app.post('/api/vehicles', authMiddleware, upload.fields([{ name: 'stsFile', maxCount: 1 }, { name: 'dopogFile', maxCount: 1 }]), (req, res) => {
  const { plate, brand, stsNumber, dopogNumber, dopogExpiryDate } = req.body;
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
    INSERT INTO vehicles (id, company_id, plate, brand, sts_number, sts_file_name, sts_file_path, dopog_number, dopog_expiry_date, dopog_file_name, dopog_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.companyId, plate.trim().toUpperCase(), brand.trim(), stsNumber ? stsNumber.trim() : null, stsFileName, stsFilePath, dopogNumber ? dopogNumber.trim() : null, dopogExpiryDate, dopogFileName, dopogFilePath);

  res.status(201).json({ success: true, id });
});

app.put('/api/vehicles/:id', authMiddleware, upload.fields([{ name: 'stsFile', maxCount: 1 }, { name: 'dopogFile', maxCount: 1 }]), (req, res) => {
  const { id } = req.params;
  const { plate, brand, stsNumber, dopogNumber, dopogExpiryDate } = req.body;
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
    SET plate = ?, brand = ?, sts_number = ?, sts_file_name = ?, sts_file_path = ?, dopog_number = ?, dopog_expiry_date = ?, dopog_file_name = ?, dopog_file_path = ?
    WHERE id = ? AND company_id = ?
  `).run(plate.trim().toUpperCase(), brand.trim(), stsNumber ? stsNumber.trim() : null, stsFileName, stsFilePath, dopogNumber ? dopogNumber.trim() : null, dopogExpiryDate, dopogFileName, dopogFilePath, id, req.user.companyId);

  res.json({ success: true });
});

app.delete('/api/vehicles/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM vehicles WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  res.json({ success: true });
});

// Скачивание файлов
app.get('/api/files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (folder !== 'permits' && folder !== 'vehicles') return res.status(400).json({ error: 'Неверная папка' });
  const safeFilename = path.basename(filename);
  const targetPath = path.join(uploadsDir, folder, safeFilename);
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Файл не найден' });
  res.download(targetPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DOPOG Online SaaS running on port ${PORT}`);
});