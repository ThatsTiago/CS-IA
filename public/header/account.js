document.addEventListener("DOMContentLoaded", () => {

// Display email
    const userEmail = localStorage.getItem("userEmail");
    const userEmailDisplay = document.getElementById("userEmailDisplay");
    if (userEmail && userEmailDisplay) {
        userEmailDisplay.textContent = userEmail;
    } else {
        userEmailDisplay.textContent = "Not logged in";
    }

// Logout button 
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            alert("Logged out successfully!");
            window.location.reload();
        });
    }
});

// register button
document.getElementById("registerBtn").addEventListener("click", async () => {
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration successful!");
        } else {
            if (response.status === 409) {
                alert("Email already registered. Please log in or use another email.");
            } else {
                alert(`Registration failed: ${data.message}`);
            }
        }
    } catch (err) {
        console.error("Error during registration:", err);
        alert("An unexpected error occurred during registration.");
    }
});

// login button
document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
        alert("Login successful!");
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("userEmail", data.email);
        localStorage.setItem("userPassword", password);
        window.location.reload();
    } else {
        alert("Login failed: " + data.message);
    }
});

