// Select DOM elements
const menuToggle = document.querySelector(".menu-toggle");
const menuClose = document.querySelector(".menu-close");
const sideMenu = document.querySelector(".side-menu");
const menuItems = document.querySelectorAll(".menu-item");
const generateSection = document.getElementById("generate-section");
const showSection = document.getElementById("show-section");
const qrType = document.getElementById("qr-type");
const inputFields = document.getElementById("input-fields");
const languageSwitcher = document.getElementById("languageSwitcher");
let CurrentQR = "";
let qrCode;
const popup = document.getElementById("theme-popup-activate-qr");

const colorHexMap = {
  magenta: "#FF0093",
  violet: "#835EC7",
  green: "#00B760",
  pink: "#FC70BA",
  blue: "#1C00FF",
  red: "#FF0000",
  orange: "#FFC62C",
  cyan: "#00AEEF",
  yellow: "#FEFE00",
  white: "#FFFFFF",
  black: "#000000",
  turquoise: "#4CCED1",
};

const colorOptions1 = {
  white: [
    "black",
    "green",
    "pink",
    "blue",
    "orange",
    "cyan",
    "yellow",
    "turquoise",
  ],
  black: ["white", "pink", "orange", "yellow", "turquoise"],
  magenta: ["white", "cyan", "yellow", "turquoise"],
  violet: ["white", "cyan", "yellow", "turquoise"],
  green: ["white", "cyan", "yellow", "turquoise"],
  pink: ["white", "blue", "orange", "cyan", "yellow", "turquoise"],
  blue: ["white", "orange", "cyan", "yellow", "turquoise"],
  red: ["pink", "orange", "cyan", "yellow", "turquoise", "white"],
  orange: ["white", "pink", "cyan", "turquoise"],
  cyan: [
    "white",
    "black",
    "violet",
    "green",
    "pink",
    "blue",
    "orange",
    "yellow",
    "turquoise",
  ],
  yellow: [
    "white",
    "black",
    "violet",
    "green",
    "pink",
    "blue",
    "orange",
    "cyan",
    "turquoise",
  ],
  turquoise: [
    "white",
    "black",
    "violet",
    "green",
    "pink",
    "blue",
    "orange",
    "cyan",
    "yellow",
  ],
};

function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}


