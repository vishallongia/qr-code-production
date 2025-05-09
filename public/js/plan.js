document.addEventListener("DOMContentLoaded", function () {
  const stripe = Stripe(
    // My Test
    "pk_test_51Ntu4ySEDamMfxQSeDUBDU24c00cIiqL83DBtsyEe1SeMipKhHGqaRKBeCuHRohgURDjjaPdqh9Hsst3yd85RzAL00xWep0NsI"
    // Live public
    // "pk_live_51RMaaSId4kz5U0VloeNDTyvwYw7Je4Vof8zROQ4KMIYblNW732YHA53rz7BI6CaujeWmvzVMGplooRYwEkpJpdp800YsPdNvsf"
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
          await stripe.redirectToCheckout({ sessionId: result.data.sessionId });
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
