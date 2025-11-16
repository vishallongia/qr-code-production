let activeOptionBlock = null; // currently active option block
let selectedAppId = null;
const wrapper = document.getElementById("questions-wrapper");
const template = document.getElementById("question-template");

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

function generateOptionBlock(block, index) {
  const optDiv = document.createElement("div");
  optDiv.className = "quiz-option-block";

  // Label
  const label = document.createElement("label");
  label.innerText = `Option ${index + 1}`;

  // Option text
  const inputText = document.createElement("input");
  inputText.type = "text";
  inputText.required = true;
  inputText.placeholder = "Question";
  inputText.style.display = "none";

  const summaryText = document.createElement("p");
  summaryText.className = "summary-text";
  summaryText.style.display = "none"; // initially hidden

  // Description
  const inputDesc = document.createElement("input");
  inputDesc.type = "text";
  inputDesc.placeholder = "Enter the Description";
  inputDesc.className = "quiz-option-description";
  inputDesc.style.display = "none";

  const summaryDesc = document.createElement("p");
  summaryDesc.className = "summary-desc";
  summaryDesc.style.display = "none";

  // Option link
  const inputLink = document.createElement("input");
  inputLink.type = "url";
  inputLink.placeholder = "Enter Link (optional)";
  inputLink.className = "quiz-option-link";
  inputLink.style.display = "none";

  const summaryLink = document.createElement("button");
  summaryLink.type = "button";
  summaryLink.className = "summary-link quiz-file-label";
  summaryLink.style.display = "none";
  summaryLink.innerText = "View Link";

  // File
  const fileLabel = document.createElement("label");
  fileLabel.className = "quiz-file-label";

  const fileText = document.createElement("span");
  fileText.className = "quiz-file-label-text";
  fileText.innerText = "Choose Image";
  fileText.style.display = "none";
  fileLabel.style.display = "none";

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
  // previewImg.style.display = "none";

  const summaryImg = document.createElement("img");
  summaryImg.className = "summary-img";
  summaryImg.style.display = "none";

  const summaryAppName = document.createElement("p");
  summaryAppName.className = "summary-app-name";
  summaryAppName.style.display = "none";
  summaryAppName.style.fontWeight = "600";
  summaryAppName.style.margin = "0px";

  inputFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.style.display = "block";
      fileText.innerText = file.name;
      clearBtn.style.display = "inline-block";
      previewImg.style.display = "none";
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

  // Select App Button
  const selectAppBtn = document.createElement("button");
  selectAppBtn.type = "button";
  selectAppBtn.className = "quiz-select-app-btn quiz-file-label";
  selectAppBtn.innerText = "Add Event";

  selectAppBtn.addEventListener("click", () => {
    const popup = document.getElementById("app-selection-popup");
    popup.style.display = "flex";
    activeOptionBlock = optDiv;
  });

  // append all
  optDiv.append(
    label,
    fileLabel,
    previewImg,
    summaryImg,
    deleteBtn,
    summaryAppName, // 👈 Added here
    inputText,
    summaryText,
    inputDesc,
    summaryDesc,
    inputLink,
    summaryLink,
    selectAppBtn
  );

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

function generateOptions(block, count = 0) {
  const optionContainer = block.querySelector(".quiz-option-blocks");
  optionContainer.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const optDiv = generateOptionBlock(block, i);
    optionContainer.appendChild(optDiv);
  }
}

