// 🔁 Global DOM references
const channelId = document.getElementById("channel-id")?.value || "";
const sessionLength = parseInt(
  document.getElementById("session-length")?.value || "0",
  10
);
const previewImg = document.getElementById("session-logo-preview");
const previewContainer = document.getElementById(
  "session-logo-preview-container"
);
const fileInput = document.getElementById("session-logo");
const clearBtn = document.getElementById("clear-logo-btn");
const label = document.getElementById("session-logo-label");
const form = document.getElementById("add-session-form");
const popupAddSession = document.getElementById("popup-add-session");
const submitBtn = document.getElementById("submit-add-session");
const headerText = document.getElementById("add-session-headerText");
const removeLogoFlag = document.getElementById("remove-logo-flag");

document.addEventListener("DOMContentLoaded", () => {
  let skipCount = sessionLength;

  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const loadingText = document.getElementById("loadingText");

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", async () => {
      try {
        loadMoreBtn.style.display = "none";
        loadingText.style.display = "block";

        const res = await fetch(
          `/tvstation/channels/${channelId}/sessions?skip=${skipCount}&limit=5`,
          { headers: { Accept: "application/json" } }
        );

        const json = await res.json();

        if (json.type === "success" && Array.isArray(json.data)) {
          const container = document.querySelector(".quiz-admin-questions");

          json.data.forEach((s) => {
            const hasLogo = !!s.logo;
            const imageSrc = hasLogo ? s.logo : "/images/no-image.png";

            const div = document.createElement("div");
            div.className = "quiz-admin-question-card";

            div.innerHTML = `
        <div class="quiz-admin-question-header">
          <div class="session-logo-wrapper">
            ${
              s.link && hasLogo
                ? `<a href="${s.link}" target="_blank"><img src="${imageSrc}" alt="Session Logo" class="session-logo-image" /></a>`
                : `<img src="${imageSrc}" alt="Session Logo" class="session-logo-image" />`
            }
          </div>

          <div class="session-details">
            <div class="quiz-admin-question-text">${s.name}</div>
            <div class="quiz-admin-info">
              ${
                s.logoTitle
                  ? `<span><strong>Logo Title:</strong> ${s.logoTitle}</span>`
                  : ""
              }
              ${
                s.description
                  ? `<span><strong>Description:</strong> ${s.description}</span>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="quiz-admin-actions">
          <button 
            class="edit-session-btn"
            data-session-id="${s._id}"
            data-name="${s.name || ""}"
            data-logo-title="${s.logoTitle || ""}"
            data-description="${s.description || ""}"
            data-link="${s.link || ""}"
            data-logo-url="${s.logo || ""}"
          >
            Edit
          </button>
          <button class="delete-btn delete" data-session-id="${s._id}">
            Delete
          </button>
        </div>
      `;

            container.appendChild(div);
          });

          skipCount += json.data.length;

          if (!json.hasMore || json.data.length < 5) {
            document.getElementById("loadMoreContainer").style.display = "none";
          } else {
            loadMoreBtn.style.display = "inline-block";
          }
        }
      } catch (err) {
        console.error("Load more failed", err);
        alert("Failed to load more sessions.");
        loadMoreBtn.style.display = "inline-block";
      } finally {
        loadingText.style.display = "none";
      }
    });
  }

  // Delete session handler
  document.addEventListener("click", async (e) => {
    const target = e.target;
    if (target.classList.contains("delete-btn")) {
      const sessionId = target.getAttribute("data-session-id");
      if (!sessionId) return;

      const confirmed = confirm(
        "Are you sure you want to delete this Episode?"
      );
      if (!confirmed) return;

      try {
        document.getElementById("loader").style.display = "flex"; // 👈 Show loader
        const res = await fetch(`/tvstation/session/${sessionId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const result = await res.json();

        if (result.type === "success") {
          showToast(
            result.message || "Episode deleted successfully",
            "success"
          );
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(result.message || "Failed to delete the Episode", "error");
        }
      } catch (err) {
        console.error("Delete failed", err);
        showToast("Server error while deleting the Episode", "error");
      } finally {
        document.getElementById("loader").style.display = "none"; // 👈 Hide loader
      }
    }
  });

  // Open popup
  document
    .getElementById("create-session-btn")
    ?.addEventListener("click", () => {
      popupAddSession.style.display = "flex";
      headerText.textContent = "Create New Episode";
    });

  // Close popup
  document
    .getElementById("close-popup-session")
    ?.addEventListener("click", () => {
      popupAddSession.style.display = "none";
      resetForm();
    });

  // Image preview
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewContainer.style.display = "block";
        clearBtn.style.display = "block";
        label.textContent = "Change Logo";
        // ✅ Reset remove flag to false
        if (removeLogoFlag) removeLogoFlag.value = "false";
      };
      reader.readAsDataURL(file);
    }
  });

  clearBtn?.addEventListener("click", () => {
    fileInput.value = "";
    previewImg.src = "";
    previewContainer.style.display = "none";
    clearBtn.style.display = "none";
    label.textContent = "Choose Logo";
    // ✅ Set remove flag to true
    if (removeLogoFlag) removeLogoFlag.value = "true";
  });

  // Edit session handler using event delegation
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".edit-session-btn");
    if (!btn) return;

    e.preventDefault();

    const editingSessionId = btn.dataset.sessionId;
    form.dataset.editingId = editingSessionId;

    form.name.value = btn.dataset.name || "";
    form.logoTitle.value = btn.dataset.logoTitle || "";
    form.description.value = btn.dataset.description || "";
    form.link.value = btn.dataset.link || "";

    const logoUrl = btn.dataset.logoUrl;
    if (logoUrl) {
      previewImg.src = logoUrl;
      previewContainer.style.display = "block";
      clearBtn.style.display = "block";
      label.textContent = "Change Logo";
    } else {
      previewImg.src = "";
      previewContainer.style.display = "none";
      clearBtn.style.display = "none";
      label.textContent = "Choose Logo";
    }

    submitBtn.textContent = "Update Episode";
    popupAddSession.style.display = "flex";
    headerText.textContent = "Update Episode";
  });
  // Form submission
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const editingSessionId = form.dataset.editingId;

    const url = editingSessionId
      ? `/tvstation/session/${editingSessionId}/update`
      : `/tvstation/session/${channelId}/create`;

    try {
      document.getElementById("loader").style.display = "flex"; // 👈 Show loader
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || "Episode saved successfully", "success");
        resetForm();
        popupAddSession.style.display = "none";
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(data.message || "Failed to save Episode", "error");
      }
    } catch (error) {
      console.error("Session Save Error:", error);
      showToast("Error occurred while saving session", "error");
    } finally {
      document.getElementById("loader").style.display = "none"; // 👈 Hide loader
    }
  });
});

// Reset form helper
function resetForm() {
  form.reset();
  form.removeAttribute("data-editing-id");
  previewImg.src = "";
  previewContainer.style.display = "none";
  clearBtn.style.display = "none";
  label.textContent = "Choose Logo";
  submitBtn.textContent = "Create Episode";
}
