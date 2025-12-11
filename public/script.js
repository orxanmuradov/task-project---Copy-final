document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById("welcome-message").textContent = `Xoş gəldin, ${payload.username}`;
    } catch(e) {}

    document.getElementById("logout-btn").addEventListener("click", () => { localStorage.clear(); window.location.href = "login.html"; });

    function formatDateAZ(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // --- TABS ---
    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
        if (tabName === 'tasks') {
            document.getElementById('tasks-view').style.display = 'flex';
            document.querySelector("button[onclick=\"switchTab('tasks')\"]").classList.add('active');
            loadTasks();
        } else {
            document.getElementById('notes-view').style.display = 'flex';
            document.querySelector("button[onclick=\"switchTab('notes')\"]").classList.add('active');
            loadNotes();
        }
    };

    const categorySelect = document.getElementById("task-category");
    const newCatContainer = document.getElementById("new-cat-container");
    const newCatInput = document.getElementById("new-cat-input");
    const customCatList = document.getElementById("custom-cat-list");
    let allTasksCache = [];

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
                    const tag = document.createElement("div"); tag.className = "cat-tag"; tag.innerHTML = `${cat.name} <button class="delete-cat-btn" data-id="${cat.id}" data-name="${cat.name}">&times;</button>`; customCatList.appendChild(tag);
                });
                document.querySelectorAll('.delete-cat-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteCategory(btn.getAttribute('data-id'), btn.getAttribute('data-name')); });
                });
            }
        } catch (e) {}
        const newOpt = document.createElement("option"); newOpt.value = "new_category"; newOpt.textContent = "+ Yeni Kateqoriya"; newOpt.style.color = "#ffcc00"; categorySelect.appendChild(newOpt);
    }
    categorySelect.addEventListener("change", () => { if (categorySelect.value === "new_category") { newCatContainer.style.display = "block"; newCatInput.focus(); } else { newCatContainer.style.display = "none"; } });
    
    window.deleteCategory = (id, name) => { showConfirm(`"${name}" kateqoriyasını silmək istəyirsən?`, async () => { const res = await fetch(`/api/categories/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }); if(res.ok) { await loadCategories(); await loadTasks(); categorySelect.value="general"; newCatContainer.style.display="none"; } }); };

    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        let title = document.getElementById("task-input").value; 
        let category = categorySelect.value;
        let startDate = document.getElementById("task-start-date").value;
        let dueDate = document.getElementById("task-due-date").value;
        if (category === "new_category") { const newCat = newCatInput.value.trim(); if(!newCat) return; const r = await fetch("/api/categories", { method:"POST", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`}, body:JSON.stringify({name:newCat}) }); if(r.ok) { await loadCategories(); category=newCat.toLowerCase(); categorySelect.value=category; newCatContainer.style.display="none"; newCatInput.value=""; } else return; }
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title, category, description:"", start_date: startDate || null, due_date: dueDate || null, parent_id:null }) });
        if (res.ok) { document.getElementById("task-input").value=""; document.getElementById("task-start-date").value=""; document.getElementById("task-due-date").value=""; loadTasks(); }
    });

    async function loadTasks() {
        const res = await fetch("/api/tasks", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        allTasksCache = data.tasks || [];
        const container = document.getElementById("tasks-container");
        if (!container) return; container.innerHTML = "";
        if (!allTasksCache || allTasksCache.length === 0) { container.innerHTML = "<p style='text-align:center; color:#555; margin-top:20px;'>Hələ tapşırıq yoxdur.</p>"; return; }
        const parents = allTasksCache.filter(t => !t.parent_id);
        const children = allTasksCache.filter(t => t.parent_id);
        const grouped = {};
        parents.forEach(task => { const catKey = (task.category || 'general').toLowerCase(); if (!grouped[catKey]) grouped[catKey] = []; grouped[catKey].push(task); });
        Object.keys(grouped).forEach(catKey => {
            const tasksInGroup = grouped[catKey];
            if (tasksInGroup.length > 0) {
                const section = document.createElement("div"); section.className = "category-section";
                const displayName = catKey.charAt(0).toUpperCase() + catKey.slice(1);
                const header = document.createElement("h3"); header.className = "category-header"; header.innerHTML = `<span>${translate(displayName)}</span> <span class="count-badge">${tasksInGroup.length}</span>`;
                const ul = document.createElement("ul"); ul.style.listStyle = "none"; ul.style.padding = "0";
                tasksInGroup.forEach(parent => {
                    renderTask(parent, ul, false);
                    const myChildren = children.filter(c => c.parent_id === parent.id);
                    if (myChildren.length > 0) {
                        const subUl = document.createElement("ul"); subUl.className = "subtask-container"; subUl.id = `subtasks-${parent.id}`;
                        myChildren.forEach(child => renderTask(child, subUl, true));
                        ul.appendChild(subUl);
                    }
                });
                section.appendChild(header); section.appendChild(ul); container.appendChild(section);
            }
        });
    }

    function translate(text) { const dict = { 'General': 'Ümumi', 'Work': 'İş', 'Home': 'Ev', 'Shopping': 'Alış-veriş' }; return dict[text] || text; }

    function renderTask(task, listElement, isChild) {
        const li = document.createElement("li"); li.id = `task-${task.id}`; 
        if(task.status==='completed') li.classList.add('completed'); 
        if(isChild) li.classList.add('sub-task-item');
        let dateText = "";
        if (task.start_date && task.due_date) dateText = `${formatDateAZ(task.start_date)} - ${formatDateAZ(task.due_date)}`;
        else if (task.due_date) dateText = `Son: ${formatDateAZ(task.due_date)}`;
        else if (task.start_date) dateText = `Baş: ${formatDateAZ(task.start_date)}`;
        const today = new Date().toISOString().split('T')[0];
        let isOverdue = false;
        if (task.status !== 'completed' && task.due_date && task.due_date < today) { isOverdue = true; li.classList.add('task-overdue'); }
        let overdueBadge = isOverdue ? `<span class="task-overdue-badge"><i class="fas fa-exclamation-circle"></i> Gecikdi!</span>` : "";
        let recurDisplay = task.recurrence ? `<span class="recurrence-tag"><i class="fas fa-sync-alt"></i> ${translateRecurrence(task.recurrence)}</span>` : "";
        const descText = task.description ? task.description : `<span style="opacity:0.5;font-style:italic;">📝 Detallar...</span>`;
        let subtaskBadge = "";
        if (!isChild) {
            const mySubtasks = allTasksCache.filter(t => t.parent_id === task.id);
            if (mySubtasks.length > 0) {
                const completedCount = mySubtasks.filter(t => t.status === 'completed').length;
                const totalCount = mySubtasks.length;
                const badgeColor = completedCount === totalCount ? '#00e676' : '#ffcc00';
                subtaskBadge = `<span style="font-size: 0.75rem; background: rgba(255,255,255,0.1); border: 1px solid ${badgeColor}; color: ${badgeColor}; padding: 2px 6px; border-radius: 12px; margin-left: 8px; font-weight: bold;"><i class="fas fa-stream"></i> ${completedCount}/${totalCount}</span>`;
            }
        }
        li.innerHTML = `<div class="task-header"><div class="task-info" onclick="toggleAccordion(${task.id})"><strong>${isChild?'<i class="fas fa-level-up-alt fa-rotate-90 sub-task-icon"></i>':''} ${task.title} ${subtaskBadge} ${overdueBadge}</strong><div class="task-meta">${dateText ? `<i class="far fa-calendar-alt"></i> <span style="margin-right:5px;">${dateText}</span>` : ''} ${recurDisplay}</div></div><div class="actions"><button onclick="toggleStatus(${task.id},'${task.status}','${task.recurrence}','${task.title}','${task.category}')" class="check-btn"><i class="fas ${task.status==='completed'?'fa-check-circle':'fa-circle'}"></i></button><button onclick="deleteTask(${task.id})" class="delete-btn"><i class="fas fa-trash"></i></button></div></div><div class="task-desc" id="desc-box-${task.id}" onclick="editDescription(event,${task.id},'${task.title}','${task.start_date||''}','${task.due_date||''}','${task.recurrence||''}','')">${descText}</div>`;
        listElement.appendChild(li);
    }
    
    function translateRecurrence(type) { const dict = { 'daily': 'Hər gün', 'weekly': 'Həftəlik', 'monthly': 'Aylıq' }; return dict[type] || type; }
    window.toggleAccordion = (id) => { document.getElementById(`task-${id}`).classList.toggle("active"); const subList = document.getElementById(`subtasks-${id}`); if (subList) { subList.style.display = subList.style.display === "block" ? "none" : "block"; } };
    window.deleteTask = (id) => { showConfirm("Bu tapşırığı silmək istəyirsən?", async () => { await fetch(`/api/tasks/${id}`, {method:"DELETE", headers:{"Authorization":`Bearer ${token}`}}); loadTasks(); }); };
    window.toggleStatus = async (id,s,r,t,c) => { const ns=s==='completed'?'pending':'completed'; if(ns==='pending' && r && r!=='null'){ let nextDate=new Date(); if(r==='daily')nextDate.setDate(nextDate.getDate()+1);if(r==='weekly')nextDate.setDate(nextDate.getDate()+7);if(r==='monthly')nextDate.setMonth(nextDate.getMonth()+1); await fetch("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({title:t,category:c,description:"",due_date:nextDate.toISOString().split('T')[0],recurrence:r,parent_id:null})}); } await fetch(`/api/tasks/${id}/status`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({status:ns})}); loadTasks(); };
    window.editDescription = (e,id,t,start,due,r,re) => { e.stopPropagation(); const box=document.getElementById(`desc-box-${id}`); if(box.querySelector("textarea")) return; box.innerHTML = `<div class="edit-container" onclick="event.stopPropagation()"><div class="sticky-edit-header"><div class="extra-options"><div class="date-group"><label>Başlanğıc:</label><input type="date" id="input-start-${id}" value="${start}" class="small-input"></div><div class="date-group"><label>Son Tarix:</label><input type="date" id="input-due-${id}" value="${due}" class="small-input"></div><div class="date-group"><label>Təkrar:</label><select id="input-recur-${id}" class="small-select"><option value="">Yox</option><option value="daily" ${r==='daily'?'selected':''}>Hər Gün</option><option value="weekly" ${r==='weekly'?'selected':''}>Həftəlik</option></select></div></div><button class="subtask-btn" onclick="openSubtaskModal(${id})"><i class="fas fa-level-down-alt"></i> Alt Tapşırıq Əlavə Et</button></div><textarea class="edit-textarea" id="input-desc-${id}">${box.innerText.includes("Detallar")?"":box.innerText}</textarea><div class="edit-footer"><button class="save-btn-small" onclick="saveDescription(${id},'${t}')">Yadda Saxla</button></div></div>`; };
    window.saveDescription = async (id,t) => { const d=document.getElementById(`input-desc-${id}`).value; const start=document.getElementById(`input-start-${id}`).value; const due=document.getElementById(`input-due-${id}`).value; const r=document.getElementById(`input-recur-${id}`).value; await fetch(`/api/tasks/${id}`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,description:d,start_date:start?start:null,due_date:due?due:null,recurrence:r?r:null})}); loadTasks(); };
    window.addSubtask = async (pid) => { const t=prompt("Alt tapşırıq:"); if(t) { await fetch("/api/tasks", {method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,category:"general",description:"",parent_id:pid})}); loadTasks(); } };

    const modal = document.getElementById("subtask-modal"); const modalInput = document.getElementById("modal-subtask-input"); const saveBtn = document.getElementById("save-modal-btn"); const closeBtn = document.getElementById("close-modal-btn"); let currentParentId = null;
    window.openSubtaskModal = (parentId) => { currentParentId = parentId; modal.style.display = "flex"; modalInput.value = ""; modalInput.focus(); };
    closeBtn.addEventListener("click", () => { modal.style.display = "none"; currentParentId = null; });
    saveBtn.addEventListener("click", async () => { const subTitle = modalInput.value.trim(); if (!subTitle) { alert("Adı daxil edin!"); return; } await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title: subTitle, category: "general", description: "", parent_id: currentParentId }) }); modal.style.display = "none"; loadTasks(); });
    modalInput.addEventListener("keypress", (e) => { if (e.key === "Enter") saveBtn.click(); });

    const confirmModal = document.getElementById("confirm-modal"); const confirmMsg = document.getElementById("confirm-message"); const confirmYes = document.getElementById("confirm-yes-btn"); const confirmNo = document.getElementById("confirm-no-btn"); let confirmCallback = null;
    function showConfirm(message, onConfirm) { confirmMsg.textContent = message; confirmCallback = onConfirm; confirmModal.style.display = "flex"; }
    confirmNo.addEventListener("click", () => { confirmModal.style.display = "none"; confirmCallback = null; });
    confirmYes.addEventListener("click", () => { if (confirmCallback) confirmCallback(); confirmModal.style.display = "none"; });

    document.getElementById("note-form").addEventListener("submit", async (e) => { e.preventDefault(); const title=document.getElementById("note-title").value; const type=document.getElementById("note-type").value; const content=type==='checklist'?'[]':''; const res=await fetch("/api/notes",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({title,type,content})}); if(res.ok){document.getElementById("note-title").value="";loadNotes();} });
    async function loadNotes() { 
        const res = await fetch("/api/notes", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const container = document.getElementById("notes-list");
        container.innerHTML = "";
        if (!data.notes || data.notes.length === 0) { container.innerHTML = "<p style='text-align:center; color:#555;'>Hələ qeyd yoxdur.</p>"; return; }
        const textNotes = data.notes.filter(n => n.type === 'text');
        const checklistNotes = data.notes.filter(n => n.type === 'checklist');
        if (textNotes.length > 0) { const s = document.createElement("div"); s.innerHTML = `<h3 class="note-section-title">📝 Qeydlər</h3>`; const g = document.createElement("div"); g.className = "notes-grid"; textNotes.forEach(n => g.appendChild(createNoteCard(n))); s.appendChild(g); container.appendChild(s); }
        if (checklistNotes.length > 0) { const s = document.createElement("div"); s.style.marginTop = "30px"; s.innerHTML = `<h3 class="note-section-title">✅ Hədəflər</h3>`; const g = document.createElement("div"); g.className = "notes-grid"; checklistNotes.forEach(n => g.appendChild(createNoteCard(n))); s.appendChild(g); container.appendChild(s); } 
    }

    // ===============================================
    // 👇 DÜZƏLDİLMİŞ HTML STRUKTURU 👇
    // ===============================================
    function createNoteCard(note) {
        const div = document.createElement("div");
        div.className = "note-card";
        
        let hh = `<div class="note-header"><div><h3>${note.title}</h3></div><button class="delete-btn" onclick="deleteNote(${note.id})"><i class="fas fa-trash"></i></button></div>`;
        let ch = "";
        
        if (note.type === 'text') {
            ch = `<textarea class="note-textarea" onblur="updateNoteText(${note.id}, this.value)">${note.content || ''}</textarea>`;
        } else {
            let items = [];
            try { items = JSON.parse(note.content || '[]'); } catch (e) { items = []; }
            const today = new Date().toISOString().split('T')[0];

            const renderedItems = items.map((item, index) => {
                const isDone = item.done;
                const isOverdue = !isDone && item.endDate && item.endDate < today;
                
                let wrapperClass = "checklist-item-wrapper";
                let badge = "";

                if (isDone) wrapperClass += " done";
                if (isOverdue) {
                    wrapperClass += " overdue";
                    badge = `<span class="badge-overdue"><i class="fas fa-exclamation-circle"></i> Gecikdi!</span>`;
                }

                // DÜZƏLİŞ: HTML STUKTURU CSS İLƏ EYNİLƏŞDİ
                const html = `
                    <div class="${wrapperClass}">
                        <div class="checklist-main-row">
                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="updateChecklistItem(${note.id}, ${index}, 'done', this.checked)">
                            <span>${item.text}</span>
                            ${badge}
                            <button onclick="removeChecklistItem(${note.id}, ${index})" class="delete-sub-btn"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="checklist-details-row">
                            <div class="cl-date-group"><span class="cl-date-label">Baş:</span><input type="date" class="cl-date" value="${item.startDate||''}" onchange="updateChecklistItem(${note.id},${index},'startDate',this.value)"></div>
                            <div class="cl-date-group"><span class="cl-date-label">Son:</span><input type="date" class="cl-date" value="${item.endDate||''}" onchange="updateChecklistItem(${note.id},${index},'endDate',this.value)"></div>
                        </div>
                        <input type="text" class="cl-note" placeholder="Qeyd (könüllü)..." value="${item.note||''}" onchange="updateChecklistItem(${note.id},${index},'note',this.value)">
                    </div>`;
                return { html, isDone };
            });

            const activeHtml = renderedItems.filter(i => !i.isDone).map(i => i.html).join('');
            const doneHtml = renderedItems.filter(i => i.isDone).map(i => i.html).join('');

            let finalHtml = activeHtml;
            if (doneHtml) {
                finalHtml += `<div class="completed-divider"><span>✅ Tamamlanmış Hədəflər</span></div>` + doneHtml;
            }

            ch = `<div class="checklist-container">
                    ${finalHtml}
                    <input type="text" class="add-check-input" placeholder="+ Yeni hədəf (Enter)" onkeypress="if(event.key==='Enter'){addChecklistItem(${note.id},this.value);this.value='';}">
                  </div>`;
        }
        
        div.innerHTML = hh + ch;
        return div;
    }
    
    window.deleteNote = (id) => { showConfirm("Bu qeydi silmək istəyirsən?", async () => { await fetch(`/api/notes/${id}`, {method:"DELETE", headers:{"Authorization":`Bearer ${token}`}}); loadNotes(); }); };
    window.updateNoteText=async(id,nt)=>{await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:nt})});}; 
    window.addChecklistItem=async(id,t)=>{if(!t.trim())return;const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=[];try{i=JSON.parse(n.content||'[]');}catch(e){i=[];} i.push({text:t,done:false,startDate:"",endDate:"",note:""});await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});loadNotes();}; 
    window.updateChecklistItem=async(id,idx,f,v)=>{const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=JSON.parse(n.content||'[]');if(i[idx]){i[idx][f]=v;await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});if(f==='done')loadNotes();}}; 
    window.removeChecklistItem=async(id,idx)=>{const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=JSON.parse(n.content||'[]');i.splice(idx,1);await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});loadNotes();};
});