// This script contains all logic specific to the admin dashboard.
// It assumes `fetchApi`, `getSession`, `setSession`, `clearSession`,
// `SESSION_KEY_TOKEN`, `SESSION_KEY_USER_DATA` are available globally from script.js.

document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we are on the admin dashboard page
  // This check assumes the admin dashboard is at /dashboard/admin.html
  if (!window.location.pathname.includes("/dashboard/admin.html")) {
    return
  }

  // Ensure user is admin, otherwise redirect
  const session = window.getSession()
  if (!session || !session.currentUser || !session.currentUser.is_admin) {
    alert("Access Denied: You must be an administrator to view this page.")
    window.location.href = "/login.html" // Redirect to login page
    return
  }

  // --- Data Storage ---
  let users = []
  let agents = []
  let surveys = []
  let pointTransfers = []
  let redemptionRequests = []
  let systemSettings = [] // Will be populated on initial load

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
  let approveAllPendingUsersBtn, rejectAllPendingUsersBtn
  let sendPointsForm
  let logoutButton
  let createSurveyForm // New element for survey creation

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

    approveAllPendingUsersBtn = document.getElementById("approve-all-pending-users-btn")
    rejectAllPendingUsersBtn = document.getElementById("reject-all-pending-users-btn")

    sendPointsForm = document.getElementById("send-points-form")
    logoutButton = document.getElementById("logout-button")
    createSurveyForm = document.getElementById("create-survey-form") // Get the new form
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
      const stats = await window.fetchApi("/admin/dashboard/stats", "GET", null, true)
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
      const logs = await window.fetchApi("/dashboard/activity", "GET", null, true)
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
    systemSettingsTableBody.innerHTML = "" // Clear existing content
    try {
      systemSettings = await window.fetchApi("/admin/settings", "GET", null, true)

      systemSettings.forEach((setting) => {
        const row = systemSettingsTableBody.insertRow()
        // Explicitly check for 'auto_user_approval' key for checkbox rendering
        const isCheckbox = setting.key === "auto_user_approval"
        const isChecked = setting.value === "true" // Determine checked state for checkboxes

        row.innerHTML = `
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${setting.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${
                    isCheckbox
                      ? `
                      <label class="relative inline-block w-14 h-8 align-middle select-none transition duration-200 ease-in">
                          <input type="checkbox"
                                 id="setting-value-${setting.key}"
                                 class="sr-only setting-value-input"
                                 ${isChecked ? "checked" : ""}>
                          <div class="block w-14 h-8 rounded-full toggle-bg ${isChecked ? "bg-green-500" : "bg-gray-600"}"></div>
                          <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${isChecked ? "translate-x-full" : ""} toggle-dot"></div>
                      </label>
                  `
                      : `
                      <input type="text"
                             id="setting-value-${setting.key}"
                             class="border border-gray-300 rounded-md p-1 w-full text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                             value="${setting.value}">
                  `
                  }
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button id="save-setting-${setting.key}" class="save-setting-btn text-indigo-600 hover:text-indigo-900 ml-2">Save</button>
              </td>
          `
      })

      // Attach event listeners for saving settings
      document.querySelectorAll(".save-setting-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const key = e.target.id.replace("save-setting-", "")
          const input = document.getElementById(`setting-value-${key}`)
          const newValue = input.type === "checkbox" ? input.checked.toString() : input.value.trim()
          const setting = systemSettings.find((s) => s.key === key)

          try {
            await window.fetchApi(
              "/admin/settings",
              "PUT",
              { key, value: newValue, description: setting?.description || "" },
              true,
            )
            alert(`Setting "${key}" updated to "${newValue}"`)
            renderSystemSettings() // Re-render to reflect changes
          } catch (error) {
            alert(`Failed to save setting: ${error.message}`)
            console.error(`Error saving setting ${key}:`, error)
          }
        })
      })

      // Attach event listeners for the toggle switches (if any)
      systemSettings.forEach((setting) => {
        if (setting.key === "auto_user_approval") {
          const input = document.getElementById(`setting-value-${setting.key}`)
          if (input) {
            // Ensure the input element exists
            const toggleBg = input.nextElementSibling // The div with toggle-bg class
            const toggleDot = toggleBg.nextElementSibling // The div with toggle-dot class

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
        }
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
      users = await window.fetchApi("/admin/users", "GET", null, true)

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

      // Attach event listeners for individual user actions
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
          updateUserStatus(userId, "approved")
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
              await window.fetchApi(
                "/admin/users/bulk-status",
                "PUT",
                { user_ids: pendingUserIds, status: "approved" },
                true,
              )
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
              await window.fetchApi(
                "/admin/users/bulk-status",
                "PUT",
                { user_ids: pendingUserIds, status: "rejected" },
                true,
              )
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
    } catch (error) {
      console.error("Failed to fetch users:", error)
      alert(`Failed to load user data: ${error.message}`)
    }
  }

  async function updateUserStatus(userId, newStatus) {
    try {
      await window.fetchApi(`/admin/users/${userId}/status`, "PUT", { status: newStatus }, true)
      alert(`User status updated to ${newStatus}.`)
      renderUserManagement()
      renderDashboardOverview()
    } catch (error) {
      alert(`Failed to update user status: ${error.message}`)
    }
  }

  async function promoteUserToAgent(userId, isAgent) {
    try {
      const data = await window.fetchApi(
        `/admin/users/${userId}/agent`,
        "PUT",
        { user_id: Number.parseInt(userId), is_agent: isAgent },
        true,
      )
      alert(`Agent role ${isAgent ? "assigned" : "removed"}. Referral code: ${data.referral_code || "N/A"}`)
      renderUserManagement()
      renderAgentManagement()
    } catch (error) {
      alert(`Failed to update agent role: ${error.message}`)
    }
  }

  // --- Agent Management ---
  async function renderAgentManagement() {
    if (!agentManagementTableBody) return
    agentManagementTableBody.innerHTML = ""
    try {
      const allUsers = await window.fetchApi("/admin/users", "GET", null, true)
      agents = allUsers.filter((user) => user.is_agent)

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
          promoteUserToAgent(agentId, false)
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
      surveys = await window.fetchApi("/admin/surveys", "GET", null, true)

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

      // Setup Create Survey Form
      if (createSurveyForm) {
        createSurveyForm.removeEventListener("submit", handleCreateSurveyFormSubmit) // Prevent duplicate listeners
        createSurveyForm.addEventListener("submit", handleCreateSurveyFormSubmit)
      }
    } catch (error) {
      console.error("Failed to fetch surveys:", error)
      alert(`Failed to load survey data: ${error.message}`)
    }
  }

  async function handleCreateSurveyFormSubmit(e) {
    e.preventDefault()
    const title = document.getElementById("survey-title").value
    const description = document.getElementById("survey-description").value
    const pointsReward = Number.parseFloat(document.getElementById("survey-points-reward").value)

    if (!title || isNaN(pointsReward) || pointsReward <= 0) {
      alert("Please enter a valid title and a positive reward amount.")
      return
    }

    try {
      await window.fetchApi("/admin/surveys", "POST", { title, description, points_reward: pointsReward }, true)
      alert("Survey created successfully!")
      createSurveyForm.reset()
      renderSurveyManagement() // Re-render survey table
    } catch (error) {
      alert(`Failed to create survey: ${error.message}`)
    }
  }

  // --- Point Transfers (Admin uses same as user for sending, but views all transfers) ---
  async function renderPointTransfers() {
    if (!pointTransfersTableBody) return
    pointTransfersTableBody.innerHTML = ""
    try {
      // Fetch all point transfers (admin endpoint)
      pointTransfers = await window.fetchApi("/admin/point-transfers", "GET", null, true)

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

  function setupSendPointsForm() {
    if (sendPointsForm) {
      sendPointsForm.removeEventListener("submit", handleSendPointsFormSubmit) // Prevent duplicate listeners
      sendPointsForm.addEventListener("submit", handleSendPointsFormSubmit)
    }
  }

  async function handleSendPointsFormSubmit(e) {
    e.preventDefault()
    const receiverEmail = document.getElementById("receiver-email").value
    const amount = Number.parseFloat(document.getElementById("transfer-amount").value)

    if (!receiverEmail || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid receiver email and amount.")
      return
    }

    try {
      // Use the user-facing transfer endpoint, as specified
      await window.fetchApi("/points/transfer", "POST", { to_email: receiverEmail, amount: amount }, true)
      alert(`Successfully sent ${amount} points to ${receiverEmail}.`)
      sendPointsForm.reset()
      renderPointTransfers() // Re-render admin's view of all transfers
      renderDashboardOverview() // Update dashboard stats
    } catch (error) {
      alert(`Failed to send points: ${error.message}`)
    }
  }

  // --- Redemption Requests ---
  async function renderRedemptionRequests() {
    if (!redemptionRequestsTableBody) return
    redemptionRequestsTableBody.innerHTML = ""
    try {
      redemptionRequests = await window.fetchApi("/admin/redemptions", "GET", null, true)

      redemptionRequests.forEach((request) => {
        const row = redemptionRequestsTableBody.insertRow()
        row.innerHTML = `
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${request.user_id}</td>
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
          updateRedemptionStatus(requestId, "approve")
        })
      })
      document.querySelectorAll(".reject-redemption-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          const requestId = e.target.id.replace("reject-redemption-", "")
          updateRedemptionStatus(requestId, "reject")
        })
      })
    } catch (error) {
      console.error("Failed to fetch redemption requests:", error)
      alert(`Failed to load redemption requests: ${error.message}`)
    }
  }

  async function updateRedemptionStatus(requestId, action) {
    try {
      await window.fetchApi(`/admin/redemptions/${requestId}/process?action=${action}`, "PUT", null, true)
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
          } else if (sortBy === "timestamp" || sortBy.includes("created_at")) {
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

  // --- Main Initialization for Dashboard ---
  async function initializeAdminDashboard() {
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

    // Load system settings first, as user management depends on it
    await renderSystemSettings()
    await renderDashboardOverview()
    await renderActivityLog()

    // Logout button functionality
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        alert("Logging out...")
        window.clearSession()
        window.location.href = "/login.html" // Redirect to login page
      })
    }
  }

  // Call the main initialization function for the admin dashboard
  initializeAdminDashboard()
})
