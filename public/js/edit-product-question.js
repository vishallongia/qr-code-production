let selectedAppId = null;
let activeOptionBlock = null;
let cachedLogos = [];
let logosFetched = false;

async function fetchProductLogos() {
  if (logosFetched) return cachedLogos;

  try {
    const res = await fetch("/tvstation/product/comment-logos");
    cachedLogos = await res.json();
    logosFetched = true;
  } catch (err) {
    console.error("Error loading product logos:", err);
    cachedLogos = [];
  }

  return cachedLogos;
}

function createLogoSelectionContainer(previewImg) {
  const container = document.createElement("div");
  container.className = "quiz-option-logos";

  cachedLogos.forEach((src) => {
    const logoImg = document.createElement("img");
    logoImg.src = src;
    logoImg.className = "quiz-option-logo";
    container.appendChild(logoImg);
  });

  return container;
}

function setupImagePreviewAndClear(
  fileInput,
  previewImg,
  labelTextEl,
  clearBtn = null,
  existingImage = false,
  getClearedKeyFn = null
) {
  const originalName = fileInput.name;
  const originalClass = fileInput.className;
  const accept = fileInput.accept;
  const clearedInputField = document.getElementById("clearedImagesInput");

  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "✕";
    clearBtn.className = "quiz-clear-btn";
    fileInput.closest(".quiz-file-label").appendChild(clearBtn);
  }

  const showClear = () => (clearBtn.style.display = "inline-block");
  const hideClear = () => (clearBtn.style.display = "none");
  if (!existingImage) hideClear();

  const attachChangeHandler = (inputEl) => {
    inputEl.addEventListener("change", function () {
      const file = inputEl.files[0];
      if (file) {
        previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = "block";
        labelTextEl.textContent = file.name;
        showClear();

        const current = clearedInputField.value
          ? clearedInputField.value.split(",")
          : [];
        clearedInputField.value = current
          .filter((name) => name !== originalName)
          .join(",");
      }
    });
  };

  attachChangeHandler(fileInput);

  clearBtn.addEventListener("click", () => {
    const keyName = getClearedKeyFn ? getClearedKeyFn() : originalName;
    const current = clearedInputField.value
      ? clearedInputField.value.split(",")
      : [];
    if (!current.includes(keyName)) {
      current.push(keyName);
      clearedInputField.value = current.join(",");
    }

    const newInput = document.createElement("input");
    newInput.type = "file";
    newInput.className = originalClass;
    newInput.name = originalName;
    newInput.accept = accept;

    const labelContainer = fileInput.closest(".quiz-file-label");
    labelContainer.replaceChild(newInput, fileInput);
    fileInput = newInput;

    previewImg.src = "";
    previewImg.style.display = "none";
    labelTextEl.textContent = "Add Image";
    hideClear();

    attachChangeHandler(fileInput);
  });
}

function renumberOptions() {
  const blocks = document.querySelectorAll(".quiz-option-block");
  const select = document.getElementById("correct-answer-select");
  select.innerHTML = '<option value="">-- Select --</option>';
  blocks.forEach((block, index) => {
    block.querySelector("label").innerText = `Option ${index + 1}`;
    const option = document.createElement("option");
    option.value = index;
    option.innerText = `Option ${index + 1}`;
    select.appendChild(option);
  });
}

