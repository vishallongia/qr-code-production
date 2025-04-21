const form = document.getElementById("profileForm");
const inputs = form.querySelectorAll("input");
const editBtn = document.getElementById("editBtn");
const updateProfileBtn = document.getElementById("updateProfileBtn");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

editBtn.addEventListener("click", () => {
  // let lang = document.getElementById("languageSwitcher").value
  let lang = "en";

  let isEditing = false;

  if (lang == "en") {
    isEditing = editBtn.textContent === "Edit Profile";
  } else if (lang == "de") {
    isEditing = editBtn.textContent === "Mein Profil bearbeiten";
  } else if (lang == "hu") {
    isEditing = editBtn.textContent === "Profil szerkesztése";
  }

  inputs.forEach((input) => (input.disabled = !isEditing));

  if (lang == "en") {
    editBtn.textContent = isEditing ? "Cancel" : "Edit Profile";
  } else if (lang == "de") {
    editBtn.textContent = isEditing ? "Unterbrechen" : "Mein Profil bearbeiten";
  } else if (lang == "hu") {
    editBtn.textContent = isEditing ? "Mégse" : "Profil szerkesztése";
  }

  updateProfileBtn.style.display = isEditing ? "block" : "none";
});

togglePassword.addEventListener("click", function () {
  const type =
    passwordInput.getAttribute("type") === "password" ? "text" : "password";
  passwordInput.setAttribute("type", type);
  this.classList.toggle("fa-eye");
  this.classList.toggle("fa-eye-slash");
});

// Update profile for user

// Handle the form submission for updating details
async function handleUpdateDetailsProfile(event) {
  event.preventDefault(); // Prevent the default form submission
  const form = event.target; // Get the form element
  const formData = new FormData(form); // Use the FormData API
  const data = Object.fromEntries(formData); // Convert FormData to an object

  // Call the updateDetails function
  try {
    updateProfileBtn.disabled = true;
    const result = await updateDetailsProfile(data); // Call the API function
    let msg = "Profile updated successfully";
    // if (result.message == "Profile updated successfully") {
    //   let lang = document.getElementById("languageSwitcher").value
    //   if (lang == "de") {
    //     msg = "Deine Zugangsdaten wurden erfolgreich aktualisiert"
    //   } else if (lang == "hu") {
    //     msg = "A belépési adataidat sikeresen módosítottad"
    //   } else {
    //     msg = "Profile updated successfully"
    //   }
    // }

    showToast(msg, "success");
    // showToast(result.message, "success"); // Show success message
    updateProfileBtn.disabled = false;
    // Redirect to login page after successful logout
    setTimeout(() => {
      window.location.reload();
    }, 1000); // Optional delay to let the toast show up
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error"); // Show error message
    updateProfileBtn.disabled = false;
  }
}

// Function to update user details
async function updateDetailsProfile(data) {
  try {
    const response = await fetch(`/change-my-profile`, {
      method: "POST", // Use PUT for updating resources
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data), // Send the form data as JSON
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Update failed!");
    }

    // Return the response data
    return await response.json();
  } catch (error) {
    console.error("Error:", error);
    throw error; // Propagate error for handling in the calling function
  }
}
