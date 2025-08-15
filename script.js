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
  let filteredUsers = []
  let filteredAgents = []

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
  let fraudRulesTableBody
  let userSearchInput, agentSearchInput
  let mobileOverlay

  function initializeDashboardElements() {
    sidebar = document.getElementById("sidebar")
    mainContent = document.getElementById("main-content")
    sidebarToggle = document.getElementById("sidebar-toggle")
    navLinks = document.querySelectorAll("#sidebar ul li a")
    sections = document.querySelectorAll(".section-content")
    mobileOverlay = document.getElementById("mobile-overlay")

    totalUsersCard = document.getElementById("total-users-card")
    totalSurveysCard = document.getElementById("total-surveys-card")
    totalPointsCard = document.getElementById("total-points-card")
    pendingRedemptionsCard = document.getElementById("pending-redemptions-card")
    rewardPercentageCard = document.getElementById("reward-percentage-card")

    systemSettingsTableBody = document.getElementById("system-settings-table-body")
    userManagementTableBody = document.getElementById("user-management-table-body")
    agentManagementTableBody = document.getElementById("agent-management-table-body")
    surveyManagementTableBody = document.getElementById("survey-management-table-body")
    pointTransfersTableBody = document.getElementById("pointTransfersTableBody")
    redemptionRequestsTableBody = document.getElementById("redemption-requests-table-body")
    activityLogTableBody = document.getElementById("activity-log-table-body")
    fraudFlagsTableBody = document.getElementById("fraud-flags-table-body")
    fraudRulesTableBody = document.getElementById("fraud-rules-table-body")

    autoUserApprovalToggle = document.getElementById("auto-user-approval-toggle")
    approveAllPendingUsersBtn = document.getElementById("approve-all-pending-users-btn")
    rejectAllPendingUsersBtn = document.getElementById("reject-all-pending-users-btn")
    sendPointsForm = document.getElementById("send-points-form")
    logoutButton = document.getElementById("logout-button")

    userSearchInput = document.getElementById("user-search-input")
    agentSearchInput = document.getElementById("agent-search-input")
  }

  function initializeDashboardEventListeners() {
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        if (window.innerWidth <= 1024) {
          sidebar.classList.toggle("open")
          mobileOverlay.classList.toggle("active")
        } else {
          sidebar.classList.toggle("collapsed")
          mainContent.classList.toggle("expanded")
        }
      })
    }

    if (mobileOverlay) {
      mobileOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open")
        mobileOverlay.classList.remove("active")
      })
    }

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024) {
        sidebar.classList.remove("open")
        mobileOverlay.classList.remove("active")
      }
    })

    // Navigation links
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()
        const targetSectionId = link.id.replace("-link", "-section")

        // Close mobile sidebar
        if (window.innerWidth <= 1024) {
          sidebar.classList.remove("open")
          mobileOverlay.classList.remove("active")
        }

        // Update URL hash
        window.history.pushState(null, null, `#${targetSectionId.replace("-section", "")}`)

        navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
        sections.forEach((sec) => sec.classList.remove("active"))

        link.classList.add("bg-gray-700", "text-white")
        document.getElementById(targetSectionId).classList.add("active")
        renderSectionContent(targetSectionId)
      })
    })

    // Handle browser back/forward buttons
    window.addEventListener("popstate", () => {
      const hash = window.location.hash.substring(1)
      const targetSectionId = hash || "dashboard-overview-section"

      navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
      sections.forEach((sec) => sec.classList.remove("active"))

      const correspondingLink = document.getElementById(targetSectionId.replace("-section", "-link"))
      if (correspondingLink) {
        correspondingLink.classList.add("bg-gray-700", "text-white")
      }
      document.getElementById(targetSectionId).classList.add("active")
      renderSectionContent(targetSectionId)
    })

    if (userSearchInput) {
      userSearchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim()
        if (searchTerm === "") {
          filteredUsers = users
        } else {
          filteredUsers = users.filter(
            (user) =>
              user.email.toLowerCase().includes(searchTerm) ||
              user.id.toString().includes(searchTerm) ||
              (user.name && user.name.toLowerCase().includes(searchTerm)),
          )
        }
        renderUserManagementTable()
      })
    }

    if (agentSearchInput) {
      agentSearchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim()
        if (searchTerm === "") {
          filteredAgents = agents
        } else {
          filteredAgents = agents.filter(
            (agent) =>
              agent.email.toLowerCase().includes(searchTerm) ||
              agent.id.toString().includes(searchTerm) ||
              (agent.name && agent.name.toLowerCase().includes(searchTerm)) ||
              (agent.referral_code && agent.referral_code.toLowerCase().includes(searchTerm)),
          )
        }
        renderAgentManagementTable()
      })
    }

    if (autoUserApprovalToggle) {
      autoUserApprovalToggle.addEventListener("change", async (e) => {
        const isEnabled = e.target.checked
        const toggleBg = autoUserApprovalToggle.parentElement.querySelector(".toggle-bg")
        const statusLabel = document.getElementById("approvalStatusLabel")

        try {
          await fetchApi("/admin/settings/auto-approval", "PUT", { enabled: isEnabled }, true)

          if (isEnabled) {
            toggleBg.classList.add("active")
            statusLabel.textContent = "Auto-Approval is ON"
            statusLabel.classList.remove("text-gray-500")
            statusLabel.classList.add("text-green-600")
          } else {
            toggleBg.classList.remove("active")
            statusLabel.textContent = "Auto-Approval is OFF"
            statusLabel.classList.remove("text-green-600")
            statusLabel.classList.add("text-gray-500")
          }
        } catch (error) {
          console.error("Failed to update auto-approval setting:", error)
          e.target.checked = !isEnabled // Revert toggle
          alert("Failed to update auto-approval setting")
        }
      })
    }
  }

  async function renderSectionContent(sectionId) {
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
        case "point-transfers-section":
          await renderPointTransfers()
          break
        case "redemption-requests-section":
          await renderRedemptionRequests()
          break
        case "fraud-management-section":
          await renderFraudManagement()
          break
      }
    } catch (error) {
      console.error(`Failed to render section ${sectionId}:`, error)
    }
  }

  // --- Dashboard Overview ---
  async function renderDashboardOverview() {
    try {
      const stats = await fetchApi("/admin/dashboard/stats", "GET", null, true)
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
      const logs = await fetchApi("/dashboard/activity", "GET", null, true)
      if (logs.length === 0) {
        const row = activityLogTableBody.insertRow()
        row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">No recent activity.</td>`
        return
      }
      logs.forEach((log) => {
        const row = activityLogTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
          <td class="table-cell">
            <div class="date-time">${formatDateTime(log.created_at)}</div>
          </td>
          <td class="table-cell">
            <span class="status-badge ${getActivityTypeClass(log.type)}">${log.type}</span>
          </td>
          <td class="table-cell">${log.message}</td>
        `
      })
    } catch (error) {
      console.error("Failed to fetch activity log:", error)
      const row = activityLogTableBody.insertRow()
      row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">Failed to load activity log.</td>`
    }
  }

  // --- System Settings ---
  async function renderSystemSettings() {
    if (!systemSettingsTableBody) return
    systemSettingsTableBody.innerHTML = ""
    try {
      const settings = await fetchApi("/admin/settings", "GET", null, true)
      if (settings.length === 0) {
        const row = systemSettingsTableBody.insertRow()
        row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">No settings found.</td>`
        return
      }
      settings.forEach((setting) => {
        const row = systemSettingsTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
          <td class="table-cell">
            <div class="font-medium text-gray-900">${setting.key}</div>
            <div class="text-sm text-gray-500">${setting.description || ""}</div>
          </td>
          <td class="table-cell">
            <span class="font-mono text-sm">${setting.value}</span>
          </td>
          <td class="table-cell">
            <button onclick="editSetting('${setting.key}', '${setting.value}')" class="btn-success">Edit</button>
          </td>
        `
      })
    } catch (error) {
      console.error("Failed to fetch settings:", error)
      const row = systemSettingsTableBody.insertRow()
      row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">Failed to load settings.</td>`
    }
  }

  async function editSetting(key, currentValue) {
    const newValue = prompt(`Edit setting "${key}":`, currentValue)
    if (newValue === null || newValue === currentValue) return

    try {
      await fetchApi("/admin/settings", "PUT", { key, value: newValue }, true)
      await renderSystemSettings()
      alert("Setting updated successfully")
    } catch (error) {
      console.error("Failed to update setting:", error)
      alert("Failed to update setting")
    }
  }

  // --- User Management ---
  async function renderUserManagement() {
    try {
      const data = await fetchApi("/admin/users", "GET", null, true)
      users = data
      filteredUsers = data
      renderUserManagementTable()

      // Load auto-approval setting
      const settings = await fetchApi("/admin/settings", "GET", null, true)
      const autoApprovalSetting = settings.find((s) => s.key === "auto_user_approval")
      if (autoApprovalSetting && autoUserApprovalToggle) {
        const isEnabled = autoApprovalSetting.value === "true"
        autoUserApprovalToggle.checked = isEnabled
        const toggleBg = autoUserApprovalToggle.parentElement.querySelector(".toggle-bg")
        const statusLabel = document.getElementById("approvalStatusLabel")

        if (isEnabled) {
          toggleBg.classList.add("active")
          statusLabel.textContent = "Auto-Approval is ON"
          statusLabel.classList.remove("text-gray-500")
          statusLabel.classList.add("text-green-600")
        } else {
          toggleBg.classList.remove("active")
          statusLabel.textContent = "Auto-Approval is OFF"
          statusLabel.classList.remove("text-green-600")
          statusLabel.classList.add("text-gray-500")
        }
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
      if (userManagementTableBody) {
        userManagementTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">Failed to load users.</td></tr>`
      }
    }
  }

  function renderUserManagementTable() {
    if (!userManagementTableBody) return
    userManagementTableBody.innerHTML = ""

    if (filteredUsers.length === 0) {
      const row = userManagementTableBody.insertRow()
      row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No users found.</td>`
      return
    }

    filteredUsers.forEach((user) => {
      const row = userManagementTableBody.insertRow()
      row.className = "table-row"
      row.innerHTML = `
        <td class="table-cell">
          <div class="font-medium text-gray-900">${user.name || "N/A"}</div>
        </td>
        <td class="table-cell">
          <div class="font-medium text-gray-900">${user.email}</div>
          <div class="user-id">ID: ${user.id}</div>
        </td>
        <td class="table-cell">
          <span class="status-badge ${getStatusClass(user.status)}">${user.status}</span>
        </td>
        <td class="table-cell">
          <span class="status-badge ${getRoleClass(user.role)}">${user.role}</span>
        </td>
        <td class="table-cell">
          <div class="date-time">${formatDateTime(user.created_at)}</div>
        </td>
        <td class="table-cell">
          <div class="flex flex-col sm:flex-row gap-2">
            ${
              user.status === "pending"
                ? `
              <button onclick="approveUser('${user.id}')" class="btn-success">Approve</button>
              <button onclick="rejectUser('${user.id}')" class="btn-danger">Reject</button>
            `
                : user.status === "approved"
                  ? `
              <button onclick="suspendUser('${user.id}')" class="btn-warning">Suspend</button>
            `
                  : `
              <button onclick="reactivateUser('${user.id}')" class="btn-success">Reactivate</button>
            `
            }
          </div>
        </td>
      `
    })
  }

  // --- Agent Management ---
  async function renderAgentManagement() {
    try {
      const data = await fetchApi("/admin/agents", "GET", null, true)
      agents = data
      filteredAgents = data
      renderAgentManagementTable()
    } catch (error) {
      console.error("Failed to fetch agents:", error)
      if (agentManagementTableBody) {
        agentManagementTableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">Failed to load agents.</td></tr>`
      }
    }
  }

  function renderAgentManagementTable() {
    if (!agentManagementTableBody) return
    agentManagementTableBody.innerHTML = ""

    if (filteredAgents.length === 0) {
      const row = agentManagementTableBody.insertRow()
      row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No agents found.</td>`
      return
    }

    filteredAgents.forEach((agent) => {
      const row = agentManagementTableBody.insertRow()
      row.className = "table-row"
      row.innerHTML = `
        <td class="table-cell">
          <div class="font-medium text-gray-900">${agent.name || "N/A"}</div>
        </td>
        <td class="table-cell">
          <div class="font-medium text-gray-900">${agent.email}</div>
          <div class="user-id">ID: ${agent.id}</div>
        </td>
        <td class="table-cell">
          <div class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${agent.referral_code}</div>
        </td>
        <td class="table-cell">
          <span class="font-semibold text-blue-600">${agent.referred_users || 0}</span>
        </td>
        <td class="table-cell">
          <div class="date-time">${formatDateTime(agent.appointed_at || agent.created_at)}</div>
        </td>
        <td class="table-cell">
          <div class="flex flex-col sm:flex-row gap-2">
            <button onclick="viewAgentDetails('${agent.id}')" class="btn-success">View Details</button>
            <button onclick="removeAgent('${agent.id}')" class="btn-danger">Remove</button>
          </div>
        </td>
      `
    })
  }

  // --- Survey Management ---
  async function renderSurveyManagement() {
    if (!surveyManagementTableBody) return
    surveyManagementTableBody.innerHTML = ""
    try {
      const surveys = await fetchApi("/admin/surveys", "GET", null, true)
      if (surveys.length === 0) {
        const row = surveyManagementTableBody.insertRow()
        row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">No surveys found.</td>`
        return
      }
      surveys.forEach((survey) => {
        const row = surveyManagementTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
          <td class="table-cell">
            <div class="font-medium text-gray-900">${survey.title}</div>
          </td>
          <td class="table-cell">
            <span class="font-semibold text-green-600">${survey.points_reward}</span>
          </td>
          <td class="table-cell">
            <span class="status-badge ${survey.is_active ? "status-active" : "status-inactive"}">
              ${survey.is_active ? "Active" : "Inactive"}
            </span>
          </td>
        `
      })
    } catch (error) {
      console.error("Failed to fetch surveys:", error)
      const row = surveyManagementTableBody.insertRow()
      row.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">Failed to load surveys.</td>`
    }
  }

  // --- Point Transfers ---
  let currentPage = 1
  const itemsPerPage = 10

  async function renderPointTransfers() {
    if (!pointTransfersTableBody) return
    pointTransfersTableBody.innerHTML = ""
    try {
      const startDate = document.getElementById("filterStartDate")?.value || ""
      const endDate = document.getElementById("filterEndDate")?.value || ""
      const searchEmail = document.getElementById("searchEmail")?.value || ""

      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(searchEmail && { email: searchEmail }),
      })

      const data = await fetchApi(`/admin/point-transfers?${params}`, "GET", null, true)
      const transfers = data.transfers || []
      const totalPages = Math.ceil((data.total || 0) / itemsPerPage)

      if (transfers.length === 0) {
        const row = pointTransfersTableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No transfers found.</td>`
      } else {
        transfers.forEach((transfer) => {
          const row = pointTransfersTableBody.insertRow()
          row.className = "table-row"
          row.innerHTML = `
            <td class="table-cell">
              <div class="font-medium text-gray-900">${transfer.from_user_email || "System"}</div>
            </td>
            <td class="table-cell">
              <div class="font-medium text-gray-900">${transfer.to_user_email}</div>
            </td>
            <td class="table-cell">
              <span class="font-semibold text-green-600">${transfer.amount}</span>
            </td>
            <td class="table-cell">
              <div class="date-time">${formatDateTime(transfer.created_at)}</div>
            </td>
            <td class="table-cell">
              <button onclick="viewTransferDetails('${transfer.id}')" class="btn-success">View</button>
            </td>
          `
        })
      }

      // Update pagination
      document.getElementById("paginationInfo").textContent = `Page ${currentPage} of ${totalPages}`
      document.getElementById("prevPageBtn").disabled = currentPage <= 1
      document.getElementById("nextPageBtn").disabled = currentPage >= totalPages
    } catch (error) {
      console.error("Failed to fetch point transfers:", error)
      const row = pointTransfersTableBody.insertRow()
      row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Failed to load transfers.</td>`
    }
  }

  window.renderPointTransfers = renderPointTransfers

  window.prevPage = () => {
    if (currentPage > 1) {
      currentPage--
      renderPointTransfers()
    }
  }

  window.nextPage = () => {
    currentPage++
    renderPointTransfers()
  }

  async function viewTransferDetails(transferId) {
    try {
      const transfer = await fetchApi(`/admin/point-transfers/${transferId}`, "GET", null, true)
      alert(
        `Transfer Details:\nFrom: ${transfer.from_user_email || "System"}\nTo: ${transfer.to_user_email}\nAmount: ${transfer.amount}\nDate: ${formatDateTime(transfer.created_at)}`,
      )
    } catch (error) {
      console.error("Failed to fetch transfer details:", error)
      alert("Failed to load transfer details")
    }
  }

  // --- Redemption Requests ---
  async function renderRedemptionRequests() {
    if (!redemptionRequestsTableBody) return
    redemptionRequestsTableBody.innerHTML = ""
    try {
      const requests = await fetchApi("/admin/redemption-requests", "GET", null, true)
      if (requests.length === 0) {
        const row = redemptionRequestsTableBody.insertRow()
        row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No redemption requests found.</td>`
        return
      }
      requests.forEach((request) => {
        const row = redemptionRequestsTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
          <td class="table-cell">
            <div class="font-medium text-gray-900">${request.user_email}</div>
          </td>
          <td class="table-cell">
            <span class="font-semibold text-red-600">${request.points}</span>
          </td>
          <td class="table-cell">
            <span class="status-badge status-pending">${request.type}</span>
          </td>
          <td class="table-cell">
            <div class="text-sm text-gray-900">${request.destination}</div>
          </td>
          <td class="table-cell">
            <span class="status-badge ${getStatusClass(request.status)}">${request.status}</span>
          </td>
          <td class="table-cell">
            <div class="flex flex-col sm:flex-row gap-2">
              ${
                request.status === "pending"
                  ? `
                <button onclick="approveRedemption('${request.id}')" class="btn-success">Approve</button>
                <button onclick="rejectRedemption('${request.id}')" class="btn-danger">Reject</button>
            `
                  : `
              <button onclick="viewRedemptionDetails('${request.id}')" class="btn-success">View</button>
            `
              }
          </div>
        </td>
      `
      })
    } catch (error) {
      console.error("Failed to fetch redemption requests:", error)
      const row = redemptionRequestsTableBody.insertRow()
      row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">Failed to load redemption requests.</td>`
    }
  }

  async function approveRedemption(requestId) {
    try {
      await fetchApi(`/admin/redemption-requests/${requestId}/approve`, "PUT", null, true)
      await renderRedemptionRequests()
      alert("Redemption approved successfully")
    } catch (error) {
      console.error("Failed to approve redemption:", error)
      alert("Failed to approve redemption")
    }
  }

  async function rejectRedemption(requestId) {
    if (!confirm("Are you sure you want to reject this redemption?")) return
    try {
      await fetchApi(`/admin/redemption-requests/${requestId}/reject`, "PUT", null, true)
      await renderRedemptionRequests()
      alert("Redemption rejected successfully")
    } catch (error) {
      console.error("Failed to reject redemption:", error)
      alert("Failed to reject redemption")
    }
  }

  async function viewRedemptionDetails(requestId) {
    try {
      const request = await fetchApi(`/admin/redemption-requests/${requestId}`, "GET", null, true)
      alert(
        `Redemption Details:\nUser: ${request.user_email}\nPoints: ${request.points}\nType: ${request.type}\nDestination: ${request.destination}\nStatus: ${request.status}\nDate: ${formatDateTime(request.created_at)}`,
      )
    } catch (error) {
      console.error("Failed to fetch redemption details:", error)
      alert("Failed to load redemption details")
    }
  }

  // Fraud Management
  async function renderFraudManagement() {
    await renderFraudFlags()
    await renderFraudRules()
  }

  async function renderFraudFlags() {
    if (!fraudFlagsTableBody) return
    fraudFlagsTableBody.innerHTML = ""
    try {
      const flags = await fetchApi("/admin/fraud/flags", "GET", null, true)
      if (flags.length === 0) {
        const row = fraudFlagsTableBody.insertRow()
        row.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No fraud flags found.</td>`
        return
      }
      flags.forEach((flag) => {
        const row = fraudFlagsTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
        <td class="table-cell">
          <div class="font-medium text-gray-900">${flag.user_email}</div>
        </td>
        <td class="table-cell">
          <div class="text-sm text-gray-900">${flag.reason}</div>
        </td>
        <td class="table-cell">
          <div class="date-time">${formatDateTime(flag.created_at)}</div>
        </td>
        <td class="table-cell">
          <button onclick="clearFraudFlag('${flag.id}')" class="btn-success">Clear</button>
        </td>
      `
      })
    } catch (error) {
      console.error("Failed to fetch fraud flags:", error)
      const row = fraudFlagsTableBody.insertRow()
      row.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-sm text-red-500">Failed to load fraud flags.</td>`
    }
  }

  async function renderFraudRules() {
    if (!fraudRulesTableBody) return
    fraudRulesTableBody.innerHTML = ""
    try {
      const rules = await fetchApi("/admin/fraud/rules", "GET", null, true)
      if (rules.length === 0) {
        const row = fraudRulesTableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No fraud rules found.</td>`
        return
      }
      rules.forEach((rule) => {
        const row = fraudRulesTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
        <td class="table-cell">
          <div class="font-medium text-gray-900">${rule.rule_key}</div>
        </td>
        <td class="table-cell">
          <div class="text-sm text-gray-900">${rule.description}</div>
        </td>
        <td class="table-cell">
          <span class="font-mono text-sm">${rule.limit_value}</span>
        </td>
        <td class="table-cell">
          <span class="status-badge status-warning">${rule.action}</span>
        </td>
        <td class="table-cell">
          <button onclick="editFraudRule('${rule.id}', '${rule.limit_value}')" class="btn-success">Edit</button>
        </td>
      `
      })
    } catch (error) {
      console.error("Failed to fetch fraud rules:", error)
      const row = fraudRulesTableBody.insertRow()
      row.innerHTML = `<td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">Failed to load fraud rules.</td>`
    }
  }

  async function clearFraudFlag(flagId) {
    if (!confirm("Are you sure you want to clear this fraud flag?")) return
    try {
      await fetchApi(`/admin/fraud/flags/${flagId}`, "DELETE", null, true)
      await renderFraudFlags()
      alert("Fraud flag cleared successfully")
    } catch (error) {
      console.error("Failed to clear fraud flag:", error)
      alert("Failed to clear fraud flag")
    }
  }

  async function editFraudRule(ruleId, currentValue) {
    const newValue = prompt("Edit fraud rule limit:", currentValue)
    if (newValue === null || newValue === currentValue) return

    try {
      await fetchApi(`/admin/fraud/rules/${ruleId}`, "PUT", { limit_value: newValue }, true)
      await renderFraudRules()
      alert("Fraud rule updated successfully")
    } catch (error) {
      console.error("Failed to update fraud rule:", error)
      alert("Failed to update fraud rule")
    }
  }

  // --- Utility functions for better formatting and styling
  function formatDateTime(dateString) {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getStatusClass(status) {
    switch (status?.toLowerCase()) {
      case "approved":
        return "status-approved"
      case "pending":
        return "status-pending"
      case "rejected":
        return "status-rejected"
      case "suspended":
        return "status-rejected"
      default:
        return "status-pending"
    }
  }

  function getRoleClass(role) {
    switch (role?.toLowerCase()) {
      case "admin":
        return "status-rejected"
      case "agent":
        return "status-approved"
      case "user":
        return "status-pending"
      default:
        return "status-pending"
    }
  }

  function getActivityTypeClass(type) {
    switch (type?.toLowerCase()) {
      case "login":
        return "status-approved"
      case "error":
        return "status-rejected"
      case "warning":
        return "status-pending"
      default:
        return "status-pending"
    }
  }

  // --- Enhanced user action functions
  async function approveUser(userId) {
    try {
      await fetchApi(`/admin/users/${userId}/approve`, "PUT", null, true)
      await renderUserManagement()
      alert("User approved successfully")
    } catch (error) {
      console.error("Failed to approve user:", error)
      alert("Failed to approve user")
    }
  }

  async function rejectUser(userId) {
    if (!confirm("Are you sure you want to reject this user?")) return
    try {
      await fetchApi(`/admin/users/${userId}/reject`, "PUT", null, true)
      await renderUserManagement()
      alert("User rejected successfully")
    } catch (error) {
      console.error("Failed to reject user:", error)
      alert("Failed to reject user")
    }
  }

  async function suspendUser(userId) {
    if (!confirm("Are you sure you want to suspend this user?")) return
    try {
      await fetchApi(`/admin/users/${userId}/suspend`, "PUT", null, true)
      await renderUserManagement()
      alert("User suspended successfully")
    } catch (error) {
      console.error("Failed to suspend user:", error)
      alert("Failed to suspend user")
    }
  }

  async function reactivateUser(userId) {
    try {
      await fetchApi(`/admin/users/${userId}/reactivate`, "PUT", null, true)
      await renderUserManagement()
      alert("User reactivated successfully")
    } catch (error) {
      console.error("Failed to reactivate user:", error)
      alert("Failed to reactivate user")
    }
  }

  async function viewAgentDetails(agentId) {
    try {
      const agent = await fetchApi(`/admin/agents/${agentId}`, "GET", null, true)
      alert(
        `Agent Details:\nName: ${agent.name}\nEmail: ${agent.email}\nReferral Code: ${agent.referral_code}\nReferred Users: ${agent.referred_users}\nAppointed: ${formatDateTime(agent.appointed_at)}`,
      )
    } catch (error) {
      console.error("Failed to fetch agent details:", error)
      alert("Failed to load agent details")
    }
  }

  async function removeAgent(agentId) {
    if (!confirm("Are you sure you want to remove this agent?")) return
    try {
      await fetchApi(`/admin/agents/${agentId}`, "DELETE", null, true)
      await renderAgentManagement()
      alert("Agent removed successfully")
    } catch (error) {
      console.error("Failed to remove agent:", error)
      alert("Failed to remove agent")
    }
  }

  // Initialize dashboard when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => {
    protectRoute()
    handleLoginForm()
    handlePinForm()

    // Dashboard initialization
    if (document.getElementById("sidebar")) {
      initializeDashboardElements()
      initializeDashboardEventListeners()

      // Load initial section based on URL hash
      const hash = window.location.hash.substring(1)
      const initialSection = hash || "dashboard-overview"
      const targetSectionId = initialSection + "-section"

      // Set initial active states
      const initialLink = document.getElementById(initialSection + "-link")
      if (initialLink) {
        navLinks.forEach((nav) => nav.classList.remove("bg-gray-700", "text-white"))
        sections.forEach((sec) => sec.classList.remove("active"))

        initialLink.classList.add("bg-gray-700", "text-white")
        document.getElementById(targetSectionId).classList.add("active")
        renderSectionContent(targetSectionId)
      }

      // Send Points Form
      if (sendPointsForm) {
        sendPointsForm.addEventListener("submit", async (e) => {
          e.preventDefault()
          const fromEmail = document.getElementById("from-user-email").value
          const toEmail = document.getElementById("to-user-email").value
          const amount = Number.parseInt(document.getElementById("points-amount").value)

          try {
            await fetchApi(
              "/admin/point-transfers",
              "POST",
              {
                from_user_email: fromEmail || null,
                to_user_email: toEmail,
                amount: amount,
              },
              true,
            )

            sendPointsForm.reset()
            await renderPointTransfers()
            alert("Points sent successfully!")
          } catch (error) {
            console.error("Failed to send points:", error)
            alert(`Failed to send points: ${error.message}`)
          }
        })
      }

      // Bulk user actions
      if (approveAllPendingUsersBtn) {
        approveAllPendingUsersBtn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to approve all pending users?")) return
          try {
            await fetchApi("/admin/users/approve-all-pending", "PUT", null, true)
            await renderUserManagement()
            alert("All pending users approved successfully")
          } catch (error) {
            console.error("Failed to approve all pending users:", error)
            alert("Failed to approve all pending users")
          }
        })
      }

      if (rejectAllPendingUsersBtn) {
        rejectAllPendingUsersBtn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to reject all pending users?")) return
          try {
            await fetchApi("/admin/users/reject-all-pending", "PUT", null, true)
            await renderUserManagement()
            alert("All pending users rejected successfully")
          } catch (error) {
            console.error("Failed to reject all pending users:", error)
            alert("Failed to reject all pending users")
          }
        })
      }

      // Logout button functionality
      if (logoutButton) {
        logoutButton.addEventListener("click", () => {
          console.log("Logging out...")
          clearSession()
          window.location.href = "/"
        })
      }
    }
  })
})()