function enableOptionDragAndDrop() {
  const container = document.getElementById("option-blocks");
  let dragging = null;
  let lastTarget = null;

  container.addEventListener("dragstart", (e) => {
    const root = e.target.closest(".quiz-option-block");
    if (!root) return;
    dragging = root;
    dragging.classList.add("dragging");
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", ""); // Firefox
    } catch (err) {}
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragging) return;

    const x = e.clientX;
    const y = e.clientY;

    // Temporarily hide dragging element so elementFromPoint returns what's underneath
    const prevDisplay = dragging.style.display;
    dragging.style.display = "none";
    const under = document.elementFromPoint(x, y);
    dragging.style.display = prevDisplay || "";

    const hovered =
      under && under.closest && under.closest(".quiz-option-block");

    // If nothing hovered but cursor in container bounds -> append to end
    const containerRect = container.getBoundingClientRect();
    if (!hovered) {
      if (
        x >= containerRect.left &&
        x <= containerRect.right &&
        y >= containerRect.top &&
        y <= containerRect.bottom
      ) {
        container.appendChild(dragging);
      }
      if (lastTarget) {
        lastTarget.classList.remove("drop-target");
        lastTarget = null;
      }
      return;
    }

    // don't act when hovered is the dragging element itself
    if (hovered === dragging) return;

    // compute cursor delta from hovered center
    const r = hovered.getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;

    // Determine dominant axis: horizontal if |dx| > |dy|, else vertical
    let placeBefore = false;
    if (Math.abs(dx) > Math.abs(dy)) {
      // horizontal decision
      placeBefore = dx < 0;
    } else {
      // vertical decision
      placeBefore = dy < 0;
    }

    if (placeBefore) {
      container.insertBefore(dragging, hovered);
    } else {
      container.insertBefore(dragging, hovered.nextElementSibling);
    }

    // visual highlight
    if (lastTarget && lastTarget !== hovered) {
      lastTarget.classList.remove("drop-target");
    }
    hovered.classList.add("drop-target");
    lastTarget = hovered;
  });

  container.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || !container.contains(e.relatedTarget)) {
      if (lastTarget) {
        lastTarget.classList.remove("drop-target");
        lastTarget = null;
      }
    }
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();
    if (lastTarget) {
      lastTarget.classList.remove("drop-target");
      lastTarget = null;
    }
    if (dragging) dragging.classList.remove("dragging");
    dragging = null;
    renumberOptions();
  });

  container.addEventListener("dragend", () => {
    if (lastTarget) {
      lastTarget.classList.remove("drop-target");
      lastTarget = null;
    }
    if (dragging) dragging.classList.remove("dragging");
    dragging = null;
    renumberOptions();
  });
}

function initOptionBlock(block) {
  const input = block.querySelector('input[type="file"]');
  const label = block.querySelector(".quiz-file-label-text");
  const img = block.querySelector("img.preview-img");
  const hasImage =
    img?.src && !img.src.endsWith("/") && img.style.display !== "none";

  setupImagePreviewAndClear(
    input,
    img,
    label,
    null,
    hasImage,
    () => block.dataset.optionId || block.dataset.newKey
  );

  const deleteBtn = block.querySelector(".quiz-option-delete-btn");
  deleteBtn?.addEventListener("click", () => {
    const total = document.querySelectorAll(".quiz-option-block").length;
    if (total > 1) {
      const optionId = block.dataset.optionId;
      if (optionId) {
        const clearedOptionsInput = document.getElementById("clearedOptions");
        const current = clearedOptionsInput.value
          ? clearedOptionsInput.value.split(",")
          : [];
        if (!current.includes(optionId)) {
          current.push(optionId);
          clearedOptionsInput.value = current.join(",");
        }
      }
      block.remove();
      renumberOptions();
    } else {
      alert("Minimum 2 options required.");
    }
  });
}

function addOptionBlock(text = "", imageUrl = "", description = "", link = "") {
  const block = document.createElement("div");
  block.className = "quiz-option-block";
  block.setAttribute("draggable", "true"); // ✅ makes dragstart work
  const newKey = `newOption-${Date.now()}`;
  block.dataset.newKey = newKey;

  const index = document.querySelectorAll(".quiz-option-block").length;
  block.innerHTML = `
    <div class="quiz-option-inner">
      <label>Option ${index + 1}</label>

      <input type="text" name="optionTexts[]" value="${text}" placeholder="Name of Product" required />
      <input type="text" name="optionDescriptions[]" value="${description}" placeholder="Enter Product Description" />
      <input type="url" name="optionLinks[]" value="${link}" placeholder="Product Link" />

      <div class="quiz-logo-and-preview-wrapper" style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
      <img class="quiz-selected-logo-preview" style="display:none; max-width:150px; margin-top:6px;" />
        <div class="quiz-option-logos" style="display: none;"></div>
        <label class="quiz-file-label" style="align-self:flex-start;">
          <span class="quiz-file-label-text">${
            imageUrl ? imageUrl.split("/").pop() : "Add Image"
          }</span>
          <input type="file" name="optionImages" class="quiz-hidden-file quiz-option-image-input" accept="image/*" />
        </label>
      </div>

      <button type="button" class="quiz-option-delete-btn">✕</button>
    </div>
  `;

  const previewImg = block.querySelector(".quiz-selected-logo-preview");
  const logoContainer = createLogoSelectionContainer(previewImg);
  const logoWrapper = block.querySelector(".quiz-option-logos");
  logoWrapper.replaceWith(logoContainer);

  setupUnifiedPreview(block);
  initOptionBlock(block);

  document.getElementById("option-blocks").appendChild(block);
  renumberOptions();
}

