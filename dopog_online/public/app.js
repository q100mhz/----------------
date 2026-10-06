let authToken = localStorage.getItem('dopog_token');
let currentUser = null;

let appData = {
  routes: [],
  permits: [],
  vehicles: [],
  showingArchivedRoutes: false
};

let currentRouteUnTags = [];
let currentRouteLoadTags = [];
let currentRouteUnloadTags = [];

let activeRouteFilter = 'all';
let activePermitFilter = 'all';
let activeVehicleFilter = 'all';

let permitSortField = 'routeNumber';
let permitSortAsc = true;

// Отслеживание изменений форм для подтверждения закрытия
const formSnapshots = new Map();

if (!authToken) window.location.href = '/login.html';

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

// --- УМНОЕ ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН С ПРОВЕРКОЙ ИЗМЕНЕНИЙ (ПУНКТ 3) ---
function takeFormSnapshot(modalId) {
  const modal = document.getElementById(modalId);
  const form = modal.querySelector('form');
  if (form) {
    const data = new FormData(form);
    const serialized = Array.from(data.entries()).map(([k, v]) => `${k}=${v}`).join('&');
    formSnapshots.set(modalId, serialized);
  }
}

function isFormDirty(modalId) {
  const modal = document.getElementById(modalId);
  const form = modal.querySelector('form');
  if (!form || !formSnapshots.has(modalId)) return false;
  const data = new FormData(form);
  const current = Array.from(data.entries()).map(([k, v]) => `${k}=${v}`).join('&');
  return current !== formSnapshots.get(modalId);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    setTimeout(() => takeFormSnapshot(id), 50);
  }
}

function closeModal(id, force = false) {
  if (!force && isFormDirty(id)) {
    const ok = confirm('В форме есть несохраненные данные. Закрыть без сохранения?');
    if (!ok) return;
  }
  document.getElementById(id)?.classList.remove('active');
  formSnapshots.delete(id);
}

function handleRowClick(event, type, id) {
  if (event.target.closest('button, a, input, select, textarea, .file-chip, .route-copy-btn, .tag-remove')) {
    return;
  }
  if (type === 'route') openRouteDetailModal(id);
  if (type === 'permit') openPermitDetailModal(id);
  if (type === 'vehicle') openVehicleCard(id);
}

// --- МАСКА ТЕЛЕФОНА +7 999 444 22 33 (ПУНКТ 7) ---
function applyPhoneMask(e) {
  let val = e.target.value.replace(/\D/g, '');
  if (val.startsWith('7') || val.startsWith('8')) val = val.substring(1);
  if (val.length > 10) val = val.substring(0, 10);

  let formatted = '+7';
  if (val.length > 0) formatted += ' ' + val.substring(0, 3);
  if (val.length >= 4) formatted += ' ' + val.substring(3, 6);
  if (val.length >= 7) formatted += ' ' + val.substring(6, 8);
  if (val.length >= 9) formatted += ' ' + val.substring(8, 10);

  e.target.value = formatted;
}

// --- УМНАЯ МАСКА ДАТЫ 1С (ПУНКТ 2, 16) ---
function applyDateInputMask(e) {
  let val = e.target.value.replace(/\D/g, '');
  if (val.length > 8) val = val.substring(0, 8);

  let formatted = '';
  if (val.length > 0) formatted = val.substring(0, 2);
  if (val.length >= 3) formatted += '.' + val.substring(2, 4);
  if (val.length >= 5) formatted += '.' + val.substring(4, 8);

  e.target.value = formatted;
}

function finalizeDate1C(inputStr) {
  if (!inputStr) return '';
  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, '0');

  let val = inputStr.trim().replace(/[\/\s,-]+/g, '.');
  const parts = val.split('.').filter(p => p.length > 0);

  let d = '', m = '', y = '';
  if (parts.length === 1) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = curM;
    y = String(curY);
  } else if (parts.length === 2) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = String(parseInt(parts[1], 10)).padStart(2, '0');
    y = String(curY);
  } else if (parts.length >= 3) {
    d = String(parseInt(parts[0], 10)).padStart(2, '0');
    m = String(parseInt(parts[1], 10)).padStart(2, '0');
    let rawY = parseInt(parts[2], 10);
    if (rawY < 100) rawY += 2000;
    y = String(rawY);
  } else {
    return inputStr;
  }

  const test = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isNaN(test.getTime())) return inputStr;
  return `${d}.${m}.${y}`;
}

function date1CToIso(str) {
  if (!str) return '';
  if (str.includes('-')) return str;
  const parts = str.split('.');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return str;
}

function isoToDate1C(iso) {
  if (!iso) return '';
  if (iso.includes('.')) return iso;
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
}

function syncDateFromNative(picker, targetId) {
  if (picker.value) {
    const [y, m, d] = picker.value.split('-');
    const target = document.getElementById(targetId);
    target.value = `${d}.${m}.${y}`;
    target.dispatchEvent(new Event('change'));
  }
}

function calculateEndDate(start1CStr) {
  const iso = date1CToIso(start1CStr);
  if (!iso || !iso.includes('-')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const end = new Date(y + 1, m - 1, d);
  end.setDate(end.getDate() - 1);
  return `${String(end.getDate()).padStart(2, '0')}.${String(end.getMonth() + 1).padStart(2, '0')}.${end.getFullYear()}`;
}

// Маска номера СР ХХ ХХХХХХ/э
function applyPermitNumberMask(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 8) val = val.substring(0, 8);
  let formatted = '';
  if (val.length > 0) formatted = val.substring(0, 2);
  if (val.length > 2) formatted += ' ' + val.substring(2, 8);
  if (val.length >= 8) formatted += '/э';
  input.value = formatted;
}

// Маска свидетельства консультанта ХХ ХХХХХ
function applyConsultantCertMask(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 7) val = val.substring(0, 7);
  let formatted = '';
  if (val.length > 0) formatted = val.substring(0, 2);
  if (val.length > 2) formatted += ' ' + val.substring(2, 7);
  input.value = formatted;
}

