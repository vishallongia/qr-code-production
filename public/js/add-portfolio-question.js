const wrapper = document.getElementById("questions-wrapper");
const template = document.getElementById("question-template");

// Global state references (you can keep these shared)
let activeOptionBlock = null;
let selectedAppId = null;

function setupImagePreview(block) {
  const fileInputs = [
    {
      selector: ".quiz-questionImage",
      previewSelector: ".quiz-questionImagePreview",
    },
    {
      selector: ".quiz-questionLogo",
      previewSelector: ".quiz-questionLogoPreview",
    },
    { selector: ".quiz-logoImage", previewSelector: ".quiz-logoImagePreview" },
  ];

  fileInputs.forEach(({ selector, previewSelector }) => {
    const fileInput = block.querySelector(selector);
    const previewImg = block.querySelector(previewSelector);
    const labelText = fileInput?.previousElementSibling;
    const clearBtn = document.createElement("button");

    clearBtn.type = "button";
    clearBtn.innerText = "✕";
    clearBtn.className = "quiz-clear-btn";
    fileInput.parentElement.appendChild(clearBtn);

    fileInput?.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = "block";
        labelText.textContent = file.name;
        clearBtn.style.display = "inline-block";
      }
    });

    clearBtn.addEventListener("click", () => {
      fileInput.value = "";
      previewImg.src = "";
      previewImg.style.display = "none";
      labelText.textContent = "Choose File";
      clearBtn.style.display = "none";
    });

    clearBtn.style.display = "none"; // Initially hidden
  });
}

