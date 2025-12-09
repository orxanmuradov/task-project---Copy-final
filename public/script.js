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

    await loadTasks();

    // Yeni Tapşırıq
    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("task-input").value;
        const category = document.getElementById("task-category").value;
        // Əsas ekranda qeyd və tarix yazmağa ehtiyac yoxdursa, boş göndəririk (sonradan əlavə edəcək)
        // Amma inputlar varsa götürürük:
        const descInput = document.getElementById("task-desc");
        const dateInput = document.getElementById("task-date");
        
        const description = descInput ? descInput.value : ""; 
        const date = dateInput ? dateInput.value : null;

        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, category, description, due_date: date })
        });

        if (res.ok) {
            document.getElementById("task-form").reset();
            loadTasks();
        }
    });

    async function loadTasks() {
        const res = await fetch("/api/tasks", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        const list = document.getElementById("task-list");
        list.innerHTML = "";

        if (!data.tasks || data.tasks.length === 0) {
            list.innerHTML = "<li style='text-align:center; color:#555;'>Hələ tapşırıq yoxdur.</li>";
            return;
        }

        data.tasks.forEach(task => {
            const li = document.createElement("li");
            li.id = `task-${task.id}`;
            if (task.status === 'completed') li.classList.add('completed');

            let dateDisplay = task.due_date ? `<i class="far fa-calendar-alt"></i> ${task.due_date}` : "";

            // Qeyd varsa göstər, yoxdursa "Yazmaq üçün kliklə" yaz
            const descText = task.description ? task.description : `<span style="opacity:0.5; font-style:italic;">📝 Qeyd yoxdur (Yazmaq üçün bura kliklə)</span>`;

            li.innerHTML = `
                <div class="task-header">
                    <div class="task-info" onclick="toggleAccordion(${task.id})">
                        <strong>${task.title} <i class="fas fa-chevron-down" style="font-size:0.8rem; color:#555; margin-left:5px;"></i></strong>
                        <div class="task-meta">
                            <span class="badge">${translate(task.category)}</span>
                            ${dateDisplay ? `<span>${dateDisplay}</span>` : ''}
                        </div>
                    </div>
                    <div class="actions">
                        <button onclick="toggleStatus(${task.id}, '${task.status}')" class="check-btn">
                            <i class="fas ${task.status === 'completed' ? 'fa-check-circle' : 'fa-circle'}"></i>
                        </button>
                        <button onclick="deleteTask(${task.id})" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="task-desc" id="desc-box-${task.id}" onclick="editDescription(event, ${task.id}, '${task.title}', '${task.due_date || ''}')">
                    ${descText}
                </div>
            `;
            list.appendChild(li);
        });
    }

    function translate(cat) {
        const dict = { 'general': 'Ümumi', 'work': 'İş', 'home': 'Ev', 'shopping': 'Alış-veriş' };
        return dict[cat] || cat;
    }

    // --- ACCORDION AÇIB-BAĞLAMAQ ---
    window.toggleAccordion = (id) => {
        const li = document.getElementById(`task-${id}`);
        li.classList.toggle("active");
    };

    // --- QEYDİ DƏYİŞMƏK (INLINE EDIT) ---
    window.editDescription = (event, id, currentTitle, currentDate) => {
        event.stopPropagation(); // Accordion bağlanmasın deyə
        
        const descBox = document.getElementById(`desc-box-${id}`);
        
        // Əgər artıq açıqdırsa, heç nə etmə
        if (descBox.querySelector("textarea")) return;

        // Mövcud mətni götür (əgər "Qeyd yoxdur" yazısıdırsa boş götür)
        let currentText = descBox.innerText;
        if (currentText.includes("Qeyd yoxdur")) currentText = "";

        // Qutunun içinə Form qoyuruq
        descBox.innerHTML = `
            <div class="edit-container" onclick="event.stopPropagation()">
                <textarea class="edit-textarea" id="input-desc-${id}" placeholder="Qeydini bura yaz...">${currentText}</textarea>
                <div class="edit-actions">
                    <button class="save-btn-small" onclick="saveDescription(${id}, '${currentTitle}', '${currentDate}')">Yadda saxla</button>
                </div>
            </div>
        `;
    };

    // --- QEYDİ YADDA SAXLAMAQ ---
    window.saveDescription = async (id, title, date) => {
        const newDesc = document.getElementById(`input-desc-${id}`).value;
        
        // Serverə köhnə başlıq və tarix + yeni qeydi göndəririk
        const res = await fetch(`/api/tasks/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ 
                title: title, 
                due_date: (date === 'null' || date === '') ? null : date, 
                description: newDesc 
            })
        });

        if (res.ok) {
            loadTasks(); // Siyahını yenilə ki, yeni qeyd görünsün
        } else {
            alert("Xəta baş verdi");
        }
    };

    window.toggleStatus = async (id, status) => {
        const newStatus = status === 'completed' ? 'pending' : 'completed';
        await fetch(`/api/tasks/${id}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        loadTasks();
    };

    window.deleteTask = async (id) => {
        if(!confirm("Silmək istəyirsən?")) return;
        await fetch(`/api/tasks/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        loadTasks();
    };
});