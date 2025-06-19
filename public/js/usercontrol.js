async function SetUserControl(isSpecialOffer) {
  if (isSpecialOffer) {
    showToast("Please disconnect from event to proceed", "error");
    // Optional: reset radio selection
    document.querySelector(
      'input[name="qr-update-option"][value="SpecialOffer"]'
    ).checked = true;
    return;
  }
  let showEditOnScan = false;
  const selectedValue = document.querySelector(
    'input[name="qr-update-option"]:checked'
  )?.value;
  // let value = document.getElementById("qr-update-select").value

  if (selectedValue == "ShowEdit") {
    showEditOnScan = true;
  } else {
    showEditOnScan = false;
  }

  // const showEditOnScan = this.checked; // Use the correct variable name
  // console.log(showEditOnScan);
  try {
    // Send the updated status to the backend API
    const response = await fetch("/usercontrol/toggle-edit-on-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ showEditOnScan }),
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update QR edit toggle");
    }

    const result = await response.json();
    let msg = "Qr Control Updated";
    if (result.message == "Qr Control Updated") {
      let lang = document.getElementById("languageSwitcher").value;
      if (lang == "de") {
        msg =
          "Funktionalität beim Scannen meines Magic Codes erfolgreich geändert";
      } else if (lang == "hu") {
        msg =
          "A saját Magic Code-od beolvasásának a funkcióját sikeresen megváltoztattad.";
      } else {
        msg = "Qr Control Updated";
      }

      showToast(msg, "success");
    } else {
      showToast(result.message, "success");
    }

    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    console.error("Error updating QR toggle:", error);
    showToast(error.message, "error"); // Use error.message instead of response.message
  }
}
// auto();
// function auto() {
//   let showEditOnScan = document.getElementById("qr-update-toggle").checked;

//   if (showEditOnScan) {
//     document.getElementById("qr-update-select").value = "ShowEdit";
//   } else {
//     document.getElementById("qr-update-select").value = "ShowContent";
//   }
// }

function handleSpecialOfferToggle() {
  const selectedValue = document.querySelector(
    'input[name="qr-update-option"]:checked'
  ).value;

  if (selectedValue === "SpecialOffer") {
    document.getElementById("theme-popup-special-offer").style.display = "flex";
  }
}

// Close popup when clicking the ×
document
  .getElementById("close-popup-special-offer")
  .addEventListener("click", () => {
    document.getElementById("theme-popup-special-offer").style.display = "none";
    window.location.reload();
  });

async function validateCouponCode(couponCode) {
  try {
    const res = await fetch("/validate-coupon-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: couponCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Invalid code", "error");
      return;
    }

    if (data.valid && data.hasSpecialOffer) {
      // Hide original popup
      document.getElementById("theme-popup-special-offer").style.display =
        "none";

      // Populate the new popup with QR data
      const tbody = document.getElementById("qr-table-body");
      tbody.innerHTML = ""; // Clear old rows

      data.qrCodes.forEach((qr, i) => {
        const tr = document.createElement("tr");
        const tdCheck = document.createElement("td");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "qr-select";
        checkbox.className = "qr-check hidden-checkbox";
        checkbox.id = `qr-${i}`;
        checkbox.value = qr._id || `qr-${i}`;

        if (qr.specialOfferCouponId) {
          checkbox.checked = true;
        }

        const label = document.createElement("label");
        label.setAttribute("for", `qr-${i}`);
        label.className = "qr-tile";
        label.textContent = qr.qrName || "Untitled QR";

        tdCheck.appendChild(checkbox);
        tdCheck.appendChild(label);
        tr.appendChild(tdCheck);

        tbody.appendChild(tr);
      });

      // Show the new popup
      document.getElementById("popup-container-wrapper").style.display = "flex";
      // Show the new popup
      document.getElementById("hidden-coupon-id").value = data.couponId;
    } else {
      showToast("No valid special offer with coupon", "error");
    }
  } catch (err) {
    showToast("Something went wrong", "error");
    console.error(err);
  }
}

document
  .getElementById("popup-ok-btn-special-offer")
  .addEventListener("click", function () {
    const couponCode = document.getElementById("coupon-code").value.trim();

    if (!couponCode) {
      showToast("Please enter a coupon code", "error");
      return;
    }

    validateCouponCode(couponCode); // ✅ Call the async function
  });

async function authenticateQRCodes() {
  const couponId = document.getElementById("hidden-coupon-id").value;
  const selectedQRs = Array.from(
    document.querySelectorAll(".qr-check:checked")
  ).map((cb) => cb.value);

  if (!couponId || selectedQRs.length === 0) {
    alert("Please select at least one QR and ensure coupon ID is available.");
    return;
  }

  try {
    const res = await fetch("/set-special-offer-qrs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        couponId,
        qrCodeIds: selectedQRs,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message, "success");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(data.message || "Failed to authenticate QR codes.", "error");
    }
  } catch (err) {
    console.error("Request error:", err);
    showToast("Something went wrong.", "error");
  }
}

function closeSpecialOfferPopup() {
  document.getElementById("popup-container-wrapper").style.display = "none";
  window.location.reload();
}

async function disconnectFromEvent() {
  const confirmDisconnect = confirm(
    "Are you sure you want to disconnect from the special info?"
  );
  if (!confirmDisconnect) return;

  try {
    const res = await fetch("/disconnect-special-offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (data.success) {
      showToast("Disconnected successfully", "success");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.message || "Failed to disconnect", "error");
    }
  } catch (err) {
    console.error("Disconnect error:", err);
    showToast("Something went wrong", "error");
  }
}
