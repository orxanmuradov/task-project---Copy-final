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

    // --- YENİ TAPŞIRIQ ƏLAVƏ ETMƏK ---
    document.getElementById("task-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Xanadakı məlumatları götürürük
        const title = document.getElementById("task-input").value;
        const category = document.getElementById("task-category").value;
        const description = document.getElementById("task-desc").value; // Yeni Qeyd
        const date = document.getElementById("task-date").value;       // Yeni Tarix

        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ title, category, description, due_date: date })
        });

        if (res.ok) {
            document.getElementById("task-form").reset(); // Formu təmizlə
            loadTasks();
        } else {
            alert("Xəta baş verdi!");
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
            if (task.status === 'completed') li.classList.add('completed');

            // Tarix formatı
            let dateDisplay = "";
            if (task.due_date) {
                dateDisplay = `<i class="far fa-calendar-alt"></i> ${task.due_date}`;
            }

            li.innerHTML = `
                <div class="task-info">
                    <strong>${task.title}</strong>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
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
            `;
            list.appendChild(li);
        });
    }

    function translate(cat) {
        const dict = { 'general': 'Ümumi', 'work': 'İş', 'home': 'Ev', 'shopping': 'Alış-veriş' };
        return dict[cat] || cat;
    }

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