// --- УМНЫЙ ПАРСЕР И ВСТАВКА СПИСКА ООН (ПУНКТ 5, 14) ---
function parseAndValidateUNString(rawInput) {
  // Выделяем все 4-значные или меньшие блоки цифр (ООН 0005, UN 0007, 29, 0030...)
  const matches = rawInput.match(/\d+/g) || [];
  const results = [];
  const errors = [];

  for (let item of matches) {
    if (item.length >= 5) {
      errors.push(`«${item}» — номер ООН не может содержать 5 и более цифр подряд!`);
      continue;
    }
    const clean = item.padStart(4, '0');
    const good = getDopogGoodByUn(clean);
    const num = parseInt(clean, 10);

    if (good || (num >= 4 && num <= 3550)) {
      results.push(clean);
    } else {
      errors.push(`ООН ${clean} отсутствует в классификаторе ДОПОГ.`);
    }
  }

  return { results, errors };
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
  if (diffDays > 30) return { days: diffDays, status: 'active', label: `Действует (${diffDays} дн.)`, cssClass: 'active-green' };
  if (diffDays >= 15 && diffDays <= 30) return { days: diffDays, status: 'warning', label: `Истекает (${diffDays} дн.)`, cssClass: 'warning-yellow' };
  if (diffDays > 0 && diffDays < 15) return { days: diffDays, status: 'critical', label: `Критично (${diffDays} дн.)`, cssClass: 'critical-orange' };
  return { days: diffDays, status: 'expired', label: diffDays === 0 ? 'Истекает сегодня!' : `Просрочено (${Math.abs(diffDays)} дн.)`, cssClass: 'danger-red' };
}

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

async function loadServerData() {
  try {
    const [rRes, pRes, vRes] = await Promise.all([
      apiRequest(`/api/routes?archived=${appData.showingArchivedRoutes ? '1' : '0'}`),
      apiRequest('/api/permits'),
      apiRequest('/api/vehicles')
    ]);

    if (rRes && rRes.ok) appData.routes = (await rRes.json()).routes || [];
    if (pRes && pRes.ok) appData.permits = (await pRes.json()).permits || [];
    if (vRes && vRes.ok) appData.vehicles = (await vRes.json()).vehicles || [];

    renderAll();
  } catch (err) {
    showToast('Ошибка загрузки данных с сервера', 'error');
  }
}

async function loadUserProfile() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (!res) return;
    currentUser = (await res.json()).user;

    document.getElementById('userFullName').textContent = currentUser.full_name || currentUser.email;
    document.getElementById('userCompanyName').textContent = currentUser.company_name ? (currentUser.company_name.substring(0, 30) + '...') : 'Организация';
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

// --- ОТРИСОВКА: 1. РЕЕСТР МАРШРУТОВ И АРХИВ (ПУНКТ 18) ---
function setRouteArchiveView(showArchive) {
  appData.showingArchivedRoutes = showArchive;
  document.getElementById('btnRoutesTabActive').classList.toggle('active', !showArchive);
  document.getElementById('btnRoutesTabArchive').classList.toggle('active', showArchive);
  loadServerData();
}

function getRouteAggregateStatus(route) {
  if (route.is_archived) return { status: 'archived', label: 'В архиве', cssClass: 'warning-yellow' };
  if (!route.permits || route.permits.length === 0) return { status: 'expired', label: 'Нет спецразрешений', cssClass: 'danger-red' };

  let bestDays = -9999;
  let bestStatus = null;
  route.permits.forEach(p => {
    const s = calculateStatus(p.end_date);
    if (s.days > bestDays) { bestDays = s.days; bestStatus = s; }
  });

  if (bestStatus.status === 'active') return { status: 'active', label: `Обеспечен СР (${bestDays} дн.)`, cssClass: 'active-green' };
  if (bestStatus.status === 'warning') return { status: 'warning', label: `СР истекает (${bestDays} дн.)`, cssClass: 'warning-yellow' };
  if (bestStatus.status === 'critical') return { status: 'critical', label: `Критично (${bestDays} дн.)`, cssClass: 'critical-orange' };
  return { status: 'expired', label: 'СР просрочено', cssClass: 'danger-red' };
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
    const permitsLabel = permitsCount > 0 ? `<span class="brand-badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${permitsCount} СР</span>` : '<span style="color:var(--text-muted);font-size:0.75rem;">Нет СР</span>';

    const archiveBtn = r.is_archived
      ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); restoreRoute('${r.id}')" title="Восстановить из архива">♻️ Восстановить</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); archiveRoute('${r.id}')" title="Переместить в архив">📦 В архив</button>`;

    return `
      <tr class="clickable-row" onclick="handleRowClick(event, 'route', '${r.id}')" title="Нажмите для открытия карточки маршрута">
        <td><span class="status-badge ${s.cssClass}">${s.label}</span></td>
        <td><strong style="font-size:1.05rem;color:var(--primary);">№ ${r.route_number}</strong></td>
        <td>
          <a href="javascript:void(0)" onclick="event.stopPropagation(); openRouteDetailModal('${r.id}')" class="entity-link">
            ${escapeHtml(r.name)}
          </a>
        </td>
        <td>${unPills || '—'}</td>
        <td style="max-width:240px;">${loadPills || '—'}</td>
        <td style="max-width:240px;">${unloadPills || '—'}</td>
        <td>
          ${permitsLabel}
          <div style="margin-top:4px;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openAddPermitForRoute('${r.id}')" style="font-size:0.74rem;">+ СР</button>
          </div>
        </td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openRouteDetailModal('${r.id}')">📋 Карточка</button>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editRoute('${r.id}')">✏️</button>
          ${archiveBtn}
        </td>
      </tr>
    `;
  }).join('');
}

// Карточка детального просмотра маршрута
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
          <button class="btn btn-primary btn-sm" onclick="closeModal('routeDetailModal', true); openAddPermitForRoute('${r.id}')">
            + Выпустить Спецразрешение на автомобиль
          </button>
        </div>
      </div>
    `;
  } else {
    permitsTableHtml = `
      <table style="width:100%;font-size:0.85rem;">
        <thead><tr style="background:#f1f5f9;"><th>Статус</th><th>№ СР</th><th>Автомобиль</th><th>Срок действия</th><th>Сканы</th></tr></thead>
        <tbody>
          ${permits.map(p => {
            const pStat = calculateStatus(p.end_date);
            const files = p.files || [];
            // Пункт 17: вывод "Скачать" вместо абракадабры
            const filesHtml = files.map(f => `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(f.path)}" target="_blank" download="${escapeHtml(f.name)}">📄 Скачать</a>`).join(' ');
            return `
              <tr class="clickable-row" onclick="closeModal('routeDetailModal', true); openPermitDetailModal('${p.id}')" title="Открыть СР">
                <td><span class="status-badge ${pStat.cssClass}">${pStat.label}</span></td>
                <td><strong class="entity-link">${escapeHtml(p.number)} ➔</strong></td>
                <td>
                  <a href="javascript:void(0)" onclick="event.stopPropagation(); closeModal('routeDetailModal', true); openVehicleCard('${p.vehicle_id}')" class="entity-link">
                    ${escapeHtml(p.plate)} (${escapeHtml(p.brand)}) ➔
                  </a>
                </td>
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
      <div><strong>Подробный маршрут:</strong> ${escapeHtml(r.route_detail || 'Не детализирован')}</div>
    </div>

    <!-- Модуль подготовки пакета документов в УГАДН (Пункт 20) -->
    <div style="background:#eff6ff;padding:1.25rem;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="font-weight:700;color:#1e40af;margin-bottom:4px;">📦 Подготовка пакета документов в Ространснадзор</h4>
          <p style="font-size:0.82rem;color:#3b82f6;">Автогенерация официального заявления по форме Минтранса РФ, Приложений №1 и №2 и печать комплекта из 4 документов</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openUgadnPreparationModal('${r.id}')">
          📝 Подготовить пакет документов
        </button>
      </div>
    </div>

    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h4 style="font-weight:700;">Специальные разрешения маршрута (${permits.length})</h4>
        <button class="btn btn-primary btn-sm" onclick="closeModal('routeDetailModal', true); openAddPermitForRoute('${r.id}')">+ Выпустить СР на авто</button>
      </div>
      <div style="border:1px solid var(--border-color);border-radius:6px;overflow:hidden;">
        ${permitsTableHtml}
      </div>
    </div>
  `;

  openModal('routeDetailModal');
}

