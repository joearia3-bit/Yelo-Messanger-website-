const SUPABASE_URL = "https://pzbilniamaidcicacclo.supabase.co";
const SUPABASE_KEY = "sb_publishable_PbC6peJ59FeqjMF1X75RbA_rNoh_Bkn";
const SESSION_KEY = "yelo-session";

const adminStatus = document.getElementById("admin-status");
const pendingList = document.getElementById("pending-list");
const verifiedList = document.getElementById("verified-list");
const blockedList = document.getElementById("blocked-list");

function getSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

function authHeaders(session) {
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + session.token,
    "Content-Type": "application/json"
  };
}

function checkResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Your session has expired. Open the main site, tap Business, then come back here.");
  }
  if (!response.ok) {
    throw new Error("Something went wrong on the server (error " + response.status + ").");
  }
  return response;
}

async function changeBusiness(session, id, changes) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/businesses?id=eq." + id, {
    method: "PATCH",
    headers: Object.assign(authHeaders(session), { "Prefer": "return=minimal" }),
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

  const session = getSession();
  if (!session) {
    adminStatus.textContent = "Open the main site and tap Business first, so this phone has a session. Then come back here.";
    return;
  }

  try {
    const adminResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/admins?select=user_id&user_id=eq." + session.userId,
      { headers: authHeaders(session) }
    ));
    const admins = await adminResponse.json();
    if (admins.length === 0) {
      adminStatus.textContent = "This phone is not an admin account.";
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
    adminStatus.textContent = error.message;
  }
}

loadAdmin();
