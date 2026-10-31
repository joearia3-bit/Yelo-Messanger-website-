const tabButtons = document.querySelectorAll(".tab-button");
const message = document.getElementById("message");

const chatArea = document.getElementById("chat-area");
const chatListArea = document.getElementById("chat-list-area");
const incomingList = document.getElementById("incoming-list");
const connectionList = document.getElementById("connection-list");
const threadArea = document.getElementById("thread-area");
const threadTitle = document.getElementById("thread-title");
const threadMessages = document.getElementById("thread-messages");
const threadInput = document.getElementById("thread-input");
const threadSend = document.getElementById("thread-send");
const threadBack = document.getElementById("thread-back");
const chatStatus = document.getElementById("chat-status");

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
const POLL_MS = 4000;

let currentConnection = null;
let pollTimer = null;

// ----- Session and helpers -----

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

function headers(session, extra) {
  return Object.assign({
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + session.token
  }, extra || {});
}

function checkResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Your session has expired. Tap the Business tab again.");
  }
  if (!response.ok) {
    throw new Error("Something went wrong on the server (error " + response.status + ").");
  }
  return response;
}

function makeReference() {
  return "YEL-" + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
}

function showChatStatus(text) {
  chatStatus.textContent = text;
}

function showBusinessMessage(text) {
  businessStatus.textContent = text;
}

function makeItem(title, lines) {
  const item = document.createElement("li");

  const titleLine = document.createElement("strong");
  titleLine.textContent = title;
  item.appendChild(titleLine);

  lines.forEach(function (text) {
    const line = document.createElement("p");
    line.textContent = text;
    item.appendChild(line);
  });

  return item;
}

function makeButton(label, onClick, secondary) {
  const button = document.createElement("button");
  button.textContent = label;
  button.className = secondary ? "list-button secondary" : "list-button";
  button.addEventListener("click", onClick);
  return button;
}

// ----- Chats (shared, saved online) -----

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(loadThread, POLL_MS);
}

async function loadChats() {
  stopPolling();
  currentConnection = null;
  threadArea.classList.add("hidden");
  chatListArea.classList.remove("hidden");
  incomingList.innerHTML = "";
  connectionList.innerHTML = "";
  showChatStatus("");

  try {
    const session = await getSession();
    const response = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/connections?select=id,status,customer_id,business_id,businesses(name,owner_id)&order=created_at.desc",
      { headers: headers(session) }
    ));
    const connections = await response.json();

    if (connections.length === 0) {
      showChatStatus("No chats yet. Request a chat from the Business tab.");
    }

    connections.forEach(function (connection) {
      const businessName = connection.businesses ? connection.businesses.name : "a business";
      const isOwner = connection.businesses && connection.businesses.owner_id === session.userId;

      if (isOwner && connection.status === "pending") {
        const item = makeItem("New chat request for " + businessName, [
          "Accept to start chatting, or decline."
        ]);
        item.appendChild(makeButton("Accept", function () {
          updateConnection(connection.id, "accepted");
        }));
        item.appendChild(makeButton("Decline", function () {
          updateConnection(connection.id, "declined");
        }, true));
        incomingList.appendChild(item);
        return;
      }

      const lines = [isOwner ? "Your business: " + businessName : "Business: " + businessName];
      const item = makeItem(isOwner ? "Chat with a customer" : businessName, lines);

      if (connection.status === "accepted") {
        item.appendChild(makeButton("Open chat", function () {
          openThread(connection, isOwner, businessName);
        }));
      } else if (connection.status === "pending") {
        const line = document.createElement("p");
        line.textContent = "Waiting for the business to accept.";
        item.appendChild(line);
      } else {
        const line = document.createElement("p");
        line.textContent = "This request was declined.";
        item.appendChild(line);
      }

      connectionList.appendChild(item);
    });
  } catch (error) {
    showChatStatus(error.message);
  }
}

async function updateConnection(id, status) {
  try {
    const session = await getSession();
    checkResponse(await fetch(SUPABASE_URL + "/rest/v1/connections?id=eq." + id, {
      method: "PATCH",
      headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=minimal" }),
      body: JSON.stringify({ status: status })
    }));
    await loadChats();
  } catch (error) {
    showChatStatus(error.message);
  }
}

function openThread(connection, isOwner, businessName) {
  currentConnection = { id: connection.id, isOwner: isOwner };
  threadTitle.textContent = isOwner ? "Chat with a customer" : "Chat with " + businessName;
  chatListArea.classList.add("hidden");
  threadArea.classList.remove("hidden");
  threadMessages.innerHTML = "";
  showChatStatus("");
  loadThread();
  startPolling();
}

