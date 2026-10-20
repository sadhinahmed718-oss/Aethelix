// --- Zynqra Firebase Main Script (app.js) ---

const firebaseConfig = {
    apiKey: "AIzaSyC4_RGOzHvkjK24g4h-CtYhuwnUnvcVrg8",
    authDomain: "zynqra-f832d.firebaseapp.com",
    projectId: "zynqra-f832d",
    storageBucket: "zynqra-f832d.firebasestorage.app",
    messagingSenderId: "542368091275",
    appId: "1:542368091275:web:0e2e4bb1c9239ed2c6188e",
    measurementId: "G-R4TFWEMJ3T"
};

// Initialize Firebase securely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let activeVideo = null;
let activeChatContact = null;
let globalAllVideos = [];
let globalAllUsers = [];
let unsubscribeChat = null;
let editingVideoId = null;

// --- Advanced XSS & Injection Protection Utility ---
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
    setupFirebaseAuthState();
    setupGoogleAuth();
    setupNavigation();
    loadHomeFeed();
    loadShortsFeed();
    loadFriendsList();
    loadMessengerContacts();
    setupSearchEngine();
    setupFriendSearchEngine();
    setupOfflineDownloadsUI();
    setupProfileEditModal();
    setupVideoEditModal();
    setupEventListeners();
    loadNotifications();
    setupQuickUploadButton();
});

// --- Quick Upload Header Button Trigger (+) ---
function setupQuickUploadButton() {
    const quickUploadBtn = document.getElementById('quickUploadHeaderBtn');
    if (quickUploadBtn) {
        quickUploadBtn.onclick = () => switchPage('upload');
    }
}

// --- Firebase Persistent Auth State & Account Status Check ---
function setupFirebaseAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userRef = db.collection("users").doc(user.email);
            const doc = await userRef.get();

            if (doc.exists) {
                currentUser = doc.data();
                if (currentUser.isBanned) {
                    alert('Your Zynqra account has been banned/restricted by the Admin due to content policy violations.');
                    auth.signOut();
                    return;
                }
            } else {
                currentUser = {
                    name: sanitizeHTML(user.displayName || 'Zynqra Creator'),
                    email: sanitizeHTML(user.email),
                    avatar: sanitizeHTML(user.photoURL || 'https://picsum.photos/seed/user/100/100'),
                    subs: 0,
                    strikes: 0,
                    verified: false,
                    isBanned: false,
                    lastProfileUpdate: 0,
                    bio: 'Welcome to my Zynqra channel!'
                };
                await userRef.set(currentUser);
            }
            initializeAppUI();
        } else {
            currentUser = null;
            initializeAppUI();
        }
    });
}

// --- Google Authentication & Logout ---
function setupGoogleAuth() {
    const loginBtn = document.getElementById('googleLoginBtn');
    if (loginBtn) {
        loginBtn.onclick = () => triggerGoogleLogin();
    }

    const logoutBtn = document.getElementById('logoutSidebarBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            auth.signOut().then(() => {
                alert('Logged out successfully!');
                window.location.reload();
            });
        };
    }
}

// --- UI INITIALIZATION & NAVIGATION ---
function initializeAppUI() {
    const authContainer = document.getElementById('authContainer');
    if (authContainer) {
        if (currentUser) {
            authContainer.innerHTML = `
                <div id="userProfileHeader" class="flex items-center space-x-2 cursor-pointer relative" onclick="switchPage('profile')">
                    <img src="${sanitizeHTML(currentUser.avatar)}" alt="Profile" class="w-8 h-8 rounded-full object-cover border border-brand-cyan shadow-sm" title="${sanitizeHTML(currentUser.name)}">
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button id="googleLoginBtn" onclick="triggerGoogleLogin()" class="flex items-center space-x-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan px-3.5 py-1.5 rounded-full font-semibold hover:bg-brand-cyan/20 transition cursor-pointer">
                    <i class="fa-brands fa-google"></i> <span class="hidden sm:inline">Google Login</span>
                </button>
            `;
        }
    }
}

function triggerGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(() => {
        alert('Successfully Logged in to Zynqra!');
    }).catch((error) => {
        alert('Login Failed: ' + sanitizeHTML(error.message));
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            if (page) switchPage(page);
        });
    });

    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('-translate-x-full');
        });
    }

    const logoHome = document.getElementById('logoHome');
    if (logoHome) {
        logoHome.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('home');
        });
    }

    const headerShortsBtn = document.getElementById('headerShortsBtn');
    if (headerShortsBtn) {
        headerShortsBtn.onclick = () => switchPage('shorts');
    }

    const viewAllShortsBtn = document.getElementById('viewAllShortsBtn');
    if (viewAllShortsBtn) {
        viewAllShortsBtn.onclick = () => switchPage('shorts');
    }

    const headerMessengerBtn = document.getElementById('headerMessengerBtn');
    if (headerMessengerBtn) {
        headerMessengerBtn.onclick = () => switchPage('messenger');
    }
}

function switchPage(pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
    
    // যখন শর্টস পেজ থেকে অন্য পেজে যাওয়া হবে, তখন শর্টস ভিডিওর প্লেব্যাক সম্পূর্ণ বন্ধ করা নিশ্চিত করতে হবে
    if (pageId !== 'shorts') {
        document.querySelectorAll('.shorts-slide video').forEach(v => {
            v.pause();
            v.currentTime = 0;
        });
    }
    
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('-translate-x-full');
    }

    if (pageId === 'analytics') loadAnalytics();
    if (pageId === 'profile') loadUserProfile();
    if (pageId === 'friends') loadFriendsList();
    if (pageId === 'messenger') loadMessengerContacts();
    if (pageId === 'shorts') loadShortsFeed();
    if (pageId === 'downloads') loadOfflineDownloadsUI();
}

