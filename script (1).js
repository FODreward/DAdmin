// --- Authentication Constants ---
const ADMIN_EMAIL = "admin@example.com"
const ADMIN_PASSWORD = "password123"
const ADMIN_PIN = "1234" // 4-digit PIN

const SESSION_KEY_AUTH = "isAuthenticated"
const SESSION_KEY_TOKEN = "accessToken"
const SESSION_KEY_PIN_VERIFIED = "isPinVerified"

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
function handleLoginForm() {
  const loginForm = document.getElementById("login-form")
  const emailInput = document.getElementById("email")
  const passwordInput = document.getElementById("password")
  const errorMessageDiv = document.getElementById("login-error-message")

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const email = emailInput.value
      const password = passwordInput.value

      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        setSession(SESSION_KEY_AUTH, true)
        setSession(SESSION_KEY_TOKEN, "dummy_admin_token_123") // Simulate an access token
        errorMessageDiv.classList.add("hidden")
        window.location.href = "/pin/" // Redirect to PIN verification in its folder
      } else {
        errorMessageDiv.textContent = "Invalid email or password."
        errorMessageDiv.classList.remove("hidden")
      }
    })
  }
}

// --- PIN Verification Form Logic ---
function handlePinForm() {
  const pinForm = document.getElementById("pin-form")
  const pinInput = document.getElementById("pin")
  const errorMessageDiv = document.getElementById("pin-error-message")

  if (pinForm) {
    pinForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const pin = pinInput.value

      if (pin === ADMIN_PIN) {
        setSession(SESSION_KEY_PIN_VERIFIED, true)
        errorMessageDiv.classList.add("hidden")
        window.location.href = "/dashboard/" // Redirect to dashboard in its folder
      } else {
        errorMessageDiv.textContent = "Invalid PIN. Please try again."
        errorMessageDiv.classList.remove("hidden")
      }
    })
  }
}

// --- Dashboard Specific Logic (from previous response) ---
// This part assumes your dashboard HTML is in index.html
// and its original script content is merged here.

// --- Data Storage (In-memory for demonstration) ---
const users = [
  { id: "user1", fullName: "Alice Smith", email: "alice@example.com", status: "active", role: "user" },
  { id: "user2", fullName: "Bob Johnson", email: "bob@example.com", status: "pending", role: "user" },
  { id: "user3", fullName: "Charlie Brown", email: "charlie@example.com", status: "suspended", role: "user" },
  { id: "user4", fullName: "Diana Prince", email: "diana@example.com", status: "active", role: "admin" },
  { id: "user5", fullName: "Eve Adams", email: "eve@example.com", status: "pending", role: "user" },
  { id: "user6", fullName: "Frank White", email: "frank@example.com", status: "active", role: "agent" },
]

const agents = [
  { id: "agent1", name: "Frank White", referralCode: "FRANK2023", referredUsers: 15 },
  { id: "agent2", name: "Grace Hopper", referralCode: "GRACE456", referredUsers: 8 },
]

const surveys = [
  { id: "survey1", title: "Product Feedback Q1", rewardPoints: 100, status: "active", totalCompletions: 500 },
  { id: "survey2", title: "Customer Satisfaction", rewardPoints: 50, status: "active", totalCompletions: 1200 },
  { id: "survey3", title: "New Feature Interest", rewardPoints: 200, status: "inactive", totalCompletions: 300 },
]

const pointTransfers = [
  { id: "transfer1", sender: "Admin", receiver: "alice@example.com", amount: 500, timestamp: "2024-01-15 10:30" },
  { id: "transfer2", sender: "Admin", receiver: "bob@example.com", amount: 200, timestamp: "2024-01-14 14:00" },
]

const redemptionRequests = [
  { id: "redemption1", user: "charlie@example.com", amount: 1000, type: "BTC", status: "pending" },
  { id: "redemption2", user: "diana@example.com", amount: 50, type: "Gift Card", status: "approved" },
  { id: "redemption3", user: "eve@example.com", amount: 200, type: "Gift Card", status: "pending" },
]

const systemSettings = [
  { key: "auto_user_approval", value: "true" },
  { key: "system_reward_percentage", value: "85" },
  { key: "min_redemption_points", value: "100" },
]

