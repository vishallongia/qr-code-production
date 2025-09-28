const loadAndApplyLanguage = (lang) => {
  fetch(`/translations/${lang}.json`)
    .then((response) => response.json())
    .then((translations) => {
      localStorage.setItem("userLanguage", lang);
      currentLanguage = lang
      const elements = document.querySelectorAll("[data-translate]");
      elements.forEach((el) => {
        const key = el.getAttribute("data-translate");
        const translatedText = translations[key];

        if (translatedText !== undefined) {
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            if (el.hasAttribute("placeholder")) {
              el.placeholder = translatedText;
            }
          } else if (el.querySelector(".menu-text, .btn-text")) {
            el.querySelector(".menu-text, .btn-text").innerText = translatedText;
          } else {
            el.innerText = translatedText;
          }
        }
      });

      // Update visible selected language
      const selectedLang = document.querySelector(".selected-lang");
      if (selectedLang) {
        selectedLang.textContent = lang;
      }

      // Sync dropdown value if exists
      const languageSwitcher = document.getElementById("languageSwitcher");
      if (languageSwitcher) {
        languageSwitcher.value = lang;
      }
    })
    .catch((error) => {
      console.error(`Error loading /translations/${lang}.json:`, error);
    });
};

// Expose globally for dropdowns
window.switchLanguage = loadAndApplyLanguage;

// Main function to determine default language
const detectAndLoadLanguage = () => {
  const savedLanguage = localStorage.getItem("userLanguage");
  const browserLang = (navigator.language || navigator.userLanguage).slice(0, 2);
  // console.log(browserLang);
  const supportedLanguages = ["en", "de", "hu", "ro"];

  if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
    loadAndApplyLanguage(savedLanguage);
  } else if (supportedLanguages.includes(browserLang)) {
    loadAndApplyLanguage(browserLang);
  } else {
    // Fallback to IP-based location
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const country = data.country; // e.g., "DE"
        const countryToLang = {
          "DE": "de",
          // "HU": "hu",
          "RO": "ro",
          "US": "en",
          "IN": "en",
          "GB": "de"
        };
        const lang = countryToLang[country] || "en";
        loadAndApplyLanguage(lang);
      })
      .catch(() => {
        // Final fallback
        loadAndApplyLanguage("en");
      });
  }
};

// Run on load
document.addEventListener("DOMContentLoaded", () => {
  detectAndLoadLanguage()

  const languageSwitcher = document.getElementById("languageSwitcher");
  if (languageSwitcher) {
    languageSwitcher.addEventListener("change", (e) => {
      loadAndApplyLanguage(e.target.value);
    });
  }

  SetLangByParams()

});


const applyStoredLanguage = () => {
  const lang = localStorage.getItem("userLanguage");
  if (!lang) return;

  fetch(`/translations/${lang}.json`)
    .then((response) => response.json())
    .then((translations) => {
      const elements = document.querySelectorAll("[data-translate]");

      elements.forEach((el) => {
        const key = el.getAttribute("data-translate");
        const translatedText = translations[key];

        if (translatedText !== undefined) {
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            if (el.hasAttribute("placeholder")) {
              el.placeholder = translatedText;
            }
          } else if (el.querySelector(".menu-text, .btn-text")) {
            el.querySelector(".menu-text, .btn-text").innerText = translatedText;
          } else {
            el.innerText = translatedText;
          }
        }
      });
    })
    .catch((error) => {
      console.error(`Error loading /translations/${lang}.json:`, error);
    });
};

setInterval(() => {
  applyStoredLanguage()
}, 200);

function SetLangByParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get("lang");

  const supportedLanguages = ["en", "de", "ro", "hu"];
  if (paramLang && supportedLanguages.includes(paramLang)) {
    localStorage.setItem("userLanguage", paramLang);
    loadAndApplyLanguage(paramLang);
  }
}

