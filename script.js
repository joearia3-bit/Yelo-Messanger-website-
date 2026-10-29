const tabButtons = document.querySelectorAll(".tab-button");
const message = document.getElementById("message");

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const tabName = button.getAttribute("data-tab");
    message.textContent = "You opened the " + tabName + " tab.";
  });
});
