// script.js

// --- 1. CONNECT TO SUPABASE ---
const SUPABASE_URL = 'https://nlbfetgibsmhfoinvkst.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_w4c-2IfXyKHLKWxo9VvjAQ_7gMExdkj';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- 2. SMALL UI FUNCTIONS ---
function scrollToLogin() {
    document.getElementById('username').focus();
    document.getElementById('login-card').scrollIntoView({ behavior: 'smooth' });
}

// --- 3. LOGIN / SIGNUP TOGGLE (The Fix!) ---
function toggleForm() {
    let title = document.getElementById("form-title");
    let loginBtn = document.getElementById("login-btn");
    let signupBtn = document.getElementById("signup-btn");
    let toggleText = document.getElementById("toggle-text");
    let toggleLink = document.getElementById("toggle-link");

    if (loginBtn.classList.contains("hidden")) {
        // Switch to Login View
        loginBtn.classList.remove("hidden");
        signupBtn.classList.add("hidden");
        title.innerText = "Welcome Back";
        toggleText.innerText = "Don't have an account? ";
        toggleLink.innerText = "Sign Up";
    } else {
        // Switch to Signup View
        loginBtn.classList.add("hidden");
        signupBtn.classList.remove("hidden");
        title.innerText = "Create Account";
        toggleText.innerText = "Already have an account? ";
        toggleLink.innerText = "Log In";
    }
}


// --- 4. SIGN UP (Create Account with $1,000) ---
async function signup() {
    let user = document.getElementById("username").value.trim();
    let pass = document.getElementById("password").value;

    if (user === "" || pass === "") {
        alert("Please fill in both boxes!");
        return;
    }
    if (pass.length < 4) {
        alert("Password must be at least 4 characters long!");
        return;
    }

    const fakeEmail = user + "@revolutproject.com";

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: pass
    });

    if (authError) {
        alert("Error creating account: " + authError.message);
        return;
    }

    // Create their profile with $1,000 starting balance
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
            id: authData.user.id,
            username: user,
            usd_balance: 1000.00,
            crypto_balance: 0.00
        }]);

    if (profileError) {
        alert("Error creating profile: " + profileError.message);
    } else {
        alert("Account created with $1,000 free balance! You can now log in.");
        toggleForm();
    }
}


// --- 5. LOGIN ---
async function login() {
    let user = document.getElementById("username").value.trim();
    let pass = document.getElementById("password").value;
    const fakeEmail = user + "@revolutproject.com";

    const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: pass
    });

    if (error) {
        alert("Wrong username or password! Try again.");
    } else {
        localStorage.setItem("isLoggedIn", "true");
        window.location.href = "dashboard.html";
    }
}


// --- 6. DASHBOARD LOGIC ---
if (window.location.pathname.includes("dashboard.html")) {
    if (localStorage.getItem("isLoggedIn") !== "true") {
        window.location.href = "index.html";
    } else {
        loadDashboard();
    }
}

async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, usd_balance, crypto_balance')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Error loading profile:", error);
        return;
    }

    document.getElementById("user-display").innerText = profile.username;
    document.getElementById("usd-balance").innerText = parseFloat(profile.usd_balance).toFixed(2);
    document.getElementById("crypto-balance").innerText = parseFloat(profile.crypto_balance).toFixed(5);
}

async function addMoney() {
    let amount = parseFloat(document.getElementById("add-money-amount").value);

    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
        .from('profiles')
        .select('usd_balance')
        .eq('id', user.id)
        .single();

    let newBalance = parseFloat(profile.usd_balance) + amount;

    const { error } = await supabase
        .from('profiles')
        .update({ usd_balance: newBalance })
        .eq('id', user.id);

    if (error) {
        alert("Failed to add money: " + error.message);
    } else {
        await supabase.from('transactions').insert([{
            user_id: user.id,
            action: 'Added Money',
            amount: amount
        }]);
        alert(`Successfully added $${amount.toFixed(2)}!`);
        document.getElementById("add-money-amount").value = "";
        loadDashboard();
    }
}

