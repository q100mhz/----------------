let authToken = localStorage.getItem('dopog_token');
let currentUser = null;

let appData = {
  vehicles: [],
  permits: [],
  locations: []
};

let currentUnTags = [];
let currentLoadTags = [];
let currentUnloadTags = [];

let activePermitFilter = 'all';
let activeVehicleFilter = 'all';

if (!authToken) window.location.href = '/login.html';

// API обертка с токеном
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

// Формула даты окончания: +1 год - 1 день
function calculatePermitEndDate(startDateStr) {
  if (!startDateStr) return '';
  const [year, month, day] = startDateStr.split('-').map(Number);
  // Добавляем 1 календарный год
  const end = new Date(year + 1, month - 1, day);
  // Вычитаем 1 день
  end.setDate(end.getDate() - 1);

  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function handleStartDateChange(val) {
  const endInput = document.getElementById('permitEndDate');
  if (val && endInput) {
    endInput.value = calculatePermitEndDate(val);
  }
}

// Загрузка профиля консультанта
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
      const stat = calculateStatus(currentUser.consultant_cert_end);
      certBadge.innerHTML = `Свид. № ${escapeHtml(currentUser.consultant_cert_number)} (<span style="color:${stat.days > 0 ? '#10b981':'#ef4444'}">${stat.label}</span>)`;
    } else {
      certBadge.textContent = 'Свидетельство не указано';
    }
  } catch (e) {}
}

function logoutUser() {
  localStorage.removeItem('dopog_token');
  localStorage.removeItem('dopog_user');
  window.location.href = '/login.html';
}

// Загрузка данных с сервера
async function loadServerData() {
  try {
    const [vRes, pRes, lRes] = await Promise.all([
      apiRequest('/api/vehicles'),
      apiRequest('/api/permits'),
      apiRequest('/api/locations')
    ]);

    if (vRes && vRes.ok) {
      const v = await vRes.json();
      appData.vehicles = v.vehicles.map(item => ({
        id: item.id,
        plate: item.plate,
        brand: item.brand,
        stsNumber: item.sts_number,
        stsFileName: item.sts_file_name,
        stsFilePath: item.sts_file_path,
        dopogNumber: item.dopog_number,
        dopogIssueDate: item.dopog_issue_date,
        dopogExpiryDate: item.dopog_expiry_date,
        dopogFileName: item.dopog_file_name,
        dopogFilePath: item.dopog_file_path
      }));
    }

    if (pRes && pRes.ok) {
      const p = await pRes.json();
      appData.permits = p.permits;
    }

    if (lRes && lRes.ok) {
      const l = await lRes.json();
      appData.locations = l.locations || [];
      populateLocationDatalists();
    }

    renderAll();
    checkExpiringForPush();
  } catch (err) {
    showToast('Ошибка загрузки данных', 'error');
  }
}

// Заполнение datalist для подсказок адресов
function populateLocationDatalists() {
  const loadDl = document.getElementById('loadLocationsDatalist');
  const unloadDl = document.getElementById('unloadLocationsDatalist');
  if (loadDl) loadDl.innerHTML = '';
  if (unloadDl) unloadDl.innerHTML = '';

  appData.locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.name;
    if (loc.type === 'load' && loadDl) loadDl.appendChild(opt);
    if (loc.type === 'unload' && unloadDl) unloadDl.appendChild(opt);
  });
}

