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

// Папки для данных и загрузок
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const permitsUploadDir = path.join(uploadsDir, 'permits');
const vehiclesUploadDir = path.join(uploadsDir, 'vehicles');

[dataDir, uploadsDir, permitsUploadDir, vehiclesUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Настройка хранилища Multer
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

// Инициализация базы данных SQLite
const db = new Database(path.join(dataDir, 'dopog.db'));
db.pragma('journal_mode = WAL');

// Создание структуры таблиц
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
    dopog_issue_date TEXT,
    dopog_expiry_date TEXT NOT NULL,
    dopog_file_name TEXT,
    dopog_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS permits (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    vehicle_id TEXT,
    number TEXT NOT NULL,
    route_number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    points_load TEXT NOT NULL,
    points_unload TEXT NOT NULL,
    route_detail TEXT,
    un_codes TEXT NOT NULL,
    file_name TEXT,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS location_history (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL
  );
`);

// Создание начального администратора и демо-компании при первом запуске
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const companyId = 'comp_demo_1';
  const userId = 'user_admin_1';
  const hashedPassword = bcrypt.hashSync('test', 10);

  db.prepare(`
    INSERT INTO companies (id, name, inn) VALUES (?, ?, ?)
  `).run(companyId, 'ООО "Логистика Опасных Грузов"', '7701234567');

  db.prepare(`
    INSERT INTO users (id, company_id, email, password_hash, full_name, consultant_cert_number, consultant_cert_start, consultant_cert_end, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId, companyId, 'test', hashedPassword, 
    'Иванов Алексей Сергеевич', 'ДОПОГ-КОНС № 77/00452', 
    '2024-05-15', '2029-05-14', 'admin'
  );

  const today = new Date();
  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Демо-автомобили
  db.prepare(`
    INSERT INTO vehicles (id, company_id, plate, brand, sts_number, dopog_number, dopog_issue_date, dopog_expiry_date)
    VALUES 
    ('v_1', ?, 'А 741 ТР 77', 'КАМАЗ-5490 NEO (фургон)', '77 22 984512', 'ДОПОГ № 77-00341', ?, ?),
    ('v_2', ?, 'О 328 МХ 116', 'ГАЗель NEXT (борт/тент)', '16 34 551982', 'ДОПОГ № 16-01994', ?, ?),
    ('v_3', ?, 'В 892 СС 50', 'Scania G400 (фургон)', '50 11 448102', 'ДОПОГ № 50-00821', ?, ?)
  `).run(
    companyId, addDays(-150), addDays(180),
    companyId, addDays(-160), addDays(22),
    companyId, addDays(-190), addDays(-5)
  );

  // Демо-спецразрешения
  db.prepare(`
    INSERT INTO permits (id, company_id, vehicle_id, number, route_number, start_date, end_date, points_load, points_unload, route_detail, un_codes)
    VALUES
    ('p_1', ?, 'v_1', '77-00452-26', 142, ?, ?, ?, ?, 'г. Москва, погрузка: Нефтебаза Север -> а/д М-7 Волга -> г. Владимир -> г. Нижний Новгород, разгрузка: Промбаза', ?),
    ('p_2', ?, 'v_2', '16-01290-26', 88, ?, ?, ?, ?, 'г. Казань, отгрузка: Завод Химреактив -> а/д М-7 -> г. Елабуга -> г. Набережные Челны, выгрузка: Цех №2', ?),
    ('p_3', ?, 'v_1', '50-00781-25', 301, ?, ?, ?, ?, 'г. Воскресенск, погрузка: Склад удобрений -> а/д М-5 Урал -> г. Коломна -> г. Рязань, разгрузка: Агротерминал', ?),
    ('p_4', ?, 'v_3', '77-00109-25', 109, ?, ?, ?, ?, 'г. Дзержинск, погрузка: Спецсклад ядохимикатов -> М-7 Волга -> г. Москва, выгрузка: НИИ Промхимии', ?)
  `).run(
    companyId, addDays(-60), addDays(220), JSON.stringify(['г. Москва, Нефтебаза №1']), JSON.stringify(['г. Нижний Новгород, Промзона']), JSON.stringify(['1202', '1203', '1223']),
    companyId, addDays(-340), addDays(25), JSON.stringify(['г. Казань, Завод ХимПром']), JSON.stringify(['г. Набережные Челны, Склад ГСМ']), JSON.stringify(['1005', '1017']),
    companyId, addDays(-355), addDays(10), JSON.stringify(['г. Воскресенск, База минеральных удобрений']), JSON.stringify(['г. Рязань, Агрокомплекс']), JSON.stringify(['1942']),
    companyId, addDays(-370), addDays(-8), JSON.stringify(['г. Дзержинск, Промплощадка №3']), JSON.stringify(['г. Москва, НИИ Реактивов']), JSON.stringify(['1565', '1689'])
  );
}

// Middleware аутентификации по JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = decoded;
    next();
  });
}

