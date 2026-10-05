let authToken = localStorage.getItem('dopog_token');
let currentUser = null;

let appData = {
  routes: [],
  permits: [],
  vehicles: []
};

// Текущие теги в модальных окнах
let currentRouteUnTags = [];
let currentRouteLoadTags = [];
let currentRouteUnloadTags = [];

// Фильтры дашборда
let activeRouteFilter = 'all';
let activePermitFilter = 'all';
let activeVehicleFilter = 'all';

// Сортировка реестра СР
let permitSortField = 'routeNumber';
let permitSortAsc = true;

// Текущий проверенный груз для памятки водителю
let currentEvaluatedCargo = null;

if (!authToken) window.location.href = '/login.html';

// Обертка для API-запросов
async function apiRequest(endpoint, options = {}) {
  const headers = options.headers || {};
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    logoutUser();
    return null;
  }
  return response;
}

function logoutUser() {
  localStorage.removeItem('dopog_token');
  localStorage.removeItem('dopog_user');
  window.location.href = '/login.html';
}

// --- ЛОГИКА ВВОДА ДАТ ПО ПРИНЦИПУ 1С ---
function parseAndFormatDate1C(inputStr) {
  if (!inputStr) return '';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  let val = inputStr.trim().replace(/[\/\s,-]+/g, '.');
  const parts = val.split('.').filter(p => p.length > 0);

  let d = '', m = '', y = '';

  if (parts.length === 1) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = currentMonth;
    y = String(currentYear);
  } else if (parts.length === 2) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = String(parseInt(parts[1], 10)).padStart(2, '0');
    y = String(currentYear);
  } else if (parts.length >= 3) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = String(parseInt(parts[1], 10)).padStart(2, '0');
    let rawY = parseInt(parts[2], 10);
    if (rawY < 100) rawY += 2000;
    y = String(rawY);
  } else {
    return inputStr;
  }

  const testDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isNaN(testDate.getTime())) return inputStr;

  return `${d}.${m}.${y}`;
}

function date1CToIso(str) {
  if (!str) return '';
  if (str.includes('-')) return str;
  const parts = str.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
}

function isoToDate1C(iso) {
  if (!iso) return '';
  if (iso.includes('.')) return iso;
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return iso;
}

function syncDateFromPicker(pickerInput, textInputId) {
  if (pickerInput.value) {
    const [y, m, d] = pickerInput.value.split('-');
    const textInput = document.getElementById(textInputId);
    textInput.value = `${d}.${m}.${y}`;
    textInput.dispatchEvent(new Event('change'));
  }
}

function calculateEndDate(start1CStr) {
  const iso = date1CToIso(start1CStr);
  if (!iso || !iso.includes('-')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const end = new Date(y + 1, m - 1, d);
  end.setDate(end.getDate() - 1);

  const resD = String(end.getDate()).padStart(2, '0');
  const resM = String(end.getMonth() + 1).padStart(2, '0');
  const resY = end.getFullYear();
  return `${resD}.${resM}.${resY}`;
}

// --- МАСКА НОМЕРА СПЕЦРАЗРЕШЕНИЯ ХХ ХХХХХХ/э ---
function applyPermitNumberMask(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 8) val = val.substring(0, 8);

  let formatted = '';
  if (val.length > 0) {
    formatted = val.substring(0, 2);
  }
  if (val.length > 2) {
    formatted += ' ' + val.substring(2, 8);
  }
  if (val.length >= 8) {
    formatted += '/э';
  }
  input.value = formatted;
}

// --- МАСКА ООН (0001, 0012, 1202) ---
function formatUnNumber(raw) {
  const clean = raw.trim().replace(/[^0-9]/g, '');
  if (!clean) return '';
  return clean.padStart(4, '0');
}

// --- РАСЧЕТ СРОКОВ (30 - 15 - 0) ---
function calculateStatus(endDateStr) {
  if (!endDateStr) return { days: 0, status: 'expired', label: 'Не указан', cssClass: 'danger-red' };
  const iso = date1CToIso(endDateStr);
  const end = new Date(iso);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return { days: diffDays, status: 'active', label: `Действует (${diffDays} дн.)`, cssClass: 'active-green' };
  } else if (diffDays >= 15 && diffDays <= 30) {
    return { days: diffDays, status: 'warning', label: `Истекает (${diffDays} дн.)`, cssClass: 'warning-yellow' };
  } else if (diffDays > 0 && diffDays < 15) {
    return { days: diffDays, status: 'critical', label: `Критично (${diffDays} дн.)`, cssClass: 'critical-orange' };
  } else {
    return { days: diffDays, status: 'expired', label: diffDays === 0 ? 'Истекает сегодня!' : `Просрочено (${Math.abs(diffDays)} дн.)`, cssClass: 'danger-red' };
  }
}

// --- ОПОВЕЩЕНИЯ И PUSH ---
function requestPushPermission() {
  if (!('Notification' in window)) return showToast('Браузер не поддерживает Push-уведомления', 'warning');
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      showToast('✓ Уведомления включены', 'success');
      checkAllAlerts();
    }
  });
}

function triggerInstantAlert(title, text, type = 'warning') {
  showToast(`⚠️ ${title}: ${text}`, type);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: text });
  }
}

function checkAllAlerts() {
  appData.permits.forEach(p => {
    const s = calculateStatus(p.end_date);
    if (s.status === 'critical' || s.status === 'expired') {
      triggerInstantAlert('Внимание: ДОПОГ Спецразрешение', `СР № ${p.number} (Маршрут № ${p.routeNumber}): ${s.label}`);
    }
  });

  appData.vehicles.forEach(v => {
    const s = calculateStatus(v.dopog_expiry_date);
    if (s.status === 'critical' || s.status === 'expired') {
      triggerInstantAlert('Внимание: Допуск ТС', `Авто ${v.plate}: допуск ДОПОГ ${s.label}`);
    }
  });

  if (currentUser && currentUser.consultant_cert_end) {
    const s = calculateStatus(currentUser.consultant_cert_end);
    if (s.status === 'critical' || s.status === 'expired') {
      triggerInstantAlert('Свидетельство консультанта ДОПОГ', `Свидетельство консультанта: ${s.label}`);
    }
  }
}

