const qrDataType = document.getElementById("qr-type");
const submitBtnGenerate = document.getElementById("submit-btn-generate"); // Get the submit button
const submitBtnUpdate = document.getElementById("submit-btn-update");
// const loader = document.getElementById("loader")// Get the loader element
const generatedSection = document.getElementById("generate-section");
const downloadQrButton = document.getElementById("downloadQRCode");
const maxSize = 50 * 1024 * 1024; // Max Size of media file 50 MB in bytes
const plansPopup = document.getElementById("theme-popup-view-plans");

if (!urlParams.has("magiccode")) {
  submitBtnGenerate.addEventListener("click", async (event) => {
    event.preventDefault(); // Prevent the default form submission

    generateQRCodeFe();

    document.getElementById("text-file").value = "YOUR MESSAGE";
    const qrName = document.getElementById("qr-name").value;
    const qrDotColor = document.getElementById("qr-color").value;
    const backgroundColor = document.getElementById("bg-color").value;
    const dotStyle = document.getElementById("dot-style").value;
    const cornerStyle = document.getElementById("corner-style").value;
    const applyGradient = document.getElementById("gradient").value;
    const Logo = document.getElementById("logo").files[0];
    const code = document.getElementById("qr-code-key").value;
    const logoImageValue = document.getElementById("QRLogo").value;

    const formData = new FormData(); // Create a FormData object
    const type = qrDataType.value; // Get the selected type

    // Append user ID and type to the FormData object
    formData.append("type", type);

    // Append QR settings to the FormData object
    formData.append("qrDotColor", qrDotColor);
    formData.append("backgroundColor", backgroundColor);
    formData.append("dotStyle", dotStyle);
    formData.append("cornerStyle", cornerStyle);
    formData.append("applyGradient", applyGradient);
    formData.append("qrName", qrName);
    formData.append("code", code);
    formData.append("logoImageValue", logoImageValue);

    // const selected = document.querySelector(
    //   'input[name="ColorList"]:checked'
    // ).value;
    // formData.append("ColorList", selected);

    // Append the logo file if it exists
    if (Logo) {
      formData.append("logo", Logo);
    }

    if (!qrName) {
      let lang = document.getElementById("languageSwitcher").value || "en";
      let msg = "Please enter Magic Code name";
      if (lang == "en") {
        msg = "Please enter Magic Code name";
      } else if (lang == "de") {
        msg = "Bitte Magic Code Namen angeben";
      } else if (lang == "hu") {
        msg = "Add meg a Magic Code nevét";
      }

      showToast(msg, "error");
      return; // Stop further processing if file is not attached
    }

    // Append the input file or URL based on the selected QR type
    if (type === "media") {
      const mediaFileInput = document.getElementById("media-file");

      // Check if a file is attached
      if (mediaFileInput.files.length > 0) {
        const file = mediaFileInput.files[0];

        // Validate the file size
        if (file.size > maxSize) {
          showToast("Media File size should not exceed 50 MB.", "error");
          return; // Stop further processing if file is too large
        }

        formData.append("media-file", file); // Append the media file if validation passes
      } else {
        showToast("Please attach a media file.", "error");
        return; // Stop further processing if no file is attached
      }
    } else if (type === "text") {
      const text = document.getElementById("text-file");
      if (text.value) {
        formData.append("text", text.value); // Append the text file
      } else {
        showToast("Please provide text.", "error");
        return;
      }
    } else if (type === "url") {
      const urlInput = document.getElementById("url");
      if (urlInput.value) {
        //Check if the URL does NOT start with 'http://' or 'https://'
        if (!/^https?:\/\//i.test(urlInput.value)) {
          showToast("URL must begin with 'http://' or 'https://'.", "error");
          return;
        }
        formData.append("url", urlInput.value); // Append the URL if it has the correct format
      } else {
        showToast("Please provide a URL.", "error");
        return;
      }
    }

    try {
      const result = await generateQRCode(formData); // Call the function to generate the QR code
      // form.reset(); // Reset the form after successful submission
      // document.getElementById("qrCodePrintData").value = JSON.stringify(
      //   Object.fromEntries(
      //     Object.entries(result.qrCode).filter(([_, value]) => value !== null)
      //   )
      // );
      showToast(result.message, "success"); // Show success message

      setTimeout(() => {
        window.location.href = `/dashboard?magiccode=${result.qrCode.id}`;
      }, 1000); // Optional delay to let the toast show up
      // document.getElementById("PrintMyQR").style.visibility = "visible"; // Makes it visible again
      // document.getElementById("generateqrsection").style.display = "none"; // Makes it visible again
      // document.getElementById("showandupdateqr").style.display = "block"; // Makes it visible again

      // window.location.reload();
    } catch (error) {
      if (error.redirectUrl) {
        plansPopup.style.display = "flex";
      } else {
        showToast(error.message || "Error generating QR code.", "error"); // Show error message
      }
    }
  });
}