function setupRewardModeSwitcher(block) {
  const modeButtons = block.querySelectorAll(".reward-mode-btn");
  const modeInput = block.querySelector('input[name="mode"]');
  const jackpotField = block.querySelector(".reward-jackpot");
  const digitalField = block.querySelector(".reward-digital");

  function clearFields(field) {
    field
      .querySelectorAll(
        'input[type="text"], input[type="number"], input[type="url"], input[type="file"]'
      )
      .forEach((input) => {
        input.value = "";
        if (input.type === "file") {
          input.value = "";
          const labelText = input.parentElement.querySelector(
            ".quiz-file-label-text"
          );
          if (labelText) labelText.textContent = "Choose File";
          const clearBtn = input.parentElement.querySelector(".quiz-clear-btn");
          if (clearBtn) clearBtn.style.display = "none";
          const preview = block.querySelector(`.${input.classList[0]}Preview`);
          if (preview) {
            preview.src = "";
            preview.style.display = "none";
          }
        }
      });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      modeInput.value = mode;

      if (mode === "jackpot") {
        jackpotField.style.display = "block";
        digitalField.style.display = "none";
        clearFields(digitalField);
      } else if (mode === "digital") {
        jackpotField.style.display = "none";
        digitalField.style.display = "block";
        clearFields(jackpotField);
      } else if (mode === "both") {
        jackpotField.style.display = "block";
        digitalField.style.display = "block";
      } else if (mode === "none") {
        jackpotField.style.display = "none";
        digitalField.style.display = "none";
        clearFields(jackpotField);
        clearFields(digitalField);
      }

      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

async function generateOptionBlock(block, index) {
  const optDiv = document.createElement("div");
  optDiv.className = "quiz-option-block";

  // Label
  const label = document.createElement("label");
  label.innerText = `Option ${index + 1}`;

  // Option text
  const inputText = document.createElement("input");
  inputText.type = "text";
  inputText.required = true;
  inputText.placeholder =
    "Name of Your Respective Portfolio Section (Optional)";

  // Description
  const inputDesc = document.createElement("input");
  inputDesc.type = "text";
  inputDesc.placeholder = "Enter the Description";
  inputDesc.className = "quiz-option-description";

  // Option link
  const inputLink = document.createElement("input");
  inputLink.type = "url";
  inputLink.placeholder =
    "Link of the Portfolios of Your Selected Social Media Channel";
  inputLink.className = "quiz-option-link";

  // File
  const fileLabel = document.createElement("label");
  fileLabel.className = "quiz-file-label";

  const fileText = document.createElement("span");
  fileText.className = "quiz-file-label-text";
  fileText.innerText = "Choose Image";

  const inputFile = document.createElement("input");
  inputFile.type = "file";
  inputFile.accept = "image/*";
  inputFile.className = "quiz-option-image-input quiz-hidden-file";
  inputFile.dataset.index = index;

  fileLabel.append(fileText, inputFile);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "quiz-clear-btn";
  clearBtn.innerText = "✕";
  clearBtn.style.display = "none";
  fileLabel.appendChild(clearBtn);

  const previewImg = document.createElement("img");
  previewImg.className = `preview-img quiz-optionPreview${index}`;
  previewImg.style.display = "none";

  inputFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "none";
      fileText.innerText = file.name;
      // clearBtn.style.display = "inline-block";
    }
  });

  clearBtn.addEventListener("click", () => {
    inputFile.value = "";
    previewImg.src = "";
    previewImg.style.display = "none";
    fileText.innerText = "Choose Image";
    clearBtn.style.display = "none";
  });

  // Delete Button
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "quiz-option-delete-btn";
  deleteBtn.innerText = "✕";
  deleteBtn.addEventListener("click", () => {
    const allOptions = block.querySelectorAll(".quiz-option-block");
    if (allOptions.length > 1) {
      optDiv.remove();
      renumberOptions(block);
    } else {
      alert("At least two options are required.");
    }
  });

  // === Logo Preview ===
  const logoPreview = document.createElement("img");
  logoPreview.className = "quiz-selected-logo-preview";
  logoPreview.style.display = "none"; // hidden initially
  logoPreview.style.maxWidth = "150px";
  logoPreview.style.marginTop = "10px";

  // === LOGO SELECTION ===
  const logoContainer = await createLogoSelectionContainer(logoPreview);

  // append all in correct order
  optDiv.append(
    label,
    inputText,
    inputDesc,
    inputLink,
    logoPreview, // ✅ add preview below logos
    logoContainer, // logo container first
    fileLabel, // file input below logo container
    previewImg, // preview below file input
    deleteBtn
  );
  setupUnifiedPreview(optDiv);
  optDiv.setAttribute("draggable", "true"); // ✅ ensures draggable always
  return optDiv;
}

function renumberOptions(block) {
  const optionBlocks = block.querySelectorAll(".quiz-option-block");
  optionBlocks.forEach((optBlock, index) => {
    const label = optBlock.querySelector("label");
    if (label) label.innerText = `Option ${index + 1}`;

    const previewImg = optBlock.querySelector(".preview-img");
    if (previewImg)
      previewImg.className = `preview-img quiz-optionPreview${index}`;
  });
}

async function generateOptions(block, count = 0) {
  const optionContainer = block.querySelector(".quiz-option-blocks");
  optionContainer.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const optDiv = await generateOptionBlock(block, i);
    optionContainer.appendChild(optDiv);
    // Make this block draggable (important!)
    optDiv.setAttribute("draggable", "true");
  }
}

async function createQuestionBlock() {
  wrapper.innerHTML = ""; // only one question per form

  const clone = template.content.cloneNode(true);
  const block = clone.querySelector(".quiz-question-wrapper");

  const collapseBtn = block.querySelector(".quiz-btn-collapse");
  const deleteBtn = block.querySelector(".quiz-btn-delete");
  const questionBlock = block.querySelector(".quiz-question-block");

  collapseBtn.addEventListener("click", () => {
    questionBlock.style.display =
      questionBlock.style.display === "none" ? "block" : "none";
    collapseBtn.textContent =
      questionBlock.style.display === "none" ? "Expand" : "Collapse";
  });

  deleteBtn.addEventListener("click", () => {
    block.remove();
  });

  const addOptionBtn = block.querySelector(".quiz-btn-add-option");
  addOptionBtn.addEventListener("click", async () => {
    const currentOptions = block.querySelectorAll(".quiz-option-block").length;
    const newOption = await generateOptionBlock(block, currentOptions);
    block.querySelector(".quiz-option-blocks").appendChild(newOption);
  });

  await generateOptions(block, 1); // start with 2 options
  setupImagePreview(block);
  setupRewardModeSwitcher(block); // ← Add this line
  setupMediaProfileToggles(block);
  enableOptionDragAndDrop(block);
  wrapper.appendChild(block);
}

