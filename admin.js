// --- Zynqra Firebase Master Admin Script (admin.js) ---

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4_RGOzHvkjK24g4h-CtYhuwnUnvcVrg8",
  authDomain: "zynqra-f832d.firebaseapp.com",
  projectId: "zynqra-f832d",
  storageBucket: "zynqra-f832d.firebasestorage.app",
  messagingSenderId: "542368091275",
  appId: "1:542368091275:web:0e2e4bb1c9239ed2c6188e",
  measurementId: "G-R4TFWEMJ3T"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// নির্ধারিত মাস্টার অ্যাডমিন জিমেইল (আপনার সিকিউরড অ্যাকাউন্ট)
const ADMIN_EMAIL = "sadhinahmed718@gmail.com";

// --- Advanced XSS Protection Utility ---
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
    setupAdminAdManager();
    setupAdminInspectModal();
});

// --- Secure Firebase Google Auth Admin Guard ---
function setupAdminAuth() {
    const loginBtn = document.getElementById('adminGoogleLoginBtn') || document.getElementById('adminLoginVerifyBtn');
    const guardModal = document.getElementById('adminAuthGuard');
    const dashboard = document.getElementById('adminDashboard');
    const statusText = document.getElementById('adminGuardStatus');

    // ফায়ারবেস অথেনটিকেশন স্টেট মনিটর
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (user.email === ADMIN_EMAIL) {
                // সঠিক অ্যাডমিন ইমেল হলে প্যানেল আনলক হবে
                if (guardModal) guardModal.classList.add('hidden');
                if (dashboard) dashboard.classList.remove('hidden');
                loadAdminDashboardData();
            } else {
                // অন্য কেউ লগইন করার চেষ্টা করলে সাথে সাথে সাইন আউট করে দিবে
                firebase.auth().signOut();
                if (statusText) {
                    statusText.innerText = 'Access Denied! Unauthorized Google Account.';
                    statusText.className = 'text-[11px] text-red-500 font-bold';
                }
            }
        } else {
            // লগইন করা না থাকলে গার্ড মোড অন থাকবে
            if (guardModal) guardModal.classList.remove('hidden');
            if (dashboard) dashboard.classList.add('hidden');
        }
    });

    // গুগল পপআপ লগইন ট্রিগার
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithPopup(provider).catch((error) => {
                console.error("Admin Login Error:", error.message);
                if (statusText) {
                    statusText.innerText = 'Login Failed: ' + sanitizeHTML(error.message);
                    statusText.className = 'text-[11px] text-red-500 font-bold';
                }
            });
        });
    }
}

// --- Load Admin Dashboard Data from Firestore ---
function loadAdminDashboardData() {
    renderAdminStats();
    renderMonetizationRequests();
    renderModerationQueue();
    renderUsersTable();
    renderActiveAds();
}

function renderAdminStats() {
    db.collection("videos").get().then(snap => {
        const totalVideosEl = document.getElementById('adminTotalVideos');
        const pendingVideosEl = document.getElementById('adminPendingVideos');
        if (totalVideosEl) totalVideosEl.innerText = snap.size;
        if (pendingVideosEl) pendingVideosEl.innerText = snap.docs.filter(d => d.data().flagged).length;
    }).catch(err => console.error("Error fetching stats:", err));

    db.collection("users").get().then(snap => {
        const totalUsersEl = document.getElementById('adminTotalUsers');
        if (totalUsersEl) totalUsersEl.innerText = snap.size;
    }).catch(err => console.error("Error fetching users:", err));
}

// --- Global Ads & Sponsor Campaign Manager ---
function setupAdminAdManager() {
    const adForm = document.getElementById('adminAdForm');
    if (!adForm) return;

    adForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = sanitizeHTML(document.getElementById('adTitle').value.trim());
        const videoUrl = sanitizeHTML(document.getElementById('adVideoUrl').value.trim());
        const targetUrl = sanitizeHTML(document.getElementById('adTargetUrl').value.trim());

        if (!title || !videoUrl || !targetUrl) {
            alert('Please fill in all ad details.');
            return;
        }

        db.collection("global_ads").add({
            title,
            videoUrl,
            targetUrl,
            active: true,
            date: new Date().toISOString().split('T')[0]
        }).then(() => {
            alert('Global Ad campaign successfully deployed!');
            adForm.reset();
            renderActiveAds();
        }).catch(err => {
            alert('Error deploying ad: ' + sanitizeHTML(err.message));
        });
    });
}