// Карточка детального просмотра СР
function openPermitDetailModal(permitId) {
  const p = appData.permits.find(item => item.id === permitId);
  if (!p) return;

  const s = calculateStatus(p.end_date);
  document.getElementById('permitDetailTitle').textContent = `Специальное разрешение № ${p.number}`;

  const files = p.files || [];
  // Пункт 17: вывод "Скачать"
  const filesHtml = files.length > 0
    ? files.map(f => `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(f.path)}" target="_blank" download="${escapeHtml(f.name)}">📄 Скачать</a>`).join(' ')
    : '<span style="color:var(--text-muted);font-size:0.85rem;">Сканы не прикреплены</span>';

  document.getElementById('permitDetailBody').innerHTML = `
    <div style="background:var(--bg-main);padding:1.25rem;border-radius:8px;border:1px solid var(--border-color);margin-bottom:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span class="status-badge ${s.cssClass}">${s.label}</span>
        <button class="btn btn-secondary btn-sm" onclick="copyPermitRoute('${p.id}')">📋 Скопировать маршрут</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:12px;">
        <div>
          <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Маршрут согласования:</span><br>
          <a href="javascript:void(0)" onclick="closeModal('permitDetailModal', true); openRouteDetailModal('${p.route_id}')" class="entity-link" style="font-size:1.05rem;">
            Маршрут № ${p.routeNumber}: ${escapeHtml(p.routeName || '')} ➔
          </a>
        </div>
        <div>
          <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Закрепленный автомобиль:</span><br>
          <a href="javascript:void(0)" onclick="closeModal('permitDetailModal', true); openVehicleCard('${p.vehicle_id}')" class="entity-link" style="font-size:1.05rem;">
            🚗 ${escapeHtml(p.plate)} (${escapeHtml(p.brand)}) ➔
          </a>
        </div>
      </div>

      <div style="margin-bottom:8px;">
        <strong>Срок действия:</strong> с ${isoToDate1C(p.start_date)} по <strong>${isoToDate1C(p.end_date)}</strong>
      </div>
      <div style="margin-bottom:8px;">
        <strong>Разрешенные грузы ООН:</strong> ${(p.unCodes || []).map(u => `<span class="un-pill">ООН ${escapeHtml(u)}</span>`).join('')}
      </div>
      <div style="margin-bottom:8px;">
        <strong>Грузоотправители:</strong> ${(p.pointsLoad || []).map(l => `<span class="route-badge badge-load">🟢 ${escapeHtml(l)}</span>`).join(' ')}
      </div>
      <div style="margin-bottom:8px;">
        <strong>Грузополучатели:</strong> ${(p.pointsUnload || []).map(u => `<span class="route-badge badge-unload">🔵 ${escapeHtml(u)}</span>`).join(' ')}
      </div>
      <div>
        <strong>Подробный маршрут:</strong> ${escapeHtml(p.route_detail || 'Не детализирован')}
      </div>
    </div>

    <div>
      <h4 style="font-weight:700;margin-bottom:6px;">Прикрепленные сканы спецразрешения (${files.length})</h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${filesHtml}</div>
    </div>
  `;

  document.getElementById('btnEditPermitFromDetail').onclick = () => {
    closeModal('permitDetailModal', true);
    editPermit(p.id);
  };

  openModal('permitDetailModal');
}

// Надежное копирование маршрутов (Пункт 7)
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

