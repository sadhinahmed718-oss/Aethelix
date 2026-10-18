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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null; // ইউনিক ইউজারের জন্য ইনিশিয়ালি নাল রাখা হলো যাতে ওভারল্যাপ না হয়
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
});

// --- Firebase Persistent Auth State (ইউনিক অ্যাকাউন্ট হ্যান্ডলিং) ---
function setupFirebaseAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // ইউজারের নিজস্ব ইউনিক জিমেইল দিয়ে ডেটাবেস থেকে রিয়েল-টাইম ডাটা ফেচ করা
            const userRef = db.collection("users").doc(user.email);
            const doc = await userRef.get();

            if (doc.exists) {
                currentUser = doc.data();
            } else {
                // নতুন ইউজার হলে তার নিজস্ব ইউনিক অ্যাকাউন্ট তৈরি হবে
                currentUser = {
                    name: sanitizeHTML(user.displayName || 'Zynqra Creator'),
                    email: sanitizeHTML(user.email),
                    avatar: sanitizeHTML(user.photoURL || 'https://picsum.photos/seed/user/100/100'),
                    subs: 0,
                    strikes: 0,
                    verified: false,
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

// --- Google Authentication ---
function setupGoogleAuth() {
    const loginBtn = document.getElementById('googleLoginBtn');
    if (loginBtn) {
        loginBtn.onclick = () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then((result) => {
                alert('Successfully Logged in with Google!');
            }).catch((error) => {
                alert('Login Failed: ' + sanitizeHTML(error.message));
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
                    <img src="${sanitizeHTML(currentUser.avatar)}" alt="Profile" class="w-8 h-8 rounded-full object-cover border border-brand-cyan shadow-sm">
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
    if (currentUser && currentUser.email === 'admin@zynqra.com') {
        const adminLink = document.getElementById('adminPanelLink');
        if (adminLink) adminLink.classList.remove('hidden');
    }
}

function triggerGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert(sanitizeHTML(err.message)));
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
}

function switchPage(pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
    
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

// --- HOME FEED & RENDERING FROM FIRESTORE ---
function loadHomeFeed(category = 'all') {
    db.collection("videos").orderBy("date", "desc").onSnapshot((snapshot) => {
        const grid = document.getElementById('videoGrid');
        if (!grid) return;
        grid.innerHTML = '';
        let videos = [];
        snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
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
                    <span class="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-md font-bold">${sanitizeHTML(video.aspectRatio)}</span>
                </div>
                <div class="p-3.5 flex space-x-3 flex-1">
                    <img src="${sanitizeHTML(video.creatorAvatar)}" class="w-8 h-8 rounded-full object-cover border border-dark-600">
                    <div class="flex-1 space-y-1">
                        <h3 class="font-bold text-white text-xs line-clamp-2">${sanitizeHTML(video.title)}</h3>
                        <div class="flex items-center space-x-1 text-[10px] text-gray-400">
                            <span>${sanitizeHTML(video.creatorName)}</span>
                        </div>
                        <p class="text-[9px] text-gray-500">${video.views || 0} views • ${sanitizeHTML(video.date)}</p>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openVideoModal(video));
            grid.appendChild(card);
        });

        loadHomeShortsCarousel(videos);
    });
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

        const executeSearch = () => {
            const query = sanitizeHTML(input.value.toLowerCase().trim());
            if (!query) return;
            if (suggestionBox) suggestionBox.classList.add('hidden');
            if (mobileSearchOverlay) mobileSearchOverlay.classList.add('hidden');
            switchPage('home');
            
            const grid = document.getElementById('videoGrid');
            if (!grid) return;
            grid.innerHTML = '';
            
            const matchedVideos = globalAllVideos.filter(v => 
                (v.title && v.title.toLowerCase().includes(query)) || 
                (v.creatorName && v.creatorName.toLowerCase().includes(query))
            );

            if (matchedVideos.length === 0) {
                grid.innerHTML = `<p class="text-gray-500 text-xs col-span-full text-center py-10">No search results found for "${query}".</p>`;
                return;
            }

            matchedVideos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'bg-dark-800 border border-dark-700 rounded-3xl overflow-hidden shadow-lg hover:border-brand-cyan transition cursor-pointer flex flex-col group';
                card.innerHTML = `
                    <div class="relative aspect-video bg-black overflow-hidden">
                        <img src="${sanitizeHTML(video.thumbnailUrl || video.creatorAvatar)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    </div>
                    <div class="p-3.5 flex space-x-3 flex-1">
                        <img src="${sanitizeHTML(video.creatorAvatar)}" class="w-8 h-8 rounded-full object-cover border border-dark-600">
                        <div class="flex-1 space-y-1">
                            <h3 class="font-bold text-white text-xs line-clamp-2">${sanitizeHTML(video.title)}</h3>
                            <p class="text-[9px] text-gray-500">${video.views || 0} views • By ${sanitizeHTML(video.creatorName)}</p>
                        </div>
                    </div>
                `;
                card.addEventListener('click', () => openVideoModal(video));
                grid.appendChild(card);
            });
        };

        input.onkeypress = (e) => { if (e.key === 'Enter') executeSearch(); };
    });
}