// --- ЗАГРУЗКА ДАННЫХ С СЕРВЕРА ---
async function loadServerData() {
  try {
    const [rRes, pRes, vRes] = await Promise.all([
      apiRequest('/api/routes'),
      apiRequest('/api/permits'),
      apiRequest('/api/vehicles')
    ]);

    if (rRes && rRes.ok) {
      const data = await rRes.json();
      appData.routes = data.routes || [];
    }
    if (pRes && pRes.ok) {
      const data = await pRes.json();
      appData.permits = data.permits || [];
    }
    if (vRes && vRes.ok) {
      const data = await vRes.json();
      appData.vehicles = data.vehicles || [];
    }

    renderAll();
  } catch (err) {
    showToast('Ошибка загрузки данных с сервера', 'error');
  }
}

async function loadUserProfile() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (!res) return;
    const data = await res.json();
    currentUser = data.user;

    document.getElementById('userFullName').textContent = currentUser.full_name || currentUser.email;
    document.getElementById('userCompanyName').textContent = currentUser.company_name || 'Организация';
    document.getElementById('userAvatar').textContent = (currentUser.full_name || 'К')[0].toUpperCase();

    const certBadge = document.getElementById('consultantCertBadge');
    if (currentUser.consultant_cert_number) {
      const s = calculateStatus(currentUser.consultant_cert_end);
      certBadge.innerHTML = `Свид. № ${escapeHtml(currentUser.consultant_cert_number)} (<span style="color:${s.days > 0 ? '#10b981':'#ef4444'}">${s.label}</span>)`;
    } else {
      certBadge.textContent = 'Свидетельство не указано';
    }
  } catch (e) {}
}

// --- ОТРИСОВКА: 1. РЕЕСТР МАРШРУТОВ ---
function getRouteAggregateStatus(route) {
  if (!route.permits || route.permits.length === 0) {
    return { status: 'expired', label: 'Нет спецразрешений', cssClass: 'danger-red' };
  }

  let bestDays = -9999;
  let bestStatus = null;

  route.permits.forEach(p => {
    const s = calculateStatus(p.end_date);
    if (s.days > bestDays) {
      bestDays = s.days;
      bestStatus = s;
    }
  });

  if (bestStatus.status === 'active') {
    return { status: 'active', label: `Обеспечен СР (${bestDays} дн.)`, cssClass: 'active-green' };
  } else if (bestStatus.status === 'warning') {
    return { status: 'warning', label: `СР истекает (${bestDays} дн.)`, cssClass: 'warning-yellow' };
  } else if (bestStatus.status === 'critical') {
    return { status: 'critical', label: `Критично (${bestDays} дн.)`, cssClass: 'critical-orange' };
  } else {
    return { status: 'expired', label: 'СР просрочено', cssClass: 'danger-red' };
  }
}

