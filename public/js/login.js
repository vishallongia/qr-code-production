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

  if (window.matchMedia("(max-width: 480px)").matches) {
    document.querySelectorAll(".google-box, .magic-link-box").forEach((box) => {
      box.classList.add("no-hover"); // Disable hover effect on mobile
      box.addEventListener("touchstart", function () {
        this.classList.add("hovered"); // Apply hover effect on touch
      });

      box.addEventListener("touchend", function () {
        setTimeout(() => this.classList.remove("hovered"), 1000); // Remove after 300ms
      });
    });
  }
});

// Function to toggle Magic Link for both login and register
function toggleMagicLink(formType) {
  let passwordField, loginButton, magicLinkText, fullNameField;

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
    fullNameField = document
      .getElementById("FullNameText")
      .closest(".input-group");
  }

  if (passwordField.style.display === "none") {
    // Switch back to Password Login/Register
    if (fullNameField) {
      fullNameField.style.display = "flex";
    }
    passwordField.style.display = "flex";
    loginButton.textContent = formType === "login" ? "Login" : "Register";
    loginButton.removeAttribute("onclick");
    magicLinkText.textContent = "Use Magic Link";
  } else {
    // Switch to Magic Link Login/Register
    if (fullNameField) {
      fullNameField.style.display = "none";
    }
    passwordField.style.display = "none";
    loginButton.textContent = "Send Magic Link";
    loginButton.setAttribute(
      "onclick",
      "return handleMagicLink(event,'EmailText', 'LoginBtnText')"
    );
    magicLinkText.textContent = "Use Password";
  }
}