// --- DYNAMIC HOME FEED & ALGORITHM RENDERING ---
function loadHomeFeed(category = 'all') {
    db.collection("videos").orderBy("date", "desc").onSnapshot((snapshot) => {
        const grid = document.getElementById('videoGrid');
        if (!grid) return;
        grid.innerHTML = '';
        let videos = [];
        snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
        
        videos.sort((a, b) => (b.views || 0) - (a.views || 0) || new Date(b.date) - new Date(a.date));
        globalAllVideos = videos;

        const filtered = videos.filter(v => {
            if (category === 'all') return v.aspectRatio !== '9:16';
            if (category === 'shorts') return v.aspectRatio === '9:16';
            return v.category === category && v.aspectRatio !== '9:16';
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="text-gray-500 text-xs col-span-full text-center py-10">No videos found.</p>`;
            return;
        }

        filtered.forEach(video => {
            const card = document.createElement('div');
            card.className = 'bg-dark-800 border border-dark-700 rounded-3xl overflow-hidden shadow-lg hover:border-brand-cyan transition cursor-pointer flex flex-col group';
            
            const thumbContent = video.thumbnailUrl 
                ? `<img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">`
                : `<video src="${sanitizeHTML(video.videoUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300 preload="metadata"></video>`;

            card.innerHTML = `
                <div class="relative aspect-video bg-black overflow-hidden">
                    ${thumbContent}
                    <span class="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-md font-bold">${sanitizeHTML(video.aspectRatio || '16:9')}</span>
                </div>
                <div class="p-3.5 flex space-x-3 flex-1">
                    <img src="${sanitizeHTML(video.creatorAvatar)}" class="w-8 h-8 rounded-full object-cover border border-dark-600">
                    <div class="flex-1 space-y-1">
                        <h3 class="font-bold text-white text-xs line-clamp-2">${sanitizeHTML(video.title)}</h3>
                        <div class="flex items-center space-x-1 text-[10px] text-gray-400">
                            <span>${sanitizeHTML(video.creatorName)}</span>
                        </div>
                        <p class="text-[9px] text-gray-500">${formatNumber(video.views || 0)} views • ${sanitizeHTML(video.date)}</p>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openVideoModal(video));
            grid.appendChild(card);
        });

        loadHomeShortsCarousel(videos);
    });
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

// --- SEARCH ENGINE ---
function setupSearchEngine() {
    const searchIconToggleBtn = document.getElementById('searchIconToggleBtn');
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    const closeMobileSearch = document.getElementById('closeMobileSearch');

    if (searchIconToggleBtn && mobileSearchOverlay) {
        searchIconToggleBtn.onclick = () => {
            mobileSearchOverlay.classList.toggle('hidden');
            if (!mobileSearchOverlay.classList.contains('hidden')) {
                document.getElementById('mobileSearchInput').focus();
            }
        };
    }
    if (closeMobileSearch && mobileSearchOverlay) {
        closeMobileSearch.onclick = () => {
            mobileSearchOverlay.classList.add('hidden');
        };
    }

    const searchInputs = [document.getElementById('searchInput'), document.getElementById('mobileSearchInput')];
    const suggestionsBoxes = [document.getElementById('searchSuggestions'), document.getElementById('mobileSearchSuggestions')];

    searchInputs.forEach((input, index) => {
        if (!input) return;
        const suggestionBox = suggestionsBoxes[index];

        input.addEventListener('input', (e) => {
            const query = sanitizeHTML(e.target.value.toLowerCase().trim());
            if (!query) {
                if (suggestionBox) suggestionBox.classList.add('hidden');
                return;
            }

            const matchedVideos = globalAllVideos.filter(v => 
                (v.title && v.title.toLowerCase().includes(query)) || 
                (v.creatorName && v.creatorName.toLowerCase().includes(query)) ||
                (v.category && v.category.toLowerCase().includes(query))
            );

            if (suggestionBox) {
                suggestionBox.innerHTML = '';
                if (matchedVideos.length === 0) {
                    suggestionBox.innerHTML = `<div class="p-3 text-gray-400 text-xs">No matching videos or channels found</div>`;
                } else {
                    matchedVideos.slice(0, 5).forEach(video => {
                        const item = document.createElement('div');
                        item.className = 'p-2.5 flex items-center space-x-3 hover:bg-dark-700 cursor-pointer border-b border-dark-700/50';
                        item.innerHTML = `
                            <img src="${sanitizeHTML(video.thumbnailUrl || video.creatorAvatar)}" class="w-12 h-8 object-cover rounded-lg">
                            <div class="truncate">
                                <div class="font-bold text-white text-xs truncate">${sanitizeHTML(video.title)}</div>
                                <div class="text-[9px] text-gray-400">By ${sanitizeHTML(video.creatorName)}</div>
                            </div>
                        `;
                        item.onclick = () => {
                            suggestionBox.classList.add('hidden');
                            if (mobileSearchOverlay) mobileSearchOverlay.classList.add('hidden');
                            openVideoModal(video);
                        };
                        suggestionBox.appendChild(item);
                    });
                }
                suggestionBox.classList.remove('hidden');
            }
        });
    });
}

// --- CREATOR & PROFILE VIEWS DIRECTORY SEARCH ENGINE ---
function setupFriendSearchEngine() {
    const friendSearchInput = document.getElementById('friendSearchInput');
    if (!friendSearchInput) return;

    friendSearchInput.addEventListener('input', (e) => {
        const query = sanitizeHTML(e.target.value.toLowerCase().trim());
        const container = document.getElementById('friendsListContainer');
        if (!container) return;

        const filteredUsers = globalAllUsers.filter(user => 
            (currentUser && user.email === currentUser.email) ? false : (user.name && user.name.toLowerCase().includes(query)) || 
            (user.email && user.email.toLowerCase().includes(query))
        );

        container.innerHTML = '';
        if (filteredUsers.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-xs col-span-full text-center py-5">No creators found.</p>`;
            return;
        }

        filteredUsers.forEach(user => {
            const isSubbed = currentUser && localStorage.getItem(`subscribed_${currentUser.email}_${user.email}`);
            const card = document.createElement('div');
            card.className = 'bg-dark-800 border border-dark-700 p-3.5 rounded-2xl flex items-center justify-between shadow';
            card.innerHTML = `
                <div class="flex items-center space-x-3 cursor-pointer group" onclick="openExternalProfile('${sanitizeHTML(user.email)}')">
                    <img src="${sanitizeHTML(user.avatar)}" class="w-10 h-10 rounded-full object-cover border border-brand-cyan group-hover:scale-105 transition">
                    <div>
                        <h4 class="font-bold text-white text-xs group-hover:text-brand-cyan transition">${sanitizeHTML(user.name)}</h4>
                        <p class="text-[10px] text-gray-400">${formatNumber(user.subs || 0)} subscribers • ${formatNumber(user.totalViews || 0)} Views</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleSubscribeUser('${sanitizeHTML(user.email)}', this)" class="${isSubbed ? 'bg-dark-700 text-gray-300' : 'bg-white text-dark-900'} px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow">
                        ${isSubbed ? 'Subscribed ✓' : 'Subscribe'}
                    </button>
                    <button onclick="openChatWithUser('${sanitizeHTML(user.email)}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow">
                        <i class="fa-solid fa-message"></i> <span>Message</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

window.toggleSubscribeUser = function(creatorEmail, btnElement) {
    if (!currentUser) {
        alert('Please login with Google to subscribe!');
        return;
    }
    const subKey = `subscribed_${currentUser.email}_${creatorEmail}`;
    db.collection("users").doc(creatorEmail).get().then(doc => {
        let currentSubs = doc.exists ? (doc.data().subs || 0) : 0;
        if (localStorage.getItem(subKey)) {
            localStorage.removeItem(subKey);
            currentSubs = Math.max(0, currentSubs - 1);
            btnElement.innerText = 'Subscribe';
            btnElement.className = 'bg-white text-dark-900 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow';
            alert('Unsubscribed successfully.');
        } else {
            localStorage.setItem(subKey, 'true');
            currentSubs += 1;
            btnElement.innerText = 'Subscribed ✓';
            btnElement.className = 'bg-dark-700 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow';
            alert('Successfully subscribed!');
        }
        db.collection("users").doc(creatorEmail).update({ subs: currentSubs });
    });
};

// --- OFFLINE DOWNLOAD SYSTEM ---
function setupOfflineDownloadsUI() {
    const downloadBtn = document.getElementById('modalDownloadBtn');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            if (!activeVideo) return;
            let downloads = JSON.parse(localStorage.getItem('zynqra_offline_downloads') || '[]');
            
            if (downloads.some(v => v.id === activeVideo.id)) {
                alert('Video is already downloaded for offline viewing!');
                return;
            }

            downloads.push(activeVideo);
            localStorage.setItem('zynqra_offline_downloads', JSON.stringify(downloads));
            alert('Video successfully downloaded for offline mode!');
            loadOfflineDownloadsUI();
        };
    }
}

function loadOfflineDownloadsUI() {
    const container = document.getElementById('offlineDownloadsGrid');
    if (!container) return;

    let downloads = JSON.parse(localStorage.getItem('zynqra_offline_downloads') || '[]');
    container.innerHTML = '';

    if (downloads.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-xs">No downloaded videos found. Download videos while online to watch them offline anytime!</div>`;
        return;
    }

    downloads.forEach(video => {
        const card = document.createElement('div');
        card.className = 'bg-dark-900 border border-dark-700 rounded-3xl overflow-hidden shadow-md flex flex-col group';
        card.innerHTML = `
            <div class="relative aspect-video bg-black overflow-hidden">
                <img src="${sanitizeHTML(video.thumbnailUrl || video.creatorAvatar)}" class="w-full h-full object-cover">
                <span class="absolute bottom-2 left-2 bg-emerald-500 text-dark-900 text-[8px] px-2 py-0.5 rounded font-bold"><i class="fa-solid fa-check"></i> Offline Ready</span>
            </div>
            <div class="p-3 flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-white text-xs truncate max-w-[180px]">${sanitizeHTML(video.title)}</h4>
                    <p class="text-[9px] text-gray-400">${sanitizeHTML(video.creatorName)}</p>
                </div>
                <button class="play-offline-btn bg-brand-cyan text-dark-900 font-bold px-3 py-1.5 rounded-xl text-[10px] hover:bg-cyan-400 transition cursor-pointer">Play Offline</button>
            </div>
        `;
        card.querySelector('.play-offline-btn').onclick = () => openVideoModal(video);
        container.appendChild(card);
    });
}

function loadHomeShortsCarousel(videos) {
    const carousel = document.getElementById('homeShortsCarousel');
    if (!carousel) return;
    carousel.innerHTML = '';
    videos.filter(v => v.aspectRatio === '9:16').forEach(short => {
        const card = document.createElement('div');
        card.className = 'w-28 sm:w-32 shrink-0 bg-black rounded-2xl overflow-hidden border border-dark-700 relative group cursor-pointer aspect-[9/16] shadow-md';
        card.innerHTML = `
            <video src="${sanitizeHTML(short.videoUrl)}" class="w-full h-full object-cover pointer-events-none" muted preload="metadata"></video>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                <p class="text-[10px] font-bold text-white line-clamp-2">${sanitizeHTML(short.title)}</p>
                <span class="text-[8px] text-gray-300">${formatNumber(short.views || 0)} views</span>
            </div>
        `;
        card.addEventListener('click', () => switchPage('shorts'));
        carousel.appendChild(card);
    });
}

// --- SHORTS PLAYER WITH AUTO INTERSECTION OBSERVER (Voice Mute/Unmute on Scroll) ---
function loadShortsFeed() {
    db.collection("videos").where("aspectRatio", "==", "9:16").onSnapshot((snapshot) => {
        const container = document.getElementById('shortsPlayerContainer');
        if (!container) return;
        container.innerHTML = '';
        let shorts = [];
        snapshot.forEach(doc => shorts.push({ id: doc.id, ...doc.data() }));

        if (shorts.length === 0) {
            container.innerHTML = `<p class="text-gray-400 text-xs text-center mt-32">No Shorts available.</p>`;
            return;
        }

        shorts.forEach(short => {
            const isSubbed = currentUser && localStorage.getItem(`subscribed_${currentUser.email}_${short.creatorEmail}`);
            const slide = document.createElement('div');
            slide.className = 'shorts-slide w-full h-full relative flex items-center justify-center bg-black snap-start shrink-0';
            slide.innerHTML = `
                <video src="${sanitizeHTML(short.videoUrl)}" loop playsinline class="w-full h-full object-cover"></video>
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 p-4 flex flex-col justify-between pointer-events-none">
                    <div class="flex justify-between items-center pointer-events-auto">
                        <span class="bg-amber-400 text-dark-900 font-bold text-[10px] px-3 py-1 rounded-full shadow-lg">Zynqra Short</span>
                    </div>
                    <div class="space-y-2.5 pointer-events-auto pb-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2.5 cursor-pointer" onclick="openExternalProfile('${sanitizeHTML(short.creatorEmail)}')">
                                <img src="${sanitizeHTML(short.creatorAvatar)}" class="w-10 h-10 rounded-full border-2 border-brand-cyan shadow object-cover">
                                <span class="font-bold text-white text-sm">${sanitizeHTML(short.creatorName)}</span>
                            </div>
                            <button onclick="toggleSubscribeUser('${sanitizeHTML(short.creatorEmail)}', this)" class="${isSubbed ? 'bg-dark-700 text-gray-300' : 'bg-white text-dark-900'} px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shadow">
                                ${isSubbed ? 'Subscribed ✓' : 'Subscribe'}
                            </button>
                        </div>
                        <p class="text-xs text-gray-100 line-clamp-2">${sanitizeHTML(short.title)}</p>
                    </div>
                </div>
                <div class="absolute right-3 bottom-20 flex flex-col items-center space-y-4 pointer-events-auto">
                    <button onclick="likeShort('${sanitizeHTML(short.id)}', ${short.likes || 0})" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-heart text-brand-red text-base"></i><span class="text-[9px] font-bold mt-0.5">${formatNumber(short.likes || 0)}</span></button>
                    <button onclick="openShortsCommentsModal('${sanitizeHTML(short.id)}')" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-comment text-brand-cyan text-base"></i><span class="text-[9px] font-bold mt-0.5">${formatNumber((short.comments || []).length)}</span></button>
                    <button onclick="navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?v=' + '${sanitizeHTML(short.id)}'); alert('Unique Short share link copied to clipboard!');" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-share text-emerald-400 text-base"></i><span class="text-[9px] font-bold mt-0.5">Share</span></button>
                </div>
            `;
            const videoEl = slide.querySelector('video');
            
            // ক্লিক করলে প্লে/পজ হবে
            slide.addEventListener('click', (e) => {
                if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I' && e.target.tagName !== 'IMG' && e.target.tagName !== 'SPAN') {
                    if (videoEl.paused) {
                        videoEl.play();
                    } else {
                        videoEl.pause();
                    }
                }
            });
            container.appendChild(slide);
        });

        // Intersection Observer দিয়ে অটো ভয়েস মিউট/আনমিউট ও প্লে/পজ নিশ্চিত করা
        const observerOptions = {
            root: container,
            threshold: 0.6
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (!video) return;
                if (entry.isIntersecting) {
                    video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        }, observerOptions);

        container.querySelectorAll('.shorts-slide').forEach(slide => {
            observer.observe(slide);
        });
    });
}

window.likeShort = function(id, currentLikes) {
    if (!currentUser) {
        alert('Please login with Google to like shorts!');
        return;
    }
    const likeKey = `short_liked_${currentUser.email}_${id}`;
    if (localStorage.getItem(likeKey)) {
        alert('You have already liked this short!');
        return;
    }
    db.collection("videos").doc(id).update({
        likes: currentLikes + 1
    }).then(() => {
        localStorage.setItem(likeKey, 'true');
        alert('Short liked successfully!');
    });
};

let activeShortCommentId = null;

window.openShortsCommentsModal = function(id) {
    activeShortCommentId = id;
    const sheet = document.getElementById('shortsModalSheet');
    if (sheet) sheet.classList.remove('hidden');
    renderShortsComments(id);
};

function renderShortsComments(id) {
    db.collection("videos").doc(id).get().then(doc => {
        if(!doc.exists) return;
        const short = doc.data();
        const comments = short.comments || [];
        const list = document.getElementById('shortsCommentsList');
        if (!list) return;
        list.innerHTML = '';
        
        document.getElementById('shortsSheetTitle').innerText = `Shorts Comments (${comments.length})`;

        if (comments.length === 0) {
            list.innerHTML = `<p class="text-gray-500 text-xs text-center py-5">No comments yet. Be the first to comment!</p>`;
            return;
        }

        comments.forEach((c) => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'bg-dark-800 p-3 rounded-2xl border border-dark-700 space-y-1.5';
            commentDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-white text-xs">${sanitizeHTML(c.user)}</span>
                    <span class="text-[9px] text-gray-400">${sanitizeHTML(c.date || '')}</span>
                </div>
                <p class="text-gray-200 text-xs">${sanitizeHTML(c.text)}</p>
            `;
            list.appendChild(commentDiv);
        });
    });
}

// --- EXTERNAL PUBLIC PROFILE VIEW & TABS (Videos & Shorts) ---
function openExternalProfile(email) {
    db.collection("users").doc(email).get().then((doc) => {
        if (!doc.exists) {
            alert('User profile not found.');
            return;
        }
        const user = doc.data();
        switchPage('external-profile');

        document.getElementById('extProfileAvatar').src = user.avatar;
        document.getElementById('extProfileName').innerText = user.name;
        document.getElementById('extProfileEmail').innerText = user.email;
        document.getElementById('extProfileBio').innerText = user.bio || 'No bio added.';
        document.getElementById('extProfileSubs').innerText = `${formatNumber(user.subs || 0)} Subscribers`;
        
        const verifiedIcon = document.getElementById('extProfileNameVerifiedIcon');
        if (verifiedIcon) {
            if (user.verified) verifiedIcon.classList.remove('hidden');
            else verifiedIcon.classList.add('hidden');
        }

        const subBtn = document.getElementById('extSubscribeBtn');
        const isSubbed = currentUser && localStorage.getItem(`subscribed_${currentUser.email}_${user.email}`);
        if (subBtn) {
            subBtn.innerText = isSubbed ? 'Subscribed ✓' : 'Subscribe';
            subBtn.className = isSubbed ? 'bg-dark-700 text-gray-300 font-bold px-4 py-2 rounded-2xl text-xs cursor-default shadow' : 'bg-white text-dark-900 font-bold px-4 py-2 rounded-2xl text-xs hover:bg-gray-200 transition cursor-pointer shadow';
            subBtn.onclick = () => {
                if (!currentUser) {
                    alert('Please login to subscribe!');
                    return;
                }
                toggleSubscribeUser(user.email, subBtn);
            };
        }

        document.getElementById('extMessageBtn').onclick = () => openChatWithUser(user.email);

        db.collection("videos").where("creatorEmail", "==", user.email).get().then((vSnapshot) => {
            const countBadge = document.getElementById('extProfileVideoCount');
            if (countBadge) countBadge.innerText = `${vSnapshot.size} Videos`;

            let allUserVideos = [];
            vSnapshot.forEach(vDoc => allUserVideos.push({ id: vDoc.id, ...vDoc.data() }));

            const renderExtTabContent = (type) => {
                const area = document.getElementById('extTabContentArea');
                if (!area) return;
                area.innerHTML = '';
                const filtered = allUserVideos.filter(v => type === 'shorts' ? v.aspectRatio === '9:16' : v.aspectRatio !== '9:16');
                
                if (filtered.length === 0) {
                    area.innerHTML = `<p class="text-gray-500 text-xs col-span-full">No ${type} found.</p>`;
                    return;
                }

                filtered.forEach(v => {
                    const card = document.createElement('div');
                    card.className = 'bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden p-2.5 flex space-x-2.5 cursor-pointer';
                    card.innerHTML = `
                        <img src="${sanitizeHTML(v.thumbnailUrl || v.creatorAvatar)}" class="w-20 h-12 rounded-xl object-cover">
                        <div class="flex-1 truncate">
                            <h4 class="font-bold text-white text-[11px] truncate">${sanitizeHTML(v.title)}</h4>
                            <div class="text-[9px] text-gray-400 mt-1">${formatNumber(v.views || 0)} views</div>
                        </div>
                    `;
                    card.onclick = () => openVideoModal(v);
                    area.appendChild(card);
                });
            };

            renderExtTabContent('videos');
            document.getElementById('extTabVideos').onclick = () => {
                document.getElementById('extTabVideos').className = 'text-xs font-bold text-brand-cyan border-b-2 border-brand-cyan pb-1 transition cursor-pointer';
                document.getElementById('extTabShorts').className = 'text-xs font-semibold text-gray-400 hover:text-white pb-1 transition cursor-pointer';
                renderExtTabContent('videos');
            };
            document.getElementById('extTabShorts').onclick = () => {
                document.getElementById('extTabShorts').className = 'text-xs font-bold text-brand-cyan border-b-2 border-brand-cyan pb-1 transition cursor-pointer';
                document.getElementById('extTabVideos').className = 'text-xs font-semibold text-gray-400 hover:text-white pb-1 transition cursor-pointer';
                renderExtTabContent('shorts');
            };
        });
    });
}

// --- VIDEO MODAL & COMMENTS ---
function openVideoModal(video) {
    activeVideo = video;
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('modalVideoPlayer');

    document.getElementById('modalVideoTitle').innerText = video.title;
    document.getElementById('modalCreatorName').innerText = video.creatorName;
    document.getElementById('modalCreatorAvatar').src = video.creatorAvatar;
    document.getElementById('modalLikeCount').innerText = formatNumber(video.likes || 0);
    document.getElementById('modalVideoViewsCount').innerText = `${formatNumber(video.views || 0)} views`;
    document.getElementById('modalVideoDate').innerText = video.date || '2026';
    document.getElementById('modalVideoDescText').innerText = video.desc || 'No description provided.';

    db.collection("users").doc(video.creatorEmail).get().then(doc => {
        const subsCount = doc.exists ? (doc.data().subs || 0) : 0;
        document.getElementById('modalCreatorSubs').innerText = `${formatNumber(subsCount)} subscribers`;
    });

    const creatorClick = document.getElementById('modalCreatorProfileClick');
    if (creatorClick) {
        creatorClick.onclick = () => {
            modal.classList.add('hidden');
            player.pause();
            openExternalProfile(video.creatorEmail);
        };
    }

    const shareBtn = document.getElementById('modalShareBtn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const uniqueVideoLink = window.location.origin + window.location.pathname + '?v=' + video.id;
            navigator.clipboard.writeText(uniqueVideoLink).then(() => {
                alert('Unique Video Share Link copied to clipboard!\n' + uniqueVideoLink);
            });
        };
    }

    player.src = video.videoUrl;
    renderComments(video);
    renderRelatedVideos(video);
    modal.classList.remove('hidden');
    player.play();
    processSecureVideoView(video);

    const likeBtn = document.getElementById('modalLikeBtn');
    likeBtn.onclick = () => {
        if (!currentUser) {
            alert('Please login with Google to like videos!');
            return;
        }
        const userLikeKey = `liked_${currentUser.email}_${video.id}`;
        if (localStorage.getItem(userLikeKey)) {
            alert('You have already liked this video!');
            return;
        }

        const newLikes = (video.likes || 0) + 1;
        db.collection("videos").doc(video.id).update({ likes: newLikes }).then(() => {
            localStorage.setItem(userLikeKey, 'true');
            document.getElementById('modalLikeCount').innerText = formatNumber(newLikes);
            alert('Video liked successfully!');
        });
    };
}

function processSecureVideoView(video) {
    const viewSessionKey = `viewed_session_${video.id}`;
    const lastViewTime = localStorage.getItem(`last_view_${video.id}`);
    const now = Date.now();

    if (!sessionStorage.getItem(viewSessionKey) && (!lastViewTime || (now - lastViewTime > 30000))) {
        sessionStorage.setItem(viewSessionKey, 'true');
        localStorage.setItem(`last_view_${video.id}`, now);

        const newViews = (video.views || 0) + 1;
        db.collection("videos").doc(video.id).update({ views: newViews });

        db.collection("users").doc(video.creatorEmail).get().then(doc => {
            if (doc.exists) {
                let currentTotalViews = doc.data().totalViews || 0;
                db.collection("users").doc(video.creatorEmail).update({ totalViews: currentTotalViews + 1 });
            }
        });
    }
}

function renderComments(video) {
    const list = document.getElementById('commentsList');
    const badge = document.getElementById('commentCountBadge');
    if (!list) return;
    list.innerHTML = '';
    const comments = video.comments || [];
    badge.innerText = formatNumber(comments.length);

    if (comments.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-[10px]">No comments yet.</p>`;
        return;
    }
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-dark-900 p-2.5 rounded-xl border border-dark-700 space-y-0.5';
        div.innerHTML = `
            <div class="font-bold text-white text-[10px]">${sanitizeHTML(c.user)}</div>
            <div class="text-gray-300 text-[11px]">${sanitizeHTML(c.text)}</div>
        `;
        list.appendChild(div);
    });
}

function renderRelatedVideos(currentVideo) {
    db.collection("videos").get().then((snapshot) => {
        const sidebar = document.getElementById('relatedVideosSidebar');
        if (!sidebar) return;
        sidebar.innerHTML = '';
        snapshot.forEach(doc => {
            const video = { id: doc.id, ...doc.data() };
            if (video.id !== currentVideo.id && video.aspectRatio !== '9:16') {
                const card = document.createElement('div');
                card.className = 'flex space-x-2.5 cursor-pointer group';
                card.innerHTML = `
                    <img src="${sanitizeHTML(video.thumbnailUrl || video.creatorAvatar)}" class="w-28 aspect-video object-cover rounded-xl border border-dark-700 group-hover:border-brand-cyan transition">
                    <div class="flex-1 truncate">
                        <h5 class="font-bold text-white text-xs line-clamp-2">${sanitizeHTML(video.title)}</h5>
                        <div class="text-[9px] text-gray-400 mt-1">${sanitizeHTML(video.creatorName)}</div>
                        <div class="text-[8px] text-gray-500">${formatNumber(video.views || 0)} views</div>
                    </div>
                `;
                card.addEventListener('click', () => openVideoModal(video));
                sidebar.appendChild(card);
            }
        });
    });
}

// --- MESSENGER & LIVE SEARCH BAR ---
function loadFriendsList() {
    db.collection("users").get().then((snapshot) => {
        const container = document.getElementById('friendsListContainer');
        if (!container) return;
        container.innerHTML = '';
        let users = [];
        snapshot.forEach(doc => users.push(doc.data()));
        globalAllUsers = users;

        users.forEach(user => {
            if (currentUser && user.email === currentUser.email) return;
            const isSubbed = currentUser && localStorage.getItem(`subscribed_${currentUser.email}_${user.email}`);
            const card = document.createElement('div');
            card.className = 'bg-dark-800 border border-dark-700 p-3.5 rounded-2xl flex items-center justify-between shadow';
            card.innerHTML = `
                <div class="flex items-center space-x-3 cursor-pointer group" onclick="openExternalProfile('${sanitizeHTML(user.email)}')">
                    <img src="${sanitizeHTML(user.avatar)}" class="w-10 h-10 rounded-full object-cover border border-brand-cyan group-hover:scale-105 transition">
                    <div>
                        <h4 class="font-bold text-white text-xs group-hover:text-brand-cyan transition">${sanitizeHTML(user.name)}</h4>
                        <p class="text-[10px] text-gray-400">${formatNumber(user.subs || 0)} subscribers • ${formatNumber(user.totalViews || 0)} Views</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleSubscribeUser('${sanitizeHTML(user.email)}', this)" class="${isSubbed ? 'bg-dark-700 text-gray-300' : 'bg-white text-dark-900'} px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow">
                        ${isSubbed ? 'Subscribed ✓' : 'Subscribe'}
                    </button>
                    <button onclick="openChatWithUser('${sanitizeHTML(user.email)}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow">
                        <i class="fa-solid fa-message"></i> <span>Message</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function loadMessengerContacts(filterQuery = '') {
    db.collection("users").get().then((snapshot) => {
        const container = document.getElementById('chatContactsList');
        if (!container) return;
        container.innerHTML = '';
        
        let users = [];
        snapshot.forEach(doc => {
            if (!currentUser || doc.data().email !== currentUser.email) {
                users.push(doc.data());
            }
        });

        if (filterQuery) {
            users = users.filter(u => u.name && u.name.toLowerCase().includes(filterQuery));
        }

        users.forEach(user => {
            const unreadCount = parseInt(localStorage.getItem(`unread_${currentUser?.email}_${user.email}`) || '0');
            const item = document.createElement('div');
            item.className = 'p-2 flex flex-col items-center justify-center hover:bg-[#202c33] cursor-pointer transition border-b border-dark-700/30 relative';
            item.innerHTML = `
                <div class="relative">
                    <img src="${sanitizeHTML(user.avatar)}" class="w-9 h-9 rounded-full object-cover border border-emerald-500/40" title="${sanitizeHTML(user.name)}">
                    ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.2 rounded-full font-bold">${unreadCount}</span>` : ''}
                </div>
                <span class="text-[9px] text-gray-300 truncate mt-1 max-w-[50px]">${sanitizeHTML(user.name)}</span>
            `;
            item.onclick = () => {
                localStorage.setItem(`unread_${currentUser?.email}_${user.email}`, '0');
                selectActiveChatContact(user);
                loadMessengerContacts();
            };
            container.appendChild(item);
        });
    });
}

function openChatWithUser(email) {
    db.collection("users").doc(email).get().then((doc) => {
        if (doc.exists) {
            switchPage('messenger');
            selectActiveChatContact(doc.data());
        }
    });
}

function selectActiveChatContact(user) {
    activeChatContact = user;
    const header = document.getElementById('activeChatHeader');
    header.innerHTML = `
        <div class="flex items-center space-x-2.5 cursor-pointer" onclick="openExternalProfile('${sanitizeHTML(user.email)}')">
            <img src="${sanitizeHTML(user.avatar)}" class="w-8 h-8 rounded-full object-cover">
            <div>
                <span class="font-bold text-white block text-xs hover:text-brand-cyan transition">${sanitizeHTML(user.name)}</span>
                <span class="text-[9px] text-emerald-400">online</span>
            </div>
        </div>
    `;
    renderChatMessages();
}

function renderChatMessages() {
    const box = document.getElementById('chatMessagesBox');
    if (!box) return;
    box.innerHTML = '';
    if (!activeChatContact || !currentUser) return;

    if (unsubscribeChat) {
        unsubscribeChat();
    }

    const chatId = [currentUser.email, activeChatContact.email].sort().join('_');
    unsubscribeChat = db.collection("chats").doc(chatId).collection("messages").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
        box.innerHTML = '';
        if (snapshot.empty) {
            box.innerHTML = `<div class="m-auto text-center text-gray-500 text-[10px] bg-[#182229] px-3 py-1.5 rounded-xl">No messages yet. Say hello!</div>`;
            return;
        }
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.sender === currentUser.email;
            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${isMe ? 'justify-end' : 'justify-start'} my-1.5`;
            msgDiv.innerHTML = `
                <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-xs shadow-md ${isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-gray-100 rounded-tl-none'}">
                    <p>${sanitizeHTML(msg.text)}</p>
                    <div class="text-[8px] text-right text-gray-300 mt-1">${sanitizeHTML(msg.time)}</div>
                </div>
            `;
            box.appendChild(msgDiv);
        });
        box.scrollTop = box.scrollHeight;
    });
}

// --- NOTIFICATIONS SYSTEM ---
function loadNotifications() {
    const notifBadge = document.getElementById('notifBadge');
    const headerMsgBadge = document.getElementById('headerMsgBadge');
    const sidebarMsgBadge = document.getElementById('sidebarMsgBadge');
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (!notifBadge || !notificationsBtn) return;

    if (currentUser) {
        db.collection("notifications").where("recipient", "==", currentUser.email).orderBy("date", "desc").onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                notifBadge.innerText = snapshot.size;
                notifBadge.classList.remove('hidden');
                if (headerMsgBadge) {
                    headerMsgBadge.innerText = snapshot.size;
                    headerMsgBadge.classList.remove('hidden');
                }
                if (sidebarMsgBadge) {
                    sidebarMsgBadge.innerText = snapshot.size;
                    sidebarMsgBadge.classList.remove('hidden');
                }
            } else {
                notifBadge.classList.add('hidden');
                if (headerMsgBadge) headerMsgBadge.classList.add('hidden');
                if (sidebarMsgBadge) sidebarMsgBadge.classList.add('hidden');
            }
        });
    }

    notificationsBtn.onclick = () => {
        switchPage('messenger');
    };
}

