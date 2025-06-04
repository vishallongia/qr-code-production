let selectedPlanId = "";
document.addEventListener("DOMContentLoaded", function () {
  const stripe = Stripe(
    // My Test
    // "pk_test_51Ntu4ySEDamMfxQSeDUBDU24c00cIiqL83DBtsyEe1SeMipKhHGqaRKBeCuHRohgURDjjaPdqh9Hsst3yd85RzAL00xWep0NsI"
    // Live public
    "pk_live_51RMaaSId4kz5U0VloeNDTyvwYw7Je4Vof8zROQ4KMIYblNW732YHA53rz7BI6CaujeWmvzVMGplooRYwEkpJpdp800YsPdNvsf"
  ); // Replace with your real public key

  // Select all buttons with class 'checkout-btn'
  const buttons = document.querySelectorAll(".checkout-btn");

  buttons.forEach((button) => {
    const encryptedId = button.id.replace("checkout-button-", ""); // Extract encrypted plan ID from button ID

    button.addEventListener("click", async () => {
      // 🧠 Find coupon input for this specific plan card
      const couponInput = button
        .closest(".plan-card")
        .querySelector(".coupon-input");
      const couponCode = couponInput?.value || "";
      try {
        const response = await fetch("/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: encryptedId,
            couponCode,
          }),
        });

        const result = await response.json();

        if (result.type === "success") {
          if (result.data.sessionId) {
            await stripe.redirectToCheckout({
              sessionId: result.data.sessionId,
            });
          } else {
            showToast(result.message);
            setTimeout(() => {
              location.reload(); // Reload the page
            }, 2000); // 3000 ms (3 seconds) delay before reload
          }
        } else {
          showToast(result.message || "Something went wrong.", "error");
          button.closest(".plan-card").querySelector(".coupon-input").value =
            "";
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert("Payment failed. Try again later.");
      }
    });
  });
});

function sanitizePlanId(encryptedId) {
  return encryptedId.replace(/[^a-zA-Z0-9_-]/g, ""); // Allow alphanumerics, hyphen, underscore
}

document.querySelectorAll(".add-coupon-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    selectedPlanId = this.getAttribute("data-plan-id");
    document.getElementById("theme-popup-add-coupon").style.display = "flex";
  });
});

document
  .getElementById("popup-ok-btn-add-coupon")
  .addEventListener("click", async function (e) {
    e.preventDefault(); // Prevent form submission

    const couponCode = document
      .getElementById("coupon-code-value")
      .value.trim();

    if (!couponCode || !selectedPlanId) {
      showToast("Coupon code or plan is missing.", "error");
      return;
    }

    try {
      const response = await fetch("/validate-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          couponCode: couponCode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Show success message with animation
        const sanitizedId = sanitizePlanId(selectedPlanId);
        const successMessage = document.getElementById(
          `coupon-success-message-${selectedPlanId}`
        );
        successMessage.style.display = "block";
        successMessage.style.opacity = 1;

        document.getElementById("theme-popup-add-coupon").style.display =
          "none";
        // ✅ Hide the Add Coupon button for the current plan
        const couponButton = document.getElementById(
          `add-coupon-button-${selectedPlanId}`
        );
        // ✅ Hide the Add Coupon button for the current plan
        const couponCodeTextInput = document.getElementById(
          `coupon-code-${sanitizedId}`
        );

        const planPrice = document.getElementById(`plan-price-${sanitizedId}`);
        if (couponCodeTextInput) {
          couponCodeTextInput.value = couponCode;
        }
        if (couponButton) {
          couponButton.style.display = "none";
        }
        if (planPrice) {
          planPrice.innerHTML = `${result.data.discountedPrice} <span>CHF</span>`;
        }
        showToast(result.message, "success");
        if (result.reload) {
          setTimeout(() => {
            window.location.href = "/magiccode";
          }, 1000);
        }
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      console.error("Error validating coupon:", error);
      showToast("Something went wrong. Please try again.", "error");
    }
  });

document.getElementById("close-popup").addEventListener("click", function () {
  document.getElementById("theme-popup-add-coupon").style.display = "none";
});
