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
  const userData = getSession(SESSION_KEY_USER_DATA)
  const currentPath = window.location.pathname

  // If on root (login page), and already authenticated, redirect to PIN or Dashboard
  if (currentPath === "/" || currentPath.includes("index.html")) {
    if (isAuthenticated) {
      if (isPinVerified) {
        // Decide if admin or regular user dashboard
        if (userData && userData.is_admin) {
          window.location.href = "/admin-dashboard.html" // Admin goes to admin dashboard
        } else {
          window.location.href = "/dashboard/" // Regular user goes to regular dashboard
        }
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
      // Already PIN verified, decide where to go
      if (userData && userData.is_admin) {
        window.location.href = "/admin-dashboard.html"
      } else {
        window.location.href = "/dashboard/"
      }
    }
    return // Stay on PIN page if authenticated but not verified
  }

  // For admin dashboard (admin-dashboard.html)
  if (currentPath.includes("admin-dashboard.html")) {
    if (!isAuthenticated || !isPinVerified || !userData || !userData.is_admin) {
      alert("Unauthorized access. Please log in as an administrator.")
      clearSession() // Clear any partial session data
      window.location.href = "/" // Not authenticated, PIN verified, or not admin, go to root login
    }
    return // Stay on admin dashboard if authorized
  }

  // For regular user dashboard (inside /dashboard/ folder) or any other protected page
  if (currentPath.includes("/dashboard/")) {
    if (!isAuthenticated || !isPinVerified) {
      clearSession() // Clear any partial session data
      window.location.href = "/" // Not authenticated or PIN verified, go to root login
    } else if (userData && userData.is_admin) {
      // If an admin somehow lands on user dashboard, redirect to admin dashboard
      window.location.href = "/admin-dashboard.html"
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
        setSession(SESSION_KEY_USER_DATA, data.user) // Store user data including is_admin
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
        const userData = getSession(SESSION_KEY_USER_DATA)
        if (userData && userData.is_admin) {
          window.location.href = "/admin-dashboard.html" // Redirect to admin dashboard
        } else {
          window.location.href = "/dashboard/" // Redirect to regular user dashboard
        }
      } catch (error) {
        errorMessageDiv.textContent = error.message || "PIN verification failed. Please try again."
        errorMessageDiv.classList.remove("hidden")
      }
    })
  }
}

// --- Dashboard Specific Logic (for Admin Dashboard) ---

// --- Data Storage (Now fetched from API) ---
let users = []
let agents = []
let surveys = []
let pointTransfers = []
let redemptionRequests = []
let systemSettings = []

// --- DOM Elements (Dashboard) ---
let sidebar, mainContent, sidebarToggle, navLinks, sections
let totalUsersCard, totalSurveysCard, totalPointsCard, pendingRedemptionsCard, rewardPercentageCard
let systemSettingsTableBody,
  userManagementTableBody,
  agentManagementTableBody,
  surveyManagementTableBody,
  pointTransfersTableBody,
  redemptionRequestsTableBody,
  activityLogTableBody
let autoUserApprovalToggle, approveAllPendingUsersBtn, rejectAllPendingUsersBtn
let createSurveyForm, surveyTitleInput, surveyDescriptionInput, surveyPointsRewardInput
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
  activityLogTableBody = document.getElementById("activity-log-table-body")

  autoUserApprovalToggle = document.getElementById("auto-user-approval-toggle")
  approveAllPendingUsersBtn = document.getElementById("approve-all-pending-users-btn")
  rejectAllPendingUsersBtn = document.getElementById("reject-all-pending-users-btn")

  createSurveyForm = document.getElementById("create-survey-form")
  surveyTitleInput = document.getElementById("survey-title")
  surveyDescriptionInput = document.getElementById("survey-description")
  surveyPointsRewardInput = document.getElementById("survey-points-reward")

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

        navLinks.forEach((nav) => nav.classList.remove("active"))
        sections.forEach((sec) => sec.classList.remove("active"))

        link.classList.add("active")
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
        await renderActivityLog()
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
      case "point-transfers-section": // This is point transfer history for admin
        await renderPointTransfers()
        break
      case "redemption-requests-section":
        await renderRedemptionRequests()
        break
    }
  } catch (error) {
    console.error(`Error rendering section ${sectionId}:`, error)
    alert(
      `Failed to load data for ${sectionId.replace("-section", "").replace(/-/g, " ")}. Please try again or check console for details.`,
    )
  }
}

