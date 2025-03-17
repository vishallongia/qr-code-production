// Function to extract encrypted ID from the URL
function getEncIdFromUrl() {
  const urlSegments = window.location.pathname.split("/");
  return urlSegments[urlSegments.length - 1]; // Extracts the last part of the URL
}

// Function to set encId in onclick attribute
function setEncIdForMagicLink(formId, emailInputId, buttonId) {
  const encId = getEncIdFromUrl();
  const sendButton = document.getElementById(buttonId);

  if (sendButton) {
    sendButton.setAttribute(
      "onclick",
      `handleMagicLink(event, '${emailInputId}', '${buttonId}', '${encId}')`
    );
  }
}

// Call the function when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  setEncIdForMagicLink("UpdateUserDetails", "RegisterEmailText", "UpdateBtn");
});
