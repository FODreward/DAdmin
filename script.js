// This script handles global utilities, authentication, and routing.
// It exposes `fetchApi`, `getSession`, `setSession`, `clearSession`,
// `SESSION_KEY_TOKEN`, `SESSION_KEY_USER_DATA` globally via the window object.

;(() => {
  // --- API Configuration ---
  const API_BASE_URL = "https://dansog-backend.onrender.com/api"

  // --- Session Keys ---
  const SESSION_KEY_AUTH = "isAuthenticated"
  const SESSION_KEY_TOKEN = "accessToken"
  const SESSION_KEY_PIN_VERIFIED = "isPinVerified"
  const SESSION_KEY_USER_DATA = "userData" // Store user data from login

  // --- Helper Functions for Session Storage ---
  function setSession(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value))
  }

  function getSession(key) {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) : null
  }

  function clearSession() {
    sessionStorage.clear()
  }

  // --- Generic API Fetcher ---
  async function fetchApi(endpoint, method = "GET", body = null, requiresAuth = false) {
    const url = `${API_BASE_URL}${endpoint}`
    const headers = {
      "Content-Type": "application/json",
    }

    if (requiresAuth) {
      const token = getSession(SESSION_KEY_TOKEN)
      if (!token) {
        console.error("Authentication required, but no token found. Redirecting to login.")
        clearSession()
        window.location.href = "/" // Redirect to login
        throw new Error("Unauthorized")
      }
      headers["Authorization"] = `Bearer ${token}`
    }

    const options = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()

      if (!response.ok) {
        console.error("API Error:", data.detail || response.statusText)
        throw new Error(data.detail || "Something went wrong")
      }
      return data
    } catch (error) {
      console.error("Network or API call error:", error)
      throw error // Re-throw to be caught by specific handlers
    }
  }

  // --- Authentication Check and Redirection ---
  function protectRoute() {
    const isAuthenticated = getSession(SESSION_KEY_AUTH)
    const isPinVerified = getSession(SESSION_KEY_PIN_VERIFIED)
    const currentPath = window.location.pathname

    // If on root (login page), and already authenticated, redirect to PIN or Dashboard
    if (currentPath === "/" || currentPath.includes("index.html")) {
      // Covers root index.html
      if (isAuthenticated) {
        if (isPinVerified) {
          window.location.href = "/dashboard/" // Already verified, go to dashboard folder
        } else {
          window.location.href = "/pin/" // Authenticated, but not PIN verified, go to pin folder
        }
      }
      return // Stay on login page if not authenticated
    }

    // If on PIN verify page (inside /pin/ folder)
    if (currentPath.includes("/pin/")) {
      if (!isAuthenticated) {
        window.location.href = "/" // Not authenticated, go to root login
      } else if (isPinVerified) {
        window.location.href = "/dashboard/" // Already PIN verified, go to dashboard folder
      }
      return // Stay on PIN page if authenticated but not verified
    }

    // For dashboard (inside /dashboard/ folder) or any other protected page
    if (currentPath.includes("/dashboard/")) {
      if (!isAuthenticated || !isPinVerified) {
        clearSession() // Clear any partial session data
        window.location.href = "/" // Not authenticated or PIN verified, go to root login
      }
    }
  }

  // --- Login Form Logic ---
  async function handleLoginForm() {
    const loginForm = document.getElementById("login-form")
    const emailInput = document.getElementById("email")
    const passwordInput = document.getElementById("password")
    const errorMessageDiv = document.getElementById("login-error-message")

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        const email = emailInput.value
        const password = passwordInput.value

        try {
          const data = await fetchApi("/auth/login", "POST", { email, password })
          setSession(SESSION_KEY_AUTH, true)
          setSession(SESSION_KEY_TOKEN, data.access_token)
          setSession(SESSION_KEY_USER_DATA, data.user) // Store user data
          errorMessageDiv.classList.add("hidden")
          window.location.href = "/pin/" // Redirect to PIN verification in its folder
        } catch (error) {
          errorMessageDiv.textContent = error.message || "Login failed. Please try again."
          errorMessageDiv.classList.remove("hidden")
        }
      })
    }
  }

  // --- PIN Verification Form Logic ---
  async function handlePinForm() {
    const pinForm = document.getElementById("pin-form")
    const pinInput = document.getElementById("pin")
    const errorMessageDiv = document.getElementById("pin-error-message")

    if (pinForm) {
      pinForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        const pin = pinInput.value

        try {
          await fetchApi("/auth/verify-pin", "POST", { pin }, true) // Requires auth
          setSession(SESSION_KEY_PIN_VERIFIED, true)
          errorMessageDiv.classList.add("hidden")
          window.location.href = "/dashboard/" // Redirect to dashboard in its folder
        } catch (error) {
          errorMessageDiv.textContent = error.message || "PIN verification failed. Please try again."
          errorMessageDiv.classList.remove("hidden")
        }
      })
    }
  }

  // --- Dashboard Specific Logic ---

  // --- Data Storage (Now fetched from API) ---
  let users = []
  let agents = []
  const surveys = []
  const pointTransfers = []
  let redemptionRequests = []
  const systemSettings = []

  // --- DOM Elements (Dashboard) ---
  let sidebar, mainContent, sidebarToggle, navLinks, sections
  let totalUsersCard, totalSurveysCard, totalPointsCard, pendingRedemptionsCard, rewardPercentageCard
  let systemSettingsTableBody,
    userManagementTableBody,
    agentManagementTableBody,
    surveyManagementTableBody,
    pointTransfersTableBody,
    redemptionRequestsTableBody,
    activityLogTableBody // Added
  let autoUserApprovalToggle, approveAllPendingUsersBtn, rejectAllPendingUsersBtn
  let sendPointsForm
  let logoutButton

  function initializeDashboardElements() {
    sidebar = document.getElementById("sidebar")
    mainContent = document.getElementById("main-content")
    sidebarToggle = document.getElementById("sidebar-toggle")
    navLinks = document.querySelectorAll("#sidebar ul li a")
    sections = document.querySelectorAll(".section-content")

    totalUsersCard = document.getElementById("total-users-card")
    totalSurveysCard = document.getElementById("total-surveys-card")
    totalPointsCard = document.getElementById("total-points-card")
    pendingRedemptionsCard = document.getElementById("pending-redemptions-card")
    rewardPercentageCard = document.getElementById("reward-percentage-card")

    systemSettingsTableBody = document.getElementById("system-settings-table-body")
    userManagementTableBody = document.getElementById("user-management-table-body")
    agentManagementTableBody = document.getElementById("agent-management-table-body")
    surveyManagementTableBody = document.getElementById("survey-management-table-body")
    pointTransfersTableBody = document.getElementById("point-transfers-table-body")
    redemptionRequestsTableBody = document.getElementById("redemption-requests-table-body")
    activityLogTableBody = document.getElementById("activity-log-table-body") // Added

    autoUserApprovalToggle = document.getElementById("auto-user-approval-toggle")
    approveAllPendingUsersBtn = document.getElementById("approve-all-pending-users-btn")
    rejectAllPendingUsersBtn = document.getElementById("reject-all-pending-users-btn")

    sendPointsForm = document.getElementById("send-points-form")
    logoutButton = document.getElementById("logout-button")
  }

  // --- Sidebar & Navigation Logic ---
  function setupSidebarAndNav() {
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed")
        mainContent.classList.toggle("collapsed")
      })
    }

    if (navLinks) {
      navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault()
          const targetSectionId = link.id.replace("-link", "-section")

          navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
          sections.forEach((sec) => sec.classList.remove("active"))

          link.classList.add("bg-gray-700", "text-white")
          document.getElementById(targetSectionId).classList.add("active")

          renderSectionContent(targetSectionId)
        })
      })
    }
  }

  async function renderSectionContent(sectionId) {
    // Add loading indicators here if desired
    try {
      switch (sectionId) {
        case "dashboard-overview-section":
          await renderDashboardOverview()
          await renderActivityLog() // Also render activity log on dashboard overview
          break
        case "system-settings-section":
          await renderSystemSettings()
          break
        case "user-management-section":
          await renderUserManagement()
          break
        case "agent-management-section":
          await renderAgentManagement()
          break
        case "survey-management-section":
          await renderSurveyManagement()
          break
        case "point-transfers-section":
          await renderPointTransfers()
          break
        case "redemption-requests-section":
          await renderRedemptionRequests()
          break
      }
    } catch (error) {
      console.error(`Error rendering section ${sectionId}:`, error)
      alert(
        `Failed to load data for ${sectionId.replace("-section", "").replace("-", " ")}. Please try again or check console for details.`,
      )
    }
  }

  // --- Dashboard Overview ---
  async function renderDashboardOverview() {
    try {
      const stats = await fetchApi("/admin/dashboard/stats", "GET", null, true) // Fetch admin dashboard stats
      if (totalUsersCard) totalUsersCard.textContent = stats.total_users?.toLocaleString() || "0"
      if (totalSurveysCard) totalSurveysCard.textContent = stats.total_surveys_completed?.toLocaleString() || "0"
      if (totalPointsCard) totalPointsCard.textContent = stats.total_points_distributed?.toLocaleString() || "0"
      if (pendingRedemptionsCard)
        pendingRedemptionsCard.textContent = stats.pending_redemptions?.toLocaleString() || "0"
      if (rewardPercentageCard) rewardPercentageCard.textContent = stats.reward_percentage + "%" || "N/A"
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error)
      alert(`Failed to load dashboard overview: ${error.message}`)
    }
  }

  // --- Activity Log ---
  async function renderActivityLog() {
    if (!activityLogTableBody) return
    activityLogTableBody.innerHTML = ""
    try {
      const logs = await fetchApi("/dashboard/activity", "GET", null, true) // User's activity log
      logs.forEach((log) => {
        const row = activityLogTableBody.insertRow()
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(log.timestamp).toLocaleString()}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${log.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.message}</td>
        `
      })
    } catch (error) {
      console.error("Failed to fetch activity logs:", error)
      alert(`Failed to load activity logs: ${error.message}`)
    }
  }

  // --- System Settings ---
  async function renderSystemSettings() {
  const systemSettingsTableBody = document.getElementById("system-settings-table-body");
  if (!systemSettingsTableBody) return;

  systemSettingsTableBody.innerHTML = "";

  try {
    const systemSettings = await fetchApi("/admin/settings", "GET", null, true);

    systemSettings.forEach((setting) => {
      const isToggle = setting.key.includes("approval"); // customize this logic if needed
      const isChecked = setting.value === "true";

      const row = document.createElement("tr");
      row.setAttribute("data-key", setting.key);

      row.innerHTML = `
        <td class="px-4 py-2 font-medium text-gray-800">
          ${setting.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
        </td>
        <td class="px-4 py-2">
          ${
            isToggle
              ? `
            <label class="relative inline-block w-14 h-8">
              <input type="checkbox" class="sr-only setting-toggle" id="${setting.key}-toggle" ${isChecked ? "checked" : ""} />
              <div class="block w-14 h-8 rounded-full ${isChecked ? "bg-green-500" : "bg-gray-400"} toggle-bg"></div>
              <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition toggle-dot ${
                isChecked ? "translate-x-full" : ""
              }"></div>
            </label>
            <span class="ml-3 text-sm font-semibold text-gray-700" id="${setting.key}-status">${
                  isChecked ? "ON" : "OFF"
                }</span>
          `
              : `<input type="text" value="${setting.value}" class="border border-gray-300 rounded px-2 py-1 w-full setting-text" id="${setting.key}-input">`
          }
        </td>
        <td class="px-4 py-2">
          <button class="btn btn-primary save-setting-btn" data-setting="${setting.key}">Save</button>
        </td>
      `;

      systemSettingsTableBody.appendChild(row);

      // Toggle logic
      if (isToggle) {
        const input = row.querySelector(`#${setting.key}-toggle`);
        const bg = row.querySelector(".toggle-bg");
        const dot = row.querySelector(".toggle-dot");
        const status = row.querySelector(`#${setting.key}-status`);

        input.addEventListener("change", () => {
          const checked = input.checked;
          bg.classList.toggle("bg-gray-400", !checked);
          bg.classList.toggle("bg-green-500", checked);
          dot.classList.toggle("translate-x-full", checked);
          status.textContent = checked ? "ON" : "OFF";
        });
      }

      // Save logic
      const saveBtn = row.querySelector(".save-setting-btn");
      saveBtn.addEventListener("click", async () => {
        let value;
        if (isToggle) {
          const input = row.querySelector(`#${setting.key}-toggle`);
          value = input.checked.toString();
        } else {
          const input = row.querySelector(`#${setting.key}-input`);
          value = input.value.trim();
        }

        try {
          await fetchApi("/admin/settings", "PUT", { key: setting.key, value }, true);
          alert(`Setting "${setting.key}" updated successfully.`);
        } catch (err) {
          console.error("Error updating setting:", err);
          alert(`Failed to update "${setting.key}".`);
        }
      });
    });
  } catch (err) {
    console.error("Failed to load system settings:", err);
    alert("Could not load system settings.");
  }
  }
  
  // --- User Management ---
  async function renderUserManagement() {
    if (!userManagementTableBody) return
    userManagementTableBody.innerHTML = ""
    try {
      users = await fetchApi("/admin/users", "GET", null, true) // Fetch all users

      users.forEach((user) => {
        const row = userManagementTableBody.insertRow()
        row.innerHTML = `
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.name}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${user.status}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${user.is_admin ? "Admin" : user.is_agent ? "Agent" : "User"}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  ${user.status === "pending" ? `<button id="approve-user-${user.id}" class="action-btn approve-user-btn text-green-600 hover:text-green-900 mr-2">Approve</button>` : ""}
                  ${user.status === "pending" ? `<button id="reject-user-${user.id}" class="action-btn reject-user-btn text-red-600 hover:text-red-900 mr-2">Reject</button>` : ""}
                  ${user.status === "approved" ? `<button id="suspend-user-${user.id}" class="action-btn suspend-user-btn text-yellow-600 hover:text-yellow-900 mr-2">Suspend</button>` : ""}
                  ${user.status === "suspended" ? `<button id="reactivate-user-${user.id}" class="action-btn reactivate-user-btn text-blue-600 hover:text-blue-900 mr-2">Reactivate</button>` : ""}
                  ${!user.is_agent ? `<button id="promote-user-${user.id}" class="action-btn promote-user-btn text-purple-600 hover:text-purple-900">Promote to Agent</button>` : `<button id="demote-user-${user.id}" class="action-btn demote-user-btn text-orange-600 hover:text-orange-900">Demote from Agent</button>`}
              </td>
          `
      })

      document.querySelectorAll(".approve-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("approve-user-", "")
          updateUserStatus(userId, "approved")
        })
      })
      document.querySelectorAll(".reject-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("reject-user-", "")
          updateUserStatus(userId, "rejected")
        })
      })
      document.querySelectorAll(".suspend-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("suspend-user-", "")
          updateUserStatus(userId, "suspended")
        })
      })
      document.querySelectorAll(".reactivate-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("reactivate-user-", "")
          updateUserStatus(userId, "approved") // Backend uses 'approved' for reactivate
        })
      })
      document.querySelectorAll(".promote-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("promote-user-", "")
          promoteUserToAgent(userId, true)
        })
      })
      document.querySelectorAll(".demote-user-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("demote-user-", "")
          promoteUserToAgent(userId, false)
        })
      })

      // Bulk actions
      if (approveAllPendingUsersBtn) {
        approveAllPendingUsersBtn.addEventListener("click", async () => {
          const pendingUserIds = users.filter((user) => user.status === "pending").map((user) => user.id)
          if (pendingUserIds.length > 0) {
            try {
              await fetchApi("/admin/users/bulk-status", "PUT", { user_ids: pendingUserIds, status: "approved" }, true)
              alert("All pending users approved!")
              renderUserManagement()
              renderDashboardOverview()
            } catch (error) {
              alert(`Failed to bulk approve users: ${error.message}`)
            }
          } else {
            alert("No pending users to approve.")
          }
        })
      }

      if (rejectAllPendingUsersBtn) {
        rejectAllPendingUsersBtn.addEventListener("click", async () => {
          const pendingUserIds = users.filter((user) => user.status === "pending").map((user) => user.id)
          if (pendingUserIds.length > 0) {
            try {
              await fetchApi("/admin/users/bulk-status", "PUT", { user_ids: pendingUserIds, status: "rejected" }, true)
              alert("All pending users rejected!")
              renderUserManagement()
              renderDashboardOverview()
            } catch (error) {
              alert(`Failed to bulk reject users: ${error.message}`)
            }
          } else {
            alert("No pending users to reject.")
          }
        })
      }

      // Call the new setup function after elements are rendered
      setupUserManagementListeners()
    } catch (error) {
      console.error("Failed to fetch users:", error)
      alert(`Failed to load user data: ${error.message}`)
    }
  }

  // Add this new function:
  async function setupUserManagementListeners() {
  const toggle = document.getElementById("auto-user-approval-toggle")
  if (!toggle) return

  // Load current setting
  try {
    const res = await fetchApi("/admin/settings", "GET", null, true)
    const setting = res.find((s) => s.key === "auto_user_approval")

    if (setting) {
      toggle.checked = setting.value === "true"
    }
  } catch (error) {
    console.error("Failed to load auto approval setting:", error)
  }

  // Listen for toggle changes
  toggle.addEventListener("change", async (e) => {
    const newValue = e.target.checked.toString()

    try {
      await fetchApi(
        "/admin/settings",
        "PUT",
        {
          key: "auto_user_approval",
          value: newValue,
          description: "Automatically approve new user registrations",
        },
        true
      )

      alert(`Auto User Approval set to: ${newValue}`)
    } catch (error) {
      alert(`Failed to update setting: ${error.message}`)
      e.target.checked = !e.target.checked
    }
  })
  }
  
  async function updateUserStatus(userId, newStatus) {
    try {
      await fetchApi(`/admin/users/${userId}/status`, "PUT", { status: newStatus }, true)
      alert(`User status updated to ${newStatus}.`)
      renderUserManagement() // Re-render table
      renderDashboardOverview()
    } catch (error) {
      alert(`Failed to update user status: ${error.message}`)
    }
  }

  async function promoteUserToAgent(userId, isAgent) {
    try {
      const data = await fetchApi(
        `/admin/users/${userId}/agent`,
        "PUT",
        { user_id: Number.parseInt(userId), is_agent: isAgent },
        true,
      )
      alert(`Agent role ${isAgent ? "assigned" : "removed"}. Referral code: ${data.referral_code || "N/A"}`)
      renderUserManagement() // Re-render user table
      renderAgentManagement() // Re-render agent table
    } catch (error) {
      alert(`Failed to update agent role: ${error.message}`)
    }
  }

  // --- Agent Management ---
  async function renderAgentManagement() {
    if (!agentManagementTableBody) return
    agentManagementTableBody.innerHTML = ""
    try {
      const allUsers = await fetchApi("/admin/users", "GET", null, true)
      agents = allUsers.filter((user) => user.is_agent) // Filter agents from all users

      agents.forEach((agent) => {
        const row = agentManagementTableBody.insertRow()
        row.innerHTML = `
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${agent.name}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${agent.referral_code || "N/A"}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${agent.referred_users_count || 0}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button id="demote-agent-${agent.id}" class="action-btn demote-agent-btn text-red-600 hover:text-red-900">Demote Agent</button>
              </td>
          `
      })

      document.querySelectorAll(".demote-agent-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const agentId = e.target.id.replace("demote-agent-", "")
          promoteUserToAgent(agentId, false) // Use the same promote/demote function
        })
      })
    } catch (error) {
      console.error("Failed to fetch agents:", error)
      alert(`Failed to load agent data: ${error.message}`)
    }
  }

  // --- Survey Management ---
  async function renderSurveyManagement() {
    const surveyManagementTableBody = document.getElementById("surveyManagementTableBody")
    if (!surveyManagementTableBody) return

    surveyManagementTableBody.innerHTML = ""

    try {
      const surveys = await fetchApi("/admin/surveys", "GET", null, true) // Fetch all surveys for admin

      surveys.forEach((survey) => {
        const row = surveyManagementTableBody.insertRow()
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${survey.title}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${survey.points_reward}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${survey.is_active ? "Active" : "Inactive"}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(survey.created_at).toLocaleDateString()}</td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button
              class="text-indigo-600 hover:text-indigo-900 toggle-survey-btn"
              data-id="${survey.id}"
              data-status="${survey.is_active}">
              ${survey.is_active ? "Deactivate" : "Activate"}
            </button>
          </td>
        `
      })

      // Attach click event for activate/deactivate
      document.querySelectorAll(".toggle-survey-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const surveyId = btn.getAttribute("data-id")
          const currentStatus = btn.getAttribute("data-status") === "true"
          const newStatus = !currentStatus

          try {
            await fetchApi(`/admin/surveys/${surveyId}/status`, "PUT", { is_active: newStatus }, true)
            alert(`Survey has been ${newStatus ? "activated" : "deactivated"}.`)
            renderSurveyManagement() // Refresh table
          } catch (err) {
            alert("Failed to update survey status.")
            console.error(err)
          }
        })
      })
    } catch (error) {
      console.error("Failed to fetch surveys:", error)
      alert(`Failed to load survey data: ${error?.message || "Unknown error"}`)
    }
  }

  // --- Point Transfers ---
  let currentPage = 1
  const pageSize = 5
  let fullTransferList = []

  async function renderPointTransfers() {
    const tbody = document.getElementById("pointTransfersTableBody")
    const startDate = document.getElementById("filterStartDate").value
    const endDate = document.getElementById("filterEndDate").value
    const searchEmail = document.getElementById("searchEmail").value.toLowerCase()

    tbody.innerHTML = ""

    try {
      // Fetch all transfers once
      const transfers = await fetchApi("/admin/point-transfers", "GET", null, true)

      // Filter by date and email
      fullTransferList = transfers.filter((t) => {
        const createdAt = new Date(t.created_at)
        const fromEmail = t.from_user?.email?.toLowerCase() || ""
        const toEmail = t.to_user?.email?.toLowerCase() || ""

        const matchEmail = !searchEmail || fromEmail.includes(searchEmail) || toEmail.includes(searchEmail)

        const matchDate =
          (!startDate || createdAt >= new Date(startDate)) && (!endDate || createdAt <= new Date(endDate + "T23:59:59"))

        return matchEmail && matchDate
      })

      // Pagination
      const start = (currentPage - 1) * pageSize
      const paginatedTransfers = fullTransferList.slice(start, start + pageSize)

      // Render table
      if (paginatedTransfers.length === 0) {
        const row = tbody.insertRow()
        row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No point transfers found.</td>`
      } else {
        paginatedTransfers.forEach((t) => {
          const row = tbody.insertRow()
          row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${t.from_user?.email || "N/A"}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${t.to_user?.email || "N/A"}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${t.amount}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${new Date(t.created_at).toLocaleString()}</td>
            <td class="px-6 py-4 text-right text-sm font-medium"></td>
          `
        })
      }

      updatePaginationDisplay()
    } catch (err) {
      console.error("Failed to fetch transfers:", err)
      alert("Error loading transfers.")
    }
  }

  function updatePaginationDisplay() {
    const total = fullTransferList.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const info = document.getElementById("paginationInfo")
    info.textContent = `Page ${currentPage} of ${totalPages}`
  }

  function nextPage() {
    const totalPages = Math.ceil(fullTransferList.length / pageSize)
    if (currentPage < totalPages) {
      currentPage++
      renderPointTransfers()
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--
      renderPointTransfers()
    }
  }

  // --- Redemption Requests ---
  async function renderRedemptionRequests() {
    if (!redemptionRequestsTableBody) return
    redemptionRequestsTableBody.innerHTML = ""
    try {
      redemptionRequests = await fetchApi("/admin/redemptions", "GET", null, true) // Admin endpoint for all redemptions

      redemptionRequests.forEach((request) => {
        const row = redemptionRequestsTableBody.insertRow()
        row.innerHTML = `
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${request.user_id}</td> <!-- User ID, ideally user email/name -->
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.points_amount}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.type}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${request.status}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  ${request.status === "pending" ? `<button id="approve-redemption-${request.id}" class="action-btn approve-redemption-btn text-green-600 hover:text-green-900 mr-2">Approve</button>` : ""}
                  ${request.status === "pending" ? `<button id="reject-redemption-${request.id}" class="action-btn reject-redemption-btn text-red-600 hover:text-red-900">Reject</button>` : ""}
              </td>
          `
      })

      document.querySelectorAll(".approve-redemption-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const requestId = e.target.id.replace("approve-redemption-", "")
          updateRedemptionStatus(requestId, "approve") // Backend expects 'approve' or 'reject'
        })
      })
      document.querySelectorAll(".reject-redemption-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const requestId = e.target.id.replace("reject-redemption-", "")
          updateRedemptionStatus(requestId, "reject") // Backend expects 'approve' or 'reject'
        })
      })
    } catch (error) {
      console.error("Failed to fetch redemption requests:", error)
      alert(`Failed to load redemption requests: ${error.message}`)
    }
  }

  async function updateRedemptionStatus(requestId, action) {
    try {
      await fetchApi(`/admin/redemptions/${requestId}/process?action=${action}`, "PUT", null, true)
      alert(`Redemption request ${requestId} status updated to ${action}.`)
      renderRedemptionRequests()
      renderDashboardOverview()
    } catch (error) {
      alert(`Failed to update redemption status: ${error.message}`)
    }
  }

  // --- Table Sorting Logic ---
  function setupTableSorting() {
    document.querySelectorAll(".sortable-header").forEach((header) => {
      header.addEventListener("click", () => {
        const table = header.closest("table")
        const tbody = table.querySelector("tbody")
        const rows = Array.from(tbody.querySelectorAll("tr"))
        const sortBy = header.dataset.sortBy
        const isAsc = header.classList.contains("asc")

        table.querySelectorAll(".sortable-header").forEach((h) => {
          h.classList.remove("asc", "desc")
        })

        const newIsAsc = !isAsc
        header.classList.add(newIsAsc ? "asc" : "desc")

        rows.sort((a, b) => {
          const aText = a
            .querySelector(`td:nth-child(${Array.from(header.parentNode.children).indexOf(header) + 1})`)
            .textContent.trim()
          const bText = b
            .querySelector(`td:nth-child(${Array.from(header.parentNode.children).indexOf(header) + 1})`)
            .textContent.trim()

          let valA = aText
          let valB = bText

          if (
            !isNaN(Number.parseFloat(aText)) &&
            isFinite(aText) &&
            !isNaN(Number.parseFloat(bText)) &&
            isFinite(bText)
          ) {
            valA = Number.parseFloat(aText)
            valB = Number.parseFloat(bText)
          } else if (sortBy === "timestamp") {
            valA = new Date(aText).getTime()
            valB = new Date(bText).getTime()
          }

          if (valA < valB) {
            return newIsAsc ? -1 : 1
          }
          if (valA > valB) {
            return newIsAsc ? 1 : -1
          }
          return 0
        })

        rows.forEach((row) => tbody.appendChild(row))
      })
    })
  }

  // --- Send Points Form Logic ---
  function setupSendPointsForm() {
    const sendPointsForm = document.getElementById("send-points-form")
    if (!sendPointsForm) return

    sendPointsForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const fromUserEmail = document.getElementById("from-user-email").value
      const toUserEmail = document.getElementById("to-user-email").value
      const pointsAmount = document.getElementById("points-amount").value

      try {
        await fetchApi(
          "/admin/point-transfers",
          "POST",
          { from_user_email: fromUserEmail, to_user_email: toUserEmail, points_amount: pointsAmount },
          true,
        )
        alert("Points sent successfully.")
        renderPointTransfers() // Re-render table
      } catch (error) {
        alert(`Failed to send points: ${error.message}`)
      }
    })
  }

  // --- Global Event Listener for all pages ---
  document.addEventListener("DOMContentLoaded", () => {
    protectRoute() // Run protection on every page load

    // Initialize specific page logic based on current URL
    const currentPath = window.location.pathname

    if (currentPath === "/" || currentPath.includes("index.html")) {
      // Covers root index.html (login)
      handleLoginForm()
    } else if (currentPath.includes("/pin/")) {
      // Covers /pin/index.html
      handlePinForm()
    } else if (currentPath.includes("/dashboard/")) {
      initializeDashboardElements()
      setupSidebarAndNav()
      setupSendPointsForm()
      setupTableSorting()

      // Set Dashboard Overview as active by default
      if (document.getElementById("dashboard-overview-link")) {
        document.getElementById("dashboard-overview-link").classList.add("bg-gray-700", "text-white")
      }
      if (document.getElementById("dashboard-overview-section")) {
        document.getElementById("dashboard-overview-section").classList.add("active")
      }
      // Ensure system settings are loaded first, as user management depends on it
      renderSystemSettings() // Call this here to populate systemSettings array
      renderDashboardOverview()
      renderActivityLog() // Initial render of activity log
      setupUserManagementListeners()

      // Logout button functionality
      if (logoutButton) {
        logoutButton.addEventListener("click", () => {
          alert("Logging out...")
          clearSession()
          window.location.href = "/" // Redirect to root login page
        })
      }
    }
  })
})()