// --- DOM Elements (Dashboard) ---
let sidebar, mainContent, sidebarToggle, navLinks, sections
let totalUsersCard, totalSurveysCard, totalPointsCard, pendingRedemptionsCard, rewardPercentageCard
let systemSettingsTableBody,
  userManagementTableBody,
  agentManagementTableBody,
  surveyManagementTableBody,
  pointTransfersTableBody,
  redemptionRequestsTableBody
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

function renderSectionContent(sectionId) {
  switch (sectionId) {
    case "dashboard-overview-section":
      renderDashboardOverview()
      break
    case "system-settings-section":
      renderSystemSettings()
      break
    case "user-management-section":
      renderUserManagement()
      break
    case "agent-management-section":
      renderAgentManagement()
      break
    case "survey-management-section":
      renderSurveyManagement()
      break
    case "point-transfers-section":
      renderPointTransfers()
      break
    case "redemption-requests-section":
      renderRedemptionRequests()
      break
  }
}

// --- Dashboard Overview ---
function renderDashboardOverview() {
  if (totalUsersCard) totalUsersCard.textContent = users.length.toLocaleString()
  if (totalSurveysCard)
    totalSurveysCard.textContent = surveys.reduce((sum, s) => sum + s.totalCompletions, 0).toLocaleString()
  if (totalPointsCard)
    totalPointsCard.textContent = pointTransfers.reduce((sum, t) => sum + t.amount, 0).toLocaleString()
  if (pendingRedemptionsCard)
    pendingRedemptionsCard.textContent = redemptionRequests.filter((r) => r.status === "pending").length
  if (rewardPercentageCard)
    rewardPercentageCard.textContent = systemSettings.find((s) => s.key === "system_reward_percentage")?.value + "%"
}

// --- System Settings ---
function renderSystemSettings() {
  if (!systemSettingsTableBody) return
  systemSettingsTableBody.innerHTML = ""
  systemSettings.forEach((setting) => {
    const row = systemSettingsTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${setting.key}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <input type="${setting.key.includes("approval") ? "checkbox" : "text"}"
                       id="setting-value-${setting.key}"
                       class="setting-value-input ${setting.key.includes("approval") ? "sr-only" : "border border-gray-300 rounded-md p-1 w-full"}"
                       value="${setting.value}"
                       ${setting.key.includes("approval") ? (setting.value === "true" ? "checked" : "") : ""}>
                ${setting.key.includes("approval") ? `<div class="block bg-gray-600 w-14 h-8 rounded-full toggle-bg"></div><div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition toggle-dot"></div>` : ""}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button id="save-setting-${setting.key}" class="save-setting-btn text-indigo-600 hover:text-indigo-900 ml-2">Save</button>
            </td>
        `
    if (setting.key.includes("approval")) {
      const input = row.querySelector(`#setting-value-${setting.key}`)
      const toggleBg = row.querySelector(".toggle-bg")
      const toggleDot = row.querySelector(".toggle-dot")
      input.parentNode.classList.add(
        "relative",
        "inline-block",
        "w-14",
        "h-8",
        "align-middle",
        "select-none",
        "transition",
        "duration-200",
        "ease-in",
      )

      if (input.checked) {
        toggleBg.classList.remove("bg-gray-600")
        toggleBg.classList.add("bg-green-500")
        toggleDot.classList.add("translate-x-full")
      } else {
        toggleBg.classList.remove("bg-green-500")
        toggleBg.classList.add("bg-gray-600")
        toggleDot.classList.remove("translate-x-full")
      }

      input.addEventListener("change", (e) => {
        if (e.target.checked) {
          toggleBg.classList.remove("bg-gray-600")
          toggleBg.classList.add("bg-green-500")
          toggleDot.classList.add("translate-x-full")
        } else {
          toggleBg.classList.remove("bg-green-500")
          toggleBg.classList.add("bg-gray-600")
          toggleDot.classList.remove("translate-x-full")
        }
      })
    }
  })

  document.querySelectorAll(".save-setting-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const key = e.target.id.replace("save-setting-", "")
      const input = document.getElementById(`setting-value-${key}`)
      const newValue = input.type === "checkbox" ? input.checked.toString() : input.value
      const settingIndex = systemSettings.findIndex((s) => s.key === key)
      if (settingIndex !== -1) {
        systemSettings[settingIndex].value = newValue
        alert(`Setting "${key}" updated to "${newValue}"`)
        renderSystemSettings() // Re-render to reflect changes
      }
    })
  })
}