// --- ОТРИСОВКА: 2. РЕЕСТР СПЕЦИАЛЬНЫХ РАЗРЕШЕНИЙ (СР) ---
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
    if (permitSortField === 'routeNumber') { valA = a.routeNumber || 0; valB = b.routeNumber || 0; }
    if (permitSortField === 'vehicle') { valA = (a.plate || '').toLowerCase(); valB = (b.plate || '').toLowerCase(); }
    if (permitSortField === 'endDate') { valA = a.end_date; valB = b.end_date; }

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
    // Пункт 17: "Скачать"
    const filesHtml = files.length > 0
      ? files.map(f => `<a class="file-chip" href="/api/files/permits/${encodeURIComponent(f.path)}" target="_blank" download="${escapeHtml(f.name)}">📄 Скачать</a>`).join(' ')
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    return `
      <tr class="clickable-row" onclick="handleRowClick(event, 'permit', '${p.id}')" title="Открыть СР">
        <td><strong style="color:var(--primary);font-size:1.05rem;">№ ${p.routeNumber}</strong></td>
        <td><strong>${escapeHtml(p.number)}</strong><br><small style="color:var(--text-muted);">выдано: ${isoToDate1C(p.start_date)}</small></td>
        <td>
          <a href="javascript:void(0)" onclick="event.stopPropagation(); openVehicleCard('${p.vehicle_id}')" class="entity-link">
            ${escapeHtml(p.plate)} ➔
          </a>
          <br><small style="color:var(--text-muted);">${escapeHtml(p.brand)}</small>
        </td>
        <td>
          <a href="javascript:void(0)" onclick="event.stopPropagation(); openRouteDetailModal('${p.route_id}')" class="entity-link" style="font-weight:600;font-size:0.85rem;">
            ${escapeHtml(p.routeName || 'Маршрут')} ➔
          </a>
          <br>
          <button class="route-copy-btn" onclick="event.stopPropagation(); copyPermitRoute('${p.id}')">📋 Скопировать маршрут</button>
        </td>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${isoToDate1C(p.end_date)}</div>
        </td>
        <td style="max-width:180px;">${filesHtml}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openPermitDetailModal('${p.id}')">📋 Карточка</button>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editPermit('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deletePermit('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// --- ОТРИСОВКА: 3. РЕЕСТР АВТОМОБИЛЕЙ (ПУНКТ 10) ---
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
      const q = `${v.plate} ${v.brand} ${v.vin || ''} ${v.vehicle_type || ''} ${v.sts_number || ''} ${v.dopog_number || ''}`.toLowerCase();
      if (!q.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-icon">🚛</div><p>Автомобилей не найдено</p></td></tr>';
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
      <tr class="clickable-row" onclick="handleRowClick(event, 'vehicle', '${v.id}')" title="Открыть авто">
        <td style="width:180px;min-width:180px;white-space:nowrap;">
          <a href="javascript:void(0)" onclick="event.stopPropagation(); openVehicleCard('${v.id}')" class="entity-link" style="font-size:1rem;">
            ${escapeHtml(v.plate)}
          </a>
        </td>
        <td><strong>${escapeHtml(v.brand)}</strong></td>
        <td><code style="font-size:0.8rem;">${escapeHtml(v.vin || '—')}</code></td>
        <td>${escapeHtml(v.vehicle_type || '—')}</td>
        <td>${stsHtml}</td>
        <td>${dopogHtml}</td>
        <td>
          <span class="status-badge ${s.cssClass}">${s.label}</span>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">До: ${isoToDate1C(v.dopog_expiry_date)}</div>
        </td>
        <td><span class="brand-badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${activePermitsCount} СР</span></td>
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openVehicleCard('${v.id}')">📋 Досье</button>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editVehicle('${v.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteVehicle('${v.id}')">🗑️</button>
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
        <div style="color:#334155;font-weight:600;margin-bottom:4px;">${escapeHtml(v.brand)} (${escapeHtml(v.vehicle_type || 'Тип ТС не указан')})</div>
        <div style="font-size:0.85rem;margin-bottom:4px;">VIN: <strong>${escapeHtml(v.vin || 'Не указан')}</strong></div>
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
              <tr class="clickable-row" onclick="closeModal('vehicleDetailModal', true); openPermitDetailModal('${p.id}')" title="Открыть СР">
                <td><span class="status-badge ${pStat.cssClass}">${pStat.label}</span></td>
                <td><strong>№ ${p.routeNumber}</strong></td>
                <td><strong class="entity-link">${escapeHtml(p.number)} ➔</strong></td>
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

// --- ОТРИСОВКА: 5. АДМИН-ПАНЕЛЬ (ПУНКТ 6) ---
async function loadAdminData() {
  try {
    const res = await apiRequest('/api/admin/overview');
    if (!res || !res.ok) return;
    const { stats, companies } = await res.json();

    document.getElementById('adminTotalCompanies').textContent = stats.totalCompanies;
    document.getElementById('adminTotalUsers').textContent = stats.totalUsers;
    document.getElementById('adminTotalVehicles').textContent = stats.totalVehicles;
    document.getElementById('adminTotalRoutes').textContent = stats.totalRoutes;

    const tbody = document.getElementById('adminCompaniesTableBody');
    tbody.innerHTML = companies.map(c => `
      <tr>
        <td style="max-width:240px;"><strong>${escapeHtml(c.name)}</strong></td>
        <td><code>${escapeHtml(c.inn || '—')}</code></td>
        <td><code>${escapeHtml(c.ogrn || '—')}</code></td>
        <td>${escapeHtml(c.head_name || '—')}<br><small style="color:var(--text-muted);">${escapeHtml(c.head_position || '')}</small></td>
        <td>${escapeHtml(c.contact_person || '—')}<br><small style="color:var(--text-muted);">${escapeHtml(c.admin_email || '')}</small></td>
        <td>${escapeHtml(c.phone || c.contact_phone || '—')}</td>
        <td>
          <span class="brand-badge" style="background:#e0f2fe;color:#0369a1;">${c.vehicle_count} ТС</span>
          <span class="brand-badge" style="background:#dcfce7;color:#166534;">${c.route_count} марш.</span>
          <span class="brand-badge" style="background:#fef3c7;color:#92400e;">${c.permit_count} СР</span>
        </td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${isoToDate1C(c.created_at ? c.created_at.split(' ')[0] : '')}</td>
      </tr>
    `).join('');
  } catch (err) {}
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

  // Обработка умной вставки ООН (Пункт 5, 14)
  input.onpaste = (e) => {
    if (!isUn) return;
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const { results, errors } = parseAndValidateUNString(pasted);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
    }

    results.forEach(code => {
      if (!tagsArray.includes(code)) tagsArray.push(code);
    });
    input.value = '';
    renderTags();
    showToast(`Добавлено ${results.length} номеров ООН`, 'success');
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      let raw = input.value.trim();
      if (!raw) return;

      if (isUn) {
        const { results, errors } = parseAndValidateUNString(raw);
        if (errors.length > 0) {
          showToast(errors[0], 'error');
          return;
        }
        results.forEach(code => {
          if (!tagsArray.includes(code)) tagsArray.push(code);
        });
      } else {
        if (!tagsArray.includes(raw)) tagsArray.push(raw);
      }
      input.value = '';
      renderTags();
    }
  };

  renderTags();
}

function copyLoadsToUnloads() {
  currentRouteUnloadTags = [...currentRouteLoadTags];
  setupTagInput('routeUnloadTagsContainer', 'routeUnloadTagInput', currentRouteUnloadTags);
  showToast('Грузополучатели скопированы из грузоотправителей!', 'success');
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

async function archiveRoute(id) {
  if (!confirm('Переместить маршрут в архив? Маршрут перестанет отображаться в активных.')) return;
  const res = await apiRequest(`/api/routes/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archive: true })
  });
  if (res && res.ok) {
    showToast('Маршрут перемещен в архив', 'success');
    loadServerData();
  }
}

