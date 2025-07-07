function formatToDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1); // Month is 0-indexed
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
document.addEventListener("DOMContentLoaded", function () {
  async function populateSpecialOffer(couponId) {
    try {
      const res = await fetch(`/special-offer-info-data/${couponId}`, {
        method: "GET",
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Failed to load special offer", "error");
        return;
      }
      const loader = document.getElementById("loader");
      if (loader) loader.style.display = "flex"; // Show loader
      const special = data.data || {};

      const type = special.type;
      const text = special.text || "";
      const url = special.url || "";
      const mediaUrl = special.media_url || "";
      const name = special.name || "";
      const startDate = special.startDate ? new Date(special.startDate) : null;
      const endDate = special.endDate ? new Date(special.endDate) : null;

      // ✅ Fill content fields
      document.getElementById("text-file-update").value = text;
      document.getElementById("url-update").value = url;

      if (name) {
        document.getElementById("event-name").value = name;
      }

      if (startDate) {
        document.getElementById("event-start-date").value =
          formatToDatetimeLocal(new Date(startDate));
      }

      if (endDate) {
        document.getElementById("event-end-date").value = formatToDatetimeLocal(
          new Date(endDate)
        );
      }

      const statusBox = document.getElementById("event-status");
      const now = new Date();

      if (startDate && endDate && statusBox) {
        let status = "";

        if (endDate < now) {
          status = "Expired";
          statusBox.style.color = "red";

          // ❌ Clear all fields
          document.getElementById("text-file-update").value = "";
          document.getElementById("url-update").value = "";
          document.getElementById("event-name").value = "";
          document.getElementById("event-start-date").value = "";
          document.getElementById("event-end-date").value = "";

          // Clear media preview
          const uploadText = document.querySelector(
            "#media-section .upload-box p"
          );
          if (uploadText) uploadText.innerHTML = "";

          // Optional: Disable fields
        } else if (startDate > now) {
          status = "Scheduled";
          statusBox.style.color = "blue";
        } else {
          status = "Running";
          statusBox.style.color = "green";
        }

        statusBox.textContent = `Status: ${status}`;
      } else {
        statusBox.textContent = "";
      }

      // ✅ Auto-select type
      const btnMap = {
        text: "Text",
        url: "Link",
        media: "Photo/Video",
      };

      const typeLabel = btnMap[type];

      if (typeLabel) {
        const btn = [...document.querySelectorAll(".content-type-button")].find(
          (b) => b.textContent.trim() === typeLabel
        );
        if (btn) btn.click();
      } else {
        const linkBtn = [
          ...document.querySelectorAll(".content-type-button"),
        ].find((b) => b.textContent.trim() === "Link");
        if (linkBtn) linkBtn.click();
      }

      // ✅ Show media filename if present
      if (type === "media" && mediaUrl) {
        const uploadText = document.querySelector(
          "#media-section .upload-box p"
        );
        const fileName = mediaUrl.split("/").pop();
        uploadText.innerHTML = `Selected: <strong>${fileName}</strong>`;
      }
    } catch (err) {
      console.error("Failed to fetch special offer:", err);
      showToast("Error fetching special offer", "error");
    } finally {
      if (loader) loader.style.display = "none"; // Hide loader
    }
  }

  const pathParts = window.location.pathname.split("/");
  const couponId = pathParts[pathParts.length - 1];

  if (couponId) {
    populateSpecialOffer(couponId);
  }
});

//Submitting Special Info Data

document
  .getElementById("submit-btn-update")
  .addEventListener("click", async () => {
    const activeBtn = document.querySelector(".content-type-button.active");
    if (!activeBtn) {
      showToast("Please select a content type", "error");
      return;
    }

    const rawType = activeBtn.textContent.trim().toLowerCase();
    const type =
      rawType === "link"
        ? "url"
        : rawType === "photo/video"
        ? "media"
        : rawType;

    const text = document.getElementById("text-file-update").value.trim();
    const url = document.getElementById("url-update").value.trim();
    const mediaFile = document.getElementById("media-file-update").files[0];
    const couponId = window.location.pathname.split("/").pop();

    // ✅ Event info inputs
    const name = document.getElementById("event-name")?.value.trim();
    const startDate = document.getElementById("event-start-date")?.value;
    const endDate = document.getElementById("event-end-date")?.value;

    // ✅ Validate name
    if (!name) {
      showToast("Event name is required", "error");
      return;
    }

    // ✅ Null checks for dates
    if ((startDate && !endDate) || (!startDate && endDate)) {
      showToast("Both start and end dates must be selected", "error");
      return;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();

      if (isNaN(start) || isNaN(end)) {
        showToast("Invalid date format", "error");
        return;
      }

      if (start > end) {
        showToast("Start date cannot be after end date", "error");
        return;
      }

      if (end < today) {
        showToast("End date cannot be in the past", "error");
        return;
      }
    }

    // ✅ Build form data
    const formData = new FormData();
    formData.append("type", type);
    formData.append("name", name);

    if (startDate)
      formData.append("startDate", new Date(startDate).toISOString());
    if (endDate) formData.append("endDate", new Date(endDate).toISOString());

    if (type === "text" && text) {
      formData.append("text", text);
    } else if (type === "url" && url) {
      formData.append("url", url);
    } else if (type === "media" && mediaFile) {
      formData.append("media-file", mediaFile);
    } else {
      showToast(
        `Please provide valid ${
          type === "photo/video" ? "media" : type
        } content`,
        "error"
      );
      return;
    }

    try {
      const res = await fetch(`/special-offer-info/${couponId}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Content saved successfully", "success");
        setTimeout(() => {
          location.reload();
        }, 1000);
      } else {
        showToast(data.message || "Failed to save content", "error");
      }
    } catch (error) {
      console.error("API error:", error);
      showToast("Something went wrong while saving", "error");
    }

    console.log("Save attempt completed.");
  });