// --- PROFILE EDIT MODAL ---
function setupProfileEditModal() {
    const openBtn = document.getElementById('openEditModalBtn');
    const modal = document.getElementById('editProfileModal');
    const closeBtn = document.getElementById('closeEditModalBtn');
    const saveBtn = document.getElementById('saveProfileBtn');

    if (openBtn && modal) {
        openBtn.onclick = () => {
            if (!currentUser) {
                alert('Please login first.');
                return;
            }
            document.getElementById('editNameInput').value = currentUser.name || '';
            document.getElementById('editBioInput').value = currentUser.bio || '';
            modal.classList.remove('hidden');
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!currentUser) return;
            const newName = sanitizeHTML(document.getElementById('editNameInput').value.trim());
            const newBio = sanitizeHTML(document.getElementById('editBioInput').value.trim());
            const imageFile = document.getElementById('profileImageFile').files[0];

            let avatarUrl = currentUser.avatar;
            alert('Updating profile...');

            if (imageFile) {
                const cloudName = "u078nis6";
                const uploadPreset = "zynqra_preset";
                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('upload_preset', uploadPreset);

                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                const resData = await res.json();
                if (resData.secure_url) avatarUrl = resData.secure_url;
            }

            currentUser.name = newName || currentUser.name;
            currentUser.bio = newBio;
            currentUser.avatar = avatarUrl;

            await db.collection("users").doc(currentUser.email).set(currentUser, { merge: true });
            
            alert('Profile updated successfully!');
            modal.classList.add('hidden');
            loadUserProfile();
            initializeAppUI();
        };
    }

    const emojiToolbar = document.getElementById('emojiToolbar');
    const chatInput = document.getElementById('chatInputMsg');
    if (emojiToolbar && chatInput) {
        emojiToolbar.querySelectorAll('span').forEach(emojiSpan => {
            emojiSpan.onclick = () => {
                chatInput.value += emojiSpan.innerText;
                chatInput.focus();
            };
        });
    }

    // Messenger Search Bar Listener
    const messengerSearchInput = document.getElementById('messengerSearchInput');
    if (messengerSearchInput) {
        messengerSearchInput.addEventListener('input', (e) => {
            loadMessengerContacts(sanitizeHTML(e.target.value.toLowerCase().trim()));
        });
    }
}