async function loadThread() {
  if (!currentConnection) {
    return;
  }

  try {
    const session = await getSession();
    const response = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/messages?select=id,body,sender_id,created_at&connection_id=eq." + currentConnection.id + "&order=created_at.asc",
      { headers: headers(session) }
    ));
    const messages = await response.json();

    threadMessages.innerHTML = "";
    messages.forEach(function (message) {
      const item = document.createElement("li");
      const who = message.sender_id === session.userId ? "You: " : "Them: ";
      item.textContent = who + message.body;
      threadMessages.appendChild(item);
    });
  } catch (error) {
    showChatStatus(error.message);
  }
}

async function sendThreadMessage() {
  const text = threadInput.value.trim();
  if (text === "" || !currentConnection) {
    return;
  }

  try {
    const session = await getSession();
    checkResponse(await fetch(SUPABASE_URL + "/rest/v1/messages", {
      method: "POST",
      headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=minimal" }),
      body: JSON.stringify({
        connection_id: currentConnection.id,
        sender_id: session.userId,
        body: text
      })
    }));
    threadInput.value = "";
    await loadThread();
  } catch (error) {
    showChatStatus(error.message);
  }
}

// ----- Businesses (saved online) -----

function addMyBusiness(business) {
  const lines = [
    business.category + " in " + business.town,
    business.description || "",
    "Status: " + (business.verified ? "Verified" : "Waiting for verification")
  ];
  myBusinessList.appendChild(makeItem(business.name, lines));
}

async function loadBusinesses() {
  myBusinessList.innerHTML = "";
  businessList.innerHTML = "";
  showBusinessMessage("");

  try {
    const session = await getSession();

    const mineResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=name,category,town,description,verified&owner_id=eq." + session.userId + "&order=created_at.desc",
      { headers: headers(session) }
    ));
    const mine = await mineResponse.json();
    mine.forEach(addMyBusiness);

    const verifiedResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=id,name,category,town,description,owner_id&verified=eq.true&order=created_at.desc",
      { headers: headers(session) }
    ));
    const verified = await verifiedResponse.json();

    const requestsResponse = checkResponse(await fetch(
      SUPABASE_URL + "/rest/v1/connections?select=business_id,status&customer_id=eq." + session.userId,
      { headers: headers(session) }
    ));
    const requests = await requestsResponse.json();
    const requestStatus = {};
    requests.forEach(function (row) {
      requestStatus[row.business_id] = row.status;
    });

    verified.forEach(function (business) {
      const lines = [business.category + " in " + business.town, business.description || ""];
      const item = makeItem(business.name, lines);

      if (business.owner_id === session.userId) {
        const line = document.createElement("p");
        line.textContent = "This is your business.";
        item.appendChild(line);
      } else if (requestStatus[business.id]) {
        const line = document.createElement("p");
        const status = requestStatus[business.id];
        line.textContent = status === "accepted" ? "Chat is open. Find it on the Chats tab."
          : status === "pending" ? "Chat request sent. Waiting for the business to accept."
          : "Your chat request was declined.";
        item.appendChild(line);
      } else {
        item.appendChild(makeButton("Request chat", function () {
          requestChat(business.id);
        }));
      }

      businessList.appendChild(item);
    });
  } catch (error) {
    showBusinessMessage(error.message);
  }
}

async function requestChat(businessId) {
  try {
    const session = await getSession();
    checkResponse(await fetch(SUPABASE_URL + "/rest/v1/connections", {
      method: "POST",
      headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=minimal" }),
      body: JSON.stringify({
        customer_id: session.userId,
        business_id: businessId,
        status: "pending"
      })
    }));
    showBusinessMessage("Chat request sent. Check the Chats tab for updates.");
    await loadBusinesses();
  } catch (error) {
    showBusinessMessage(error.message);
  }
}

// ----- Tabs -----

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const tabName = button.getAttribute("data-tab");
    message.textContent = "You opened the " + tabName + " tab.";

    stopPolling();
    chatArea.classList.add("hidden");
    businessArea.classList.add("hidden");

    if (tabName === "Chats") {
      chatArea.classList.remove("hidden");
      loadChats();
    } else if (tabName === "Business") {
      businessArea.classList.remove("hidden");
      loadBusinesses();
    }
  });
});

// ----- Chat thread buttons -----

threadSend.addEventListener("click", sendThreadMessage);
threadBack.addEventListener("click", loadChats);

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
      headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=minimal" }),
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
    await loadBusinesses();
  } catch (error) {
    showBusinessMessage(error.message);
  }
})