function renderActiveAds() {
    db.collection("global_ads").onSnapshot(snapshot => {
        const container = document.getElementById('adminActiveAdsList');
        const countBadge = document.getElementById('adminActiveAdsCount');
        if (!container) return;

        container.innerHTML = '';
        if (countBadge) countBadge.innerText = snapshot.size;

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[11px] text-gray-500 col-span-full text-center">No active ad campaigns running.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const ad = docSnap.data();
            const docId = docSnap.id;
            const card = document.createElement('div');
            card.className = 'bg-[#181818] border border-[#333] p-3 rounded-2xl flex flex-col justify-between space-y-2 text-xs shadow';
            card.innerHTML = `
                <div>
                    <div class="font-bold text-white truncate">${sanitizeHTML(ad.title)}</div>
                    <a href="${sanitizeHTML(ad.targetUrl)}" target="_blank" class="text-[10px] text-brand-cyan truncate block hover:underline">${sanitizeHTML(ad.targetUrl)}</a>
                </div>
                <button onclick="deleteGlobalAd('${sanitizeHTML(docId)}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 py-1.5 rounded-xl font-semibold cursor-pointer text-[10px] transition">Remove Ad</button>
            `;
            container.appendChild(card);
        });
    });
}

window.deleteGlobalAd = function(docId) {
    if (confirm('Stop and remove this ad campaign?')) {
        db.collection("global_ads").doc(docId).delete().then(() => {
            alert('Ad campaign removed.');
        }).catch(err => alert('Error: ' + sanitizeHTML(err.message)));
    }
};

// --- Live User Inspection Modal ---
function setupAdminInspectModal() {
    const modal = document.getElementById('adminUserInspectModal');
    const closeBtn = document.getElementById('closeInspectModal');
    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }
}

