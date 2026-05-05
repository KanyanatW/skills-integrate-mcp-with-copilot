document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupMessage = document.getElementById("signup-message");
  const authStatus = document.getElementById("auth-status");
  const loginToggle = document.getElementById("login-toggle");
  const logoutButton = document.getElementById("logout-button");
  const loginSection = document.getElementById("login-section");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");

  let teacherLoggedIn = false;

  function getAuthToken() {
    return localStorage.getItem("teacherAuthToken");
  }

  function setAuthToken(token) {
    if (token) {
      localStorage.setItem("teacherAuthToken", token);
    } else {
      localStorage.removeItem("teacherAuthToken");
    }
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function updateAuthUI(user) {
    teacherLoggedIn = Boolean(user);
    authStatus.textContent = user
      ? `Signed in as ${user.username}`
      : "Not signed in";
    logoutButton.classList.toggle("hidden", !teacherLoggedIn);
    loginToggle.classList.toggle("hidden", teacherLoggedIn);
    loginSection.classList.add("hidden");

    const formElements = signupForm.querySelectorAll("input, select, button");
    formElements.forEach((element) => {
      element.disabled = !teacherLoggedIn;
    });

    signupMessage.textContent = teacherLoggedIn
      ? "You are signed in as a teacher. You can register or unregister students."
      : "Please sign in as a teacher to register or unregister students.";
    signupMessage.className = teacherLoggedIn ? "message success" : "message info";
  }

  async function fetchCurrentUser() {
    const token = getAuthToken();
    if (!token) {
      updateAuthUI(null);
      return;
    }

    try {
      const response = await fetch("/me", {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const user = await response.json();
        updateAuthUI(user);
      } else {
        setAuthToken(null);
        updateAuthUI(null);
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      setAuthToken(null);
      updateAuthUI(null);
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const showDeleteButtons = teacherLoggedIn;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map((email) => {
                      const deleteButton = showDeleteButtons
                        ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                        : "";
                      return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                    })
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    event.preventDefault();
    if (!teacherLoggedIn) {
      showMessage("Please log in as a teacher to unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherLoggedIn) {
      showMessage("Please log in as a teacher to sign up students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginToggle.addEventListener("click", () => {
    loginSection.classList.toggle("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (response.ok) {
        setAuthToken(result.token);
        updateAuthUI(result);
        loginMessage.textContent = "Logged in successfully.";
        loginMessage.className = "message success";
        loginMessage.classList.remove("hidden");
        loginForm.reset();
        fetchActivities();
      } else {
        loginMessage.textContent = result.detail || "Login failed.";
        loginMessage.className = "message error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Login request failed. Please try again.";
      loginMessage.className = "message error";
      loginMessage.classList.remove("hidden");
      console.error("Error during login:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    setAuthToken(null);
    updateAuthUI(null);
    fetchActivities();
  });

  async function init() {
    await fetchCurrentUser();
    await fetchActivities();
  }

  init();
});
