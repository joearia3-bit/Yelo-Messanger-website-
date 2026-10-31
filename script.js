const tabButtons = document.querySelectorAll(".tab-button");
const message = document.getElementById("message");

const chatArea = document.getElementById("chat-area");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messageList = document.getElementById("message-list");

const businessArea = document.getElementById("business-area");
const businessName = document.getElementById("business-name");
const businessCategory = document.getElementById("business-category");
const businessTown = document.getElementById("business-town");
const businessPhone = document.getElementById("business-phone");
const businessDescription = document.getElementById("business-description");
const businessSaveButton = document.getElementById("business-save-button");
const businessStatus = document.getElementById("business-status");
const myBusinessList = document.getElementById("my-business-list");
const businessList = document.getElementById("business-list");

const SUPABASE_URL = "https://pzbilniamaidcicacclo.supabase.co";
const SUPABASE_KEY = "sb_publishable_PbC6peJ59FeqjMF1X75RbA_rNoh_Bkn";
const SESSION_KEY = "yelo-session";
const MESSAGE_KEY = "yelo-chat-messages";

// ----- Chats (saved on this phone) -----

function loadMessages() {
  const saved = localStorage.getItem(MESSAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveMessages(list) {
  localStorage.setItem(MESSAGE_KEY, JSON.stringify(list));
}

function showMessages() {
  messageList.innerHTML = "";
  loadMessages().forEach(function (text) {
    const item = document.createElement("li");
    item.textContent = text;
    messageList.appendChild(item);
  });
}

// ----- Businesses (saved online in Supabase) -----

async function getSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  const response = await fetch(SUPABASE_URL + "/auth/v1/signup", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error("Could not start a session. Check that anonymous sign-ins are turned on in Supabase.");
  }

  const data = await response.json();
  const session = { token: data.access_token, userId: data.user.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function checkResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Your session has expired. Tap Save business again.");
  }
  if (!response.ok) {
    throw new Error("Something went wrong on the server (error " + response.status + ").");
  }
  return response;
}

function makeReference() {
  return "YEL-" + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
}

function showBusinessMessage(text) {
  businessStatus.textContent = text;
}

function addBusinessItem(container, business, showStatus) {
  const item = document.createElement("li");

  const nameLine = document.createElement("strong");
  nameLine.textContent = business.name;

  const detailLine = document.createElement("p");
  detailLine.textContent = business.category + " in " + business.town;

  const descriptionLine = document.createElement("p");
  descriptionLine.textContent = business.description || "";

  item.appendChild(nameLine);
  item.appendChild(detailLine);
  item.appendChild(descriptionLine);

  if (showStatus) {
    const statusLine = document.createElement("p");
    statusLine.textContent = business.verified ? "Status: Verified" : "Status: Waiting for verification";
    item.appendChild(statusLine);
  }

  container.appendChild(item);
}

async function showBusinesses() {
  myBusinessList.innerHTML = "";
  businessList.innerHTML = "";

  try {
    const session = await getSession();
    const headers = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + session.token };

    const mineResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=name,category,town,description,verified&owner_id=eq." + session.userId + "&order=created_at.desc",
      { headers: headers }
    ));
    const mine = await mineResponse.json();
    mine.forEach(function (business) {
      addBusinessItem(myBusinessList, business, true);
    });

    const publicResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=name,category,town,description,verified&verified=eq.true&order=created_at.desc",
      { headers: { "apikey": SUPABASE_KEY } }
    ));
    const verified = await publicResponse.json();
    verified.forEach(function (business) {
      addBusinessItem(businessList, business, false);
    });
  } catch (error) {
    showBusinessMessage(error.message);
  }
}

// ----- Tabs -----

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const tabName = button.getAttribute("data-tab");
    message.textContent = "You opened the " + tabName + " tab.";

    chatArea.classList.add("hidden");
    businessArea.classList.add("hidden");

    if (tabName === "Chats") {
      chatArea.classList.remove("hidden");
      showMessages();
    } else if (tabName === "Business") {
      businessArea.classList.remove("hidden");
      showBusinessMessage("");
      showBusinesses();
    }
  });
});

// ----- Send chat message -----

sendButton.addEventListener("click", function () {
  const text = chatInput.value.trim();
  if (text === "") {
    return;
  }

  const list = loadMessages();
  list.push(text);
  saveMessages(list);

  chatInput.value = "";
  showMessages();
});

// ----- Save business -----

businessSaveButton.addEventListener("click", async function () {
  const name = businessName.value.trim();
  const category = businessCategory.value.trim();
  const town = businessTown.value.trim();
  const phone = businessPhone.value.trim();
  const description = businessDescription.value.trim();

  if (name.length < 2) {
    showBusinessMessage("Please enter a business name (at least 2 letters).");
    return;
  }
  if (category === "" || town === "" || phone === "") {
    showBusinessMessage("Please fill in category, town and phone.");
    return;
  }
  if (description.length > 200) {
    showBusinessMessage("The description must be 200 characters or fewer.");
    return;
  }

  showBusinessMessage("Saving...");

  try {
    const session = await getSession();

    checkResponse(await fetch(SUPABASE_URL + "/rest/v1/businesses", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + session.token,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        owner_id: session.userId,
        name: name,
        category: category,
        town: town,
        phone: phone,
        description: description,
        reference: makeReference(),
        paid: false,
        verified: false,
        blocked: false
      })
    }));

    businessName.value = "";
    businessCategory.value = "";
    businessTown.value = "";
    businessPhone.value = "";
    businessDescription.value = "";
    showBusinessMessage("Saved. It will appear in the verified list after it is checked.");
    await showBusinesses();
  } catch (error) {
    showBusinessMessage(error.message);
  }
});
