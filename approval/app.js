// Gate Management PWA - Two-Screen System (Guard + Resident)

// State Management
const state = {
    currentUser: null,
    userRole: null, // 'guard' or 'resident'
    houseNumber: null,
    visitors: [],
    residents: [],
    selectedRole: null
};

// DOM Elements
const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    loginScreen: document.getElementById('login-screen'),
    roleSelection: document.getElementById('role-selection'),
    loginForm: document.getElementById('login-form'),
    selectedRoleInput: document.getElementById('selected-role'),
    loginRoleTitle: document.getElementById('login-role-title'),
    emailGroup: document.getElementById('email-group'),
    houseGroup: document.getElementById('house-group'),
    houseNumberGroup: document.getElementById('house-number-group'),
    houseNumberLogin: document.getElementById('house-number-login'),
    residentEmail: document.getElementById('resident-email'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    
    // Guard App
    guardApp: document.getElementById('guard-app'),
    guardVisitorForm: document.getElementById('guard-visitor-form'),
    guardSuccessMessage: document.getElementById('guard-success-message'),
    guardLogoutBtn: document.getElementById('guard-logout-btn'),
    guardThemeToggle: document.getElementById('guard-theme-toggle'),
    guardHouseNumber: document.getElementById('guard-house-number'),
    
    // Resident App
    residentApp: document.getElementById('resident-app'),
    residentPendingList: document.getElementById('resident-pending-list'),
    residentHistoryList: document.getElementById('resident-history-list'),
    residentPendingCount: document.getElementById('resident-pending-count'),
    residentApprovedCount: document.getElementById('resident-approved-count'),
    residentHouseNumber: document.getElementById('resident-house-number'),
    residentLogoutBtn: document.getElementById('resident-logout-btn'),
    residentThemeToggle: document.getElementById('resident-theme-toggle'),
    residentRefreshBtn: document.getElementById('resident-refresh-btn'),
    
    toast: document.getElementById('toast')
};

// Initialize App
async function initApp() {
    try {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                state.currentUser = user;
                await loadUserProfile();
                await loadAppData();
                showAppForRole();
            } else {
                showLogin();
            }
            hideLoading();
        });
        
        setupEventListeners();
        initTheme();
        populateHouseNumbers();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
        hideLoading();
    }
}

// Role Selection
function selectRole(role) {
    state.selectedRole = role;
    elements.selectedRoleInput.value = role;
    elements.roleSelection.classList.add('hidden');
    elements.loginForm.classList.remove('hidden');
    
    if (role === 'guard') {
        elements.loginRoleTitle.textContent = '🛡️ Guard Login';
        elements.emailGroup.classList.remove('hidden');
        elements.houseGroup.classList.add('hidden');
        elements.houseNumberGroup.classList.add('hidden');
        elements.email.type = 'email';
        elements.email.placeholder = 'your.email@example.com';
        elements.email.required = true;
        document.getElementById('login-footer-text').textContent = 'Enter your guard account email';
    } else {
        elements.loginRoleTitle.textContent = '🏠 Resident Login';
        elements.emailGroup.classList.add('hidden');
        elements.houseGroup.classList.remove('hidden');
        elements.houseNumberGroup.classList.remove('hidden');
        elements.residentEmail.classList.remove('hidden');
        elements.residentEmail.required = true;
        elements.houseNumberLogin.required = true;
        document.getElementById('login-footer-text').textContent = 'Enter your email and house number';
    }
}

