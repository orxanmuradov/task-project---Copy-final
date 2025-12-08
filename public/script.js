document.addEventListener('DOMContentLoaded', () => {
    
    // === 0. TƏHLÜKƏSİZLİK VƏ TOKEN ===
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return; 
    }
    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }
    const userPayload = parseJwt(token);
    
    // === 1. Elementləri seçmək ===
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskCategorySelect = document.getElementById('task-category');
    const taskList = document.getElementById('task-list');
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeMessage = document.getElementById('welcome-message');
    // ... (Modal elementləri)
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editTaskId = document.getElementById('edit-task-id');
    const editTaskTitle = document.getElementById('edit-task-title');
    const editTaskDescription = document.getElementById('edit-task-description');
    const editTaskDate = document.getElementById('edit-task-date');

    const API_URL = '/api/tasks';
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            alert('Sessiyanızın vaxtı bitib. Zəhmət olmasa, yenidən daxil olun.');
            localStorage.removeItem('token'); 
            window.location.href = 'login.html'; 
            return true;
        }
        return false;
    }

    // === YENİLƏNDİ: 2. Kateqoriyaya görə ikon VƏ RƏNG ===
    // Artıq sadəcə ikon yox, həm də CSS klası qaytarırıq
    function getCategoryIcon(category) {
        switch (category) {
            case 'work': 
                return { icon: '<i class="fas fa-briefcase"></i>', bgClass: 'icon-bg-work' };
            case 'home': 
                return { icon: '<i class="fas fa-home"></i>', bgClass: 'icon-bg-home' };
            case 'shopping': 
                return { icon: '<i class="fas fa-shopping-cart"></i>', bgClass: 'icon-bg-shopping' };
            default: 
                return { icon: '<i class="fas fa-grip-horizontal"></i>', bgClass: 'icon-bg-general' };
        }
    }

    // === YENİLƏNDİ: 3. Tapşırığı Səhifəyə Əlavə Et ===
    function addSingleTaskToDOM(task, prepend = false) {
        const li = document.createElement('li');
        li.className = task.status === 'completed' ? 'completed' : '';
        li.dataset.id = task.id;

        const statusIcon = task.status === 'completed' ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>';
        
        // YENİ: Həm ikonu, həm də rəng klasını alırıq
        const categoryInfo = getCategoryIcon(task.category);

        let metaIcons = '<div class="task-meta-icons">';
        if (task.description) {
            metaIcons += '<i class="fas fa-align-left" title="Qeyd var"></i>';
        }
        if (task.due_date) {
            metaIcons += '<i class="fas fa-calendar-alt" title="Son tarix var"></i>';
        }
        metaIcons += '</div>';

        // YENİ: İkon div-inə 'bgClass'-ı əlavə edirik
        li.innerHTML = `
            <div class="task-category-icon ${categoryInfo.bgClass}" title="Kateqoriya: ${task.category}">
                ${categoryInfo.icon}
            </div>
            <span class="task-title">${task.title}</span>
            ${metaIcons}
            <div class="actions">
                <button class="status-btn ${task.status}" title="Statusu dəyiş">${statusIcon}</button>
                <button class="delete-btn" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        if (prepend) taskList.prepend(li); else taskList.appendChild(li);
    }

    // === 4. Bütün tapşırıqları serverdən çək ===
    async function fetchTasks() {
        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: authHeaders
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            taskList.innerHTML = ''; 
            data.tasks.forEach(task => addSingleTaskToDOM(task));
        } catch (error) {
            console.error('Tapşırıqları gətirərkən xəta:', error);
        }
    }

    // === 5. Yeni tapşırıq əlavə et ===
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskInput.value;
        const category = taskCategorySelect.value;
        if (!title) return;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ title, category }) 
            });
            if (handleAuthError(response)) return;
            const newTask = await response.json();
            addSingleTaskToDOM(newTask, true); 
            taskInput.value = '';
        } catch (error) {
            console.error('Tapşırıq əlavə edərkən xəta:', error);
        }
    });

    // === 6. Modal Pəncərəni Açmaq ===
    async function openEditModal(id) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'GET',
                headers: authHeaders
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            if (!data.task) return;
            
            const task = data.task;
            editTaskId.value = task.id;
            editTaskTitle.value = task.title;
            editTaskDescription.value = task.description || '';
            editTaskDate.value = task.due_date || '';
            editModal.style.display = 'flex';
        } catch (error) {
            console.error('Tapşırıq detalları alınarkən xəta:', error);
        }
    }

    // === 7. Modal Pəncərəni Bağlamaq ===
    function closeEditModal() {
        editModal.style.display = 'none';
        editForm.reset(); 
        editTaskId.value = '';
    }
    cancelEditBtn.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // === 8. Modalda "Yadda Saxla" ===
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editTaskId.value;
        const updatedTask = {
            title: editTaskTitle.value,
            description: editTaskDescription.value,
            due_date: editTaskDate.value
        };

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify(updatedTask)
            });
            if (handleAuthError(response)) return;

            const li = taskList.querySelector(`li[data-id="${id}"]`);
            if (li) {
                li.querySelector('.task-title').textContent = updatedTask.title;
                let metaIcons = '';
                if (updatedTask.description) metaIcons += '<i class="fas fa-align-left" title="Qeyd var"></i>';
                if (updatedTask.due_date) metaIcons += '<i class="fas fa-calendar-alt" title="Son tarix var"></i>';
                li.querySelector('.task-meta-icons').innerHTML = metaIcons;
            }
            closeEditModal();
        } catch (error) {
            console.error('Tapşırıq yenilənərkən xəta:', error);
        }
    });

    // === 9. Siyahıdakı Əsas Kliklər (Sil/Status/Detallar) ===
    taskList.addEventListener('click', async (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = li.dataset.id;

        // Silmək
        if (e.target.closest('.delete-btn')) {
            if (!confirm("Bu tapşırığı silməyə əminsiniz?")) return;
            try {
                const response = await fetch(`${API_URL}/${id}`, { 
                    method: 'DELETE',
                    headers: authHeaders 
                });
                if (handleAuthError(response)) return;
                li.remove();
            } catch (error) { console.error('Tapşırıq silinərkən xəta:', error); }
            return; 
        }

        // Statusu dəyişmək
        const statusBtn = e.target.closest('.status-btn');
        if (statusBtn) {
            const isCompleted = li.classList.contains('completed');
            const newStatus = isCompleted ? 'pending' : 'completed';
            try {
                const response = await fetch(`${API_URL}/${id}/status`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({ status: newStatus })
                });
                if (handleAuthError(response)) return;
                
                li.classList.toggle('completed');
                statusBtn.classList.toggle('pending');
                statusBtn.innerHTML = newStatus === 'completed' ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>';
            } catch (error) { console.error('Status yenilənərkən xəta:', error); }
            return;
        }

        // Detalları açmaq
        if (e.target.closest('.task-title') && !li.classList.contains('completed')) {
            openEditModal(id);
        }
    });

    // === 10. Çıxış (Logout) ===
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token'); 
        window.location.href = 'login.html'; 
    });

    // === 11. Proqramı Başlat ===
    if (userPayload && userPayload.username) {
        welcomeMessage.textContent = `Xoş gəldin, ${userPayload.username}!`;
    }
    fetchTasks();
});