function renderRoutes() {
  const tbody = document.getElementById('routesTableBody');
  const search = (document.getElementById('routeSearchInput')?.value || '').trim().toLowerCase();
  if (!tbody) return;

  let total = 0, active = 0, warning = 0, critical = 0, expired = 0;
  appData.routes.forEach(r => {
    total++;
    const s = getRouteAggregateStatus(r);
    if (s.status === 'active') active++;
    else if (s.status === 'warning') warning++;
    else if (s.status === 'critical') critical++;
    else if (s.status === 'expired') expired++;
  });

  document.getElementById('statRoutesTotal').textContent = total;
  document.getElementById('statRoutesActive').textContent = active;
  document.getElementById('statRoutesWarning').textContent = warning;
  document.getElementById('statRoutesCritical').textContent = critical;
  document.getElementById('statRoutesExpired').textContent = expired;
  document.getElementById('routesCountBadge').textContent = total;

  const filtered = appData.routes.filter(r => {
    const s = getRouteAggregateStatus(r);
    if (activeRouteFilter !== 'all' && s.status !== activeRouteFilter) return false;

    if (search) {
      const q = `${r.route_number} ${r.name} ${(r.unCodes || []).join(' ')} ${(r.pointsLoad || []).join(' ')} ${(r.pointsUnload || []).join(' ')} ${r.route_detail || ''}`.toLowerCase();
      if (!q.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">🗺️</div><p>Маршрутов не найдено</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const s = getRouteAggregateStatus(r);
    const unPills = (r.unCodes || []).map(u => `<span class="un-pill">ООН ${escapeHtml(u)}</span>`).join('');
    const loadPills = (r.pointsLoad || []).map(p => `<span class="route-badge badge-load">🟢 ${escapeHtml(p)}</span>`).join(' ');
    const unloadPills = (r.pointsUnload || []).map(p => `<span class="route-badge badge-unload">🔵 ${escapeHtml(p)}</span>`).join(' ');

    const permitsCount = r.permits ? r.permits.length : 0;
    const permitsLabel = permitsCount > 0 ? `<span class="brand-badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${permitsCount} СР привязано</span>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Нет СР</span>';

    return `
      <tr>
        <td><span class="status-badge ${s.cssClass}">${s.label}</span></td>
        <td><strong style="font-size:1.05rem;color:var(--primary);">№ ${r.route_number}</strong></td>
        <td>
          <a href="javascript:void(0)" onclick="openRouteDetailModal('${r.id}')" style="font-weight:700;color:var(--text-main);text-decoration:underline;">
            ${escapeHtml(r.name)}
          </a>
        </td>
        <td>${unPills || '—'}</td>
        <td style="max-width:240px;">${loadPills || '—'}</td>
        <td style="max-width:240px;">${unloadPills || '—'}</td>
        <td>
          ${permitsLabel}
          <div style="margin-top:4px;">
            <button class="btn btn-secondary btn-sm" onclick="openAddPermitForRoute('${r.id}')" style="font-size:0.74rem;">+ Выпустить СР</button>
          </div>
        </td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openRouteDetailModal('${r.id}')" title="Карточка маршрута и пакет документов">📋 Маршрут</button>
          <button class="btn btn-secondary btn-sm" onclick="editRoute('${r.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRoute('${r.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openRouteDetailModal(routeId) {
  const r = appData.routes.find(item => item.id === routeId);
  if (!r) return;

  const s = getRouteAggregateStatus(r);
  document.getElementById('routeDetailTitle').textContent = `Маршрут № ${r.route_number}: ${r.name}`;

  const permits = r.permits || [];
  let permitsTableHtml = '';

  if (permits.length === 0) {
    permitsTableHtml = `
      <div style="padding:1.5rem;text-align:center;color:var(--text-muted);background:var(--bg-main);border-radius:8px;">
        К данному маршруту еще не выпущено ни одного спецразрешения.
        <div style="margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="closeModal('routeDetailModal'); openAddPermitForRoute('${r.id}')">
            + Выпустить первое Спецразрешение на автомобиль
          </button>
        </div>
      </div>
    `;
  } else {
    permitsTableHtml = `
      <table style="width:100%;font-size:0.85rem;">
        <thead><tr style="background:#f1f5f9;"><th>Статус</th><th>№ СР</th><th>Автомобиль</th><th>Срок действия</th><th>Файлы</th></tr></thead>
        <tbody>
          ${permits.map(p => {
            const pStat = calculateStatus(p.end_date);
            const files = p.files || [];
            const filesHtml = files.map(f => `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(f.path)}" target="_blank" download="${escapeHtml(f.name)}">📄 ${escapeHtml(f.name)}</a>`).join(' ');
            return `
              <tr>
                <td><span class="status-badge ${pStat.cssClass}">${pStat.label}</span></td>
                <td><strong>${escapeHtml(p.number)}</strong></td>
                <td>${escapeHtml(p.plate)} (${escapeHtml(p.brand)})</td>
                <td>до ${isoToDate1C(p.end_date)}</td>
                <td>${filesHtml || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('routeDetailBody').innerHTML = `
    <div style="background:var(--bg-main);padding:1.25rem;border-radius:8px;border:1px solid var(--border-color);margin-bottom:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span class="status-badge ${s.cssClass}">${s.label}</span>
        <button class="btn btn-secondary btn-sm" onclick="copyPlainRoute('${r.id}')">📋 Скопировать весь маршрут</button>
      </div>

      <div style="margin-bottom:6px;"><strong>Разрешенные ООН:</strong> ${(r.unCodes || []).map(u => `<span class="un-pill">ООН ${escapeHtml(u)}</span>`).join('')}</div>
      <div style="margin-bottom:6px;"><strong>Грузоотправители (погрузка):</strong> ${(r.pointsLoad || []).map(p => `<span class="route-badge badge-load">🟢 ${escapeHtml(p)}</span>`).join(' ')}</div>
      <div style="margin-bottom:6px;"><strong>Грузополучатели (разгрузка):</strong> ${(r.pointsUnload || []).map(p => `<span class="route-badge badge-unload">🔵 ${escapeHtml(p)}</span>`).join(' ')}</div>
      <div><strong>Нитка маршрута:</strong> ${escapeHtml(r.route_detail || 'Не детализирована')}</div>
    </div>

    <!-- Задел под итерацию 3 -->
    <div style="background:#eff6ff;padding:1.25rem;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="font-weight:700;color:#1e40af;margin-bottom:4px;">📦 Подготовка пакета документов в УГАДН</h4>
          <p style="font-size:0.82rem;color:#3b82f6;">Формирование заявления по Приказу Минтранса № 258, рапорта на оплату госпошлины (1 300 ₽) и комплекта допусков ТС по Маршруту № ${r.route_number}</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showToast('Функционал автогенерации бланков запланирован в 3-й итерации', 'info')">
          Сформировать пакет (Итерация 3)
        </button>
      </div>
    </div>

    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h4 style="font-weight:700;">Специальные разрешения, выпущенные для данного маршрута (${permits.length})</h4>
        <button class="btn btn-primary btn-sm" onclick="closeModal('routeDetailModal'); openAddPermitForRoute('${r.id}')">+ Выпустить СР на авто</button>
      </div>
      <div style="border:1px solid var(--border-color);border-radius:6px;overflow:hidden;">
        ${permitsTableHtml}
      </div>
    </div>
  `;

  openModal('routeDetailModal');
}

function copyPlainRoute(routeId) {
  const r = appData.routes.find(item => item.id === routeId);
  if (!r) return;
  const text = `Маршрут № ${r.route_number}: ${(r.pointsLoad || []).join('; ')} -> ${(r.pointsUnload || []).join('; ')}. ${r.route_detail || ''}`;
  copyTextToClipboard(text);
}

function copyPermitRoute(permitId) {
  const p = appData.permits.find(item => item.id === permitId);
  if (!p) return;
  const text = `Маршрут № ${p.routeNumber} (${p.number}): ${(p.pointsLoad || []).join('; ')} -> ${(p.pointsUnload || []).join('; ')}. ${p.route_detail || ''}`;
  copyTextToClipboard(text);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('✓ Текст маршрута скопирован в буфер обмена!', 'success');
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('✓ Текст маршрута скопирован в буфер!', 'success');
}

// --- ОТРИСОВКА: 2. РЕЕСТР СПЕЦРАЗРЕШЕНИЙ (СР) ---
function sortPermits(field) {
  if (permitSortField === field) {
    permitSortAsc = !permitSortAsc;
  } else {
    permitSortField = field;
    permitSortAsc = true;
  }
  renderPermits();
}

function renderPermits() {
  const tbody = document.getElementById('permitsTableBody');
  const search = (document.getElementById('permitSearchInput')?.value || '').trim().toLowerCase();
  if (!tbody) return;

  let total = 0, active = 0, warning = 0, critical = 0, expired = 0;
  appData.permits.forEach(p => {
    total++;
    const s = calculateStatus(p.end_date);
    if (s.status === 'active') active++;
    else if (s.status === 'warning') warning++;
    else if (s.status === 'critical') critical++;
    else if (s.status === 'expired') expired++;
  });

  document.getElementById('statPermitsTotal').textContent = total;
  document.getElementById('statPermitsActive').textContent = active;
  document.getElementById('statPermitsWarning').textContent = warning;
  document.getElementById('statPermitsCritical').textContent = critical;
  document.getElementById('statPermitsExpired').textContent = expired;
  document.getElementById('permitsCountBadge').textContent = total;

  let filtered = appData.permits.filter(p => {
    const s = calculateStatus(p.end_date);
    if (activePermitFilter !== 'all' && s.status !== activePermitFilter) return false;

    if (search) {
      const q = `${p.routeNumber} ${p.number} ${p.plate} ${p.brand} ${p.routeName || ''}`.toLowerCase();
      if (!q.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let valA = a[permitSortField];
    let valB = b[permitSortField];

    if (permitSortField === 'routeNumber') {
      valA = a.routeNumber || 0;
      valB = b.routeNumber || 0;
    } else if (permitSortField === 'vehicle') {
      valA = (a.plate || '').toLowerCase();
      valB = (b.plate || '').toLowerCase();
    } else if (permitSortField === 'endDate') {
      valA = a.end_date;
      valB = b.end_date;
    }

    if (valA < valB) return permitSortAsc ? -1 : 1;
    if (valA > valB) return permitSortAsc ? 1 : -1;
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">📂</div><p>Спецразрешений не найдено</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const s = calculateStatus(p.end_date);
    const files = p.files || [];
    const filesHtml = files.length > 0
      ? files.map(f => `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(f.path)}" target="_blank" download="${escapeHtml(f.name)}">📄 ${escapeHtml(f.name)}</a>`).join(' ')
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    return `
      <tr>
        <td><strong style="color:var(--primary);font-size:1.05rem;">№ ${p.routeNumber}</strong></td>
        <td><strong>${escapeHtml(p.number)}</strong><br><small style="color:var(--text-muted);">выдано: ${isoToDate1C(p.start_date)}</small></td>
        <td><strong>${escapeHtml(p.plate)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(p.brand)}</small></td>
        <td>
          <div style="font-weight:600;font-size:0.85rem;">${escapeHtml(p.routeName || 'Маршрут')}</div>
          <button class="route-copy-btn" onclick="copyPermitRoute('${p.id}')">📋 Скопировать маршрут</button>
        </td>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${isoToDate1C(p.end_date)}</div>
        </td>
        <td style="max-width:200px;">${filesHtml}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="editPermit('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deletePermit('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// --- ОТРИСОВКА: 3. РЕЕСТР АВТОМОБИЛЕЙ ---
function renderVehicles() {
  const tbody = document.getElementById('vehiclesTableBody');
  const search = (document.getElementById('vehicleSearchInput')?.value || '').trim().toLowerCase();
  if (!tbody) return;

  let total = 0, okCount = 0, expCount = 0, expiredCount = 0;
  appData.vehicles.forEach(v => {
    total++;
    const s = calculateStatus(v.dopog_expiry_date);
    if (s.status === 'active') okCount++;
    else if (s.status === 'warning' || s.status === 'critical') expCount++;
    else if (s.status === 'expired') expiredCount++;
  });

  document.getElementById('statVehiclesTotal').textContent = total;
  document.getElementById('statVehiclesOk').textContent = okCount;
  document.getElementById('statVehiclesExpiring').textContent = expCount;
  document.getElementById('statVehiclesExpired').textContent = expiredCount;
  document.getElementById('vehiclesCountBadge').textContent = total;

  const filtered = appData.vehicles.filter(v => {
    const s = calculateStatus(v.dopog_expiry_date);
    if (activeVehicleFilter === 'ok' && s.status !== 'active') return false;
    if (activeVehicleFilter === 'expiring' && s.status !== 'warning' && s.status !== 'critical') return false;
    if (activeVehicleFilter === 'expired' && s.status !== 'expired') return false;

    if (search) {
      const q = `${v.plate} ${v.brand} ${v.sts_number || ''} ${v.dopog_number || ''}`.toLowerCase();
      if (!q.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">🚛</div><p>Автомобилей не найдено</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const s = calculateStatus(v.dopog_expiry_date);
    const activePermitsCount = appData.permits.filter(p => p.vehicle_id === v.id).length;

    let stsHtml = v.sts_number ? `<strong>${escapeHtml(v.sts_number)}</strong>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Не указано</span>';
    if (v.sts_file_path) {
      stsHtml += `<br><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.sts_file_path)}" target="_blank" download="СТС_${escapeHtml(v.plate)}.pdf">📄 СТС</a>`;
    }

    let dopogHtml = v.dopog_number ? `<strong>${escapeHtml(v.dopog_number)}</strong>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Не оформлен</span>';
    if (v.dopog_file_path) {
      dopogHtml += `<br><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.dopog_file_path)}" target="_blank" download="ДОПОГ_${escapeHtml(v.plate)}.pdf">📄 Допуск ДОПОГ</a>`;
    }

    return `
      <tr>
        <td style="min-width:150px;white-space:nowrap;">
          <a href="javascript:void(0)" onclick="openVehicleCard('${v.id}')" style="font-weight:700;color:var(--primary);text-decoration:underline;font-size:1rem;">
            ${escapeHtml(v.plate)}
          </a>
        </td>
        <td><strong>${escapeHtml(v.brand)}</strong></td>
        <td>${stsHtml}</td>
        <td>${dopogHtml}</td>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${isoToDate1C(v.dopog_expiry_date)}</div>
        </td>
        <td><span class="brand-badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${activePermitsCount} СР</span></td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openVehicleCard('${v.id}')">📋 Документы авто</button>
          <button class="btn btn-secondary btn-sm" onclick="editVehicle('${v.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteVehicle('${v.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openVehicleCard(id) {
  const v = appData.vehicles.find(item => item.id === id);
  if (!v) return;

  const s = calculateStatus(v.dopog_expiry_date);
  const linked = appData.permits.filter(p => p.vehicle_id === id);

  document.getElementById('vehicleDetailTitle').textContent = `Автомобиль: ${v.plate} — ${v.brand}`;
  document.getElementById('vehicleDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;background:var(--bg-main);padding:1.25rem;border-radius:8px;border:1px solid var(--border-color);margin-bottom:1.5rem;">
      <div>
        <h4 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Документ СТС</h4>
        <div style="font-size:1.15rem;font-weight:700;margin-bottom:4px;">${escapeHtml(v.plate)}</div>
        <div style="color:#334155;font-weight:600;margin-bottom:6px;">${escapeHtml(v.brand)}</div>
        <div>Номер СТС: <strong>${escapeHtml(v.sts_number || 'Не указан')}</strong></div>
        <div style="margin-top:8px;">
          ${v.sts_file_path ? `<a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.sts_file_path)}" target="_blank" download="СТС_${escapeHtml(v.plate)}.pdf">📄 Скачать файл СТС</a>` : '<span style="color:var(--text-muted);font-size:0.8rem;">Файл СТС не загружен</span>'}
        </div>
      </div>

      <div>
        <h4 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Свидетельство о допуске ДОПОГ</h4>
        <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(v.dopog_number || 'Номер не указан')}</div>
        <div style="margin-bottom:6px;"><span class="status-badge ${s.cssClass}">${s.label}</span></div>
        <div style="font-size:0.85rem;color:var(--text-muted);">Срок окончания действия: <strong>${isoToDate1C(v.dopog_expiry_date)}</strong></div>
        <div style="margin-top:8px;">
          ${v.dopog_file_path ? `<a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.dopog_file_path)}" target="_blank" download="ДОПОГ_${escapeHtml(v.plate)}.pdf">📄 Скачать файл допуска ДОПОГ</a>` : '<span style="color:var(--text-muted);font-size:0.8rem;">Файл допуска не загружен</span>'}
        </div>
      </div>
    </div>

    <div>
      <h4 style="font-weight:700;margin-bottom:8px;">Специальные разрешения автомобиля (${linked.length})</h4>
      <table style="width:100%;font-size:0.85rem;">
        <thead><tr style="background:#f1f5f9;"><th>Статус</th><th>№ Маршрута</th><th>№ СР</th><th>Маршрут</th><th>Срок действия</th></tr></thead>
        <tbody>
          ${linked.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted);">Спецразрешений не привязано</td></tr>' : linked.map(p => {
            const pStat = calculateStatus(p.end_date);
            return `
              <tr>
                <td><span class="status-badge ${pStat.cssClass}">${pStat.label}</span></td>
                <td><strong>№ ${p.routeNumber}</strong></td>
                <td>${escapeHtml(p.number)}</td>
                <td>${escapeHtml(p.routeName || 'Маршрут')}</td>
                <td>до ${isoToDate1C(p.end_date)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  openModal('vehicleDetailModal');
}

// --- УПРАВЛЕНИЕ МАРШРУТАМИ ---
function setupTagInput(containerId, inputId, tagsArray, isUn = false) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;

  function renderTags() {
    container.querySelectorAll('.tag-badge').forEach(b => b.remove());
    tagsArray.forEach((val, idx) => {
      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.innerHTML = `${escapeHtml(isUn ? 'ООН ' + val : val)} <span class="tag-remove">&times;</span>`;
      badge.querySelector('.tag-remove').onclick = () => {
        tagsArray.splice(idx, 1);
        renderTags();
      };
      container.insertBefore(badge, input);
    });
  }

  input.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      let raw = input.value.trim();
      if (!raw) return;
      let finalVal = isUn ? formatUnNumber(raw) : raw;
      if (finalVal && !tagsArray.includes(finalVal)) {
        tagsArray.push(finalVal);
        input.value = '';
        renderTags();
      }
    }
  };

  renderTags();
}

function openAddRouteModal() {
  document.getElementById('routeForm').reset();
  document.getElementById('routeEditId').value = '';
  document.getElementById('routeModalTitle').textContent = 'Новый Маршрут перевозки ДОПОГ';

  currentRouteUnTags = [];
  currentRouteLoadTags = [];
  currentRouteUnloadTags = [];

  setupTagInput('routeUnTagsContainer', 'routeUnTagInput', currentRouteUnTags, true);
  setupTagInput('routeLoadTagsContainer', 'routeLoadTagInput', currentRouteLoadTags);
  setupTagInput('routeUnloadTagsContainer', 'routeUnloadTagInput', currentRouteUnloadTags);

  openModal('routeModal');
}

function editRoute(id) {
  const r = appData.routes.find(item => item.id === id);
  if (!r) return;

  document.getElementById('routeEditId').value = r.id;
  document.getElementById('routeModalTitle').textContent = `Редактирование маршрута № ${r.route_number}`;
  document.getElementById('formRouteNumber').value = r.route_number;
  document.getElementById('formRouteName').value = r.name;
  document.getElementById('formRouteDetail').value = r.route_detail || '';

  currentRouteUnTags = [...(r.unCodes || [])];
  currentRouteLoadTags = [...(r.pointsLoad || [])];
  currentRouteUnloadTags = [...(r.pointsUnload || [])];

  setupTagInput('routeUnTagsContainer', 'routeUnTagInput', currentRouteUnTags, true);
  setupTagInput('routeLoadTagsContainer', 'routeLoadTagInput', currentRouteLoadTags);
  setupTagInput('routeUnloadTagsContainer', 'routeUnloadTagInput', currentRouteUnloadTags);

  openModal('routeModal');
}

async function deleteRoute(id) {
  if (!confirm('Удалить маршрут и все привязанные к нему спецразрешения?')) return;
  const res = await apiRequest(`/api/routes/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Маршрут удален', 'success');
    loadServerData();
  }
}

