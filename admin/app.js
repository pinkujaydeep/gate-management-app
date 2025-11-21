// Gate Management PWA - Main Application Logic

// State Management
const state = {
    currentUser: null,
    currentView: 'dashboard',
    visitors: [],
    residents: [],
    history: [],
    filters: {
        visitorStatus: 'all',
        searchQuery: ''
    }
};

// DOM Elements
const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    loginScreen: document.getElementById('login-screen'),
    app: document.getElementById('app'),
    loginForm: document.getElementById('login-form'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Navigation
    menuBtn: document.getElementById('menu-btn'),
    navMenu: document.getElementById('nav-menu'),
    navClose: document.getElementById('nav-close'),
    navItems: document.querySelectorAll('.nav-item'),
    
    // Theme
    themeToggle: document.getElementById('theme-toggle'),
    
    // Views
    views: document.querySelectorAll('.view'),
    
    // Dashboard
    activeVisitorsCount: document.getElementById('active-visitors'),
    todayEntriesCount: document.getElementById('today-entries'),
    pendingExitsCount: document.getElementById('pending-exits'),
    recentVisitorsList: document.getElementById('recent-visitors'),
    
    // Visitors
    visitorsList: document.getElementById('visitors-list'),
    visitorSearch: document.getElementById('visitor-search'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    
    // Residents
    residentsGrid: document.getElementById('residents-grid'),
    residentSearch: document.getElementById('resident-search'),
    
    // History
    historyList: document.getElementById('history-list'),
    historySearch: document.getElementById('history-search'),
    historyDate: document.getElementById('history-date'),
    
    // Modals
    visitorModal: document.getElementById('visitor-modal'),
    residentModal: document.getElementById('resident-modal'),
    exitModal: document.getElementById('exit-modal'),
    
    // Forms
    visitorForm: document.getElementById('visitor-form'),
    residentForm: document.getElementById('resident-form'),
    
    // Toast
    toast: document.getElementById('toast')
};

// Initialize App
async function initApp() {
    try {
        // Check auth state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Validate admin role
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    
                    if (!userDoc.exists) {
                        // User document doesn't exist - log out
                        await auth.signOut();
                        showToast('Access denied. Admin account not configured.', 'error');
                        showLogin();
                        hideLoading();
                        return;
                    }
                    
                    const userData = userDoc.data();
                    
                    if (userData.role !== 'admin') {
                        // Not an admin - log out
                        await auth.signOut();
                        showToast('Access denied. Admin privileges required.', 'error');
                        showLogin();
                        hideLoading();
                        return;
                    }
                    
                    // Valid admin user
                    state.currentUser = user;
                    await loadAppData();
                    showApp();
                } catch (error) {
                    console.error('Role validation error:', error);
                    await auth.signOut();
                    showToast('Authentication error. Please try again.', 'error');
                    showLogin();
                }
            } else {
                showLogin();
            }
            hideLoading();
        });
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup theme
        initTheme();
        
        // Ensure navigation is closed on load
        const navMenu = document.getElementById('nav-menu');
        const navOverlay = document.getElementById('nav-overlay');
        if (navMenu) navMenu.classList.remove('active');
        if (navOverlay) navOverlay.classList.remove('active');
        
        // Populate house numbers
        populateHouseNumbers();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
        hideLoading();
    }
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    setButtonLoading(submitBtn, true);
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showToast(getErrorMessage(error.code), 'error');
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

// Data Loading
async function loadAppData() {
    try {
        await Promise.all([
            loadResidents(),
            loadVisitors(),
            loadHistory()
        ]);
        updateDashboard();
    } catch (error) {
        console.error('Data loading error:', error);
        showToast('Failed to load data', 'error');
    }
}

async function loadResidents() {
    const snapshot = await db.collection('residents').orderBy('houseNumber').get();
    state.residents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    renderResidents();
}

async function loadVisitors() {
    // Get selected date from date picker
    const dateInput = document.getElementById('visitor-date');
    let selectedDate = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();
    selectedDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);

    const snapshot = await db.collection('visitors')
        .where('entryTime', '>=', selectedDate)
        .where('entryTime', '<', nextDay)
        .orderBy('entryTime', 'desc')
        .get();

    state.visitors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    renderVisitors();
}

