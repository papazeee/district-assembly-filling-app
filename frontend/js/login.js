Auth.redirectIfAuthenticated('dashboard.html');

const pwInput = document.getElementById('password');
const togglePw = document.getElementById('togglePw');
const eyeIcon = document.getElementById('eyeIcon');

togglePw.addEventListener('click', () => {
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  eyeIcon.innerHTML = show
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const banner = document.getElementById('errorBanner');
  const errMsg = document.getElementById('errorMsg');

  banner.classList.remove('show');
  btn.classList.add('loading');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await Auth.login(email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errMsg.textContent = err?.message || 'Cannot reach server. Please try again.';
    banner.classList.add('show');
  } finally {
    btn.classList.remove('loading');
  }
});