// --- УПРАВЛЕНИЕ СПЕЦРАЗРЕШЕНИЯМИ ---
function populatePermitModalSelects(selectedRouteId = '', selectedVehicleId = '') {
  const rSel = document.getElementById('permitRouteSelect');
  const vSel = document.getElementById('permitVehicleSelect');

  rSel.innerHTML = '<option value="">-- Выберите маршрут --</option>';
  appData.routes.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `Маршрут № ${r.route_number}: ${r.name}`;
    if (r.id === selectedRouteId) opt.selected = true;
    rSel.appendChild(opt);
  });

  vSel.innerHTML = '<option value="">-- Выберите автомобиль --</option>';
  appData.vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.plate} (${v.brand})`;
    if (v.id === selectedVehicleId) opt.selected = true;
    vSel.appendChild(opt);
  });
}

function openAddPermitModal() {
  document.getElementById('permitForm').reset();
  document.getElementById('permitEditId').value = '';
  document.getElementById('permitModalTitle').textContent = 'Выпуск Специального Разрешения';
  document.getElementById('permitCurrentFilesList').innerHTML = '';
  populatePermitModalSelects();
  openModal('permitModal');
}

function openAddPermitForRoute(routeId) {
  openAddPermitModal();
  populatePermitModalSelects(routeId);
}

function editPermit(id) {
  const p = appData.permits.find(item => item.id === id);
  if (!p) return;

  document.getElementById('permitEditId').value = p.id;
  document.getElementById('permitModalTitle').textContent = `Редактирование СР ${p.number}`;
  populatePermitModalSelects(p.route_id, p.vehicle_id);

  document.getElementById('permitNumber').value = p.number;
  document.getElementById('permitStartDate').value = isoToDate1C(p.start_date);
  document.getElementById('permitEndDate').value = isoToDate1C(p.end_date);

  const files = p.files || [];
  const listEl = document.getElementById('permitCurrentFilesList');
  if (files.length > 0) {
    listEl.innerHTML = files.map(f => `<span class="file-chip">📄 ${escapeHtml(f.name)}</span>`).join(' ');
  } else {
    listEl.innerHTML = '';
  }

  openModal('permitModal');
}

async function deletePermit(id) {
  if (!confirm('Удалить специальное разрешение?')) return;
  const res = await apiRequest(`/api/permits/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Спецразрешение удалено', 'success');
    loadServerData();
  }
}

