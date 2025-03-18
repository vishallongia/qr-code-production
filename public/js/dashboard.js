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
// Toggle the menu open and close
menuToggle.addEventListener("click", () => {
  sideMenu.classList.add("active");
});

menuClose.addEventListener("click", () => {
  sideMenu.classList.remove("active");
});

document.addEventListener("DOMContentLoaded", function () {});

// Set active tab based on localStorage on page load
document.addEventListener("DOMContentLoaded", () => {
  const activeTab = localStorage.getItem("activeTab");

  sideMenu.addEventListener("mouseenter", function () {
    sideMenu.classList.add("expanded");
  });

  sideMenu.addEventListener("mouseleave", function () {
    sideMenu.classList.remove("expanded");
  });

  if (activeTab) {
    // Find the corresponding menu item and section based on the saved tab
    menuItems.forEach((item) => {
      item.classList.remove("active");
      if (item.dataset.section === activeTab) {
        item.classList.add("active");
      }
    });
  }
});

// Event listener for menu items
menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    // Remove active class from all menu items
    menuItems.forEach((i) => i.classList.remove("active"));

    // Add active class to the clicked item
    item.classList.add("active");

    // Save the active tab in localStorage
    localStorage.setItem("activeTab", item.dataset.section);

    if (item.dataset.section === "generate") {
      window.location.href = "/dashboard";
    } else if (item.dataset.section === "profile") {
      window.location.href = "/myprofile";
    } else if (item.dataset.section === "usercontrol") {
      window.location.href = "/usercontrol";
    } else {
      window.location.href = "/magiccode";
    }

    // Close side menu on small screens
    if (window.innerWidth <= 768) {
      sideMenu.classList.remove("active");
    }
  });
});

// QR Type change listener to update input fields
qrType.addEventListener("change", updateInputFields);

