/* ═══════════════════════════════════════════════════════════
   users.js  |  User management page logic (admin only)
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
if (!isAdminOrTestUser()) { window.location.href = 'dashboard.html'; }
document.addEventListener('DOMContentLoaded', () => {
  initSidebar('nav-users');
  if (isTestUser()) {
    const btn = document.getElementById('openCreateBtn');
    if (btn) { btn.hidden = true; btn.style.display = 'none'; }
  }
});

let allUsers    = [];
let departments = [];

const ROLE_LABELS = {
  ADMIN:           'Admin',
  RECORDS:         'Records Officer',
  DIRECTOR:        'Director',
  DCE:             'DCE',
  DEPARTMENT_HEAD: 'Dept. Head',
  TEST_USER:       'Test User',
};

async function readResponseError(res, fallbackMessage) {
  if (!res) return fallbackMessage;

  const raw = await res.text();
  if (!raw) return fallbackMessage;

  try {
    const data = JSON.parse(raw);
    return data.detail || data.message || fallbackMessage;
  } catch {
    return raw.trim() || fallbackMessage;
  }
}

// ── Load data ─────────────────────────────────────────────────
async function loadUsers() {
  const res = await apiFetch('/users/');
  if (!res || !res.ok) {
    showToast(await readResponseError(res, 'Failed to load users.'), 'error');
    return;
  }
  allUsers  = await res.json();
  renderTable(allUsers);
}

async function loadDepartments() {
  const res   = await apiFetch('/departments/');
  if (!res || !res.ok) {
    showToast(await readResponseError(res, 'Failed to load departments.'), 'error');
    return;
  }
  departments = await res.json();
  const sel   = document.getElementById('f_department_id');
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value       = d.id;
    opt.textContent = `${d.name} (${d.code})`;
    sel.appendChild(opt);
  });
}

// ── Render ────────────────────────────────────────────────────
function renderTable(users) {
  const tbody   = document.getElementById('usersBody');
  const search  = document.getElementById('searchInput').value.toLowerCase();
  const filtered = search
    ? users.filter(u => u.full_name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
    : users;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><h3>No users found</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div style="width:32px;height:32px;background:var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:var(--green-dark);flex-shrink:0;">${u.full_name[0].toUpperCase()}</div>
          <span style="font-weight:500;">${u.full_name}</span>
        </div>
      </td>
      <td style="color:var(--muted);">${u.email}</td>
      <td><span class="badge badge-records">${ROLE_LABELS[u.role] || u.role}</span></td>
      <td>${u.department?.name || '—'}</td>
      <td>
        <span class="badge ${u.is_active ? 'badge-closed' : 'badge-outgoing'}">${u.is_active ? 'Active' : 'Inactive'}</span>
      </td>
      <td>
        ${canAdminWrite()
          ? `<div class="td-actions">
               <button class="btn btn-outline btn-sm" onclick="editUser(${u.id})">Edit</button>
               ${u.id !== Auth.user()?.id
                 ? `<button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleActive(${u.id}, ${u.is_active}, '${u.full_name}')">${u.is_active ? 'Deactivate' : 'Activate'}</button>`
                 : ''}
             </div>`
          : '<span style="color:var(--muted);font-size:.8rem;font-style:italic;">View only</span>'}
      </td>
    </tr>
  `).join('');
}

// ── Create user ───────────────────────────────────────────────
document.getElementById('openCreateBtn').addEventListener('click', () => {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('editUserId').value = '';
  document.getElementById('passwordGroup').style.display = '';
  document.getElementById('f_password').required = true;
  document.getElementById('userAlert').classList.add('hidden');
  openModal('userModal');
});

// ── Edit user ─────────────────────────────────────────────────
function editUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;

  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('editUserId').value    = id;
  document.getElementById('f_full_name').value   = user.full_name;
  document.getElementById('f_email').value       = user.email;
  document.getElementById('f_role').value        = user.role;
  document.getElementById('f_department_id').value = user.department_id || '';
  document.getElementById('passwordGroup').style.display = 'none';
  document.getElementById('f_password').required = false;
  document.getElementById('userAlert').classList.add('hidden');
  openModal('userModal');
}

// ── Save user ─────────────────────────────────────────────────
document.getElementById('userSubmitBtn').addEventListener('click', async () => {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  const btn     = document.getElementById('userSubmitBtn');
  const alert   = document.getElementById('userAlert');
  const editId  = document.getElementById('editUserId').value;
  const isEdit  = !!editId;

  const full_name     = document.getElementById('f_full_name').value.trim();
  const email         = document.getElementById('f_email').value.trim();
  const role          = document.getElementById('f_role').value;
  const department_id = document.getElementById('f_department_id').value;
  const password      = document.getElementById('f_password').value;

  if (!full_name || !email || !role || (!isEdit && !password)) {
    showAlert(alert, 'Please fill in all required fields.');
    return;
  }

  btn.classList.add('loading');
  hideAlert(alert);

  try {
    let url, method, body;
    if (isEdit) {
      url    = `/users/id/${editId}`;
      method = 'PATCH';
      body   = { full_name, email, role, department_id: department_id ? parseInt(department_id) : null };
    } else {
      url    = '/users/';
      method = 'POST';
      body   = { full_name, email, password, role, department_id: department_id ? parseInt(department_id) : null };
    }

    const res = await apiFetch(url, { method, body: JSON.stringify(body) });

    if (!res.ok) {
      showAlert(alert, await readResponseError(res, 'Failed to save user.'));
      return;
    }

    showToast(isEdit ? 'User updated successfully' : 'User created successfully', 'success');
    closeModal('userModal');
    loadUsers();

  } catch (err) {
    showAlert(alert, err?.message || 'Network error. Please try again.');
  } finally {
    btn.classList.remove('loading');
  }
});

// ── Deactivate user ───────────────────────────────────────────
/*
async function deactivateUser(id, name) {
  if (!confirm(`Deactivate account for ${name}? They will no longer be able to log in.`)) return;
  const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (res.ok || res.status === 204) {
    showToast(`${name} has been deactivated`, 'success');
    loadUsers();
  } else {
    const err = await res.json();
    showToast(err.detail || 'Failed to deactivate', 'error');
  }
    
}*/

// Toggle active
async function toggleActive(id, isActive, name) {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  const action = isActive ? 'deactivate' : 'activate';
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${name}?`)) return;
  const res = await apiFetch(`/users/id/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: !isActive }),
  });
  if (res.ok) { showToast(`User ${action}u`, 'success'); loadUsers(); }
  else { showToast('Failed to update user', 'error'); }
}

// ── Filters ───────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', () => renderTable(allUsers));
document.getElementById('refreshBtn').addEventListener('click', loadUsers);

// ── Init ──────────────────────────────────────────────────────
loadUsers();
loadDepartments(); 