function backToRoleSelection() {
    // Hide login form and show role selection
    elements.roleSelection.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
    
    // Reset form
    elements.loginForm.reset();
    
    // Hide all role-specific fields
    elements.emailGroup.classList.add('hidden');
    elements.houseGroup.classList.add('hidden');
    elements.houseNumberGroup.classList.add('hidden');
    
    // Remove required attributes
    elements.email.required = false;
    if (elements.residentEmail) {
        elements.residentEmail.required = false;
    }
    elements.houseNumberLogin.required = false;
    
    // Clear state
    state.selectedRole = null;
    
    // Reset footer text
    document.getElementById('login-footer-text').textContent = 'Select your role to continue';
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    
    try {
        let email, password, houseNumber;
        
        if (state.selectedRole === 'guard') {
            email = elements.email.value.trim();
            password = elements.password.value;
        } else {
            // Resident login
            email = elements.residentEmail.value.trim();
            password = elements.password.value;
            houseNumber = parseInt(elements.houseNumberLogin.value);
            
            // Validate house number
            if (!houseNumber || houseNumber < 1 || houseNumber > 48) {
                throw new Error('INVALID_HOUSE_NUMBER');
            }
        }
        
        // Authenticate with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        // Check/create user profile in Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            // First time login - create user profile
            const userData = {
                email: email,
                role: state.selectedRole,
                createdAt: firebase.firestore.Timestamp.now()
            };
            
            if (state.selectedRole === 'resident') {
                userData.houseNumber = houseNumber;
            }
            
            await db.collection('users').doc(userId).set(userData);
            showToast('Account setup complete!', 'success');
        } else {
            // Existing user - validate role matches
            const userData = userDoc.data();
            
            if (userData.role !== state.selectedRole) {
                await auth.signOut();
                throw new Error(`ROLE_MISMATCH_${userData.role.toUpperCase()}`);
            }
            
            // For residents, update house number if changed
            if (state.selectedRole === 'resident') {
                if (userData.houseNumber !== houseNumber) {
                    await db.collection('users').doc(userId).update({
                        houseNumber: houseNumber,
                        updatedAt: firebase.firestore.Timestamp.now()
                    });
                }
            }
        }
        
        showToast('Login successful!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        
        // Custom error messages
        if (error.message === 'INVALID_HOUSE_NUMBER') {
            showToast('House number must be between 1 and 48', 'error');
        } else if (error.message === 'ROLE_MISMATCH_GUARD') {
            showToast('This account is registered as a guard. Please select "Security Guard" option.', 'error');
        } else if (error.message === 'ROLE_MISMATCH_RESIDENT') {
            showToast('This account is registered as a resident. Please select "House Owner" option.', 'error');
        } else {
            showToast(getErrorMessage(error.code), 'error');
        }
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Failed to logout', 'error');
    }
}

// Load User Profile
async function loadUserProfile() {
    try {
        const userId = state.currentUser.uid;
        
        // Get user profile from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            throw new Error('User profile not found. Please try logging in again.');
        }
        
        const userData = userDoc.data();
        state.userRole = userData.role;
        
        if (userData.role === 'resident') {
            state.houseNumber = userData.houseNumber;
            
            // Validate house number
            if (!state.houseNumber || state.houseNumber < 1 || state.houseNumber > 48) {
                throw new Error('Invalid house number in profile.');
            }
        }
        
    } catch (error) {
        console.error('Load user profile error:', error);
        showToast(error.message || 'Failed to load profile', 'error');
        
        // Force logout on profile error
        setTimeout(async () => {
            await auth.signOut();
        }, 2000);
    }
}

// Data Loading
async function loadAppData() {
    try {
        if (state.userRole === 'guard') {
            await loadGuardData();
        } else {
            await loadResidentData();
        }
    } catch (error) {
        console.error('Data loading error:', error);
        showToast('Failed to load data', 'error');
    }
}

async function loadGuardData() {
    // Guard only needs to submit entries, no data loading required
    console.log('Guard interface ready');
}

async function loadResidentData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Real-time listener for visitors to this house
    db.collection('visitors')
        .where('houseNumber', '==', state.houseNumber)
        .where('createdAt', '>=', today)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            state.visitors = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            updateResidentStats();
            renderResidentPending();
            renderResidentHistory();
        }, error => {
            console.error('Error loading visitors:', error);
        });
}

