/* ═══════════════════════════════════════════════════════════
   notifications.js  |  Notifications page logic
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar('nav-notifications'));

let allNotifs = [];

async function loadNotifications() {
  const list = document.getElementById('notifList');
  try {
    const res = await apiFetch('/notifications/');
    allNotifs = await res.json();

    if (!Array.isArray(allNotifs) || allNotifs.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1rem;">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <h3>All caught up</h3>
          <p>No notifications at the moment.</p>
        </div>`;
      return;
    }

    list.innerHTML = allNotifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'notif-item--unread'}" data-id="${n.id}" onclick="markRead(${n.id}, this)">
        <div class="notif-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="notif-content">
          <div class="notif-message">${n.message || 'You have a new notification.'}</div>
          <div class="notif-time">${fmtDateTime(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<span class="notif-unread-dot"></span>' : ''}
      </div>
    `).join('');

    // Update dot in header
    const unread = allNotifs.filter(n => !n.is_read);
    if (unread.length > 0) {
      document.getElementById('notifDot')?.classList.add('show');
    }
  } catch (err) {
    list.innerHTML = `<div class="alert alert-error" style="margin:1rem;"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 0a10 10 0 100 20A10 10 0 0010 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/></svg><span>Failed to load notifications.</span></div>`;
  }
}

async function markRead(id, el) {
  try {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    el.classList.remove('notif-item--unread');
    const dot = el.querySelector('.notif-unread-dot');
    if (dot) dot.remove();
    // Refresh dot in header
    const remaining = document.querySelectorAll('.notif-item--unread');
    if (remaining.length === 0) {
      document.getElementById('notifDot')?.classList.remove('show');
    }
  } catch (_) {}
}

document.getElementById('markAllReadBtn').addEventListener('click', async () => {
  try {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    document.querySelectorAll('.notif-item--unread').forEach(el => {
      el.classList.remove('notif-item--unread');
      const dot = el.querySelector('.notif-unread-dot');
      if (dot) dot.remove();
    });
    document.getElementById('notifDot')?.classList.remove('show');
    showToast('All notifications marked as read', 'success');
  } catch (_) {
    showToast('Failed to mark notifications as read', 'error');
  }
});

loadNotifications();
