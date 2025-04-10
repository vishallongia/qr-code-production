function toggleLoaderVisibility(isVisible) {
  // Scroll to the top before showing the loader
  window.scrollTo(0, 0); // Scroll to the top of the page

  const loader = document.querySelector(".loader-overlay");
  document.body.style.overflow = isVisible ? "hidden" : "auto"; // Disable or enable scroll
  loader.style.display = isVisible ? "flex" : "none"; // Show or hide loader
}
