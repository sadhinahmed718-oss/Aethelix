// --- Zynqra Firebase Admin Script (admin.js) ---

const firebaseConfig = {
    apiKey: "AIzaSyC4_R00zhvkJK24g4h-CtYwUq6B65Pq1bI",
    authDomain: "zynqra-f832d.firebaseapp.com",
    projectId: "zynqra-f832d",
    storageBucket: "zynqra-f832d.appspot.com",
    messagingSenderId: "542368091275",
    appId: "1:542368091275:web:0e2e4bb1c9239ed2c6188e",
    measurementId: "G-R4TFWEMJ3T"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const MASTER_KEY = 'zynqra_admin_2026';

// --- XSS Protection Utility ---
function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
    setupAdminAuth();
});

// --- Admin Authentication Guard ---
function setupAdminAuth() {
    const loginBtn = document.getElementById('adminLoginVerifyBtn');
    const secretInput = document.getElementById('adminSecretKeyInput');
    const guardModal = document.getElementById('adminAuthGuard');
    const dashboard = document.getElementById('adminDashboard');
    const statusText = document.getElementById('adminGuardStatus');

    if (sessionStorage.getItem('zynqra_admin_auth') === 'true') {
        guardModal.classList.add('hidden');
        dashboard.classList.remove('hidden');
        loadAdminDashboardData();
        return;
    }

    loginBtn.addEventListener('click', () => {
        const enteredKey = secretInput.value.trim();
        if (enteredKey === MASTER_KEY) {
            sessionStorage.setItem('zynqra_admin_auth', 'true');
            guardModal.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadAdminDashboardData();
        } else {
            statusText.innerText = 'Invalid Master Key! Access Denied.';
            statusText.className = 'text-[11px] text-red-500 font-bold';
        }
    });

    secretInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });
}

// --- Load Admin Dashboard Data from Firestore ---
function loadAdminDashboardData() {
    renderAdminStats();
    renderMonetizationRequests();
    renderModerationQueue();
    renderUsersTable();
}

function renderAdminStats() {
    db.collection("videos").get().then(snap => {
        document.getElementById('adminTotalVideos').innerText = snap.size;
        document.getElementById('adminPendingVideos').innerText = snap.docs.filter(d => d.data().flagged).length;
    });

    db.collection("users").get().then(snap => {
        document.getElementById('adminTotalUsers').innerText = snap.size;
    });
}