// --- FRIEND & SUBSCRIBER SEARCH ENGINE ---
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
            container.innerHTML = `<p class="text-gray-500 text-xs col-span-full text-center py-5">No friends or creators found.</p>`;
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
                        <p class="text-[10px] text-gray-400">${user.subs || 0} subscribers</p>
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
    if (localStorage.getItem(subKey)) {
        localStorage.removeItem(subKey);
        btnElement.innerText = 'Subscribe';
        btnElement.className = 'bg-white text-dark-900 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow';
        alert('Unsubscribed successfully.');
    } else {
        localStorage.setItem(subKey, 'true');
        btnElement.innerText = 'Subscribed ✓';
        btnElement.className = 'bg-dark-700 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow';
        alert('Successfully subscribed!');
    }
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
            <img src="${sanitizeHTML(short.thumbnailUrl || short.creatorAvatar)}" class="w-full h-full object-cover group-hover:scale-105 transition">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                <p class="text-[10px] font-bold text-white line-clamp-2">${sanitizeHTML(short.title)}</p>
                <span class="text-[8px] text-gray-300">${short.views || 0} views</span>
            </div>
        `;
        card.addEventListener('click', () => switchPage('shorts'));
        carousel.appendChild(card);
    });
}

// --- SHORTS PLAYER ---
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
            const slide = document.createElement('div');
            slide.className = 'shorts-slide w-full h-full relative flex items-center justify-center bg-black snap-start shrink-0';
            slide.innerHTML = `
                <video src="${sanitizeHTML(short.videoUrl)}" loop class="w-full h-full object-cover"></video>
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 p-4 flex flex-col justify-between pointer-events-none">
                    <div class="flex justify-between items-center pointer-events-auto">
                        <span class="bg-amber-400 text-dark-900 font-bold text-[10px] px-3 py-1 rounded-full shadow-lg">Zynqra Short</span>
                    </div>
                    <div class="space-y-2.5 pointer-events-auto pb-4">
                        <div class="flex items-center space-x-2.5 cursor-pointer" onclick="openExternalProfile('${sanitizeHTML(short.creatorEmail)}')">
                            <img src="${sanitizeHTML(short.creatorAvatar)}" class="w-10 h-10 rounded-full border-2 border-brand-cyan shadow">
                            <span class="font-bold text-white text-sm">${sanitizeHTML(short.creatorName)}</span>
                        </div>
                        <p class="text-xs text-gray-100 line-clamp-2">${sanitizeHTML(short.title)}</p>
                    </div>
                </div>
                <div class="absolute right-3 bottom-20 flex flex-col items-center space-y-5 pointer-events-auto">
                    <button onclick="likeShort('${sanitizeHTML(short.id)}', ${short.likes || 0})" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-heart text-brand-red text-base"></i><span class="text-[9px] font-bold mt-0.5">${short.likes || 0}</span></button>
                    <button onclick="openVideoModal(${JSON.stringify(short).replace(/"/g, '&quot;')})" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-comment text-brand-cyan text-base"></i><span class="text-[9px] font-bold mt-0.5">${(short.comments || []).length}</span></button>
                    <button onclick="navigator.clipboard.writeText(window.location.href); alert('Short link copied to clipboard!');" class="bg-dark-800/90 hover:bg-dark-700 text-white w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl border border-dark-600 cursor-pointer transition transform active:scale-90"><i class="fa-solid fa-share text-emerald-400 text-base"></i><span class="text-[9px] font-bold mt-0.5">Share</span></button>
                </div>
            `;
            const videoEl = slide.querySelector('video');
            slide.addEventListener('click', () => videoEl.paused ? videoEl.play() : videoEl.pause());
            container.appendChild(slide);
        });
    });
}

function likeShort(id, currentLikes) {
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
}

// --- EXTERNAL PUBLIC PROFILE VIEW ---
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
        document.getElementById('extProfileSubs').innerText = `${user.subs || 0} Subscribers`;
        
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
                if (localStorage.getItem(`subscribed_${currentUser.email}_${user.email}`)) {
                    localStorage.removeItem(`subscribed_${currentUser.email}_${user.email}`);
                    subBtn.innerText = 'Subscribe';
                    subBtn.className = 'bg-white text-dark-900 font-bold px-4 py-2 rounded-2xl text-xs hover:bg-gray-200 transition cursor-pointer shadow';
                    alert('Unsubscribed successfully.');
                } else {
                    localStorage.setItem(`subscribed_${currentUser.email}_${user.email}`, 'true');
                    subBtn.innerText = 'Subscribed ✓';
                    subBtn.className = 'bg-dark-700 text-gray-300 font-bold px-4 py-2 rounded-2xl text-xs cursor-default shadow';
                    alert(`Successfully subscribed to ${user.name}!`);
                }
            };
        }

        document.getElementById('extMessageBtn').onclick = () => openChatWithUser(user.email);

        db.collection("videos").where("creatorEmail", "==", user.email).get().then((vSnapshot) => {
            const vGrid = document.getElementById('extUserVideosGrid');
            if (!vGrid) return;
            vGrid.innerHTML = '';
            if (vSnapshot.empty) {
                vGrid.innerHTML = `<p class="text-gray-500 text-xs col-span-full">No videos uploaded by this creator.</p>`;
                return;
            }
            vSnapshot.forEach(vDoc => {
                const v = vDoc.data();
                const card = document.createElement('div');
                card.className = 'bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden p-2.5 flex space-x-2.5 cursor-pointer';
                card.innerHTML = `
                    <img src="${sanitizeHTML(v.thumbnailUrl || v.creatorAvatar)}" class="w-20 h-12 rounded-xl object-cover">
                    <div class="flex-1 truncate">
                        <h4 class="font-bold text-white text-[11px] truncate">${sanitizeHTML(v.title)}</h4>
                        <div class="text-[9px] text-gray-400 mt-1">${v.views || 0} views</div>
                    </div>
                `;
                card.onclick = () => openVideoModal({ id: vDoc.id, ...v });
                vGrid.appendChild(card);
            });
        });
    });
}

// --- VIDEO MODAL & GLOBAL ADS ---
function openVideoModal(video) {
    activeVideo = video;
    const modal = document.getElementById('videoModal');
    const adOverlay = document.getElementById('adMobAdOverlay');
    const player = document.getElementById('modalVideoPlayer');

    document.getElementById('modalVideoTitle').innerText = video.title;
    document.getElementById('modalCreatorName').innerText = video.creatorName;
    document.getElementById('modalCreatorAvatar').src = video.creatorAvatar;
    document.getElementById('modalLikeCount').innerText = video.likes || 0;
    document.getElementById('modalCreatorSubs').innerText = `100 subscribers`;

    const creatorClick = document.getElementById('modalCreatorProfileClick');
    if (creatorClick) {
        creatorClick.onclick = () => {
            modal.classList.add('hidden');
            player.pause();
            openExternalProfile(video.creatorEmail);
        };
    }

    player.src = video.videoUrl;
    renderComments(video);
    renderRelatedVideos(video);
    modal.classList.remove('hidden');

    db.collection("global_ads").get().then((adSnap) => {
        if (!adSnap.empty) {
            const adData = adSnap.docs[0].data();
            adOverlay.classList.remove('hidden');
            let timeLeft = 5;
            const timerText = document.getElementById('adTimerText');
            const skipBtn = document.getElementById('skipAdBtn');
            skipBtn.disabled = true;
            skipBtn.className = 'bg-dark-700 text-gray-400 px-5 py-2 rounded-2xl font-semibold transition cursor-not-allowed text-[11px]';

            const adCountdown = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    timerText.innerText = `Sponsored Ad playing... ${timeLeft}s`;
                } else {
                    clearInterval(adCountdown);
                    timerText.innerText = adData.title || 'Sponsored Ad completed!';
                    skipBtn.disabled = false;
                    skipBtn.className = 'bg-brand-cyan text-dark-900 px-5 py-2 rounded-2xl font-bold hover:bg-cyan-400 transition cursor-pointer text-[11px]';
                }
            }, 1000);

            skipBtn.onclick = () => {
                adOverlay.classList.add('hidden');
                player.play();
                
                const viewKey = `viewed_video_${video.id}`;
                if (!sessionStorage.getItem(viewKey)) {
                    sessionStorage.setItem(viewKey, 'true');
                    incrementVideoView(video.id, video.views || 0);
                }
            };
        } else {
            adOverlay.classList.add('hidden');
            player.play();
            const viewKey = `viewed_video_${video.id}`;
            if (!sessionStorage.getItem(viewKey)) {
                sessionStorage.setItem(viewKey, 'true');
                incrementVideoView(video.id, video.views || 0);
            }
        }
    });

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
            document.getElementById('modalLikeCount').innerText = newLikes;
            alert('Video liked successfully!');
        });
    };

    const subscribeBtn = document.getElementById('modalSubscribeBtn');
    subscribeBtn.onclick = () => {
        if (!currentUser) {
            alert('Please login to subscribe!');
            return;
        }
        const userSubKey = `subscribed_${currentUser.email}_${video.creatorEmail}`;
        if (localStorage.getItem(userSubKey)) {
            alert('You are already subscribed to this creator!');
            return;
        }

        localStorage.setItem(userSubKey, 'true');
        subscribeBtn.innerText = 'Subscribed ✓';
        subscribeBtn.className = 'bg-dark-700 text-gray-300 px-4 py-2 rounded-full font-bold text-xs cursor-default';
        alert(`Successfully subscribed to ${video.creatorName}!`);
    };
}

function incrementVideoView(id, currentViews) {
    db.collection("videos").doc(id).update({
        views: currentViews + 1
    });
}

function renderComments(video) {
    const list = document.getElementById('commentsList');
    const badge = document.getElementById('commentCountBadge');
    if (!list) return;
    list.innerHTML = '';
    const comments = video.comments || [];
    badge.innerText = comments.length;

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
                        <div class="text-[8px] text-gray-500">${video.views || 0} views</div>
                    </div>
                `;
                card.addEventListener('click', () => openVideoModal(video));
                sidebar.appendChild(card);
            }
        });
    });
}

