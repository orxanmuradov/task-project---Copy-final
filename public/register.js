 document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('http://localhost:3000/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                errorMessage.textContent = data.error || 'Qeydiyyat zamanı xəta baş verdi.';
            } else {
                // Qeydiyyat Uğurludur!
                alert('Qeydiyyat uğurla tamamlandı! İndi daxil ola bilərsiniz.');
                // Giriş səhifəsinə yönləndir
                window.location.href = 'login.html'; 
            }

        } catch (error) {
            console.error('Qeydiyyat xətası:', error);
            errorMessage.textContent = 'Serverə qoşulma mümkün olmadı.';
        }
    });
});