/* ═══════════════════════════════════════════════════════════
   app.js  |  Shared utilities for all pages
   ═══════════════════════════════════════════════════════════ */

const API = 'http://localhost:8000/api/v1';

// ── Auth ─────────────────────────────────────────────────────
const Auth = {
  _idleTimer: null,
  _idleBound: false,
  _lastActivityWrite: 0,
  _idleTimeoutMs: 15 * 60 * 1000,

  token() { return localStorage.getItem('token'); },
  user()  { return JSON.parse(localStorage.getItem('user') || 'null'); },

  redirectIfAuthenticated(redirectTo = 'dashboard.html') {
    if (this.token() && this.user()) {
      window.location.href = redirectTo;
      return true;
    }
    return false;
  },

  async login(email, password) {
    const body = new URLSearchParams({ username: email, password });
    let res;

    try {
      res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new Error('Cannot reach server. Please try again.');
    }

    const raw = await res.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Incorrect email or password.');
      }

      throw new Error(data?.detail || 'Login failed. Please try again.');
    }

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  headers() {
    return {
      'Authorization': `Bearer ${this.token()}`,
      'Content-Type':  'application/json',
    };
  },

  formHeaders() {
    // No Content-Type for multipart; let browser set boundary
    return { 'Authorization': `Bearer ${this.token()}` };
  },

  guard() {
    if (!this.token() || !this.user()) {
      window.location.href = 'login_index.html';
      return;
    }
    this.startInactivityMonitor();
  },

  logout() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login_index.html';
  },

  markActivity() {
    if (!this.token()) return;

    const now = Date.now();
    // Reduce storage writes while still keeping cross-tab activity in sync.
    if (now - this._lastActivityWrite > 10000) {
      localStorage.setItem('lastActivityAt', String(now));
      this._lastActivityWrite = now;
    }
    this.resetInactivityTimer();
  },

  resetInactivityTimer() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      showToast('You were logged out due to inactivity.', 'info');
      this.logout();
    }, this._idleTimeoutMs);
  },

  startInactivityMonitor(timeoutMs = this._idleTimeoutMs) {
    if (!this.token()) return;

    this._idleTimeoutMs = timeoutMs;
    if (!this._idleBound) {
      const onActivity = () => this.markActivity();
      ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, onActivity, { passive: true });
      });

      window.addEventListener('storage', (e) => {
        if (e.key === 'token' && !e.newValue) {
          window.location.href = 'login_index.html';
          return;
        }
        if (e.key === 'lastActivityAt' && this.token()) {
          this.resetInactivityTimer();
        }
      });

      this._idleBound = true;
    }

    this.markActivity();
  },
};

// ── API fetch wrapper ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: Auth.headers(),
    ...options,
  });

  if (res.status === 401) { Auth.logout(); return; }
  return res;
}

function buildUploadUrl(filePath) {
  if (!filePath) return null;

  const cleanPath = String(filePath).replace(/\\/g, '/').replace(/^\/+/, '');
  const apiOrigin = API.replace(/\/api\/v1$/, '');
  return `${apiOrigin}/uploads/${encodeURI(cleanPath)}`;
}

// ── Status helpers ───────────────────────────────────────────
const STATUS_MAP = {
  RECEIVED_BY_RECORDS:  { cls: 'badge-records',  label: 'At Records' },
  WITH_DIRECTOR:        { cls: 'badge-director', label: 'With Director' },
  WITH_DCE:             { cls: 'badge-dce',      label: 'With DCE' },
  RETURNED_TO_DIRECTOR: { cls: 'badge-director', label: 'Returned' },
  DISPATCHED_TO_DEPT:   { cls: 'badge-dept',     label: 'In Dept.' },
  CLOSED:               { cls: 'badge-closed',   label: 'Closed' },
  OUTGOING_DRAFT:       { cls: 'badge-outgoing', label: 'Draft' },
  OUTGOING_SENT:        { cls: 'badge-sent',     label: 'Sent' },
};

function statusBadge(status) {
  const { cls, label } = STATUS_MAP[status] || { cls: 'badge-records', label: status };
  return `<span class="badge ${cls}">${label}</span>`;
}

function typeBadge(type) {
  return type === 'INCOMING'
    ? `<span class="badge badge-incoming">↓ Incoming</span>`
    : `<span class="badge badge-outgoing">↑ Outgoing</span>`;
}

// ── Date formatting ──────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Toast notifications ──────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: 'var(--success-bg)', border: '#bbf7d0', color: 'var(--success)' },
    error:   { bg: 'var(--error-bg)',   border: 'var(--error-border)', color: 'var(--error)' },
    info:    { bg: 'var(--info-bg)',    border: '#bfdbfe', color: 'var(--info)' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `
    position:fixed; bottom:2rem; right:2rem; z-index:9999;
    background:${c.bg}; border:1px solid ${c.border}; color:${c.color};
    padding:.85rem 1.2rem; border-radius:10px; font-size:.88rem;
    font-family:var(--font-body); box-shadow:var(--shadow-md);
    animation:fade-up .3s ease both; max-width:340px; line-height:1.5;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Alert helper ─────────────────────────────────────────────
function showAlert(el, message, type = 'error') {
  el.className = `alert alert-${type}`;
  el.querySelector('span').textContent = message;
  el.classList.remove('hidden');
}

function hideAlert(el) { el.classList.add('hidden'); }

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Sidebar bootstrap ────────────────────────────────────────
function initSidebar(activeNav) {
  // Hide admin links by default; only ADMIN can see them.
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.hidden = true;
    el.style.display = 'none';
  });

  const user = Auth.user();
  if (!user) return;

  // User info
  document.getElementById('userName').textContent   = user.full_name || '—';
  document.getElementById('userRole').textContent   = (user.role || '').replace(/_/g, ' ').toLowerCase();
  document.getElementById('userAvatar').textContent = (user.full_name || 'U')[0].toUpperCase();

  // Active nav item
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const active = document.getElementById(activeNav);
  if (active) active.classList.add('active');

  // Admin-only links
  if (user.role === 'ADMIN') {
    document.querySelectorAll('.admin-only').forEach((el) => {
      el.hidden = false;
      el.style.display = '';
    });
  }

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', Auth.logout);

  // Header date
  const el = document.getElementById('headerDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-GH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // Notifications dot
  loadNotifDot();
}

async function loadNotifDot() {
  try {
    const res  = await apiFetch('/notifications/?unread_only=true');
    const data = await res.json();
    const hasUnread = Array.isArray(data) && data.length > 0;
    if (hasUnread) {
      document.getElementById('notifDot')?.classList.add('show');
      const navBadge = document.getElementById('notifNavBadge');
      if (navBadge) { navBadge.textContent = data.length; navBadge.style.display = ''; }
    }
    // Wire all notification bell buttons on the page to go to notifications.html
    document.querySelectorAll('.notif-btn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = 'notifications.html'; });
    });
  } catch (_) {}
}

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Role checks ───────────────────────────────────────────────
function hasRole(...roles) {
  return roles.includes(Auth.user()?.role);
}

function canLog()      { return hasRole('RECORDS', 'ADMIN'); }
function canForward()  { return hasRole('RECORDS', 'ADMIN'); }
function isDirector()  { return hasRole('DIRECTOR', 'ADMIN'); }
function isDCE()       { return hasRole('DCE', 'ADMIN'); }
function isAdmin()     { return hasRole('ADMIN'); }
