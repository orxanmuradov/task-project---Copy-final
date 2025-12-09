<!DOCTYPE html>
<html lang="az">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tapşırıqlarım</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
</head>
<body>
    <div class="container">
        <header class="app-header">
            <h1 class="main-title"><i class="fas fa-tasks"></i> Tapşırıqlar</h1>
            <div class="user-info">
                <span id="welcome-message"></span>
                <button id="logout-btn" class="delete-btn" title="Çıxış"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        </header>

        <form id="task-form">
            <div class="form-row">
                <input type="text" id="task-input" placeholder="Yeni tapşırıq başlığı..." required>
                
                <select id="task-category">
                    <option value="general">Ümumi</option>
                    <option value="work">İş</option>
                    <option value="home">Ev</option>
                    <option value="shopping">Alış-veriş</option>
                    <option value="new_category" style="font-weight:bold; color:orange;">+ Yeni Kateqoriya</option>
                </select>
            </div>

            <div id="new-cat-container" style="display: none; margin-bottom: 10px;">
                <input type="text" id="new-cat-input" placeholder="Kateqoriya adını yazın..." style="border-color: #ffcc00;">
            </div>
            
            <button type="submit" class="add-btn"><i class="fas fa-plus"></i> Əlavə et</button>
        </form>

        <ul id="task-list"></ul>
    </div>

    <script src="script.js"></script>
</body>
</html>