// --- VIDEO EDIT & DELETE MANAGEMENT ---
function setupVideoEditModal() {
    const modal = document.getElementById('editVideoModal');
    const closeBtn = document.getElementById('closeEditVideoModal');
    const saveBtn = document.getElementById('saveVideoTitleBtn');

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            const newTitle = sanitizeHTML(document.getElementById('editVideoTitleInput').value.trim());
            if (!newTitle || !editingVideoId) {
                alert('Please enter a valid title.');
                return;
            }

            await db.collection("videos").doc(editingVideoId).update({ title: newTitle });
            alert('Video title updated successfully!');
            modal.classList.add('hidden');
            loadUserProfile();
        };
    }
}

window.openEditVideoModal = function(id, currentTitle) {
    editingVideoId = id;
    const input = document.getElementById('editVideoTitleInput');
    const modal = document.getElementById('editVideoModal');
    if (input && modal) {
        input.value = currentTitle;
        modal.classList.remove('hidden');
    }
};

window.deleteUserVideo = async function(id) {
    if (confirm('Are you sure you want to delete this video?')) {
        await db.collection("videos").doc(id).delete();
        alert('Video deleted successfully!');
        loadUserProfile();
    }
};

// --- UPLOAD & ANTI-PORN FILTERING CHECKER ---
function setupEventListeners() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                alert('Please login with Google to upload videos!');
                return;
            }

            if (currentUser.isBanned) {
                alert('Your account is restricted from uploading videos.');
                return;
            }

            const title = sanitizeHTML(document.getElementById('videoTitle').value);
            const category = sanitizeHTML(document.getElementById('videoCategory').value);
            const uploadTypeChoice = sanitizeHTML(document.getElementById('uploadTypeChoice').value);
            const aspectRatio = uploadTypeChoice === 'shorts' ? '9:16' : '16:9';
            const desc = sanitizeHTML(document.getElementById('videoDesc').value);
            const videoFile = document.getElementById('videoFile').files[0];
            const thumbFile = document.getElementById('thumbnailFile').files[0];

            if (!videoFile) {
                alert('Please select a video file.');
                return;
            }

            const pornKeywords = ['porn', 'xxx', 'sex', 'naked', 'adult', 'nude', 'porno', 'bdsm', 'erotic'];
            const containsRestrictedContent = pornKeywords.some(keyword => title.toLowerCase().includes(keyword) || desc.toLowerCase().includes(keyword));

            if (containsRestrictedContent) {
                let newStrikes = (currentUser.strikes || 0) + 1;
                let isRestricted = newStrikes >= 2;
                
                await db.collection("users").doc(currentUser.email).update({
                    strikes: newStrikes,
                    isBanned: isRestricted
                });

                alert('Warning: Your upload violates Zynqra community guidelines regarding adult content. Your account has received a strike/restriction.');
                return;
            }

            const submitBtn = uploadForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerText : 'Upload';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Uploading video... 0%';
            }

            const cloudName = "u078nis6";
            const uploadPreset = "zynqra_preset";

            async function uploadToCloudinary(file, resourceType, onProgress) {
                return new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', uploadPreset);

                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, true);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable && onProgress) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            onProgress(percent);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            const data = JSON.parse(xhr.responseText);
                            if (data.secure_url) resolve(data.secure_url);
                            else reject(new Error('Upload failed'));
                        } else {
                            reject(new Error('Cloudinary upload error'));
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during upload'));
                    xhr.send(formData);
                });
            }

            try {
                if (submitBtn) submitBtn.innerText = 'Uploading video...';
                const videoUrl = await uploadToCloudinary(videoFile, 'video', (pct) => {
                    if (submitBtn) submitBtn.innerText = `Uploading Video: ${pct}%`;
                });

                let thumbnailUrl = '';
                if (thumbFile) {
                    if (submitBtn) submitBtn.innerText = 'Uploading thumbnail...';
                    thumbnailUrl = await uploadToCloudinary(thumbFile, 'image', (pct) => {
                        if (submitBtn) submitBtn.innerText = `Uploading Thumbnail: ${pct}%`;
                    });
                }

                if (submitBtn) submitBtn.innerText = 'Saving to Database...';
                await db.collection("videos").add({
                    title, category, aspectRatio, desc, videoUrl, thumbnailUrl,
                    creatorName: currentUser.name,
                    creatorEmail: currentUser.email,
                    creatorAvatar: currentUser.avatar,
                    likes: 0, views: 0,
                    date: new Date().toISOString().split('T')[0]
                });

                alert('Video successfully uploaded and published on Zynqra!');
                uploadForm.reset();
                switchPage('home');
            } catch (error) {
                alert('Upload Error: ' + sanitizeHTML(error.message));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalBtnText;
                }
            }
        });
    }

    const sendBtn = document.getElementById('sendChatMsgBtn');
    const chatInput = document.getElementById('chatInputMsg');
    if (sendBtn && chatInput) {
        const sendAction = () => {
            const text = sanitizeHTML(chatInput.value.trim());
            if (!text || !activeChatContact || !currentUser) return;

            const chatId = [currentUser.email, activeChatContact.email].sort().join('_');
            const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            db.collection("chats").doc(chatId).collection("messages").add({
                sender: currentUser.email,
                text: text,
                time: timeNow,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            const unreadKey = `unread_${activeChatContact.email}_${currentUser.email}`;
            const currentUnread = parseInt(localStorage.getItem(unreadKey) || '0');
            localStorage.setItem(unreadKey, currentUnread + 1);

            db.collection("notifications").add({
                recipient: activeChatContact.email,
                sender: currentUser.name,
                text: text,
                date: new Date().toISOString()
            });

            chatInput.value = '';
        };
        sendBtn.onclick = sendAction;
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendAction(); };
    }

    const closeModal = () => {
        document.getElementById('videoModal').classList.add('hidden');
        document.getElementById('modalVideoPlayer').pause();
    };
    const closeMob = document.getElementById('closeVideoModalMobile');
    const closeDesk = document.getElementById('closeVideoModalDesktop');
    if (closeMob) closeMob.onclick = closeModal;
    if (closeDesk) closeDesk.onclick = closeModal;

    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.category-chip').forEach(c => {
                c.className = 'category-chip bg-dark-800 hover:bg-dark-700 text-gray-200 px-4 py-2 rounded-xl shrink-0 transition cursor-pointer';
            });
            chip.className = 'category-chip bg-white text-dark-900 px-4 py-2 rounded-xl font-bold shrink-0 shadow-lg cursor-pointer';
            loadHomeFeed(chip.getAttribute('data-category'));
        };
    });

    const postCommentBtn = document.getElementById('postCommentBtn');
    const commentInput = document.getElementById('commentInput');
    if (postCommentBtn && commentInput) {
        postCommentBtn.onclick = () => {
            const text = sanitizeHTML(commentInput.value.trim());
            if (!text || !activeVideo) return;

            const newComment = { user: currentUser ? currentUser.name : 'Guest', text: text, date: new Date().toISOString().split('T')[0] };
            const updatedComments = activeVideo.comments ? [...activeVideo.comments, newComment] : [newComment];

            db.collection("videos").doc(activeVideo.id).update({ comments: updatedComments }).then(() => {
                activeVideo.comments = updatedComments;
                renderComments(activeVideo);
                commentInput.value = '';
            });
        };
    }
}

