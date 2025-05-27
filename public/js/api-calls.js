const loginBtn = document.getElementById("LoginBtnText");
const registerBtn = document.getElementById("RegisterBtnText");
const updateBtn = document.getElementById("UpdateBtn");

// Function to register a user
async function registerUser(data) {
  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data), // Send the form data as JSON
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Registration failed!");
    }

    // Return the response data
    return await response.json();
  } catch (error) {
    console.error("Error:", error);
    throw error; // Propagate error for handling in the calling function
  }
}

// Function to log in a user and receive a JWT token
async function loginUser(data) {
  try {
    // Set avoidAffiliate flag based on current pathname
    const path = window.location.pathname;
    data.avoidAffiliate = path === "/" ? true : false;
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data), // Send login data as JSON
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Login failed!");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error; // Propagate error for handling in the calling function
  }
}

// Handle the form submission
async function handleRegister(event) {
  event.preventDefault(); // Prevent the default form submission

  const form = event.target; // Get the form element
  const formData = new FormData(form); // Use the FormData API
  const data = Object.fromEntries(formData); // Convert FormData to an object

  // Call the registerUser function
  try {
    registerBtn.disabled = true;
    const result = await registerUser(data); // Call the API function
    showToast(result.message, "success"); // Show success message
    registerBtn.disabled = false;
    if (result.redirect) {
      // If the user was created by admin (affiliate), redirect after a delay
      setTimeout(() => {
        window.location.href = result.redirect;
      }, 1000); // Adjust delay as needed
    } else {
      // Self registration → go to magic code
      window.location.href = "/magiccode";
    }
    form.reset(); // Reset the form after successful submission
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error"); // Show error message
    registerBtn.disabled = false;
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    loginBtn.disabled = true;
    const result = await loginUser(data); // Call the login API
    form.reset(); // Reset the form after successful login

    showToast(result.message, "success");
    loginBtn.disabled = false;
    // Redirect to login page after successful logout
    setTimeout(() => {
      if (result.role === "admin") {
        window.location.href = "/admindashboard";
      } else if (result.role === "demo-user") {
        window.location.href = `/dashboard?magiccode=${result.qrCodeDataId}`;
      } else if (result.role === "affiliate") {
        window.location.href = `/sales`;
      } else {
        window.location.href = "/magiccode";
      }
    }, 1000); // Optional delay to let the toast show up
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error");
    loginBtn.disabled = false;
  }
}

// Function to log out a user
async function logoutUser() {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Logout failed!");
    }

    let lang = localStorage.getItem("userLanguage");
    localStorage.clear();
    localStorage.setItem("userLanguage", lang);
    return await response.json();
  } catch (error) {
    console.error("Error during logout:", error);
    throw error; // Propagate error for handling in the calling function
  }
}

// Handle logout button click
async function handleLogout(event) {
  event.preventDefault(); // Prevent default button action

  try {
    const result = await logoutUser(); // Call the logout API
    showToast(result.message, "success"); // Show success message

    // Redirect to login page after successful logout
    setTimeout(() => {
      window.location.href = "/";
    }, 1000); // Optional delay to let the toast show up
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error");
  }
}

// Function to delete a QR code
async function deleteQRCode(id) {
  try {
    const response = await fetch(`/delete/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Deletion failed!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error during deletion:", error);
    throw error; // Propagate error for handling in the calling function
  }
}

// Function to delete a QR code
async function deleteQRCode(id) {
  if (!confirm("Are you sure you want to delete this QR code?")) {
    return; // Exit if user cancels the deletion
  }

  try {
    const response = await fetch(`/delete/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Deletion failed!");
    }

    const result = await response.json();
    alert(result.message); // Show success message
    window.location.reload();
  } catch (error) {
    console.error("Error during deletion:", error);
    alert(error.message || "An error occurred. Please try again.");
  }
}

// Handle the form submission for updating details
async function handleUpdateDetails(event) {
  event.preventDefault(); // Prevent the default form submission

  const form = event.target; // Get the form element
  const formData = new FormData(form); // Use the FormData API
  const data = Object.fromEntries(formData); // Convert FormData to an object

  // Call the updateDetails function
  try {
    updateBtn.disabled = true;
    const fullUrl = window.location.href;
    // Extract the 'userid' using split
    const userId = fullUrl.split("/").pop();
    const result = await updateDetails(data, userId); // Call the API function
    showToast(result.message, "success"); // Show success message
    updateBtn.disabled = false;
    document.querySelector('input[name="fullName"]').value = "";
    document.querySelector('input[name="email"]').value = "";
    document.querySelector('input[name="password"]').value = "";
    // Redirect to login page after successful logout
    setTimeout(() => {
      window.location.href = "/";
    }, 1000); // Optional delay to let the toast show up
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error"); // Show error message
    updateBtn.disabled = false;
  }
}

// Function to update user details
async function updateDetails(data, userId) {
  try {
    const response = await fetch(`/change-user-details/${userId}`, {
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

// Handle Magic Link form submission
async function handleMagicLink(
  event,
  emailInputId,
  buttonId,
  encId = null,
  isAffiliate = false
) {
  event.preventDefault();

  console.log(isAffiliate, "wm");
  const email = document.getElementById(emailInputId).value;
  const button = document.getElementById(buttonId);

  if (!email) {
    showToast("Please enter your email to receive the magic link.", "error");
    return false;
  }

  try {
    button.disabled = true;
    const result = await requestMagicLink(email, encId, isAffiliate); // Call the Magic Link API
    showToast(result.message || "Magic link sent to your email!", "success");

    if (!isAffiliate) {
      document.getElementById(emailInputId).value = "";
      setTimeout(() => {
        window.location.href = "/";
      }, 1000); // Optional delay to let the toast show up
    }
  } catch (error) {
    showToast(
      error.message || "Something went wrong. Please try again.",
      "error"
    );
  } finally {
    button.disabled = false;
  }
}

// Function to request Magic Link
async function requestMagicLink(email, encId, isAffiliate) {
  try {
    const requestBody = { email };

    if (encId) {
      requestBody.encId = encId; // Add encId if available
    }

    if (isAffiliate) {
      requestBody.isAffiliate = isAffiliate; // Add encId if available
    }
    const response = await fetch("/usemagiclink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send magic link!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending magic link:", error);
    throw error; // Propagate error for handling in the calling function
  }
}

// Function to export users
async function exportUsers(event) {
  event.preventDefault();
  const button = event.target.closest("button");
  const loaderOverlay = document.querySelector(".fullscreen-loader");

  // Disable button & show fullscreen loader
  button.disabled = true;
  button.style.opacity = "0.5"; // Reduce opacity for disabled effect
  loaderOverlay.style.display = "flex"; // Show fullscreen loader

  try {
    const response = await fetch("/admindashboard/export-users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      showToast(errorData.message, "error"); // Show error toast with message
      throw new Error(errorData.message);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast("Users exported successfully!", "success"); // Show success message
  } catch (error) {
    console.error("Error exporting users:", error);
    showToast(error.message || "An error occurred. Please try again.", "error"); // Show error message
  } finally {
    // Hide loader & enable button after operation
    loaderOverlay.style.display = "none"; // Hide fullscreen loader
    button.disabled = false;
    button.style.opacity = "1"; // Restore button opacity
  }
}
