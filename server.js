require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/account", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "account.html"));
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("Connection error", err.stack));

const algorithm = 'aes-256-cbc';

function getKeyFromPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

function encryptData(data, password) {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = getKeyFromPassword(password, salt);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        data: encrypted
    };
}

function decryptData(encryptedData, password) {
    const key = getKeyFromPassword(password, Buffer.from(encryptedData.salt, 'hex'));
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(encryptedData.iv, 'hex'));

    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

function saveToFile(filePath, encryptedData) {
    fs.writeFileSync(filePath, JSON.stringify(encryptedData));
}

function readFromFile(filePath, password) {
    const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return decryptData(encryptedData, password);
}

/**
 * User Authentication
 */

// Register 
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }


        const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Email already registered. Please log in or use a different email." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email;",
            [email, hashedPassword]
        );

        res.status(201).json({ success: true, message: "User registered successfully", user: newUser.rows[0] });

    } catch (err) {
        console.error("Error in /register route:", err);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});


// Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query("SELECT * FROM users WHERE email = $1;", [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        res.json({ success: true, message: "Login successful", userId: user.rows[0].id, email: user.rows[0].email });
    } catch (err) {
        console.error("Error in /login:", err);
        res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
});

/**
 * Password Management
 */

// Add password
app.post("/add-password", async (req, res) => {
    const { userId, website_name, website_email, website_password, userPassword } = req.body;

    if (!userId || !userPassword) {
        return res.status(400).json({ success: false, message: "User ID or password missing in request." });
    }

    try {
        const userDir = path.join(__dirname, 'passwords');
        const filePath = path.join(userDir, `${userId}.enc`);

        let passwords = [];
        if (fs.existsSync(filePath)) {
            const decryptedData = readFromFile(filePath, userPassword);
            passwords = JSON.parse(decryptedData);
        }

        passwords.push({ website_name, website_email, website_password });

        const encryptedData = encryptData(JSON.stringify(passwords), userPassword);
        saveToFile(filePath, encryptedData);

        res.json({ success: true, message: "Password saved successfully" });
    } catch (err) {
        console.error("Error in /add-password:", err);
        res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
});

// Delete password
app.post("/delete-password", async (req, res) => {
    const { userId, userPassword, index } = req.body;

    if (!userId || !userPassword || index === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields in request." });
    }

    try {
        const userDir = path.join(__dirname, 'passwords');
        const filePath = path.join(userDir, `${userId}.enc`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "Password file not found." });
        }

        const decryptedData = readFromFile(filePath, userPassword);
        let passwords = JSON.parse(decryptedData);

        if (index < 0 || index >= passwords.length) {
            return res.status(400).json({ success: false, message: "Invalid password index." });
        }

        passwords.splice(index, 1);

        const encryptedData = encryptData(JSON.stringify(passwords), userPassword);
        saveToFile(filePath, encryptedData);

        res.json({ success: true, message: "Password deleted successfully." });
    } catch (err) {
        console.error("Error in /delete-password:", err);
        res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
});

// Edit password
app.post("/edit-password", async (req, res) => {
    const { userId, userPassword, index, website_name, website_email, website_password } = req.body;

    if (!userId || !userPassword || index === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields in request." });
    }

    try {
        const userDir = path.join(__dirname, 'passwords');
        const filePath = path.join(userDir, `${userId}.enc`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "Password file not found." });
        }

        const decryptedData = readFromFile(filePath, userPassword);
        let passwords = JSON.parse(decryptedData);

        if (index < 0 || index >= passwords.length) {
            return res.status(400).json({ success: false, message: "Invalid password index." });
        }

        passwords[index] = {
            website_name,
            website_email,
            website_password
        };

        const encryptedData = encryptData(JSON.stringify(passwords), userPassword);
        saveToFile(filePath, encryptedData);

        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Error in /edit-password:", err);
        res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
    }
});

// retrieve passwords
app.post("/get-passwords", async (req, res) => {
    const { userId, userPassword } = req.body;
    try {
        const userDir = path.join(__dirname, 'passwords');
        const filePath = path.join(userDir, `${userId}.enc`);

        if (!fs.existsSync(filePath)) {
            return res.json([]);
        }

        const decryptedData = readFromFile(filePath, userPassword);
        const passwords = JSON.parse(decryptedData);

        res.json(passwords);
    } catch (err) {
        console.error("Error in /get-passwords:", err);
        res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