// --- УПРАВЛЕНИЕ АВТОМОБИЛЯМИ ---
function openAddVehicleModal() {
  document.getElementById('vehicleForm').reset();
  document.getElementById('vehicleEditId').value = '';
  document.getElementById('vehicleModalTitle').textContent = 'Добавить автомобиль';
  document.getElementById('vehicleStsCurrentFile').innerHTML = '';
  document.getElementById('vehicleDopogCurrentFile').innerHTML = '';
  openModal('vehicleModal');
}

function editVehicle(id) {
  const v = appData.vehicles.find(item => item.id === id);
  if (!v) return;

  document.getElementById('vehicleEditId').value = v.id;
  document.getElementById('vehicleModalTitle').textContent = `Редактирование: ${v.plate}`;
  document.getElementById('vehiclePlate').value = v.plate;
  document.getElementById('vehicleBrand').value = v.brand;
  document.getElementById('vehicleStsNumber').value = v.sts_number || '';
  document.getElementById('vehicleDopogNumber').value = v.dopog_number || '';
  document.getElementById('vehicleDopogExpiryDate').value = isoToDate1C(v.dopog_expiry_date);

  const stsCur = document.getElementById('vehicleStsCurrentFile');
  stsCur.innerHTML = v.sts_file_path ? `<span class="file-chip">📄 ${escapeHtml(v.sts_file_name || 'СТС')}</span>` : '';

  const dopCur = document.getElementById('vehicleDopogCurrentFile');
  dopCur.innerHTML = v.dopog_file_path ? `<span class="file-chip">📄 ${escapeHtml(v.dopog_file_name || 'ДОПОГ')}</span>` : '';

  openModal('vehicleModal');
}

