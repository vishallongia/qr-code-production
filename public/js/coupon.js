// UI Handler
async function handleCreateCoupon(event) {
  event.preventDefault();
  const code = document.getElementById("code").value;
  const discountPercent = parseFloat(
    document.getElementById("discountPercent").value
  );
  const commissionPercent = parseFloat(
    document.getElementById("commissionPercent").value
  );
  const affiliateId = window.location.pathname.split("/").pop(); // get from URL if not passed directly

  // Custom JS validation
  if (!code) {
    showToast("Coupon code is required", "error");
    return;
  }

  if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    showToast("Discount must be a number between 0 and 100", "error");
    return;
  }

  if (
    isNaN(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    showToast("Commission must be a number between 0 and 100", "error");
    return;
  }

  if (!affiliateId || affiliateId.length < 10) {
    showToast("Invalid affiliate ID in URL", "error");
    return;
  }

  const couponData = {
    code,
    discountPercent,
    commissionPercent,
  };

  try {
    const result = await createCoupon(affiliateId, couponData);
    showToast(result.message, "success");

    // Optional: redirect or reset form
    document.getElementById("couponForm").reset();
  } catch (error) {
    showToast(error.message || "Failed to create coupon", "error");
  }
}

// API Function
async function createCoupon(affiliateId, data) {
  try {
    const response = await fetch(
      `/admindashboard/affiliate/create-coupon/${affiliateId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Coupon creation failed!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating coupon:", error);
    throw error;
  }
}

// API Function for updating a coupon
async function updateCoupon(couponId, data) {
  try {
    const response = await fetch(
      `/admindashboard/affiliate/update-coupon/${couponId}`,
      {
        method: "PUT", // PUT is generally used for update
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Coupon update failed!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating coupon:", error);
    throw error;
  }
}

// UI Handler for updating coupon
async function handleUpdateCoupon(event) {
  event.preventDefault();

  const code = document.getElementById("code").value;
  const discountPercent = parseFloat(
    document.getElementById("discountPercent").value
  );
  const commissionPercent = parseFloat(
    document.getElementById("commissionPercent").value
  );

  const pathParts = window.location.pathname.split("/");
  const couponId = pathParts[pathParts.length - 1];

  // Custom JS validation
  if (!code) {
    showToast("Coupon code is required", "error");
    return;
  }

  if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    showToast("Discount must be a number between 0 and 100", "error");
    return;
  }

  if (
    isNaN(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    showToast("Commission must be a number between 0 and 100", "error");
    return;
  }

  const couponData = {
    code,
    discountPercent,
    commissionPercent,
  };

  try {
    const result = await updateCoupon(couponId, couponData);
    showToast(result.message, "success");
    // Reload page after 1 second
    setTimeout(() => {
      location.reload();
    }, 1000);
  } catch (error) {
    showToast(error.message || "Failed to update coupon", "error");
  }
}

// API Function for deleting a coupon
async function deleteCoupon(couponId) {
  try {
    const response = await fetch(
      `/admindashboard/affiliate/delete-coupon/${couponId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Coupon deletion failed!");
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting coupon:", error);
    throw error;
  }
}

// UI Handler for deleting a coupon
async function handleDeleteCoupon(event, couponId) {
  event.preventDefault();

  const confirmed = confirm("Are you sure you want to delete this coupon?");
  if (!confirmed) return;

  try {
    const result = await deleteCoupon(couponId);
    showToast(result.message, "success");
    // Reload page after 1 second
    setTimeout(() => {
      location.reload();
    }, 1000);
  } catch (error) {
    showToast(error.message || "Failed to delete coupon", "error");
  }
}