document
  .getElementById("questions-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const block = document.querySelector(".quiz-question-wrapper");
    const formData = new FormData();

    const wrapper = document.getElementById("questions-wrapper");
    const channelId = wrapper.dataset.channelId;
    const sessionId = wrapper.dataset.sessionId;
    formData.append("sessionId", sessionId);
    formData.append("channelId", channelId);
    formData.append(
      "question",
      block.querySelector('input[name="question"]').value.trim()
    );
    formData.append(
      "questionDescription",
      block.querySelector('input[name="questionDescription"]').value.trim()
    );
    formData.append(
      "logoTitle",
      block.querySelector('input[name="logoTitle"]').value.trim()
    );
    formData.append(
      "logoDescription",
      block.querySelector('input[name="logoDescription"]').value.trim()
    );
    formData.append(
      "logoLink",
      block.querySelector('input[name="logoLink"]').value.trim()
    );

    const logoImage = block.querySelector(".quiz-logoImage")?.files[0];
    if (logoImage) formData.append("logo", logoImage);

    const questionImage = block.querySelector(".quiz-questionImage")?.files[0];
    const questionLogo = block.querySelector(".quiz-questionLogo")?.files[0];
    const questionImageLink = block
      .querySelector('input[name="questionImageLink"]')
      .value.trim();

    if (questionImage) formData.append("questionImage", questionImage);
    if (questionLogo) formData.append("questionLogo", questionLogo);
    if (questionImageLink)
      formData.append("questionImageLink", questionImageLink);

    const options = block.querySelectorAll(".quiz-option-block");
    const optionData = [];

    options.forEach((opt, index) => {
      const text = opt.querySelector('input[type="text"]').value.trim();
      const description =
        opt.querySelector(".quiz-option-description")?.value.trim() || "";
      const file = opt.querySelector('input[type="file"]')?.files[0];
      const imageName = file ? file.name : null;
      const link = opt.querySelector(".quiz-option-link")?.value.trim() || null; // ✅ include link
      const selectedLogo = opt.querySelector(".quiz-option-logo.active-logo");
      let selectedLogoSrc = null;

      if (selectedLogo) {
        // ✅ Convert absolute → relative (remove domain)
        try {
          const url = new URL(selectedLogo.src);
          selectedLogoSrc = url.pathname; // e.g. "/portfolio-logos/LinkedIn.png"
        } catch {
          // In case it's already relative
          selectedLogoSrc = selectedLogo.src;
        }
      }

      optionData.push({ text, description, imageName, link, selectedLogoSrc });

      if (file) {
        formData.append("optionsImages", file); // all images under same key
      }
    });

    formData.append("options", JSON.stringify(optionData));
    const selectedProfiles = block.querySelectorAll(
      'input[name="logoMediaProfile[]"]:checked'
    ); // ← only checked ones
    selectedProfiles.forEach((input) => {
      formData.append("logoMediaProfile[]", input.value);
    });
    const loader = document.getElementById("loader");
    loader.style.display = "flex"; // show loader

    // Convert FormData to a plain object
    const formDataObj = {};
    formData.forEach((value, key) => {
      // If key already exists, make it an array (for duplicate keys like optionsImages)
      if (formDataObj[key]) {
        if (!Array.isArray(formDataObj[key])) {
          formDataObj[key] = [formDataObj[key]];
        }
        formDataObj[key].push(value);
      } else {
        formDataObj[key] = value;
      }
    });

    try {
      const res = await fetch(
        "/tvstation/portfolio/portfolio-question/create",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await res.json();
      if (result.type === "success") {
        showToast(result.message || "Question saved successfully!", "success");

        const { channelId, sessionId, _id } = result.data; // ✅ Extract
        setTimeout(() => {
          window.location.href = `/tvstation/portfolio/channels/${channelId}/session/${sessionId}/editquestion/${_id}`;
        }, 1000);
      } else {
        showToast(result.message || "Something went wrong.", "error");
      }
    } catch (err) {
      console.error("Error submitting question:", err);
      showToast("Failed to submit question. Please try again.", "error");
    } finally {
      loader.style.display = "none"; // hide loader after fetch is done
    }
  });

