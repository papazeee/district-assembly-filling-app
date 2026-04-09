Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar('nav-dashboard'));

const user = Auth.user();
const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

document.getElementById('welcomeMsg').textContent = `${greeting}, ${user?.full_name?.split(' ')[0] || ''}`;
document.getElementById('todayDate').textContent = now.toLocaleDateString('en-GH', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function dashboardStatusBadge(status) {
  const { cls, label } = STATUS_MAP[status] || { cls: 'badge-records', label: status };
  return `<span class="badge-status ${cls}">${label}</span>`;
}

async function loadDashboard() {
  try {
    const [lettersRes, notifsRes] = await Promise.all([
      apiFetch('/letters/?limit=200'),
      apiFetch('/notifications/?unread_only=true'),
    ]);

    // A 401 triggers logout in apiFetch; stop work on this page.
    if (!lettersRes || !notifsRes) {
      console.warn('API response missing - possibly logged out');
      return;
    }

    // Check for HTTP errors
    if (!lettersRes.ok) {
      console.error('Letters API error:', lettersRes.status, lettersRes.statusText);
      return;
    }
    if (!notifsRes.ok) {
      console.error('Notifications API error:', notifsRes.status, notifsRes.statusText);
      return;
    }

    const [allLetters, notifs] = await Promise.all([
      lettersRes.json(),
      notifsRes.json(),
    ]);

    const letters = Array.isArray(allLetters) ? allLetters : [];
    const year = new Date().getFullYear();

    const incoming = letters.filter((l) => l.letter_type === 'INCOMING');
    const outgoing = letters.filter((l) => l.letter_type === 'OUTGOING');
    const pending = letters.filter((l) => !['CLOSED', 'OUTGOING_SENT'].includes(l.status));
    const withDCE = letters.filter((l) => l.status === 'WITH_DCE');

    document.getElementById('statIncoming').textContent = incoming.length;
    document.getElementById('statOutgoing').textContent = outgoing.length;
    document.getElementById('statPending').textContent = pending.length;
    document.getElementById('statWithDCE').textContent = withDCE.length;
    document.getElementById('statIncomingYear').textContent = `${year} year to date`;
    document.getElementById('statOutgoingYear').textContent = `${year} year to date`;

    if (Array.isArray(notifs) && notifs.length > 0) {
      document.getElementById('notifDot').classList.add('show');
    }

    if (pending.length > 0) {
      const badge = document.getElementById('incomingBadge');
      badge.hidden = false;
      badge.style.display = '';
      badge.textContent = pending.length;
    }

    const recent = [...letters]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    const tbody = document.getElementById('recentLettersBody');
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No letters logged yet</p>
      </div></td></tr>`;
    } else {
      tbody.innerHTML = recent.map((l) => `
        <tr>
          <td><span class="serial">${l.serial_number}</span></td>
          <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${l.subject}">${l.subject}</td>
          <td>${l.letter_type === 'INCOMING' ? '↓ In' : '↑ Out'}</td>
          <td>${dashboardStatusBadge(l.status)}</td>
          <td>${fmtDate(l.date_received || l.date_sent || l.created_at)}</td>
        </tr>
      `).join('');
    }

    const workflowStages = [
      { key: 'RECEIVED_BY_RECORDS', label: 'At Records', sub: 'Awaiting forwarding', bg: '#e0f0e8', color: '#1a5c2e', icon: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>` },
      { key: 'WITH_DIRECTOR', label: 'With Director', sub: 'Awaiting review', bg: '#e0eaff', color: '#2563eb', icon: `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
      { key: 'WITH_DCE', label: 'With DCE', sub: 'Awaiting decision', bg: '#fef3c7', color: '#b45309', icon: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>` },
      { key: 'RETURNED_TO_DIRECTOR', label: 'Returned', sub: 'Back with Director', bg: '#fff0e0', color: '#c05621', icon: `<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102 2"/>` },
      { key: 'DISPATCHED_TO_DEPT', label: 'In Department', sub: 'Action in progress', bg: '#f3e8ff', color: '#7c3aed', icon: `<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
      { key: 'CLOSED', label: 'Closed', sub: 'Resolved letters', bg: '#f0fdf4', color: '#15803d', icon: `<polyline points="20 6 9 17 4 12"/>` },
    ];

    document.getElementById('workflowList').innerHTML = workflowStages.map((s) => {
      const count = letters.filter((l) => l.status === s.key).length;
      return `
        <div class="workflow-item">
          <div class="wf-icon" style="background:${s.bg};color:${s.color}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
          </div>
          <div>
            <div class="wf-label">${s.label}</div>
            <div class="wf-sub">${s.sub}</div>
          </div>
          <div class="wf-count" style="color:${s.color}">${count}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Dashboard load error:', err.message, err);
    console.error('API endpoint:', API);
    console.error('Stack:', err.stack);
    
    // Show user-friendly error message
    showToast(`Failed to load dashboard data: ${err.message}. Check console for details.`, 'error');
  }
}

loadDashboard();