async function deleteVehicle(id) {
  const count = appData.permits.filter(p => p.vehicle_id === id).length;
  if (count > 0 && !confirm(`К автомобилю привязано ${count} СР! При удалении авто удалятся и СР. Продолжить?`)) return;
  if (count === 0 && !confirm('Удалить автомобиль?')) return;

  const res = await apiRequest(`/api/vehicles/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Автомобиль удален', 'success');
    loadServerData();
  }
}

// --- ПРОФИЛЬ ОРГАНИЗАЦИИ И КОНСУЛЬТАНТА ---
function openProfileModal() {
  if (!currentUser) return;
  document.getElementById('profCompanyName').value = currentUser.company_name || '';
  document.getElementById('profCompanyInn').value = currentUser.company_inn || '';
  document.getElementById('profFullName').value = currentUser.full_name || '';
  document.getElementById('profCertNum').value = currentUser.consultant_cert_number || '';
  document.getElementById('profCertStart').value = isoToDate1C(currentUser.consultant_cert_start || '');
  document.getElementById('profCertEnd').value = isoToDate1C(currentUser.consultant_cert_end || '');
  openModal('profileModal');
}

// --- ПРОВЕРКА ГРУЗА ПО ООН И ПАМЯТКА ВОДИТЕЛЮ ---
function initCargoChecker() {
  const input = document.getElementById('calcUnInput');
  const dropdown = document.getElementById('calcAutocomplete');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (!val) return dropdown.style.display = 'none';

    const matches = typeof searchDopogGoods === 'function' ? searchDopogGoods(val) : [];
    if (matches.length > 0) {
      dropdown.innerHTML = matches.map(m => `
        <div class="autocomplete-item" onclick="selectCargoUn('${m.un}')">
          <div><strong>ООН ${m.un}</strong>: ${escapeHtml(m.name_ru)}</div>
          <span class="un-pill ${m.is_hcdg ? 'hcdg' : ''}">Класс ${m.class}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCargoCheck();
    }
  });

  document.querySelectorAll('.quick-un-link').forEach(link => {
    link.onclick = () => {
      input.value = link.getAttribute('data-un');
      runCargoCheck();
    };
  });
}