// === GLOBAL LOGO CACHE ===
let cachedLogos = [];
let logosFetched = false;

async function fetchPortfolioLogos() {
  if (logosFetched) return cachedLogos; // ✅ Return cached logos if already loaded

  try {
    const res = await fetch("/tvstation/portfolio/portfolio-logos");
    cachedLogos = await res.json();
    logosFetched = true;
    return cachedLogos;
  } catch (err) {
    console.error("Error loading portfolio logos:", err);
    return [];
  }
}

async function createLogoSelectionContainer(previewImg) {
  const container = document.createElement("div");
  container.className = "quiz-option-logos";

  const urls = await fetchPortfolioLogos();

  urls.forEach((src) => {
    const logoImg = document.createElement("img");
    logoImg.src = src;
    logoImg.className = "quiz-option-logo";
    container.appendChild(logoImg);
  });

  return container;
}

createQuestionBlock();

function setupMediaProfileToggles(block) {
  const toggles = block.querySelectorAll('input[name="logoMediaProfile[]"]');
  const logoParentContainer = block.querySelector("#logoParentContainer");

  function updateCustomVisibility() {
    const customToggle = block.querySelector(
      'input[name="logoMediaProfile[]"][value="custom"]'
    );
    logoParentContainer.style.display = customToggle?.checked
      ? "block"
      : "none";
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      // restrict max 4 selections
      const checked = block.querySelectorAll(
        'input[name="logoMediaProfile[]"]:checked'
      );
      const maxAllowed = 4;
      if (checked.length > maxAllowed) {
        toggle.checked = false;
        showToast(`You can select up to ${maxAllowed} profiles only.`, "error");
      }
      updateCustomVisibility();
    });
  });

  // run once on load
  updateCustomVisibility();
}

