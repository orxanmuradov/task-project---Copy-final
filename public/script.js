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

    // --- TABS ---
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

    // --- ELEMENTLƏR ---
    const categorySelect = document.getElementById("task-category");
    const newCatContainer = document.getElementById("new-cat-container");
    const newCatInput = document.getElementById("new-cat-input");
    const customCatList = document.getElementById("custom-cat-list");

    await loadCategories();
    await loadTasks();

    // --- KATEQORİYALAR ---
    async function loadCategories() {
        categorySelect.innerHTML = `<option value="general">Ümumi</option><option value="work">İş</option><option value="home">Ev</option><option value="shopping">Alış-veriş</option>`;
        customCatList.innerHTML = "";
        try {
            const res = await fetch("/api/categories", { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            if (data.categories) {
                data.categories.forEach(cat => {
                    const opt = document.createElement("option"); 
                    opt.value = cat.name.toLowerCase(); 
                    opt.textContent = cat.name; 
                    categorySelect.appendChild(opt);
                    
                    const tag = document.createElement("div"); 
                    tag.className = "cat-tag"; 
                    tag.innerHTML = `${cat.name} <button class="delete-cat-btn" onclick="deleteCategory(${cat.id}, '${cat.name}')">&times;</button>`; 
                    customCatList.appendChild(tag);
                });
            }
        } catch (e) {}
        const newOpt = document.createElement("option"); newOpt.value = "new_category"; newOpt.textContent = "+ Yeni Kateqoriya"; newOpt.style.color = "#ffcc00"; categorySelect.appendChild(newOpt);
    }

    categorySelect.addEventListener("change", () => { if (categorySelect.value === "new_category") { newCatContainer.style.display = "block"; newCatInput.focus(); } else { newCatContainer.style.display = "none"; } });

    window.deleteCategory = async (id, name) => { if(!confirm("Silmək?")) return; const res = await fetch(`/api/categories/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }); if(res.ok) { await loadCategories(); await loadTasks(); categorySelect.value="general"; newCatContainer.style.display="none"; } };

    // --- TASK ADD ---
    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        let title = document.getElementById("task-input").value; 
        let category = categorySelect.value;
        
        if (category === "new_category") { 
            const newCat = newCatInput.value.trim(); 
            if(!newCat) return; 
            const r = await fetch("/api/categories", { method:"POST", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`}, body:JSON.stringify({name:newCat}) }); 
            if(r.ok) { await loadCategories(); category=newCat.toLowerCase(); categorySelect.value=category; newCatContainer.style.display="none"; newCatInput.value=""; } else return; 
        }
        
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title, category, description:"", due_date:null, parent_id:null }) });
        if (res.ok) { document.getElementById("task-input").value=""; loadTasks(); }
    });

    // ========================================================
    // 👇 ƏN VACİB HİSSƏ: QRUPLAŞDIRMA FUNKSİYASI 👇
    // ========================================================
    async function loadTasks() {
        const res = await fetch("/api/tasks", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        
        let container = document.getElementById("tasks-container");
        if (!container) return; // HTML elementi tapılmasa dayan
        
        container.innerHTML = "";

        if (!data.tasks || data.tasks.length === 0) { 
            container.innerHTML = "<p style='text-align:center; color:#555; margin-top:20px;'>Hələ tapşırıq yoxdur.</p>"; 
            return; 
        }

        const parents = data.tasks.filter(t => !t.parent_id);
        const children = data.tasks.filter(t => t.parent_id);

        // 1. Qruplaşdırma Obyekti yaradiriq
        const grouped = {};

        // 2. Bütün ANA tapşırıqları gəzib uyğun qutuya atırıq
        parents.forEach(task => {
            // Kateqoriya adını kiçik hərflə götür (work, sport, home...)
            const catKey = (task.category || 'general').toLowerCase();
            
            // Əgər bu qutu yoxdursa, yarat
            if (!grouped[catKey]) {
                grouped[catKey] = [];
            }
            // Tapşırığı qutuya at
            grouped[catKey].push(task);
        });

        // 3. İndi Qutuları Ekrana Çıxarırıq
        Object.keys(grouped).forEach(catKey => {
            const tasksInGroup = grouped[catKey];

            if (tasksInGroup.length > 0) {
                // Bölmə (Section) yarat
                const section = document.createElement("div");
                section.className = "category-section";

                // Başlıq (Adı gözəlləşdir: work -> Work)
                const displayName = catKey.charAt(0).toUpperCase() + catKey.slice(1);
                
                const header = document.createElement("h3");
                header.className = "category-header";
                header.innerHTML = `<span>${translate(displayName)}</span> <span class="count-badge">${tasksInGroup.length}</span>`;
                
                const ul = document.createElement("ul");
                ul.style.listStyle = "none";
                ul.style.padding = "0";
                
                // İçindəki tapşırıqları düz
                tasksInGroup.forEach(parent => {
                    renderTask(parent, ul, false);
                    // Alt tapşırıqları da altına qoy
                    children.filter(c => c.parent_id === parent.id).forEach(child => renderTask(child, ul, true));
                });

                section.appendChild(header);
                section.appendChild(ul);
                container.appendChild(section);
            }
        });
    }

    function translate(text) { 
        // Standartları tərcümə et, özəlləri olduğu kimi saxla
        const dict = { 'General': 'Ümumi', 'Work': 'İş', 'Home': 'Ev', 'Shopping': 'Alış-veriş' }; 
        return dict[text] || text; 
    }

    function renderTask(task, listElement, isChild) {
        const li = document.createElement("li"); 
        li.id = `task-${task.id}`; 
        if(task.status==='completed') li.classList.add('completed'); 
        if(isChild) li.classList.add('sub-task-item');
        
        let dateDisplay = task.due_date ? `<i class="far fa-calendar-alt"></i> ${task.due_date}` : "";
        let recurDisplay = task.recurrence ? `<span class="recurrence-tag"><i class="fas fa-sync-alt"></i> ${translateRecurrence(task.recurrence)}</span>` : "";
        const descText = task.description ? task.description : `<span style="opacity:0.5;font-style:italic;">📝 Detallar...</span>`;
        
        li.innerHTML = `
            <div class="task-header">
                <div class="task-info" onclick="toggleAccordion(${task.id})">
                    <strong>${isChild?'<i class="fas fa-level-up-alt fa-rotate-90 sub-task-icon"></i>':''} ${task.title}</strong>
                    <div class="task-meta">${dateDisplay} ${recurDisplay}</div>
                </div>
                <div class="actions">
                    <button onclick="toggleStatus(${task.id},'${task.status}','${task.recurrence}','${task.title}','${task.category}')" class="check-btn"><i class="fas ${task.status==='completed'?'fa-check-circle':'fa-circle'}"></i></button>
                    <button onclick="deleteTask(${task.id})" class="delete-btn"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="task-desc" id="desc-box-${task.id}" onclick="editDescription(event,${task.id},'${task.title}','${task.due_date||''}','${task.recurrence||''}','')">${descText}</div>`;
        listElement.appendChild(li);
    }
    
    function translateRecurrence(type) { const dict = { 'daily': 'Hər gün', 'weekly': 'Həftəlik', 'monthly': 'Aylıq' }; return dict[type] || type; }
    window.toggleAccordion = (id) => document.getElementById(`task-${id}`).classList.toggle("active");
    window.deleteTask = async (id) => { if(confirm("Silmək?")) { await fetch(`/api/tasks/${id}`, {method:"DELETE", headers:{"Authorization":`Bearer ${token}`}}); loadTasks(); } };
    window.toggleStatus = async (id,s,r,t,c) => { const ns=s==='completed'?'pending':'completed'; if(ns==='pending' && r && r!=='null'){ let nextDate=new Date(); if(r==='daily')nextDate.setDate(nextDate.getDate()+1);if(r==='weekly')nextDate.setDate(nextDate.getDate()+7);if(r==='monthly')nextDate.setMonth(nextDate.getMonth()+1); await fetch("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({title:t,category:c,description:"",due_date:nextDate.toISOString().split('T')[0],recurrence:r,parent_id:null})}); } await fetch(`/api/tasks/${id}/status`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({status:ns})}); loadTasks(); };
    window.editDescription = (e,id,t,d,r,re) => { e.stopPropagation(); const box=document.getElementById(`desc-box-${id}`); if(box.querySelector("textarea")) return; box.innerHTML = `<div class="edit-container" onclick="event.stopPropagation()"><textarea class="edit-textarea" id="input-desc-${id}">${box.innerText.includes("Detallar")?"":box.innerText}</textarea><div class="extra-options"><input type="date" id="input-date-${id}" value="${d}" class="small-input"><select id="input-recur-${id}" class="small-select"><option value="">Təkrar Yox</option><option value="daily" ${r==='daily'?'selected':''}>Hər Gün</option><option value="weekly" ${r==='weekly'?'selected':''}>Həftəlik</option></select></div><button class="subtask-btn" onclick="addSubtask(${id})">Alt Tapşırıq</button><div class="edit-footer"><button class="save-btn-small" onclick="saveDescription(${id},'${t}')">Yadda Saxla</button></div></div>`; };
    window.saveDescription = async (id,t) => { const d=document.getElementById(`input-desc-${id}`).value; const dt=document.getElementById(`input-date-${id}`).value; const r=document.getElementById(`input-recur-${id}`).value; await fetch(`/api/tasks/${id}`, {method:"PUT", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,description:d,due_date:dt?dt:null,recurrence:r?r:null})}); loadTasks(); };
    window.addSubtask = async (pid) => { const t=prompt("Alt tapşırıq:"); if(t) { await fetch("/api/tasks", {method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify({title:t,category:"general",description:"",parent_id:pid})}); loadTasks(); } };

    // NOTES (Stabil)
    document.getElementById("note-form").addEventListener("submit", async (e) => { e.preventDefault(); const title=document.getElementById("note-title").value; const type=document.getElementById("note-type").value; const content=type==='checklist'?'[]':''; const res=await fetch("/api/notes",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({title,type,content})}); if(res.ok){document.getElementById("note-title").value="";loadNotes();} });
    async function loadNotes() { const res=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}}); const data=await res.json(); const list=document.getElementById("notes-list"); list.innerHTML=""; if(!data.notes||data.notes.length===0){list.innerHTML="<p style='text-align:center;color:#555;'>Hələ qeyd yoxdur.</p>";return;} data.notes.forEach(note=>{ const div=document.createElement("div"); div.className="note-card"; let headerHtml=`<div class="note-header"><div><h3>${note.title}</h3><span class="note-type-badge">${note.type==='checklist'?'Hədəf':'Qeyd'}</span></div><button class="delete-btn" onclick="deleteNote(${note.id})"><i class="fas fa-trash"></i></button></div>`; let contentHtml=""; if(note.type==='text'){contentHtml=`<textarea class="note-textarea" onblur="updateNoteText(${note.id},this.value)">${note.content||''}</textarea>`;}else{let items=[];try{items=JSON.parse(note.content||'[]');}catch(e){items=[];} let itemsHtml=items.map((item,index)=>`<div class="checklist-item-wrapper ${item.done?'done':''}"><div class="checklist-main-row"><input type="checkbox" ${item.done?'checked':''} onchange="updateChecklistItem(${note.id},${index},'done',this.checked)"><span style="flex:1;">${item.text}</span><button onclick="removeChecklistItem(${note.id},${index})" class="delete-sub-btn">&times;</button></div><div class="checklist-details-row"><input type="date" class="cl-date" value="${item.date||''}" onchange="updateChecklistItem(${note.id},${index},'date',this.value)" title="Hədəf tarixi"><input type="text" class="cl-note" placeholder="Qeyd..." value="${item.note||''}" onchange="updateChecklistItem(${note.id},${index},'note',this.value)"></div></div>`).join(''); contentHtml=`<div class="checklist-container">${itemsHtml}<input type="text" class="add-check-input" placeholder="+ Yeni hədəf (Enter)" onkeypress="if(event.key==='Enter'){addChecklistItem(${note.id},this.value);this.value='';}"></div>`;} div.innerHTML=headerHtml+contentHtml; list.appendChild(div); }); }
    window.deleteNote=async(id)=>{if(!confirm("Silmək?"))return;await fetch(`/api/notes/${id}`,{method:"DELETE",headers:{"Authorization":`Bearer ${token}`}});loadNotes();}; window.updateNoteText=async(id,nt)=>{await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:nt})});}; window.addChecklistItem=async(id,t)=>{if(!t.trim())return;const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=[];try{i=JSON.parse(n.content||'[]');}catch(e){i=[];} i.push({text:t,done:false,date:"",note:""});await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});loadNotes();}; window.updateChecklistItem=async(id,idx,f,v)=>{const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=JSON.parse(n.content||'[]');if(i[idx]){i[idx][f]=v;await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});if(f==='done')loadNotes();}}; window.removeChecklistItem=async(id,idx)=>{const r=await fetch("/api/notes",{headers:{"Authorization":`Bearer ${token}`}});const d=await r.json();const n=d.notes.find(x=>x.id===id);let i=JSON.parse(n.content||'[]');i.splice(idx,1);await fetch(`/api/notes/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({content:JSON.stringify(i)})});loadNotes();};
});