async function transferMoney() {
    let receiverUsername = document.getElementById("transfer-username").value.trim();
    let amount = parseFloat(document.getElementById("transfer-amount").value);

    if (!receiverUsername || !amount || amount <= 0) {
        alert("Please enter a valid username and amount.");
        return;
    }

    const { error } = await supabase.rpc('transfer_money', {
        receiver_username: receiverUsername,
        amount: amount
    });

    if (error) {
        alert("Transfer failed: " + error.message);
    } else {
        alert("Money sent successfully!");
        document.getElementById("transfer-username").value = "";
        document.getElementById("transfer-amount").value = "";
        loadDashboard();
    }
}

async function exchangeCrypto() {
    let amountUSD = parseFloat(document.getElementById("exchange-amount").value);

    if (!amountUSD || amountUSD <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
        .from('profiles')
        .select('usd_balance, crypto_balance')
        .eq('id', user.id)
        .single();

    if (amountUSD > profile.usd_balance) {
        alert("Not enough USD!");
        return;
    }

    let btcPrice = 60000;
    let btcBought = amountUSD / btcPrice;

    let newUSD = profile.usd_balance - amountUSD;
    let newCrypto = profile.crypto_balance + btcBought;

    const { error } = await supabase
        .from('profiles')
        .update({ usd_balance: newUSD, crypto_balance: newCrypto })
        .eq('id', user.id);

    if (error) {
        alert("Exchange failed: " + error.message);
    } else {
        await supabase.from('transactions').insert([{
            user_id: user.id,
            action: 'Bought Crypto',
            amount: amountUSD
        }]);

        alert(`You bought ${btcBought.toFixed(6)} BTC!`);
        document.getElementById("exchange-amount").value = "";
        loadDashboard();
    }
}

async function showHistory() {
    let historyBox = document.getElementById("history-box");
    let historyList = document.getElementById("history-list");

    historyList.innerHTML = "<li>Loading...</li>";
    historyBox.classList.remove("hidden");

    const { data: { user } } = await supabase.auth.getUser();

    const { data: history, error } = await supabase
        .from('transactions')
        .select('action, amount, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        historyList.innerHTML = "<li>Error loading history.</li>";
        return;
    }

    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = "<li>No transactions yet.</li>";
    } else {
        history.forEach(function(item) {
            let li = document.createElement("li");
            let date = new Date(item.created_at).toLocaleString();
            li.innerText = `${date} - ${item.action}: $${item.amount}`;
            historyList.appendChild(li);
        });
    }
}

async function changePassword() {
    let newPass = document.getElementById("new-password").value;
    if (newPass.length < 4) {
        alert("Password must be at least 4 characters long!");
        return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPass });

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Password changed successfully!");
        document.getElementById("new-password").value = "";
    }
}

async function logout() {
    await supabase.auth.signOut();
    localStorage.setItem("isLoggedIn", "false");
    window.location.href = "index.html";
}

// --- NEW SIGNUP PAGE LOGIC ---
async function createAccount() {
    let username = document.getElementById("username").value.trim();
    let email = document.getElementById("email").value.trim();
    let pass = document.getElementById("password").value;
    let confirmPass = document.getElementById("confirm-password").value;

    // Validation
    if (username === "" || pass === "") {
        alert("Please fill in the username and password.");
        return;
    }
    if (pass.length < 4) {
        alert("Password must be at least 4 characters long.");
        return;
    }
    if (pass !== confirmPass) {
        alert("Passwords do not match. Please try again.");
        return;
    }

    // Use the real email if provided, otherwise a fake one
    let finalEmail = email !== "" ? email : username + "@revolutproject.com";

    // Step 1: Create the user in Supabase Authentication
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: pass
    });

    if (authError) {
        alert("Error creating account: " + authError.message);
        return;
    }

    // Step 2: Create their profile with $1,000 starting balance
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
            id: authData.user.id,
            username: username,
            usd_balance: 1000.00,
            crypto_balance: 0.00
        }]);

    if (profileError) {
        alert("Error saving profile: " + profileError.message);
        return;
    }

    // Step 3: Success! Send them to the login page
    alert("🎉 Account created successfully! You got $1,000 to start. Please log in.");
    window.location.href = "index.html";
}
