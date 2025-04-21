function toggleLoaderVisibility(isVisible) {
  // Scroll to the top before showing the loader
  window.scrollTo(0, 0); // Scroll to the top of the page

  const loader = document.querySelector(".loader-overlay");
  document.body.style.overflow = isVisible ? "hidden" : "auto"; // Disable or enable scroll
  loader.style.display = isVisible ? "flex" : "none"; // Show or hide loader
}

// Function to show loader and reload the page
function showLoaderAndReload() {
  // Show the loader and set sessionStorage flag
  toggleLoaderVisibility(true);
  sessionStorage.setItem("isReloading", "true");

  // Wait a little to make sure the loader is visible
  setTimeout(function () {
    // Reload the page
    window.location.reload();
  }, 500); // Adjust time if needed to ensure the loader is visible
}

// Check if page is being reloaded, and show loader if necessary
if (sessionStorage.getItem("isReloading") === "true") {
  toggleLoaderVisibility(true); // Keep the loader visible

  // Remove the flag after a short delay to let the reload happen
  setTimeout(function () {
    sessionStorage.removeItem("isReloading");
  }, 100); // Adjust timing if necessary, but not too long
}
