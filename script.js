const tabButtons = document.querySelectorAll(".tab-button");
const message = document.getElementById("message");

const chatArea = document.getElementById("chat-area");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messageList = document.getElementById("message-list");

const businessArea = document.getElementById("business-area");
const businessName = document.getElementById("business-name");
const businessDescription = document.getElementById("business-description");
const businessSaveButton = document.getElementById("business-save-button");
const businessList = document.getElementById("business-list");

const MESSAGE_KEY = "yelo-chat-messages";
const BUSINESS_KEY = "yelo-businesses";

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

function loadBusinesses() {
  const saved = localStorage.getItem(BUSINESS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveBusinesses(list) {
  localStorage.setItem(BUSINESS_KEY, JSON.stringify(list));
}

function showBusinesses() {
  businessList.innerHTML = "";
  loadBusinesses().forEach(function (business) {
    const item = document.createElement("li");

    const nameLine = document.createElement("strong");
    nameLine.textContent = business.name;

    const descriptionLine = document.createElement("p");
    descriptionLine.textContent = business.description;

    item.appendChild(nameLine);
    item.appendChild(descriptionLine);
    businessList.appendChild(item);
  });
}

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
      showBusinesses();
    }
  });
});

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

businessSaveButton.addEventListener("click", function () {
  const name = businessName.value.trim();
  const description = businessDescription.value.trim();
  if (name === "") {
    return;
  }

  const list = loadBusinesses();
  list.push({ name: name, description: description });
  saveBusinesses(list);

  businessName.value = "";
  businessDescription.value = "";
  showBusinesses();
});