function updateInputFields() {
  inputFields.innerHTML = "";
  let input;

  switch (qrType.value) {
    case "media":
      input = createInput("file", "media-file", "Datei hochladen", "MediaLang");
      break;
    case "text":
      input = createInput(
        "textarea",
        "text-file",
        "Text schreiben",
        "TextLang"
      );
      break;
    case "url":
      input = createInput("text", "url", "Link einkopieren", "UrlLang");
      break;
  }

  inputFields.appendChild(input);
  inputFields.classList.add("fade-in");

  languageSwitcher.click();
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

updateInputFields();

// QR Code generation functions
function generateAlphanumericCode(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

const qrCode = new QRCodeStyling({
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

qrCode.append(document.getElementById("qr-code"));

function generateQRCodeFe(isUpdate = false, logo) {
  let alphanumericCode;
  let qrText;
  if (isUpdate) {
    alphanumericCode = document.getElementById("qr-code-key").value;
    qrText = `${window.location.protocol}//${window.location.host}/${alphanumericCode}`;
    document.getElementById("qr-text").value = `${qrText}`;
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
  const logoImageValue = document.getElementById("QRLogo").value;

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
    updateQRCodeFe(qrText, dotColor, bgColor, dotStyle, cornerStyle, logoUrl);
  }
  if (logoFile) {
    const reader = new FileReader();
    reader.onload = function (event) {
      // logoUrl = event.target.result;
      updateQRCodeFe(qrText, dotColor, bgColor, dotStyle, cornerStyle, logoUrl);
    };
    reader.readAsDataURL(logoFile);
  } else {
    updateQRCodeFe(qrText, dotColor, bgColor, dotStyle, cornerStyle, logoUrl);
  }
}

function updateQRCodeFe(
  qrText,
  dotColor,
  bgColor,
  dotStyle,
  cornerStyle,
  logoUrl
) {
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
}

// Function to toggle generate-section inside modal
function showGenerateSection(qr) {
  CurrentQR = qr;
  document.getElementById("qr-name").value = qr.qrName;

  // document.getElementById("bg-color").value = getColorHex("blue");
  // document.getElementById("qr-color").value = getColorHex("white");
  document.getElementById("qr-color").value = qr.qrDotColor;
  document.getElementById("bg-color").value = qr.backgroundColor;
  document.getElementById("dot-style").value = qr.dotStyle;
  document.getElementById("corner-style").value = qr.cornerStyle;
  document.getElementById("gradient").value = qr.applyGradient;
  document.getElementById("qr-type").value = qr.type;
  document.getElementById("qr-code-key").value = qr.code;
  const logo = qr.logo || "/images/logo.jpg"; // Default if logo is missing

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

  updateInputFields();

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

        // Populate the input with the files
        inputElement.files = fileList.files; // Set the files property

        // Optional: If you want to keep track of the blob URL, you can store it
        inputElement.dataset.fileBlob = URL.createObjectURL(blob);
      })
      .catch((error) => console.error("Error fetching image:", error));
  }
  if (document.getElementById("qr-type").value === "url") {
    document.getElementById("url").value = qr.url;
  }
  if (document.getElementById("qr-type").value === "text") {
    document.getElementById("text-file").value = qr.text;
  }
  document.getElementById("submit-btn-update").style.display = "flex";
  document.getElementById("downloadQRCode").style.display = "flex";
  document.getElementById("qr-code").style.display = "block";
  document.getElementById("submit-btn-generate").style.display = "none";
}

function downloadQRCode() {
  qrCode.download({
    name: "MagicCode",
    extension: "png",
    width: 16000,
    height: 16000,
  }); // High resolution download
}

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

function getColorHex(color) {
  return colorHexMap[color.toLowerCase()] || "Invalid color";
}

const hexColorMap = {
  "#FF0093": "magenta",
  "#835EC7": "violet",
  "#00B760": "green",
  "#FC70BA": "pink",
  "#1C00FF": "blue",
  "#FF0000": "red",
  "#FFC62C": "orange",
  "#00AEEF": "cyan",
  "#FEFE00": "yellow",
  "#FFFFFF": "white",
  "#000000": "black",
  "#4CCED1": "turquoise",
};

function getColorName(hex) {
  hex = hex.toUpperCase();
  return hexColorMap[hex] || "Invalid hex code";
}

let colorOptions1 = {
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

let colorOptions2 = {
  white: ["black"],
  magenta: ["white"],
  violet: ["white"],
  green: ["white"],
  pink: ["white"],
  blue: ["white"],
  red: ["white"],
  orange: ["white"],
  cyan: ["white"],
  yellow: ["black"],
  turquoise: ["white"],
};
let List = colorOptions1;

let fgSelect = document.getElementById("FgColorsDiv");
let bgSelect = document.getElementById("bgColor");

function populateFgColors() {
  let fgSelect = document.getElementById("FgColorsDiv");
  fgSelect.innerHTML = "";

  Object.keys(List).forEach((color) => {
    let colorValueHex = getColorHex(color);
    let content = `
    <div class="color-box" style="background-color: ${colorValueHex};" data-color="${colorValueHex}">
   <input type="radio" name="color" id="${color}" value="${colorValueHex}">
    <label for="${color}"></label>
  <span class="color-name" id="FG${color}">${color}</span>
</div>
   `;

    fgSelect.innerHTML += content;
  });
  // updateBgColors();
}

function updateBgColors() {
  bgSelect.innerHTML = "";
  let selectedFg = document.querySelector('input[name="color"]:checked').value;
  selectedFg = getColorName(selectedFg);
  let optionsList = List[selectedFg] || [];

  let BgColorDiv = document.getElementById("BgColorDiv");
  BgColorDiv.innerHTML = ``;
  let content = "";
  for (let i = 0; i < optionsList.length; i++) {
    let color = optionsList[i];
    let colorValueHex = getColorHex(color);
    content += `
     <div class="color-boxBG" style="background-color: ${colorValueHex};" data-color="${colorValueHex}">
    <input type="radio" name="bgcolor" id="BG-${color}" value="${colorValueHex}">
     <label for="BG-${color}"></label>
   <span class="color-name" id="BG${color}">${color}</span>
</div>
    `;
  }
  BgColorDiv.innerHTML = content;

  SelectRadioFOrBGColors();

  optionsList.forEach((color) => {
    let option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    bgSelect.appendChild(option);
  });
}

function updatePreview() {
  // let fgSelected = document.getElementById("fgColor").value
  // let bgSelected = document.getElementById("bgColor").value

  try {
    document.getElementById("languageSwitcher").click();

    let fgSelected = document.querySelector(
      'input[name="color"]:checked'
    ).value;
    let bgSelected = document.querySelector(
      'input[name="bgcolor"]:checked'
    ).value;

    document.getElementById("qr-color").value = fgSelected;
    document.getElementById("bg-color").value = bgSelected;
  } catch (error) {
    console.log(error);
  }
}

function updateColorsSelection() {
  const fgColor = document.getElementById("qr-color").value;
  const bgColor = document.getElementById("bg-color").value;

  // document.getElementById("fgColor").value = getColorName(qrColor)
  // updateBgColors()
  // document.getElementById("bgColor").value = getColorName(bgColor)

  let FGradio = document.querySelector(
    `input[name="color"][value="${fgColor}"]`
  );
  if (FGradio) {
    FGradio.checked = true;
    FGradio.classList.add("selected");
  }
}

function UpdateColorListAccord() {
  let selected = CurrentQR.ColorList;
  if (selected == "first") {
    List = colorOptions1;
  }

  if (selected == "second") {
    List = colorOptions2;
  }
  populateFgColors();
}

// populateFgColors();
document.addEventListener("DOMContentLoaded", function () {
  UpdateColorListAccord();
  // updateColorsSelection()
});

function ChangeLists() {
  let selected = document.querySelector(
    'input[name="ColorList"]:checked'
  ).value;

  if (selected == "first") {
    List = colorOptions1;
  }

  if (selected == "second") {
    List = colorOptions2;
  }
  populateFgColors();
  SelectRadioFOrFGColors();
  // updateBgColors();
  document.getElementById("languageSwitcher").click();
  // SelectRadioFOrBGColors()
  // updatePreview()
}

document.addEventListener("DOMContentLoaded", () => {
  SelectRadioFOrFGColors();
});

function SelectRadioFOrFGColors() {
  const colorBoxes = document.querySelectorAll(".color-box");

  colorBoxes.forEach((box) => {
    box.addEventListener("click", () => {
      // Remove active state from all boxes
      colorBoxes.forEach((b) => {
        b.classList.remove("selected");
        b.querySelector("label").style.boxShadow = "none"; // Reset previous shadow
        b.querySelector("label").style.border = "3px solid transparent"; // Reset border
      });

      // Set the selected state
      const input = box.querySelector("input");
      input.checked = true;
      box.classList.add("selected");
      updateBgColors();
      // Apply shadow and border based on color
      const color = box.dataset.color;
      // box.querySelector("label").style.boxShadow = `0px 0px 15px 5px ${color}`;
      box.querySelector("label").style.border = `3px solid ${color}`;
      updatePreview();
    });
  });
}
function SelectRadioFOrBGColors() {
  const colorBoxes = document.querySelectorAll(".color-boxBG");

  colorBoxes.forEach((box) => {
    box.addEventListener("click", () => {
      // Remove active state from all boxes
      colorBoxes.forEach((b) => {
        b.classList.remove("selected");
        b.querySelector("label").style.boxShadow = "none"; // Reset previous shadow
        b.querySelector("label").style.border = "3px solid transparent"; // Reset border
      });

      // Set the selected state
      const input = box.querySelector("input");
      input.checked = true;
      box.classList.add("selected");
      // Apply shadow and border based on color
      const color = box.dataset.color;
      // box.querySelector("label").style.boxShadow = `0px 0px 15px 5px ${color}`;
      box.querySelector("label").style.border = `3px solid ${color}`;

      updatePreview();
    });
  });
}
