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
    {
      selector: ".quiz-jackpotRewardImage",
      previewSelector: ".quiz-jackpotRewardImagePreview",
    },
    {
      selector: ".quiz-digitalRewardImage",
      previewSelector: ".quiz-digitalRewardImagePreview",
    },
  ];

  fileInputs.forEach(({ selector, previewSelector }) => {
    const fileInput = block.querySelector(selector);
    const previewImg = block.querySelector(previewSelector);
    if (!fileInput) return;

    // ✅ Get the correct label span
    const labelText = fileInput.parentElement.querySelector(
      ".quiz-file-label-text"
    );

    // ✅ Create a new clear button and append to DOM immediately
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "quiz-clear-btn";
    clearBtn.innerText = "✕";
    clearBtn.style.display = "none"; // initially hidden
    fileInput.parentElement.appendChild(clearBtn);

    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        previewImg.src = URL.createObjectURL(file);
        previewImg.style.display = "block";
        if (labelText) labelText.textContent = file.name;
        clearBtn.style.display = "inline-block";
      }
    });

    clearBtn.addEventListener("click", () => {
      fileInput.value = "";
      previewImg.src = "";
      previewImg.style.display = "none";
      if (labelText) labelText.textContent = "Choose File";
      clearBtn.style.display = "none";
    });
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

  // default select "none"
  block.querySelector('[data-mode="none"]').click();
}