function selectCargoUn(un) {
  document.getElementById('calcUnInput').value = un;
  document.getElementById('calcAutocomplete').style.display = 'none';
  runCargoCheck();
}

function runCargoCheck() {
  const un = document.getElementById('calcUnInput').value.trim();
  const weight = parseFloat(document.getElementById('calcWeightInput').value) || null;
  if (!un) return showToast('Введите номер ООН', 'warning');

  if (typeof evaluatePackageCargo !== 'function') {
    return showToast('База ДОПОГ загружается...', 'warning');
  }

  const res = evaluatePackageCargo(un, weight);
  currentEvaluatedCargo = res;

  document.getElementById('calcEmptyVerdict').style.display = 'none';
  const box = document.getElementById('calcResultBox');
  box.style.display = 'block';
  box.className = 'verdict-box ' + (res.badge_type === 'danger' ? 'danger' : (res.badge_type === 'warning' ? 'warning' : 'success'));

  document.getElementById('verdictTitle').innerHTML = `<span>${res.requires_permit ? '⛔' : '✅'}</span> ${res.status_text}`;
  document.getElementById('verdictGoodName').textContent = `ООН ${res.un} — ${res.name} (Класс: ${res.class}, ГУ: ${res.pg || '-'})`;
  document.getElementById('verdictReason').innerHTML = `<strong>Основание ДОПОГ (упаковки/бочки):</strong> ${escapeHtml(res.reason)}`;
  document.getElementById('verdictNote').innerHTML = `<strong>Памятка:</strong> ${escapeHtml(res.note)}`;

  // Отображаем блок записи для накладной и памятки водителю
  const memoContainer = document.getElementById('driverMemoContainer');
  memoContainer.style.display = 'block';

  document.getElementById('consignmentStringBox').textContent = res.consignmentText;
  document.getElementById('memoEntryText').textContent = res.consignmentText;
  document.getElementById('memoPermitStatus').innerHTML = res.requires_permit 
    ? '<span style="color:#b91c1c;">ОГПО — ТРЕБУЕТСЯ СПЕЦРАЗРЕШЕНИЕ РОСТРАНСНАДЗОРА</span>' 
    : '<span style="color:#15803d;">СТАНДАРТНЫЙ ДОПОГ (Спецразрешение не требуется)</span>';
  document.getElementById('memoTunnelCode').textContent = res.tunnel || 'Без ограничений (E)';

  document.getElementById('memoMarkingText').innerHTML = `
    Упаковки/бочки должны иметь маркировку <strong>UN ${res.un}</strong> и знаки опасности <strong>№ ${(res.labels || [res.class]).join(', ')}</strong>. 
    Транспортное средство маркируется нейтральными оранжевыми табличками спереди и сзади.
  `;
}

function resetCargoCheck() {
  document.getElementById('calcUnInput').value = '';
  document.getElementById('calcWeightInput').value = '';
  document.getElementById('calcEmptyVerdict').style.display = 'block';
  document.getElementById('calcResultBox').style.display = 'none';
  document.getElementById('driverMemoContainer').style.display = 'none';
  currentEvaluatedCargo = null;
}

function createRouteFromCalc() {
  const un = document.getElementById('calcUnInput').value.trim();
  switchTab('tab-routes');
  openAddRouteModal();
  if (un && !currentRouteUnTags.includes(un)) {
    currentRouteUnTags.push(formatUnNumber(un));
    setupTagInput('routeUnTagsContainer', 'routeUnTagInput', currentRouteUnTags, true);
  }
}

function copyConsignmentEntry() {
  if (!currentEvaluatedCargo || !currentEvaluatedCargo.consignmentText) return;
  copyTextToClipboard(currentEvaluatedCargo.consignmentText);
}

function printDriverMemo() {
  if (!currentEvaluatedCargo) {
    return showToast('Сначала выполните проверку груза', 'warning');
  }
  window.print();
}

// --- ФИЛЬТРЫ ДАШБОРДА ---
function setRouteFilter(key) {
  activeRouteFilter = (activeRouteFilter === key && key !== 'all') ? 'all' : key;
  document.querySelectorAll('.filter-btn[data-rfilter]').forEach(b => b.classList.toggle('active', b.getAttribute('data-rfilter') === activeRouteFilter));
  document.querySelectorAll('.stat-card[data-route-filter]').forEach(c => c.classList.toggle('active-filter', c.getAttribute('data-route-filter') === activeRouteFilter));
  renderRoutes();
}

function setPermitFilter(key) {
  activePermitFilter = (activePermitFilter === key && key !== 'all') ? 'all' : key;
  document.querySelectorAll('.filter-btn[data-pfilter]').forEach(b => b.classList.toggle('active', b.getAttribute('data-pfilter') === activePermitFilter));
  document.querySelectorAll('.stat-card[data-permit-filter]').forEach(c => c.classList.toggle('active-filter', c.getAttribute('data-permit-filter') === activePermitFilter));
  renderPermits();
}

function setVehicleFilter(key) {
  activeVehicleFilter = (activeVehicleFilter === key && key !== 'all') ? 'all' : key;
  document.querySelectorAll('.stat-card[data-vehicle-filter]').forEach(c => c.classList.toggle('active-filter', c.getAttribute('data-vehicle-filter') === activeVehicleFilter));
  renderVehicles();
}

// --- ВСПОМОГАТЕЛЬНЫЙ UI ---
function switchTab(id) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === id));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = c.id === id ? 'block' : 'none');
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'))}</span> <span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3800);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderAll() {
  renderRoutes();
  renderPermits();
  renderVehicles();
}

