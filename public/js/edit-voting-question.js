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
  document.querySelectorAll(".quiz-option-block").forEach((block, index) => {
    block.querySelector("label").innerText = `Option ${index + 1}`;
  });
}

function initOptionBlock(block) {
  if (!block.dataset.optionId)
    block.dataset.optionId = `option-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;
  const optionId = block.dataset.optionId;

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
    () => `optionImage-${optionId}`
  );

  const deleteBtn = block.querySelector(".quiz-option-delete-btn");
  deleteBtn?.addEventListener("click", () => {
    const total = document.querySelectorAll(".quiz-option-block").length;
    if (total > 2) {
      const clearedInputField = document.getElementById("clearedImagesInput");
      const current = clearedInputField.value
        ? clearedInputField.value.split(",")
        : [];
      const keyName = `optionImage-${optionId}`;
      if (!current.includes(keyName)) current.push(keyName);
      clearedInputField.value = current.join(",");

      // --- Minimal change ---
      const clearedOptionsField = document.getElementById("clearedOptions");
      const clearedOptions = clearedOptionsField.value
        ? clearedOptionsField.value.split(",")
        : [];
      clearedOptions.push(optionId);
      clearedOptionsField.value = clearedOptions.join(",");

      block.remove();
      renumberOptions();
    } else {
      alert("Minimum 2 options required.");
    }
  });
}

function addOptionBlock(text = "", imageUrl = "", optionId = null) {
  const block = document.createElement("div");
  block.className = "quiz-option-block";
  block.dataset.optionId =
    optionId || `option-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const index = document.querySelectorAll(".quiz-option-block").length;

  block.innerHTML = `
<label>Option ${index + 1}</label>
<input type="text" name="optionTexts[]" value="${text}" required />
<input type="text" name="optionDescriptions[]" value="" 
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

document
  .getElementById("btn-add-option")
  .addEventListener("click", () => addOptionBlock());

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
      if (el.type === "file" || el.type === "checkbox") return; // skip files and checkboxes
      if (el.name !== "optionTexts[]") formData.append(el.name, el.value);
    });

    // Append main images if not cleared
    [
      "logo",
      "questionImage",
      "jackpotRewardImage",
      "digitalRewardImage",
    ].forEach((name) => {
      const input = form.querySelector(`input[name="${name}"]`);
      if (input?.files[0] && !cleared.includes(name)) {
        formData.append(name, input.files[0]);
      }
    });

    // Prepare options array and append option files
    const optionBlocks = document.querySelectorAll(".quiz-option-block");
    const optionsArray = [];

    optionBlocks.forEach((block) => {
      const optionId = block.dataset.optionId;
      const textInput = block.querySelector('input[type="text"]');
      const descInput = block.querySelector(
        'input[name="optionDescriptions[]"]'
      );
      const fileInput = block.querySelector("input[type='file']");
      const img = block.querySelector("img.preview-img");

      // Determine imageName
      let imageName = "";
      if (
        fileInput?.files?.[0] &&
        !cleared.includes(`optionImage-${optionId}`)
      ) {
        formData.append("optionsImages", fileInput.files[0]); // file
        formData.append("optionIds", optionId); // matching id
        imageName = fileInput.files[0].name;
      } else if (
        !fileInput?.files?.[0] &&
        !cleared.includes(`optionImage-${optionId}`) &&
        img?.src &&
        !img.src.startsWith("blob:")
      ) {
        imageName = img.src.split("/").pop();
      }

      optionsArray.push({
        _id: optionId, // Use this as _id so backend knows which option
        text: textInput.value.trim(),
        description: descInput?.value.trim() || "",
        imageName,
      });
    });

    formData.append("options", JSON.stringify(optionsArray));

    // Append cleared images as CSV
    formData.append("clearedImages", cleared.join(","));

    // Submit form
    const loader = document.getElementById("loader");
    loader.style.display = "flex";
    try {
      const response = await fetch("/tvstation/voting-question/update", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      showToast(result.message || "success");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      // Optionally show a toast here
    } catch (err) {
      console.error("Error submitting form:", err);
      console.log(err);
      showToast(result.message || "Something went wrong", "error");
    } finally {
      loader.style.display = "none";
    }
  });

// Reward mode
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
}

// Call it on page load to attach click listeners only
document.addEventListener("DOMContentLoaded", setupMediaProfileToggles);