// Listen for date picker changes
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('visitor-date');
    if (dateInput) {
        // Set default to today
        const today = new Date();
        dateInput.value = today.toISOString().slice(0, 10);
        dateInput.addEventListener('change', loadVisitors);
    }
});

async function loadHistory() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const snapshot = await db.collection('visitors')
        .where('entryTime', '>=', sevenDaysAgo)
        .orderBy('entryTime', 'desc')
        .limit(100)
        .get();
    
    state.history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    renderHistory();
}

// Visitor Management
async function addVisitor(data) {
    try {
        const visitor = {
            ...data,
            entryTime: firebase.firestore.Timestamp.now(),
            status: 'active',
            exitTime: null,
            createdBy: state.currentUser.email,
            createdAt: firebase.firestore.Timestamp.now()
        };
        
        await db.collection('visitors').add(visitor);
        await loadVisitors();
        updateDashboard();
        showToast('Visitor entry added successfully', 'success');
        closeModal(elements.visitorModal);
    } catch (error) {
        console.error('Add visitor error:', error);
        showToast('Failed to add visitor', 'error');
        throw error;
    }
}

async function exitVisitor(visitorId) {
    try {
        await db.collection('visitors').doc(visitorId).update({
            status: 'exited',
            exitTime: firebase.firestore.Timestamp.now()
        });
        
        await loadVisitors();
        await loadHistory();
        updateDashboard();
        showToast('Visitor marked as exited', 'success');
        closeModal(elements.exitModal);
    } catch (error) {
        console.error('Exit visitor error:', error);
        showToast('Failed to exit visitor', 'error');
        throw error;
    }
}

// Resident Management
async function addResident(data) {
    let newUserId = null;
    try {
        // Store current admin auth to restore later
        const currentAdmin = auth.currentUser;
        
        // Create a secondary app instance to create user without logging out admin
        const secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = secondaryApp.auth();
        
        // Create the Firebase Authentication user in secondary instance
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(data.email, data.password);
        newUserId = userCredential.user.uid;
        
        // Sign out from secondary instance and delete it
        await secondaryAuth.signOut();
        await secondaryApp.delete();
        
        // Create user document in Firestore with role
        await db.collection('users').doc(newUserId).set({
            email: data.email,
            role: 'resident',
            houseNumber: data.houseNumber,
            name: data.ownerName,
            createdAt: firebase.firestore.Timestamp.now(),
            createdBy: state.currentUser.email
        });
        
        // Create resident document
        const resident = {
            houseNumber: data.houseNumber,
            ownerName: data.ownerName,
            contactNumber: data.contactNumber,
            email: data.email,
            userId: newUserId,
            createdBy: state.currentUser.email,
            createdAt: firebase.firestore.Timestamp.now()
        };
        
        await db.collection('residents').add(resident);
        await loadResidents();
        showToast(`Resident added successfully! Login: ${data.email}`, 'success');
        closeModal(elements.residentModal);
    } catch (error) {
        console.error('Add resident error:', error);
        
        // Clean up user if resident creation failed
        if (newUserId) {
            try {
                await db.collection('users').doc(newUserId).delete();
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
        
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already registered', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password should be at least 6 characters', 'error');
        } else {
            showToast('Failed to add resident: ' + error.message, 'error');
        }
        throw error;
    }
}

// Rendering Functions
function renderVisitors() {
    const filtered = filterVisitors();
    const container = elements.visitorsList;
    
    if (filtered.length === 0) {
        container.innerHTML = getEmptyState('No visitors found', 'Try adjusting your filters or add a new visitor entry');
        return;
    }
    
    container.innerHTML = filtered.map(visitor => createVisitorCard(visitor)).join('');
}

function renderRecentVisitors() {
    const recent = state.visitors
        .filter(v => v.status === 'active')
        .slice(0, 5);
    
    const container = elements.recentVisitorsList;
    
    if (recent.length === 0) {
        container.innerHTML = getEmptyState('No active visitors', 'All visitors have exited');
        return;
    }
    
    container.innerHTML = recent.map(visitor => createVisitorCard(visitor, true)).join('');
}

function renderResidents() {
    const filtered = filterResidents();
    const container = elements.residentsGrid;
    
    if (filtered.length === 0) {
        container.innerHTML = getEmptyState('No residents found', 'Add residents to get started');
        return;
    }
    
    container.innerHTML = filtered.map(resident => createResidentCard(resident)).join('');
}