// --- МАРШРУТЫ АВТОРИЗАЦИИ И ПРОФИЛЯ ---

// Вход в систему
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }

  const user = db.prepare(`
    SELECT u.*, c.name as company_name 
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
      companyName: user.company_name
    }
  });
});

// Регистрация новой организации
app.post('/api/auth/register', (req, res) => {
  const { companyName, inn, email, password, fullName, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;

  if (!companyName || !email || !password) {
    return res.status(400).json({ error: 'Заполните обязательные поля: название компании, email и пароль' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  const companyId = 'comp_' + Date.now();
  const userId = 'user_' + Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);

  const insertTx = db.transaction(() => {
    db.prepare('INSERT INTO companies (id, name, inn) VALUES (?, ?, ?)').run(companyId, companyName.trim(), inn || '');
    db.prepare(`
      INSERT INTO users (id, company_id, email, password_hash, full_name, consultant_cert_number, consultant_cert_start, consultant_cert_end, role) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, companyId, email.trim().toLowerCase(), passwordHash, 
      fullName || 'Администратор', consultantCertNumber || null, 
      consultantCertStart || null, consultantCertEnd || null, 'admin'
    );
  });

  insertTx();

  const token = jwt.sign(
    { userId, companyId, email: email.trim().toLowerCase(), role: 'admin' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(201).json({
    token,
    user: {
      id: userId,
      email: email.trim().toLowerCase(),
      fullName: fullName || 'Администратор',
      consultantCertNumber,
      consultantCertStart,
      consultantCertEnd,
      role: 'admin',
      companyId,
      companyName: companyName.trim()
    }
  });
});

