const passwordInput =
  document.getElementById("PasswordText") ||
  document.getElementById("RegisterPasswordText");
const togglePasswordIcon = document.querySelector(".toggle-password svg");
// document.addEventListener("DOMContentLoaded", () => {
//   const container = document.querySelector(".form-container");
//   const registerToggle = document.getElementById("register-toggle");
//   const loginToggle = document.getElementById("login-toggle");

//   registerToggle.addEventListener("click", (e) => {
//     e.preventDefault();
//     container.classList.add("active");
//   });

//   loginToggle.addEventListener("click", (e) => {
//     e.preventDefault();
//     container.classList.remove("active");
//   });

//   if (window.matchMedia("(max-width: 480px)").matches) {
//     document.querySelectorAll(".google-box, .magic-link-box").forEach((box) => {
//       box.classList.add("no-hover"); // Disable hover effect on mobile
//       box.addEventListener("touchstart", function () {
//         this.classList.add("hovered"); // Apply hover effect on touch
//       });

//       box.addEventListener("touchend", function () {
//         setTimeout(() => this.classList.remove("hovered"), 1000); // Remove after 300ms
//       });
//     });
//   }
// });

togglePasswordIcon.addEventListener("click", function () {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";

  // Toggle icon (swap between eye and eye-slash if needed)
  togglePasswordIcon.innerHTML = isPassword
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
         <path d="M1 12C2.73 7.61 7.03 4.5 12 4.5C16.97 4.5 21.27 7.61 23 12C21.27 16.39 16.97 19.5 12 19.5C7.03 19.5 2.73 16.39 1 12Z" stroke="rgba(113,113,115,1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
         <circle cx="12" cy="12" r="3" stroke="rgba(113,113,115,1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
       </svg>` // Eye icon
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
         <path d="M2 2L22 22M12 5C16.42 5 20.17 7.91 22 12C21.34 13.52 20.34 14.88 19.07 15.97M9.88 9.88C9.34 10.42 9 11.17 9 12C9 13.66 10.34 15 12 15C12.83 15 13.58 14.66 14.12 14.12M17 17C15.44 18.24 13.52 19 11.5 19C7.5 19 4.03 16.36 2.5 12.5C3.41 10.03 5.2 7.98 7.47 6.74" stroke="rgba(113, 113, 115, 1)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
       </svg>`; // Eye-slash icon
});

// Function to toggle Magic Link for both login and register
function toggleMagicLink(formType) {
  let passwordField, loginButton, magicLinkText, fullNameField;
  let MagicLinkBtnText = "Send Magic Link"

  if (formType === "login") {
    passwordField = document
      .getElementById("PasswordText")
      .closest(".password-wrapper");
    loginButton = document.getElementById("LoginBtnText");
    magicLinkText = document.getElementById("magicLinkText");
    loginButton.setAttribute(
      "onclick",
      "return handleMagicLink(event,'EmailText', 'LoginBtnText')"
    );
    MagicLinkBtnText = "Send Magic Link"
  } else if (formType === "register") {
    passwordField = document
      .getElementById("RegisterPasswordText")
      .closest(".password-wrapper");
    loginButton = document.getElementById("RegisterBtnText");
    magicLinkText = document.getElementById("registerMagicLinkText");
    fullNameField = document.getElementById("FullNameText");
    loginButton.setAttribute(
      "onclick",
      "return handleMagicLink(event,'EmailText', 'RegisterBtnText')"
    );
    MagicLinkBtnText = "Activate via Magic Link"
  }

  if (passwordField.style.display === "none") {
    // Switch back to Password Login/Register
    if (fullNameField) {
      fullNameField.style.display = "flex";
    }
    passwordField.style.display = "flex";
    loginButton.textContent = formType === "login" ? "Login" : "Register";
    loginButton.removeAttribute("onclick");
    magicLinkText.textContent = "Login with Magic Link";
  } else {
    // Switch to Magic Link Login/Register
    if (fullNameField) {
      fullNameField.style.display = "none";
    }
    passwordField.style.display = "none";
    loginButton.textContent = MagicLinkBtnText;

    magicLinkText.textContent = "Login by Email and Password";
  }
}