window.inspectUser = function(email, name, avatar, subs, strikes, status) {
    const modal = document.getElementById('adminUserInspectModal');
    const detailsBox = document.getElementById('inspectUserDetails');
    const videosBox = document.getElementById('inspectUserVideos');
    if (!modal || !detailsBox || !videosBox) return;

    detailsBox.innerHTML = `
        <div class="flex items-center space-x-3 bg-[#181818] p-3.5 rounded-2xl border border-[#333]">
            <img src="${sanitizeHTML(avatar) || 'https://picsum.photos/seed/user/100/100'}" class="w-12 h-12 rounded-full object-cover border border-brand-cyan">
            <div>
                <h4 class="font-bold text-white text-sm">${sanitizeHTML(name)}</h4>
                <p class="text-gray-400 text-[10px]">${sanitizeHTML(email)}</p>
                <div class="text-[10px] text-gray-300 mt-1">Subscribers: <strong>${subs || 0}</strong> | Strikes: <strong class="text-amber-400">${strikes || 0}</strong> | Status: <strong class="${status === 'Banned' ? 'text-red-500' : 'text-emerald-400'}">${sanitizeHTML(status) || 'Active'}</strong></div>
            </div>
        </div>
    `;

    videosBox.innerHTML = `<p class="text-gray-500 text-[11px] text-center py-4">Loading user content...</p>`;
    modal.classList.remove('hidden');

    db.collection("videos").where("creatorEmail", "==", email).get().then(snapshot => {
        videosBox.innerHTML = '';
        if (snapshot.empty) {
            videosBox.innerHTML = `<p class="text-gray-500 text-[11px] text-center py-4">This user has not uploaded any videos yet.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const v = docSnap.data();
            const vId = docSnap.id;
            const div = document.createElement('div');
            div.className = 'bg-[#181818] border border-[#333] p-3 rounded-xl flex items-center justify-between text-xs';
            div.innerHTML = `
                <div class="flex items-center space-x-3 truncate">
                    <img src="${sanitizeHTML(v.thumbnailUrl || v.creatorAvatar)}" class="w-12 h-8 rounded object-cover">
                    <div class="truncate">
                        <div class="font-bold text-white truncate">${sanitizeHTML(v.title)}</div>
                        <div class="text-[9px] text-gray-400">${v.views || 0} views • ${v.likes || 0} likes</div>
                    </div>
                </div>
                <button onclick="removeVideo('${sanitizeHTML(vId)}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer">Delete Video</button>
            `;
            videosBox.appendChild(div);
        });
    }).catch(err => {
        videosBox.innerHTML = `<p class="text-red-500 text-[11px]">Error loading videos.</p>`;
    });
};

// --- Monthly Views & Payout Calculation Management ---
function renderMonetizationRequests() {
    db.collection("monetization_requests").onSnapshot(snapshot => {
        const container = document.getElementById('adminMonetizationRequestsList');
        if (!container) return;
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[11px] text-gray-500 text-center py-4">No active monetization requests found.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const req = docSnap.data();
            const docId = docSnap.id;
            
            db.collection("videos").where("creatorEmail", "==", req.email).get().then(videoSnap => {
                let currentMonthViews = 0;
                videoSnap.forEach(vDoc => {
                    currentMonthViews += (vDoc.data().monthlyViews || vDoc.data().views || 0);
                });

                const cpmInputEl = document.getElementById('globalCpmInput');
                const cpmRate = cpmInputEl ? (parseFloat(cpmInputEl.value) || 10) : 10;
                const calculatedEarnings = ((currentMonthViews / 1000) * cpmRate).toFixed(2);

                const div = document.createElement('div');
                div.className = 'bg-[#181818] border border-[#333] p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow';
                div.innerHTML = `
                    <div class="space-y-1">
                        <div class="font-bold text-white text-sm">${sanitizeHTML(req.channelName)} <span class="text-[10px] text-yellow-400 font-normal">(${sanitizeHTML(req.payoutMethod).toUpperCase()})</span></div>
                        <div class="text-[10px] text-gray-400">Email: ${sanitizeHTML(req.email)} | Payout Info: <span class="text-brand-cyan">${sanitizeHTML(req.payoutInfo)}</span></div>
                        <div class="text-[10px] text-gray-300 flex items-center space-x-3">
                            <span>Current Views: <strong class="text-amber-400">${currentMonthViews.toLocaleString()}</strong></span>
                            <span>Payable: <strong class="text-emerald-400">৳${sanitizeHTML(calculatedEarnings)}</strong></span>
                        </div>
                        <div class="text-[9px] text-gray-500">Lifetime Paid History: ৳${req.lifetimePaid || 0}</div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <button onclick="payMonthlyEarnings('${sanitizeHTML(docId)}', '${sanitizeHTML(req.email)}', ${calculatedEarnings}, ${currentMonthViews}, ${req.lifetimePaid || 0})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold cursor-pointer shadow transition">Mark Paid & Roll Over</button>
                        <button onclick="deleteMonetization('${sanitizeHTML(docId)}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 px-3 py-2 rounded-xl cursor-pointer"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                container.appendChild(div);
            });
        });
    });
}

window.payMonthlyEarnings = function(docId, email, paidAmount, currentMonthViews, existingLifetimePaid) {
    if (!confirm(`Are you sure you want to disburse ৳${paidAmount} for ${currentMonthViews.toLocaleString()} views to ${email}? This will roll over the views for the next month.`)) return;

    const newLifetimePaid = parseFloat(existingLifetimePaid) + parseFloat(paidAmount);

    db.collection("monetization_requests").doc(docId).update({
        lifetimePaid: newLifetimePaid,
        lastPaidDate: new Date().toISOString().split('T')[0],
        status: 'Paid & Active'
    }).then(() => {
        db.collection("videos").where("creatorEmail", "==", email).get().then(snapshot => {
            snapshot.forEach(vDoc => {
                const vData = vDoc.data();
                const oldRollover = vData.archivedViews || 0;
                const thisViews = vData.monthlyViews || vData.views || 0;

                db.collection("videos").doc(vDoc.id).update({
                    archivedViews: oldRollover + thisViews,
                    monthlyViews: 0
                });
            });
            alert(`Successfully paid ৳${paidAmount}! Views rolled over for the next month.`);
        });
    }).catch(err => alert('Error processing payment: ' + sanitizeHTML(err.message)));
};

window.deleteMonetization = function(docId) {
    if (confirm('Delete this monetization request?')) {
        db.collection("monetization_requests").doc(docId).delete().then(() => {
            alert('Request deleted.');
        }).catch(err => alert('Error: ' + sanitizeHTML(err.message)));
    }
};

