 document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = ''; // Xəta mesajını təmizlə

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Əgər server xəta qaytarsa (400, 500)
                errorMessage.textContent = data.error || 'Giriş zamanı xəta baş verdi.';
            } else {
                // Giriş Uğurludur!
                // 1. "Açar"ı (token) brauzerin yaddaşında saxla
                localStorage.setItem('token', data.token);
                
                // 2. Əsas proqram səhifəsinə yönləndir
                window.location.href = 'index.html'; 
            }

        } catch (error) {
            console.error('Giriş xətası:', error);
            errorMessage.textContent = 'Serverə qoşulma mümkün olmadı.';
        }
    });
});