// Расчет статусов и сроков (30 - 15 - 0)
function calculateStatus(endDateStr) {
  if (!endDateStr) return { days: 0, status: 'expired', label: 'Не указан', cssClass: 'danger-red' };
  const end = new Date(endDateStr);
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

// Форматирование маршрута: города - жирным, точки - бейджами
function formatRouteHtml(rawText) {
  if (!rawText) return '<span style="color:var(--text-muted);">Маршрут не детализирован</span>';
  let text = escapeHtml(rawText);

  text = text.replace(/\[?\b(погрузка|отгрузка|загрузка|пункт погрузки)[\s:]+([^,;\]\n\->]+)\]?/gi, '<span class="route-badge badge-load">🟢 $1: $2</span>');
  text = text.replace(/\[?\b(разгрузка|выгрузка|слив|пункт разгрузки)[\s:]+([^,;\]\n\->]+)\]?/gi, '<span class="route-badge badge-unload">🔵 $1: $2</span>');
  text = text.replace(/\b((?:г\.|город|пос\.|пгт\.|дер\.|с\.)\s*[А-Яа-яЁёA-Za-z0-9\-]+)/gi, '<strong class="route-city">$1</strong>');

  const majorCities = ['Москва', 'Санкт-Петербург', 'Нижний Новгород', 'Казань', 'Самара', 'Екатеринбург', 'Уфа', 'Пермь', 'Челябинск', 'Омск', 'Ростов-на-Дону', 'Краснодар', 'Воронеж', 'Волгоград', 'Саратов', 'Тюмень', 'Тольятти', 'Владимир', 'Дзержинск', 'Рязань', 'Набережные Челны', 'Елабуга', 'Коломна', 'Воскресенск'];
  majorCities.forEach(c => {
    if (text.indexOf(c) !== -1) {
      const reg = new RegExp('(^|[^>А-Яа-яЁё0-9])(' + c + ')(?![А-Яа-яЁё0-9<])', 'g');
      text = text.replace(reg, '$1<strong class="route-city">$2</strong>');
    }
  });

  return text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Копирование чистого маршрута в буфер
function copyRouteText(textToCopy) {
  if (!textToCopy) return;
  const decoded = textToCopy.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  navigator.clipboard.writeText(decoded).then(() => {
    showToast('✓ Маршрут скопирован как обычный текст!', 'success');
  }).catch(() => {
    const t = document.createElement('textarea');
    t.value = decoded;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    showToast('✓ Маршрут скопирован в буфер!', 'success');
  });
}

// Быстрый фильтр реестра по дашборду
function setPermitFilter(filterKey) {
  activePermitFilter = (activePermitFilter === filterKey && filterKey !== 'all') ? 'all' : filterKey;

  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === activePermitFilter));
  document.querySelectorAll('.stat-card[data-permit-filter]').forEach(c => c.classList.toggle('active-filter', c.getAttribute('data-permit-filter') === activePermitFilter));
  renderPermits();
}

function setVehicleFilter(filterKey) {
  activeVehicleFilter = (activeVehicleFilter === filterKey && filterKey !== 'all') ? 'all' : filterKey;

  document.querySelectorAll('.stat-card[data-vehicle-filter]').forEach(c => c.classList.toggle('active-filter', c.getAttribute('data-vehicle-filter') === activeVehicleFilter));
  renderVehicles();
}

// Управление тегами (ООН, Погрузка, Разгрузка)
function setupTagInput(containerId, inputId, tagsArray) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;

  function renderTags() {
    container.querySelectorAll('.tag-badge').forEach(b => b.remove());
    tagsArray.forEach((val, idx) => {
      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.innerHTML = `${escapeHtml(val)} <span class="tag-remove">&times;</span>`;
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
      const clean = input.value.trim().replace(/^ООН\s*/i, '');
      if (clean && !tagsArray.includes(clean)) {
        tagsArray.push(clean);
        input.value = '';
        renderTags();
      }
    }
  };

  renderTags();
}