function setupUnifiedPreview(optDiv) {
  const fileInput = optDiv.querySelector(".quiz-option-image-input");
  const fileLabelText = optDiv.querySelector(".quiz-file-label-text");
  const logoContainer = optDiv.querySelector(".quiz-option-logos");
  const previewImg = optDiv.querySelector(".quiz-selected-logo-preview");

  if (!fileInput || !logoContainer || !previewImg) return;

  // === Wrap preview + clear button ===
  let wrapper = previewImg.parentElement;
  if (!wrapper.classList.contains("quiz-preview-wrapper")) {
    const newWrapper = document.createElement("div");
    newWrapper.className = "quiz-preview-wrapper";
    newWrapper.style.position = "relative";
    newWrapper.style.display = "inline-block";
    newWrapper.style.marginTop = "10px";

    previewImg.parentElement.insertBefore(newWrapper, previewImg);
    newWrapper.appendChild(previewImg);
    wrapper = newWrapper;
  }

  // === Add clear (✕) button ===
  let clearBtn = wrapper.querySelector(".quiz-clear-btn-preview");
  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "quiz-clear-btn quiz-clear-btn-preview";
    clearBtn.style.position = "absolute";
    clearBtn.style.top = "0px";
    clearBtn.style.right = "0px";
    clearBtn.style.display = "none";
    clearBtn.innerText = "✕";
    wrapper.appendChild(clearBtn);
  }

  // === Helper: clear both logo + file ===
  function clearAll() {
    previewImg.src = "";
    previewImg.style.display = "none";
    clearBtn.style.display = "none";
    fileInput.value = "";
    fileLabelText.innerText = "Choose Image";
    logoContainer
      .querySelectorAll(".active-logo")
      .forEach((el) => el.classList.remove("active-logo"));
  }

  // === File change ===
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      // remove any active logo
      logoContainer
        .querySelectorAll(".active-logo")
        .forEach((el) => el.classList.remove("active-logo"));
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
      clearBtn.style.display = "block";
      fileLabelText.innerText = file.name;
    } else {
      clearAll();
    }
  });

  // === Logo click ===
  logoContainer.querySelectorAll(".quiz-option-logo").forEach((logo) => {
    logo.addEventListener("click", () => {
      const isActive = logo.classList.contains("active-logo");

      // clear file
      fileInput.value = "";
      fileLabelText.innerText = "Choose Image";

      logoContainer
        .querySelectorAll(".active-logo")
        .forEach((el) => el.classList.remove("active-logo"));

      if (!isActive) {
        logo.classList.add("active-logo");
        previewImg.src = logo.src;
        previewImg.style.display = "block";
        clearBtn.style.display = "block";
      } else {
        clearAll();
      }
    });
  });

  clearBtn.addEventListener("click", clearAll);
}

function enableOptionDragAndDrop(block) {
  const container = block.querySelector(".quiz-option-blocks");
  if (!container) return;

  let dragging = null;
  let lastHovered = null;
  let hoverLock = null;
  let lastInsertIndex = -1;

  container.addEventListener("dragstart", (e) => {
    const root = e.target.closest(".quiz-option-block");
    if (!root) return;
    dragging = root;
    dragging.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
  });

  container.addEventListener("dragend", () => {
    if (dragging) dragging.classList.remove("dragging");
    if (lastHovered) lastHovered.classList.remove("drop-target");
    dragging = null;
    lastHovered = null;
    hoverLock = null;
    renumberOptions(block);
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragging) return;

    const x = e.clientX;
    const y = e.clientY;

    // Temporarily hide dragging block to find real hovered element
    dragging.style.visibility = "hidden";
    const under = document.elementFromPoint(x, y);
    dragging.style.visibility = "visible";

    const hovered = under?.closest(".quiz-option-block");
    if (!hovered || hovered === dragging) return;

    const rect = hovered.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    // ── 2-D direction check
    const placeBefore = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;

    // ── Prevent flicker using hoverLock
    if (hoverLock && hoverLock.block === hovered) {
      // only move if user crosses threshold of 20px
      const dist = Math.hypot(x - hoverLock.x, y - hoverLock.y);
      if (dist < 20) return; // stay locked
    }

    // ── Build stable list excluding dragging
    const siblings = Array.from(container.children).filter(
      (c) => c !== dragging
    );
    const targetIndex = siblings.indexOf(hovered) + (placeBefore ? 0 : 1);

    // ── Only insert if index really changes
    if (targetIndex !== lastInsertIndex) {
      container.insertBefore(dragging, siblings[targetIndex] || null);
      lastInsertIndex = targetIndex;
    }

    // ── Visual feedback
    if (lastHovered && lastHovered !== hovered)
      lastHovered.classList.remove("drop-target");
    hovered.classList.add("drop-target");
    lastHovered = hovered;
    hoverLock = { block: hovered, x, y };
  });
}

// New Functionallity in option hybrid approach for options (can select event too in popups)