// --- AI Video Moderation Queue ---
function renderModerationQueue() {
    db.collection("videos").limit(10).onSnapshot(snapshot => {
        const container = document.getElementById('adminModerationQueueList');
        if (!container) return;
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[11px] text-gray-500 text-center py-4">All uploaded videos are verified and secure.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const video = docSnap.data();
            const docId = docSnap.id;
            const div = document.createElement('div');
            div.className = 'bg-[#181818] border border-[#333] p-3.5 rounded-2xl flex items-center justify-between text-xs shadow';
            div.innerHTML = `
                <div class="flex items-center space-x-3 truncate">
                    <img src="${sanitizeHTML(video.thumbnailUrl || video.creatorAvatar)}" class="w-12 h-8 rounded object-cover">
                    <div class="truncate">
                        <div class="font-bold text-white truncate">${sanitizeHTML(video.title)}</div>
                        <div class="text-[9px] text-gray-400">Creator: ${sanitizeHTML(video.creatorName)} | Views: ${video.views || 0}</div>
                    </div>
                </div>
                <button onclick="removeVideo('${sanitizeHTML(docId)}')" class="bg-red-950/60 hover:bg-red-900 text-red-400 px-3.5 py-1.5 rounded-xl font-semibold cursor-pointer shrink-0 transition">Remove Video</button>
            `;
            container.appendChild(div);
        });
    });
}

window.removeVideo = function(docId) {
    if (confirm('Are you sure you want to remove this video?')) {
        db.collection("videos").doc(docId).delete().then(() => {
            alert('Video removed by Master Admin.');
            renderAdminStats();
        }).catch(err => alert('Error: ' + sanitizeHTML(err.message)));
    }
};

// --- User Management, Strikes & Ban Control ---
function renderUsersTable() {
    db.collection("users").onSnapshot(snapshot => {
        const tbody = document.getElementById('adminUsersTableBody');
        if (!tbody) return;
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
                <td class="p-3.5 flex items-center space-x-2.5">
                    <img src="${sanitizeHTML(user.avatar) || 'https://picsum.photos/seed/user/100/100'}" class="w-8 h-8 rounded-full object-cover border border-dark-600">
                    <span class="font-bold text-white">${sanitizeHTML(user.name) || 'User'}</span>
                    ${user.verified ? '<i class="fa-solid fa-circle-check text-emerald-400" title="Verified"></i>' : ''}
                </td>
                <td class="p-3.5 text-gray-400">${sanitizeHTML(user.email)}</td>
                <td class="p-3.5">
                    <span class="text-amber-400 font-semibold">${user.strikes || 0} Strikes</span> / 
                    <span class="${user.status === 'Banned' ? 'text-red-500 font-bold' : 'text-emerald-400'}">${sanitizeHTML(user.status) || 'Active'}</span>
                </td>
                <td class="p-3.5 space-x-1.5">
                    <button onclick="inspectUser('${sanitizeHTML(user.email)}', '${sanitizeHTML(user.name)}', '${sanitizeHTML(user.avatar)}', ${user.subs || 0}, ${user.strikes || 0}, '${sanitizeHTML(user.status || 'Active')}')" class="bg-cyan-600/20 border border-cyan-600/40 text-cyan-400 px-3 py-1.5 rounded-xl font-semibold cursor-pointer hover:bg-cyan-600/30 transition"><i class="fa-solid fa-eye mr-1"></i> Inspect</button>
                    <button onclick="addUserStrike('${sanitizeHTML(docId)}', ${user.strikes || 0}, '${sanitizeHTML(user.name) || 'User'}')" class="bg-amber-600/20 border border-amber-600/40 text-amber-400 px-3 py-1.5 rounded-xl font-semibold cursor-pointer hover:bg-amber-600/30 transition">+ Strike</button>
                    <button onclick="toggleBanUser('${sanitizeHTML(docId)}', '${sanitizeHTML(user.status || 'Active')}')" class="bg-red-600/20 border border-red-600/40 text-red-400 px-3 py-1.5 rounded-xl font-semibold cursor-pointer hover:bg-red-600/30 transition">${user.status === 'Banned' ? 'Unban' : 'Ban'}</button>
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
    }).catch(err => alert('Error: ' + sanitizeHTML(err.message)));
};

window.toggleBanUser = function(docId, currentStatus) {
    const targetStatus = currentStatus === 'Banned' ? 'Active' : 'Banned';
    db.collection("users").doc(docId).update({
        status: targetStatus,
        strikes: targetStatus === 'Active' ? 0 : 5
    }).catch(err => alert('Error: ' + sanitizeHTML(err.message)));
};
