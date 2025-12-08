




document.addEventListener('DOMContentLoaded', () => {

    // === 0. QLOBAL DƏYİŞƏNLƏR (Excel üçün dataları burada saxlayırıq) ===
    let globalUsersData = [];
    let globalTasksData = [];

    // === TƏHLÜKƏSİZLİK YOXLAMASI ===
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) { return null; }
    }
    const userPayload = parseJwt(token);

    if (!userPayload || userPayload.role !== 'admin') {
        alert('İcazəniz yoxdur! Bu səhifə yalnız adminlər üçündür.');
        window.location.href = 'index.html';
        return;
    }
    
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

    // === 1. Elementləri Seçmək ===
    const usersTableBody = document.getElementById('users-table-body');
    const tasksTableBody = document.getElementById('tasks-table-body');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Excel Düymələri
    const exportUsersBtn = document.getElementById('export-users-btn');
    const exportTasksBtn = document.getElementById('export-tasks-btn');

    // === 2. Çıxış (Logout) ===
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
    
    // === 3. Bütün İstifadəçiləri Gətir ===
    async function fetchUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: authHeaders
            });
            
            if (handleAuthError(response)) return; 
            
            const data = await response.json();
            
            // Datanı Qlobal Dəyişənə yazırıq (Excel üçün)
            globalUsersData = data.users || [];

            usersTableBody.innerHTML = ''; 
            if(globalUsersData.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="4">İstifadəçi tapılmadı</td></tr>';
                return;
            }

            globalUsersData.forEach(user => {
                const tr = document.createElement('tr');
                let roleChangeButton = '';
                if (user.id !== userPayload.id) { 
                    const isCurrentlyAdmin = user.role === 'admin';
                    const newRole = isCurrentlyAdmin ? 'user' : 'admin';
                    const buttonText = isCurrentlyAdmin ? 'İstifadəçi et' : 'Admin et';
                    roleChangeButton = `<button class="action-btn btn-role" 
                                data-id="${user.id}" data-new-role="${newRole}">
                            ${buttonText}
                        </button>`;
                }
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>
                        <button class="action-btn btn-reset" data-id="${user.id}" data-username="${user.username}">Parolu Resetlə</button>
                        <button class="action-btn btn-delete" data-id="${user.id}" data-username="${user.username}">İstifadəçini Sil</button>
                        ${roleChangeButton}
                    </td>
                `;
                usersTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error("İstifadəçilər gətirilərkən xəta:", error);
        }
    }

    // === 4. Bütün Tapşırıqları Gətir ===
    async function fetchTasks() {
        try {
            const response = await fetch('/api/admin/tasks', {
                method: 'GET',
                headers: authHeaders
            });
            
            if (handleAuthError(response)) return; 
            
            const data = await response.json();

            // Datanı Qlobal Dəyişənə yazırıq (Excel üçün)
            globalTasksData = data.tasks || [];

            tasksTableBody.innerHTML = '';
            if(globalTasksData.length === 0) {
                tasksTableBody.innerHTML = '<tr><td colspan="6">Tapşırıq tapılmadı</td></tr>';
                return;
            }

            globalTasksData.forEach(task => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${task.id}</td>
                    <td>${task.title}</td>
                    <td>${task.status}</td>
                    <td>${task.username} (ID: ${task.user_id})</td>
                    <td>${task.due_date || 'N/A'}</td>
                    <td>${task.description || 'N/A'}</td>
                `;
                tasksTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error("Tapşırıqlar gətirilərkən xəta:", error);
        }
    }

    // === 5. EXCEL EXPORT FUNKSİYASI (SÜTUNLARI NİZAMLAYAN) ===
    function exportToExcel(data, filename, sheetName) {
        if (!data || data.length === 0) {
            alert("Yükləmək üçün məlumat yoxdur!");
            return;
        }

        // 1. Datanı Excel vərəqinə çevir
        const worksheet = XLSX.utils.json_to_sheet(data);

        // === Sütun Genişliyini Avtomatik Tənzimləmək ===
        const keys = Object.keys(data[0]); // Başlıqları götürürük
        const colWidths = keys.map(key => {
            // Hər sütun üçün ən uzun mətni tapırıq
            const maxContentLength = Math.max(
                ...data.map(row => (row[key] ? row[key].toString().length : 0)),
                key.length
            );
            // Genişliyə 5 simvol boşluq əlavə edirik
            return { wch: maxContentLength + 5 };
        });

        // Hesablanmış genişlikləri vərəqə tətbiq edirik
        worksheet['!cols'] = colWidths;
        // ===============================================

        // 2. Yeni İş Kitabı (Workbook) yarat
        const workbook = XLSX.utils.book_new();

        // 3. Vərəqi kitaba əlavə et
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // 4. Faylı yüklə
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    // Düymə Hadisələri (Event Listeners)
    if (exportUsersBtn) {
        exportUsersBtn.addEventListener('click', () => {
            // Səliqəli data hazırlayırıq
            const cleanUsers = globalUsersData.map(u => ({
                "ID": u.id,
                "İstifadəçi Adı": u.username,
                "Rol": u.role
            }));
            exportToExcel(cleanUsers, "Istifadeciler_Report", "Istifadeciler");
        });
    }

    if (exportTasksBtn) {
        exportTasksBtn.addEventListener('click', () => {
            // Səliqəli data hazırlayırıq
            const cleanTasks = globalTasksData.map(t => ({
                "Task ID": t.id,
                "Başlıq": t.title,
                "Status": t.status,
                "Kateqoriya": t.category,
                "İstifadəçi": t.username,
                "Son Tarix": t.due_date,
                "Qeyd": t.description
            }));
            exportToExcel(cleanTasks, "Tapsiriqlar_Report", "Tapsiriqlar");
        });
    }

    // === 6. Düymə Klikləri (Sil, Reset, Rol) ===
    usersTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        // Silmək
        if (target.classList.contains('btn-delete')) {
            const username = target.dataset.username;
            if (username === 'admin' || userPayload.username === username) {
                alert("Siz admin rolunda olan istifadəçini və ya özünüzü silə bilməzsiniz!");
                return;
            }
            if (!confirm(`'${username}' adlı istifadəçini silməyə əminsiniz?`)) return;
            
            try {
                const response = await fetch(`/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: authHeaders
                });
                if (handleAuthError(response)) return;
                const data = await response.json();
                alert(data.message || data.error);
                fetchUsers(); 
                fetchTasks(); 
            } catch (error) { console.error("Xəta:", error); }
        }

        // Parol Reset
        if (target.classList.contains('btn-reset')) {
            const username = target.dataset.username;
            const newPassword = prompt(`'${username}' üçün yeni parol daxil edin:`);
            if (!newPassword) return;

            try {
                const response = await fetch(`/api/admin/users/${id}/reset-password`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({ newPassword: newPassword })
                });
                if (handleAuthError(response)) return;
                const data = await response.json();
                alert(data.message || data.error);
            } catch (error) { console.error("Xəta:", error); }
        }

        // Rol Dəyişmək
        if (target.classList.contains('btn-role')) {
            const newRole = target.dataset.newRole;
            if (!confirm(`Rolu dəyişməyə əminsiniz?`)) return;

            try {
                const response = await fetch(`/api/admin/users/${id}/role`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify({ newRole: newRole })
                });
                if (handleAuthError(response)) return;
                const data = await response.json();
                alert(data.message || data.error);
                if (response.ok) fetchUsers(); 
            } catch (error) { console.error("Xəta:", error); }
        }
    });

    // === 7. Səhifəni Başlat ===
    fetchUsers(); 
    fetchTasks(); 
});