// Отрисовка реестра СР
function renderPermits() {
  const tbody = document.getElementById('permitsTableBody');
  const search = (document.getElementById('permitSearchInput')?.value || '').trim().toLowerCase();
  if (!tbody) return;

  let total = 0, active = 0, warning = 0, critical = 0, expired = 0;
  appData.permits.forEach(p => {
    const s = calculateStatus(p.endDate);
    total++;
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

  const filtered = appData.permits.filter(p => {
    const s = calculateStatus(p.endDate);
    if (activePermitFilter !== 'all' && s.status !== activePermitFilter) return false;

    if (search) {
      const v = appData.vehicles.find(item => item.id === p.vehicle_id);
      const str = `${p.number} ${p.routeNumber} ${(p.unCodes || []).join(' ')} ${(p.pointsLoad || []).join(' ')} ${(p.pointsUnload || []).join(' ')} ${p.routeDetail || ''} ${v ? v.plate + ' ' + v.brand : ''}`.toLowerCase();
      if (!str.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-icon">📂</div><p>Специальных разрешений не найдено</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const s = calculateStatus(p.endDate);
    const v = appData.vehicles.find(item => item.id === p.vehicle_id);
    const vLabel = v ? `<strong>${escapeHtml(v.plate)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(v.brand)}</small>` : '—';
    const unPills = (p.unCodes || []).map(c => `<span class="un-pill">ООН ${escapeHtml(c)}</span>`).join('');
    
    const loadBadges = (p.pointsLoad || []).map(l => `<span class="route-badge badge-load">🟢 ${escapeHtml(l)}</span>`).join(' ');
    const unloadBadges = (p.pointsUnload || []).map(u => `<span class="route-badge badge-unload">🔵 ${escapeHtml(u)}</span>`).join(' ');

    const plainTextRoute = `${(p.pointsLoad || []).join('; ')} -> ${(p.pointsUnload || []).join('; ')}. ${p.routeDetail || ''}`;
    const cleanPlainForCopy = escapeHtml(plainTextRoute).replace(/'/g, "\\'");

    let fileLink = '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';
    if (p.filePath) {
      fileLink = `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(p.filePath)}" target="_blank" download="${escapeHtml(p.fileName || 'permit.pdf')}">📄 ${escapeHtml(p.fileName || 'Скан')}</a>`;
    }

    return `
      <tr>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${escapeHtml(p.endDate)}</div>
        </td>
        <td><span class="brand-badge" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:0.85rem;">№ ${escapeHtml(p.routeNumber)}</span></td>
        <td><strong>${escapeHtml(p.number)}</strong><br><small style="color:var(--text-muted);">с ${escapeHtml(p.startDate)}</small></td>
        <td>${vLabel}</td>
        <td style="max-width:160px;">${unPills || '—'}</td>
        <td style="max-width:260px;">
          <div>${loadBadges}</div>
          <div style="margin-top:2px;">${unloadBadges}</div>
        </td>
        <td style="max-width:320px;">
          <div class="route-cell-content">
            <div>${formatRouteHtml(p.routeDetail)}</div>
            <button class="route-copy-btn" onclick="copyRouteText('${cleanPlainForCopy}')">📋 Скопировать маршрут</button>
          </div>
        </td>
        <td>${fileLink}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="editPermit('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deletePermit('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Отрисовка автопарка
function renderVehicles() {
  const tbody = document.getElementById('vehiclesTableBody');
  const search = (document.getElementById('vehicleSearchInput')?.value || '').trim().toLowerCase();
  if (!tbody) return;

  let total = 0, okCount = 0, expCount = 0, expiredCount = 0;
  appData.vehicles.forEach(v => {
    total++;
    const s = calculateStatus(v.dopogExpiryDate);
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
    const s = calculateStatus(v.dopogExpiryDate);
    if (activeVehicleFilter === 'ok' && s.status !== 'active') return false;
    if (activeVehicleFilter === 'expiring' && s.status !== 'warning' && s.status !== 'critical') return false;
    if (activeVehicleFilter === 'expired' && s.status !== 'expired') return false;

    if (search) {
      const q = `${v.plate} ${v.brand} ${v.stsNumber || ''} ${v.dopogNumber || ''}`.toLowerCase();
      if (!q.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">🚛</div><p>Автомобилей не найдено</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const s = calculateStatus(v.dopogExpiryDate);
    const count = appData.permits.filter(p => p.vehicle_id === v.id).length;

    let stsHtml = v.stsNumber ? `<strong>${escapeHtml(v.stsNumber)}</strong>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Не указано</span>';
    if (v.stsFilePath) {
      stsHtml += `<br><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.stsFilePath)}" target="_blank" download="${escapeHtml(v.stsFileName || 'sts.pdf')}">📄 ${escapeHtml(v.stsFileName || 'СТС')}</a>`;
    }

    let dopogHtml = v.dopogNumber ? `<strong>${escapeHtml(v.dopogNumber)}</strong>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Не оформлен</span>';
    if (v.dopogFilePath) {
      dopogHtml += `<br><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.dopogFilePath)}" target="_blank" download="${escapeHtml(v.dopogFileName || 'dopog.pdf')}">📄 ${escapeHtml(v.dopogFileName || 'ДОПОГ')}</a>`;
    }

    return `
      <tr>
        <td>
          <a href="javascript:void(0)" onclick="openVehicleCard('${v.id}')" style="font-weight:700;color:var(--primary);text-decoration:underline;">
            ${escapeHtml(v.plate)}
          </a>
        </td>
        <td><strong>${escapeHtml(v.brand)}</strong></td>
        <td>${stsHtml}</td>
        <td>${dopogHtml}</td>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${escapeHtml(v.dopogExpiryDate)}</div>
        </td>
        <td><span class="brand-badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${count} СР</span></td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openVehicleCard('${v.id}')">📋 Досье</button>
          <button class="btn btn-secondary btn-sm" onclick="editVehicle('${v.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteVehicle('${v.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Карточка ТС с привязанными СР
function openVehicleCard(id) {
  const v = appData.vehicles.find(item => item.id === id);
  if (!v) return;

  const linked = appData.permits.filter(p => p.vehicle_id === id);
  const s = calculateStatus(v.dopogExpiryDate);

  document.getElementById('vehicleDetailTitle').textContent = `Автомобиль: ${v.plate} — ${v.brand}`;
  document.getElementById('vehicleDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem;background:var(--bg-main);padding:1rem;border-radius:8px;">
      <div>
        <h4 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Данные ТС и СТС</h4>
        <div style="font-size:1.15rem;font-weight:700;">${escapeHtml(v.plate)}</div>
        <div style="color:#334155;font-weight:600;margin-bottom:6px;">${escapeHtml(v.brand)}</div>
        <div>СТС: <strong>${escapeHtml(v.stsNumber || 'Не указан')}</strong></div>
        ${v.stsFilePath ? `<div style="margin-top:4px;"><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.stsFilePath)}" target="_blank" download="${escapeHtml(v.stsFileName || 'sts.pdf')}">📄 Скачать скан СТС</a></div>` : ''}
      </div>
      <div>
        <h4 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Свидетельство о допуске ДОПОГ</h4>
        <div><strong>${escapeHtml(v.dopogNumber || 'Номер не указан')}</strong></div>
        <div style="margin:4px 0;"><span class="status-badge ${s.cssClass}">${s.label}</span></div>
        <div style="font-size:0.85rem;color:var(--text-muted);">Срок действия до: <strong>${escapeHtml(v.dopogExpiryDate)}</strong></div>
        ${v.dopogFilePath ? `<div style="margin-top:4px;"><a class="file-chip" href="/api/files/vehicles/${encodeURIComponent(v.dopogFilePath)}" target="_blank" download="${escapeHtml(v.dopogFileName || 'dopog.pdf')}">📄 Скачать допуск ДОПОГ</a></div>` : ''}
      </div>
    </div>
    <div>
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:8px;">Специальные разрешения, закрепленные за автомобилем (${linked.length})</h3>
      <table style="width:100%;font-size:0.85rem;">
        <thead><tr style="background:#f1f5f9;"><th>Статус</th><th>№ Маршрута</th><th>№ СР</th><th>Номера ООН</th><th>Срок до</th></tr></thead>
        <tbody>
          ${linked.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted);">Спецразрешений не закреплено</td></tr>' : linked.map(p => {
            const stat = calculateStatus(p.endDate);
            return `<tr>
              <td><span class="status-badge ${stat.cssClass}">${stat.label}</span></td>
              <td><strong>№ ${escapeHtml(p.routeNumber)}</strong></td>
              <td>${escapeHtml(p.number)}</td>
              <td>${(p.unCodes || []).map(c => `<span class="un-pill">ООН ${escapeHtml(c)}</span>`).join('')}</td>
              <td>${escapeHtml(p.endDate)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  openModal('vehicleDetailModal');
}

// Заполнение выпадающего списка автомобилей для формы СР
function populateVehicleSelect(selectedId = '') {
  const sel = document.getElementById('permitVehicleSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Выберите автомобиль --</option>';
  appData.vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.plate} (${v.brand})`;
    if (v.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Операции со спецразрешениями
function openAddPermitModal() {
  document.getElementById('permitForm').reset();
  document.getElementById('permitEditId').value = '';
  document.getElementById('permitModalTitle').textContent = 'Новое специальное разрешение';
  document.getElementById('permitCurrentFileInfo').style.display = 'none';

  currentUnTags = [];
  currentLoadTags = [];
  currentUnloadTags = [];

  setupTagInput('unTagsContainer', 'unTagInput', currentUnTags);
  setupTagInput('loadTagsContainer', 'loadTagInput', currentLoadTags);
  setupTagInput('unloadTagsContainer', 'unloadTagInput', currentUnloadTags);

  populateVehicleSelect();
  openModal('permitModal');
}

function editPermit(id) {
  const p = appData.permits.find(item => item.id === id);
  if (!p) return;

  document.getElementById('permitEditId').value = p.id;
  document.getElementById('permitModalTitle').textContent = `Редактирование СР № ${p.number}`;
  document.getElementById('permitRouteNumber').value = p.routeNumber;
  document.getElementById('permitNumber').value = p.number;
  document.getElementById('permitStartDate').value = p.startDate;
  document.getElementById('permitEndDate').value = p.endDate;
  document.getElementById('permitRouteDetail').value = p.routeDetail || '';

  populateVehicleSelect(p.vehicle_id);

  currentUnTags = [...(p.unCodes || [])];
  currentLoadTags = [...(p.pointsLoad || [])];
  currentUnloadTags = [...(p.pointsUnload || [])];

  setupTagInput('unTagsContainer', 'unTagInput', currentUnTags);
  setupTagInput('loadTagsContainer', 'loadTagInput', currentLoadTags);
  setupTagInput('unloadTagsContainer', 'unloadTagInput', currentUnloadTags);

  const fInfo = document.getElementById('permitCurrentFileInfo');
  if (p.fileName) {
    fInfo.style.display = 'block';
    fInfo.innerHTML = `<small style="color:var(--text-muted);">Прикреплен файл: <strong>${escapeHtml(p.fileName)}</strong></small>`;
  } else fInfo.style.display = 'none';

  openModal('permitModal');
}

async function deletePermit(id) {
  if (!confirm('Вы уверены, что хотите удалить Спецразрешение?')) return;
  const res = await apiRequest('/api/permits/' + id, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Спецразрешение удалено', 'success');
    loadServerData();
  }
}

// Операции с автомобилями
function openAddVehicleModal() {
  document.getElementById('vehicleForm').reset();
  document.getElementById('vehicleEditId').value = '';
  document.getElementById('vehicleModalTitle').textContent = 'Добавить автомобиль';
  document.getElementById('vehicleStsFileCurrent').style.display = 'none';
  document.getElementById('vehicleDopogFileCurrent').style.display = 'none';
  openModal('vehicleModal');
}

function editVehicle(id) {
  const v = appData.vehicles.find(item => item.id === id);
  if (!v) return;

  document.getElementById('vehicleEditId').value = v.id;
  document.getElementById('vehicleModalTitle').textContent = `Редактирование: ${v.plate}`;
  document.getElementById('vehiclePlate').value = v.plate;
  document.getElementById('vehicleBrand').value = v.brand;
  document.getElementById('vehicleStsNumber').value = v.stsNumber || '';
  document.getElementById('vehicleDopogNumber').value = v.dopogNumber || '';
  document.getElementById('vehicleDopogIssueDate').value = v.dopogIssueDate || '';
  document.getElementById('vehicleDopogExpiryDate').value = v.dopogExpiryDate || '';

  const stsCur = document.getElementById('vehicleStsFileCurrent');
  if (v.stsFileName) {
    stsCur.style.display = 'block';
    stsCur.innerHTML = `<small style="color:var(--text-muted);">Файл: <strong>${escapeHtml(v.stsFileName)}</strong></small>`;
  } else stsCur.style.display = 'none';

  const dopogCur = document.getElementById('vehicleDopogFileCurrent');
  if (v.dopogFileName) {
    dopogCur.style.display = 'block';
    dopogCur.innerHTML = `<small style="color:var(--text-muted);">Файл: <strong>${escapeHtml(v.dopogFileName)}</strong></small>`;
  } else dopogCur.style.display = 'none';

  openModal('vehicleModal');
}

async function deleteVehicle(id) {
  const count = appData.permits.filter(p => p.vehicle_id === id).length;
  if (count > 0 && !confirm(`К автомобилю привязано ${count} СР! Удалить?`)) return;
  if (count === 0 && !confirm('Удалить автомобиль?')) return;

  const res = await apiRequest('/api/vehicles/' + id, { method: 'DELETE' });
  if (res && res.ok) {
    showToast('Автомобиль удален', 'success');
    loadServerData();
  }
}

// Профиль консультанта
function openConsultantModal() {
  if (!currentUser) return;
  document.getElementById('profFullName').value = currentUser.full_name || '';
  document.getElementById('profCertNum').value = currentUser.consultant_cert_number || '';
  document.getElementById('profCertStart').value = currentUser.consultant_cert_start || '';
  document.getElementById('profCertEnd').value = currentUser.consultant_cert_end || '';
  openModal('consultantModal');
}

// Push-уведомления
function requestPushPermission() {
  if (!('Notification' in window)) return showToast('Браузер не поддерживает Push-уведомления', 'warning');
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      showToast('✓ Браузерные уведомления включены', 'success');
      checkExpiringForPush();
    }
  });
}

function checkExpiringForPush() {
  if (Notification.permission !== 'granted') return;
  const criticalPermits = appData.permits.filter(p => {
    const s = calculateStatus(p.endDate);
    return s.status === 'critical' || s.status === 'expired';
  });

  if (criticalPermits.length > 0) {
    new Notification('Внимание: ДОПОГ Спецразрешения!', {
      body: `Внимание! У вас ${criticalPermits.length} спецразрешений в критичном или просроченном статусе!`,
      icon: '/favicon.ico'
    });
  }
}

// Экспресс-проверка ООН
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
        <div class="autocomplete-item" data-un="${m.un}">
          <div><strong>ООН ${m.un}</strong>: ${escapeHtml(m.name_ru)}</div>
          <span class="un-pill ${m.is_hcdg_package ? 'hcdg' : ''}">Класс ${m.class}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.onclick = () => {
          input.value = item.getAttribute('data-un');
          dropdown.style.display = 'none';
          runCargoCheck();
        };
      });
    } else dropdown.style.display = 'none';
  });

  document.querySelectorAll('.quick-un-link').forEach(l => {
    l.onclick = () => {
      input.value = l.getAttribute('data-un');
      runCargoCheck();
    };
  });

  document.getElementById('btnCreatePermitFromCalc').onclick = () => {
    const un = input.value.trim();
    switchTab('tab-permits');
    openAddPermitModal();
    if (un && !currentUnTags.includes(un)) {
      currentUnTags.push(un);
      setupTagInput('unTagsContainer', 'unTagInput', currentUnTags);
    }
  };
}

