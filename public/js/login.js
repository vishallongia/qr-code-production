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

// Function to toggle Magic Link for both login and register
function toggleMagicLink(formType) {
  let passwordField, loginButton, magicLinkText;

  if (formType === "login") {
    passwordField = document
      .getElementById("PasswordText")
      .closest(".input-group");
    loginButton = document.getElementById("LoginBtnText");
    magicLinkText = document.getElementById("magicLinkText");
  } else if (formType === "register") {
    passwordField = document
      .getElementById("RegisterPasswordText")
      .closest(".input-group");
    loginButton = document.getElementById("RegisterBtnText");
    magicLinkText = document.getElementById("registerMagicLinkText");
  }

  if (passwordField.style.display === "none") {
    // Switch back to Password Login/Register
    passwordField.style.display = "flex";
    loginButton.textContent = formType === "login" ? "Login" : "Register";
    loginButton.setAttribute(
      "onclick",
      formType === "login"
        ? "return handleLogin(event)"
        : "return handleRegister(event)"
    );
    magicLinkText.textContent = "Use Magic Link";
  } else {
    // Switch to Magic Link Login/Register
    passwordField.style.display = "none";
    loginButton.textContent = "Send Magic Link";
    loginButton.setAttribute("onclick", "return handleMagicLink(event)");
    magicLinkText.textContent = "Use Password";
  }
}
