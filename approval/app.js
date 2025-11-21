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
    guardPendingList: document.getElementById('guard-pending-list'),
    guardHistoryList: document.getElementById('guard-history-list'),
    guardPendingCount: document.getElementById('guard-pending-count'),
    guardApprovedCount: document.getElementById('guard-approved-count'),
    guardRejectedCount: document.getElementById('guard-rejected-count'),
    guardLogoutBtn: document.getElementById('guard-logout-btn'),
    guardThemeToggle: document.getElementById('guard-theme-toggle'),
    guardRefreshBtn: document.getElementById('guard-refresh-btn'),
    guardHouseNumber: document.getElementById('guard-house-number'),
    guardAddVisitorBtn: document.getElementById('guard-add-visitor-btn'),
    addVisitorModal: document.getElementById('add-visitor-modal'),
    
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
            email = elements.residentEmail.value.trim();
            password = elements.password.value;
            houseNumber = parseInt(elements.houseNumberLogin.value);
            if (!houseNumber || houseNumber < 1 || houseNumber > 48) {
                throw new Error('INVALID_HOUSE_NUMBER');
            }
        }
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
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
            const userData = userDoc.data();
            if (userData.role !== state.selectedRole) {
                await auth.signOut();
                throw new Error(`ROLE_MISMATCH_${userData.role.toUpperCase()}`);
            }
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
        let message = '';
        if (error.message === 'INVALID_HOUSE_NUMBER') {
            message = 'House number must be between 1 and 48';
        } else if (error.message === 'ROLE_MISMATCH_GUARD') {
            message = 'This account is registered as a guard. Please select "Security Guard" option.';
        } else if (error.message === 'ROLE_MISMATCH_RESIDENT') {
            message = 'This account is registered as a resident. Please select "House Owner" option.';
        } else {
            message = getErrorMessage(error.code);
        }
        showToast(message, 'error');
        // Focus password field and shake toast for better UX
        elements.password.classList.add('input-error');
        setTimeout(() => elements.password.classList.remove('input-error'), 600);
        const toast = document.getElementById('toast');
        if (toast) {
            toast.classList.add('shake');
            setTimeout(() => toast.classList.remove('shake'), 600);
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
        
        // Only force logout on critical errors, not permission errors
        if (error.message && error.message.includes('Invalid') && !error.code?.includes('permission')) {
            setTimeout(async () => {
                await auth.signOut();
            }, 2000);
        }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Real-time listener for all visitors created today
    db.collection('visitors')
        .onSnapshot(snapshot => {
            // Filter and sort in JavaScript instead of Firestore
            state.visitors = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(visitor => {
                    const visitorDate = visitor.createdAt?.toDate() || new Date(0);
                    return visitorDate >= today;
                })
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate() || new Date(0);
                    const dateB = b.createdAt?.toDate() || new Date(0);
                    return dateB - dateA; // descending order
                });
            updateGuardStats();
            renderGuardPending();
            renderGuardHistory();
        }, error => {
            console.error('Error loading visitors:', error);
            showToast('Failed to load visitor data', 'error');
        });
}

async function loadResidentData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Real-time listener for visitors to this house
    // Simplified query without composite index requirement
    db.collection('visitors')
        .where('houseNumber', '==', state.houseNumber)
        .onSnapshot(snapshot => {
            // Filter and sort in JavaScript instead of Firestore
            state.visitors = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(visitor => {
                    const visitorDate = visitor.createdAt?.toDate() || new Date(0);
                    return visitorDate >= today;
                })
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate() || new Date(0);
                    const dateB = b.createdAt?.toDate() || new Date(0);
                    return dateB - dateA; // descending order
                });
            updateResidentStats();
            renderResidentPending();
            renderResidentHistory();
        }, error => {
            console.error('Error loading visitors:', error);
            showToast('Failed to load visitor data', 'error');
        });
}