async function restoreRoute(id) {
  const res = await apiRequest(`/api/routes/${id}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ archive: false })
  });
  if (res && res.ok) {
    showToast('Маршрут восстановлен из архива!', 'success');
    loadServerData();
  }
}

// --- УПРАВЛЕНИЕ СПЕЦРАЗРЕШЕНИЯМИ (СР) ---
function populatePermitModalSelects(selectedRouteId = '', selectedVehicleId = '') {
  const rSel = document.getElementById('permitRouteSelect');
  const vSel = document.getElementById('permitVehicleSelect');

  rSel.innerHTML = '<option value="">-- Выберите маршрут --</option>';
  appData.routes.filter(r => !r.is_archived).forEach(r => {
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
  document.getElementById('vehicleVin').value = v.vin || '';
  document.getElementById('vehicleType').value = v.vehicle_type || '';
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
  document.getElementById('profCompanyOgrn').value = currentUser.company_ogrn || '';
  document.getElementById('profLegalAddress').value = currentUser.legal_address || '';
  document.getElementById('profCompanyPhone').value = currentUser.company_phone || currentUser.phone || '';
  document.getElementById('profHeadPosition').value = currentUser.head_position || '';
  document.getElementById('profHeadName').value = currentUser.head_name || '';

  document.getElementById('profFullName').value = currentUser.full_name || '';
  document.getElementById('profPhone').value = currentUser.phone || '';
  document.getElementById('profCertNum').value = currentUser.consultant_cert_number || '';
  document.getElementById('profCertStart').value = isoToDate1C(currentUser.consultant_cert_start || '');
  document.getElementById('profCertEnd').value = isoToDate1C(currentUser.consultant_cert_end || '');

  openModal('profileModal');
}

// --- ПОДГОТОВКА ДОКУМЕНТОВ В УГАДН (ПУНКТ 20) ---
let currentUgadnContext = null;

function openUgadnPreparationModal(routeId) {
  const r = appData.routes.find(item => item.id === routeId);
  if (!r) return;

  currentUgadnContext = { route: r };
  document.getElementById('ugadnRouteId').value = routeId;

  const vSel = document.getElementById('ugadnVehicleSelect');
  vSel.innerHTML = '<option value="">-- Выберите автомобиль из автопарка --</option>';
  appData.vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.plate} — ${v.brand} (VIN: ${v.vin || '—'})`;
    vSel.appendChild(opt);
  });

  openModal('ugadnModal');
}

function getUgadnPayload() {
  const r = currentUgadnContext.route;
  const vId = document.getElementById('ugadnVehicleSelect').value;
  const v = appData.vehicles.find(item => item.id === vId);
  if (!v) {
    showToast('Выберите автомобиль для заявления', 'warning');
    return null;
  }

  const paymentReqs = document.getElementById('ugadnPaymentReqs').value;
  const ugadnTarget = document.getElementById('ugadnTarget').value;
  const periodStart = document.getElementById('ugadnPeriodStart').value;
  const periodEnd = document.getElementById('ugadnPeriodEnd').value;

  return { r, v, paymentReqs, ugadnTarget, periodStart, periodEnd };
}

