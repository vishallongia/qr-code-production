document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".form-container");
  const registerToggle = document.getElementById("register-toggle");
  const loginToggle = document.getElementById("login-toggle");

  registerToggle.addEventListener("click", (e) => {
    e.preventDefault();
    container.classList.add("active");
  });

  loginToggle.addEventListener("click", (e) => {
    e.preventDefault();
    container.classList.remove("active");
  });
});

function toggleMagicLink() {
  const passwordField = document.getElementById("PasswordText").closest(".input-group");
  const loginButton = document.getElementById("LoginBtnText");
  const magicLinkText = document.getElementById("magicLinkText");

  if (passwordField.style.display === "none") {
    // Switch back to Password Login
    passwordField.style.display = "flex";
    loginButton.textContent = "Login";
    loginButton.setAttribute("onclick", "return handleLogin(event)");
    magicLinkText.textContent = "Use Magic Link";
  } else {
    // Switch to Magic Link Login
    passwordField.style.display = "none";
    loginButton.textContent = "Send Magic Link";
    loginButton.setAttribute("onclick", "return handleMagicLink(event)");
    magicLinkText.textContent = "Use Password";
  }
}
