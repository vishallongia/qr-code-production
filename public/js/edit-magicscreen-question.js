let selectedAppId = null;
let activeOptionBlock = null;
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

  const newKey = `newOption-${Date.now()}`;
  block.dataset.newKey = newKey;

  const index = document.querySelectorAll(".quiz-option-block").length;
  block.innerHTML = `
        <label>Option ${index + 1}</label>

        <!-- Hidden real inputs -->
        <label class="quiz-file-label" style="display: none;">
            <span class="quiz-file-label-text">${
              imageUrl ? imageUrl.split("/").pop() : "Choose Image"
            }</span>
            <input type="file" name="optionImages" class="quiz-hidden-file option-image-input" accept="image/*" />
        </label>

        <input type="text" name="optionTexts[]" value="${text}" placeholder="Option Text" required style="display: none;" />
        <input type="text" name="optionDescriptions[]" value="${description}" placeholder="Option Description" style="display: none;" />
        <input type="url" name="optionLinks[]" value="${link}" placeholder="Enter URL for this option" style="display: none;" />

        <button type="button" class="btn-select-app quiz-file-label" data-option-id="${newKey}" style="display: none;">Add Event</button>

        <!-- ✕ delete -->
        <button type="button" class="quiz-option-delete-btn">✕</button>

        <!-- Summary block -->
        <div class="summary-block">
            ${
              imageUrl
                ? `<img class="summary-img" src="${imageUrl}" style="display:block;width:120px;border-radius:10px;margin-bottom:8px;" />`
                : ""
            }
            ${(() => {
              let appName = "";
              if (link) {
                const parts = link.split("/").filter(Boolean);
                const lastSegment = parts.pop() || "";
                appName = lastSegment.endsWith("-play")
                  ? lastSegment.replace("-play", "")
                  : lastSegment;
                appName = appName.charAt(0).toUpperCase() + appName.slice(1);
              }
              return appName
                ? `<p class='summary-app-name'><strong>App:</strong> ${appName}</p>`
                : "";
            })()}
            ${
              text
                ? `<p class='summary-text'><strong>Question:</strong> ${text}</p>`
                : ""
            }
            ${
              description
                ? `<p class='summary-desc'><strong>Description:</strong> ${description}</p>`
                : ""
            }
            ${
              link
                ? `<div class="summary-link-wrapper"><button type="button" class="summary-link quiz-file-label">Open Front Screen</button></div>`
                : ""
            }
            <button type="button" class="btn-select-app quiz-file-label" data-option-id="${newKey}">Add Event</button>
        </div>
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

      optionsArray.push({
        _id: block.dataset.optionId || optionId,
        text,
        description,
        link, // ✅ include link
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
      const response = await fetch(
        "/tvstation/magicscreen/magicscreen-question/update",
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

window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loader");
  loader.style.display = "flex";

  const sessionId = document.querySelector('input[name="sessionId"]').value;
  const popupContainer = document.getElementById("app-card-container");

  try {
    const res = await fetch(`/tvstation/${sessionId}/apps`);
    const result = await res.json();

    if (result.success) {
      const {
        quizQuestion,
        voteQuestion,
        applauseQuestion,
        magicScreenQuestion,
      } = result.data;
      const questions = [
        quizQuestion,
        voteQuestion,
        applauseQuestion,
        magicScreenQuestion,
      ];
      popupContainer.innerHTML = "";

      questions.forEach((q, idx) => {
        if (q && (q.question || q.questionImage)) {
          const card = document.createElement("div");
          card.className = "app-card";
          card.dataset.questionId = q._id;
          card.dataset.question = q.question || "";
          card.dataset.questionImage = q.questionImage || "";
          card.dataset.questionLink = q.link || "";
          card.dataset.appName = q.name || "N/A";

          card.innerHTML = `
                         <div class="app-name">${card.dataset.appName}</div>
                        <img src="${
                          q.questionImage || "/images/default.png"
                        }" alt="App Preview" />
                        <span>${q.question || `App ${idx + 1}`}</span>
                    `;

          card.addEventListener("click", () => {
            popupContainer
              .querySelectorAll(".app-card")
              .forEach((c) => c.classList.remove("active"));
            card.classList.add("active");
            selectedAppId = q._id;
            // Show selected app name at the top (optional)
            const selectedAppNameElem =
              document.getElementById("selected-app-name");
            selectedAppNameElem.textContent = card.dataset.appName;
          });

          popupContainer.appendChild(card);
        }
      });
    }
  } catch (err) {
    console.error("Error fetching apps:", err);
    showToast("Error loading apps", "error");
  } finally {
    loader.style.display = "none";
  }
});

// open popup
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-select-app")) {
    const popup = document.getElementById("app-selection-popup");
    popup.style.display = "flex";
    activeOptionBlock = e.target.closest(".quiz-option-block");
  }
});

// close popup
document
  .getElementById("popup-cancel-btn-select-app")
  .addEventListener("click", () => {
    document.getElementById("app-selection-popup").style.display = "none";
  });

// select app and populate
document
  .getElementById("popup-ok-btn-select-app")
  .addEventListener("click", async () => {
    const popup = document.getElementById("app-selection-popup");
    const selectedCard = document.querySelector(".app-card.active");
    if (!selectedCard) {
      alert("Please select an app first.");
      return;
    }

    if (!activeOptionBlock) {
      alert("No active option block found.");
      return;
    }

    const questionImage = selectedCard.dataset.questionImage;
    const questionText = selectedCard.dataset.question;
    const questionLink = selectedCard.dataset.questionLink;

    const textInput = activeOptionBlock.querySelector(
      'input[name="optionTexts[]"]'
    );
    const linkInput = activeOptionBlock.querySelector(
      'input[name="optionLinks[]"]'
    );
    const fileInput = activeOptionBlock.querySelector('input[type="file"]');
    const labelTextEl = activeOptionBlock.querySelector(
      ".quiz-file-label-text"
    );
    const previewImg = activeOptionBlock.querySelector("img.preview-img");

    // Set text and link
    if (textInput) textInput.value = questionText;
    if (linkInput) linkInput.value = questionLink;

    if (questionImage) {
      try {
        const response = await fetch(questionImage);
        const blob = await response.blob();
        const file = new File([blob], questionImage.split("/").pop(), {
          type: blob.type,
        });

        // Replace file input with new File
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Update label + preview
        labelTextEl.textContent = file.name;
        previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = "block";
        // ✅ Add this block here to restore clear button
        let clearBtn = activeOptionBlock.querySelector(".quiz-clear-btn");
        if (!clearBtn) {
          clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.textContent = "✕";
          clearBtn.className = "quiz-clear-btn";
          fileInput.closest(".quiz-file-label").appendChild(clearBtn);
        }
        clearBtn.style.display = "inline-block";
      } catch (err) {
        console.error("Error loading image:", err);
      }
    }

    const summaryBlock = activeOptionBlock.querySelector(".summary-block");
    if (summaryBlock) {
      // Clear previous summary
      summaryBlock.innerHTML = "";

      // Extract app name
      const parts = questionLink.split("/").filter(Boolean);
      const lastSegment = parts.pop() || "";
      let appName = lastSegment.endsWith("-play")
        ? lastSegment.replace("-play", "")
        : lastSegment;
      appName = appName.charAt(0).toUpperCase() + appName.slice(1);

      // Image
      if (questionImage) {
        const img = document.createElement("img");
        img.className = "summary-img";
        img.src = questionImage;
        img.style.cssText =
          "display:block;width:120px;border-radius:10px;margin-bottom:8px;";
        summaryBlock.appendChild(img);
      }

      // App Name
      const appEl = document.createElement("p");
      appEl.className = "summary-app-name";
      appEl.innerHTML = `<strong>App:</strong> ${appName}`;
      summaryBlock.appendChild(appEl);

      // Question
      const textEl = document.createElement("p");
      textEl.className = "summary-text";
      textEl.innerHTML = `<strong>Question:</strong> ${questionText}`;
      summaryBlock.appendChild(textEl);

      // Link button inside a div
      if (questionLink) {
        const linkWrapper = document.createElement("div"); // create div wrapper
        const linkBtn = document.createElement("button");
        linkBtn.type = "button";
        linkBtn.className = "summary-link quiz-file-label";
        linkBtn.textContent = "Open Front Screen";
        linkBtn.onclick = () => window.open(questionLink, "_blank");
        linkWrapper.appendChild(linkBtn); // append button to div
        summaryBlock.appendChild(linkWrapper); // append div to summary
        const br = document.createElement("br"); // create a line break
        summaryBlock.appendChild(br); // append after the div
      }

      // Select App button (for reselecting)
      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "btn-select-app quiz-file-label";
      selectBtn.dataset.optionId = activeOptionBlock.dataset.newKey;
      selectBtn.textContent = "Add Event";
      summaryBlock.appendChild(selectBtn);
    }

    popup.style.display = "none";
  });

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