// --- Monthly Views & Payout Calculation Management ---
function renderMonetizationRequests() {
    db.collection("monetization_requests").onSnapshot(snapshot => {
        const container = document.getElementById('adminMonetizationRequestsList');
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[11px] text-gray-500">No active monetization requests found.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const req = docSnap.data();
            const docId = docSnap.id;
            
            // বর্তমান মাসের ভিউজ হিসাব (যদি ফিল্ড না থাকে তবে ০ ধরবে)
            db.collection("videos").where("creatorEmail", "==", req.email).get().then(videoSnap => {
                let currentMonthViews = 0;
                videoSnap.forEach(vDoc => {
                    currentMonthViews += (vDoc.data().monthlyViews || vDoc.data().views || 0);
                });

                const cpmRate = parseFloat(document.getElementById('globalCpmInput').value) || 10;
                const calculatedEarnings = ((currentMonthViews / 1000) * cpmRate).toFixed(2);

                const div = document.createElement('div');
                div.className = 'bg-[#181818] border border-[#333] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs';
                div.innerHTML = `
                    <div class="space-y-1">
                        <div class="font-bold text-white text-sm">${sanitizeHTML(req.channelName)} <span class="text-[10px] text-yellow-400 font-normal">(${sanitizeHTML(req.payoutMethod).toUpperCase()})</span></div>
                        <div class="text-[10px] text-gray-400">Email: ${sanitizeHTML(req.email)} | Payout Info: <span class="text-brand-cyan">${sanitizeHTML(req.payoutInfo)}</span></div>
                        <div class="text-[10px] text-gray-300 flex items-center space-x-3">
                            <span>Current Month Views: <strong class="text-amber-400">${currentMonthViews.toLocaleString()}</strong></span>
                            <span>Payable Earnings: <strong class="text-emerald-400">৳${calculatedEarnings}</strong></span>
                        </div>
                        <div class="text-[9px] text-gray-500">Total Lifetime Paid History: ৳${req.lifetimePaid || 0}</div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <button onclick="payMonthlyEarnings('${docId}', '${sanitizeHTML(req.email)}', ${calculatedEarnings}, ${currentMonthViews}, ${req.lifetimePaid || 0})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl font-bold cursor-pointer shadow transition">Mark Paid & Roll Over</button>
                        <button onclick="deleteMonetization('${docId}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 px-3 py-2 rounded-xl cursor-pointer"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(div);
            });
        });
    });
}

// পেমেন্ট সম্পন্ন করার পর বর্তমান মাসের ভিউজ পুরনো হিস্টরিতে যোগ হবে এবং নতুন মাসের জন্য ভিউজ ০ হয়ে যাবে
window.payMonthlyEarnings = function(docId, email, paidAmount, currentMonthViews, existingLifetimePaid) {
    if (!confirm(`Are you sure you want to disburse ৳${paidAmount} for ${currentMonthViews.toLocaleString()} views to ${email}? This will roll over the views for the next month.`)) return;

    const newLifetimePaid = parseFloat(existingLifetimePaid) + parseFloat(paidAmount);

    // ১. রিকোয়েস্ট ডকুমেন্টে লাইফটাইম পেড আপডেট
    db.collection("monetization_requests").doc(docId).update({
        lifetimePaid: newLifetimePaid,
        lastPaidDate: new Date().toISOString().split('T')[0],
        status: 'Paid & Active'
    });

    // ২. ইউজারের ভিডিওগুলোর বর্তমান মাসের ভিউজ রিসেট করে পুরনো ভিউজে যুক্ত করা
    db.collection("videos").where("creatorEmail", "==", email).get().then(snapshot => {
        snapshot.forEach(vDoc => {
            const vData = vDoc.data();
            const oldRollover = vData.archivedViews || 0;
            const thisViews = vData.monthlyViews || vData.views || 0;

            db.collection("videos").doc(vDoc.id).update({
                archivedViews: oldRollover + thisViews, // পুরাতন ভিউজ জমিয়ে রাখা হলো
                monthlyViews: 0 // নতুন মাসের জন্য আবার ০ থেকে শুরু
            });
        });
        alert(`Successfully paid ৳${paidAmount}! Views rolled over for the next month.`);
    });
};

window.deleteMonetization = function(docId) {
    if (confirm('Delete this monetization request?')) {
        db.collection("monetization_requests").doc(docId).delete().then(() => {
            alert('Request deleted.');
        });
    }
};

// --- AI Video Moderation Queue ---
function renderModerationQueue() {
    db.collection("videos").limit(5).onSnapshot(snapshot => {
        const container = document.getElementById('adminModerationQueueList');
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[11px] text-gray-500">All uploaded videos are verified.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const video = docSnap.data();
            const docId = docSnap.id;
            const div = document.createElement('div');
            div.className = 'bg-[#181818] border border-[#333] p-3 rounded-xl flex items-center justify-between text-xs';
            div.innerHTML = `
                <div class="flex items-center space-x-3 truncate">
                    <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-12 h-8 rounded object-cover">
                    <div class="truncate">
                        <div class="font-bold text-white truncate">${sanitizeHTML(video.title)}</div>
                        <div class="text-[9px] text-gray-400">Creator: ${sanitizeHTML(video.creatorName)} | Views: ${video.views || 0}</div>
                    </div>
                </div>
                <button onclick="removeVideo('${docId}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded-lg font-semibold cursor-pointer shrink-0">Remove Video</button>
            `;
            container.appendChild(div);
        });
    });
}

window.removeVideo = function(docId) {
    db.collection("videos").doc(docId).delete().then(() => {
        alert('Video removed by Master Admin.');
        renderAdminStats();
    });
};

// --- User Management, Strikes & Ban Control ---
function renderUsersTable() {
    db.collection("users").onSnapshot(snapshot => {
        const tbody = document.getElementById('adminUsersTableBody');
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No users found.</td></tr>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            const docId = docSnap.id;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#181818] transition';
            tr.innerHTML = `
                <td class="p-3 flex items-center space-x-2">
                    <img src="${sanitizeHTML(user.avatar) || 'https://picsum.photos/seed/user/100/100'}" class="w-7 h-7 rounded-full object-cover">
                    <span class="font-bold text-white">${sanitizeHTML(user.name) || 'User'}</span>
                    ${user.verified ? '<i class="fa-solid fa-circle-check text-emerald-400" title="Verified"></i>' : ''}
                </td>
                <td class="p-3 text-gray-400">${sanitizeHTML(user.email)}</td>
                <td class="p-3">
                    <span class="text-amber-400 font-semibold">${user.strikes || 0} Strikes</span> / 
                    <span class="${user.status === 'Banned' ? 'text-red-500 font-bold' : 'text-emerald-400'}">${sanitizeHTML(user.status) || 'Active'}</span>
                </td>
                <td class="p-3 space-x-1.5">
                    <button onclick="addUserStrike('${docId}', ${user.strikes || 0}, '${sanitizeHTML(user.name) || 'User'}')" class="bg-amber-600/20 border border-amber-600/40 text-amber-400 px-2.5 py-1 rounded-md font-semibold cursor-pointer hover:bg-amber-600/30">+ Strike</button>
                    <button onclick="toggleBanUser('${docId}', '${sanitizeHTML(user.status) || 'Active'}')" class="bg-red-600/20 border border-red-600/40 text-red-400 px-2.5 py-1 rounded-md font-semibold cursor-pointer hover:bg-red-600/30">${user.status === 'Banned' ? 'Unban' : 'Ban'}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

window.addUserStrike = function(docId, currentStrikes, userName) {
    const newStrikes = currentStrikes + 1;
    let newStatus = 'Active';
    if (newStrikes >= 5) {
        newStatus = 'Banned';
        alert(`User ${userName} has reached 5 strikes and is permanently banned!`);
    } else {
        alert(`Strike added to ${userName}. Total strikes: ${newStrikes}/5`);
    }
    db.collection("users").doc(docId).update({
        strikes: newStrikes,
        status: newStatus
    });
};

window.toggleBanUser = function(docId, currentStatus) {
    const targetStatus = currentStatus === 'Banned' ? 'Active' : 'Banned';
    db.collection("users").doc(docId).update({
        status: targetStatus,
        strikes: targetStatus === 'Active' ? 0 : 5
    });
};