function renderHistory() {
    const filtered = filterHistory();
    const container = elements.historyList;
    
    if (filtered.length === 0) {
        container.innerHTML = getEmptyState('No history found', 'Visitor entries will appear here');
        return;
    }
    
    container.innerHTML = filtered.map(entry => createHistoryItem(entry)).join('');
}

// Card Creation Functions
function createVisitorCard(visitor, compact = false) {
    const entryTime = visitor.entryTime?.toDate() || new Date();
    const exitTime = visitor.exitTime?.toDate();
    
    return `
        <div class="visitor-card" data-id="${visitor.id}">
            <div class="visitor-card-header">
                <div class="visitor-info">
                    <h4>${escapeHtml(visitor.name)}</h4>
                    <p class="text-muted">${escapeHtml(visitor.phone)}</p>
                </div>
                <span class="visitor-status ${visitor.status}">${visitor.status}</span>
            </div>
            
            ${!compact ? `
            <div class="visitor-details">
                <div class="detail-item">
                    <span class="detail-label">House No.</span>
                    <span class="detail-value">#${visitor.houseNumber}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Purpose</span>
                    <span class="detail-value">${escapeHtml(visitor.purpose)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Entry Time</span>
                    <span class="detail-value">${formatTime(entryTime)}</span>
                </div>
                ${visitor.vehicle ? `
                <div class="detail-item">
                    <span class="detail-label">Vehicle</span>
                    <span class="detail-value">${escapeHtml(visitor.vehicle)}</span>
                </div>
                ` : ''}
                ${exitTime ? `
                <div class="detail-item">
                    <span class="detail-label">Exit Time</span>
                    <span class="detail-value">${formatTime(exitTime)}</span>
                </div>
                ` : ''}
            </div>
            
            ${visitor.notes ? `<p class="text-muted" style="margin-bottom: 1rem; font-size: 0.875rem;">${escapeHtml(visitor.notes)}</p>` : ''}
            ` : ''}
            
            ${visitor.status === 'active' ? `
            <div class="visitor-actions">
                <button class="btn btn-sm btn-danger" onclick="showExitModal('${visitor.id}', '${escapeHtml(visitor.name)}')">
                    Mark Exit
                </button>
            </div>
            ` : ''}
        </div>
    `;
}

function createResidentCard(resident) {
    return `
        <div class="resident-card">
            <div class="resident-card-header">
                <div class="house-number">${resident.houseNumber}</div>
            </div>
            <h3 class="resident-name">${escapeHtml(resident.ownerName)}</h3>
            <div class="resident-meta">
                <div class="meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>${escapeHtml(resident.contactNumber)}</span>
                </div>
                ${resident.familyMembers ? `
                <div class="meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>${resident.familyMembers} members</span>
                </div>
                ` : ''}
                ${resident.vehicleCount ? `
                <div class="meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7l-1.16 1.86A1 1 0 0 0 0 16.85V19h3m4.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"></path>
                    </svg>
                    <span>${resident.vehicleCount} vehicles</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function createHistoryItem(entry) {
    const entryTime = entry.entryTime?.toDate() || new Date();
    const exitTime = entry.exitTime?.toDate();
    
    return `
        <div class="history-item">
            <div class="history-info">
                <h4>${escapeHtml(entry.name)}</h4>
                <p>House #${entry.houseNumber} • ${escapeHtml(entry.purpose)}</p>
            </div>
            <div class="history-time">
                <div>In: ${formatTime(entryTime)}</div>
                ${exitTime ? `<div>Out: ${formatTime(exitTime)}</div>` : '<div>Still inside</div>'}
            </div>
        </div>
    `;
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

// Filter Functions
function filterVisitors() {
    let filtered = [...state.visitors];
    
    // Filter by status
    if (state.filters.visitorStatus !== 'all') {
        filtered = filtered.filter(v => v.status === state.filters.visitorStatus);
    }
    
    // Filter by search
    if (state.filters.searchQuery) {
        const query = state.filters.searchQuery.toLowerCase();
        filtered = filtered.filter(v => 
            v.name.toLowerCase().includes(query) ||
            v.phone.includes(query) ||
            v.houseNumber.toString().includes(query)
        );
    }
    
    return filtered;
}

function filterResidents() {
    const query = elements.residentSearch?.value?.toLowerCase() || '';
    if (!query) return state.residents;
    
    return state.residents.filter(r =>
        r.ownerName.toLowerCase().includes(query) ||
        r.houseNumber.toString().includes(query)
    );
}

function filterHistory() {
    let filtered = [...state.history];
    
    // Filter by date
    if (elements.historyDate?.value) {
        const selectedDate = new Date(elements.historyDate.value);
        selectedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        filtered = filtered.filter(entry => {
            const entryDate = entry.entryTime?.toDate() || new Date();
            return entryDate >= selectedDate && entryDate < nextDay;
        });
    }
    
    // Filter by search
    const query = elements.historySearch?.value?.toLowerCase() || '';
    if (query) {
        filtered = filtered.filter(entry =>
            entry.name.toLowerCase().includes(query) ||
            entry.phone.includes(query) ||
            entry.houseNumber.toString().includes(query)
        );
    }
    
    return filtered;
}

// Dashboard Update
function updateDashboard() {
    const active = state.visitors.filter(v => v.status === 'active').length;
    const today = state.visitors.length;
    const pending = state.visitors.filter(v => v.status === 'active').length;
    
    elements.activeVisitorsCount.textContent = active;
    elements.todayEntriesCount.textContent = today;
    elements.pendingExitsCount.textContent = pending;
    
    renderRecentVisitors();
}

// Event Listeners Setup
function setupEventListeners() {
    // Login
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Navigation
    elements.menuBtn?.addEventListener('click', toggleMenu);
    elements.navClose?.addEventListener('click', toggleMenu);
    document.getElementById('nav-overlay')?.addEventListener('click', toggleMenu);
    
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            switchView(view);
            toggleMenu();
        });
    });
    
    // Theme
    elements.themeToggle?.addEventListener('click', toggleTheme);
    
    // Resident Modal
    document.getElementById('add-resident-btn')?.addEventListener('click', () => openResidentModal());
    
    // Forms
    elements.visitorForm?.addEventListener('submit', handleVisitorSubmit);
    elements.residentForm?.addEventListener('submit', handleResidentSubmit);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });
    
    // Search and filters
    elements.visitorSearch?.addEventListener('input', (e) => {
        state.filters.searchQuery = e.target.value;
        renderVisitors();
    });
    
    elements.residentSearch?.addEventListener('input', () => renderResidents());
    elements.historySearch?.addEventListener('input', () => renderHistory());
    elements.historyDate?.addEventListener('change', () => renderHistory());
    
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            elements.filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.filters.visitorStatus = e.target.dataset.filter;
            renderVisitors();
        });
    });
    
    // Exit confirmation
    document.getElementById('confirm-exit-btn')?.addEventListener('click', handleExitConfirm);
}