// Function to generate the QR code
async function generateQRCode(formData) {
  try {
    document.querySelector(".submit-btn").disabled = true;
    // generatedSection.style.display = "none";
    toggleLoaderVisibility(true);

    const response = await fetch("/generate", {
      method: "POST",
      body: formData, // FormData auto-sets Content-Type to multipart/form-data
    });

    const result = await response.json();

    if (!response.ok) {
      const error = new Error(result.message || "QR Code generation failed!");
      error.type = result.type || "error"; // optional, if you want to use different toast styles
      error.redirectUrl = result.redirectUrl || null; // preserve redirect URL
      throw error;
    } else {
      // document.getElementById("qr-code").style.display = "block"; // Show the element
      submitBtnGenerate.disabled = false;
      // submitBtnGenerate.style.display = "none";
      // submitBtnUpdate.style.display = "flex";
      // downloadQrButton.style.display = "flex";
      toggleLoaderVisibility(false);
      // generatedSection.style.display = "block";
    }

    return result; // Return the result for further handling
  } catch (error) {
    toggleLoaderVisibility(false);
    // generatedSection.style.display = "block";
    console.error("Error:", error);
    document.querySelector(".submit-btn").disabled = false;
    throw error; // Propagate the error
  }
}

// Handle form submission
submitBtnUpdate.addEventListener("click", async (event) => {
  event.preventDefault(); // Prevent default form submission

  // const qrName = document.getElementById("qr-name-update").value;
  // const backgroundColor = document.getElementById("bg-color-update").value;
  // const dotStyle = document.getElementById("dot-style-update").value;
  // const cornerStyle = document.getElementById("corner-style-update").value;
  // const applyGradient = document.getElementById("gradient-update").value;
  // const qrDotColor = document.getElementById("qr-dot-color-update").value;
  document.getElementById("bg-color").value = "#ffffff";
  const activeBtn = document.querySelector(".content-type-button.active");

  let type;

  if (activeBtn) {
    const typeText = activeBtn.textContent.trim().toLowerCase();

    if (typeText === "link") {
      type = "url";
    } else if (typeText === "text") {
      type = "text";
    } else if (typeText === "photo/video") {
      type = "media";
    }
  }

  // Foreground color
  let activeFg = document.querySelector(
    "#foreground-color-grid-update .color-option.active"
  );
  let fgColorHex = "#000000"; // Default to black

  if (activeFg) {
    const fgColorRgb = window.getComputedStyle(activeFg).backgroundColor;
    fgColorHex = rgbToHex(fgColorRgb);
  }

  // Background color
  let activeBg = document.querySelector(
    "#background-color-grid-update .color-option.active"
  );
  let bgColorHex = "#ffffff"; // Default to white

  if (activeBg) {
    const bgColorRgb = window.getComputedStyle(activeBg).backgroundColor;
    bgColorHex = rgbToHex(bgColorRgb);
  }

  // Ensure foreground and background are not the same
  if (fgColorHex.toLowerCase() === bgColorHex.toLowerCase()) {
    // If both are white, set background to black
    if (fgColorHex.toLowerCase() === "#ffffff") {
      bgColorHex = "#000000";
    } else {
      // Otherwise, invert the background color (optional enhancement)
      bgColorHex = "#ffffff";
    }
  }

  const qrName = document.getElementById("qr-name").value;
  const qrDotColor = document.getElementById("qr-color").value;
  const backgroundColor = document.getElementById("bg-color").value;
  const dotStyle = document.getElementById("dot-style").value;
  const cornerStyle = document.getElementById("corner-style").value;
  const applyGradient = document.getElementById("gradient").value;
  // const Logo = document.getElementById("logo").files[0];
  const code = document.getElementById("qr-code-key").value;
  const logoFileInput = document.getElementById("logo"); //logo file input
  const logoImageValue = document.getElementById("QRLogo").value;
  const logo = `images/logo${logoImageValue}.jpg`;

  const formData = new FormData(); // Create a FormData object

  // Append type and other form data
  formData.append("type", type);
  formData.append("qrName", qrName);
  formData.append("backgroundColor", bgColorHex);
  formData.append("dotStyle", dotStyle);
  formData.append("cornerStyle", cornerStyle);
  formData.append("applyGradient", applyGradient);
  formData.append("qrDotColor", fgColorHex);
  formData.append("logoImageValue", logoImageValue);

  // const selected = document.querySelector(
  //   'input[name="ColorList"]:checked'
  // ).value;
  // formData.append("ColorList", selected);

  // formData.append("logo", logoFileInput.files[0]);

  if (type === "media") {
    const mediaFileInput = document.getElementById("media-file-update");

    // Check if a file is attached
    if (mediaFileInput.files.length > 0) {
      const file = mediaFileInput.files[0];

      // Validate the file size
      if (file.size > maxSize) {
        showToast("File size should not exceed 50 MB.", "error");
        return; // Stop further processing if the file is too large
      }

      // Append the media file if validation passes
      formData.append("media-file", file);
    } else {
      showToast("Please attach a media file.", "error");
      return; // Stop further processing if no file is attached
    }
  } else if (type === "text") {
    const text = document.getElementById("text-file-update");
    if (text.value) {
      formData.append("text", text.value);
    } else {
      showToast("Please attach a text file.", "error");
      return;
    }
  } else if (type === "url") {
    const urlInput = document.getElementById("url-update");
    if (urlInput.value) {
      // Check if the URL does NOT start with 'http://' or 'https://'
      if (!/^https?:\/\//i.test(urlInput.value)) {
        showToast("URL must begin with 'http://' or 'https://'.", "error");
        return;
      }
      formData.append("url", urlInput.value); // Append the URL if it has the correct format
    } else {
      showToast("Please provide a URL.", "error");
      return;
    }
  }

  try {
    // Get the QR Code ID dynamically (you may need to replace `qrCodeId` with the actual value)
    const qrCodeId = code; // Replace with actual QR code ID
    // generatedSection.style.display = "none";
    toggleLoaderVisibility(true);

    // Send a PUT request to update the QR code
    const response = await fetch(`/update/${qrCodeId}`, {
      method: "PUT",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || "Error Updating QR");
      error.type = result.type || "error"; // optional, if you want to use different toast styles
      error.redirectUrl = result.redirectUrl || null; // preserve redirect URL
      throw error;
    }

    // generatedSection.style.display = "block";

    showToast(result.message, "success");
    // document.getElementById("qrCodePrintData").value = JSON.stringify(
    //   Object.fromEntries(
    //     Object.entries(result.qrCode).filter(([_, value]) => value !== null)
    //   )
    // );

    window.location.reload();
    toggleLoaderVisibility(false);
  } catch (error) {
    toggleLoaderVisibility(false);
    // generatedSection.style.display = "block";
    if (error.redirectUrl) {
      plansPopup.style.display = "flex";
    } else {
      showToast(error.message || "Error generating QR code.", "error"); // Show error message
    }
  }
  // generateQRCodeFe(true, logo);
});