// --- СЛУШАТЕЛИ И ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadServerData();

  // Настройка полей дат в стиле 1С
  document.querySelectorAll('.date-1c').forEach(input => {
    input.addEventListener('blur', () => {
      input.value = parseAndFormatDate1C(input.value);
      input.dispatchEvent(new Event('change'));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.value = parseAndFormatDate1C(input.value);
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Авторасчет срока окончания СР (+1 год - 1 день)
  document.getElementById('permitStartDate').addEventListener('change', (e) => {
    const endDateInput = document.getElementById('permitEndDate');
    if (e.target.value && (!endDateInput.value || document.getElementById('permitEditId').value === '')) {
      endDateInput.value = calculateEndDate(e.target.value);
    }
  });

  // Маска номера СР ХХ ХХХХХХ/э
  document.getElementById('permitNumber').addEventListener('input', (e) => {
    applyPermitNumberMask(e.target);
  });

  // Поиск
  document.getElementById('routeSearchInput')?.addEventListener('input', renderRoutes);
  document.getElementById('permitSearchInput')?.addEventListener('input', renderPermits);
  document.getElementById('vehicleSearchInput')?.addEventListener('input', renderVehicles);

  // Форма Маршрута
  document.getElementById('routeForm').onsubmit = async (e) => {
    e.preventDefault();
    if (currentRouteUnTags.length === 0) return showToast('Укажите хотя бы один номер ООН', 'warning');
    if (currentRouteLoadTags.length === 0) return showToast('Укажите пункт погрузки', 'warning');
    if (currentRouteUnloadTags.length === 0) return showToast('Укажите пункт разгрузки', 'warning');

    const editId = document.getElementById('routeEditId').value;
    const body = {
      routeNumber: document.getElementById('formRouteNumber').value,
      name: document.getElementById('formRouteName').value,
      unCodes: currentRouteUnTags,
      pointsLoad: currentRouteLoadTags,
      pointsUnload: currentRouteUnloadTags,
      routeDetail: document.getElementById('formRouteDetail').value
    };

    const url = editId ? `/api/routes/${editId}` : '/api/routes';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiRequest(url, { method, body: JSON.stringify(body) });

    if (res && res.ok) {
      showToast(editId ? 'Маршрут обновлен' : 'Новый Маршрут сохранен', 'success');
      closeModal('routeModal');
      await loadServerData();
    }
  };

  // Форма СР
  document.getElementById('permitForm').onsubmit = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('permitEditId').value;
    const start1C = document.getElementById('permitStartDate').value;
    const end1C = document.getElementById('permitEndDate').value;

    const startDateIso = date1CToIso(start1C);
    const endDateIso = date1CToIso(end1C);

    const formData = new FormData();
    formData.append('routeId', document.getElementById('permitRouteSelect').value);
    formData.append('vehicleId', document.getElementById('permitVehicleSelect').value);
    formData.append('number', document.getElementById('permitNumber').value);
    formData.append('startDate', startDateIso);
    formData.append('endDate', endDateIso);

    const filesInput = document.getElementById('permitFilesInput');
    if (filesInput.files.length > 0) {
      for (let i = 0; i < filesInput.files.length; i++) {
        formData.append('permitFiles', filesInput.files[i]);
      }
    }

    const url = editId ? `/api/permits/${editId}` : '/api/permits';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiRequest(url, { method, body: formData });

    if (res && res.ok) {
      showToast(editId ? 'СР обновлено' : 'Специальное разрешение выпущено!', 'success');
      closeModal('permitModal');

      const s = calculateStatus(endDateIso);
      if (s.status === 'critical' || s.status === 'expired') {
        triggerInstantAlert('Внимание: Срок СР', `Выпущено СР ${document.getElementById('permitNumber').value}: ${s.label}!`, 'error');
      } else if (s.status === 'warning') {
        triggerInstantAlert('Внимание: Срок СР', `Выпущено СР со сроком окончания менее 30 дней!`, 'warning');
      }

      await loadServerData();
    }
  };

  // Форма ТС
  document.getElementById('vehicleForm').onsubmit = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('vehicleEditId').value;
    const expiryIso = date1CToIso(document.getElementById('vehicleDopogExpiryDate').value);

    const formData = new FormData();
    formData.append('plate', document.getElementById('vehiclePlate').value);
    formData.append('brand', document.getElementById('vehicleBrand').value);
    formData.append('stsNumber', document.getElementById('vehicleStsNumber').value);
    formData.append('dopogNumber', document.getElementById('vehicleDopogNumber').value);
    formData.append('dopogExpiryDate', expiryIso);

    const stsFile = document.getElementById('vehicleStsFile');
    const dopogFile = document.getElementById('vehicleDopogFile');
    if (stsFile.files.length > 0) formData.append('stsFile', stsFile.files[0]);
    if (dopogFile.files.length > 0) formData.append('dopogFile', dopogFile.files[0]);

    const url = editId ? `/api/vehicles/${editId}` : '/api/vehicles';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiRequest(url, { method, body: formData });

    if (res && res.ok) {
      showToast('Автомобиль сохранен в реестр', 'success');
      closeModal('vehicleModal');

      const s = calculateStatus(expiryIso);
      if (s.status === 'critical' || s.status === 'expired') {
        triggerInstantAlert('Внимание: Допуск авто ДОПОГ', `У авто ${document.getElementById('vehiclePlate').value} допуск: ${s.label}!`, 'error');
      }

      await loadServerData();
    }
  };

  // Форма Профиля
  document.getElementById('profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const startIso = date1CToIso(document.getElementById('profCertStart').value);
    const endIso = date1CToIso(document.getElementById('profCertEnd').value);

    const body = {
      companyName: document.getElementById('profCompanyName').value,
      companyInn: document.getElementById('profCompanyInn').value,
      fullName: document.getElementById('profFullName').value,
      consultantCertNumber: document.getElementById('profCertNum').value,
      consultantCertStart: startIso,
      consultantCertEnd: endIso
    };

    const res = await apiRequest('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (res && res.ok) {
      showToast('Данные профиля и организации сохранены', 'success');
      closeModal('profileModal');
      await loadUserProfile();
    }
  };

  initCargoChecker();
});