// --- User Management ---
function renderUserManagement() {
  if (!userManagementTableBody) return
  userManagementTableBody.innerHTML = ""
  users.forEach((user) => {
    const row = userManagementTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.fullName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${user.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${user.role}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                ${user.status === "pending" ? `<button id="approve-user-${user.id}" class="action-btn approve-user-btn text-green-600 hover:text-green-900 mr-2">Approve</button>` : ""}
                ${user.status === "pending" ? `<button id="reject-user-${user.id}" class="action-btn reject-user-btn text-red-600 hover:text-red-900 mr-2">Reject</button>` : ""}
                ${user.status === "active" ? `<button id="suspend-user-${user.id}" class="action-btn suspend-user-btn text-yellow-600 hover:text-yellow-900 mr-2">Suspend</button>` : ""}
                ${user.status === "suspended" ? `<button id="reactivate-user-${user.id}" class="action-btn reactivate-user-btn text-blue-600 hover:text-blue-900 mr-2">Reactivate</button>` : ""}
                ${user.role !== "agent" ? `<button id="promote-user-${user.id}" class="action-btn promote-user-btn text-purple-600 hover:text-purple-900">Promote to Agent</button>` : ""}
            </td>
        `
  })

  document.querySelectorAll(".approve-user-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const userId = e.target.id.replace("approve-user-", "")
      updateUserStatus(userId, "active")
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
      updateUserStatus(userId, "active")
    })
  })
  document.querySelectorAll(".promote-user-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const userId = e.target.id.replace("promote-user-", "")
      promoteUserToAgent(userId)
    })
  })

  if (autoUserApprovalToggle) {
    const autoApprovalSetting = systemSettings.find((s) => s.key === "auto_user_approval")
    if (autoApprovalSetting) {
      autoUserApprovalToggle.checked = autoApprovalSetting.value === "true"
      const toggleBg = autoUserApprovalToggle.nextElementSibling
      const toggleDot = toggleBg.nextElementSibling
      if (autoUserApprovalToggle.checked) {
        toggleBg.classList.remove("bg-gray-600")
        toggleBg.classList.add("bg-green-500")
        toggleDot.classList.add("translate-x-full")
      } else {
        toggleBg.classList.remove("bg-green-500")
        toggleBg.classList.add("bg-gray-600")
        toggleDot.classList.remove("translate-x-full")
      }
    }
    autoUserApprovalToggle.addEventListener("change", (e) => {
      const newValue = e.target.checked.toString()
      const settingIndex = systemSettings.findIndex((s) => s.key === "auto_user_approval")
      if (settingIndex !== -1) {
        systemSettings[settingIndex].value = newValue
        alert(`Auto User Approval set to ${newValue}`)
        const toggleBg = e.target.nextElementSibling
        const toggleDot = toggleBg.nextElementSibling
        if (e.target.checked) {
          toggleBg.classList.remove("bg-gray-600")
          toggleBg.classList.add("bg-green-500")
          toggleDot.classList.add("translate-x-full")
        } else {
          toggleBg.classList.remove("bg-green-500")
          toggleBg.classList.add("bg-gray-600")
          toggleDot.classList.remove("translate-x-full")
        }
      }
    })
  }

  if (approveAllPendingUsersBtn) {
    approveAllPendingUsersBtn.addEventListener("click", () => {
      users
        .filter((user) => user.status === "pending")
        .forEach((user) => {
          user.status = "active"
        })
      alert("All pending users approved!")
      renderUserManagement()
    })
  }

  if (rejectAllPendingUsersBtn) {
    rejectAllPendingUsersBtn.addEventListener("click", () => {
      users
        .filter((user) => user.status === "pending")
        .forEach((user) => {
          user.status = "rejected"
        })
      alert("All pending users rejected!")
      renderUserManagement()
    })
  }
}

function updateUserStatus(userId, newStatus) {
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex !== -1) {
    users[userIndex].status = newStatus
    alert(`User ${users[userIndex].fullName} status updated to ${newStatus}.`)
    renderUserManagement()
  }
}

function promoteUserToAgent(userId) {
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex !== -1 && users[userIndex].role !== "agent") {
    users[userIndex].role = "agent"
    if (!agents.some((a) => a.name === users[userIndex].fullName)) {
      agents.push({
        id: `agent${agents.length + 1}`,
        name: users[userIndex].fullName,
        referralCode: users[userIndex].fullName.toUpperCase().replace(/\s/g, "") + Math.floor(Math.random() * 100),
        referredUsers: 0,
      })
    }
    alert(`User ${users[userIndex].fullName} promoted to Agent.`)
    renderUserManagement()
    renderAgentManagement()
  } else if (userIndex !== -1 && users[userIndex].role === "agent") {
    alert(`User ${users[userIndex].fullName} is already an Agent.`)
  }
}

// --- Agent Management ---
function renderAgentManagement() {
  if (!agentManagementTableBody) return
  agentManagementTableBody.innerHTML = ""
  agents.forEach((agent) => {
    const row = agentManagementTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${agent.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${agent.referralCode}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${agent.referredUsers}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button id="revoke-agent-${agent.id}" class="action-btn revoke-agent-btn text-red-600 hover:text-red-900">Revoke Agent</button>
            </td>
        `
  })

  document.querySelectorAll(".revoke-agent-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const agentId = e.target.id.replace("revoke-agent-", "")
      revokeAgent(agentId)
    })
  })
}