async function initExistingOptionBlocks() {
  const blocks = document.querySelectorAll(".quiz-option-block");

  for (const block of blocks) {
    // If the block doesn’t yet have logo container, add it
    if (!block.querySelector(".quiz-option-logos")) {
      const previewImg = block.querySelector(".quiz-selected-logo-preview");
      if (previewImg) {
        const logoContainer = await createLogoSelectionContainer(previewImg);
        previewImg.before(logoContainer);
      }
    }
    setupUnifiedPreview(block);
    initOptionBlock(block);
  }
}

document.getElementById("btn-add-option").addEventListener("click", () => {
  addOptionBlock();
});

["logo", "questionImage", "questionLogo"].forEach((name) => {
  const input = document.querySelector(`input[name="${name}"]`);
  const label = input
    ?.closest(".quiz-file-label")
    ?.querySelector(".quiz-file-label-text");
  const img = input
    ?.closest(".quiz-form-group")
    ?.querySelector("img.preview-img");
  const hasImage =
    img?.src && !img.src.endsWith("/") && img.style.display !== "none";
  if (input && label && img)
    setupImagePreviewAndClear(input, img, label, null, hasImage);
});

document
  .getElementById("edit-question-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const cleared = document
      .getElementById("clearedImagesInput")
      .value.split(",")
      .filter(Boolean);
    const clearedOptions = document
      .getElementById("clearedOptions")
      .value.split(",")
      .filter(Boolean);
    const formData = new FormData();

    // ✅ Collect active media profiles
    const activeProfiles = Array.from(
      document.querySelectorAll(
        '.quiz-media-profile-toggles input[type="checkbox"][name="logoMediaProfile[]"]:checked'
      )
    ).map((checkbox) => checkbox.value);

    // Append all active profiles to FormData
    activeProfiles.forEach((profile) => {
      formData.append("logoMediaProfile[]", profile);
    });

    form.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el.type === "file" || el.type === "checkbox") return; // ✅ skip
      formData.append(el.name, el.value);
    });

    ["logo", "questionImage", "questionLogo"].forEach((name) => {
      const input = form.querySelector(`input[name="${name}"]`);
      const isCleared = cleared.includes(name);
      if (input?.files[0] && !isCleared) {
        formData.append(name, input.files[0]);
      }
    });

    const optionBlocks = document.querySelectorAll(".quiz-option-block");
    const optionsArray = [];

    optionBlocks.forEach((block) => {
      const text = block.querySelector('input[type="text"]').value.trim();
      const description = block
        .querySelector('input[name="optionDescriptions[]"]')
        .value.trim();
      const link = block
        .querySelector('input[name="optionLinks[]"]')
        .value.trim();
      const fileInput = block.querySelector("input[type='file']");
      const img = block.querySelector("img.preview-img");
      const optionId = block.dataset.optionId || block.dataset.newKey;
      const newFile = fileInput?.files?.[0];
      const isCleared = cleared.includes(optionId);

      // 🧩 Detect selected logo (if any)
      // 🧩 Detect selected logo (if any)
      const activeLogo = block.querySelector(".quiz-option-logo.active-logo");
      let selectedLogoSrc = "";

      if (activeLogo) {
        try {
          const url = new URL(activeLogo.src);
          selectedLogoSrc = url.pathname; // ✅ only "/product-logos/LinkedIn.png"
        } catch {
          // If it's already relative (no host)
          selectedLogoSrc = activeLogo.src;
        }
      }

      optionsArray.push({
        _id: optionId,
        text,
        description,
        link,
        imageName:
          !newFile && !isCleared && img?.src && !img.src.startsWith("blob:")
            ? img.src.split("/").pop()
            : "",
        selectedLogoSrc, // ✅ now always relative
      });

      if (newFile && !isCleared) {
        formData.append("optionsImages", newFile);
        formData.append("optionIds", optionId);
      }
    });

    formData.append("options", JSON.stringify(optionsArray));
    formData.append("clearedImages", cleared.join(","));

        // ✅ Convert FormData to plain object for logging
    const formDataObj = {};
    formData.forEach((value, key) => {
      if (formDataObj[key]) {
        if (!Array.isArray(formDataObj[key])) {
          formDataObj[key] = [formDataObj[key]];
        }
        formDataObj[key].push(value);
      } else {
        formDataObj[key] = value;
      }
    });

        console.log("🧩 DEBUG: FormData JSON payload:");
    console.log(JSON.stringify(formDataObj, null, 2));


    const loader = document.getElementById("loader");
    loader.style.display = "flex";

    try {
      const response = await fetch(
        "/tvstation/product/product-question/update",
        {
          method: "POST",
          body: formData,
        }
      );
      const result = await response.json();
      if (result.type === "success") {
        showToast(result.message || "Question updated successfully", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        showToast(result.message || "Update failed", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Server error", "error");
    } finally {
      loader.style.display = "none";
    }
  });

function setupMediaProfileToggles() {
  const toggles = document.querySelectorAll(
    '.quiz-media-profile-toggles input[name="logoMediaProfile[]"]'
  );
  const logoParentContainer = document.getElementById("logoParentContainer");
  const editBroadcaster = document.getElementById("edit-broadcaster");

  if (!logoParentContainer) return; // safety check

  // Helper to show/hide based on "custom" checkbox
  function updateVisibility() {
    const customToggle = document.querySelector(
      'input[name="logoMediaProfile[]"][value="custom"]'
    );
    logoParentContainer.style.display = customToggle?.checked
      ? "block"
      : "none";
  }

  // Handle "custom" checkbox toggle
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      if (toggle.value === "custom") updateVisibility();
    });
  });

  // Handle edit-broadcaster click to toggle container visibility
  if (editBroadcaster) {
    editBroadcaster.addEventListener("click", () => {
      logoParentContainer.style.display =
        logoParentContainer.style.display === "none" ||
        logoParentContainer.style.display === ""
          ? "block"
          : "none";
    });
  }

  // Initialize correct state on page load
  updateVisibility();
}

