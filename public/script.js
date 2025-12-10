 document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById("welcome-message").textContent = `Xoş gəldin, ${payload.username}`;
    } catch(e) {}

    document.getElementById("logout-btn").addEventListener("click", () => {
        localStorage.clear(); window.location.href = "login.html";
    });

    // Elementləri tapırıq
    const categorySelect = document.getElementById("task-category");
    const newCatContainer = document.getElementById("new-cat-container");
    const newCatInput = document.getElementById("new-cat-input");

    await loadCategories();
    await loadTasks();

    // 1. KATEQORİYALARI YÜKLƏMƏK
    async function loadCategories() {
        // Əvvəlcə standartları yazırıq
        categorySelect.innerHTML = `
            <option value="general">Ümumi</option>
            <option value="work">İş</option>
            <option value="home">Ev</option>
            <option value="shopping">Alış-veriş</option>
        `;

        // Bazadan gələnləri əlavə edirik
        try {
            const res = await fetch("/api/categories", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.categories) {
                data.categories.forEach(cat => {
                    const opt = document.createElement("option");
                    opt.value = cat.name.toLowerCase();
                    opt.textContent = cat.name;
                    categorySelect.appendChild(opt);
                });
            }
        } catch (e) {}

        // Sonda "Yeni Kateqoriya" seçimini qoyuruq
        const newOpt = document.createElement("option");
        newOpt.value = "new_category";
        newOpt.textContent = "+ Yeni Kateqoriya";
        newOpt.style.color = "#ffcc00"; // Sarı rəng
        newOpt.style.fontWeight = "bold";
        categorySelect.appendChild(newOpt);
    }

    // 2. SEÇİM DƏYİŞƏNDƏ İŞƏ DÜŞƏN KOD (Inputu Aç/Bağla)
    categorySelect.addEventListener("change", () => {
        if (categorySelect.value === "new_category") {
            newCatContainer.style.display = "block"; // Göstər
            newCatInput.focus(); // Kursoru içinə qoy
        } else {
            newCatContainer.style.display = "none"; // Gizlət
        }
    });

    // 3. TAPŞIRIQ ƏLAVƏ ET
    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        let title = document.getElementById("task-input").value;
        let category = categorySelect.value;

        // Əgər "Yeni Kateqoriya" seçilibsə
        if (category === "new_category") {
            const newCatName = newCatInput.value.trim();
            
            if (!newCatName) {
                alert("Zəhmət olmasa kateqoriya adını yazın!");
                return;
            }

            // Bazaya yeni kateqoriyanı əlavə et
            const catRes = await fetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ name: newCatName })
            });

            if (catRes.ok) {
                // Uğurlu olsa, siyahını yenilə və o kateqoriyanı seç
                category = newCatName.toLowerCase();
                await loadCategories(); 
                categorySelect.value = category; 
                newCatContainer.style.display = "none"; // Inputu gizlət
                newCatInput.value = ""; // İçini təmizlə
            } else {
                alert("Xəta: Kateqoriya yaradıla bilmədi");
                return;
            }
        }

        // Tapşırığı göndər
        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, category, description: "", due_date: null, parent_id: null })
        });

        if (res.ok) {
            document.getElementById("task-input").value = "";
            loadTasks();
        }
    });

    // --- SİYAHINI YÜKLƏMƏ MƏNTİQİ (Eyni qalır) ---
    async function loadTasks() {
        const res = await fetch("/api/tasks", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const list = document.getElementById("task-list");
        list.innerHTML = "";

        if (!data.tasks || data.tasks.length === 0) { list.innerHTML = "<li style='text-align:center; color:#555;'>Hələ tapşırıq yoxdur.</li>"; return; }

        const parents = data.tasks.filter(t => !t.parent_id);
        const children = data.tasks.filter(t => t.parent_id);

        parents.forEach(parent => {
            renderTask(parent, list, false);
            const myChildren = children.filter(c => c.parent_id === parent.id);
            myChildren.forEach(child => renderTask(child, list, true));
        });
    }

    function renderTask(task, listElement, isChild) {
        const li = document.createElement("li");
        li.id = `task-${task.id}`;
        if (task.status === 'completed') li.classList.add('completed');
        if (isChild) li.classList.add('sub-task-item');

        let dateDisplay = task.due_date ? `<i class="far fa-calendar-alt"></i> ${task.due_date}` : "";
        let recurDisplay = task.recurrence ? `<span class="recurrence-tag"><i class="fas fa-sync-alt"></i> ${translateRecurrence(task.recurrence)}</span>` : "";
        const descText = task.description ? task.description : `<span style="opacity:0.5; font-style:italic;">📝 Detallar üçün toxun...</span>`;
        
        // Kateqoriya adını düzgün göstər (Baş hərfi böyük)
        const standardCats = { 'general': 'Ümumi', 'work': 'İş', 'home': 'Ev', 'shopping': 'Alış-veriş' };
        const displayCat = standardCats[task.category] || task.category;

        li.innerHTML = `
            <div class="task-header">
                <div class="task-info" onclick="toggleAccordion(${task.id})">
                    <strong>
                        ${isChild ? '<i class="fas fa-level-up-alt fa-rotate-90 sub-task-icon"></i>' : ''} 
                        ${task.title} 
                        <i class="fas fa-chevron-down" style="font-size:0.8rem; color:#555; margin-left:5px;"></i>
                    </strong>
                    <div class="task-meta">
                        ${!isChild ? `<span class="badge" style="text-transform: capitalize;">${displayCat}</span>` : ''}
                        ${dateDisplay ? `<span style="margin-left:5px; color:${task.due_date ? '#ffcc00' : ''}">${dateDisplay}</span>` : ''}
                        ${recurDisplay}
                    </div>
                </div>
                <div class="actions">
                    <button onclick="toggleStatus(${task.id}, '${task.status}', '${task.recurrence}', '${task.title}', '${task.category}')" class="check-btn"><i class="fas ${task.status === 'completed' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
                    <button onclick="deleteTask(${task.id})" class="delete-btn"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="task-desc" id="desc-box-${task.id}" onclick="editDescription(event, ${task.id}, '${task.title}', '${task.due_date || ''}', '${task.recurrence || ''}', '${task.recurrence_end || ''}')">
                ${descText}
            </div>
        `;
        listElement.appendChild(li);
    }

    function translateRecurrence(type) { const dict = { 'daily': 'Hər gün', 'weekly': 'Həftəlik', 'monthly': 'Aylıq' }; return dict[type] || type; }
    window.toggleAccordion = (id) => { document.getElementById(`task-${id}`).classList.toggle("active"); };

    window.editDescription = (event, id, currentTitle, currentDate, currentRecur, currentRecurEnd) => {
        event.stopPropagation();
        const descBox = document.getElementById(`desc-box-${id}`);
        if (descBox.querySelector("textarea")) return;
        let currentText = descBox.innerText;
        if (currentText.includes("Detallar üçün")) currentText = "";

        descBox.innerHTML = `
            <div class="edit-container" onclick="event.stopPropagation()">
                <textarea class="edit-textarea" id="input-desc-${id}" placeholder="Qeyd yaz...">${currentText}</textarea>
                <div class="extra-options">
                    <div class="option-group"><label>Son Tarix:</label><input type="date" id="input-date-${id}" value="${currentDate}" class="small-input"></div>
                    <div class="option-group"><label>Təkrar:</label><select id="input-recur-${id}" class="small-select"><option value="">Yoxdur</option><option value="daily" ${currentRecur==='daily'?'selected':''}>Hər gün</option><option value="weekly" ${currentRecur==='weekly'?'selected':''}>Həftəlik</option><option value="monthly" ${currentRecur==='monthly'?'selected':''}>Aylıq</option></select></div>
                </div>
                <button class="subtask-btn" onclick="addSubtask(${id})"><i class="fas fa-level-down-alt"></i> Alt Tapşırıq Əlavə Et</button>
                <div class="edit-footer" style="justify-content: flex-end; margin-top:10px;"><button class="save-btn-small" onclick="saveDescription(${id}, '${currentTitle}')">Yadda Saxla</button></div>
            </div>`;
    };

    window.addSubtask = async (parentId) => {
        const subTitle = prompt("Alt tapşırığın adı nə olsun?");
        if (!subTitle) return;
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title: subTitle, category: "general", description: "", due_date: null, parent_id: parentId }) });
        if (res.ok) loadTasks();
    };

    window.saveDescription = async (id, title) => {
        const newDesc = document.getElementById(`input-desc-${id}`).value;
        const newDate = document.getElementById(`input-date-${id}`).value;
        const newRecur = document.getElementById(`input-recur-${id}`).value;
        const res = await fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title: title, description: newDesc, due_date: newDate ? newDate : null, recurrence: newRecur ? newRecur : null, recurrence_end: null }) });
        if (res.ok) loadTasks();
    };

    window.toggleStatus = async (id, status, recurrence, title, category) => {
        const newStatus = status === 'completed' ? 'pending' : 'completed';
        if (newStatus === 'completed' && recurrence && recurrence !== 'null') {
            let nextDate = new Date();
            if (recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            if (recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
            if (recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
            await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title: title, category: category, description: "", due_date: nextDate.toISOString().split('T')[0], recurrence: recurrence, parent_id: null }) });
            alert("Təkrarlanan tapşırıq yaradıldı!");
        }
        await fetch(`/api/tasks/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
        loadTasks();
    };

    window.deleteTask = async (id) => {
        if(!confirm("Silmək istəyirsən?")) return;
        await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        loadTasks();
    };
});