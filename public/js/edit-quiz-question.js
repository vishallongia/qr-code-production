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
    labelTextEl.textContent = "Choose Image";
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
    if (total > 2) {
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

function addOptionBlock(text = "", imageUrl = "", description = "") {
  const block = document.createElement("div");
  block.className = "quiz-option-block";

  const newKey = `newOption-${Date.now()}`;
  block.dataset.newKey = newKey;

  const index = document.querySelectorAll(".quiz-option-block").length;
  block.innerHTML = `
<label>Option ${index + 1}</label>
<input type="text" name="optionTexts[]" value="${text}" required />
<!-- ✅ New -->
<input type="text" name="optionDescriptions[]" value="${description}" 
       placeholder="Enter option description (optional)" />

<label class="quiz-file-label">
    <span class="quiz-file-label-text">${
      imageUrl ? imageUrl.split("/").pop() : "Choose Image"
    }</span>
    <input type="file" name="optionsImages" class="quiz-hidden-file option-image-input" accept="image/*" />
</label>
<img class="preview-img" style="display: ${
    imageUrl ? "block" : "none"
  };" src="${imageUrl || ""}" />
<button type="button" class="quiz-clear-btn" style="display: ${
    imageUrl ? "inline-block" : "none"
  };">✕</button>
<button type="button" class="quiz-option-delete-btn">✕</button>
`;

  initOptionBlock(block);
  document.getElementById("option-blocks").appendChild(block);
  renumberOptions();
}

function initExistingOptionBlocks() {
  document.querySelectorAll(".quiz-option-block").forEach(initOptionBlock);
}

document.getElementById("btn-add-option").addEventListener("click", () => {
  addOptionBlock();
});

[
  "logo",
  "questionImage",
  "questionLogo",
  "jackpotRewardImage",
  "digitalRewardImage",
].forEach((name) => {
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

initExistingOptionBlocks();

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

    const showLogoToggle = document.getElementById("showLogoToggle");
    formData.set("showLogoSection", showLogoToggle.checked ? "true" : "false");
    // formData.append("logoMediaProfile", logoMediaProfile);

    [
      "logo",
      "questionImage",
      "questionLogo",
      "jackpotRewardImage",
      "digitalRewardImage",
    ].forEach((name) => {
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
      const fileInput = block.querySelector("input[type='file']");
      const img = block.querySelector("img.preview-img");
      const optionId = block.dataset.optionId || block.dataset.newKey;
      const newFile = fileInput?.files?.[0];
      const isCleared = cleared.includes(optionId);

      optionsArray.push({
        _id: block.dataset.optionId || optionId,
        text,
        description, // ✅ new field
        imageName:
          !newFile && !isCleared && img?.src && !img.src.startsWith("blob:")
            ? img.src.split("/").pop()
            : "",
      });

      if (newFile && !isCleared) {
        formData.append("optionsImages", newFile);
        formData.append("optionIds", optionId);
      }
    });

    formData.append("options", JSON.stringify(optionsArray));
    formData.append("clearedImages", cleared.join(","));

    const loader = document.getElementById("loader");
    loader.style.display = "flex";

    try {
      const response = await fetch("/tvstation/quiz-question/update", {
        method: "POST",
        body: formData,
      });
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

function setupRewardModeSwitcher(block) {
  const modeButtons = block.querySelectorAll(".reward-mode-btn");
  const modeInput = block.querySelector('input[name="mode"]');
  const jackpotField = block.querySelector(".reward-jackpot");
  const digitalField = block.querySelector(".reward-digital");
  const currentMode = modeInput?.value || "jackpot";
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      modeInput.value = mode;
      jackpotField.style.display =
        mode === "jackpot" || mode === "both" ? "block" : "none";
      digitalField.style.display =
        mode === "digital" || mode === "both" ? "block" : "none";
      jackpotField.querySelectorAll('input[type="number"]').forEach((el) => {
        if (mode === "none" || mode === "digital") {
          el.required = false;
          el.removeAttribute("min");
          el.value = "";
        } else {
          el.required = jackpotField.style.display !== "none";
          el.setAttribute("min", "10");
        }
      });

      digitalField.querySelectorAll('input[type="number"]').forEach((el) => {
        if (mode === "none" || mode === "jackpot") {
          el.required = false;
          el.removeAttribute("min");
          el.value = "";
        } else {
          el.required = digitalField.style.display !== "none";
          el.setAttribute("min", "10");
        }
      });

      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
    if (btn.dataset.mode === currentMode) btn.classList.add("active");
  });
  jackpotField.style.display =
    currentMode === "jackpot" || currentMode === "both" ? "block" : "none";
  digitalField.style.display =
    currentMode === "digital" || currentMode === "both" ? "block" : "none";
}

document.querySelectorAll(".reward-block").forEach(setupRewardModeSwitcher);

function setupMediaProfileToggles() {
  const toggles = document.querySelectorAll(
    '.quiz-media-profile-toggles input[type="checkbox"][name="logoMediaProfile[]"]'
  );
  const logoParentContainer = document.getElementById("logoParentContainer");

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      // Show/hide custom logo container if "custom" checkbox is toggled
      if (toggle.value === "custom") {
        logoParentContainer.style.display = toggle.checked ? "block" : "none";
      }
    });
  });

  // Handle edit button behavior
  const editBroadcaster = document.getElementById("edit-broadcaster");
  if (editBroadcaster) {
    editBroadcaster.addEventListener("click", () => {
      logoParentContainer.style.display =
        logoParentContainer.style.display === "none" ||
        logoParentContainer.style.display === ""
          ? "block"
          : "none";
    });
  }
}

// Call it on page load to attach click listeners only
document.addEventListener("DOMContentLoaded", setupMediaProfileToggles);