async function populateAppSelectionPopup(sessionId, popupContainer) {
  const loader = document.getElementById("loader");
  loader.style.display = "flex";

  try {
    const res = await fetch(`/tvstation/${sessionId}/apps`);
    const result = await res.json();

    if (!result.success)
      throw new Error(result.message || "Failed to load apps.");

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
      if (!q || (!q.question && !q.questionImage)) return;

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
        }" alt="Question Image"/>
        <span>${q.question || `Question ${idx + 1}`}</span>
      `;

      // Select behavior
      card.addEventListener("click", () => {
        popupContainer
          .querySelectorAll(".app-card")
          .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        selectedAppId = q._id;

        const selectedAppNameElem =
          document.getElementById("selected-app-name");
        if (selectedAppNameElem)
          selectedAppNameElem.textContent = card.dataset.appName;
      });

      popupContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Error fetching apps:", err);
    showToast(err.message, "error");
  } finally {
    loader.style.display = "none";
  }
}

/**
 * Handle popup OK button click → fills selected app data into active option block
 */
async function handleAppSelectionConfirm() {
  if (!selectedAppId || !activeOptionBlock) {
    alert("Please select an app first.");
    return;
  }

  const selectedCard = document.querySelector(
    "#app-card-container .app-card.active"
  );
  if (!selectedCard) return;

  const fileInput = activeOptionBlock.querySelector('input[type="file"]');
  const textInput = activeOptionBlock.querySelector('input[type="text"]');
  const linkInput = activeOptionBlock.querySelector(".quiz-option-link");
  const previewImg = activeOptionBlock.querySelector(".preview-img");
  const summaryAppName = activeOptionBlock.querySelector(".summary-app-name");

  const questionImage = selectedCard.dataset.questionImage;
  const questionText = selectedCard.dataset.question;
  const questionLink = selectedCard.dataset.questionLink;
  const appName = selectedCard.dataset.appName;

  // Set image
  if (questionImage) {
    await setImageInputFromUrl(fileInput, questionImage);
    previewImg.src = questionImage;
    previewImg.style.display = "none";

    const summaryImg = activeOptionBlock.querySelector(".summary-img");
    summaryImg.src = questionImage;
    summaryImg.style.display = "block";
    summaryImg.style.width = "100px";
  }

  // Set text
  if (questionText) {
    textInput.value = questionText;
    const summaryText = activeOptionBlock.querySelector(".summary-text");
    summaryText.textContent = questionText;
    summaryText.style.display = "block";
    textInput.style.display = "none";
  }

  // Set link
  if (questionLink && linkInput) {
    linkInput.value = questionLink;
    const summaryLink = activeOptionBlock.querySelector(".summary-link");
    summaryLink.textContent = "Open Front Screen";
    summaryLink.style.display = "inline-block";
    summaryLink.onclick = () => window.open(questionLink, "_blank");
    linkInput.style.display = "none";
  }

  // Set app name summary
  if (appName) {
    summaryAppName.textContent = `App: ${appName}`;
    summaryAppName.style.display = "block";
  }

  // Hide popup
  document.getElementById("app-selection-popup").style.display = "none";
  selectedAppId = null;
  activeOptionBlock = null;
}

/**
 * Helper function to convert an image URL into a File and assign it to an input[type=file]
 */
async function setImageInputFromUrl(fileInput, url) {
  if (!url) return;
  const response = await fetch(url);
  const blob = await response.blob();
  const filename = url.split("/").pop() || "image.png";
  const file = new File([blob], filename, { type: blob.type });

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
}

window.addEventListener("DOMContentLoaded", async () => {
  const sessionId =
    document.getElementById("questions-wrapper").dataset.sessionId;
  const popupContainer = document.getElementById("app-card-container");

  // Populate apps into popup
  await populateAppSelectionPopup(sessionId, popupContainer);

  // Bind popup OK button
  document
    .getElementById("popup-ok-btn-select-app")
    .addEventListener("click", handleAppSelectionConfirm);

  // Bind Cancel button
  document
    .getElementById("popup-cancel-btn-select-app")
    .addEventListener("click", () => {
      document.getElementById("app-selection-popup").style.display = "none";
    });
});