function createQuestionBlock() {
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
  addOptionBtn.addEventListener("click", () => {
    const currentOptions = block.querySelectorAll(".quiz-option-block").length;
    const newOption = generateOptionBlock(block, currentOptions);
    block.querySelector(".quiz-option-blocks").appendChild(newOption);
  });

  generateOptions(block, 1); // start with 2 options
  setupImagePreview(block);
  setupRewardModeSwitcher(block); // ← Add this line
  setupMediaProfileToggles(block);
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

      optionData.push({ text, description, imageName, link });

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
        "/tvstation/magicscreen/magicscreen-question/create",
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
          window.location.href = `/tvstation/magicscreen/channels/${channelId}/session/${sessionId}/editquestion/${_id}`;
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

createQuestionBlock();

window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loader");
  loader.style.display = "flex"; // Show loader

  const sessionId = wrapper.dataset.sessionId;
  const popupContainer = document.getElementById("app-card-container");

  try {
    const res = await fetch(`/tvstation/${sessionId}/apps`);
    const result = await res.json();

    if (result.success) {
      const {
        quizQuestion,
        voteQuestion,
        applauseQuestion,
        commentQuestion,
        portfolioQuestion,
        brandQuestion,
        productQuestion
      } = result.data;
      const questions = [
        quizQuestion,
        voteQuestion,
        applauseQuestion,
        commentQuestion,
        portfolioQuestion,
        brandQuestion,
        productQuestion
      ];
      popupContainer.innerHTML = ""; // Clear existing cards

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
                        }" alt="Question Image"/>
                        <span>${q.question || `Question ${idx + 1}`}</span>
                    `;

          // Click to select
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
    console.error("Error fetching session data:", err);
    showToast(err.message, "error");
  } finally {
    loader.style.display = "none"; // Hide loader after fetch
  }
});

// close popup
document
  .getElementById("popup-cancel-btn-select-app")
  .addEventListener("click", () => {
    document.getElementById("app-selection-popup").style.display = "none";
  });
// 2️⃣ When clicking OK in the popup
document
  .getElementById("popup-ok-btn-select-app")
  .addEventListener("click", async () => {
    if (!selectedAppId || !activeOptionBlock) {
      alert("Please select an app first.");
      return;
    }

    const selectedCard = document.querySelector(
      `#app-card-container .app-card.active`
    );
    if (!selectedCard) return;

    const fileInput = activeOptionBlock.querySelector('input[type="file"]');
    const textInput = activeOptionBlock.querySelector('input[type="text"]');
    const linkInput = activeOptionBlock.querySelector(".quiz-option-link");
    const previewImg = activeOptionBlock.querySelector(".preview-img");
    const selectAppBtn = activeOptionBlock.querySelector(
      ".quiz-select-app-btn"
    );
    const summaryAppName = activeOptionBlock.querySelector(".summary-app-name");

    const questionImage = selectedCard.dataset.questionImage;
    const questionText = selectedCard.dataset.question;
    const questionLink = selectedCard.dataset.questionLink;
    const appName = selectedCard.dataset.appName;

    // Ensure clear button exists
    let clearBtn = fileInput.parentElement.querySelector(".quiz-clear-btn");
    if (!clearBtn) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "quiz-clear-btn";
      clearBtn.innerText = "✕";
      fileInput.parentElement.appendChild(clearBtn);
      clearBtn.addEventListener("click", () => {
        fileInput.value = "";
        previewImg.src = "";
        previewImg.style.display = "none";
        const labelText = fileInput.previousElementSibling;
        if (labelText) labelText.textContent = "Choose File";
        clearBtn.style.display = "none";
      });
    }

    // Populate data
    if (questionImage) {
      previewImg.src = questionImage;
      previewImg.style.display = "none";
      const labelText = fileInput.previousElementSibling;
      if (labelText) labelText.textContent = questionImage.split("/").pop();
      clearBtn.style.display = "inline-block";
      await setImageInputFromUrl(fileInput, questionImage);

      // ✅ Summary for image
      const summaryImg = activeOptionBlock.querySelector(".summary-img");
      summaryImg.src = questionImage;
      summaryImg.style.display = "block";
      summaryImg.style.width = "100px";
    }

    if (questionText) {
      textInput.value = questionText;
      const summaryText = activeOptionBlock.querySelector(".summary-text");
      summaryText.textContent = questionText;
      summaryText.style.display = "block";
      textInput.style.display = "none";
    }

    if (questionLink && linkInput) {
      linkInput.value = questionLink;

      const summaryLink = activeOptionBlock.querySelector(".summary-link");
      summaryLink.textContent = "Open Front Screen";
      summaryLink.style.display = "inline-block";
      summaryLink.onclick = () => window.open(questionLink, "_blank"); // ✅ opens in new tab

      linkInput.style.display = "none";
    }
    if (appName) {
      summaryAppName.textContent = `App: ${appName}`;
      summaryAppName.style.display = "block";
    }
    // Remove selected card & hide popup
    // selectedCard.remove();
    document.getElementById("app-selection-popup").style.display = "none";

    // Reset
    selectedAppId = null;
    activeOptionBlock = null;
  });

async function setImageInputFromUrl(fileInput, url) {
  if (!url) return;

  const response = await fetch(url);
  const blob = await response.blob();
  const filename = url.split("/").pop() || "image.png";
  const file = new File([blob], filename, { type: blob.type });

  // Assign the File to the input
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
}

function setupMediaProfileToggles(block) {
  const toggles = block.querySelectorAll('input[name="logoMediaProfile[]"]');
  const logoParentContainer = block.querySelector("#logoParentContainer");
  const customToggle = block.querySelector(
    'input[name="logoMediaProfile[]"][value="custom"]'
  );
  const editBroadcaster = block.querySelector("#edit-broadcaster");

  if (!logoParentContainer) return;

  // ✅ Show/hide container based only on "custom"
  function updateCustomVisibility() {
    logoParentContainer.style.display = customToggle?.checked
      ? "block"
      : "none";
  }

  // ✅ Attach change listener to "custom" only
  customToggle?.addEventListener("change", updateCustomVisibility);

  // ✅ Attach independent toggle for Edit Broadcaster button
  editBroadcaster?.addEventListener("click", () => {
    const currentDisplay = window.getComputedStyle(logoParentContainer).display;
    logoParentContainer.style.display =
      currentDisplay === "none" ? "block" : "none";
  });

  // ✅ Add checkbox limit protection (without calling updateVisibility every time)
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const checked = block.querySelectorAll(
        'input[name="logoMediaProfile[]"]:checked'
      );
      const maxAllowed = 4;

      if (checked.length > maxAllowed) {
        toggle.checked = false;
        showToast(`You can select up to ${maxAllowed} profiles only.`, "error");
      }
    });
  });

  // ✅ Initial visibility on load
  updateCustomVisibility();
}
