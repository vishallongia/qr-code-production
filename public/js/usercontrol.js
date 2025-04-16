// document.querySelector("#qr-update-toggle").addEventListener("change", async function () {
//     const showEditOnScan = this.checked; // Use the correct variable name
//     console.log(showEditOnScan);
//     try {
//         // Send the updated status to the backend API
//         const response = await fetch("/usercontrol/toggle-edit-on-scan", {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({ showEditOnScan }),
//         });

//         // Check if the response is OK
//         if (!response.ok) {
//             const errorData = await response.json();
//             throw new Error(errorData.message || "Failed to update QR edit toggle");
//         }

//         const result = await response.json();
//         showToast(result.message, "success");
//     } catch (error) {
//         console.error("Error updating QR toggle:", error);
//         showToast(error.message, "error"); // Use error.message instead of response.message
//     }
// });

async function SetUserControl() {
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
  } catch (error) {
    console.error("Error updating QR toggle:", error);
    showToast(error.message, "error"); // Use error.message instead of response.message
  }
}
auto();
function auto() {
  let showEditOnScan = document.getElementById("qr-update-toggle").checked;

  if (showEditOnScan) {
    document.getElementById("qr-update-select").value = "ShowEdit";
  } else {
    document.getElementById("qr-update-select").value = "ShowContent";
  }
}