function setupUnifiedPreview(optDiv) {
  const fileInput = optDiv.querySelector(
    ".quiz-option-image-input, .option-image-input"
  );
  const fileLabelText = optDiv.querySelector(".quiz-file-label-text");
  const logoContainer = optDiv.querySelector(".quiz-option-logos");
  const previewImg = optDiv.querySelector(".quiz-selected-logo-preview");

  if (!fileInput || !logoContainer || !previewImg) return;

  // Wrap preview in container
  let wrapper = previewImg.parentElement;
  if (!wrapper.classList.contains("quiz-preview-wrapper")) {
    const newWrapper = document.createElement("div");
    newWrapper.className = "quiz-preview-wrapper";
    newWrapper.style.position = "relative";
    newWrapper.style.display = "inline-block";
    previewImg.parentElement.insertBefore(newWrapper, previewImg);
    newWrapper.appendChild(previewImg);
    wrapper = newWrapper;
  }

  logoContainer.style.display = "none";

  // Create or find clear button
  let clearBtn = wrapper.querySelector(".quiz-clear-btn-preview");
  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "quiz-clear-btn quiz-clear-btn-preview";
    clearBtn.innerText = "✕";
    clearBtn.style.position = "absolute";
    clearBtn.style.top = "0";
    clearBtn.style.right = "0";
    clearBtn.style.display = "none";
    wrapper.appendChild(clearBtn);
  }

  const showClear = () => (clearBtn.style.display = "block");
  const hideClear = () => (clearBtn.style.display = "none");

  function clearAll() {
    previewImg.src = "";
    previewImg.style.display = "none";
    fileInput.value = "";
    fileLabelText.textContent = "Add Image";
    logoContainer
      .querySelectorAll(".active-logo")
      .forEach((el) => el.classList.remove("active-logo"));
    hideClear();

    // 🧩 Mark this option's image as cleared for backend
    const clearedInputField = document.getElementById("clearedImagesInput");
    if (clearedInputField) {
      const keyName =
        optDiv.dataset.optionId || optDiv.dataset.newKey || "unknownOption";
      const current = clearedInputField.value
        ? clearedInputField.value.split(",")
        : [];
      if (!current.includes(keyName)) {
        current.push(keyName);
        clearedInputField.value = current.join(",");
      }
    }
  }

  // Show clear if prepopulated image
  if (previewImg.src && !previewImg.src.endsWith("/")) {
    showClear();
  }

  // 🧩 File input change
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      // remove active logo if a new file chosen
      logoContainer
        .querySelectorAll(".active-logo")
        .forEach((el) => el.classList.remove("active-logo"));
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
      fileLabelText.textContent = file.name;
      showClear();
      // ✅ FIX: remove from cleared list so backend doesn't delete new upload
      const clearedInputField = document.getElementById("clearedImagesInput");
      if (clearedInputField) {
        const keyName =
          optDiv.dataset.optionId || optDiv.dataset.newKey || "unknownOption";
        const current = clearedInputField.value
          ? clearedInputField.value.split(",")
          : [];
        clearedInputField.value = current
          .filter((name) => name !== keyName)
          .join(",");
      }
    } else {
      clearAll();
    }
  });

  // 🧩 Logo click
  logoContainer.querySelectorAll(".quiz-option-logo").forEach((logo) => {
    logo.addEventListener("click", () => {
      const isActive = logo.classList.contains("active-logo");

      // Clear any file when selecting logo
      fileInput.value = "";
      fileLabelText.textContent = "Add Image";

      // Remove all active logos
      logoContainer
        .querySelectorAll(".active-logo")
        .forEach((el) => el.classList.remove("active-logo"));

      if (!isActive) {
        logo.classList.add("active-logo");
        previewImg.src = logo.src;
        previewImg.style.display = "block";
        showClear();
        // ✅ FIX: remove from cleared list so backend keeps selected logo
        const clearedInputField = document.getElementById("clearedImagesInput");
        if (clearedInputField) {
          const keyName =
            optDiv.dataset.optionId || optDiv.dataset.newKey || "unknownOption";
          const current = clearedInputField.value
            ? clearedInputField.value.split(",")
            : [];
          clearedInputField.value = current
            .filter((name) => name !== keyName)
            .join(",");
        }
      } else {
        clearAll();
      }
    });
  });

  clearBtn.addEventListener("click", clearAll);
}

