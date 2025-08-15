// This script handles global utilities, authentication, and routing.
// It exposes `fetchApi`, `getSession`, `setSession`, `clearSession`,
// `SESSION_KEY_TOKEN`, `SESSION_KEY_USER_DATA` globally via the window object.

;(() => {
  // --- API Configuration ---
  const API_BASE_URL = "https://api.survecta.com/api"

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

      // --- NEW: Session Expiry Check ---
      if (response.status === 401) {
        console.warn("Session expired or unauthorized. Logging out.")
        clearSession()
        window.location.href = "/" // Redirect to login page
        throw new Error("Session expired or unauthorized.") // Stop further processing
      }
      // --- END NEW ---

      const data = await response.json()

      if (!response.ok) {
        console.error("API Error:", data.detail || response.statusText)
        // Improved error message handling
        const errorMessage = data.detail
          ? typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail)
          : response.statusText
        throw new Error(errorMessage || "Something went wrong")
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
        // Assume device fingerprint, IP, and user agent are handled on backend or not strictly required for login flow
        const device_fingerprint = "browser_fingerprint_dummy" // Replace with actual fingerprinting
        const ip_address = "127.0.0.1" // Replace with actual IP detection
        const user_agent = navigator.userAgent

        try {
          const data = await fetchApi("/auth/login", "POST", {
            email,
            password,
            device_fingerprint,
            ip_address,
            user_agent,
          })
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
  // const surveys = [] // No longer needed as surveys are fetched dynamically
  // const pointTransfers = [] // No longer needed as transfers are fetched dynamically
  // let redemptionRequests = [] // No longer needed as redemptions are fetched dynamically
  // const systemSettings = [] // No longer needed as settings are fetched dynamically

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
  let sendPointsForm
  let logoutButton
  let fraudFlagsTableBody
  let fraudRulesTableBody // Added for fraud rules

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
    rewardPercentageCard = document.getElementById("reward-percentage-card") // Added

    systemSettingsTableBody = document.getElementById("system-settings-table-body")
    userManagementTableBody = document.getElementById("user-management-table-body")
    agentManagementTableBody = document.getElementById("agent-management-table-body")
    surveyManagementTableBody = document.getElementById("survey-management-table-body")
    pointTransfersTableBody = document.getElementById("pointTransfersTableBody") // Corrected ID
    redemptionRequestsTableBody = document.getElementById("redemption-requests-table-body")
    activityLogTableBody = document.getElementById("activity-log-table-body")

    autoUserApprovalToggle = document.getElementById("auto-user-approval-toggle")
    approveAllPendingUsersBtn = document.getElementById("approve-all-pending-users-btn")
    rejectAllPendingUsersBtn = document.getElementById("reject-all-pending-users-btn")

    sendPointsForm = document.getElementById("send-points-form")
    logoutButton = document.getElementById("logout-button")
    fraudFlagsTableBody = document.getElementById("fraud-flags-table-body")
    fraudRulesTableBody = document.getElementById("fraud-rules-table-body") // Added for fraud rules
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

          // Update URL hash without full page reload
          history.pushState(null, "", `#${targetSectionId}`)

          navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
          sections.forEach((sec) => sec.classList.remove("active"))

          link.classList.add("bg-gray-700", "text-white")
          document.getElementById(targetSectionId).classList.add("active")

          renderSectionContent(targetSectionId)
        })
      })
    }

    // Handle browser back/forward buttons
    window.addEventListener("popstate", () => {
      const hash = window.location.hash.substring(1) // Remove '#'
      const targetSectionId = hash || "dashboard-overview-section" // Default if no hash

      navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
      sections.forEach((sec) => sec.classList.remove("active"))

      const correspondingLink = document.getElementById(targetSectionId.replace("-section", "-link"))
      if (correspondingLink) {
        correspondingLink.classList.add("bg-gray-700", "text-white")
      }
      document.getElementById(targetSectionId).classList.add("active")
      renderSectionContent(targetSectionId)
    })
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
          await renderSurveyManagement() // This will now show the "closed" message
          break
        case "point-transfers-section":
          await renderPointTransfers() // Fixed undeclared variable error
          break
        case "redemption-requests-section":
          await renderRedemptionRequests()
          break
        case "fraud-management-section":
          await renderFraudManagement()
          await renderFraudRules() // Render fraud rules when fraud management section is active
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
      // Note: This endpoint '/dashboard/activity' returns logs for the *current authenticated user*.
      // For a true system-wide admin activity log, a different backend endpoint would be needed.
      const logs = await fetchApi("/dashboard/activity", "GET", null, true)
      if (logs.length === 0) {
        const row = activityLogTableBody.insertRow()
        row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">No recent activity.</td>`
        return
      }
      logs.forEach((log) => {
        const row = activityLogTableBody.insertRow()
        row.innerHTML = `
          <td class="table-row-data">${new Date(log.timestamp).toLocaleString()}</td>
          <td class="table-row-data font-medium text-gray-900">${log.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</td>
          <td class="table-row-data">${log.message}</td>
        `
      })
    } catch (error) {
      console.error("Failed to fetch activity logs:", error)
      alert(`Failed to load activity logs: ${error.message}`)
    }
  }

  // --- System Settings ---
  async function renderSystemSettings() {
    const systemSettingsTableBody = document.getElementById("system-settings-table-body")
    if (!systemSettingsTableBody) return

    systemSettingsTableBody.innerHTML = ""

    try {
      const systemSettings = await fetchApi("/admin/settings", "GET", null, true)

      systemSettings.forEach((setting) => {
        // Skip rendering fraud rules in System Settings, as they are managed under Fraud Management
        const fraudRuleKeys = [
          "max_devices_per_user",
          "max_users_per_fingerprint",
          "max_ips_per_user_24h",
          "max_signups_per_fingerprint_24h",
        ]
        if (fraudRuleKeys.includes(setting.key)) {
          return // Skip this iteration
        }

        const isToggle = setting.key === "auto_user_approval" // Use specific key for toggle
        const isChecked = setting.value === "true"

        const row = document.createElement("tr")
        row.setAttribute("data-key", setting.key)

        row.innerHTML = `
          <td class="px-4 py-2 font-medium text-gray-800">
            ${setting.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            ${setting.description ? `<p class="text-xs text-gray-500 mt-1">${setting.description}</p>` : ""}
          </td>
          <td class="px-4 py-2">
            ${
              isToggle
                ? `
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer setting-toggle" id="${setting.key}-toggle" ${isChecked ? "checked" : ""} />
                <div class="toggle-bg ${isChecked ? "checked" : ""}">
                  <div class="toggle-dot ${isChecked ? "checked" : ""}"></div>
                </div>
              </label>
              <span class="ml-3 text-sm font-semibold text-gray-700" id="${setting.key}-status">${
                isChecked ? "ON" : "OFF"
              }</span>
            `
                : `<input type="text" value="${setting.value}" class="input-field" id="${setting.key}-input">`
            }
          </td>
          <td class="px-4 py-2">
            <button class="btn btn-primary save-setting-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" data-setting="${setting.key}">Save</button>
          </td>
        `

        systemSettingsTableBody.appendChild(row)

        // Toggle logic
        if (isToggle) {
          const input = row.querySelector(`#${setting.key}-toggle`)
          const toggleBg = row.querySelector(".toggle-bg")
          const toggleDot = row.querySelector(".toggle-dot")
          const status = row.querySelector(`#${setting.key}-status`)

          input.addEventListener("change", () => {
            const checked = input.checked
            if (checked) {
              toggleBg.classList.add("checked")
              toggleDot.classList.add("checked")
            } else {
              toggleBg.classList.remove("checked")
              toggleDot.classList.remove("checked")
            }
            status.textContent = checked ? "ON" : "OFF"
          })
        }

        // Save logic
        const saveBtn = row.querySelector(".save-setting-btn")
        saveBtn.addEventListener("click", async () => {
          let value
          if (isToggle) {
            const input = row.querySelector(`#${setting.key}-toggle`)
            value = input.checked.toString()
          } else {
            const input = row.querySelector(`#${setting.key}-input`)
            value = input.value.trim()
          }

          try {
            // Use the description from the fetched setting or default to empty string
            const descriptionToSend = setting.description || ""
            await fetchApi("/admin/settings", "PUT", { key: setting.key, value, description: descriptionToSend }, true)
            console.log(`Setting "${setting.key}" updated successfully.`) // Changed from alert
          } catch (err) {
            console.error("Error updating setting:", err)
            alert(`Failed to update "${setting.key}".`)
          }
        })
      })
    } catch (err) {
      console.error("Failed to load system settings:", err)
      alert("Could not load system settings.")
    }
  }

  // --- User Management ---
  async function renderUserManagement() {
    if (!userManagementTableBody) return
    userManagementTableBody.innerHTML = ""

    const searchInput = document.getElementById("user-search-input")
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ""

    try {
      users = await fetchApi("/admin/users", "GET", null, true)

      if (users.length === 0) {
        const row = userManagementTableBody.insertRow()
        row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No users found.</td>`
        return
      }

      const filteredUsers = users.filter(
        (user) =>
          !searchTerm ||
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm) ||
          user.id.toString().includes(searchTerm),
      )

      filteredUsers.forEach((user) => {
        const row = userManagementTableBody.insertRow()
        row.innerHTML = `
              <td class="table-row-data">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  ID: ${user.id}
                </span>
              </td>
              <td class="table-row-data font-medium text-gray-900">${user.name}</td>
              <td class="table-row-data">${user.email}</td>
              <td class="table-row-data text-sm text-gray-500">${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
              <td class="table-row-data capitalize">${user.status}</td>
              <td class="table-row-data capitalize">${user.is_admin ? "Admin" : user.is_agent ? "Agent" : "User"}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  ${user.status === "pending" ? `<button id="approve-user-${user.id}" class="action-btn approve-user-btn text-green-600 hover:text-green-900 mr-2">Approve</button>` : ""}
                  ${user.status === "pending" ? `<button id="reject-user-${user.id}" class="action-btn reject-user-btn text-red-600 hover:text-red-900 mr-2">Reject</button>` : ""}
                  ${user.status === "approved" ? `<button id="suspend-user-${user.id}" class="action-btn suspend-user-btn text-yellow-600 hover:text-yellow-900 mr-2">Suspend</button>` : ""}
                  ${user.status === "suspended" ? `<button id="reactivate-user-${user.id}" class="action-btn reactivate-user-btn text-blue-600 hover:text-blue-900 mr-2">Reactivate</button>` : ""}
                  ${!user.is_agent && !user.is_admin ? `<button id="promote-user-${user.id}" class="action-btn promote-user-btn text-purple-600 hover:text-purple-900">Promote to Agent</button>` : user.is_agent && !user.is_admin ? `<button id="demote-user-${user.id}" class="action-btn demote-user-btn text-orange-600 hover:text-orange-900">Demote from Agent</button>` : ""}
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
            if (confirm(`Are you sure you want to approve ${pendingUserIds.length} pending users?`)) {
              try {
                await fetchApi(
                  "/admin/users/bulk-status",
                  "PUT",
                  { user_ids: pendingUserIds, status: "approved" },
                  true,
                )
                console.log("All pending users approved!") // Changed from alert
                renderUserManagement()
                renderDashboardOverview()
              } catch (error) {
                alert(`Failed to bulk approve users: ${error.message}`)
              }
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
            if (
              confirm(
                `Are you sure you want to reject and delete ${pendingUserIds.length} pending users? This action is irreversible.`,
              )
            ) {
              try {
                await fetchApi(
                  "/admin/users/bulk-status",
                  "PUT",
                  { user_ids: pendingUserIds, status: "rejected" },
                  true,
                )
                console.log("All pending users rejected and deleted!") // Changed from alert
                renderUserManagement()
                renderDashboardOverview()
              } catch (error) {
                alert(`Failed to bulk reject users: ${error.message}`)
              }
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
    const toggleBg = toggle.nextElementSibling // The div with class toggle-bg
    const toggleDot = toggleBg.firstElementChild // The div with class toggle-dot
    const label = document.getElementById("approvalStatusLabel")

    if (!toggle) return

    function updateLabelUI(checked) {
      if (!label) return

      if (checked) {
        label.textContent = "Auto-Approval is ON"
        label.classList.remove("text-gray-500")
        label.classList.add("text-green-600", "font-semibold")
      } else {
        label.textContent = "Auto-Approval is OFF"
        label.classList.remove("text-green-600")
        label.classList.add("text-gray-500")
      }
    }

    // Load current setting
    try {
      const res = await fetchApi("/admin/settings", "GET", null, true)
      const setting = res.find((s) => s.key === "auto_user_approval")

      if (setting) {
        const isOn = setting.value === "true"
        toggle.checked = isOn
        if (isOn) {
          toggleBg.classList.add("checked")
          toggleDot.classList.add("checked")
        } else {
          toggleBg.classList.remove("checked")
          toggleDot.classList.remove("checked")
        }
        updateLabelUI(isOn)
      }
    } catch (error) {
      console.error("Failed to load auto approval setting:", error)
    }

    // Listen for toggle changes
    toggle.addEventListener("change", async (e) => {
      const newValue = e.target.checked.toString()
      const checked = e.target.checked

      if (checked) {
        toggleBg.classList.add("checked")
        toggleDot.classList.add("checked")
      } else {
        toggleBg.classList.remove("checked")
        toggleDot.classList.remove("checked")
      }

      try {
        await fetchApi(
          "/admin/settings",
          "PUT",
          {
            key: "auto_user_approval",
            value: newValue,
            description: "Automatically approve new user registrations", // Keep description for consistency
          },
          true,
        )

        updateLabelUI(e.target.checked)
        console.log(`Auto User Approval set to: ${newValue}`) // Changed from alert
      } catch (error) {
        alert(`Failed to update setting: ${error.message}`)
        e.target.checked = !e.target.checked // Revert toggle state on error
        if (e.target.checked) {
          // Revert visual state
          toggleBg.classList.add("checked")
          toggleDot.classList.add("checked")
        } else {
          toggleBg.classList.remove("checked")
          toggleDot.classList.remove("checked")
        }
        updateLabelUI(e.target.checked)
      }
    })
  }

  async function updateUserStatus(userId, newStatus) {
    try {
      if (
        newStatus === "rejected" &&
        !confirm("Are you sure you want to reject and permanently delete this user? This action is irreversible.")
      ) {
        return // Stop if user cancels
      }
      await fetchApi(`/admin/users/${userId}/status`, "PUT", { status: newStatus }, true)
      console.log(`User status updated to ${newStatus}.`) // Changed from alert
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
      console.log(`Agent role ${isAgent ? "assigned" : "removed"}. Referral code: ${data.referral_code || "N/A"}`) // Changed from alert
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

    const searchInput = document.getElementById("agent-search-input")
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ""

    try {
      const allUsers = await fetchApi("/admin/users", "GET", null, true)
      agents = allUsers.filter((user) => user.is_agent)

      if (agents.length === 0) {
        const row = agentManagementTableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No agents found.</td>`
        return
      }

      const filteredAgents = agents.filter(
        (agent) =>
          !searchTerm ||
          agent.name.toLowerCase().includes(searchTerm) ||
          agent.email.toLowerCase().includes(searchTerm) ||
          agent.id.toString().includes(searchTerm) ||
          (agent.referral_code && agent.referral_code.toLowerCase().includes(searchTerm)),
      )

      filteredAgents.forEach((agent) => {
        const row = agentManagementTableBody.insertRow()
        row.innerHTML = `
              <td class="table-row-data">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  ID: ${agent.id}
                </span>
              </td>
              <td class="table-row-data font-medium text-gray-900">${agent.name}</td>
              <td class="table-row-data">${agent.referral_code || "N/A"}</td>
              <td class="table-row-data text-sm text-gray-500">${agent.agent_appointed_at ? new Date(agent.agent_appointed_at).toLocaleDateString() : "N/A"}</td>
              <td class="table-row-data">${agent.referred_users_count || 0}</td>
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
    const surveyManagementTableBody = document.getElementById("survey-management-table-body") // Corrected ID
    if (!surveyManagementTableBody) return

    surveyManagementTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-center text-lg text-gray-600">
          Survey Management is temporarily closed for maintenance. Please check back later.
        </td>
      </tr>
    `
    // No API calls or further rendering logic here, as it's temporarily closed.
  }

  // --- Point Transfers ---
  let currentPage = 1
  const pageSize = 5
  let fullTransferList = []

  // Exposed globally for onclick in HTML
  window.renderPointTransfers = async () => {
    const tbody = document.getElementById("pointTransfersTableBody")
    const startDateInput = document.getElementById("filterStartDate")
    const endDateInput = document.getElementById("filterEndDate")
    const searchEmailInput = document.getElementById("searchEmail")

    const startDate = startDateInput.value
    const endDate = endDateInput.value
    const searchEmail = searchEmailInput.value.toLowerCase()

    tbody.innerHTML = ""

    try {
      let endpoint = `/admin/point-transfers?skip=0&limit=1000` // Fetch all to filter client-side
      if (startDate) endpoint += `&date=${startDate}` // Backend can filter by day
      if (searchEmail) endpoint += `&email=${searchEmail}` // Backend can filter by email

      // Fetch all transfers from backend first, then apply client-side date range if necessary
      const transfers = await fetchApi(endpoint, "GET", null, true)

      fullTransferList = transfers.filter((t) => {
        const createdAt = new Date(t.created_at)
        const fromEmail = t.from_user?.email?.toLowerCase() || ""
        const toEmail = t.to_user?.email?.toLowerCase() || ""

        const matchEmail = !searchEmail || fromEmail.includes(searchEmail) || toEmail.includes(searchEmail)

        // Adjust date filtering for full range if backend only filters by day
        const filterStartDateObj = startDate ? new Date(startDate + "T00:00:00") : null
        const filterEndDateObj = endDate ? new Date(endDate + "T23:59:59") : null

        const matchDate =
          (!filterStartDateObj || createdAt >= filterStartDateObj) &&
          (!filterEndDateObj || createdAt <= filterEndDateObj)

        return matchEmail && matchDate
      })

      currentPage = 1 // Reset to first page after new filter
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
            <td class="table-row-data font-medium text-gray-900">${t.from_user?.email || "N/A"}</td>
            <td class="table-row-data">${t.to_user?.email || "N/A"}</td>
            <td class="table-row-data">${t.amount}</td>
            <td class="table-row-data">${new Date(t.created_at).toLocaleString()}</td>
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

    const prevBtn = document.querySelector('button[onclick="window.prevPage()"]')
    const nextBtn = document.querySelector('button[onclick="window.nextPage()"]')

    if (prevBtn) prevBtn.disabled = currentPage === 1
    if (nextBtn) nextBtn.disabled = currentPage === totalPages
  }

  // Exposed globally for onclick in HTML
  window.nextPage = () => {
    const totalPages = Math.ceil(fullTransferList.length / pageSize)
    if (currentPage < totalPages) {
      currentPage++
      window.renderPointTransfers()
    }
  }

  // Exposed globally for onclick in HTML
  window.prevPage = () => {
    if (currentPage > 1) {
      currentPage--
      window.renderPointTransfers()
    }
  }

  // --- Redemption Requests ---

  async function renderRedemptionRequests() {
    if (!redemptionRequestsTableBody) return
    redemptionRequestsTableBody.innerHTML = ""

    try {
      const redemptionRequests = await fetchApi("/admin/redemptions", "GET", null, true) // Admin endpoint

      if (redemptionRequests.length === 0) {
        const row = redemptionRequestsTableBody.insertRow()
        row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No redemption requests found.</td>`
        return
      }

      // Sort so pending requests are on top
      redemptionRequests.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (a.status !== "pending" && b.status === "pending") return 1
        return 0
      })

      redemptionRequests.forEach((request) => {
        // Determine destination based on type
        const destination = request.destination || ""

        const row = redemptionRequestsTableBody.insertRow()
        row.innerHTML = `
          <td class="table-row-data font-medium text-gray-900">${request.user_email || request.user_id}</td>
          <td class="table-row-data">${request.points_amount}</td>
          <td class="table-row-data">${request.type}</td>
          <td class="table-row-data">${destination}</td>
          <td class="table-row-data capitalize">${request.status}</td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            ${
              request.status === "pending"
                ? `<button id="approve-redemption-${request.id}" class="action-btn approve-redemption-btn text-green-600 hover:text-green-900 mr-2">Approve</button>`
                : ""
            }
            ${
              request.status === "pending"
                ? `<button id="reject-redemption-${request.id}" class="action-btn reject-redemption-btn text-red-600 hover:text-red-900">Reject</button>`
                : ""
            }
          </td>
        `
      })

      // Attach event listeners for approve/reject buttons
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
      console.log(`Redemption request ${requestId} status updated to ${action}.`) // Changed from alert
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
      const fromUserEmailInput = document.getElementById("from-user-email")
      const toUserEmailInput = document.getElementById("to-user-email")
      const pointsAmountInput = document.getElementById("points-amount")

      const fromUserEmail = fromUserEmailInput ? fromUserEmailInput.value.trim() : null
      const toUserEmail = toUserEmailInput.value.trim()
      const pointsAmount = Number.parseInt(pointsAmountInput.value, 10)

      if (!toUserEmail || isNaN(pointsAmount) || pointsAmount <= 0) {
        alert("Please provide a valid receiver email and a positive amount of points.")
        return
      }

      const payload = {
        to_user_email: toUserEmail,
        points_amount: pointsAmount,
      }

      if (fromUserEmail) {
        payload.from_user_email = fromUserEmail
      }

      try {
        await fetchApi("/admin/point-transfers", "POST", payload, true)
        console.log("Points sent successfully.") // Changed from alert
        sendPointsForm.reset() // Clear the form
        window.renderPointTransfers() // Re-render transfers table
        renderDashboardOverview() // Update dashboard stats
      } catch (error) {
        alert(`Failed to send points: ${error.message}`)
      }
    })
  }

  // --- Fraud Management (Flags) ---
  async function renderFraudManagement() {
    if (!fraudFlagsTableBody) return
    fraudFlagsTableBody.innerHTML = ""

    try {
      const fraudFlags = await fetchApi("/admin/fraud-flags", "GET", null, true)

      if (fraudFlags.length === 0) {
        const row = fraudFlagsTableBody.insertRow()
        row.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No fraud flags found.</td>`
        return
      }

      fraudFlags.forEach((flag) => {
        const row = fraudFlagsTableBody.insertRow()
        row.innerHTML = `
          <td class="table-row-data font-medium text-gray-900">${flag.user.email}</td>
          <td class="table-row-data">${flag.reason}</td>
          <td class="table-row-data">${new Date(flag.created_at).toLocaleString()}</td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button id="clear-flag-${flag.user.id}" class="action-btn clear-fraud-flag-btn text-red-600 hover:text-red-900">Clear Flag</button>
          </td>
        `
      })

      document.querySelectorAll(".clear-fraud-flag-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const userId = e.target.id.replace("clear-flag-", "")
          clearFraudFlag(userId)
        })
      })
    } catch (error) {
      console.error("Failed to fetch fraud flags:", error)
      alert(`Failed to load fraud flags: ${error.message}`)
    }
  }

  async function clearFraudFlag(userId) {
    if (
      !confirm("Are you sure you want to clear this fraud flag? This will also reset device tracking for this user.")
    ) {
      return
    }
    try {
      await fetchApi(`/admin/fraud-flags/${userId}`, "DELETE", null, true)
      console.log(`Fraud flag for user ID ${userId} cleared successfully.`) // Changed from alert
      renderFraudManagement() // Re-render the flags table
      renderUserManagement() // Re-render user table to reflect is_flagged status change
    } catch (error) {
      alert(`Failed to clear fraud flag: ${error.message}`)
    }
  }

  // --- Fraud Management (Rules) ---
  async function renderFraudRules() {
    if (!fraudRulesTableBody) return
    fraudRulesTableBody.innerHTML = ""

    try {
      const fraudRules = await fetchApi("/admin/fraud/rules", "GET", null, true)

      if (fraudRules.length === 0) {
        const row = fraudRulesTableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No fraud rules found.</td>`
        return
      }

      fraudRules.forEach((rule) => {
        // Add defensive checks for rule and rule.rule_key
        if (!rule || typeof rule.rule_key === "undefined" || rule.rule_key === null) {
          console.warn("Skipping malformed fraud rule:", rule)
          return
        }

        const row = fraudRulesTableBody.insertRow()
        row.innerHTML = `
          <td class="table-row-data font-medium text-gray-900">${rule.rule_key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</td>
          <td class="table-row-data">${rule.description || "N/A"}</td>
          <td class="table-row-data">
            <input type="number" value="${rule.limit_value}" class="input-field w-24 text-center fraud-rule-limit" data-rule-key="${rule.rule_key}" min="1">
          </td>
          <td class="table-row-data">
            <select class="input-field fraud-rule-action" data-rule-key="${rule.rule_key}">
              <option value="allow" ${rule.action === "allow" ? "selected" : ""}>Allow</option>
              <option value="flag" ${rule.action === "flag" ? "selected" : ""}>Flag</option>
              <option value="block" ${rule.action === "block" ? "selected" : ""}>Block</option>
              <option value="flag_and_block" ${rule.action === "flag_and_block" ? "selected" : ""}>Flag & Block</option>
            </select>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button class="btn btn-primary save-fraud-rule-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" data-rule-key="${rule.rule_key}">Save</button>
          </td>
        `
        fraudRulesTableBody.appendChild(row)
      })

      document.querySelectorAll(".save-fraud-rule-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const ruleKey = e.target.dataset.ruleKey
          const row = e.target.closest("tr")
          const limitValue = Number.parseInt(row.querySelector(".fraud-rule-limit").value, 10)
          const action = row.querySelector(".fraud-rule-action").value

          if (isNaN(limitValue) || limitValue < 1) {
            alert("Limit value must be a positive number.")
            return
          }

          try {
            // Only send limit_value and action, as rule_key is in the path
            await fetchApi(`/admin/fraud/rules/${ruleKey}`, "POST", { limit_value: limitValue, action: action }, true)
            console.log(`Fraud rule "${ruleKey}" updated successfully.`) // Changed from alert
            renderFraudRules() // Re-render to show updated values
          } catch (error) {
            console.error("Error updating fraud rule:", error)
            alert(`Failed to update fraud rule "${ruleKey}": ${error.message}`)
          }
        })
      })
    } catch (error) {
      console.error("Failed to fetch fraud rules:", error)
      alert(`Failed to load fraud rules: ${error.message}`)
    }
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

      // Determine initial section based on URL hash or default
      const initialHash = window.location.hash.substring(1)
      const initialSectionId = initialHash || "dashboard-overview-section"

      // Set initial active link and section
      const initialLink = document.getElementById(initialSectionId.replace("-section", "-link"))
      if (initialLink) {
        initialLink.classList.add("bg-gray-700", "text-white")
      }
      const initialSection = document.getElementById(initialSectionId)
      if (initialSection) {
        initialSection.classList.add("active")
      }

      // Initial render for the determined section on page load/refresh
      renderSectionContent(initialSectionId) // THIS IS THE KEY CHANGE FOR REFRESH

      // Logout button functionality
      if (logoutButton) {
        logoutButton.addEventListener("click", () => {
          console.log("Logging out...") // Changed from alert
          clearSession()
          window.location.href = "/" // Redirect to root login page
        })
      }
    }
  })
})()
