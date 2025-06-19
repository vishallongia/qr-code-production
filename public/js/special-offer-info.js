//Populate Special Data
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

      const type = data.data?.type;
      const text = data.data?.text || "";
      const url = data.data?.url || "";
      const mediaUrl = data.data?.media_url || "";

      // Fill inputs
      document.getElementById("text-file-update").value = text;
      document.getElementById("url-update").value = url;

      // Auto-select and show relevant section
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

      // Show selected media file name if media
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
    }
  }

  const pathParts = window.location.pathname.split("/");
  const couponId = pathParts[pathParts.length - 1]; // Gets the last segment of the path

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
    const couponId = window.location.pathname.split("/").pop(); // Adjust if needed

    const formData = new FormData();
    formData.append("type", type);

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

    // Run the API call safely
    try {
      const res = await fetch(`/special-offer-info/${couponId}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Content saved successfully", "success");
        // Reload after 1.5 seconds
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

    // Continue any further code execution here (this won't be stopped)
    console.log("Save attempt completed.");
  });
