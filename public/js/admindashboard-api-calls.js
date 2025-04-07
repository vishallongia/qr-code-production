const exportButton = document.getElementById("generateduserexcelbutton");
const resetGeneratedUserButton = document.getElementById("resetgeneratedusser");
const assignedemail = document.getElementById("assignedemail");
const assignBtn = document.getElementById("assignedemailbutton");
document.querySelectorAll(".toggle-checkbox").forEach((checkbox) => {
  checkbox.addEventListener("change", async function () {
    const userId = this.getAttribute("data-user-id");
    const isActive = this.checked;

    try {
      // Send the updated status to the backend API
      const response = await fetch("/admindashboard/toggle-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive, userId }), // Send userId and isActive as part of the request body
      });

      // Check if the response is OK
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user status");
      }
      const result = await response.json();
      showToast(result.message, "success");
    } catch (error) {
      console.error("Error updating user status:", error);
      showToast(response.message, "error");
    }
  });
});

// Save users to Local Storage
function saveUsersToLocalStorage(users) {
  localStorage.setItem("userArrObject", JSON.stringify(users));
  toggleExportButtonVisibility();
}

// Retrieve users from Local Storage
function getUsersFromLocalStorage() {
  return JSON.parse(localStorage.getItem("userArrObject")) || [];
}

// API Call to Create Demo Users
async function createDemoUsers(totalNumbers) {
  event.preventDefault();
  const button = event.target.closest("button");
  const loaderOverlay = document.querySelector(".fullscreen-loader");

  // Disable button & show fullscreen loader
  button.disabled = true;
  button.style.opacity = "0.5"; // Reduce opacity for disabled effect
  loaderOverlay.style.display = "flex"; // Show fullscreen loader
  try {
    const response = await fetch("/create-demo-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ totalNumbers }), // Sending only totalNumbers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create demo users!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    // Hide loader & enable button after operation
    loaderOverlay.style.display = "none"; // Hide fullscreen loader
    button.disabled = false;
    button.style.opacity = "1"; // Restore button opacity
  }
}

// Handle Create Demo Users Request
async function handleCreateDemoUsers() {
  try {
    const totalNumbers = document.getElementById("user-count").value;

    if (!totalNumbers) {
      showToast("Please enter the number of users to generate", "error");
      return;
    }

    if (totalNumbers <= 0 || totalNumbers > 200) {
      showToast(
        "Please enter a valid number of users to generate (between 1 and 200)",
        "error"
      );
      return;
    }

    const result = await createDemoUsers(totalNumbers);
    showToast(result.message, "success");
    console.log("Demo Users Created:", result.data);

    // Save users to local storage
    saveUsersToLocalStorage(result.data);

    // Append Users to the Frontend Cards
    appendUsersToCards(result.data);
    document.getElementById("user-count").value = "";
  } catch (error) {
    showToast(error.message, "error");
    console.error("Error:", error.message);
    document.getElementById("user-count").value = "";
  }
}

// Function to append the demo users to the frontend cards
function appendUsersToCards(usersData) {
  const container = document.querySelector(".container-custom-generated-user");
  const cardsPerPage = 10; // Set the number of users per page
  let currentPage = 1;

  // Pagination logic
  const paginateUsers = (page) => {
    currentPage = page;
    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = currentPage * cardsPerPage;
    const usersToDisplay = usersData.slice(startIndex, endIndex);

    // Clear previous cards
    container.innerHTML = "";

    // Append the users as cards
    usersToDisplay.forEach((user) => {
      const card = document.createElement("div");
      card.classList.add("card");

      // Create a div to hold the QR code
      const qrContainer = document.createElement("div");
      qrContainer.id = `qr-container-${user.qrCode._id}`;

      card.innerHTML = `
        <p><strong>Code:</strong> ${user.code}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Password:</strong> ${user.password}</p>
        <p><strong>Reset Link:</strong> 
          <a href="${user.resetLinkValue}" target="_blank">
            ${user.resetLinkValue}
          </a>
        </p>
      `;

      // Append the QR container before the rest of the content
      card.prepend(qrContainer);
      container.appendChild(card);

      // Generate QR code for each user
      generateQRCode(user.qrCode, qrContainer);
    });

    // Update pagination buttons
    updatePagination(usersData.length, currentPage);
  };

  // Function to generate QR Code
  function generateQRCode(qrCodeData, qrContainer) {
    if (!qrContainer) return;

    const qrCode = new QRCodeStyling({
      width: 300, // Adjust size as needed
      height: 300,
      type: "canvas",
      data: qrCodeData.url, // Use the provided URL
      dotsOptions: {
        color: qrCodeData.qrDotColor || "#000000",
        type: qrCodeData.dotStyle || "square",
      },
      backgroundOptions: {
        color: qrCodeData.backgroundColor || "#ffffff",
      },
      cornersSquareOptions: {
        type: qrCodeData.cornerStyle || "square",
      },
    });

    // Append QR Code to the container
    qrCode.append(qrContainer);
  }

  // Function to update pagination links without page reload
  const updatePagination = (totalUsers, currentPage) => {
    const totalPages = Math.ceil(totalUsers / cardsPerPage);
    const paginationContainer = document.querySelector(".pagination-container");
    paginationContainer.innerHTML = "";

    // Previous button
    const prevButton = document.createElement("a");
    prevButton.classList.add("pagination-btn", "prev-btn");
    prevButton.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15 19L8 12L15 5" /></svg>`;
    prevButton.href = "#";
    prevButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentPage > 1) paginateUsers(currentPage - 1);
    });
    paginationContainer.appendChild(prevButton);

    // Page buttons
    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement("a");
      pageButton.classList.add("pagination-btn");
      pageButton.innerText = i;
      pageButton.href = "#";
      if (i === currentPage) pageButton.classList.add("active-page");
      pageButton.addEventListener("click", (e) => {
        e.preventDefault();
        paginateUsers(i);
      });
      paginationContainer.appendChild(pageButton);
    }

    // Next button
    const nextButton = document.createElement("a");
    nextButton.classList.add("pagination-btn", "next-btn");
    nextButton.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9 5L16 12L9 19" /></svg>`;
    nextButton.href = "#";
    nextButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentPage < totalPages) paginateUsers(currentPage + 1);
    });
    paginationContainer.appendChild(nextButton);
  };

  paginateUsers(1);
}