// Получение профиля текущего пользователя
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.consultant_cert_number, u.consultant_cert_start, u.consultant_cert_end, u.role, u.company_id, c.name as company_name 
    FROM users u 
    JOIN companies c ON u.company_id = c.id 
    WHERE u.id = ?
  `).get(req.user.userId);

  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

// Обновление профиля консультанта ДОПОГ
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { fullName, consultantCertNumber, consultantCertStart, consultantCertEnd } = req.body;

  db.prepare(`
    UPDATE users 
    SET full_name = ?, consultant_cert_number = ?, consultant_cert_start = ?, consultant_cert_end = ?
    WHERE id = ?
  `).run(fullName.trim(), consultantCertNumber ? consultantCertNumber.trim() : null, consultantCertStart || null, consultantCertEnd || null, req.user.userId);

  res.json({ success: true, message: 'Профиль успешно обновлен' });
});

// --- АВТОПАРК (VEHICLES API) ---

app.get('/api/vehicles', authMiddleware, (req, res) => {
  const vehicles = db.prepare(`
    SELECT * FROM vehicles WHERE company_id = ? ORDER BY created_at DESC
  `).all(req.user.companyId);
  res.json({ vehicles });
});

app.post('/api/vehicles', authMiddleware, upload.fields([
  { name: 'stsFile', maxCount: 1 },
  { name: 'dopogFile', maxCount: 1 }
]), (req, res) => {
  const { plate, brand, stsNumber, dopogNumber, dopogIssueDate, dopogExpiryDate } = req.body;

  if (!plate || !brand || !dopogExpiryDate) {
    return res.status(400).json({ error: 'Укажите госномер, марку и срок окончания допуска ДОПОГ' });
  }

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
    INSERT INTO vehicles (id, company_id, plate, brand, sts_number, sts_file_name, sts_file_path, dopog_number, dopog_issue_date, dopog_expiry_date, dopog_file_name, dopog_file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.companyId, plate.trim(), brand.trim(),
    stsNumber ? stsNumber.trim() : null, stsFileName, stsFilePath,
    dopogNumber ? dopogNumber.trim() : null, dopogIssueDate || null,
    dopogExpiryDate, dopogFileName, dopogFilePath
  );

  const created = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  res.status(201).json({ vehicle: created });
});

app.put('/api/vehicles/:id', authMiddleware, upload.fields([
  { name: 'stsFile', maxCount: 1 },
  { name: 'dopogFile', maxCount: 1 }
]), (req, res) => {
  const { id } = req.params;
  const { plate, brand, stsNumber, dopogNumber, dopogIssueDate, dopogExpiryDate } = req.body;

  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Автомобиль не найден' });

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
    SET plate = ?, brand = ?, sts_number = ?, sts_file_name = ?, sts_file_path = ?, 
        dopog_number = ?, dopog_issue_date = ?, dopog_expiry_date = ?, dopog_file_name = ?, dopog_file_path = ?
    WHERE id = ? AND company_id = ?
  `).run(
    plate.trim(), brand.trim(), stsNumber ? stsNumber.trim() : null,
    stsFileName, stsFilePath, dopogNumber ? dopogNumber.trim() : null,
    dopogIssueDate || null, dopogExpiryDate, dopogFileName, dopogFilePath,
    id, req.user.companyId
  );

  const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  res.json({ vehicle: updated });
});

app.delete('/api/vehicles/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM vehicles WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  if (result.changes === 0) return res.status(404).json({ error: 'Автомобиль не найден' });
  res.json({ success: true });
});

// --- СПЕЦРАЗРЕШЕНИЯ (PERMITS API) ---

app.get('/api/permits', authMiddleware, (req, res) => {
  const permits = db.prepare(`
    SELECT p.*, v.plate as vehicle_plate, v.brand as vehicle_brand
    FROM permits p
    LEFT JOIN vehicles v ON p.vehicle_id = v.id
    WHERE p.company_id = ?
    ORDER BY p.end_date ASC
  `).all(req.user.companyId);

  const formatted = permits.map(p => ({
    ...p,
    routeNumber: p.route_number,
    startDate: p.start_date,
    endDate: p.end_date,
    pointsLoad: p.points_load ? JSON.parse(p.points_load) : [],
    pointsUnload: p.points_unload ? JSON.parse(p.points_unload) : [],
    unCodes: p.un_codes ? JSON.parse(p.un_codes) : [],
    routeDetail: p.route_detail,
    fileName: p.file_name,
    filePath: p.file_path
  }));

  res.json({ permits: formatted });
});

