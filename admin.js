const SUPABASE_URL = "https://pzbilniamaidcicacclo.supabase.co";
const SUPABASE_KEY = "sb_publishable_PbC6peJ59FeqjMF1X75RbA_rNoh_Bkn";
const SESSION_KEY = "yelo-session";

const adminStatus = document.getElementById("admin-status");
const loginArea = document.getElementById("login-area");
const loginStatus = document.getElementById("login-status");
const adminEmail = document.getElementById("admin-email");
const adminPassword = document.getElementById("admin-password");
const adminSignInButton = document.getElementById("admin-signin-button");
const pendingList = document.getElementById("pending-list");
const verifiedList = document.getElementById("verified-list");
const blockedList = document.getElementById("blocked-list");

function saveSession(data, email) {
  const expiresAt = data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  const session = {
    token: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAt,
    userId: data.user.id,
    email: data.user.email || email || ""
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function refreshSession(session) {
  if (!session.refreshToken) {
    return null;
  }

  const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  });

  if (!response.ok) {
    return null;
  }

  return saveSession(await response.json(), session.email);
}

async function getValidSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) {
    return null;
  }

  const session = JSON.parse(saved);
  const now = Math.floor(Date.now() / 1000);

  if (session.expiresAt && now > session.expiresAt - 60) {
    const refreshed = await refreshSession(session);
    if (!refreshed) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return refreshed;
  }

  return session;
}

function authHeaders(session, extra) {
  return Object.assign({
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + session.token,
    "Content-Type": "application/json"
  }, extra || {});
}

function checkResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    const error = new Error("Your session has expired. Sign in again.");
    error.needsLogin = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error("Something went wrong on the server (error " + response.status + ").");
  }
  return response;
}

function showLogin(text) {
  loginArea.classList.remove("hidden");
  loginStatus.textContent = text;
  adminStatus.textContent = "";
}

function hideLogin() {
  loginArea.classList.add("hidden");
  loginStatus.textContent = "";
}

async function signIn() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value;

  if (!email.includes("@") || password === "") {
    loginStatus.textContent = "Please enter your email and password.";
    return;
  }

  loginStatus.textContent = "Signing in...";

  try {
    const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: email, password: password })
    });

    if (!response.ok) {
      throw new Error("Email or password is not correct.");
    }

    saveSession(await response.json(), email);
    adminPassword.value = "";
    hideLogin();
    await loadAdmin();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
}

async function changeBusiness(session, id, changes) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/businesses?id=eq." + id, {
    method: "PATCH",
    headers: authHeaders(session, { "Prefer": "return=minimal" }),
    body: JSON.stringify(changes)
  });
  checkResponse(response);
}

function addBusiness(container, business, phone, buttons, session) {
  const item = document.createElement("li");

  const nameLine = document.createElement("strong");
  nameLine.textContent = business.name;

  const detailLine = document.createElement("p");
  detailLine.textContent = business.category + " in " + business.town;

  const descriptionLine = document.createElement("p");
  descriptionLine.textContent = business.description || "";

  const phoneLine = document.createElement("p");
  phoneLine.textContent = "Phone: " + (phone || "not available");

  item.appendChild(nameLine);
  item.appendChild(detailLine);
  item.appendChild(descriptionLine);
  item.appendChild(phoneLine);

  buttons.forEach(function (button) {
    const control = document.createElement("button");
    control.textContent = button.label;
    control.className = button.secondary ? "admin-button secondary" : "admin-button";
    control.addEventListener("click", async function () {
      control.disabled = true;
      try {
        await changeBusiness(session, business.id, button.changes);
        await loadAdmin();
      } catch (error) {
        adminStatus.textContent = error.message;
        control.disabled = false;
      }
    });
    item.appendChild(control);
  });

  container.appendChild(item);
}

async function loadAdmin() {
  pendingList.innerHTML = "";
  verifiedList.innerHTML = "";
  blockedList.innerHTML = "";
  adminStatus.textContent = "";
  hideLogin();

  try {
    const session = await getValidSession();
    if (!session) {
      showLogin("Sign in with your admin email and password.");
      return;
    }

    const adminResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/admins?select=user_id&user_id=eq." + session.userId,
      { headers: authHeaders(session) }
    ));
    const admins = await adminResponse.json();
    if (admins.length === 0) {
      adminStatus.textContent = "This account is not an admin.";
      return;
    }

    const businessResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=id,name,category,town,description,verified,blocked&order=created_at.desc",
      { headers: authHeaders(session) }
    ));
    const businesses = await businessResponse.json();

    const phoneResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/rpc/admin_business_phones",
      { method: "POST", headers: authHeaders(session), body: "{}" }
    ));
    const phones = await phoneResponse.json();
    const phoneById = {};
    phones.forEach(function (row) {
      phoneById[row.id] = row.phone;
    });

    businesses.forEach(function (business) {
      const phone = phoneById[business.id];

      if (business.blocked) {
        addBusiness(blockedList, business, phone, [
          { label: "Unblock", changes: { blocked: false }, secondary: true }
        ], session);
      } else if (business.verified) {
        addBusiness(verifiedList, business, phone, [
          { label: "Unverify", changes: { verified: false }, secondary: true },
          { label: "Block", changes: { blocked: true, verified: false } }
        ], session);
      } else {
        addBusiness(pendingList, business, phone, [
          { label: "Verify", changes: { verified: true } },
          { label: "Block", changes: { blocked: true }, secondary: true }
        ], session);
      }
    });

    if (businesses.length === 0) {
      adminStatus.textContent = "No businesses yet.";
    }
  } catch (error) {
    if (error.needsLogin) {
      showLogin(error.message);
    } else {
      adminStatus.textContent = error.message;
    }
  }
}

adminSignInButton.addEventListener("click", signIn);

loadAdmin();
