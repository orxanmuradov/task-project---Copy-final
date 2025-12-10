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

    // --- TAB SİSTEMİ ---
    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

        if (tabName === 'tasks') {
            document.getElementById('tasks-view').style.display = 'block';
            document.querySelector("button[onclick=\"switchTab('tasks')\"]").classList.add('active');
            loadTasks();
        } else {
            document.getElementById('notes-view').style.display = 'block';
            document.querySelector("button[onclick=\"switchTab('notes')\"]").classList.add('active');
            loadNotes();
        }
    };

    // --- TASK MƏNTİQİ (Köhnə kodlar) ---
    const categorySelect = document.getElementById("task-category");
    const newCatContainer = document.getElementById("new-cat-container");
    const newCatInput = document.getElementById("new-cat-input");
    const customCatList = document.getElementById("custom-cat-list");

    await loadCategories();
    await loadTasks();

    async function loadCategories() {
        categorySelect.innerHTML = `<option value="general">Ümumi</option><option value="work">İş</option><option value="home">Ev</option><option value="shopping">Alış-veriş</option>`;
        customCatList.innerHTML = "";
        try {
            const res = await fetch("/api/categories", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.categories) {
                data.categories.forEach(cat => {
                    const opt = document.createElement("option"); opt.value = cat.name.toLowerCase(); opt.textContent = cat.name; categorySelect.appendChild(opt);
                    const tag = document.createElement("div"); tag.className = "cat-tag"; tag.innerHTML = `${cat.name} <button class="delete-cat-btn" onclick="deleteCategory(${cat.id}, '${cat.name}')">&times;</button>`; customCatList.appendChild(tag);
                });
            }
        } catch (e) {}
        const newOpt = document.createElement("option"); newOpt.value = "new_category"; newOpt.textContent = "+ Yeni Kateqoriya"; newOpt.style.color = "#ffcc00"; categorySelect.appendChild(newOpt);
    }

    categorySelect.addEventListener("change", () => { if (categorySelect.value === "new_category") { newCatContainer.style.display = "block"; newCatInput.focus(); } else { newCatContainer.style.display = "none"; } });

    window.deleteCategory = async (id, name) => { if(!confirm("Silmək istəyirsən?")) return; const res = await fetch(`/api/categories/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }); if(res.ok) { await loadCategories(); categorySelect.value="general"; newCatContainer.style.display="none"; } };

    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        let title = document.getElementById("task-input").value; let category = categorySelect.value;
        if (category === "new_category") { const newCat = newCatInput.value.trim(); if(!newCat) return; const r = await fetch("/api/categories", { method:"POST", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`}, body:JSON.stringify({name:newCat}) }); if(r.ok) { await loadCategories(); category=newCat.toLowerCase(); categorySelect.value=category; newCatContainer.style.display="none"; newCatInput.value=""; } else return; }
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title, category, description:"", due_date:null, parent_id:null }) });
        if (res.ok) { document.getElementById("task-input").value=""; loadTasks(); }
    });

    async function loadTasks() {
        const res = await fetch("/api/tasks", { headers: { "Authorization": `Bearer ${token}` } }); const data = await res.json(); const list = document.getElementById("task-list"); list.innerHTML = "";
        if (!data.tasks || data.tasks.length === 0) return;
        const parents = data.tasks.filter(t => !t.parent_id); const children = data.tasks.filter(t => t.parent_id);
        parents.forEach(p => { renderTask(p, list, false); children.filter(c => c.parent_id === p.id).forEach(c => renderTask(c, list, true)); });
    }
    function renderTask(task, listElement, isChild) { /* ... Bayaqkı task render kodu ... */
        const li = document.createElement("li"); li.id = `task-${task.id}`; if(task.status==='completed') li.classList.add('completed'); if(isChild) li.classList.add('sub-task-item');
        let dateDisplay = task.due_date ? `<i class="far fa-calendar-alt"></i> ${task.due_date}` : "";
        let recurDisplay = task.recurrence ? `<span class="recurrence-tag"><i class="fas fa-sync-alt"></i> ${task.recurrence}</span>` : "";
        const descText = task.description ? task.description : `<span style="opacity:0.5;font-style:italic;">📝 Detallar...</span>`;
        li.innerHTML = `<div class="task-header"><div class="task-info" onclick="toggleAccordion(${task.id})"><strong>${isChild?'<i class="fas fa-level-up-alt fa-rotate-90 sub-task-icon"></i>':''} ${task.title}</strong><div class="task-meta">${dateDisplay} ${recurDisplay}</div></div><div class="actions"><button onclick="toggleStatus(${task.id},'${task.status}','${task.recurrence}','${task.title}','${task.category}')" class="check-btn"><i class="fas ${task.status==='completed'?'fa-check-circle':'fa-circle'}"></i></button><button onclick="deleteTask(${task.id})" class="delete-btn"><i class="fas fa-trash"></i></button></div></div><div class="task-desc" id="desc-box-${task.id}" onclick="editDescription(event,${task.id},'${task.title}','${task.due_date||''}','${task.recurrence||''}','')">${descText}</div>`;
        listElement.appendChild(li);
    }
    // ... Task helper funksiyaları (toggleStatus, deleteTask, editDescription və s. əvvəlki kimi qalır, yerə qənaət üçün qısa yazdım) ...
    window.toggleAccordion = (id) => document.getElementById(`task-${id}`).classList.toggle("active");
    window.deleteTask = async (id) => { if(confirm("Silmək?")) { await fetch(`/api/tasks/${id}`, {method:"DELETE", headers:{"Authorization":`Bearer ${token}`}}); loadTasks(); } };
    window.toggleStatus = async (id,s,r,t,c) => { const ns=s==='completed'?'pending':'completed'; await fetch(`/api/tasks/${id}/status`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({status:ns})}); loadTasks(); };
    window.editDescription = (e,id,t,d,r,re) => { 
        e.stopPropagation(); const box=document.getElementById(`desc-box-${id}`); if(box.querySelector("textarea")) return;
        box.innerHTML = `<div class="edit-container" onclick="event.stopPropagation()"><textarea class="edit-textarea" id="input-desc-${id}">${box.innerText.includes("Detallar")?"":box.innerText}</textarea><div class="extra-options"><input type="date" id="input-date-${id}" value="${d}" class="small-input"><select id="input-recur-${id}" class="small-select"><option value="">Təkrar Yox</option><option value="daily" ${r==='daily'?'selected':''}>Hər Gün</option><option value="weekly" ${r==='weekly'?'selected':''}>Həftəlik</option></select></div><button class="subtask-btn" onclick="addSubtask(${id})">Alt Tapşırıq</button><div class="edit-footer"><button class="save-btn-small" onclick="saveDescription(${id},'${t}')">Yadda Saxla</button></div></div>`;
    };
    window.saveDescription = async (id,t) => { const d=document.getElementById(`input-desc-${id}`).value; const dt=document.getElementById(`input-date-${id}`).value; const r=document.getElementById(`input-recur-${id}`).value; await fetch(`/api/tasks/${id}`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,description:d,due_date:dt?dt:null,recurrence:r?r:null})}); loadTasks(); };
    window.addSubtask = async (pid) => { const t=prompt("Alt tapşırıq:"); if(t) { await fetch("/api/tasks", {method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,category:"general",description:"",parent_id:pid})}); loadTasks(); } };


    // ==========================================
    // --- YENİ: NOTES & GOALS (QEYDLƏR) MƏNTİQİ ---
    // ==========================================
    
    document.getElementById("note-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("note-title").value;
        const type = document.getElementById("note-type").value;
        
        // Checklist üçün boş array, text üçün boş string
        const content = type === 'checklist' ? '[]' : '';

        const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, type, content })
        });
        if (res.ok) {
            document.getElementById("note-title").value = "";
            loadNotes();
        }
    });

    async function loadNotes() {
        const res = await fetch("/api/notes", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const list = document.getElementById("notes-list");
        list.innerHTML = "";

        if (!data.notes || data.notes.length === 0) { list.innerHTML = "<p style='text-align:center; color:#555;'>Hələ qeyd yoxdur.</p>"; return; }

        data.notes.forEach(note => {
            const div = document.createElement("div");
            div.className = "note-card";
            
            // --- HEADER ---
            let headerHtml = `
                <div class="note-header">
                    <div>
                        <h3>${note.title}</h3>
                        <span class="note-type-badge">${note.type === 'checklist' ? 'Hədəf / Checklist' : 'Qeyd'}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteNote(${note.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // --- CONTENT ---
            let contentHtml = "";

            if (note.type === 'text') {
                // SADƏ MƏTN REJİMİ
                contentHtml = `
                    <textarea class="note-textarea" onblur="updateNoteText(${note.id}, this.value)">${note.content || ''}</textarea>
                `;
            } else {
                // CHECKLIST REJİMİ
                const items = JSON.parse(note.content || '[]');
                let itemsHtml = items.map((item, index) => `
                    <div class="checklist-item ${item.done ? 'done' : ''}">
                        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem(${note.id}, ${index}, this.checked)">
                        <span>${item.text}</span>
                        <button onclick="removeChecklistItem(${note.id}, ${index})" style="margin-left:auto; background:none; border:none; color:#555; cursor:pointer;">&times;</button>
                    </div>
                `).join('');

                contentHtml = `
                    <div class="checklist-container">
                        ${itemsHtml}
                        <input type="text" class="add-check-input" placeholder="+ Hədəf əlavə et (Enter)" onkeypress="if(event.key==='Enter'){addChecklistItem(${note.id}, this.value); this.value='';}">
                    </div>
                `;
            }

            div.innerHTML = headerHtml + contentHtml;
            list.appendChild(div);
        });
    }

    // --- NOTE AKSİYALARI ---
    window.deleteNote = async (id) => {
        if(!confirm("Silmək?")) return;
        await fetch(`/api/notes/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        loadNotes();
    };

    window.updateNoteText = async (id, newText) => {
        await fetch(`/api/notes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ content: newText })
        });
    };

    // Checklist funksiyaları
    window.addChecklistItem = async (id, text) => {
        if(!text.trim()) return;
        // İndiki halı gətir, əlavə et, yadda saxla (Sadələşdirilmiş yanaşma: Bazadan yenidən oxumaq əvəzinə DOM-dan oxuya da bilərik, amma serverdən gətirmək daha təmizdir)
        const res = await fetch("/api/notes", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const note = data.notes.find(n => n.id === id);
        const items = JSON.parse(note.content || '[]');
        items.push({ text: text, done: false });
        
        await fetch(`/api/notes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ content: JSON.stringify(items) }) });
        loadNotes();
    };

    window.toggleChecklistItem = async (id, index, isDone) => {
        const res = await fetch("/api/notes", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const note = data.notes.find(n => n.id === id);
        const items = JSON.parse(note.content || '[]');
        items[index].done = isDone;

        await fetch(`/api/notes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ content: JSON.stringify(items) }) });
        loadNotes();
    };

    window.removeChecklistItem = async (id, index) => {
        const res = await fetch("/api/notes", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const note = data.notes.find(n => n.id === id);
        const items = JSON.parse(note.content || '[]');
        items.splice(index, 1); // Siyahıdan sil

        await fetch(`/api/notes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ content: JSON.stringify(items) }) });
        loadNotes();
    };
});