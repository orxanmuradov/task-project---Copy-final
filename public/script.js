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
        const description = document.getElementById("task-desc").value;
        const date = document.getElementById("task-date").value;

        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, category, description, due_date: date })
        });

        if (res.ok) {
            document.getElementById("task-form").reset();
            loadTasks();
        } else {
            alert("Xəta!");
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
            li.id = `task-${task.id}`; // Li-yə ID veririk
            if (task.status === 'completed') li.classList.add('completed');

            let dateDisplay = task.due_date ? `<i class="far fa-calendar-alt"></i> ${task.due_date}` : "";

            li.innerHTML = `
                <div class="task-header">
                    <div class="task-info" onclick="toggleDescription(${task.id})">
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

                <div class="task-desc">
                    <p style="margin-bottom:5px; color:var(--primary-color);">📝 Qeyd:</p>
                    ${task.description || "Qeyd yoxdur."}
                </div>
            `;
            list.appendChild(li);
        });
    }

    function translate(cat) {
        const dict = { 'general': 'Ümumi', 'work': 'İş', 'home': 'Ev', 'shopping': 'Alış-veriş' };
        return dict[cat] || cat;
    }

    // --- YENİ FUNKSİYA: Qeydi Açıb/Bağlamaq ---
    window.toggleDescription = (id) => {
        const li = document.getElementById(`task-${id}`);
        li.classList.toggle("active"); // 'active' klassını əlavə edir və ya silir
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