function generateOptionBlock(block, index) {
  const optDiv = document.createElement("div");
  optDiv.className = "quiz-option-block";

  const label = document.createElement("label");
  label.innerText = `Option ${index + 1}`;

  const inputText = document.createElement("input");
  inputText.type = "text";
  inputText.required = true;
  inputText.placeholder = "Enter option text";

  // Option Description
  const inputDesc = document.createElement("input");
  inputDesc.type = "text";
  inputDesc.placeholder = "Enter option description (optional)";
  inputDesc.className = "quiz-option-description";

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
      previewImg.style.display = "block";
      fileText.innerText = file.name;
      clearBtn.style.display = "inline-block";
    }
  });

  clearBtn.addEventListener("click", () => {
    inputFile.value = "";
    previewImg.src = "";
    previewImg.style.display = "none";
    fileText.innerText = "Choose Image";
    clearBtn.style.display = "none";
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "quiz-option-delete-btn";
  deleteBtn.innerText = "✕";
  deleteBtn.addEventListener("click", () => {
    const allOptions = block.querySelectorAll(".quiz-option-block");
    if (allOptions.length > 2) {
      optDiv.remove();
      renumberOptions(block);
      updateCorrectAnswerOptions(block);
    } else {
      alert("At least two options are required.");
    }
  });

  optDiv.append(label, inputText, inputDesc, fileLabel, previewImg, deleteBtn);
  return optDiv;
}

function updateCorrectAnswerOptions(block) {
  const correctAnswerSelect = block.querySelector(
    ".quiz-correct-answer-select"
  );
  const allOptionBlocks = block.querySelectorAll(".quiz-option-block");
  correctAnswerSelect.innerHTML = '<option value="">-- Select --</option>';

  allOptionBlocks.forEach((opt, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.innerText = `Option ${i + 1}`;
    correctAnswerSelect.appendChild(option);
  });
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

  updateCorrectAnswerOptions(block);
}

function setupMediaProfileToggles(block) {
  const toggles = block.querySelectorAll('input[name="logoMediaProfile[]"]');
  const logoParentContainer = block.querySelector("#logoParentContainer");

function updateCustomVisibility() {
  const customToggle = block.querySelector(
    'input[name="logoMediaProfile[]"][value="custom"]'
  );
  const editBroadcaster = block.querySelector("#edit-broadcaster");

  // 🟢 Toggle container when custom checkbox changes
  const updateVisibility = () => {
    logoParentContainer.style.display = customToggle?.checked
      ? "block"
      : "none";
  };

  customToggle?.addEventListener("change", updateVisibility);

  // 🟢 Toggle container when edit-broadcaster is clicked
  editBroadcaster?.addEventListener("click", () => {
    logoParentContainer.style.display =
      logoParentContainer.style.display === "none" ||
      logoParentContainer.style.display === ""
        ? "block"
        : "none";
  });

  // 🟢 Set initial state on load
  updateVisibility();
}


  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      // if you want to restrict max 4 selections
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

// function setupMediaProfileDropdown(block) {
//   const select = block.querySelector(".quiz-media-profile-select");
//   const logoTitleInput = block.querySelector('input[name="logoTitle"]');
//   const logoDescInput = block.querySelector('input[name="logoDescription"]');
//   const logoLinkInput = block.querySelector('input[name="logoLink"]');
//   const logoImageInput = block.querySelector(".quiz-logoImage");
//   const logoImagePreview = block.querySelector(".quiz-logoImagePreview");

//   // Create hidden input for existing image URL
//   let existingLogoUrlInput = block.querySelector(
//     'input[name="existingLogoUrl"]'
//   );
//   if (!existingLogoUrlInput) {
//     existingLogoUrlInput = document.createElement("input");
//     existingLogoUrlInput.type = "hidden";
//     existingLogoUrlInput.name = "existingLogoUrl";
//     block
//       .querySelector(".quiz-question-block")
//       .appendChild(existingLogoUrlInput);
//   }

//   // Create clear button for logo image
//   let clearBtn = block.querySelector(".quiz-logo-clear-btn");
//   if (!clearBtn) {
//     clearBtn = document.createElement("button");
//     clearBtn.type = "button";
//     clearBtn.innerText = "✕";
//     clearBtn.className = "quiz-clear-btn quiz-logo-clear-btn";
//     logoImageInput.parentElement.appendChild(clearBtn);
//     clearBtn.style.display = "none"; // initially hidden
//   }

//   clearBtn.addEventListener("click", () => {
//     logoImageInput.value = "";
//     logoImagePreview.src = "";
//     logoImagePreview.style.display = "none";
//     existingLogoUrlInput.value = "";
//     logoImageInput.previousElementSibling.textContent = "Choose File"; // reset label text
//     clearBtn.style.display = "none";
//   });

//   select.addEventListener("change", async () => {
//     const type = select.value;
//     if (!type) return;

//     try {
//       const loader = document.getElementById("loader");
//       loader.style.display = "flex"; // show loader
//       const res = await fetch(`/tvstation/get-media-profile?type=${type}`);
//       const data = await res.json();

//       if (data.type === "success") {
//         const profile = data.profile;

//         logoTitleInput.value = profile.title || "";
//         logoDescInput.value = profile.description || "";
//         logoLinkInput.value = profile.link || "";

//         if (profile.logo) {
//           logoImagePreview.src = profile.logo;
//           logoImagePreview.style.display = "block";
//           existingLogoUrlInput.value = profile.logo;
//           clearBtn.style.display = "inline-block";
//           // Show file name in label
//           const fileName = profile.logo.split("/").pop(); // extract last part of URL
//           logoImageInput.previousElementSibling.textContent =
//             fileName || "Current File";
//         } else {
//           logoImagePreview.src = "";
//           logoImagePreview.style.display = "none";
//           existingLogoUrlInput.value = "";
//           clearBtn.style.display = "none";
//           logoImageInput.previousElementSibling.textContent = "Choose File";
//         }

//         // reset file input
//         logoImageInput.value = "";

//         // showToast(`Media profile "${type}" loaded`, "success");
//       } else {
//         showToast(data.message || "Failed to load media profile", "error");
//       }
//     } catch (err) {
//       console.error("Error fetching media profile:", err);
//       showToast("Error fetching media profile", "error");
//     } finally {
//       loader.style.display = "none"; // hide loader
//     }
//   });
// }

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
    updateCorrectAnswerOptions(block);
  });

  generateOptions(block, 2); // start with 2 options
  setupImagePreview(block);
  setupRewardModeSwitcher(block); // ← Add this line
  setupMediaProfileToggles(block);
  // setupMediaProfileDropdown(block);
  wrapper.appendChild(block);
}

