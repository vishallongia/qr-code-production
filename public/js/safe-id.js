document.addEventListener("DOMContentLoaded", () => {
  // ===================== Elements (rename-safeid) =====================
  const popup = document.getElementById("popup-add-safeid");
  const openAddBtn = document.getElementById("create-safeId-btn");
  const closeBtn = document.getElementById("close-popup-safeid");
  const form = document.getElementById("safeId-form");
  const editIdInput = document.getElementById("safeId-edit-id");
  const nameInput = document.getElementById("safeId-name");
  const logoTitleInput = document.getElementById("safeId-logo-title");
  const descriptionInput = document.getElementById("safeId-description");
  const linkInput = document.getElementById("safeId-link");
  const logoInput = document.getElementById("safeId-logo");
  const logoPreviewContainer = document.getElementById(
    "safeId-logo-preview-container"
  );
  const logoPreview = document.getElementById("safeId-logo-preview");
  const clearLogoBtn = document.getElementById("clear-logo-btn");
  const removeLogoFlag = document.getElementById("remove-logo-flag");
  const popupHeader = document.getElementById("safeId-popup-title");
  const mainContainer = document.querySelector(".quiz-admin-questions");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const loadingText = document.getElementById("loadingText");
  const loadMoreContainer = document.getElementById("loadMoreContainer");

  // configuration
  const BASE_ROUTE = "/safe-id"; // base route where your router is mounted
  const LIST_ROUTE = `${BASE_ROUTE}/safeids-list`;
  const CREATE_ROUTE = `${BASE_ROUTE}/create`;
  const UPDATE_ROUTE = (id) => `${BASE_ROUTE}/${id}/update`;
  const DELETE_ROUTE = (id) => `${BASE_ROUTE}/${id}`;

  // pagination state
  let skip =
    parseInt(new URLSearchParams(window.location.search).get("skip")) || 0;
  const limit = 5; // match server default
  let loadingMore = false;

  // ===================== Utility helpers =====================
  function showLoader() {
    const ld = document.getElementById("loader");
    if (ld) ld.style.display = "flex";
  }
  function hideLoader() {
    const ld = document.getElementById("loader");
    if (ld) ld.style.display = "none";
  }

  // Create card DOM for appended safe id (used by load more)
  function createSafeCard(s) {
    const wrapper = document.createElement("div");
    wrapper.className = "quiz-admin-question-card";

    const header = document.createElement("div");
    header.className = "quiz-admin-question-header";

    const logoWrap = document.createElement("div");
    logoWrap.className = "session-logo-wrapper";

    const hasLogo = !!s.logo;
    const img = document.createElement("img");
    img.className = "session-logo-image";
    img.alt = "Safe ID Logo";
    img.src = hasLogo ? s.logo : "/images/no-image.png";

    if (s.link && hasLogo) {
      const a = document.createElement("a");
      a.href = s.link;
      a.target = "_blank";
      a.appendChild(img);
      logoWrap.appendChild(a);
    } else {
      logoWrap.appendChild(img);
    }

    const details = document.createElement("div");
    details.className = "session-details";

    const titleDiv = document.createElement("div");
    titleDiv.className = "quiz-admin-question-text";
    titleDiv.textContent = s.safeId || s.name || "";

    const infoDiv = document.createElement("div");
    infoDiv.className = "quiz-admin-info";

    if (s.logoTitle) {
      const span = document.createElement("span");
      span.innerHTML = `<strong>Logo Title:</strong> ${s.logoTitle}`;
      infoDiv.appendChild(span);
    }
    if (s.description) {
      const span = document.createElement("span");
      span.innerHTML = `<strong>Description:</strong> ${s.description}`;
      infoDiv.appendChild(span);
    }

    details.appendChild(titleDiv);
    details.appendChild(infoDiv);

    header.appendChild(logoWrap);
    header.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "quiz-admin-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-safeId-btn";
    editBtn.setAttribute("data-id", s._id);
    editBtn.setAttribute("data-name", s.safeId || "");
    editBtn.setAttribute("data-logo-title", s.logoTitle || "");
    editBtn.setAttribute("data-description", s.description || "");
    editBtn.setAttribute("data-link", s.link || "");
    editBtn.setAttribute("data-logo-url", s.logo || "");
    editBtn.textContent = "Edit Safe ID";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn delete delete-safeId-btn";
    deleteBtn.setAttribute("data-id", s._id);
    deleteBtn.textContent = "Delete Safe ID";

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(actions);

    return wrapper;
  }

  // ===================== Open Add Popup =====================
  openAddBtn?.addEventListener("click", () => {
    popup.style.display = "flex";
    popupHeader.textContent = "Create New Safe ID";
    form.reset();
    editIdInput.value = "";
    removeLogoFlag.value = "false";
    logoPreviewContainer.style.display = "none";
    logoPreview.src = "";
    clearLogoBtn.style.display = "none";
    // update submit button text
    const submitBtn = document.getElementById("safeId-submit-btn");
    if (submitBtn) submitBtn.textContent = "Create Safe ID";
  });

  // ===================== Close Popup =====================
  closeBtn?.addEventListener("click", () => {
    popup.style.display = "none";
    form.reset();
    logoPreviewContainer.style.display = "none";
    logoPreview.src = "";
    logoInput.value = "";
    removeLogoFlag.value = "false";
    clearLogoBtn.style.display = "none";
  });

  // ===================== Image Preview =====================
  logoInput?.addEventListener("change", () => {
    const file = logoInput.files[0];
    if (file) {
      logoPreview.src = URL.createObjectURL(file);
      logoPreviewContainer.style.display = "block";
      removeLogoFlag.value = "false";
      clearLogoBtn.style.display = "block";
    }
  });

  // ===================== Clear Logo =====================
  clearLogoBtn?.addEventListener("click", () => {
    // mark to remove if this is an existing logo (edit mode)
    logoInput.value = "";
    logoPreview.src = "";
    logoPreviewContainer.style.display = "none";
    removeLogoFlag.value = "true";
    clearLogoBtn.style.display = "none";
  });

  // ===================== Edit popup (delegated) =====================
  // use event delegation to catch edit buttons (works for appended nodes)
  document.body.addEventListener("click", (ev) => {
    const editBtn = ev.target.closest(".edit-safeId-btn");
    if (!editBtn) return;

    // prevent other handlers
    ev.preventDefault();

    const id = editBtn.dataset.id?.trim();
    if (!id) return;

    // populate popup
    editIdInput.value = id;
    popupHeader.textContent = "Edit Safe ID";
    nameInput.value = editBtn.dataset.name || "";
    logoTitleInput.value = editBtn.dataset.logoTitle || "";
    descriptionInput.value = editBtn.dataset.description || "";
    linkInput.value = editBtn.dataset.link || "";

    const logoUrl = editBtn.dataset.logoUrl || "";
    if (logoUrl) {
      logoPreview.src = logoUrl;
      logoPreviewContainer.style.display = "block";
      clearLogoBtn.style.display = "block";
      removeLogoFlag.value = "false";
    } else {
      logoPreview.src = "";
      logoPreviewContainer.style.display = "none";
      clearLogoBtn.style.display = "none";
      removeLogoFlag.value = "false";
    }

    // reset file input
    logoInput.value = "";

    // update submit text
    const submitBtn = document.getElementById("safeId-submit-btn");
    if (submitBtn) submitBtn.textContent = "Update Safe ID";

    popup.style.display = "flex";
  });

  // ===================== Delete (delegated) =====================
  document.body.addEventListener("click", async (ev) => {
    const delBtn = ev.target.closest(".delete-safeId-btn");
    if (!delBtn) return;

    ev.preventDefault();

    const id = delBtn.dataset.id;
    if (!id) return;

    const confirmed = confirm("Are you sure you want to delete this Safe ID?");
    if (!confirmed) return;

    showLoader();
    try {
      const res = await fetch(DELETE_ROUTE(id), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Safe ID deleted successfully", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        // remove the card from DOM instead of full reload
      } else {
        showToast(data.message || "Failed to delete Safe ID", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong", "error");
    } finally {
      hideLoader();
    }
  });

  // ===================== Submit Create / Update =====================
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const editId = editIdInput.value?.trim();
    const isEdit = !!editId;
    const url = isEdit ? UPDATE_ROUTE(editId) : CREATE_ROUTE;
    const method = "POST"; // both create and update use POST in your backend

    showLoader();
    try {
      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          data.message || (isEdit ? "Safe ID updated" : "Safe ID created"),
          "success"
        );
        // After create/update: close popup and optionally update DOM
        popup.style.display = "none";
        form.reset();
        logoPreviewContainer.style.display = "none";
        logoPreview.src = "";
        logoInput.value = "";
        removeLogoFlag.value = "false";
        clearLogoBtn.style.display = "none";

        // fallback: reload
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast(data.message || "Failed to save Safe ID", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong", "error");
    } finally {
      hideLoader();
    }
  });

  // ===================== Load More =====================
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", async () => {
      if (loadingMore) return;
      loadingMore = true;
      loadingText && (loadingText.style.display = "block");
      loadMoreBtn.style.display = "none";

      try {
        const res = await fetch(
          `${LIST_ROUTE}?skip=${skip + limit}&limit=${limit}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(err.message || "Failed to load more", "error");
          loadingMore = false;
          loadingText && (loadingText.style.display = "none");
          loadMoreBtn.style.display = "block";
          return;
        }

        const result = await res.json();
        if (result && Array.isArray(result.data)) {
          const items = result.data;
          // append items
          items.forEach((s) => {
            const card = createSafeCard(s);
            mainContainer.appendChild(card);
          });

          // update skip
          skip += items.length;

          // if hasMore false, hide load more
          if (!result.hasMore) {
            loadMoreContainer && (loadMoreContainer.style.display = "none");
          } else {
            loadMoreBtn.style.display = "block";
          }
        } else {
          showToast("No more items", "info");
          loadMoreContainer && (loadMoreContainer.style.display = "none");
        }
      } catch (err) {
        console.error(err);
        showToast("Something went wrong while loading more", "error");
        loadMoreBtn.style.display = "block";
      } finally {
        loadingMore = false;
        loadingText && (loadingText.style.display = "none");
      }
    });
  }

  // ===================== Open edit from direct link (id query param) =====================
  function openEditFromId(id) {
    if (!id) return;
    // find button by data-id
    const btn = document.querySelector(`.edit-safeId-btn[data-id="${id}"]`);
    if (btn) {
      btn.click();
    } else {
      // If item not present (maybe paginated), fetch single doc and populate popup
      // We'll try to fetch list with skip=0 until found — fallback: reload page with larger limit
      // Simpler fallback: reload page (safe)
      console.warn("Safe ID not found in DOM, reloading to find it:", id);
      // add id to query string and reload (server should render it)
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      window.location.href = url.toString();
    }
  }

  // run if ?id=... present
  const urlParams = new URLSearchParams(window.location.search);
  const openId = urlParams.get("id");
  if (openId) {
    openEditFromId(openId);
  }
});