// Guard Functions
async function handleGuardVisitorSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    const visitorData = {
        name: document.getElementById('guard-visitor-name').value,
        phone: document.getElementById('guard-visitor-phone').value,
        houseNumber: parseInt(document.getElementById('guard-house-number').value),
        purpose: document.getElementById('guard-purpose').value,
        vehicle: document.getElementById('guard-vehicle').value || null,
        notes: document.getElementById('guard-notes').value || null,
        status: 'pending',
        approvalStatus: null,
        createdBy: state.currentUser.email,
        createdAt: firebase.firestore.Timestamp.now(),
        entryTime: null,
        exitTime: null
    };
    
    setButtonLoading(submitBtn, true);
    try {
        await db.collection('visitors').add(visitorData);
        
        // Show success message
        elements.guardSuccessMessage.classList.remove('hidden');
        setTimeout(() => {
            elements.guardSuccessMessage.classList.add('hidden');
        }, 5000);
        
        showToast(`Notification sent to House ${visitorData.houseNumber}`, 'success');
        elements.guardVisitorForm.reset();
    } catch (error) {
        console.error('Add visitor error:', error);
        showToast('Failed to submit visitor', 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Resident Functions
function updateResidentStats() {
    const pending = state.visitors.filter(v => v.status === 'pending').length;
    const approved = state.visitors.filter(v => v.approvalStatus === 'approved').length;
    
    elements.residentPendingCount.textContent = pending;
    elements.residentApprovedCount.textContent = approved;
    
    // Show notification if there are pending visitors
    if (pending > 0 && document.hidden) {
        showNotification(`You have ${pending} pending visitor${pending > 1 ? 's' : ''}`);
    }
}

function renderResidentPending() {
    const pending = state.visitors.filter(v => v.status === 'pending');
    const container = elements.residentPendingList;
    
    if (pending.length === 0) {
        container.innerHTML = getEmptyState('No pending requests', 'You\'ll be notified when someone visits');
        return;
    }
    
    container.innerHTML = pending.map(visitor => createResidentPendingCard(visitor)).join('');
}

function createResidentPendingCard(visitor) {
    const time = visitor.createdAt?.toDate() || new Date();
    
    return `
        <div class="approval-card">
            <div class="approval-header">
                <div class="visitor-avatar">👤</div>
                <div class="visitor-info">
                    <h3>${escapeHtml(visitor.name)}</h3>
                    <p class="text-muted">${escapeHtml(visitor.phone)}</p>
                    <p class="time-badge">${formatTimeAgo(time)}</p>
                </div>
            </div>
            <div class="approval-details">
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <polyline points="17 11 19 13 23 9"></polyline>
                    </svg>
                    <span><strong>Purpose:</strong> ${escapeHtml(visitor.purpose)}</span>
                </div>
                ${visitor.vehicle ? `
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>
                        <path d="M19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>
                        <path d="M7 15h2m6 0h2m-8 0V7h8v8"></path>
                    </svg>
                    <span><strong>Vehicle:</strong> ${escapeHtml(visitor.vehicle)}</span>
                </div>
                ` : ''}
                ${visitor.notes ? `
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span><strong>Note:</strong> ${escapeHtml(visitor.notes)}</span>
                </div>
                ` : ''}
            </div>
            <div class="approval-actions">
                <button class="btn btn-success" onclick="approveVisitor('${visitor.id}')">
                    ✅ Approve Entry
                </button>
                <button class="btn btn-danger" onclick="rejectVisitor('${visitor.id}')">
                    ❌ Reject
                </button>
            </div>
        </div>
    `;
}

function renderResidentHistory() {
    const filter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
    let filtered = state.visitors.filter(v => v.status !== 'pending');
    
    if (filter === 'approved') {
        filtered = filtered.filter(v => v.approvalStatus === 'approved');
    } else if (filter === 'rejected') {
        filtered = filtered.filter(v => v.approvalStatus === 'rejected');
    }
    
    const container = elements.residentHistoryList;
    
    if (filtered.length === 0) {
        container.innerHTML = getEmptyState('No history', 'Approved/rejected visitors will appear here');
        return;
    }
    
    container.innerHTML = filtered.map(visitor => createResidentHistoryCard(visitor)).join('');
}

function createResidentHistoryCard(visitor) {
    const time = visitor.createdAt?.toDate() || new Date();
    const entryTime = visitor.entryTime?.toDate();
    const isApproved = visitor.approvalStatus === 'approved';
    
    return `
        <div class="history-card ${isApproved ? 'approved' : 'rejected'}">
            <div class="history-status">
                ${isApproved ? '✅' : '❌'}
            </div>
            <div class="history-info">
                <h4>${escapeHtml(visitor.name)}</h4>
                <p class="text-muted">${escapeHtml(visitor.phone)}</p>
                <div class="history-meta">
                    <span>${escapeHtml(visitor.purpose)}</span>
                    <span>•</span>
                    <span>${formatTime(time)}</span>
                </div>
                ${entryTime ? `<p class="entry-time">Entered: ${formatTime(entryTime)}</p>` : ''}
            </div>
        </div>
    `;
}

async function approveVisitor(visitorId) {
    try {
        await db.collection('visitors').doc(visitorId).update({
            status: 'approved',
            approvalStatus: 'approved',
            approvedAt: firebase.firestore.Timestamp.now(),
            approvedBy: state.currentUser.email,
            entryTime: firebase.firestore.Timestamp.now()
        });
        showToast('Visitor approved! They can enter now.', 'success');
    } catch (error) {
        console.error('Approve visitor error:', error);
        showToast('Failed to approve visitor', 'error');
    }
}

async function rejectVisitor(visitorId) {
    try {
        await db.collection('visitors').doc(visitorId).update({
            status: 'rejected',
            approvalStatus: 'rejected',
            rejectedAt: firebase.firestore.Timestamp.now(),
            rejectedBy: state.currentUser.email
        });
        showToast('Visitor request rejected', 'success');
    } catch (error) {
        console.error('Reject visitor error:', error);
        showToast('Failed to reject visitor', 'error');
    }
}

function filterResidentHistory(filter) {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    renderResidentHistory();
}

// Event Listeners
function setupEventListeners() {
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.guardLogoutBtn?.addEventListener('click', handleLogout);
    elements.residentLogoutBtn?.addEventListener('click', handleLogout);
    
    elements.guardVisitorForm?.addEventListener('submit', handleGuardVisitorSubmit);
    
    elements.guardThemeToggle?.addEventListener('click', toggleTheme);
    elements.residentThemeToggle?.addEventListener('click', toggleTheme);
    
    elements.residentRefreshBtn?.addEventListener('click', () => {
        showToast('Refreshing...', 'info');
        loadResidentData();
    });
}

// UI State Management
function showLogin() {
    elements.loginScreen.classList.remove('hidden');
    elements.guardApp.classList.add('hidden');
    elements.residentApp.classList.add('hidden');
    elements.roleSelection.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
}

function showAppForRole() {
    elements.loginScreen.classList.add('hidden');
    
    if (state.userRole === 'guard') {
        elements.guardApp.classList.remove('hidden');
        elements.residentApp.classList.add('hidden');
    } else {
        elements.guardApp.classList.add('hidden');
        elements.residentApp.classList.remove('hidden');
        elements.residentHouseNumber.textContent = state.houseNumber;
    }
}

function hideLoading() {
    elements.loadingScreen.classList.add('hidden');
}

function setButtonLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    
    if (loading) {
        button.disabled = true;
        btnText?.classList.add('hidden');
        btnLoader?.classList.remove('hidden');
    } else {
        button.disabled = false;
        btnText?.classList.remove('hidden');
        btnLoader?.classList.add('hidden');
    }
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    document.querySelectorAll('.sun-icon, .moon-icon').forEach(icon => {
        if (theme === 'dark') {
            if (icon.classList.contains('sun-icon')) icon.classList.add('hidden');
            if (icon.classList.contains('moon-icon')) icon.classList.remove('hidden');
        } else {
            if (icon.classList.contains('sun-icon')) icon.classList.remove('hidden');
            if (icon.classList.contains('moon-icon')) icon.classList.add('hidden');
        }
    });
}

// Toast Notifications
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    
    setTimeout(() => elements.toast.classList.add('show'), 10);
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Browser Notifications
function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('GateKeeper', {
            body: message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png'
        });
    }
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Utility Functions
function populateHouseNumbers() {
    const selects = [elements.guardHouseNumber, elements.houseNumberLogin];
    
    selects.forEach(select => {
        if (!select) return;
        for (let i = 1; i <= 48; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `House ${i}`;
            select.appendChild(option);
        }
    });
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    }).format(date);
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return formatTime(date);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getEmptyState(title, message) {
    return `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

function getErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid credentials'
    };
    return messages[code] || 'Login failed. Please try again.';
}

// Make functions globally available
window.selectRole = selectRole;
window.backToRoleSelection = backToRoleSelection;
window.approveVisitor = approveVisitor;
window.rejectVisitor = rejectVisitor;
window.filterResidentHistory = filterResidentHistory;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