function runCargoCheck() {
  const un = document.getElementById('calcUnInput').value.trim();
  const weight = parseFloat(document.getElementById('calcWeightInput').value) || null;
  if (!un) return showToast('Введите номер ООН', 'warning');

  const res = evaluatePackageCargo(un, weight);
  document.getElementById('calcEmptyVerdict').style.display = 'none';
  const box = document.getElementById('calcResultBox');
  box.style.display = 'block';
  box.className = 'verdict-box ' + (res.badge_type === 'danger' ? 'danger' : (res.badge_type === 'warning' ? 'warning' : 'success'));

  document.getElementById('verdictTitle').innerHTML = `<span>${res.requires_permit ? '⛔' : '✅'}</span> ${res.status_text}`;
  document.getElementById('verdictGoodName').textContent = `ООН ${res.un} — ${res.name} (Класс ${res.class}, Группа упаковки: ${res.pg})`;
  document.getElementById('verdictReason').innerHTML = `<strong>Основание ДОПОГ:</strong> ${escapeHtml(res.reason)}`;
  document.getElementById('verdictNote').innerHTML = `<strong>Памятка:</strong> ${escapeHtml(res.note)}`;
}

function resetCargoCheck() {
  document.getElementById('calcUnInput').value = '';
  document.getElementById('calcWeightInput').value = '';
  document.getElementById('calcEmptyVerdict').style.display = 'block';
  document.getElementById('calcResultBox').style.display = 'none';
}

