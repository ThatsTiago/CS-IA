document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded");

    const keyModal = document.getElementById("keyModal");
    const keyBtn = document.getElementById("keyBtn");
    const keyClose = document.getElementById("keyClose");
    const addPasswordBtn = document.getElementById("addPasswordBtn");
    const passwordsList = document.getElementById("passwordsList");
    const websiteNameInput = document.getElementById("websiteName");
    const websiteEmailInput = document.getElementById("websiteEmail");
    const websitePasswordInput = document.getElementById("websitePassword");

    let editMode = false;
    let editIndex = null;

    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");
    const userPassword = localStorage.getItem("userPassword");

    if (userEmail) {
        const userDisplay = document.getElementById("userEmailDisplay");
        if (userDisplay) {
            userDisplay.textContent = userEmail;
        }
        console.log(`Logged in as: ${userEmail}`);
    } else {
        console.log("No user logged in.");
    }

    if (!passwordsList) {
        console.error("Error: #passwordsList does not exist in the HTML.");
        return;
    }

    // Fetch and display saved passwords
    if (userId && userPassword) {
        try {
            const response = await fetch("/get-passwords", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, userPassword })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            console.log("Fetched passwords:", data);

            if (Array.isArray(data) && data.length > 0) {
                data.forEach((passwordObj, index) => {
                    createPasswordContainer(passwordObj.website_name, passwordObj.website_email, passwordObj.website_password, index);
                });
            } else {
                console.log("No saved passwords found.");
            }
        } catch (error) {
            console.error("Error fetching passwords:", error);
        }
    } else {
        console.log("User ID or Password missing. Cannot fetch passwords.");
    }

// Open modal
    keyBtn.addEventListener("click", () => {
        editMode = false;
        editIndex = null;
        clearModalFields();
        keyModal.style.display = "flex";
    });

// Close modal
    keyClose.addEventListener("click", () => {
        keyModal.style.display = "none";
    });

// clear modal fields
    function clearModalFields() {
        websiteNameInput.value = "";
        websiteEmailInput.value = "";
        websitePasswordInput.value = "";
    }

// create password container
    function createPasswordContainer(website, email, password, index) {
        const container = document.createElement("div");
        container.classList.add("password-container");

        container.innerHTML = `
            <h3>${website}</h3>
            <p>Email: ${email}</p>
            <p class="password">Password: <span class="blurred">${'*'.repeat(password.length)}</span></p>
            <button class="editBtn">Edit</button>
            <button class="deleteBtn">Delete</button>
        `;

        const passwordSpan = container.querySelector(".blurred");

        container.addEventListener("mouseenter", () => {
            passwordSpan.textContent = password;
            passwordSpan.classList.remove("blurred");
        });

        container.addEventListener("mouseleave", () => {
            passwordSpan.textContent = '*'.repeat(password.length);
            passwordSpan.classList.add("blurred");
        });

// Edit Button
        container.querySelector(".editBtn").addEventListener("click", () => {
            editMode = true;
            editIndex = index;

            websiteNameInput.value = website;
            websiteEmailInput.value = email;
            websitePasswordInput.value = password;

            keyModal.style.display = "flex";
        });

// Delete Button 
        container.querySelector(".deleteBtn").addEventListener("click", async () => {
            if (confirm("Are you sure you want to delete this password?")) {
                try {
                    const response = await fetch("/delete-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId, userPassword, index })
                    });

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const data = await response.json();
                    if (data.success) {
                        alert("Password deleted successfully!");
                        container.remove();
                    } else {
                        alert("Error deleting password: " + data.message);
                    }
                } catch (error) {
                    console.error("Error during delete request:", error);
                    alert("An error occurred while deleting the password.");
                }
            }
        });

        passwordsList.appendChild(container);
    }

// Save Password Button
    addPasswordBtn.addEventListener("click", async () => {
        const websiteName = websiteNameInput.value;
        const websiteEmail = websiteEmailInput.value;
        const websitePassword = websitePasswordInput.value;

        if (!userId || !userPassword) {
            alert("You need to be logged in to save passwords.");
            return;
        }

        if (websiteName && websiteEmail && websitePassword) {
            try {
                const endpoint = editMode ? "/edit-password" : "/add-password";

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        userPassword,
                        website_name: websiteName,
                        website_email: websiteEmail,
                        website_password: websitePassword,
                        index: editIndex
                    })
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const data = await response.json();
                if (data.success) {
                    alert(editMode ? "Password updated successfully!" : "Password saved successfully!");

                    if (editMode) {
                        passwordsList.innerHTML = "";
                        const fetchResponse = await fetch("/get-passwords", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId, userPassword })
                        });
                        const updatedPasswords = await fetchResponse.json();
                        updatedPasswords.forEach((pwd, idx) => createPasswordContainer(pwd.website_name, pwd.website_email, pwd.website_password, idx));
                    } else {
                        createPasswordContainer(websiteName, websiteEmail, websitePassword, data.index);
                    }

                    keyModal.style.display = "none";
                    clearModalFields();
                    editMode = false;
                } else {
                    alert("Error saving password: " + data.message);
                }
            } catch (error) {
                console.error("Error during save request:", error);
                alert("An error occurred while saving the password.");
            }
        } else {
            alert("Please fill out all fields!");
        }
    });
});
