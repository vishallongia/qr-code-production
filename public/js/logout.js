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