document
  .getElementById("questions-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const block = document.querySelector(".quiz-question-wrapper");
    // const existingLogoUrl = block.querySelector(
    //   'input[name="existingLogoUrl"]'
    // ).value;
    const formData = new FormData();

    const channelId = document.getElementById("channelId").value;
    const sessionId = document.getElementById("sessionId").value;
    formData.append("sessionId", sessionId);
    formData.append("channelId", channelId);
    formData.append(
      "question",
      block.querySelector('input[name="question"]').value.trim()
    );
    formData.append(
      "magicCoinDeducted",
      block.querySelector('input[name="magicCoinDeducted"]').value
    );
    formData.append(
      "correctAnswerIndex",
      block.querySelector(".quiz-correct-answer-select").value
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

    const showLogoToggle = document.querySelector("#showLogoToggle");
    formData.append("showLogoSection", showLogoToggle.checked);

    const logoImage = block.querySelector(".quiz-logoImage")?.files[0];
    if (logoImage) formData.append("logo", logoImage);

    // Mode & reward coins
    formData.append("mode", block.querySelector('input[name="mode"]').value);
    formData.append(
      "jackpotCoinDeducted",
      block.querySelector('input[name="jackpotCoinDeducted"]')?.value || 0
    );
    formData.append(
      "digitalCoinDeducted",
      block.querySelector('input[name="digitalCoinDeducted"]')?.value || 0
    );

    const questionImage = block.querySelector(".quiz-questionImage")?.files[0];
    const questionLogo = block.querySelector(".quiz-questionLogo")?.files[0];
    const questionImageLink = block
      .querySelector('input[name="questionImageLink"]')
      .value.trim();

    if (questionImage) formData.append("questionImage", questionImage);
    if (questionLogo) formData.append("questionLogo", questionLogo);
    if (questionImageLink)
      formData.append("questionImageLink", questionImageLink);
    // if (existingLogoUrl) formData.append("existingLogoUrl", existingLogoUrl);

    const options = block.querySelectorAll(".quiz-option-block");
    const optionData = [];

    const jackpotRewardName = block
      .querySelector('input[name="jackpotRewardName"]')
      .value.trim();
    const jackpotRewardDescription = block
      .querySelector('input[name="jackpotRewardDescription"]')
      .value.trim();
    const jackpotRewardLink = block
      .querySelector('input[name="jackpotRewardLink"]')
      .value.trim();
    const jackpotRewardImage = block.querySelector(".quiz-jackpotRewardImage")
      ?.files[0];

    if (jackpotRewardName)
      formData.append("jackpotRewardName", jackpotRewardName);
    if (jackpotRewardDescription)
      formData.append("jackpotRewardDescription", jackpotRewardDescription);
    if (jackpotRewardLink)
      formData.append("jackpotRewardLink", jackpotRewardLink);
    if (jackpotRewardImage)
      formData.append("jackpotRewardImage", jackpotRewardImage);

    const digitalRewardName = block
      .querySelector('input[name="digitalRewardName"]')
      .value.trim();
    const digitalRewardDescription = block
      .querySelector('input[name="digitalRewardDescription"]')
      .value.trim();
    const digitalRewardLink = block
      .querySelector('input[name="digitalRewardLink"]')
      .value.trim();
    const digitalRewardImage = block.querySelector(".quiz-digitalRewardImage")
      ?.files[0];

    if (digitalRewardName)
      formData.append("digitalRewardName", digitalRewardName);
    if (digitalRewardDescription)
      formData.append("digitalRewardDescription", digitalRewardDescription);
    if (digitalRewardLink)
      formData.append("digitalRewardLink", digitalRewardLink);
    if (digitalRewardImage)
      formData.append("digitalRewardImage", digitalRewardImage);

    options.forEach((opt, index) => {
      const text = opt.querySelector('input[type="text"]').value.trim();
      const description =
        opt.querySelector(".quiz-option-description")?.value.trim() || "";
      const file = opt.querySelector('input[type="file"]')?.files[0];
      const imageName = file ? file.name : null;

      optionData.push({ text, description, imageName });

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
      const res = await fetch("/tvstation/quiz-question/create", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.type === "success") {
        showToast(result.message || "Question saved successfully!", "success");

        const { channelId, sessionId, _id } = result.data; // ✅ Extract
        setTimeout(() => {
          window.location.href = `/tvstation/channels/${channelId}/session/${sessionId}/editquestion/${_id}`;
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
