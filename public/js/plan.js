document.addEventListener("DOMContentLoaded", function () {
  const stripe = Stripe(
    "pk_test_51Ntu4ySEDamMfxQSeDUBDU24c00cIiqL83DBtsyEe1SeMipKhHGqaRKBeCuHRohgURDjjaPdqh9Hsst3yd85RzAL00xWep0NsI"
  ); // Replace with your real public key

  // Select all buttons with class 'checkout-btn'
  const buttons = document.querySelectorAll(".checkout-btn");

  buttons.forEach((button) => {
    const encryptedId = button.id.replace("checkout-button-", ""); // Extract encrypted plan ID from button ID

    button.addEventListener("click", async () => {
      try {
        const response = await fetch("/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: encryptedId,
          }),
        });

        const result = await response.json();

        if (result.type === "success") {
          await stripe.redirectToCheckout({ sessionId: result.data.sessionId });
        } else {
          alert(result.message || "Something went wrong.");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert("Payment failed. Try again later.");
      }
    });
  });
});