function revokeAgent(agentId) {
  const agentIndex = agents.findIndex((a) => a.id === agentId)
  if (agentIndex !== -1) {
    const agentName = agents[agentIndex].name
    agents.splice(agentIndex, 1)
    const user = users.find((u) => u.fullName === agentName)
    if (user) {
      user.role = "user"
    }
    alert(`Agent ${agentName} revoked.`)
    renderAgentManagement()
    renderUserManagement()
  }
}

// --- Survey Management ---
function renderSurveyManagement() {
  if (!surveyManagementTableBody) return
  surveyManagementTableBody.innerHTML = ""
  surveys.forEach((survey) => {
    const row = surveyManagementTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${survey.title}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${survey.rewardPoints}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${survey.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${survey.totalCompletions}</td>
        `
  })
}

// --- Point Transfers ---
function renderPointTransfers() {
  if (!pointTransfersTableBody) return
  pointTransfersTableBody.innerHTML = ""
  pointTransfers.forEach((transfer) => {
    const row = pointTransfersTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${transfer.sender}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transfer.receiver}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transfer.amount}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transfer.timestamp}</td>
        `
  })
}

function setupSendPointsForm() {
  if (sendPointsForm) {
    sendPointsForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const receiverEmail = document.getElementById("receiver-email").value
      const amount = Number.parseInt(document.getElementById("transfer-amount").value)

      if (!receiverEmail || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid receiver email and amount.")
        return
      }

      const receiverUser = users.find((u) => u.email === receiverEmail)
      if (!receiverUser) {
        alert("Receiver email does not exist in user records.")
        return
      }

      const newTransfer = {
        id: `transfer${pointTransfers.length + 1}`,
        sender: "Admin",
        receiver: receiverEmail,
        amount: amount,
        timestamp: new Date().toLocaleString(),
      }
      pointTransfers.push(newTransfer)
      alert(`Successfully sent ${amount} points to ${receiverEmail}.`)
      sendPointsForm.reset()
      renderPointTransfers()
      renderDashboardOverview()
    })
  }
}

// --- Redemption Requests ---
function renderRedemptionRequests() {
  if (!redemptionRequestsTableBody) return
  redemptionRequestsTableBody.innerHTML = ""
  redemptionRequests.forEach((request) => {
    const row = redemptionRequestsTableBody.insertRow()
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${request.user}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.amount}</td>
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
      updateRedemptionStatus(requestId, "approved")
    })
  })
  document.querySelectorAll(".reject-redemption-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const requestId = e.target.id.replace("reject-redemption-", "")
      updateRedemptionStatus(requestId, "rejected")
    })
  })
}

function updateRedemptionStatus(requestId, newStatus) {
  const requestIndex = redemptionRequests.findIndex((r) => r.id === requestId)
  if (requestIndex !== -1) {
    redemptionRequests[requestIndex].status = newStatus
    alert(`Redemption request ${requestId} status updated to ${newStatus}.`)
    renderRedemptionRequests()
    renderDashboardOverview()
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
    // Covers /dashboard/index.html
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
    renderDashboardOverview()

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