// Генерация HTML Заявления на основе присланного шаблона RTF
function generateApplicationHtmlContent(payload) {
  const { r, v, paymentReqs, ugadnTarget, periodStart, periodEnd } = payload;
  const comp = currentUser || {};

  const unRowsHtml = (r.unCodes || []).map((code, idx) => {
    const good = getDopogGoodByUn(code);
    const name = good ? good.name_ru : 'ОПАСНЫЙ ГРУЗ';
    const cls = good ? good.class : '1';
    const pg = (good && good.pg !== '-') ? good.pg : '';
    return `
      <tr>
        <td style="border:1px solid #000;padding:4px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #000;padding:4px;text-align:center;">${code}</td>
        <td style="border:1px solid #000;padding:4px;">${name}</td>
        <td style="border:1px solid #000;padding:4px;text-align:center;">${cls}</td>
        <td style="border:1px solid #000;padding:4px;text-align:center;">${pg}</td>
      </tr>
    `;
  }).join('');

  const loadPointsText = (r.pointsLoad || []).join('<br>');
  const unloadPointsText = (r.pointsUnload || []).join('<br>');

  return `
    <div style="font-family:'Times New Roman', serif;font-size:12pt;line-height:1.25;color:#000;padding:20mm 15mm;">
      <div style="text-align:right;margin-bottom:25px;">
        <strong>${escapeHtml(ugadnTarget)}</strong>
      </div>

      <div style="text-align:center;font-weight:bold;font-size:14pt;margin-bottom:15px;">
        ЗАЯВЛЕНИЕ<br>
        <span style="font-size:11pt;font-weight:normal;">о получении специального разрешения на движение по автомобильным дорогам транспортного средства, осуществляющего перевозку опасных грузов</span>
      </div>

      <div style="margin-bottom:12px;text-align:justify;">
        <strong>${escapeHtml(comp.company_name || '')}</strong><br>
        <small style="font-size:8pt;color:#555;">(наименование юридического лица; фамилия, имя, отчество (при наличии) для физического лица или индивидуального предпринимателя)</small>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000;padding:5px;width:35%;font-size:10pt;">ИНН, ОГРН/ОГРНИП владельца транспортного средства</td>
          <td style="border:1px solid #000;padding:5px;width:30%;font-size:10pt;">ИНН: <strong>${escapeHtml(comp.company_inn || '')}</strong></td>
          <td style="border:1px solid #000;padding:5px;width:35%;font-size:10pt;">ОГРН/ОГРНИП: <strong>${escapeHtml(comp.company_ogrn || '')}</strong></td>
        </tr>
      </table>

      <div style="margin-bottom:8px;">просит оформить специальное разрешение на движение по автомобильным дорогам транспортного средства:</div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000;padding:5px;width:65%;font-size:10pt;font-weight:bold;">
            Тип, марка, модель, идентификационный номер транспортного средства (основного компонента)
          </td>
          <td style="border:1px solid #000;padding:5px;width:35%;font-size:10pt;font-weight:bold;text-align:center;">
            Государственный регистрационный знак ТС
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:5px;font-size:10pt;">
            ${escapeHtml(v.vehicle_type || 'Грузовой фургон')}<br>
            ${escapeHtml(v.brand)}<br>
            VIN: ${escapeHtml(v.vin || '—')}
          </td>
          <td style="border:1px solid #000;padding:5px;font-size:12pt;font-weight:bold;text-align:center;">
            ${escapeHtml(v.plate)}
          </td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000;padding:5px;width:65%;font-size:10pt;">Информация о способе оформления специального разрешения</td>
          <td style="border:1px solid #000;padding:5px;width:17%;font-size:10pt;text-align:center;">на бумажном носителе<br>—</td>
          <td style="border:1px solid #000;padding:5px;width:18%;font-size:10pt;text-align:center;">в виде электронного документа<br><strong>V</strong></td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000;padding:5px;font-size:10pt;">
            Сведения о консультанте по вопросам безопасности перевозок опасных грузов:<br>
            <strong>${escapeHtml(comp.full_name || '')}, № ${escapeHtml(comp.consultant_cert_number || '')}</strong><br>
            <small style="font-size:8pt;color:#555;">(фамилия, имя, отчество (при наличии), серия и номер свидетельства консультанта)</small>
          </td>
        </tr>
      </table>

      <div style="margin-bottom:8px;">
        осуществляющего перевозку опасных грузов (согласно приложению № 1), по маршруту <strong>№ ${r.route_number}</strong> (согласно приложению № 2):
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000;padding:5px;width:50%;font-size:10pt;">Предполагаемый срок перевозки: с <strong>${periodStart || '—'}</strong></td>
          <td style="border:1px solid #000;padding:5px;width:50%;font-size:10pt;">по: <strong>${periodEnd || '—'}</strong></td>
        </tr>
      </table>

      <div style="font-size:10pt;margin-bottom:6px;">
        Адрес места нахождения: <strong>${escapeHtml(comp.legal_address || '')}</strong>
      </div>
      <div style="font-size:10pt;margin-bottom:10px;">
        Телефон: <strong>${escapeHtml(comp.company_phone || comp.phone || '')}</strong> &nbsp;&nbsp;&nbsp;&nbsp; E-mail: <strong>${escapeHtml(comp.email || '')}</strong>
      </div>

      <div style="font-size:9pt;margin-bottom:8px;text-align:justify;">
        Необходимые документы к заявлению прилагаются. Заявитель подтверждает подлинность и достоверность представленных сведений и документов.
      </div>
      <div style="font-size:10pt;margin-bottom:15px;">
        Реквизиты платежного документа, подтверждающего уплату государственной пошлины: <strong>${escapeHtml(paymentReqs)}</strong>
      </div>

      <table style="width:100%;margin-top:20px;">
        <tr>
          <td style="width:60%;font-size:10pt;">
            ${escapeHtml(comp.head_position || 'Начальник Управления')} ______________________ ${escapeHtml(comp.head_name || '')}
          </td>
          <td style="width:40%;text-align:right;font-size:10pt;">
            «____» _____________ 2026 г. &nbsp;&nbsp;&nbsp; М.П.
          </td>
        </tr>
      </table>

      <!-- СТРАНИЦА 2: ПРИЛОЖЕНИЕ № 1 -->
      <div class="page-break" style="page-break-before:always;margin-top:40px;"></div>

      <div style="text-align:right;font-size:10pt;margin-bottom:10px;">Приложение № 1 к заявлению</div>
      <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:12px;">Сведения о заявленном опасном грузе</div>

      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:15px;">
        <thead>
          <tr style="background:#f2f2f2;">
            <th style="border:1px solid #000;padding:4px;width:5%;">№ п/п</th>
            <th style="border:1px solid #000;padding:4px;width:12%;">Номер ООН</th>
            <th style="border:1px solid #000;padding:4px;">Надлежащее отгрузочное наименование (ДОПОГ 3.1.2)</th>
            <th style="border:1px solid #000;padding:4px;width:12%;">Класс (код)</th>
            <th style="border:1px solid #000;padding:4px;width:10%;">Группа упаковки</th>
          </tr>
        </thead>
        <tbody>
          ${unRowsHtml}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:20px;">
        <tr>
          <td style="border:1px solid #000;padding:6px;width:30%;font-weight:bold;">Адреса мест погрузки</td>
          <td style="border:1px solid #000;padding:6px;">${loadPointsText}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px;font-weight:bold;">Адреса мест разгрузки</td>
          <td style="border:1px solid #000;padding:6px;">${unloadPointsText}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px;font-weight:bold;">Адреса мест стоянок</td>
          <td style="border:1px solid #000;padding:6px;">Стоянки осуществлять в соответствии с Европейским соглашением (ДОПОГ)</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px;font-weight:bold;">Адреса мест заправок</td>
          <td style="border:1px solid #000;padding:6px;">Заправку АТС осуществлять на специально предусмотренных для этого топливозаправочных пунктах</td>
        </tr>
      </table>

      <table style="width:100%;margin-top:15px;">
        <tr>
          <td style="width:60%;font-size:10pt;">
            ${escapeHtml(comp.head_position || 'Начальник Управления')} ______________________ ${escapeHtml(comp.head_name || '')}
          </td>
          <td style="width:40%;text-align:right;font-size:10pt;">М.П.</td>
        </tr>
      </table>

      <!-- СТРАНИЦА 3: ПРИЛОЖЕНИЕ № 2 -->
      <div class="page-break" style="page-break-before:always;margin-top:40px;"></div>

      <div style="text-align:right;font-size:10pt;margin-bottom:10px;">Приложение № 2 к заявлению</div>
      <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:12px;">Маршрут перевозки опасного груза</div>

      <div style="font-size:11pt;line-height:1.4;text-align:justify;margin-bottom:25px;border:1px solid #000;padding:12px;">
        <strong>Маршрут № ${r.route_number}:</strong> ${escapeHtml(r.route_detail || '')}
      </div>

      <table style="width:100%;margin-top:20px;">
        <tr>
          <td style="width:60%;font-size:10pt;">
            ${escapeHtml(comp.head_position || 'Начальник Управления')} ______________________ ${escapeHtml(comp.head_name || '')}
          </td>
          <td style="width:40%;text-align:right;font-size:10pt;">М.П.</td>
        </tr>
      </table>
    </div>
  `;
}

