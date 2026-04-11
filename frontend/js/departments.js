/* ═══════════════════════════════════════════════════════════
   departments.js  |  Departments page logic (admin only)
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
if (!isAdminOrTestUser()) {
  window.location.href = 'dashboard.html';
}
document.addEventListener('DOMContentLoaded', () => {
  initSidebar('nav-departments');
  if (isTestUser()) {
    const btn = document.getElementById('openCreateBtn');
    if (btn) { btn.hidden = true; btn.style.display = 'none'; }
  }
});

let allDepts = [];

async function loadDepts() {
  const res = await apiFetch('/departments');
  if (!res || !res.ok) {
    showToast('Failed to load departments', 'error');
    return;
  }
  allDepts = await res.json();
  renderTable(allDepts);
}

function renderTable(depts) {
  const tbody = document.getElementById('deptsBody');
  if (!Array.isArray(depts) || depts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><h3>No departments yet</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = depts.map((d) => `
    <tr>
      <td style="font-weight:500;">${d.name}</td>
      <td><span style="font-family:monospace;background:var(--cream);padding:.2rem .5rem;border-radius:4px;font-size:.8rem;">${d.code}</span></td>
      <td style="color:var(--muted);max-width:280px;">${d.description || '—'}</td>
      <td><span class="badge ${d.is_active ? 'badge-closed' : 'badge-outgoing'}">${d.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${canAdminWrite()
          ? `<div class="td-actions">
               <button class="btn btn-outline btn-sm" onclick="editDept(${d.id})">Edit</button>
               <button class="btn btn-sm ${d.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleActive(${d.id}, ${d.is_active}, '${d.name}')">${d.is_active ? 'Deactivate' : 'Activate'}</button>
             </div>`
          : '<span style="color:var(--muted);font-size:.8rem;font-style:italic;">View only</span>'}
      </td>
    </tr>
  `).join('');
}

document.getElementById('openCreateBtn').addEventListener('click', () => {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  document.getElementById('deptModalTitle').textContent = 'Add Department';
  document.getElementById('deptForm').reset();
  document.getElementById('editDeptId').value = '';
  document.getElementById('deptAlert').classList.add('hidden');
  openModal('deptModal');
});

function editDept(id) {
  const dept = allDepts.find((d) => d.id === id);
  if (!dept) return;

  document.getElementById('deptModalTitle').textContent = 'Edit Department';
  document.getElementById('editDeptId').value = id;
  document.getElementById('f_name').value = dept.name;
  document.getElementById('f_code').value = dept.code;
  document.getElementById('f_description').value = dept.description || '';
  document.getElementById('deptAlert').classList.add('hidden');
  openModal('deptModal');
}

document.getElementById('deptSubmitBtn').addEventListener('click', async () => {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  const btn = document.getElementById('deptSubmitBtn');
  const alert = document.getElementById('deptAlert');
  const editId = document.getElementById('editDeptId').value;
  const isEdit = !!editId;

  const name = document.getElementById('f_name').value.trim();
  const code = document.getElementById('f_code').value.trim().toUpperCase();
  const description = document.getElementById('f_description').value.trim();

  if (!name || !code) {
    showAlert(alert, 'Name and code are required.');
    return;
  }

  btn.classList.add('loading');
  hideAlert(alert);

  try {
    const url = isEdit ? `/departments/id/${editId}` : '/departments/';
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({ name, code, description }),
    });

    if (!res || !res.ok) {
      const err = res ? await res.json() : {};
      showAlert(alert, err.detail || 'Failed to save department.');
      return;
    }

    showToast(isEdit ? 'Department updated' : 'Department created', 'success');
    closeModal('deptModal');
    loadDepts();
  } catch {
    showAlert(alert, 'Network error.');
  } finally {
    btn.classList.remove('loading');
  }
});

async function toggleActive(id, isActive, name) {
  if (isTestUser()) {
    showToast('Test users do not have permission to make changes in this section. Please contact an administrator for assistance.', 'error');
    return;
  }
  const action = isActive ? 'deactivate' : 'activate';
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${name}?`)) return;

  const res = await apiFetch(`/departments/id/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: !isActive }),
  });

  if (res && res.ok) {
    showToast(`Department ${action}d`, 'success');
    loadDepts();
  } else {
    showToast('Failed to update department', 'error');
  }
}

loadDepts();