// --- Dashboard Overview ---
async function renderDashboardOverview() {
  try {
    const stats = await fetchApi("/admin/dashboard/stats", "GET", null, true)
    if (totalUsersCard) totalUsersCard.textContent = stats.total_users?.toLocaleString() || "0"
    if (totalSurveysCard) totalSurveysCard.textContent = stats.total_surveys_completed?.toLocaleString() || "0"
    if (totalPointsCard) totalPointsCard.textContent = stats.total_points_distributed?.toLocaleString() || "0"
    if (pendingRedemptionsCard) pendingRedemptionsCard.textContent = stats.pending_redemptions?.toLocaleString() || "0"
    if (rewardPercentageCard)
      rewardPercentageCard.textContent = stats.reward_percentage ? stats.reward_percentage + "%" : "N/A"
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
    // This endpoint is for the logged-in user's activity (i.e., admin's activity)
    const logs = await fetchApi("/dashboard/activity", "GET", null, true)
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
  if (!systemSettingsTableBody) return
  systemSettingsTableBody.innerHTML = ""
  try {
    systemSettings = await fetchApi("/admin/settings", "GET", null, true)

    systemSettings.forEach((setting) => {
      const row = systemSettingsTableBody.insertRow()
      const isCheckbox = ["auto_user_approval"].includes(setting.key) // Explicitly list keys that should be checkboxes
      const inputType = isCheckbox ? "checkbox" : "text"
      const inputValue = setting.value

      const displayKey = setting.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

      row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${displayKey}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <label class="${isCheckbox ? "toggle-container" : ""}">
                    <input type="${inputType}"
                           id="setting-value-${setting.key}"
                           class="setting-value-input ${isCheckbox ? "sr-only" : "border border-gray-300 rounded-md p-1 w-full"}"
                           value="${inputValue}"
                           ${isCheckbox && inputValue === "true" ? "checked" : ""}>
                    ${isCheckbox ? `<div class="toggle-bg"></div><div class="toggle-dot"></div>` : ""}
                </label>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button id="save-setting-${setting.key}" class="save-setting-btn text-indigo-600 hover:text-indigo-900 ml-2">Save</button>
            </td>
        `
    })

    document.querySelectorAll(".save-setting-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const key = e.target.id.replace("save-setting-", "")
        const input = document.getElementById(`setting-value-${key}`)
        const newValue = input.type === "checkbox" ? input.checked.toString() : input.value
        const setting = systemSettings.find((s) => s.key === key)

        try {
          await fetchApi(
            "/admin/settings",
            "PUT",
            { key, value: newValue, description: setting?.description || "" },
            true,
          )
          alert(`Setting "${key}" updated to "${newValue}"`)
          await renderSystemSettings() // Re-render to reflect changes
          await renderDashboardOverview() // Update dashboard stats if settings change
        } catch (error) {
          alert(`Failed to save setting: ${error.message}`)
        }
      })
    })
  } catch (error) {
    console.error("Failed to fetch system settings:", error)
    alert(`Failed to load system settings: ${error.message}`)
  }
}

// --- User Management ---
async function renderUserManagement() {
  if (!userManagementTableBody) return
  userManagementTableBody.innerHTML = ""
  try {
    users = await fetchApi("/admin/users", "GET", null, true)

    // Ensure system settings are loaded for the auto-approval toggle
    if (systemSettings.length === 0) {
      await renderSystemSettings() // Load settings if not already loaded
    }
    const autoApprovalSetting = systemSettings.find((s) => s.key === "auto_user_approval")

    if (autoUserApprovalToggle && autoApprovalSetting) {
      const isChecked = autoApprovalSetting.value === "true"
      autoUserApprovalToggle.checked = isChecked

      // Manually update the visual state of the toggle
      const toggleBg = autoUserApprovalToggle.nextElementSibling
      const toggleDot = toggleBg.nextElementSibling

      if (isChecked) {
        toggleBg.classList.remove("bg-gray-600")
        toggleBg.classList.add("bg-green-500")
        toggleDot.classList.add("translate-x-full")
      } else {
        toggleBg.classList.remove("bg-green-500")
        toggleBg.classList.add("bg-gray-600")
        toggleDot.classList.remove("translate-x-full")
      }
    }

    users.forEach((user) => {
      const row = userManagementTableBody.insertRow()
      const statusClass = `status-${user.status}`
      row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${statusClass}">${user.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${user.is_admin ? "Admin" : user.is_agent ? "Agent" : "User"}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                ${user.status === "pending" ? `<button id="approve-user-${user.id}" class="action-btn approve-user-btn text-green-600 hover:text-green-900 mr-2">Approve</button>` : ""}
                ${user.status === "pending" ? `<button id="reject-user-${user.id}" class="action-btn reject-user-btn text-red-600 hover:text-red-900 mr-2">Reject</button>` : ""}
                ${user.status === "approved" ? `<button id="suspend-user-${user.id}" class="action-btn suspend-user-btn text-yellow-600 hover:text-yellow-900 mr-2">Suspend</button>` : ""}
                ${user.status === "suspended" ? `<button id="reactivate-user-${user.id}" class="action-btn reactivate-user-btn text-blue-600 hover:text-blue-900 mr-2">Reactivate</button>` : ""}
                ${!user.is_admin ? `${!user.is_agent ? `<button id="promote-user-${user.id}" class="action-btn promote-user-btn text-purple-600 hover:text-purple-900">Promote to Agent</button>` : `<button id="demote-user-${user.id}" class="action-btn demote-user-btn text-orange-600 hover:text-orange-900">Demote from Agent</button>`}` : ""}
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
function setupUserManagementListeners() {
  if (autoUserApprovalToggle) {
    autoUserApprovalToggle.addEventListener("change", async (e) => {
      const newValue = e.target.checked.toString() // "true" or "false"
      try {
        // Call the API to update the system setting
        await fetchApi(
          "/admin/settings",
          "PUT",
          { key: "auto_user_approval", value: newValue, description: "Automatically approve new user registrations" },
          true,
        )
        alert(`Auto User Approval set to: ${newValue}`)
        // Visually update the toggle's background and dot
        const toggleBg = autoUserApprovalToggle.nextElementSibling // The div with class toggle-bg
        const toggleDot = toggleBg.nextElementSibling // The div with class toggle-dot

        if (e.target.checked) {
          toggleBg.classList.remove("bg-gray-600")
          toggleBg.classList.add("bg-green-500")
          toggleDot.classList.add("translate-x-full")
        } else {
          toggleBg.classList.remove("bg-green-500")
          toggleBg.classList.add("bg-gray-600")
          toggleDot.classList.remove("translate-x-full")
        }
      } catch (error) {
        alert(`Failed to update auto user approval: ${error.message}`)
        // Revert the toggle state if API call fails
        e.target.checked = !e.target.checked
      }
    })
  }
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
  if (!surveyManagementTableBody) return
  surveyManagementTableBody.innerHTML = ""
  try {
    surveys = await fetchApi("/admin/surveys", "GET", null, true)

    surveys.forEach((survey) => {
      const row = surveyManagementTableBody.insertRow()
      row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${survey.title}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${survey.points_reward}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${survey.is_active ? "Active" : "Inactive"}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(survey.created_at).toLocaleDateString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <!-- Add action buttons for surveys if needed (e.g., edit, activate/deactivate) -->
            </td>
        `
    })

    // Setup form for creating new surveys
    if (createSurveyForm) {
      createSurveyForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        const title = surveyTitleInput.value
        const description = surveyDescriptionInput.value
        const points_reward = Number.parseFloat(surveyPointsRewardInput.value)

        if (!title || isNaN(points_reward) || points_reward <= 0) {
          alert("Please enter a valid title and positive points reward for the survey.")
          return
        }

        try {
          await fetchApi("/admin/surveys", "POST", { title, description, points_reward }, true)
          alert("Survey created successfully!")
          createSurveyForm.reset()
          renderSurveyManagement() // Re-render surveys table
        } catch (error) {
          alert(`Failed to create survey: ${error.message}`)
        }
      })
    }
  } catch (error) {
    console.error("Failed to fetch surveys:", error)
    alert(`Failed to load survey data: ${error.message}`)
  }
}