// Modal Functions
function openVisitorModal(visitorId = null) {
    if (!elements.visitorModal || !elements.visitorForm) return;
    elements.visitorForm.reset();
    const titleEl = document.getElementById('visitor-modal-title');
    if (titleEl) {
        titleEl.textContent = visitorId ? 'Edit Visitor' : 'New Visitor Entry';
    }
    openModal(elements.visitorModal);
}

function openResidentModal(residentId = null) {
    if (!elements.residentModal || !elements.residentForm) return;
    elements.residentForm.reset();
    const titleEl = document.getElementById('resident-modal-title');
    if (titleEl) {
        titleEl.textContent = residentId ? 'Edit Resident' : 'Add Resident';
    }
    openModal(elements.residentModal);
}

function showExitModal(visitorId, visitorName) {
    document.getElementById('exit-visitor-name').textContent = visitorName;
    document.getElementById('confirm-exit-btn').dataset.visitorId = visitorId;
    openModal(elements.exitModal);
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function closeVisitorModal() {
    if (elements.visitorModal) {
        closeModal(elements.visitorModal);
    }
}

function closeResidentModal() {
    if (elements.residentModal) {
        closeModal(elements.residentModal);
    }
}

function closeExitModal() {
    if (elements.exitModal) {
        closeModal(elements.exitModal);
    }
}

async function handleExitConfirm() {
    const btn = document.getElementById('confirm-exit-btn');
    const visitorId = btn.dataset.visitorId;
    
    setButtonLoading(btn, true);
    try {
        await exitVisitor(visitorId);
    } finally {
        setButtonLoading(btn, false);
    }
}

function confirmExit() {
    handleExitConfirm();
}

function exportHistory() {
    // Generate CSV export of history
    try {
        const csvData = convertHistoryToCSV(state.history);
        downloadCSV(csvData, 'visitor-history.csv');
        showToast('History exported successfully', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export history', 'error');
    }
}

function convertHistoryToCSV(data) {
    const headers = ['Name', 'Phone', 'House Number', 'Purpose', 'Entry Time', 'Exit Time', 'Status'];
    const rows = data.map(item => [
        item.name,
        item.phone,
        item.houseNumber,
        item.purpose,
        new Date(item.entryTime?.toDate()).toLocaleString(),
        item.exitTime ? new Date(item.exitTime.toDate()).toLocaleString() : 'N/A',
        item.status
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Form Handlers
async function handleVisitorSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    const data = {
        name: document.getElementById('visitor-name').value,
        phone: document.getElementById('visitor-phone').value,
        houseNumber: parseInt(document.getElementById('visitor-house').value),
        purpose: document.getElementById('visitor-purpose').value,
        vehicle: document.getElementById('visitor-vehicle').value || null,
        notes: document.getElementById('visitor-notes').value || null
    };
    
    setButtonLoading(submitBtn, true);
    try {
        await addVisitor(data);
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleResidentSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    const data = {
        houseNumber: parseInt(document.getElementById('resident-house').value),
        ownerName: document.getElementById('resident-name').value,
        contactNumber: document.getElementById('resident-phone').value,
        email: document.getElementById('resident-email').value,
        password: document.getElementById('resident-password').value
    };
    
    setButtonLoading(submitBtn, true);
    try {
        await addResident(data);
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// View Management
function switchView(viewName) {
    state.currentView = viewName;
    
    // Update nav items
    elements.navItems.forEach(item => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update views
    elements.views.forEach(view => {
        if (view.id === `${viewName}-view`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
}

function toggleMenu() {
    const navMenu = document.getElementById('nav-menu');
    const overlay = document.getElementById('nav-overlay');
    
    if (navMenu) {
        navMenu.classList.toggle('active');
    }
    if (overlay) {
        overlay.classList.toggle('active');
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
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    if (theme === 'dark') {
        sunIcon?.classList.add('hidden');
        moonIcon?.classList.remove('hidden');
    } else {
        sunIcon?.classList.remove('hidden');
        moonIcon?.classList.add('hidden');
    }
}

// UI State Management
function showLoading() {
    if (elements.loadingScreen) {
        elements.loadingScreen.classList.remove('hidden');
    }
}

function hideLoading() {
    if (elements.loadingScreen) {
        elements.loadingScreen.classList.add('hidden');
    }
}

function showLogin() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.remove('hidden');
    }
    if (elements.app) {
        elements.app.classList.add('hidden');
    }
}

function showApp() {
    if (elements.loginScreen) {
        elements.loginScreen.classList.add('hidden');
    }
    if (elements.app) {
        elements.app.classList.remove('hidden');
    }
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

// Toast Notifications
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    
    setTimeout(() => elements.toast.classList.add('show'), 10);
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Utility Functions
function populateHouseNumbers() {
    const visitorHouseSelect = document.getElementById('visitor-house');
    const residentHouseSelect = document.getElementById('resident-house');
    
    // Populate visitor house dropdown
    if (visitorHouseSelect) {
        visitorHouseSelect.innerHTML = '<option value="">Select house</option>';
        for (let i = 1; i <= 48; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `#${i}`;
            visitorHouseSelect.appendChild(option);
        }
    }
    
    // Populate resident house dropdown
    if (residentHouseSelect) {
        residentHouseSelect.innerHTML = '<option value="">Select house</option>';
        for (let i = 1; i <= 48; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `#${i}`;
            residentHouseSelect.appendChild(option);
        }
    }
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    }).format(date);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password'
    };
    return messages[code] || 'An error occurred. Please try again.';
}

// Make functions globally available
window.showExitModal = showExitModal;
window.openVisitorModal = openVisitorModal;
window.openResidentModal = openResidentModal;
window.closeVisitorModal = closeVisitorModal;
window.closeResidentModal = closeResidentModal;
window.closeExitModal = closeExitModal;
window.confirmExit = confirmExit;
window.exportHistory = exportHistory;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