document.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loader");
  loader.style.display = "flex";
  try {
    await fetchProductLogos(); // Load logos once

    document.querySelectorAll(".quiz-option-block").forEach((block) => {
      // Ensure preview image exists (create if missing)
      let previewImg = block.querySelector(".quiz-selected-logo-preview");
      if (!previewImg) {
        previewImg = document.createElement("img");
        previewImg.className = "quiz-selected-logo-preview";
        previewImg.style.display = "none";
        previewImg.style.maxWidth = "150px";
        previewImg.style.marginTop = "10px";
        // place it before delete button if available, else append
        const deleteBtn = block.querySelector(".quiz-option-delete-btn");
        if (deleteBtn) block.insertBefore(previewImg, deleteBtn);
        else block.appendChild(previewImg);
      }

      // Ensure logos container exists (create if missing)
      let logosContainer = block.querySelector(".quiz-option-logos");
      if (!logosContainer) {
        logosContainer = document.createElement("div");
        logosContainer.className = "quiz-option-logos";
        // insert before previewImg so preview sits after logos
        previewImg.before(logosContainer);
      }

      // read server-provided selected logo path if any (EJS put it in data attribute)
      const selectedLogo = logosContainer.dataset.selectedLogo || null;

      // populate logos from cachedLogos (already fetched)
      logosContainer.innerHTML = "";
      cachedLogos.forEach((src) => {
        const logoImg = document.createElement("img");
        logoImg.src = src;
        logoImg.className = "quiz-option-logo";
        // mark active + set preview if this matches selectedLogo
        if (selectedLogo && src === selectedLogo) {
          logoImg.classList.add("active-logo");
          previewImg.src = src;
          previewImg.style.display = "block";
        }
        logosContainer.appendChild(logoImg);
      });

      

      // Now wire unified preview + file handling
      setupUnifiedPreview(block);
      initOptionBlock(block);

      // Immediately show clear button if preview or active logo exists
      const clearBtn = block.querySelector(".quiz-clear-btn-preview");
      if (
        clearBtn &&
        ((previewImg.src && !previewImg.src.endsWith("/")) ||
          block.querySelector(".quiz-option-logo.active-logo"))
      ) {
        clearBtn.style.display = "block";
      }
    });

    setupMediaProfileToggles();
    document
      .querySelectorAll(".quiz-option-block")
      .forEach((b) => b.setAttribute("draggable", "true"));

    // 🧩 Enable drag & drop reordering
    enableOptionDragAndDrop();
  } catch (error) {
    console.error("❌ Error during initialization:", error);
    alert(
      `An error occurred while loading the editor.\n\nDetails: ${error.message}`
    );
  } finally {
    loader.style.display = "none";
  }
});