function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result) return "#000000";
  return (
    "#" +
    result
      .map((num) => {
        const hex = parseInt(num).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}
const urlParams = new URLSearchParams(window.location.search);

if (!urlParams.has("magiccode")) {
  qrType.addEventListener("change", updateInputFields);
  updateInputFields();
}

function updateInputFields() {
  inputFields.innerHTML = "";
  let input;

  switch (qrType.value.toLowerCase()) {
    case "media":
      // Create the wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "form-group";

      // Create the visible upload box
      const uploadBox = document.createElement("div");
      uploadBox.className = "upload-box";
      uploadBox.innerHTML = `
        <img src="/vuesax-linear-export.svg" alt="Upload icon">
        <p>Drag & Drop or <span class="browse-text">Browse</span></p>
      `;

      // Create the hidden file input
      const inputElement = document.createElement("input");
      inputElement.type = "file";
      inputElement.id = "media-file";
      inputElement.name = "MediaLang";
      inputElement.style.display = "none";

      // Handle click on uploadBox or "Browse"
      uploadBox.addEventListener("click", () => inputElement.click());

      // Handle file select and update text
      inputElement.addEventListener("change", (e) => {
        const fileName = e.target.files.length
          ? e.target.files[0].name
          : "No file chosen";
        uploadBox.querySelector(
          "p"
        ).innerHTML = `Selected: <strong>${fileName}</strong>`;
      });

      // Add label and append elements
      wrapper.innerHTML = `<label>Upload Your File</label>`;
      wrapper.appendChild(uploadBox);
      wrapper.appendChild(inputElement);
      inputFields.appendChild(wrapper);
      break;
    case "text":
      input = createInput(
        "textarea",
        "text-file",
        "Text schreiben",
        "TextLang"
      );
      inputFields.appendChild(input);
      inputFields.querySelector(".input-group").classList.add("form-group");
      break;
    case "url":
      input = createInput("text", "url", "Link einkopieren", "UrlLang");
      inputFields.appendChild(input);

      inputFields.querySelector(".input-group").classList.add("form-group");
      break;
  }
  inputFields.classList.add("fade-in");
  // languageSwitcher.click();
}

function createInput(type, id, labelText, labelID) {
  const div = document.createElement("div");
  div.className = "input-group";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  label.id = labelID;

  let input;
  if (type === "textarea") {
    input = document.createElement("textarea");
  } else {
    input = document.createElement("input");
    input.type = type;
  }
  input.id = id;

  div.appendChild(label);
  div.appendChild(input);

  return div;
}

// updateInputFields();

// QR Code generation functions
function generateAlphanumericCode(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// const qrCode = new QRCodeStyling({
//   width: 3000,
//   height: 3000,
//   type: "canvas",
//   data: "https://example.com",
//   dotsOptions: {
//     color: "#000000",
//     type: "square",
//   },
//   backgroundOptions: {
//     color: "#ffffff",
//   },
//   cornersSquareOptions: {
//     type: "square",
//   },
// });

// qrCode.append(document.getElementById("qr-code"));

// function setupQrExpiryCountdown(qrContainerId, hiddenInputId) {
//   const activatedUntilValue = document.getElementById(hiddenInputId)?.value;
//   let timer;
//   const qrContainer = document.getElementById(qrContainerId);

//   if (activatedUntilValue && qrContainer) {
//     const activatedUntil = new Date(activatedUntilValue);

//     const expiryElement = document.createElement("div");
//     expiryElement.style.textAlign = "center";
//     expiryElement.style.marginBottom = "8px";
//     expiryElement.style.fontSize = "16px";
//     qrContainer.appendChild(expiryElement);

//     function updateExpiryCountdown() {
//       const currentTime = new Date();
//       const timeDifference = activatedUntil - currentTime;

//       if (timeDifference > 0) {
//         const secondsLeft = Math.floor(timeDifference / 1000);
//         const minutesLeft = Math.floor(secondsLeft / 60);
//         const hoursLeft = Math.floor(minutesLeft / 60);
//         const daysLeft = Math.floor(hoursLeft / 24);

//         const remainingHours = hoursLeft % 24; // hours remaining in the current day
//         const remainingMinutes = minutesLeft % 60; // minutes remaining in the current hour
//         const remainingSeconds = secondsLeft % 60; // seconds remaining in the current minute

//         if (daysLeft >= 1) {
//           expiryElement.textContent = `${daysLeft} day${
//             daysLeft !== 1 ? "s" : ""
//           } ${remainingHours} hour${
//             remainingHours !== 1 ? "s" : ""
//           } ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
//         } else if (hoursLeft >= 1) {
//           expiryElement.textContent = `${remainingHours} hour${
//             remainingHours !== 1 ? "s" : ""
//           } ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
//         } else {
//           expiryElement.textContent = `${remainingMinutes} minute${
//             remainingMinutes !== 1 ? "s" : ""
//           } ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
//         }

//         expiryElement.style.color = "green";
//       } else {
//         expiryElement.textContent = "Expired";
//         expiryElement.style.color = "red";
//         if (timer) {
//           clearInterval(timer);
//         }
//       }
//     }

//     // Initial call
//     updateExpiryCountdown();
//     timer = setInterval(updateExpiryCountdown, 1000); // Update every second for seconds countdown

//     // Simulate server refresh (optional)
//     setTimeout(() => {
//       const serverUpdatedActivatedUntil = new Date(activatedUntilValue); // You would actually fetch this
//       console.log("Server Expiry Time updated:", serverUpdatedActivatedUntil);
//       // (Update activatedUntil here if needed)
//     }, 60000);
//   }
// }

function generateQRCodeFe(isUpdate = false, logo) {
  let alphanumericCode;
  let qrText;
  let qrName;
  if (isUpdate) {
    alphanumericCode = document.getElementById("qr-code-key").value;
    qrText = `${window.location.protocol}//${window.location.host}/${alphanumericCode}`;
    document.getElementById("qr-text").value = `${qrText}`;
    qrName = document.getElementById("qr-name").value;
  } else {
    alphanumericCode = generateAlphanumericCode();
    qrText = `${window.location.protocol}//${window.location.host}/${alphanumericCode}`;
    document.getElementById("qr-text").value = `${qrText}`;
  }

  document.getElementById("qr-code-key").value = alphanumericCode;
  const qrColor = document.getElementById("qr-color").value;
  const bgColor = document.getElementById("bg-color").value;
  const dotStyle = document.getElementById("dot-style").value;
  const cornerStyle = document.getElementById("corner-style").value;
  const gradient = document.getElementById("gradient").value;
  const logoFile = document.getElementById("logo").files[0];
  const logoImageValue = document.getElementById("QRLogo").value || 1;

  let dotColor = { color: qrColor };
  if (gradient === "linear") {
    dotColor = {
      gradient: {
        type: "linear",
        colorStops: [
          { offset: 0, color: "#ff0000" },
          { offset: 1, color: qrColor },
        ],
      },
    };
  } else if (gradient === "radial") {
    dotColor = {
      gradient: {
        type: "radial",
        colorStops: [
          { offset: 0, color: "#ff0000" },
          { offset: 1, color: qrColor },
        ],
      },
    };
  }

  let logoUrl = `${window.location.protocol}//${window.location.host}/images/logo${logoImageValue}.jpg`; // Here you need to provide static logo
  if (logo && isUpdate) {
    logoUrl = `${window.location.protocol}//${window.location.host}/${logo}`;
    updateQRCodeFe(
      qrText,
      dotColor,
      bgColor,
      dotStyle,
      cornerStyle,
      logoUrl,
      isUpdate,
      qrName
    );
  }
  if (logoFile) {
    const reader = new FileReader();
    reader.onload = function (event) {
      // logoUrl = event.target.result;
      updateQRCodeFe(
        qrText,
        dotColor,
        bgColor,
        dotStyle,
        cornerStyle,
        logoUrl,
        isUpdate,
        qrName
      );
    };
    reader.readAsDataURL(logoFile);
  } else {
    updateQRCodeFe(
      qrText,
      dotColor,
      bgColor,
      dotStyle,
      cornerStyle,
      logoUrl,
      isUpdate,
      qrName
    );
  }
}

function updateQRCodeFe(
  qrText,
  dotColor,
  bgColor,
  dotStyle,
  cornerStyle,
  logoUrl,
  isUpdate,
  qrName
) {
  qrCode = new QRCodeStyling({
    width: 3000,
    height: 3000,
    type: "canvas",
    data: "https://example.com",
    dotsOptions: {
      color: "#000000",
      type: "square",
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      type: "square",
    },
  });
  qrCode.update({
    data: qrText,
    dotsOptions: {
      color: dotColor.color,
      type: dotStyle,
      gradient: dotColor.gradient,
    },
    backgroundOptions: {
      color: bgColor,
    },
    cornersSquareOptions: {
      type: cornerStyle,
    },
    image: logoUrl || "",
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 10,
    },
  });
  if (isUpdate) {
    // Clear the content of qrCode before appending
    document.getElementById("qr-code").innerHTML = "";
  }
  const qrContainer = document.getElementById("qr-code");

  // setupQrExpiryCountdown("qr-code", "activatedUntil");

  // Inside your updateQRCodeFe function, before qrCode.append():
  if (qrName) {
    const nameElement = document.createElement("div");
    nameElement.textContent = qrName;
    nameElement.style.textAlign = "center";
    nameElement.style.marginBottom = "16px"; // gap between name and QR
    nameElement.style.fontSize = "20px";
    nameElement.style.color = "black";

    qrContainer.appendChild(nameElement);
  }

  // Now append the new content
  qrCode.append(document.getElementById("qr-code"));
}

function downloadQRCode() {
  qrCode.download({
    name: "qr-code",
    extension: "png",
    width: 16000,
    height: 16000,
  }); // High resolution download
}

// Function to toggle generate-section inside modal
function showGenerateSection(qr, user) {
  CurrentQR = qr;
  document.getElementById("qr-name").value = qr.qrName;
  // document.getElementById("PrintMyQR").style.visibility = "visible"; // Makes it visible again
  // document.getElementById("qrCodePrintData").value = JSON.stringify(
  //   Object.fromEntries(
  //     Object.entries(qr).filter(([_, value]) => value !== null)
  //   )
  // );

  // document.getElementById("bg-color").value = getColorHex("blue");
  // document.getElementById("qr-color").value = getColorHex("white");
  document.getElementById("qr-color").value = qr.qrDotColor;
  document.getElementById("bg-color").value = qr.backgroundColor;
  document.getElementById("dot-style").value = qr.dotStyle;
  document.getElementById("corner-style").value = qr.cornerStyle;
  document.getElementById("gradient").value = qr.applyGradient;
  document.getElementById("qr-type").value = qr.type;
  document.getElementById("qr-code-key").value = qr.code;
  document.getElementById("activatedUntil").value = qr.activatedUntil;
  const logo = qr.logo || "/images/logo.jpg"; // Default if logo is missing

  // Conditionally call applySettings based on qr.backgroundColor
  if (qr.backgroundColor !== "#ffffff") {
    applySettings(true, qr.qrDotColor, qr.backgroundColor);
  } else {
    applySettings(false, qr.qrDotColor, qr.backgroundColor);
  }

  const buttons = document.querySelectorAll(".content-type-button");

  // Clear all active classes first
  buttons.forEach((btn) => btn.classList.remove("active"));

  // Add active class based on qr.type
  if (qr.type === "url") {
    buttons[0].classList.add("active"); // Link
    buttons[0].click(); // Trigger click to show the URL section
  } else if (qr.type === "text") {
    buttons[1].classList.add("active"); // Text
    buttons[1].click(); // Trigger click to show the Text section
  } else if (qr.type === "media") {
    buttons[2].classList.add("active"); // Photo/Video
    buttons[2].click(); // Trigger click to show the Media section
  }

  if (logo !== "/images/logo.jpg") {
    const match = logo.match(/logo(\d+)/);
    const logoValue = match ? match[1] : ""; // Extracted number or empty string
    document.getElementById("QRLogo").value = logoValue;
  }
  if (user.role === "demo-user") {
    const qrLogoSelect = document.getElementById("QRLogo");
    qrLogoSelect.value = ""; // Empty the dropdown value
    const inputGroup = qrLogoSelect.closest(".input-group"); // Find the closest input-group
    if (inputGroup) {
      inputGroup.style.display = "none"; // Hide the input group
    }
  }

  // updateInputFields();

  let radio = document.querySelector(
    `input[name="ColorList"][value="${qr.ColorList}"]`
  );
  if (radio) {
    radio.checked = true;
  }

  generateQRCodeFe(true, logo);

  // Fetch the logo file if available and store it as a Blob
  if (logo) {
    const logoPath = `${window.location.protocol}//${window.location.host}/${logo}`; // Update with your logo path

    fetch(logoPath)
      .then((response) => response.blob())
      .then((blob) => {
        const logoInputElement = document.getElementById("logo");
        const logoFileName = logo;

        // Normalize and extract the logo file name
        const normalizedLogoFileName = logoFileName
          .replace(/uploads\\/g, "uploads\\\\")
          .split("\\")
          .pop();

        // Create a new File object from the Blob for the logo
        const logoFile = new File([blob], normalizedLogoFileName, {
          type: "image/png",
        });

        // Simulate file selection for the logo
        const logoFileList = new DataTransfer();
        logoFileList.items.add(logoFile);
        logoInputElement.files = logoFileList.files;

        // Optional: Store the Blob URL if needed
        logoInputElement.dataset.logoBlob = URL.createObjectURL(blob);
      })
      .catch((error) => console.error("Error fetching logo:", error));
  }

  // Fetch the file and store it as a Blob
  if (document.getElementById("qr-type").value === "media") {
    const filePath = `${window.location.protocol}//${window.location.host}/${qr.media_url}`; // Update with your file path

    fetch(filePath)
      .then((response) => response.blob())
      .then((blob) => {
        // Store the Blob for later upload without displaying it
        const inputElement = document.getElementById("media-file");
        const inputElementUpdate = document.getElementById("media-file-update");
        const fileName = qr.media_url;

        // Handle file path and name extraction
        const normalizedFileName = fileName
          .replace(/uploads\\/g, "uploads\\\\")
          .split("\\")
          .pop();
        // Create a new File object from the Blob
        const file = new File([blob], normalizedFileName, {
          type: "image/png",
        });

        // Create a DataTransfer object to simulate file selection
        const fileList = new DataTransfer();
        fileList.items.add(file);

        // // Populate the input with the files
        // inputElement.files = fileList.files; // Set the files property
        inputElementUpdate.files = fileList.files; // Set the files property

        // Show filename in upload box
        const uploadText = document.querySelector(".upload-box p");
        uploadText.innerHTML = `Selected: <strong>${normalizedFileName}</strong>`;

        // // Optional: If you want to keep track of the blob URL, you can store it
        // inputElement.dataset.fileBlob = URL.createObjectURL(blob);
        inputElementUpdate.dataset.fileBlob = URL.createObjectURL(blob);
      })
      .catch((error) => console.error("Error fetching image:", error));
  }
  if (document.getElementById("qr-type").value === "url") {
    // document.getElementById("url").value = qr.url;
    document.getElementById("url-update").value = qr.url;
  }
  if (document.getElementById("qr-type").value === "text") {
    // document.getElementById("text-file").value = qr.text;
    document.getElementById("text-file-update").value = qr.text;
  }
  // document.getElementById("submit-btn-update").style.display = "block";
  // document.getElementById("downloadQRCode").style.display = "flex";
  // document.getElementById("qr-code").style.display = "block";
  // document.getElementById("submit-btn-generate").style.display = "none";
}

function downloadQRCode() {
  qrCode.download({
    name: "MagicCode",
    extension: "png",
    width: 16000,
    height: 16000,
  }); // High resolution download
}



document.addEventListener("DOMContentLoaded", function () {
  const keepBtn = document.getElementById("keep-background-update");
  const removeBtn = document.getElementById("remove-background-update");
  const bgColorSection = document.getElementById(
    "background-color-setting-update"
  );

  function activateButton(selectedBtn, otherBtn) {
    selectedBtn.classList.add("active");
    otherBtn.classList.remove("active");
  }

  keepBtn.addEventListener("click", function () {
    activateButton(keepBtn, removeBtn);
    bgColorSection.style.display = "block";
  });

  removeBtn.addEventListener("click", function () {
    activateButton(removeBtn, keepBtn);
    bgColorSection.style.display = "none";
  });

  // Optional: Set initial state if needed
  if (!keepBtn.classList.contains("active")) {
    bgColorSection.style.display = "none";
  }
});

const fgOptions = document.querySelectorAll(
  "#foreground-color-grid-update .color-option"
);
const bgOptions = document.querySelectorAll(
  "#background-color-grid-update .color-option"
);
const keepBgBtn = document.getElementById("keep-background-update");
const removeBgBtn = document.getElementById("remove-background-update");

let currentFg = "";
let currentBg = "";
let isBgVisible = true;

// Utility to remove active from a list and set it on one
function setActive(options, selectedColor) {
  options.forEach((opt) => {
    const bg = opt.style.backgroundColor.replace(/ /g, "").toLowerCase();
    if (bg === selectedColor.replace(/ /g, "").toLowerCase()) {
      opt.classList.add("active");
    } else {
      opt.classList.remove("active");
    }
  });
}

function hexToRgb(hex) {
  // Remove the hash if present
  hex = hex.replace(/^#/, "");

  // Convert 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Parse the hex values
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgb(${r}, ${g}, ${b})`;
}

// Main function: Filter background options based on selected foreground color
function filterBackgroundOptionsByForeground(fgColor) {
  const fgHex = rgbToHex(fgColor).toUpperCase();

  // Find the corresponding name for the foreground color
  let fgName = null;
  for (let [name, hex] of Object.entries(colorHexMap)) {
    if (hex.toUpperCase() === fgHex) {
      fgName = name;
      break;
    }
  }

  // Hide all options by default
  bgOptions.forEach((opt) => (opt.style.display = "none"));

  if (fgName && colorOptions1[fgName]) {
    const allowed = colorOptions1[fgName];
    bgOptions.forEach((opt) => {
      const bgRgb = opt.style.backgroundColor;
      const bgHex = rgbToHex(bgRgb).toUpperCase();

      for (let allowedName of allowed) {
        const allowedHex = colorHexMap[allowedName].toUpperCase();
        if (bgHex === allowedHex) {
          opt.style.display = "block";
          break;
        }
      }
    });
  }
}

// Function to handle color conflicts
function handleConflicts() {
  // Convert currentFg and currentBg to RGB format if they are in hex
  const fg = currentFg.startsWith("#")
    ? hexToRgb(currentFg)
    : currentFg.toLowerCase();
  const bg = currentBg.startsWith("#")
    ? hexToRgb(currentBg)
    : currentBg.toLowerCase();

  const keepBgBtn = document.getElementById("keep-background-update");
  // // Show all color options initially
  // fgOptions.forEach((opt) => (opt.style.display = "block"));
  // bgOptions.forEach((opt) => (opt.style.display = "block"));

  // Define RGB values for black and white
  const blackRgb = "rgb(0, 0, 0)";
  const whiteRgb = "rgb(255, 255, 255)";

  // Function to update the background color of a specific element
  function updateElementBackgroundColor(element, color) {
    if (element) {
      element.style.backgroundColor = color;
    }
  }

  // If foreground is black, hide black background option
  if (fg === blackRgb) {
    bgOptions.forEach((opt) => {
      if (opt.style.backgroundColor.toLowerCase() === blackRgb) {
        opt.style.display = "none";
      }
    });
  }

  // If foreground is white, hide white background option
  if (fg === whiteRgb) {
    bgOptions.forEach((opt) => {
      if (opt.style.backgroundColor.toLowerCase() === whiteRgb) {
        opt.style.display = "none";
      }
    });
  }

  // If background is black, hide black foreground option
  if (bg === blackRgb && keepBgBtn.classList.contains("active")) {
    fgOptions.forEach((opt) => {
      if (opt.style.backgroundColor.toLowerCase() === blackRgb) {
        opt.style.display = "none";
      }
    });
  } else {
    fgOptions.forEach((opt) => {
      if (opt.style.backgroundColor.toLowerCase() === blackRgb) {
        opt.style.display = "block";
      }
    });
  }

  // If background is white, hide white foreground option
  if (bg === whiteRgb && keepBgBtn.classList.contains("active")) {
    fgOptions.forEach((opt) => {
      if (opt.style.backgroundColor.toLowerCase() === whiteRgb) {
        opt.style.display = "none";
      }
    });
  }

  // If both fg and bg are black, set fg to black and bg to white
  if (fg === blackRgb && bg === blackRgb) {
    currentFg = blackRgb;
    currentBg = whiteRgb;
    setActive(fgOptions, currentFg);
    setActive(bgOptions, currentBg);
  }

  // If both fg and bg are white, set fg to white and bg to black
  if (fg === whiteRgb && bg === whiteRgb) {
    currentFg = whiteRgb;
    currentBg = blackRgb;
    setActive(fgOptions, currentFg);
    setActive(bgOptions, currentBg);
  }
}

// Handle color selection
function selectColorForUpdation(type, color) {
  if (type === "fg") {
    currentFg = color;
    setActive(fgOptions, color);
    // document.body.style.color = color;
    // 🟡 Add this line
    filterBackgroundOptionsByForeground(color);
  } else {
    currentBg = color;
    setActive(bgOptions, color);

    // Don't update the body background color here
    // document.body.style.backgroundColor = color;
  }

  handleConflicts();
}

// Handle background toggle
function toggleBackground(keep) {
  isBgVisible = keep;

  if (keep) {
    keepBgBtn.classList.add("active");
    removeBgBtn.classList.remove("active");
    document.getElementById("background-color-grid-update").style.display =
      "flex";
  } else {
    removeBgBtn.classList.add("active");
    keepBgBtn.classList.remove("active");
    // Don't update body background color here
    // document.body.style.backgroundColor = "transparent";

    document.getElementById("background-color-grid-update").style.display =
      "none";
    // Remove All active classes from bg-options
    const bgColorGrid = document.querySelector("#background-color-grid-update");
    const activeBgOptions = bgColorGrid.querySelectorAll(
      ".color-option.active"
    );

    activeBgOptions.forEach((el) => {
      el.classList.remove("active");
    });
    // Show All fg colors
    const fgColorGrid = document.querySelector("#foreground-color-grid-update");
    const fgOptions = fgColorGrid.querySelectorAll(".color-option");

    fgOptions.forEach((opt) => {
      if (opt.style.display === "none") {
        opt.style.display = "block";
      }
    });
  }
}

function applySettings(keepBackground, foregroundColor, backgroundColor) {
  toggleBackground(keepBackground);

  // Convert hex to RGB for accurate matching with DOM styles
  const fgColor = foregroundColor.startsWith("#")
    ? hexToRgb(foregroundColor)
    : foregroundColor;

  const bgColor = backgroundColor.startsWith("#")
    ? hexToRgb(backgroundColor)
    : backgroundColor;

  selectColorForUpdation("fg", fgColor);

  if (keepBackground) {
    selectColorForUpdation("bg", bgColor);
  }
  console.log(fgColor, "check it ");
  filterBackgroundOptionsByForeground(fgColor);
}

// Event listeners
fgOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    const color = window.getComputedStyle(opt).backgroundColor;
    selectColorForUpdation("fg", color);
  });
});

bgOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    const color = window.getComputedStyle(opt).backgroundColor;
    selectColorForUpdation("bg", color);
  });
});

keepBgBtn.addEventListener("click", () => toggleBackground(true));
removeBgBtn.addEventListener("click", () => toggleBackground(false));

document.addEventListener("DOMContentLoaded", () => {
  const actionCards = document.querySelectorAll(".action-child-card");
  const previewCards = document.querySelectorAll(".preview-card");

  const printGarmentBtn = document.getElementById("PrintMyQR");
  const printStickerBtn = document.getElementById("PrintMyQRAsSticker");
  const printTattooBtn = document.getElementById("PrintMyQRAsTattoo");

  function updatePreviewAndButtons(previewType) {
    // Show matching preview
    const printCard = document.getElementById("print-magic-code-parent-tab");
    const isActiveParentTab = printCard?.classList.contains("active");
    previewCards.forEach((preview) => {
      const type = preview.getAttribute("data-type");
      preview.style.display = type === previewType ? "block" : "none";
    });

    if (isActiveParentTab) {
      // Show correct print button
      printGarmentBtn.style.display =
        previewType === "garment" ? "block" : "none";
      printStickerBtn.style.display =
        previewType === "sticker" ? "block" : "none";
      printTattooBtn.style.display =
        previewType === "tattoo" ? "block" : "none";
    }
  }

  actionCards.forEach((card) => {
    card.addEventListener("click", () => {
      actionCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      const previewType = card.getAttribute("data-preview");
      updatePreviewAndButtons(previewType);
    });
  });

  // Initialize on load
  const activeCard = document.querySelector(".action-child-card.active");
  if (activeCard) {
    const previewType = activeCard.getAttribute("data-preview");
    updatePreviewAndButtons(previewType);
  }
});

// Example usage:
// applySettings({ keepBackground: true, foregroundColor: '#ffffff', backgroundColor: '#000000' });

// Example usage:
// applySettings({ keepBackground: true, foregroundColor: '#ffffff', backgroundColor: '#000000' });

document.getElementById("PrintMyQR").addEventListener("click", function () {
  const hiddenInput = document.getElementById("qrCodePrintData").value;

  let type = document
    .querySelectorAll(".action-child-card.active")[0]
    .getAttribute("data-preview");
  // console.log(type);
  try {
    const jsonData = JSON.parse(hiddenInput);

    let fgColor = jsonData.qrDotColor;
    let bgColor = jsonData.backgroundColor;

    fgColor = fgColor.replace("#", "");
    bgColor = bgColor.replace("#", "");

    const urlToPass = `https://analog-magic-code.netlify.app/magic-code-image/?code=${jsonData.code}&qrColor=%23${fgColor}&qrBgColor=%23${bgColor}`;
    const encodedURL = encodeURIComponent(urlToPass);

    let finalURL = `https://textildruck-schweiz.com/products/magic-code?image=${encodedURL}`;

    if (type == "sticker") {
      finalURL = `https://textildruck-schweiz.com/products/magic-safety-sticker?image=${encodedURL}`;
    }

    if (type == "tattoo") {
      finalURL = `https://textildruck-schweiz.com/products/magic-tattoo?image=${encodedURL}`;
    }

    console.log(finalURL);
    window.open(finalURL, "_blank");

    console.log(jsonData);
  } catch (error) {
    console.error("Invalid JSON data:", error);
  }
});

document
  .getElementById("PrintMyQRAsSticker")
  .addEventListener("click", function () {
    const hiddenInput = document.getElementById("qrCodePrintData").value;

    let type = document
      .querySelectorAll(".action-child-card.active")[0]
      .getAttribute("data-preview");
    // console.log(type);
    try {
      const jsonData = JSON.parse(hiddenInput);

      let fgColor = jsonData.qrDotColor;
      let bgColor = jsonData.backgroundColor;

      fgColor = fgColor.replace("#", "");
      bgColor = bgColor.replace("#", "");

      const urlToPass = `https://analog-magic-code.netlify.app/magic-code-image/?code=${jsonData.code}&qrColor=%23${fgColor}&qrBgColor=%23${bgColor}`;
      const encodedURL = encodeURIComponent(urlToPass);

      let finalURL = `https://textildruck-schweiz.com/products/magic-code?image=${encodedURL}`;

      if (type == "sticker") {
        finalURL = `https://textildruck-schweiz.com/products/magic-safety-sticker?image=${encodedURL}`;
      }

      if (type == "tattoo") {
        finalURL = `https://textildruck-schweiz.com/products/magic-tattoo?image=${encodedURL}`;
      }

      console.log(finalURL);
      window.open(finalURL, "_blank");

      console.log(jsonData);
    } catch (error) {
      console.error("Invalid JSON data:", error);
    }
  });

document
  .getElementById("PrintMyQRAsTattoo")
  .addEventListener("click", function () {
    const hiddenInput = document.getElementById("qrCodePrintData").value;

    let type = document
      .querySelectorAll(".action-child-card.active")[0]
      .getAttribute("data-preview");
    // console.log(type);
    try {
      const jsonData = JSON.parse(hiddenInput);

      let fgColor = jsonData.qrDotColor;
      let bgColor = jsonData.backgroundColor;

      fgColor = fgColor.replace("#", "");
      bgColor = bgColor.replace("#", "");

      const urlToPass = `https://analog-magic-code.netlify.app/magic-code-image/?code=${jsonData.code}&qrColor=%23${fgColor}&qrBgColor=%23${bgColor}`;
      const encodedURL = encodeURIComponent(urlToPass);

      let finalURL = `https://textildruck-schweiz.com/products/magic-code?image=${encodedURL}`;

      if (type == "sticker") {
        finalURL = `https://textildruck-schweiz.com/products/magic-safety-sticker?image=${encodedURL}`;
      }

      if (type == "tattoo") {
        finalURL = `https://textildruck-schweiz.com/products/magic-tattoo?image=${encodedURL}`;
      }

      console.log(finalURL);
      window.open(finalURL, "_blank");

      console.log(jsonData);
    } catch (error) {
      console.error("Invalid JSON data:", error);
    }
  });

async function handleQrCodeUpdateSubmit(event) {
  event.preventDefault(); // Prevent default form submission

  document.getElementById("bg-color").value = "#ffffff";
  const activeBtn = document.querySelector(".content-type-button.active");

  let type = "text"; /*Setting type by default*/
  // if (activeBtn) {
  //   const typeText = activeBtn.textContent.trim().toLowerCase();
  //   if (typeText === "link") {
  //     type = "url";
  //   } else if (typeText === "text") {
  //     type = "text";
  //   } else if (typeText === "photo/video") {
  //     type = "media";
  //   }
  // }

  // Foreground color
  let activeFg = document.querySelector(
    "#foreground-color-grid-update .color-option.active"
  );
  let fgColorHex = "#000000";
  if (activeFg) {
    const fgColorRgb = window.getComputedStyle(activeFg).backgroundColor;
    fgColorHex = rgbToHex(fgColorRgb);
  }

  // Background color
  let activeBg = document.querySelector(
    "#background-color-grid-update .color-option.active"
  );
  let bgColorHex = "#ffffff";
  if (activeBg) {
    const bgColorRgb = window.getComputedStyle(activeBg).backgroundColor;
    bgColorHex = rgbToHex(bgColorRgb);
  }

  // Ensure fg and bg are not the same
  if (fgColorHex.toLowerCase() === bgColorHex.toLowerCase()) {
    bgColorHex = fgColorHex.toLowerCase() === "#ffffff" ? "#000000" : "#ffffff";
  }

  const qrName = document.getElementById("qr-name-activation").value;
  const qrDotColor = document.getElementById("qr-color").value;
  const backgroundColor = document.getElementById("bg-color").value;
  const dotStyle = document.getElementById("dot-style").value;
  const cornerStyle = document.getElementById("corner-style").value;
  const applyGradient = document.getElementById("gradient").value;
  const code = document.getElementById("qr-code-key").value;
  const logoImageValue = document.getElementById("QRLogo").value;
  const logo = `images/logo${logoImageValue}.jpg`;

  const formData = new FormData();
  formData.append("type", type);
  formData.append("qrName", qrName);
  formData.append("backgroundColor", bgColorHex);
  formData.append("dotStyle", dotStyle);
  formData.append("cornerStyle", cornerStyle);
  formData.append("applyGradient", applyGradient);
  formData.append("qrDotColor", fgColorHex);
  formData.append("logoImageValue", logoImageValue);
  formData.append("text", qrName); /* In case of assignment */
  formData.append("isActivation", true); /* In case of assignment */

  if (!qrName) {
    showToast("Please enter Magic Code name to activate", "error");
    return;
  }

 

  try {
    const qrCodeId = code;
    toggleLoaderVisibility(true);

    const response = await fetch(`/update/${qrCodeId}`, {
      method: "PUT",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Error updating QR code.");
    }

    showToast(result.message, "success");
    // Check for success in the response (e.g., if response.success or some similar property)
    popup.style.display = "none"; // Hide popup only after successful operation
    // window.location.reload();
    toggleLoaderVisibility(false);
    removeShowPopupParamAndRedirect();
  } catch (error) {
    toggleLoaderVisibility(false);
    popup.style.display = "none";
    showToast(error.message || "Error updating QR code.", "error");
  }
}

function showThemePopup(message) {
  const okBtn = document.getElementById("popup-ok-btn");

  // Optional: set custom message
  popup.querySelector("p").innerText = message;

  popup.style.display = "flex";

  // Add one-time event listener
  okBtn.addEventListener("click", async () => {
    // Ensure we only proceed if the QR code update function is successful
    await handleQrCodeUpdateSubmit(event);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const activationInput = document.getElementById("qr-name-activation");
  const qrName = document.getElementById("qr-name");

  if (activationInput && qrName) {
    activationInput.addEventListener("input", () => {
      qrName.value = activationInput.value;
    });
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("showPopup") === "true") {
    showThemePopup(
      "Please enter the name of your first MAGIC CODE, and click ACTIVATE."
    );
  }
});

function removeShowPopupParamAndRedirect() {
  setTimeout(() => {
    // Get the current URL
    const currentUrl = new URL(window.location.href);

    // Remove the 'showPopup' query parameter
    currentUrl.searchParams.delete("showPopup");

    // Redirect to the updated URL (without 'showPopup')
    window.location.href = currentUrl.toString();
  }, 1000); // 1000ms (1 second) delay
}