// --- PROFILE & TABS (Videos & Shorts) ---
function loadAnalytics() {
    if (!currentUser) return;
    db.collection("videos").where("creatorEmail", "==", currentUser.email).get().then((snapshot) => {
        let totalViews = 0, totalLikes = 0, topVideoTitle = 'None', maxViews = -1;
        const list = document.getElementById('analyticsVideoList');
        if (!list) return;
        list.innerHTML = '';

        snapshot.forEach(doc => {
            const v = doc.data();
            totalViews += (v.views || 0);
            totalLikes += (v.likes || 0);
            if ((v.views || 0) > maxViews) { maxViews = v.views || 0; topVideoTitle = v.title; }

            list.innerHTML += `
                <div class="bg-dark-800 p-3 rounded-2xl flex items-center justify-between border border-dark-700 text-xs">
                    <span class="font-bold text-white truncate max-w-[60%]">${sanitizeHTML(v.title)}</span>
                    <div class="space-x-3 text-[10px] text-gray-300">
                        <span><i class="fa-solid fa-eye text-brand-cyan"></i> ${formatNumber(v.views || 0)}</span>
                        <span><i class="fa-solid fa-thumbs-up text-brand-red"></i> ${formatNumber(v.likes || 0)}</span>
                    </div>
                </div>
            `;
        });

        document.getElementById('analyticTotalViews').innerText = formatNumber(totalViews);
        document.getElementById('analyticTotalLikes').innerText = formatNumber(totalLikes);
        document.getElementById('analyticTopVideo').innerText = sanitizeHTML(topVideoTitle);
    });
}