// Вспомогательные функции UI
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = c.id === tabId ? 'block' : 'none');
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span> <span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function renderAll() {
  renderPermits();
  renderVehicles();
}

// Инициализация событий при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadServerData();

  // Поиск
  document.getElementById('permitSearchInput')?.addEventListener('input', renderPermits);
  document.getElementById('vehicleSearchInput')?.addEventListener('input', renderVehicles);

  // Сабмит формы СР
  document.getElementById('permitForm').onsubmit = async (e) => {
    e.preventDefault();
    if (currentUnTags.length === 0) return showToast('Укажите хотя бы один номер ООН', 'warning');
    if (currentLoadTags.length === 0) return showToast('Укажите пункт погрузки', 'warning');
    if (currentUnloadTags.length === 0) return showToast('Укажите пункт разгрузки', 'warning');

    const editId = document.getElementById('permitEditId').value;
    const formData = new FormData();
    formData.append('routeNumber', document.getElementById('permitRouteNumber').value);
    formData.append('number', document.getElementById('permitNumber').value);
    formData.append('startDate', document.getElementById('permitStartDate').value);
    formData.append('endDate', document.getElementById('permitEndDate').value);
    formData.append('vehicleId', document.getElementById('permitVehicleSelect').value);
    formData.append('unCodes', JSON.stringify(currentUnTags));
    formData.append('pointsLoad', JSON.stringify(currentLoadTags));
    formData.append('pointsUnload', JSON.stringify(currentUnloadTags));
    formData.append('routeDetail', document.getElementById('permitRouteDetail').value);

    const fileInput = document.getElementById('permitFileInput');
    if (fileInput.files.length > 0) formData.append('permitFile', fileInput.files[0]);

    const url = editId ? `/api/permits/${editId}` : '/api/permits';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiRequest(url, { method, body: formData });
    if (res && res.ok) {
      showToast(editId ? 'СР обновлено' : 'Новое СР сохранено', 'success');
      closeModal('permitModal');
      loadServerData();
    }
  };

  // Сабмит формы ТС
  document.getElementById('vehicleForm').onsubmit = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('vehicleEditId').value;
    const formData = new FormData();
    formData.append('plate', document.getElementById('vehiclePlate').value);
    formData.append('brand', document.getElementById('vehicleBrand').value);
    formData.append('stsNumber', document.getElementById('vehicleStsNumber').value);
    formData.append('dopogNumber', document.getElementById('vehicleDopogNumber').value);
    formData.append('dopogIssueDate', document.getElementById('vehicleDopogIssueDate').value);
    formData.append('dopogExpiryDate', document.getElementById('vehicleDopogExpiryDate').value);

    const stsFile = document.getElementById('vehicleStsFile');
    const dopogFile = document.getElementById('vehicleDopogFile');
    if (stsFile.files.length > 0) formData.append('stsFile', stsFile.files[0]);
    if (dopogFile.files.length > 0) formData.append('dopogFile', dopogFile.files[0]);

    const url = editId ? `/api/vehicles/${editId}` : '/api/vehicles';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiRequest(url, { method, body: formData });
    if (res && res.ok) {
      showToast('Автомобиль сохранен', 'success');
      closeModal('vehicleModal');
      loadServerData();
    }
  };

  // Сабмит профиля консультанта
  document.getElementById('consultantForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      fullName: document.getElementById('profFullName').value,
      consultantCertNumber: document.getElementById('profCertNum').value,
      consultantCertStart: document.getElementById('profCertStart').value,
      consultantCertEnd: document.getElementById('profCertEnd').value
    };
    const res = await apiRequest('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (res && res.ok) {
      showToast('Профиль консультанта сохранен', 'success');
      closeModal('consultantModal');
      loadUserProfile();
    }
  };

  initCargoChecker();
});