// Export to Excel Function
function exportToExcel() {
  const users = getUsersFromLocalStorage();
  let csvContent =
    "data:text/csv;charset=utf-8," + "Email,Code,Password,Reset Link\n";
  users.forEach((user) => {
    let formattedPassword = `" \t${user.password}"`; // Add tab space to preserve leading zeros
    csvContent += `${user.email},${user.code},${formattedPassword},${user.resetLinkValue}\n\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "demo_users.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Toggle export button visibility
function toggleExportButtonVisibility() {
  exportButton.style.display = getUsersFromLocalStorage().length
    ? "block"
    : "none";
  resetGeneratedUserButton.style.display = getUsersFromLocalStorage().length
    ? "block"
    : "none";
}

// Load users from Local Storage on page load
document.addEventListener("DOMContentLoaded", () => {
  const usersData = getUsersFromLocalStorage();
  appendUsersToCards(usersData);
  toggleExportButtonVisibility();
});

function resetLocalStorageAndReload() {
  // Clear all data from localStorage
  localStorage.removeItem("userArrObject");

  // Reload the page
  window.location.reload();
}

// Handle QR Code assignment form submission
async function handleAssignQrCode(event) {
  event.preventDefault();

  const url = window.location.href; // Get the full URL
  const encId = url.split("/").pop(); // Extract the last part

  const data = {
    email: assignedemail.value,
    encId,
  };

  try {
    assignBtn.disabled = true;
    const result = await assignQrCode(data); // Call the API

    showToast(result.message, "success");
    assignBtn.disabled = false;
    setTimeout(() => {
      window.location.href = "/";
    }, 1000); // Optional delay to let the toast show up
  } catch (error) {
    showToast(error.message || "An error occurred. Please try again.", "error");
    assignBtn.disabled = false;
  }
}

// Function to assign QR code to a user and send magic link
async function assignQrCode(data) {
  try {
    const response = await fetch("/assign-qr-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "QR Code assignment failed!");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