// --- Point Transfers (Admin View All) ---
async function renderPointTransfers() {
  if (!pointTransfersTableBody) return
  pointTransfersTableBody.innerHTML = ""
  try {
    pointTransfers = await fetchApi("/admin/point-transfers", "GET", null, true)

    pointTransfers.forEach((transfer) => {
      const row = pointTransfersTableBody.insertRow()
      row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${transfer.from_user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transfer.to_user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transfer.amount}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(transfer.created_at).toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <!-- Add action buttons for point transfers if needed -->
            </td>
        `
    })
  } catch (error) {
    console.error("Failed to fetch point transfers:", error)
    alert(`Failed to load point transfer data: ${error.message}`)
  }
}

// --- Redemption Requests ---
async function renderRedemptionRequests() {
  if (!redemptionRequestsTableBody) return
  redemptionRequestsTableBody.innerHTML = ""
  try {
    redemptionRequests = await fetchApi("/admin/redemptions", "GET", null, true)

    redemptionRequests.forEach((request) => {
      const row = redemptionRequestsTableBody.insertRow()
      const user = users.find((u) => u.id === request.user_id) // Find user by ID for displaying name/email
      const userNameOrId = user ? user.name : `User ID: ${request.user_id}`
      const statusClass = `status-${request.status}`

      row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${userNameOrId}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.points_amount}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.type}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${statusClass}">${request.status}</span>
            </td>
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
        } else if (sortBy === "timestamp" || sortBy === "created") {
          // Handle 'created' for surveys
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

// --- Global Event Listener for all pages ---
document.addEventListener("DOMContentLoaded", async () => {
  protectRoute() // Run protection on every page load

  // Initialize specific page logic based on current URL
  const currentPath = window.location.pathname

  if (currentPath.includes("admin-dashboard.html")) {
    initializeDashboardElements()
    setupSidebarAndNav()
    setupTableSorting() // Apply sorting to all tables

    // Load initial data for admin dashboard
    await renderSystemSettings() // System settings must be loaded first for auto-approval toggle
    await renderDashboardOverview()
    await renderActivityLog()
    await renderUserManagement() // This will also handle the auto-approval toggle state
    await renderAgentManagement()
    await renderSurveyManagement()
    await renderPointTransfers()
    await renderRedemptionRequests()

    // Logout button functionality
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        alert("Logging out...")
        clearSession()
        window.location.href = "/" // Redirect to root login page
      })
    }

    // Set Dashboard Overview as active by default (if not already set by initial page load)
    if (!document.querySelector(".nav-link.active") && document.getElementById("dashboard-overview-link")) {
      document.getElementById("dashboard-overview-link").classList.add("active")
    }
    if (!document.querySelector(".section-content.active") && document.getElementById("dashboard-overview-section")) {
      document.getElementById("dashboard-overview-section").classList.add("active")
    }
  } else if (currentPath === "/" || currentPath.includes("index.html")) {
    handleLoginForm()
  } else if (currentPath.includes("/pin/")) {
    handlePinForm()
  }
  // For other dashboard pages (non-admin, if they exist), they would have their own initialization logic here.
})