// 1. Скачивание Заявления
function generateAndDownloadApplication() {
  const payload = getUgadnPayload();
  if (!payload) return;

  const html = generateApplicationHtmlContent(payload);
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Заявление_Маршрут_${payload.r.route_number}_${payload.v.plate}.doc`;
  a.click();
  showToast('✓ Заявление успешно сформировано и скачано!', 'success');
}

// 2. Печать полного комплекта из 4 документов
function printFullDocumentPackage() {
  const payload = getUgadnPayload();
  if (!payload) return;

  const { v } = payload;
  const appHtml = generateApplicationHtmlContent(payload);

  // Документ 2: Свидетельство о допуске ДОПОГ
  const dopogDocHtml = v.dopog_file_path
    ? `<div class="page-break" style="page-break-before:always;padding:15mm;"><h3 style="text-align:center;margin-bottom:15px;">2. Свидетельство о допуске ТС к перевозке опасных грузов (${escapeHtml(v.plate)})</h3><img src="/api/files/vehicles/${encodeURIComponent(v.dopog_file_path)}" style="max-width:100%;max-height:85vh;display:block;margin:0 auto;object-fit:contain;"><p style="text-align:center;margin-top:8px;">${escapeHtml(v.dopog_number || '')}</p></div>`
    : `<div class="page-break" style="page-break-before:always;padding:20mm;"><h3 style="text-align:center;">2. Свидетельство о допуске ДОПОГ (${escapeHtml(v.plate)})</h3><p style="text-align:center;color:#666;">Скан-копия документа прикреплена в электронном виде: № ${escapeHtml(v.dopog_number || 'б/н')}</p></div>`;

  // Документ 3: Платежное поручение
  const paymentFileInput = document.getElementById('ugadnPaymentFile');
  let paymentDocHtml = '';
  if (paymentFileInput.files.length > 0) {
    const fileUrl = URL.createObjectURL(paymentFileInput.files[0]);
    paymentDocHtml = `<div class="page-break" style="page-break-before:always;padding:15mm;"><h3 style="text-align:center;margin-bottom:15px;">3. Платежное поручение (госпошлина 1 300 руб.)</h3><img src="${fileUrl}" style="max-width:100%;max-height:85vh;display:block;margin:0 auto;object-fit:contain;"><p style="text-align:center;margin-top:8px;">${escapeHtml(payload.paymentReqs)}</p></div>`;
  } else {
    paymentDocHtml = `<div class="page-break" style="page-break-before:always;padding:20mm;"><h3 style="text-align:center;">3. Платежное поручение госпошлины</h3><p style="text-align:center;">Реквизиты: ${escapeHtml(payload.paymentReqs)}</p></div>`;
  }

  // Документ 4: Свидетельство о регистрации (СТС)
  const stsDocHtml = v.sts_file_path
    ? `<div class="page-break" style="page-break-before:always;padding:15mm;"><h3 style="text-align:center;margin-bottom:15px;">4. Свидетельство о регистрации ТС (СТС ${escapeHtml(v.plate)})</h3><img src="/api/files/vehicles/${encodeURIComponent(v.sts_file_path)}" style="max-width:100%;max-height:85vh;display:block;margin:0 auto;object-fit:contain;"><p style="text-align:center;margin-top:8px;">СТС: ${escapeHtml(v.sts_number || '')}</p></div>`
    : `<div class="page-break" style="page-break-before:always;padding:20mm;"><h3 style="text-align:center;">4. Свидетельство о регистрации ТС (СТС)</h3><p style="text-align:center;color:#666;">СТС: ${escapeHtml(v.sts_number || 'б/н')}</p></div>`;

  const printArea = document.getElementById('printDocumentArea');
  printArea.innerHTML = appHtml + dopogDocHtml + paymentDocHtml + stsDocHtml;
  printArea.style.display = 'block';

  window.print();
  setTimeout(() => { printArea.style.display = 'none'; }, 1000);
}

// --- ПРОВЕРКА ГРУЗА ПО ООН ---
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
          <span class="un-pill ${m.is_hcdg_package ? 'hcdg' : ''}">Класс ${m.class}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';
    } else dropdown.style.display = 'none';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCargoCheck();
    }
  });

  document.querySelectorAll('.quick-un-link').forEach(l => {
    l.onclick = () => {
      input.value = l.getAttribute('data-un');
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
  const packageType = document.getElementById('calcPackageType') ? document.getElementById('calcPackageType').value : 'drums';

  if (!un) return showToast('Введите номер ООН', 'warning');
  const res = evaluatePackageCargo(un, weight, packageType);

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

function createRouteFromCalc() {
  const un = document.getElementById('calcUnInput').value.trim();
  switchTab('tab-routes');
  openAddRouteModal();
  if (un && !currentRouteUnTags.includes(un)) {
    currentRouteUnTags.push(un.padStart(4, '0'));
    setupTagInput('routeUnTagsContainer', 'routeUnTagInput', currentRouteUnTags, true);
  }
}

// --- ФИЛЬТРЫ ДАШБОРДА ---
function setRouteFilter(key) {
  activeRouteFilter = (activeRouteFilter === key && key !== 'all') ? 'all' : key;
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

function switchTab(id) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === id));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = c.id === id ? 'block' : 'none');
  if (id === 'tab-admin') loadAdminData();
}

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

// --- СЛУШАТЕЛИ СОБЫТИЙ ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  await loadServerData();

  // Клик вне карточки (оверлей) с проверкой несохраненных данных (Пункт 3)
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Маски телефона (Пункт 7)
  document.querySelectorAll('.phone-mask').forEach(input => {
    input.addEventListener('input', applyPhoneMask);
  });

  // Маски дат 1С (Пункт 16)
  document.querySelectorAll('.date-1c-mask').forEach(input => {
    input.addEventListener('input', applyDateInputMask);
    input.addEventListener('blur', () => {
      input.value = finalizeDate1C(input.value);
      input.dispatchEvent(new Event('change'));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.value = finalizeDate1C(input.value);
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Авторасчет даты окончания СР (+1 год - 1 день)
  document.getElementById('permitStartDate').addEventListener('change', (e) => {
    const end = document.getElementById('permitEndDate');
    if (e.target.value && (!end.value || document.getElementById('permitEditId').value === '')) {
      end.value = calculateEndDate(e.target.value);
    }
  });

  // Маска номера СР ХХ ХХХХХХ/э
  document.getElementById('permitNumber').addEventListener('input', (e) => {
    applyPermitNumberMask(e.target);
  });

  // Маска сертификата консультанта ХХ ХХХХХ
  document.getElementById('profCertNum').addEventListener('input', (e) => {
    applyConsultantCertMask(e.target);
  });

  // Поиск
  document.getElementById('routeSearchInput')?.addEventListener('input', renderRoutes);
  document.getElementById('permitSearchInput')?.addEventListener('input', renderPermits);
  document.getElementById('vehicleSearchInput')?.addEventListener('input', renderVehicles);

  // Сабмит Маршрута
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
      closeModal('routeModal', true);
      await loadServerData();
    }
  };

  // Сабмит Спецразрешения (СР)
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
      closeModal('permitModal', true);

      const s = calculateStatus(endDateIso);
      if (s.status === 'critical' || s.status === 'expired') {
        triggerInstantAlert('Внимание: Срок СР', `Выпущено СР ${document.getElementById('permitNumber').value}: ${s.label}!`, 'error');
      } else if (s.status === 'warning') {
        triggerInstantAlert('Внимание: Срок СР', `Выпущено СР со сроком окончания менее 30 дней!`, 'warning');
      }

      await loadServerData();
    }
  };

  // Сабмит Автомобиля
  document.getElementById('vehicleForm').onsubmit = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('vehicleEditId').value;
    const expiryIso = date1CToIso(document.getElementById('vehicleDopogExpiryDate').value);

    const formData = new FormData();
    formData.append('plate', document.getElementById('vehiclePlate').value);
    formData.append('brand', document.getElementById('vehicleBrand').value);
    formData.append('vin', document.getElementById('vehicleVin').value);
    formData.append('vehicleType', document.getElementById('vehicleType').value);
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
      closeModal('vehicleModal', true);

      const s = calculateStatus(expiryIso);
      if (s.status === 'critical' || s.status === 'expired') {
        triggerInstantAlert('Внимание: Допуск авто ДОПОГ', `У автомобиля ${document.getElementById('vehiclePlate').value} допуск ДОПОГ: ${s.label}!`, 'error');
      }

      await loadServerData();
    }
  };

  // Сабмит Профиля организации
  document.getElementById('profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const startIso = date1CToIso(document.getElementById('profCertStart').value);
    const endIso = date1CToIso(document.getElementById('profCertEnd').value);

    const body = {
      companyName: document.getElementById('profCompanyName').value,
      companyInn: document.getElementById('profCompanyInn').value,
      companyOgrn: document.getElementById('profCompanyOgrn').value,
      legalAddress: document.getElementById('profLegalAddress').value,
      companyPhone: document.getElementById('profCompanyPhone').value,
      headPosition: document.getElementById('profHeadPosition').value,
      headName: document.getElementById('profHeadName').value,
      fullName: document.getElementById('profFullName').value,
      phone: document.getElementById('profPhone').value,
      consultantCertNumber: document.getElementById('profCertNum').value,
      consultantCertStart: startIso,
      consultantCertEnd: endIso
    };

    const res = await apiRequest('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (res && res.ok) {
      showToast('Реквизиты сохранены', 'success');
      closeModal('profileModal', true);
      await loadUserProfile();
    }
  };

  initCargoChecker();
});