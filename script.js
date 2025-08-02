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
    if (isAuthenticated) {
      if (isPinVerified) {
        window.location.href = "/dashboard/"
      } else {
        window.location.href = "/pin/"
      }
    }
    return // Stay on login page if not authenticated
  }

  // If on PIN verify page (inside /pin/ folder)
  if (currentPath.includes("/pin/")) {
    if (!isAuthenticated) {
      window.location.href = "/"
    } else if (isPinVerified) {
      window.location.href = "/dashboard/"
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

// --- Global Event Listener for all pages ---
document.addEventListener("DOMContentLoaded", () => {
  protectRoute() // Run protection on every page load

  // Initialize specific page logic based on current URL
  const currentPath = window.location.pathname

  if (currentPath === "/" || currentPath.includes("index.html")) {
    handleLoginForm()
  } else if (currentPath.includes("/pin/")) {
    handlePinForm()
  }
  // Dashboard specific logic will be handled by admin-dashboard.js
})

// Expose functions to global scope if needed by other scripts (e.g., admin-dashboard.js)
window.fetchApi = fetchApi
window.setSession = setSession
window.getSession = getSession
window.clearSession = clearSession
window.SESSION_KEY_TOKEN = SESSION_KEY_TOKEN
window.SESSION_KEY_USER_DATA = SESSION_KEY_USER_DATA
