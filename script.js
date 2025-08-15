// Enhanced Admin Dashboard Script with Modern Features
// Includes responsive design, search functionality, and improved user management

;(() => {
  // --- API Configuration ---
  const API_BASE_URL = "https://api.survecta.com/api"

  // --- Session Keys ---
  const SESSION_KEY_AUTH = "isAuthenticated"
  const SESSION_KEY_TOKEN = "accessToken"
  const SESSION_KEY_PIN_VERIFIED = "isPinVerified"
  const SESSION_KEY_USER_DATA = "userData"

  // --- Global State ---
  let currentSection = "dashboard-overview-section"
  let users = []
  let agents = []
  let filteredUsers = []
  let filteredAgents = []

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

  // --- Generic API Fetcher with Enhanced Error Handling ---
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
        window.location.href = "/"
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

      if (response.status === 401) {
        console.warn("Session expired or unauthorized. Logging out.")
        clearSession()
        window.location.href = "/"
        throw new Error("Session expired or unauthorized.")
      }

      const data = await response.json()

      if (!response.ok) {
        console.error("API Error:", data.detail || response.statusText)
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
      throw error
    }
  }

  // --- Authentication Check and Redirection ---
  function protectRoute() {
    const isAuthenticated = getSession(SESSION_KEY_AUTH)
    const isPinVerified = getSession(SESSION_KEY_PIN_VERIFIED)
    const currentPath = window.location.pathname

    if (currentPath === "/" || currentPath.includes("index.html")) {
      if (isAuthenticated) {
        if (isPinVerified) {
          window.location.href = "/dashboard/"
        } else {
          window.location.href = "/pin/"
        }
      }
      return
    }

    if (currentPath.includes("/pin/")) {
      if (!isAuthenticated) {
        window.location.href = "/"
      } else if (isPinVerified) {
        window.location.href = "/dashboard/"
      }
      return
    }

    if (currentPath.includes("/dashboard/")) {
      if (!isAuthenticated || !isPinVerified) {
        clearSession()
        window.location.href = "/"
      }
    }
  }

  // --- Mobile Menu Functionality ---
  function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle")
    const sidebar = document.getElementById("sidebar")
    const mobileOverlay = document.getElementById("mobile-overlay")
    const sidebarToggle = document.getElementById("sidebar-toggle")

    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", () => {
        sidebar.classList.add("open")
        mobileOverlay.classList.remove("hidden")
      })
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        sidebar.classList.remove("open")
        mobileOverlay.classList.add("hidden")
      })
    }

    if (mobileOverlay) {
      mobileOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open")
        mobileOverlay.classList.add("hidden")
      })
    }
  }

  // --- Navigation Functionality ---
  function initializeNavigation() {
    const navLinks = document.querySelectorAll(".nav-link")
    const sections = document.querySelectorAll(".section-content")
    const pageTitle = document.getElementById("page-title")

    navLinks.forEach((link) => {
      link.addEventListener("click", async (e) => {
        e.preventDefault()

        // Remove active class from all links
        navLinks.forEach((l) => l.classList.remove("bg-gray-800"))

        // Add active class to clicked link
        link.classList.add("bg-gray-800")

        // Hide all sections
        sections.forEach((section) => section.classList.remove("active"))

        // Show target section
        const targetId = link.id.replace("-link", "-section")
        const targetSection = document.getElementById(targetId)

        if (targetSection) {
          targetSection.classList.add("active")
          currentSection = targetId

          // Update page title
          const title = link.querySelector(".sidebar-text").textContent
          if (pageTitle) {
            pageTitle.textContent = title
          }

          // Load section content
          await renderSectionContent(targetId)
        }

        // Close mobile menu
        const sidebar = document.getElementById("sidebar")
        const mobileOverlay = document.getElementById("mobile-overlay")
        if (sidebar && mobileOverlay) {
          sidebar.classList.remove("open")
          mobileOverlay.classList.add("hidden")
        }
      })
    })
  }

  // --- Section Content Rendering ---
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
          await renderFraudRules()
          break
      }
    } catch (error) {
      console.error(`Error rendering section ${sectionId}:`, error)
      showNotification(`Failed to load ${sectionId.replace("-section", "").replace("-", " ")}`, "error")
    }
  }

  // --- Dashboard Overview ---
  async function renderDashboardOverview() {
    try {
      const stats = await fetchApi("/admin/dashboard/stats", "GET", null, true)

      const totalUsersCard = document.getElementById("total-users-card")
      const totalSurveysCard = document.getElementById("total-surveys-card")
      const totalPointsCard = document.getElementById("total-points-card")
      const pendingRedemptionsCard = document.getElementById("pending-redemptions-card")

      if (totalUsersCard) totalUsersCard.textContent = stats.total_users?.toLocaleString() || "0"
      if (totalSurveysCard) totalSurveysCard.textContent = stats.total_surveys_completed?.toLocaleString() || "0"
      if (totalPointsCard) totalPointsCard.textContent = stats.total_points_distributed?.toLocaleString() || "0"
      if (pendingRedemptionsCard)
        pendingRedemptionsCard.textContent = stats.pending_redemptions?.toLocaleString() || "0"
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error)
      showNotification("Failed to load dashboard overview", "error")
    }
  }

  // --- Activity Log ---
  async function renderActivityLog() {
    const activityLogTableBody = document.getElementById("activity-log-table-body")
    if (!activityLogTableBody) return

    activityLogTableBody.innerHTML = ""

    try {
      const logs = await fetchApi("/dashboard/activity", "GET", null, true)

      if (logs.length === 0) {
        const row = activityLogTableBody.insertRow()
        row.innerHTML = `<td colspan="3" class="table-cell text-center text-gray-500">No recent activity.</td>`
        return
      }

      logs.forEach((log) => {
        const row = activityLogTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">${new Date(log.timestamp).toLocaleString()}</td>
                    <td class="table-cell">
                        <span class="status-badge status-active">
                            ${log.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                    </td>
                    <td class="table-cell">${log.message}</td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch activity logs:", error)
      showNotification("Failed to load activity logs", "error")
    }
  }

  // --- User Management with Enhanced Features ---
  async function renderUserManagement() {
    const userTableBody = document.getElementById("user-management-table-body")
    const usersLoading = document.getElementById("users-loading")

    if (!userTableBody) return

    // Show loading
    if (usersLoading) {
      usersLoading.classList.remove("hidden")
    }

    userTableBody.innerHTML = ""

    try {
      users = await fetchApi("/admin/users", "GET", null, true)
      filteredUsers = [...users]

      await setupUserManagementListeners()
      renderUsersTable()
    } catch (error) {
      console.error("Failed to fetch user data:", error)
      showNotification("Failed to load user data", "error")
    } finally {
      // Hide loading
      if (usersLoading) {
        usersLoading.classList.add("hidden")
      }
    }
  }

  function renderUsersTable() {
    const userTableBody = document.getElementById("user-management-table-body")
    if (!userTableBody) return

    userTableBody.innerHTML = ""

    if (filteredUsers.length === 0) {
      const row = userTableBody.insertRow()
      row.innerHTML = `<td colspan="7" class="table-cell text-center text-gray-500">No users found.</td>`
      return
    }

    filteredUsers.forEach((user) => {
      const row = userTableBody.insertRow()
      row.className = "table-row"

      row.innerHTML = `
                <td class="table-cell">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">#${user.id}</span>
                </td>
                <td class="table-cell">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                            <span class="text-white text-sm font-medium">${user.name ? user.name.charAt(0).toUpperCase() : "U"}</span>
                        </div>
                        <span class="font-medium">${user.name || "N/A"}</span>
                    </div>
                </td>
                <td class="table-cell">
                    <div class="flex flex-col">
                        <span class="font-medium">${user.email}</span>
                        <span class="text-xs text-gray-500">ID: ${user.id}</span>
                    </div>
                </td>
                <td class="table-cell">
                    <span class="status-badge ${getStatusClass(user.status)}">
                        ${user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown"}
                    </span>
                </td>
                <td class="table-cell">
                    <span class="status-badge ${user.is_admin ? "status-pending" : "status-active"}">
                        ${user.is_admin ? "Admin" : "User"}
                    </span>
                </td>
                <td class="table-cell">
                    <span class="font-semibold text-green-600">${user.points || 0}</span>
                </td>
                <td class="table-cell">
                    <div class="flex space-x-2">
                        ${
                          user.status === "pending"
                            ? `
                            <button class="btn-success text-xs px-2 py-1" onclick="approveUser(${user.id})">
                                Approve
                            </button>
                            <button class="btn-danger text-xs px-2 py-1" onclick="rejectUser(${user.id})">
                                Reject
                            </button>
                        `
                            : `
                            <button class="btn-secondary text-xs px-2 py-1" onclick="viewUserDetails(${user.id})">
                                View
                            </button>
                        `
                        }
                    </div>
                </td>
            `
    })
  }

  function setupUserSearch() {
    const userSearch = document.getElementById("user-search")
    if (!userSearch) return

    userSearch.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase().trim()

      if (searchTerm === "") {
        filteredUsers = [...users]
      } else {
        filteredUsers = users.filter(
          (user) =>
            user.email.toLowerCase().includes(searchTerm) ||
            user.id.toString().includes(searchTerm) ||
            (user.name && user.name.toLowerCase().includes(searchTerm)),
        )
      }

      renderUsersTable()
    })
  }

  async function renderAgentManagement() {
    const agentTableBody = document.getElementById("agent-management-table-body")
    if (!agentTableBody) return

    agentTableBody.innerHTML = ""

    try {
      agents = await fetchApi("/admin/agents", "GET", null, true)
      filteredAgents = [...agents]

      setupAgentSearch()
      renderAgentsTable()
    } catch (error) {
      console.error("Failed to fetch agent data:", error)
      showNotification("Failed to load agent data", "error")
    }
  }

  function renderAgentsTable() {
    const agentTableBody = document.getElementById("agent-management-table-body")
    if (!agentTableBody) return

    agentTableBody.innerHTML = ""

    if (filteredAgents.length === 0) {
      const row = agentTableBody.insertRow()
      row.innerHTML = `<td colspan="6" class="table-cell text-center text-gray-500">No agents found.</td>`
      return
    }

    filteredAgents.forEach((agent) => {
      const row = agentTableBody.insertRow()
      row.className = "table-row"

      row.innerHTML = `
                <td class="table-cell">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">#${agent.id}</span>
                </td>
                <td class="table-cell">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                            <span class="text-white text-sm font-medium">${agent.name ? agent.name.charAt(0).toUpperCase() : "A"}</span>
                        </div>
                        <span class="font-medium">${agent.name || "N/A"}</span>
                    </div>
                </td>
                <td class="table-cell">${agent.email}</td>
                <td class="table-cell">
                    <span class="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        ${agent.referral_code || "N/A"}
                    </span>
                </td>
                <td class="table-cell">
                    <span class="font-semibold text-primary-600">${agent.referred_users || 0}</span>
                </td>
                <td class="table-cell">
                    <button class="btn-secondary text-xs px-2 py-1" onclick="viewAgentDetails(${agent.id})">
                        View Details
                    </button>
                </td>
            `
    })
  }

  function setupAgentSearch() {
    const agentSearch = document.getElementById("agent-search")
    if (!agentSearch) return

    agentSearch.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase().trim()

      if (searchTerm === "") {
        filteredAgents = [...agents]
      } else {
        filteredAgents = agents.filter(
          (agent) =>
            agent.email.toLowerCase().includes(searchTerm) ||
            agent.id.toString().includes(searchTerm) ||
            (agent.name && agent.name.toLowerCase().includes(searchTerm)) ||
            (agent.referral_code && agent.referral_code.toLowerCase().includes(searchTerm)),
        )
      }

      renderAgentsTable()
    })
  }

  // --- Enhanced Toggle Functionality ---
  async function setupUserManagementListeners() {
    const toggle = document.getElementById("auto-user-approval-toggle")
    const label = document.getElementById("approval-status-label")

    if (!toggle) return

    function updateToggleUI(checked) {
      const toggleSwitch = toggle.parentElement.querySelector(".toggle-switch")
      const toggleDot = toggle.parentElement.querySelector(".toggle-dot")

      if (checked) {
        toggleSwitch.classList.add("checked")
        toggleDot.classList.add("checked")
        if (label) {
          label.textContent = "Auto-Approval ON"
          label.classList.remove("text-gray-700")
          label.classList.add("text-green-600", "font-semibold")
        }
      } else {
        toggleSwitch.classList.remove("checked")
        toggleDot.classList.remove("checked")
        if (label) {
          label.textContent = "Auto-Approval OFF"
          label.classList.remove("text-green-600", "font-semibold")
          label.classList.add("text-gray-700")
        }
      }
    }

    // Load current setting
    try {
      const settings = await fetchApi("/admin/settings", "GET", null, true)
      const setting = settings.find((s) => s.key === "auto_user_approval")

      if (setting) {
        const isOn = setting.value === "true"
        toggle.checked = isOn
        updateToggleUI(isOn)
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
          true,
        )

        updateToggleUI(e.target.checked)
        showNotification(`Auto User Approval ${e.target.checked ? "enabled" : "disabled"}`, "success")
      } catch (error) {
        showNotification(`Failed to update setting: ${error.message}`, "error")
        e.target.checked = !e.target.checked
        updateToggleUI(e.target.checked)
      }
    })

    // Setup search functionality
    setupUserSearch()
  }

  // --- Survey Management ---
  async function renderSurveyManagement() {
    const surveyTableBody = document.getElementById("survey-management-table-body")
    if (!surveyTableBody) return

    surveyTableBody.innerHTML = ""

    try {
      const surveys = await fetchApi("/admin/surveys", "GET", null, true)

      if (surveys.length === 0) {
        const row = surveyTableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="table-cell text-center text-gray-500">No surveys available.</td>`
        return
      }

      surveys.forEach((survey) => {
        const row = surveyTableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">
                        <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">#${survey.id}</span>
                    </td>
                    <td class="table-cell font-medium">${survey.title}</td>
                    <td class="table-cell">
                        <span class="font-semibold text-green-600">${survey.points_reward}</span>
                    </td>
                    <td class="table-cell">
                        <span class="status-badge ${survey.is_active ? "status-active" : "status-inactive"}">
                            ${survey.is_active ? "Active" : "Inactive"}
                        </span>
                    </td>
                    <td class="table-cell">
                        <span class="font-semibold text-primary-600">${survey.completions || 0}</span>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch survey data:", error)
      showNotification("Failed to load survey data", "error")
    }
  }

  // --- Point Transfers ---
  async function renderPointTransfers() {
    setupPointTransferForm()
    await loadPointTransferHistory()
  }

  function setupPointTransferForm() {
    const form = document.getElementById("send-points-form")
    if (!form) return

    form.addEventListener("submit", async (e) => {
      e.preventDefault()

      const fromEmail = document.getElementById("from-user-email").value
      const toEmail = document.getElementById("to-user-email").value
      const amount = Number.parseInt(document.getElementById("points-amount").value)

      if (!toEmail || !amount) {
        showNotification("Please fill in all required fields", "error")
        return
      }

      try {
        await fetchApi(
          "/admin/transfer-points",
          "POST",
          {
            from_user_email: fromEmail || null,
            to_user_email: toEmail,
            points: amount,
          },
          true,
        )

        showNotification("Points transferred successfully", "success")
        form.reset()
        await loadPointTransferHistory()
      } catch (error) {
        showNotification(`Failed to transfer points: ${error.message}`, "error")
      }
    })
  }

  async function loadPointTransferHistory() {
    const tableBody = document.getElementById("point-transfers-table-body")
    if (!tableBody) return

    tableBody.innerHTML = ""

    try {
      const transfers = await fetchApi("/admin/point-transfers", "GET", null, true)

      if (transfers.length === 0) {
        const row = tableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="table-cell text-center text-gray-500">No point transfers found.</td>`
        return
      }

      transfers.forEach((transfer) => {
        const row = tableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">${transfer.from_user || "System"}</td>
                    <td class="table-cell">${transfer.to_user}</td>
                    <td class="table-cell">
                        <span class="font-semibold text-green-600">${transfer.amount}</span>
                    </td>
                    <td class="table-cell">${new Date(transfer.created_at).toLocaleString()}</td>
                    <td class="table-cell">
                        <button class="btn-secondary text-xs px-2 py-1" onclick="viewTransferDetails(${transfer.id})">
                            View
                        </button>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch point transfers:", error)
      showNotification("Failed to load point transfer history", "error")
    }
  }

  // --- Redemption Requests ---
  async function renderRedemptionRequests() {
    const tableBody = document.getElementById("redemption-requests-table-body")
    if (!tableBody) return

    tableBody.innerHTML = ""

    try {
      const redemptions = await fetchApi("/admin/redemption-requests", "GET", null, true)

      if (redemptions.length === 0) {
        const row = tableBody.insertRow()
        row.innerHTML = `<td colspan="7" class="table-cell text-center text-gray-500">No redemption requests found.</td>`
        return
      }

      redemptions.forEach((redemption) => {
        const row = tableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">
                        <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">#${redemption.user_id}</span>
                    </td>
                    <td class="table-cell">${redemption.user_email}</td>
                    <td class="table-cell">
                        <span class="font-semibold text-red-600">${redemption.points}</span>
                    </td>
                    <td class="table-cell">${redemption.type}</td>
                    <td class="table-cell">${redemption.destination}</td>
                    <td class="table-cell">
                        <span class="status-badge ${getStatusClass(redemption.status)}">
                            ${redemption.status.charAt(0).toUpperCase() + redemption.status.slice(1)}
                        </span>
                    </td>
                    <td class="table-cell">
                        <div class="flex space-x-2">
                            ${
                              redemption.status === "pending"
                                ? `
                                <button class="btn-success text-xs px-2 py-1" onclick="approveRedemption(${redemption.id})">
                                    Approve
                                </button>
                                <button class="btn-danger text-xs px-2 py-1" onclick="rejectRedemption(${redemption.id})">
                                    Reject
                                </button>
                            `
                                : `
                                <button class="btn-secondary text-xs px-2 py-1" onclick="viewRedemptionDetails(${redemption.id})">
                                    View
                                </button>
                            `
                            }
                        </div>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch redemption requests:", error)
      showNotification("Failed to load redemption requests", "error")
    }
  }

  // --- Fraud Management ---
  async function renderFraudManagement() {
    const tableBody = document.getElementById("fraud-flags-table-body")
    if (!tableBody) return

    tableBody.innerHTML = ""

    try {
      const fraudFlags = await fetchApi("/admin/fraud-flags", "GET", null, true)

      if (fraudFlags.length === 0) {
        const row = tableBody.insertRow()
        row.innerHTML = `<td colspan="5" class="table-cell text-center text-gray-500">No fraud flags found.</td>`
        return
      }

      fraudFlags.forEach((flag) => {
        const row = tableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">
                        <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">#${flag.user_id}</span>
                    </td>
                    <td class="table-cell">${flag.user_email}</td>
                    <td class="table-cell">
                        <span class="status-badge status-inactive">${flag.reason}</span>
                    </td>
                    <td class="table-cell">${new Date(flag.created_at).toLocaleString()}</td>
                    <td class="table-cell">
                        <div class="flex space-x-2">
                            <button class="btn-success text-xs px-2 py-1" onclick="clearFraudFlag(${flag.id})">
                                Clear
                            </button>
                            <button class="btn-secondary text-xs px-2 py-1" onclick="viewFraudDetails(${flag.id})">
                                Details
                            </button>
                        </div>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch fraud flags:", error)
      showNotification("Failed to load fraud flags", "error")
    }
  }

  async function renderFraudRules() {
    const tableBody = document.getElementById("fraud-rules-table-body")
    if (!tableBody) return

    tableBody.innerHTML = ""

    try {
      const settings = await fetchApi("/admin/settings", "GET", null, true)
      const fraudRules = settings.filter((setting) =>
        [
          "max_devices_per_user",
          "max_users_per_fingerprint",
          "max_ips_per_user_24h",
          "max_signups_per_fingerprint_24h",
        ].includes(setting.key),
      )

      fraudRules.forEach((rule) => {
        const row = tableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell font-medium">${rule.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</td>
                    <td class="table-cell text-sm text-gray-600">${rule.description || "No description"}</td>
                    <td class="table-cell">
                        <input type="number" value="${rule.value}" class="input-field w-20" id="${rule.key}-input">
                    </td>
                    <td class="table-cell">
                        <button class="btn-primary text-xs px-2 py-1" onclick="updateFraudRule('${rule.key}')">
                            Update
                        </button>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch fraud rules:", error)
      showNotification("Failed to load fraud rules", "error")
    }
  }

  // --- System Settings ---
  async function renderSystemSettings() {
    const tableBody = document.getElementById("system-settings-table-body")
    if (!tableBody) return

    tableBody.innerHTML = ""

    try {
      const settings = await fetchApi("/admin/settings", "GET", null, true)

      // Filter out fraud rules as they're handled in fraud management
      const systemSettings = settings.filter(
        (setting) =>
          ![
            "max_devices_per_user",
            "max_users_per_fingerprint",
            "max_ips_per_user_24h",
            "max_signups_per_fingerprint_24h",
          ].includes(setting.key),
      )

      systemSettings.forEach((setting) => {
        const isToggle = setting.key === "auto_user_approval"
        const isChecked = setting.value === "true"

        const row = tableBody.insertRow()
        row.className = "table-row"
        row.innerHTML = `
                    <td class="table-cell">
                        <div class="font-medium">${setting.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</div>
                        ${setting.description ? `<div class="text-xs text-gray-500 mt-1">${setting.description}</div>` : ""}
                    </td>
                    <td class="table-cell">
                        ${
                          isToggle
                            ? `
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="sr-only peer" id="${setting.key}-toggle" ${isChecked ? "checked" : ""} />
                                <div class="toggle-switch ${isChecked ? "checked" : ""}">
                                    <div class="toggle-dot ${isChecked ? "checked" : ""}"></div>
                                </div>
                                <span class="ml-3 text-sm font-medium text-gray-700">${isChecked ? "ON" : "OFF"}</span>
                            </label>
                        `
                            : `
                            <input type="text" value="${setting.value}" class="input-field" id="${setting.key}-input">
                        `
                        }
                    </td>
                    <td class="table-cell">
                        <button class="btn-primary text-xs px-2 py-1" onclick="updateSetting('${setting.key}', ${isToggle})">
                            Save
                        </button>
                    </td>
                `
      })
    } catch (error) {
      console.error("Failed to fetch system settings:", error)
      showNotification("Failed to load system settings", "error")
    }
  }

  // --- Utility Functions ---
  function getStatusClass(status) {
    switch (status?.toLowerCase()) {
      case "active":
      case "approved":
        return "status-active"
      case "pending":
        return "status-pending"
      case "inactive":
      case "rejected":
      case "suspended":
        return "status-inactive"
      default:
        return "status-pending"
    }
  }

  function showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div")
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`

    // Set notification style based on type
    switch (type) {
      case "success":
        notification.classList.add("bg-green-500", "text-white")
        break
      case "error":
        notification.classList.add("bg-red-500", "text-white")
        break
      case "warning":
        notification.classList.add("bg-yellow-500", "text-white")
        break
      default:
        notification.classList.add("bg-blue-500", "text-white")
    }

    notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `

    document.body.appendChild(notification)

    // Animate in
    setTimeout(() => {
      notification.classList.remove("translate-x-full")
    }, 100)

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add("translate-x-full")
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove()
        }
      }, 300)
    }, 5000)
  }

  // --- Global Action Functions ---
  window.approveUser = async (userId) => {
    try {
      await fetchApi(`/admin/users/${userId}/approve`, "POST", null, true)
      showNotification("User approved successfully", "success")
      await renderUserManagement()
    } catch (error) {
      showNotification(`Failed to approve user: ${error.message}`, "error")
    }
  }

  window.rejectUser = async (userId) => {
    try {
      await fetchApi(`/admin/users/${userId}/reject`, "POST", null, true)
      showNotification("User rejected successfully", "success")
      await renderUserManagement()
    } catch (error) {
      showNotification(`Failed to reject user: ${error.message}`, "error")
    }
  }

  window.viewUserDetails = (userId) => {
    const user = users.find((u) => u.id === userId)
    if (user) {
      alert(
        `User Details:\nID: ${user.id}\nName: ${user.name || "N/A"}\nEmail: ${user.email}\nStatus: ${user.status}\nPoints: ${user.points || 0}`,
      )
    }
  }

  window.viewAgentDetails = (agentId) => {
    const agent = agents.find((a) => a.id === agentId)
    if (agent) {
      alert(
        `Agent Details:\nID: ${agent.id}\nName: ${agent.name || "N/A"}\nEmail: ${agent.email}\nReferral Code: ${agent.referral_code || "N/A"}\nReferred Users: ${agent.referred_users || 0}`,
      )
    }
  }

  window.updateSetting = async (key, isToggle) => {
    try {
      let value
      if (isToggle) {
        const input = document.getElementById(`${key}-toggle`)
        value = input.checked.toString()
      } else {
        const input = document.getElementById(`${key}-input`)
        value = input.value.trim()
      }

      await fetchApi(
        "/admin/settings",
        "PUT",
        {
          key: key,
          value: value,
          description: `Updated ${key.replace(/_/g, " ")}`,
        },
        true,
      )

      showNotification("Setting updated successfully", "success")
    } catch (error) {
      showNotification(`Failed to update setting: ${error.message}`, "error")
    }
  }

  window.updateFraudRule = async (key) => {
    const input = document.getElementById(`${key}-input`)
    const value = input.value.trim()

    try {
      await fetchApi(
        "/admin/settings",
        "PUT",
        {
          key: key,
          value: value,
          description: `Fraud rule: ${key.replace(/_/g, " ")}`,
        },
        true,
      )

      showNotification("Fraud rule updated successfully", "success")
    } catch (error) {
      showNotification(`Failed to update fraud rule: ${error.message}`, "error")
    }
  }

  // --- Logout Functionality ---
  function setupLogout() {
    const logoutButton = document.getElementById("logout-button")
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
          clearSession()
          window.location.href = "/"
        }
      })
    }
  }

  // --- Page Refresh Handling ---
  function handlePageRefresh() {
    // Restore active section after refresh
    const savedSection = sessionStorage.getItem("activeSection")
    if (savedSection && document.getElementById(savedSection)) {
      currentSection = savedSection

      // Update navigation
      const navLinks = document.querySelectorAll(".nav-link")
      navLinks.forEach((link) => {
        link.classList.remove("bg-gray-800")
        if (link.id === savedSection.replace("-section", "-link")) {
          link.classList.add("bg-gray-800")
        }
      })

      // Show section
      const sections = document.querySelectorAll(".section-content")
      sections.forEach((section) => section.classList.remove("active"))
      document.getElementById(savedSection).classList.add("active")

      // Update title
      const pageTitle = document.getElementById("page-title")
      const activeLink = document.querySelector(".nav-link.bg-gray-800")
      if (pageTitle && activeLink) {
        pageTitle.textContent = activeLink.querySelector(".sidebar-text").textContent
      }

      // Load content
      renderSectionContent(savedSection)
    }

    // Save active section on navigation
    const navLinks = document.querySelectorAll(".nav-link")
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const sectionId = link.id.replace("-link", "-section")
        sessionStorage.setItem("activeSection", sectionId)
      })
    })
  }

  // --- Initialization ---
  function initialize() {
    protectRoute()
    initializeMobileMenu()
    initializeNavigation()
    setupLogout()
    handlePageRefresh()

    // Load initial content
    renderSectionContent(currentSection)
  }

  // --- Start the application ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize)
  } else {
    initialize()
  }

  // --- Expose functions globally ---
  window.fetchApi = fetchApi
  window.getSession = getSession
  window.setSession = setSession
  window.clearSession = clearSession
  window.SESSION_KEY_TOKEN = SESSION_KEY_TOKEN
  window.SESSION_KEY_USER_DATA = SESSION_KEY_USER_DATA
})()
