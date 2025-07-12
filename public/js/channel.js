document.addEventListener("DOMContentLoaded", () => {
  // ===================== Add Channel Popup =====================
  const addPopup = document.getElementById("popup-add-channel");
  const openAddBtn = document.getElementById("add-channel-btn");
  const closeAddBtn = document.getElementById("close-popup-channel");

  openAddBtn?.addEventListener("click", () => {
    addPopup.style.display = "flex";
  });

  closeAddBtn?.addEventListener("click", () => {
    addPopup.style.display = "none";
  });

  // ===================== Add Channel Submit =====================
  const addForm = document.getElementById("add-channel-form");
  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("channel-name-input");
    const name = input.value.trim();

    if (!name) {
      showToast("Channel name is required", "error");
      return;
    }

    try {
      const res = await fetch("/tvstation/create-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Channel created successfully", "success");
        input.value = "";
        addPopup.style.display = "none";
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(data.message || "Failed to create channel", "error");
      }
    } catch (error) {
      console.error("Create Channel API error:", error);
      showToast("Failed to create channel", "error");
    }
  });

  // ===================== Delete Channel =====================
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.id;
      const confirmed = confirm(
        "Are you sure you want to delete this channel?"
      );
      if (!confirmed) return;

      try {
        const res = await fetch(`/tvstation/channels/${channelId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const data = await res.json();

        if (res.ok) {
          showToast(data.message || "Channel deleted successfully", "success");
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(data.message || "Failed to delete channel", "error");
        }
      } catch (err) {
        console.error("Delete error:", err);
        showToast("Something went wrong", "error");
      }
    });
  });

  // ===================== Edit Channel Popup =====================
  const editPopup = document.getElementById("popup-edit-channel");
  const closeEditBtn = document.getElementById("close-popup-edit-channel");

  closeEditBtn?.addEventListener("click", () => {
    editPopup.style.display = "none";
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channelId = btn.dataset.id;
      const nameSpan = btn
        .closest(".user-item")
        ?.querySelector("span:first-child");
      const currentName = nameSpan?.innerText.trim() || "";

      document.getElementById("edit-channel-id").value = channelId;
      document.getElementById("edit-channel-name").value = currentName;

      editPopup.style.display = "flex";
    });
  });

  // ===================== Edit Channel Submit =====================
  const editForm = document.getElementById("edit-channel-form");
  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const channelId = document.getElementById("edit-channel-id").value;
    const name = document.getElementById("edit-channel-name").value.trim();

    if (!name) {
      showToast("Channel name is required", "error");
      return;
    }

    try {
      const res = await fetch(`/tvstation/channels/${channelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Channel updated successfully", "success");
        editPopup.style.display = "none";
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(data.message || "Failed to update channel", "error");
      }
    } catch (err) {
      console.error("Edit channel error:", err);
      showToast("Something went wrong", "error");
    }
  });
});