// --- MESSENGER CHAT (Direct Profile to Chat Fix) ---
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
                        <p class="text-[10px] text-gray-400">${user.subs || 0} subscribers</p>
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

function loadMessengerContacts() {
    db.collection("users").get().then((snapshot) => {
        const container = document.getElementById('chatContactsList');
        if (!container) return;
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (currentUser && user.email === currentUser.email) return;
            const item = document.createElement('div');
            item.className = 'p-2 flex items-center justify-center hover:bg-[#202c33] cursor-pointer transition border-b border-dark-700/30';
            item.innerHTML = `
                <img src="${sanitizeHTML(user.avatar)}" class="w-9 h-9 rounded-full object-cover border border-emerald-500/40" title="${sanitizeHTML(user.name)}">
            `;
            item.onclick = () => selectActiveChatContact(user);
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

// --- NOTIFICATION SYSTEM ---
function loadNotifications() {
    const notifBadge = document.getElementById('notifBadge');
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (!notifBadge || !notificationsBtn) return;

    db.collection("notifications").orderBy("date", "desc").onSnapshot((snapshot) => {
        if (!snapshot.empty) {
            notifBadge.innerText = snapshot.size;
            notifBadge.classList.remove('hidden');
        }
    });

    notificationsBtn.onclick = () => {
        alert('You have secure system notifications and creator updates.');
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

// --- EVENT LISTENERS & CLOUDINARY UPLOAD ---
function setupEventListeners() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                alert('Please login with Google to upload videos!');
                return;
            }
            const title = sanitizeHTML(document.getElementById('videoTitle').value);
            const category = sanitizeHTML(document.getElementById('videoCategory').value);
            const aspectRatio = sanitizeHTML(document.getElementById('videoAspectRatio').value);
            const videoFile = document.getElementById('videoFile').files[0];
            const thumbFile = document.getElementById('thumbnailFile').files[0];

            if (!videoFile) {
                alert('Please select a video file.');
                return;
            }

            const submitBtn = uploadForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerText : 'Upload';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Uploading video to Cloudinary... 0%';
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
                    title, category, aspectRatio, videoUrl, thumbnailUrl,
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

            chatInput.value = '';
        };
        sendBtn.onclick = sendAction;
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendAction(); };
    }

    const monetForm = document.getElementById('monetizationForm');
    if (monetForm) {
        monetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!currentUser) {
                alert('Please login first.');
                return;
            }
            const channelName = sanitizeHTML(document.getElementById('monetChannelName').value);
            const email = sanitizeHTML(document.getElementById('monetEmail').value);
            const payoutMethod = sanitizeHTML(document.getElementById('payoutMethodSelect').value);
            const payoutInfo = sanitizeHTML(document.getElementById('payoutAccountInfo').value);

            db.collection("monetization_requests").add({
                channelName, email, payoutMethod, payoutInfo,
                status: 'Pending',
                date: new Date().toISOString().split('T')[0]
            }).then(() => {
                alert('Monetization & Payout request submitted successfully!');
                monetForm.reset();
            });
        });
    }

    const closeModal = () => {
        document.getElementById('videoModal').classList.add('hidden');
        document.getElementById('modalVideoPlayer').pause();
    };
    const closeMob = document.getElementById('closeVideoModalMobile');
    const closeDesk = document.getElementById('closeVideoModalDesktop');
    if (closeMob) closeMob.onclick = closeModal;
    if (closeDesk) closeDesk.onclick = closeModal;

    const toggleCommentsHeader = document.getElementById('toggleCommentsHeader');
    const commentsSectionBody = document.getElementById('commentsSectionBody');
    const commentToggleIcon = document.getElementById('commentToggleIcon');
    if (toggleCommentsHeader) {
        toggleCommentsHeader.onclick = () => {
            commentsSectionBody.classList.toggle('hidden');
            commentToggleIcon.classList.toggle('rotate-180');
        };
    }

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

