/* ═══════════════════════════════════════════════════════════
   profile.js  |  My Profile & Change Password page logic
   ═══════════════════════════════════════════════════════════ */

Auth.guard();
document.addEventListener('DOMContentLoaded', () => initSidebar('nav-profile'));

// ── Populate profile info from local session ──────────────────
const user = Auth.user();
if (user) {
  document.getElementById('profileName').textContent  = user.full_name || '—';
  document.getElementById('profileEmail').textContent = user.email || '—';
  document.getElementById('profileRole').textContent  = (user.role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  document.getElementById('profileDept').textContent  = user.department?.name || '—';
}

// Wire notification bell
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ── Change password ───────────────────────────────────────────
document.getElementById('changePasswordBtn').addEventListener('click', async () => {
  const btn         = document.getElementById('changePasswordBtn');
  const alertEl     = document.getElementById('pwAlert');
  const successEl   = document.getElementById('pwSuccess');
  const currentPw   = document.getElementById('f_current_password').value.trim();
  const newPw       = document.getElementById('f_new_password').value.trim();
  const confirmPw   = document.getElementById('f_confirm_password').value.trim();

  // Reset alerts
  alertEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!currentPw || !newPw || !confirmPw) {
    showAlert(alertEl, 'Please fill in all fields.');
    return;
  }

  if (newPw.length < 8) {
    showAlert(alertEl, 'New password must be at least 8 characters.');
    return;
  }

  if (newPw !== confirmPw) {
    showAlert(alertEl, 'New passwords do not match.');
    return;
  }

  btn.classList.add('loading');

  try {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPw,
        new_password: newPw,
      }),
    });

    if (!res || !res.ok) {
      const err = await res.json().catch(() => ({}));
      showAlert(alertEl, err.detail || 'Failed to change password. Check your current password.');
      return;
    }

    successEl.classList.remove('hidden');
    document.getElementById('pwForm').reset();
    showToast('Password updated successfully.', 'success');

  } catch {
    showAlert(alertEl, 'Network error. Please try again.');
  } finally {
    btn.classList.remove('loading');
  }
});