app.post('/api/permits', authMiddleware, upload.single('permitFile'), (req, res) => {
  const { number, routeNumber, startDate, endDate, vehicleId, pointsLoad, pointsUnload, routeDetail, unCodes } = req.body;

  if (!number || !routeNumber || !startDate || !endDate || !vehicleId) {
    return res.status(400).json({ error: 'Заполните обязательные поля СР' });
  }

  const id = 'p_' + Date.now();
  let fileName = null, filePath = null;

  if (req.file) {
    fileName = req.file.originalname;
    filePath = req.file.filename;
  }

  const pLoadJson = typeof pointsLoad === 'string' ? pointsLoad : JSON.stringify(pointsLoad || []);
  const pUnloadJson = typeof pointsUnload === 'string' ? pointsUnload : JSON.stringify(pointsUnload || []);
  const unJson = typeof unCodes === 'string' ? unCodes : JSON.stringify(unCodes || []);

  db.prepare(`
    INSERT INTO permits (id, company_id, vehicle_id, number, route_number, start_date, end_date, points_load, points_unload, route_detail, un_codes, file_name, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.companyId, vehicleId, number.trim(), parseInt(routeNumber, 10) || 0,
    startDate, endDate, pLoadJson, pUnloadJson,
    routeDetail ? routeDetail.trim() : null, unJson, fileName, filePath
  );

  // Сохраняем адреса в историю для автодополнения
  try {
    const loads = JSON.parse(pLoadJson);
    const unloads = JSON.parse(pUnloadJson);
    loads.forEach(name => {
      db.prepare('INSERT OR IGNORE INTO location_history (id, company_id, type, name) VALUES (?, ?, ?, ?)').run('loc_' + Math.random(), req.user.companyId, 'load', name);
    });
    unloads.forEach(name => {
      db.prepare('INSERT OR IGNORE INTO location_history (id, company_id, type, name) VALUES (?, ?, ?, ?)').run('loc_' + Math.random(), req.user.companyId, 'unload', name);
    });
  } catch (e) {}

  res.status(201).json({ success: true, id });
});

app.put('/api/permits/:id', authMiddleware, upload.single('permitFile'), (req, res) => {
  const { id } = req.params;
  const { number, routeNumber, startDate, endDate, vehicleId, pointsLoad, pointsUnload, routeDetail, unCodes } = req.body;

  const existing = db.prepare('SELECT * FROM permits WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
  if (!existing) return res.status(404).json({ error: 'Спецразрешение не найдено' });

  let fileName = existing.file_name, filePath = existing.file_path;
  if (req.file) {
    fileName = req.file.originalname;
    filePath = req.file.filename;
  }

  const pLoadJson = pointsLoad ? (typeof pointsLoad === 'string' ? pointsLoad : JSON.stringify(pointsLoad)) : existing.points_load;
  const pUnloadJson = pointsUnload ? (typeof pointsUnload === 'string' ? pointsUnload : JSON.stringify(pointsUnload)) : existing.points_unload;
  const unJson = unCodes ? (typeof unCodes === 'string' ? unCodes : JSON.stringify(unCodes)) : existing.un_codes;

  db.prepare(`
    UPDATE permits 
    SET number = ?, route_number = ?, start_date = ?, end_date = ?, vehicle_id = ?, 
        points_load = ?, points_unload = ?, route_detail = ?, un_codes = ?, file_name = ?, file_path = ?
    WHERE id = ? AND company_id = ?
  `).run(
    number.trim(), parseInt(routeNumber, 10) || 0, startDate, endDate, vehicleId,
    pLoadJson, pUnloadJson, routeDetail ? routeDetail.trim() : null,
    unJson, fileName, filePath, id, req.user.companyId
  );

  res.json({ success: true });
});

app.delete('/api/permits/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM permits WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
  if (result.changes === 0) return res.status(404).json({ error: 'Спецразрешение не найдено' });
  res.json({ success: true });
});

// Получение истории адресов для автодополнения
app.get('/api/locations', authMiddleware, (req, res) => {
  const locations = db.prepare('SELECT DISTINCT type, name FROM location_history WHERE company_id = ?').all(req.user.companyId);
  res.json({ locations });
});

// Скачивание файлов
app.get('/api/files/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (folder !== 'permits' && folder !== 'vehicles') {
    return res.status(400).json({ error: 'Неверная папка' });
  }

  const safeFilename = path.basename(filename);
  const targetPath = path.join(uploadsDir, folder, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  res.download(targetPath);
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DOPOG Online SaaS запущен на порту ${PORT}`);
});