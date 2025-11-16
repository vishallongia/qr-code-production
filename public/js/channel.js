document.addEventListener("DOMContentLoaded", () => {
  // ===================== Elements =====================
  const popup = document.getElementById("popup-add-edit-show");
  const openAddBtn = document.getElementById("add-channel-btn");
  const closeBtn = document.getElementById("close-popup-show");
  const form = document.getElementById("add-edit-show-form");
  const showIdInput = document.getElementById("show-id");
  const showNameInput = document.getElementById("show-name");
  const showLogoInput = document.getElementById("show-logo");
  const logoPreviewContainer = document.getElementById(
    "show-logo-preview-container"
  );
  const logoPreview = document.getElementById("show-logo-preview");
  const clearLogoBtn = document.getElementById("clear-show-logo-btn");
  const removeLogoFlag = document.getElementById("remove-show-logo-flag");
  const popupHeader = document.getElementById("show-popup-header");

  // ===================== Open Add Popup =====================
  openAddBtn?.addEventListener("click", () => {
    popup.style.display = "flex";
    popupHeader.textContent = "Add New Project";
    form.reset();
    showIdInput.value = "";
    removeLogoFlag.value = "false";
    logoPreviewContainer.style.display = "none";
  });

  // ===================== Close Popup =====================
  closeBtn?.addEventListener("click", () => {
    popup.style.display = "none";
    form.reset();
    logoPreviewContainer.style.display = "none";
    showLogoInput.value = "";
    removeLogoFlag.value = "false";
  });

  // ===================== Logo Preview =====================
  showLogoInput.addEventListener("change", () => {
    const file = showLogoInput.files[0];
    if (file) {
      logoPreview.src = URL.createObjectURL(file);
      logoPreviewContainer.style.display = "block";
      removeLogoFlag.value = "false";
      clearLogoBtn.style.display = "block"; // <-- add this line
    }
  });

  // ===================== Clear Logo =====================
  clearLogoBtn.addEventListener("click", () => {
    showLogoInput.value = "";
    logoPreview.src = "";
    logoPreviewContainer.style.display = "none";
    removeLogoFlag.value = "true";
  });

  // ===================== Edit Show Popup =====================
  // ===================== Edit Show Popup =====================
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channelId = btn.dataset.id?.trim(); // remove extra spaces
      showIdInput.value = channelId;
      popupHeader.textContent = "Edit Project";

      // Populate name
      const secondSpan = btn
        .closest(".user-item")
        ?.querySelector("span:nth-child(2)");
      showNameInput.value = secondSpan?.innerText.trim() || "";

      // Populate optional fields from data- attributes
      const logoTitleInput = document.getElementById("session-logo-title");
      const descriptionInput = document.getElementById("session-description");
      const linkInput = document.getElementById("session-link");

      logoTitleInput.value = btn.dataset.logoTitle || "";
      descriptionInput.value = btn.dataset.description || "";
      linkInput.value = btn.dataset.link || "";

      // Handle logo preview
      if (btn.dataset.logoUrl) {
        logoPreview.src = btn.dataset.logoUrl;
        logoPreviewContainer.style.display = "block";
        clearLogoBtn.style.display = "block";
        removeLogoFlag.value = "false";
      } else {
        logoPreview.src = "";
        logoPreviewContainer.style.display = "none";
        clearLogoBtn.style.display = "none";
        removeLogoFlag.value = "false";
      }

      // Reset file input
      showLogoInput.value = "";

      // Show popup
      popup.style.display = "flex";
    });
  });

  // ===================== Delete Show =====================
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.id;
      const confirmed = confirm("Are you sure you want to delete this Project?");
      if (!confirmed) return;
      document.getElementById("loader").style.display = "flex"; // 👈 Show loader
      try {
        const res = await fetch(`/tvstation/channels/${channelId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "Project deleted successfully", "success");
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(data.message || "Failed to delete show", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Something went wrong", "error");
      } finally {
        document.getElementById("loader").style.display = "none"; // 👈 Show loader
      }
    });
  });

  // ===================== Add/Edit Submit =====================
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form); // automatically includes all inputs
    document.getElementById("loader").style.display = "flex"; // 👈 Show loader
    const showId = showIdInput.value;
    const url = showId
      ? `/tvstation/channels/${showId}`
      : "/tvstation/create-channel";
    const method = showId ? "PUT" : "POST";

    try {
      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Project saved successfully", "success");
        popup.style.display = "none";
        form.reset();
        logoPreviewContainer.style.display = "none";
        showLogoInput.value = "";
        removeLogoFlag.value = "false";
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(data.message || "Failed to save show", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong", "error");
    } finally {
      document.getElementById("loader").style.display = "none"; // 👈 Show loader
    }
  });
});

function OpenEditFromImg(id) {
    console.log("Edit button clicked for ID:", id);

    // Find button by data-id
    const btn = document.querySelector(`.edit-btn[data-id="${id}"]`);
    if (btn) {
        btn.click(); // triggers its click event
    } else {
        console.warn("Button not found for ID:", id);
    }
}

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  // If id exists, call your function
  if (id) {
    OpenEditFromImg(id);
  }
}