// Guard Functions
function updateGuardStats() {
    const pending = state.visitors.filter(v => v.status === 'pending').length;
    const approved = state.visitors.filter(v => v.approvalStatus === 'approved').length;
    const rejected = state.visitors.filter(v => v.approvalStatus === 'rejected').length;
    
    elements.guardPendingCount.textContent = pending;
    elements.guardApprovedCount.textContent = approved;
    elements.guardRejectedCount.textContent = rejected;
}

function renderGuardPending() {
    const pending = state.visitors.filter(v => v.status === 'pending');
    const container = elements.guardPendingList;
    
    if (pending.length === 0) {
        container.innerHTML = getEmptyState('No pending approvals', 'All visitor requests have been processed');
        return;
    }
    
    // Show only first 3 by default, add Show More if more
    let showCount = 3;
    let html = pending.slice(0, showCount).map(visitor => createGuardPendingCard(visitor)).join('');
    if (pending.length > showCount) {
        html += `<button class="btn btn-secondary btn-show-more" onclick="window.showMorePending()">Show More</button>`;
    }
    container.innerHTML = html;
    window._pendingShowCount = showCount;
    window._pendingData = pending;
}

function createGuardPendingCard(visitor) {
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
                <div class="status-badge status-pending">⏳ Pending</div>
            </div>
            <div class="approval-details">
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span><strong>House:</strong> ${visitor.houseNumber}</span>
                </div>
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
            <div class="approval-actions" style="margin-top:1em;">
                <button class="btn btn-sm btn-danger" onclick="markVisitorExit('${visitor.id}')">Mark Exit</button>
            </div>
        </div>
    `;
}

// Guard: Mark visitor as exited
async function markVisitorExit(visitorId) {
    try {
        console.log('[DEBUG] Marking exit for visitor:', visitorId);
        if (!db) {
            showToast('Database not initialized', 'error');
            return;
        }
        await db.collection('visitors').doc(visitorId).update({
            exitTime: firebase.firestore.Timestamp.now()
        });
        showToast('Visitor marked as exited', 'success');
        console.log('[DEBUG] Exit marked successfully');
        loadGuardData();
    } catch (error) {
        console.error('[ERROR] Failed to mark exit:', error);
        showToast('Failed to mark exit: ' + error.message, 'error');
    }
}

// Expose markVisitorExit to global scope
window.markVisitorExit = markVisitorExit;

function renderGuardHistory() {
    const filter = document.querySelector('#guard-app .filter-tab.active')?.dataset.filter || 'all';
    let filtered = state.visitors.filter(v => v.status !== 'pending');
    
    if (filter === 'approved') {
        filtered = filtered.filter(v => v.approvalStatus === 'approved');
    } else if (filter === 'rejected') {
        filtered = filtered.filter(v => v.approvalStatus === 'rejected');
    }
    
    const container = elements.guardHistoryList;
    
    if (filtered.length === 0) {
        container.innerHTML = getEmptyState('No history', 'Approved/rejected visitors will appear here');
        return;
    }
    
    container.innerHTML = filtered.map(visitor => createGuardHistoryCard(visitor)).join('');
}

function createGuardHistoryCard(visitor) {
    const time = visitor.createdAt?.toDate() || new Date();
    const entryTime = visitor.entryTime?.toDate();
    const isApproved = visitor.approvalStatus === 'approved';
    
    return `
        <div class="history-card ${isApproved ? 'approved' : 'rejected'}" style="position:relative;">
            <div class="history-status">
                ${isApproved ? '✅' : '❌'}
            </div>
            ${isApproved && !visitor.exitTime ? `<button class=\"icon-exit-btn\" title=\"Mark Exit\" onclick=\"markVisitorExit('${visitor.id}')\"><svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\"/></svg></button>` : ''}
            <div class="history-info">
                <h4>${escapeHtml(visitor.name)}</h4>
                <p class="text-muted">${escapeHtml(visitor.phone)} • House ${visitor.houseNumber}</p>
                <div class="history-meta">
                    <span>${escapeHtml(visitor.purpose)}</span>
                    <span>•</span>
                    <span>${formatTime(time)}</span>
                </div>
                ${isApproved && entryTime ? `<p class="entry-time">✅ Approved: ${formatTime(entryTime)}</p>` : ''}
                ${!isApproved && visitor.rejectedAt ? `<p class="entry-time">❌ Rejected: ${formatTime(visitor.rejectedAt.toDate())}</p>` : ''}
                ${isApproved && visitor.exitTime ? `<p class="entry-time">🚪 Exited: ${formatTime(visitor.exitTime.toDate())}</p>` : ''}
            </div>
        </div>
    `;
}

function filterGuardHistory(filter) {
    document.querySelectorAll('#guard-app .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    renderGuardHistory();
}

function openAddVisitorModal() {
    console.log('[DEBUG] openAddVisitorModal called');
    elements.addVisitorModal.classList.remove('hidden');
    elements.addVisitorModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAddVisitorModal() {
    elements.addVisitorModal.classList.remove('active');
    elements.addVisitorModal.classList.add('hidden');
    document.body.style.overflow = '';
    elements.guardVisitorForm.reset();
}

async function handleGuardVisitorSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Validation
    const name = document.getElementById('guard-visitor-name').value.trim();
    const phone = document.getElementById('guard-visitor-phone').value.trim();
    const houseNumber = parseInt(document.getElementById('guard-house-number').value);
    const purpose = document.getElementById('guard-purpose').value;
    const vehicle = document.getElementById('guard-vehicle').value.trim() || null;
    const notes = document.getElementById('guard-notes').value.trim() || null;

    if (!name || !phone || !houseNumber || !purpose) {
        showToast('Please fill all required fields', 'error');
        setButtonLoading(submitBtn, false);
        return;
    }
    if (!/^\d{10}$/.test(phone)) {
        showToast('Enter a valid 10-digit mobile number', 'error');
        setButtonLoading(submitBtn, false);
        return;
    }
    if (name.length > 40) {
        showToast('Name too long', 'error');
        setButtonLoading(submitBtn, false);
        return;
    }

    const visitorData = {
        name,
        phone,
        houseNumber,
        purpose,
        vehicle,
        notes,
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
        showToast(`Notification sent to House ${visitorData.houseNumber}`, 'success');
        closeAddVisitorModal();
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
    
    // Show notification and repeat sound if there are pending visitors
    if (pending > 0 && document.hidden) {
        showNotification(`You have ${pending} pending visitor${pending > 1 ? 's' : ''}`, true);
    } else {
        stopNotificationSoundLoop();
    }
}

function renderResidentPending() {
    const pending = state.visitors.filter(v => v.status === 'pending');
    const container = elements.residentPendingList;
    
    if (pending.length === 0) {
        stopNotificationSoundLoop();
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
    const exitTime = visitor.exitTime?.toDate();
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
                ${entryTime ? `<p class="entry-time">✅ Entered: ${formatTime(entryTime)}</p>` : ''}
                ${exitTime ? `<p class="entry-time">🚪 Exited: ${formatTime(exitTime)}</p>` : ''}
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
        stopNotificationSoundLoop();
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
        stopNotificationSoundLoop();
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
        // Auto-refresh on app resume (Android/iOS)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                showToast('Refreshing...', 'info');
                loadAppData();
            }
        });
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.guardLogoutBtn?.addEventListener('click', handleLogout);
    elements.residentLogoutBtn?.addEventListener('click', handleLogout);
    
    elements.guardVisitorForm?.addEventListener('submit', handleGuardVisitorSubmit);
    if (elements.guardAddVisitorBtn) {
        elements.guardAddVisitorBtn.addEventListener('click', openAddVisitorModal);
    }
    
    elements.guardThemeToggle?.addEventListener('click', toggleTheme);
    elements.residentThemeToggle?.addEventListener('click', toggleTheme);
    
    elements.guardRefreshBtn?.addEventListener('click', () => {
        showToast('Refreshing...', 'info');
        loadGuardData();
    });
    
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
    // Hide FAB on login screen
    var fab = document.getElementById('fab-add-visitor');
    if (fab) fab.style.display = 'none';
}

function showAppForRole() {
    elements.loginScreen.classList.add('hidden');
    var fab = document.getElementById('fab-add-visitor');
    if (state.userRole === 'guard') {
        elements.guardApp.classList.remove('hidden');
        elements.residentApp.classList.add('hidden');
        if (fab) fab.style.display = 'flex';
    } else {
        elements.guardApp.classList.add('hidden');
        elements.residentApp.classList.remove('hidden');
        elements.residentHouseNumber.textContent = state.houseNumber;
        if (fab) fab.style.display = 'none';
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
// Unlock audio playback on first user interaction (required by browsers)
function unlockNotificationAudio() {
    let audio = document.getElementById('notification-audio');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'notification-audio';
        audio.src = '/shared/notification.mp3';
        audio.preload = 'auto';
        document.body.appendChild(audio);
    }
    audio.muted = true;
    audio.play().catch(() => {});
    setTimeout(() => { audio.pause(); audio.muted = false; }, 100);
    window.removeEventListener('pointerdown', unlockNotificationAudio);
    window.removeEventListener('keydown', unlockNotificationAudio);
}
window.addEventListener('pointerdown', unlockNotificationAudio, { once: true });
window.addEventListener('keydown', unlockNotificationAudio, { once: true });
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    
    setTimeout(() => elements.toast.classList.add('show'), 10);
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Browser Notifications
// Notification sound loop control
let notificationSoundInterval = null;
function startNotificationSoundLoop() {
    stopNotificationSoundLoop();
    let audio = document.getElementById('notification-audio');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'notification-audio';
        audio.src = '/shared/notification.mp3';
        audio.preload = 'auto';
        document.body.appendChild(audio);
    }
    // Play immediately, then repeat every 3 seconds
    try { audio.currentTime = 0; audio.play(); } catch (e) {}
    notificationSoundInterval = setInterval(() => {
        try { audio.currentTime = 0; audio.play(); } catch (e) {}
    }, 3000);
}
function stopNotificationSoundLoop() {
    if (notificationSoundInterval) {
        clearInterval(notificationSoundInterval);
        notificationSoundInterval = null;
    }
    let audio = document.getElementById('notification-audio');
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }
}

function showNotification(message, repeatSound) {
    if (repeatSound) {
        startNotificationSoundLoop();
    } else {
        stopNotificationSoundLoop();
        // Play once
        let audio = document.getElementById('notification-audio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'notification-audio';
            audio.src = '/shared/notification.mp3';
            audio.preload = 'auto';
            document.body.appendChild(audio);
        }
        try { audio.currentTime = 0; audio.play(); } catch (e) {}
    }

    // Show browser notification if possible
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('GateKeeper', {
                body: message,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png'
            });
        } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    new Notification('GateKeeper', {
                        body: message,
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-72x72.png'
                    });
                } else {
                    showToast(message, 'info');
                }
            });
        } else {
            showToast(message, 'info');
        }
    } else {
        showToast(message, 'info');
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
window.filterGuardHistory = filterGuardHistory;
window.openAddVisitorModal = openAddVisitorModal;
window.closeAddVisitorModal = closeAddVisitorModal;

// Toggle History Section
window.toggleHistorySection = function() {
    const section = document.getElementById('history-section-content');
    const icon = document.getElementById('history-toggle-icon');
    if (section.style.display === 'none') {
        section.style.display = '';
        icon.innerHTML = '&#9660;';
    } else {
        section.style.display = 'none';
        icon.innerHTML = '&#9654;';
    }
};

// Show More Pending
window.showMorePending = function() {
    const container = elements.guardPendingList;
    let showCount = (window._pendingShowCount || 3) + 5;
    let pending = window._pendingData || [];
    let html = pending.slice(0, showCount).map(visitor => createGuardPendingCard(visitor)).join('');
    if (pending.length > showCount) {
        html += `<button class=\"btn btn-secondary btn-show-more\" onclick=\"window.showMorePending()\">Show More</button>`;
    }
    container.innerHTML = html;
    window._pendingShowCount = showCount;
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
