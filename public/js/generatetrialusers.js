const exportButton = document.getElementById("generateduserexcelbutton");
const downloadQRCodeImagesZip = document.getElementById("download-qr-zip");
const resetGeneratedUserButton = document.getElementById("resetgeneratedusser");
// API Call to Create Demo Users
const qrCodesMap = {};
async function createTrialUsers(totalNumbers) {
  event.preventDefault();
  const button = event.target.closest("button");
  const loaderOverlay = document.querySelector(".fullscreen-loader");

  // Disable button & show fullscreen loader
  button.disabled = true;
  button.style.opacity = "0.5"; // Reduce opacity for disabled effect
  loaderOverlay.style.display = "flex"; // Show fullscreen loader
  try {
    const response = await fetch("/create-trial-users", {
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

// Handle Create Trial Users Request
async function handleCreateTrialUsers() {
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

    const result = await createTrialUsers(totalNumbers);
    showToast(result.message, "success");

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

// Toggle export button visibility
function toggleExportButtonVisibility() {
  exportButton.style.display = getUsersFromLocalStorage().length
    ? "block"
    : "none";
  resetGeneratedUserButton.style.display = getUsersFromLocalStorage().length
    ? "block"
    : "none";

  downloadQRCodeImagesZip.style.display = getUsersFromLocalStorage().length
    ? "block"
    : "none";
}

// Save users to Local Storage
function saveUsersToLocalStorage(users) {
  localStorage.setItem("userArrObjectTrial", JSON.stringify(users));
  toggleExportButtonVisibility();
}

// Retrieve users from Local Storage
function getUsersFromLocalStorage() {
  return JSON.parse(localStorage.getItem("userArrObjectTrial")) || [];
}

// Export to Excel Function
function exportToExcel() {
  const users = getUsersFromLocalStorage();

  let csvContent =
    "data:text/csv;charset=utf-8," + "Email,Code,Password,QR Link\n";
  users.forEach((user) => {
    let formattedPassword = `" \t${user.password}"`; // Add tab space to preserve leading zeros
    let link = `https://analog-magic-code.netlify.app/?code=${user.code}`;
    csvContent += `${user.email},${user.code},${formattedPassword},${link}\n\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "demo_users.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Load users from Local Storage on page load
document.addEventListener("DOMContentLoaded", () => {
  const usersData = getUsersFromLocalStorage();
  appendUsersToCards(usersData);
  toggleExportButtonVisibility();
});

function resetLocalStorageAndReload() {
  // Clear all data from localStorage
  localStorage.removeItem("userArrObjectTrial");

  // Reload the page
  window.location.reload();
}

// Main function to download all canvases as a zip
const downloadAllCanvasesAsZip = () => {
    const zip = new JSZip();
    const cardContainers = document.querySelectorAll(".container-custom-generated-user");
  
    if (cardContainers.length === 0) {
      alert("No QR codes found to download.");
      return;
    }
  
    let completed = 0;
  
    cardContainers.forEach((container) => {
      const canvas = container.querySelector(".card canvas");
      const captionElement = container.querySelector(".card-caption");
  
      if (!canvas || !captionElement) return;
  
      const fileName = `${captionElement.textContent.trim()}.png`; // Use caption text as filename
      const dataURL = canvas.toDataURL("image/png");
  
      fetch(dataURL)
        .then((response) => response.blob())
        .then((blob) => {
          zip.file(fileName, blob);
          completed++;
  
          if (completed === cardContainers.length) {
            // All canvases added, now generate the zip
            zip.generateAsync({ type: "blob" }).then((content) => {
              saveAs(content, "qr-codes.zip");
            });
          }
        });
    });
  };

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
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";

      const caption = document.createElement("div");
      caption.classList.add("card-caption");
      caption.innerText = `${user.password}`;

      const card = document.createElement("div");
      card.classList.add("card");

      // Create a div to hold the QR code
      const qrContainer = document.createElement("div");
      qrContainer.id = `qr-container-${user.qrCode._id}`;

      // Create the download button
      const downloadButton = document.createElement("button");
      downloadButton.classList.add("btn");
      downloadButton.title = "Download";
      downloadButton.innerHTML = `<i class="fas fa-download"></i>`;
      downloadButton.onclick = () => downloadQRCodeShowed(user.qrCode._id);

      card.innerHTML = `
        <p><strong>Code:</strong> ${user.code}</p>
        <p></p>
      `;

      card.prepend(qrContainer);
      card.appendChild(downloadButton);
      wrapper.appendChild(caption);
      wrapper.appendChild(card);
      container.appendChild(wrapper);

      // Generate QR code for each user
      generateQRCode(user.qrCode, qrContainer);
    });

    // Update pagination buttons
    updatePagination(usersData.length, currentPage);
  };

  // Function to generate QR Code
  function generateQRCode(qrCodeData, qrContainer) {
    if (!qrContainer) return;

    let logoUrl;
    if (qrCodeData.logo) {
      // if (logo) {
      logoUrl = `${window.location.protocol}//${window.location.host}/${qrCodeData.logo}`;
      // }
    } else {
      logoUrl = `${window.location.protocol}//${window.location.host}/images/logo.jpg`;
    }

    const qrCode = new QRCodeStyling({
      width: 3000, // Adjust size as needed
      height: 3000,
      type: "canvas",
      data: `${window.location.protocol}//${window.location.host}/${qrCodeData.code}`, // Use the provided URL
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
      image: logoUrl ? logoUrl : "", // Use logo image if provided
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 10,
      },
    });

    // Append QR Code to the container
    qrCode.append(qrContainer);
    // Store each QRCodeStyling instance in a dictionary for downloading later
    qrCodesMap[qrCodeData._id] = qrCode;
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
