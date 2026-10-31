const tabButtons = document.querySelectorAll(".tab-button");
const message = document.getElementById("message");
const chatArea = document.getElementById("chat-area");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const messageList = document.getElementById("message-list");

const STORAGE_KEY = "yelo-chat-messages";

function loadMessages() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveMessages(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function showMessages() {
  messageList.innerHTML = "";
  const list = loadMessages();
  list.forEach(function (text) {
    const item = document.createElement("li");
    item.textContent = text;
    messageList.appendChild(item);
  });
}

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const tabName = button.getAttribute("data-tab");
    message.textContent = "You opened the " + tabName + " tab.";

    if (tabName === "Chats") {
      chatArea.classList.remove("hidden");
      showMessages();
    } else {
      chatArea.classList.add("hidden");
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