function loadUserProfile() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.email).get().then((doc) => {
        const freshUser = doc.exists ? doc.data() : currentUser;
        currentUser = { ...currentUser, ...freshUser };

        document.getElementById('profileAvatar').src = freshUser.avatar;
        document.getElementById('profileName').innerText = freshUser.name;
        document.getElementById('profileEmail').innerText = freshUser.email;
        document.getElementById('profileBio').innerText = freshUser.bio || 'No bio added.';
        document.getElementById('profileSubCount').innerText = `${formatNumber(freshUser.subs || 0)} Subs`;
        document.getElementById('profileStrikeCount').innerText = `${freshUser.strikes || 0} Strikes`;

        const verifiedBadge = document.getElementById('profileVerifiedBadge');
        const nameVerifiedIcon = document.getElementById('profileNameVerifiedIcon');
        if (freshUser.verified) {
            verifiedBadge.classList.remove('hidden');
            nameVerifiedIcon.classList.remove('hidden');
        } else {
            verifiedBadge.classList.add('hidden');
            nameVerifiedIcon.classList.add('hidden');
        }
    });

    db.collection("videos").where("creatorEmail", "==", currentUser.email).get().then((snapshot) => {
        const videoCountBadge = document.getElementById('profileVideoCountBadge');
        if (videoCountBadge) videoCountBadge.innerText = `${snapshot.size} Videos`;

        let myAllVideos = [];
        snapshot.forEach(doc => myAllVideos.push({ id: doc.id, ...doc.data() }));

        const renderProfileTabContent = (type) => {
            const area = document.getElementById('profileTabContentArea');
            if (!area) return;
            area.innerHTML = '';
            const filtered = myAllVideos.filter(v => type === 'shorts' ? v.aspectRatio === '9:16' : v.aspectRatio !== '9:16');

            if (filtered.length === 0) {
                area.innerHTML = `<p class="text-gray-500 text-[11px] col-span-full">No ${type} uploaded yet.</p>`;
                return;
            }

            filtered.forEach(v => {
                area.innerHTML += `
                    <div class="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden p-3 flex items-center justify-between">
                        <div class="flex items-center space-x-2.5 truncate">
                            <img src="${sanitizeHTML(v.thumbnailUrl || v.creatorAvatar)}" class="w-16 h-10 rounded-xl object-cover">
                            <div class="truncate">
                                <h4 class="font-bold text-white text-[11px] truncate">${sanitizeHTML(v.title)}</h4>
                                <div class="text-[9px] text-gray-400 mt-0.5">${formatNumber(v.views || 0)} views • ${formatNumber(v.likes || 0)} likes</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2 shrink-0">
                            <button onclick="openEditVideoModal('${v.id}', '${sanitizeHTML(v.title)}')" class="bg-brand-cyan/20 text-brand-cyan px-2.5 py-1 rounded-xl text-[10px] font-semibold cursor-pointer hover:bg-brand-cyan/30">Edit</button>
                            <button onclick="deleteUserVideo('${v.id}')" class="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-xl text-[10px] font-semibold cursor-pointer hover:bg-red-500/30">Delete</button>
                        </div>
                    </div>
                `;
            });
        };

        renderProfileTabContent('videos');
        document.getElementById('profileTabVideos').onclick = () => {
            document.getElementById('profileTabVideos').className = 'text-xs font-bold text-brand-cyan border-b-2 border-brand-cyan pb-1 transition cursor-pointer';
            document.getElementById('profileTabShorts').className = 'text-xs font-semibold text-gray-400 hover:text-white pb-1 transition cursor-pointer';
            renderProfileTabContent('videos');
        };
        document.getElementById('profileTabShorts').onclick = () => {
            document.getElementById('profileTabShorts').className = 'text-xs font-bold text-brand-cyan border-b-2 border-brand-cyan pb-1 transition cursor-pointer';
            document.getElementById('profileTabVideos').className = 'text-xs font-semibold text-gray-400 hover:text-white pb-1 transition cursor-pointer';
            renderProfileTabContent('shorts');
        };
    });
}