// --- PROFILE & ANALYTICS ---
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
                        <span><i class="fa-solid fa-eye text-brand-cyan"></i> ${v.views || 0}</span>
                        <span><i class="fa-solid fa-thumbs-up text-brand-red"></i> ${v.likes || 0}</span>
                    </div>
                </div>
            `;
        });

        document.getElementById('analyticTotalViews').innerText = totalViews.toLocaleString();
        document.getElementById('analyticTotalLikes').innerText = totalLikes.toLocaleString();
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
        document.getElementById('profileSubCount').innerText = `${freshUser.subs || 0} Subs`;
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
        const myGrid = document.getElementById('myUploadedVideosGrid');
        if (!myGrid) return;
        myGrid.innerHTML = '';

        if (snapshot.empty) {
            myGrid.innerHTML = `<p class="text-gray-500 text-[11px] col-span-full">You haven't uploaded any videos yet.</p>`;
            return;
        }

        snapshot.forEach(doc => {
            const v = doc.data();
            myGrid.innerHTML += `
                <div class="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden p-3 flex items-center justify-between">
                    <div class="flex items-center space-x-2.5 truncate">
                        <img src="${sanitizeHTML(v.thumbnailUrl || v.creatorAvatar)}" class="w-16 h-10 rounded-xl object-cover">
                        <div class="truncate">
                            <h4 class="font-bold text-white text-[11px] truncate">${sanitizeHTML(v.title)}</h4>
                            <div class="text-[9px] text-gray-400 mt-0.5">${v.views || 0} views • ${v.likes || 0} likes</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <button onclick="openEditVideoModal('${doc.id}', '${sanitizeHTML(v.title)}')" class="bg-brand-cyan/20 text-brand-cyan px-2.5 py-1 rounded-xl text-[10px] font-semibold cursor-pointer hover:bg-brand-cyan/30">Edit</button>
                        <button onclick="deleteUserVideo('${doc.id}')" class="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-xl text-[10px] font-semibold cursor-pointer hover:bg-red-500/30">Delete</button>
                    </div>
                </div>
            `;
        });
    });
    }
