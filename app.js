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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = { name: 'Guest User', email: 'guest@zynqra.com', avatar: 'https://picsum.photos/seed/guest/100/100', subs: 0, strikes: 0, verified: false, lastProfileUpdate: 0 };
let activeVideo = null;
let activeChatContact = null;
let globalAllVideos = [];

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
    setupGoogleAuth();
    initializeAppUI();
    setupNavigation();
    loadHomeFeed();
    loadShortsFeed();
    loadFriendsList();
    loadMessengerContacts();
    setupSearchEngine();
    setupOfflineDownloadsUI();
    setupProfileEditModal();
    setupEventListeners();
    loadNotifications();
});

// --- Google Authentication ---
function setupGoogleAuth() {
    const loginBtn = document.getElementById('googleLoginBtn');
    if (loginBtn) {
        loginBtn.onclick = () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).then((result) => {
                const user = result.user;
                currentUser = {
                    name: sanitizeHTML(user.displayName),
                    email: sanitizeHTML(user.email),
                    avatar: sanitizeHTML(user.photoURL),
                    subs: 0,
                    strikes: 0,
                    verified: false,
                    lastProfileUpdate: 0
                };
                db.collection("users").doc(user.email).set(currentUser, { merge: true });
                initializeAppUI();
                alert('Successfully Logged in with Google!');
            }).catch((error) => {
                alert('Login Failed: ' + sanitizeHTML(error.message));
            });
        };
    }
}

// --- UI INITIALIZATION & NAVIGATION ---
function initializeAppUI() {
    if (currentUser && currentUser.email !== 'guest@zynqra.com') {
        const authContainer = document.getElementById('authContainer');
        if (authContainer) {
            authContainer.innerHTML = `
                <div id="userProfileHeader" class="flex items-center space-x-2 cursor-pointer relative" onclick="switchPage('profile')">
                    <img src="${sanitizeHTML(currentUser.avatar)}" alt="Profile" class="w-8 h-8 rounded-full object-cover border border-brand-cyan shadow-sm">
                </div>
            `;
        }
    }
    if (currentUser && currentUser.email === 'admin@zynqra.com') {
        const adminLink = document.getElementById('adminPanelLink');
        if (adminLink) adminLink.classList.remove('hidden');
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            if (page) switchPage(page);
        });
    });

    document.getElementById('hamburgerBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('-translate-x-full');
    });

    document.getElementById('logoHome').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('home');
    });
}

function switchPage(pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
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
            card.innerHTML = `
                <div class="relative aspect-video bg-black overflow-hidden">
                    <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
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
                    suggestionBox.innerHTML = `<div class="p-3 text-gray-400 text-xs">No matching videos found</div>`;
                } else {
                    matchedVideos.slice(0, 5).forEach(video => {
                        const item = document.createElement('div');
                        item.className = 'p-2.5 flex items-center space-x-3 hover:bg-dark-700 cursor-pointer border-b border-dark-700/50';
                        item.innerHTML = `
                            <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-12 h-8 object-cover rounded-lg">
                            <div class="truncate">
                                <div class="font-bold text-white text-xs truncate">${sanitizeHTML(video.title)}</div>
                                <div class="text-[9px] text-gray-400">${sanitizeHTML(video.creatorName)}</div>
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
                        <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    </div>
                    <div class="p-3.5 flex space-x-3 flex-1">
                        <img src="${sanitizeHTML(video.creatorAvatar)}" class="w-8 h-8 rounded-full object-cover border border-dark-600">
                        <div class="flex-1 space-y-1">
                            <h3 class="font-bold text-white text-xs line-clamp-2">${sanitizeHTML(video.title)}</h3>
                            <p class="text-[9px] text-gray-500">${video.views || 0} views</p>
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
                <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-full h-full object-cover">
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
            <img src="${sanitizeHTML(short.thumbnailUrl)}" class="w-full h-full object-cover group-hover:scale-105 transition">
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
                        <span class="bg-amber-400 text-dark-900 font-bold text-[9px] px-2.5 py-0.5 rounded-full">Zynqra Short</span>
                    </div>
                    <div class="space-y-2 pointer-events-auto">
                        <div class="flex items-center space-x-2">
                            <img src="${sanitizeHTML(short.creatorAvatar)}" class="w-8 h-8 rounded-full border border-white">
                            <span class="font-bold text-white text-xs">${sanitizeHTML(short.creatorName)}</span>
                        </div>
                        <p class="text-[11px] text-gray-200 line-clamp-2">${sanitizeHTML(short.title)}</p>
                    </div>
                </div>
                <div class="absolute right-3 bottom-16 flex flex-col items-center space-y-4 pointer-events-auto">
                    <button onclick="likeShort('${short.id}', ${short.likes || 0})" class="bg-dark-800/80 hover:bg-dark-700 text-white w-10 h-10 rounded-full flex flex-col items-center justify-center shadow"><i class="fa-solid fa-heart text-brand-red"></i><span class="text-[8px]">${short.likes || 0}</span></button>
                </div>
            `;
            const videoEl = slide.querySelector('video');
            slide.addEventListener('click', () => videoEl.paused ? videoEl.play() : videoEl.pause());
            container.appendChild(slide);
        });
    });
}

function likeShort(id, currentLikes) {
    if (!currentUser || currentUser.email === 'guest@zynqra.com') {
        alert('Please login to like shorts!');
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

// --- VIDEO MODAL, SECURE LIKES, SUBSCRIPTIONS & ANTI-BOT VIEWS ---
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

    player.src = video.videoUrl;
    renderComments(video);
    renderRelatedVideos(video);
    modal.classList.remove('hidden');

    adOverlay.classList.remove('hidden');
    let timeLeft = 5;
    const timerText = document.getElementById('adTimerText');
    const skipBtn = document.getElementById('skipAdBtn');
    skipBtn.disabled = true;
    skipBtn.className = 'bg-dark-700 text-gray-400 px-5 py-2 rounded-2xl font-semibold transition cursor-not-allowed text-[11px]';

    const adCountdown = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerText.innerText = `Ad playing... ${timeLeft}s`;
        } else {
            clearInterval(adCountdown);
            timerText.innerText = 'Ad completed!';
            skipBtn.disabled = false;
            skipBtn.className = 'bg-brand-cyan text-dark-900 px-5 py-2 rounded-2xl font-bold hover:bg-cyan-400 transition cursor-pointer text-[11px]';
        }
    }, 1000);

    skipBtn.onclick = () => {
        adOverlay.classList.add('hidden');
        player.play();
        
        // Anti-Bot View Protection (সেশনে একবারই ভিউ কাউন্ট হবে)
        const viewKey = `viewed_video_${video.id}`;
        if (!sessionStorage.getItem(viewKey)) {
            sessionStorage.setItem(viewKey, 'true');
            incrementVideoView(video.id, video.views || 0);
        }
    };

    // এক লাইক রেস্ট্রিকশন লজিক
    const likeBtn = document.getElementById('modalLikeBtn');
    likeBtn.onclick = () => {
        if (!currentUser || currentUser.email === 'guest@zynqra.com') {
            alert('Please login to like videos!');
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

    // এক সাবস্ক্রাইব রেস্ট্রিকশন লজিক
    const subscribeBtn = document.getElementById('modalSubscribeBtn');
    subscribeBtn.onclick = () => {
        if (!currentUser || currentUser.email === 'guest@zynqra.com') {
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
                    <img src="${sanitizeHTML(video.thumbnailUrl)}" class="w-28 aspect-video object-cover rounded-xl border border-dark-700 group-hover:border-brand-cyan transition">
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

// --- CHAT & MESSENGER ---
function loadFriendsList() {
    db.collection("users").get().then((snapshot) => {
        const container = document.getElementById('friendsListContainer');
        if (!container) return;
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (currentUser && user.email === currentUser.email) return;
            const card = document.createElement('div');
            card.className = 'bg-dark-800 border border-dark-700 p-3.5 rounded-2xl flex items-center justify-between shadow';
            card.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${sanitizeHTML(user.avatar)}" class="w-10 h-10 rounded-full object-cover border border-brand-cyan">
                    <div>
                        <h4 class="font-bold text-white text-xs">${sanitizeHTML(user.name)}</h4>
                        <p class="text-[10px] text-gray-400">${user.subs || 0} subscribers</p>
                    </div>
                </div>
                <button onclick="openChatWithUser('${sanitizeHTML(user.email)}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow">
                    <i class="fa-solid fa-message"></i> <span>Message</span>
                </button>
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
        <div class="flex items-center space-x-2.5">
            <img src="${sanitizeHTML(user.avatar)}" class="w-8 h-8 rounded-full object-cover">
            <div>
                <span class="font-bold text-white block text-xs">${sanitizeHTML(user.name)}</span>
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

    const chatId = [currentUser.email, activeChatContact.email].sort().join('_');
    db.collection("chats").doc(chatId).collection("messages").orderBy("timestamp").onSnapshot((snapshot) => {
        box.innerHTML = '';
        if (snapshot.empty) {
            box.innerHTML = `<div class="m-auto text-center text-gray-500 text-[10px] bg-[#182229] px-3 py-1.5 rounded-xl">No messages yet. Say hello!</div>`;
            return;
        }
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.sender === currentUser.email;
            const msgDiv = document.createElement('div');
            msgDiv.className = `flex ${isMe ? 'justify-end' : 'justify-start'} my-1`;
            msgDiv.innerHTML = `
                <div class="max-w-[75%] px-3.5 py-2 rounded-2xl text-xs shadow ${isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-gray-100 rounded-tl-none'}">
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

// --- PROFILE EDIT MODAL & 2 MONTHS NAME CHANGE RESTRICTION ---
function setupProfileEditModal() {
    const openBtn = document.getElementById('openEditModalBtn');
    const modal = document.getElementById('editProfileModal');
    const closeBtn = document.getElementById('closeEditModalBtn');
    const saveBtn = document.getElementById('saveProfileBtn');

    if (openBtn && modal) {
        openBtn.onclick = () => {
            document.getElementById('editNameInput').value = currentUser.name || '';
            document.getElementById('editBioInput').value = currentUser.bio || '';
            
            const lastUpdate = currentUser.lastProfileUpdate || 0;
            const twoMonthsInMillis = 60 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const warningEl = document.getElementById('nameChangeWarning');
            const nameInput = document.getElementById('editNameInput');

            if (now - lastUpdate < twoMonthsInMillis && lastUpdate !== 0) {
                nameInput.disabled = true;
                nameInput.classList.add('opacity-50', 'cursor-not-allowed');
                warningEl.classList.remove('hidden');
            } else {
                nameInput.disabled = false;
                nameInput.classList.remove('opacity-50', 'cursor-not-allowed');
                warningEl.classList.add('hidden');
            }

            modal.classList.remove('hidden');
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            const newName = sanitizeHTML(document.getElementById('editNameInput').value.trim());
            const newBio = sanitizeHTML(document.getElementById('editBioInput').value.trim());
            const imageFile = document.getElementById('profileImageFile').files[0];

            let avatarUrl = currentUser.avatar;
            alert('Updating profile...');

            if (imageFile) {
                const cloudName = "u078nis6"; //[span_1](start_span)[span_1](end_span)
                const uploadPreset = "zynqra_preset"; //
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

            const nameInput = document.getElementById('editNameInput');
            let updateData = { bio: newBio, avatar: avatarUrl };

            if (!nameInput.disabled && newName && newName !== currentUser.name) {
                updateData.name = newName;
                updateData.lastProfileUpdate = Date.now();
                currentUser.name = newName;
                currentUser.lastProfileUpdate = updateData.lastProfileUpdate;
            }

            currentUser.bio = newBio;
            currentUser.avatar = avatarUrl;

            await db.collection("users").doc(currentUser.email).set(updateData, { merge: true });
            
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

// --- EVENT LISTENERS & CLOUDINARY UPLOAD INTEGRATION ---
function setupEventListeners() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = sanitizeHTML(document.getElementById('videoTitle').value);
            const category = sanitizeHTML(document.getElementById('videoCategory').value);
            const aspectRatio = sanitizeHTML(document.getElementById('videoAspectRatio').value);
            const videoFile = document.getElementById('videoFile').files[0];
            const thumbFile = document.getElementById('thumbnailFile').files[0];

            if (!videoFile || !thumbFile) {
                alert('Please select both video and thumbnail files.');
                return;
            }

            alert('Uploading files to Cloudinary...');

            const cloudName = "u078nis6"; //[span_2](start_span)[span_2](end_span)
            const uploadPreset = "zynqra_preset"; //

            async function uploadToCloudinary(file, resourceType) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', uploadPreset);

                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.secure_url) {
                    return data.secure_url;
                } else {
                    throw new Error(data.error ? data.error.message : 'Upload failed');
                }
            }

            try {
                const videoUrl = await uploadToCloudinary(videoFile, 'video');
                const thumbnailUrl = await uploadToCloudinary(thumbFile, 'image');

                await db.collection("videos").add({
                    title, category, aspectRatio, videoUrl, thumbnailUrl,
                    creatorName: currentUser.name,
                    creatorEmail: currentUser.email,
                    creatorAvatar: currentUser.avatar,
                    likes: 0, views: 0,
                    date: new Date().toISOString().split('T')[0]
                });

                alert('Video successfully uploaded via Cloudinary & saved to Firebase!');
                uploadForm.reset();
                switchPage('home');
            } catch (error) {
                alert('Upload Error: ' + error.message);
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
    document.getElementById('closeVideoModalMobile').onclick = closeModal;
    document.getElementById('closeVideoModalDesktop').onclick = closeModal;

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

            const newComment = { user: currentUser.name, text: text, date: new Date().toISOString().split('T')[0] };
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
                <div class="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden p-2.5 flex space-x-2.5">
                    <img src="${sanitizeHTML(v.thumbnailUrl)}" class="w-20 h-12 rounded-xl object-cover">
                    <div class="flex-1 truncate">
                        <h4 class="font-bold text-white text-[11px] truncate">${sanitizeHTML(v.title)}</h4>
                        <div class="text-[9px] text-gray-400 mt-1">${v.views || 0} views • ${v.likes || 0} likes</div>
                    </div>
                </div>
            `;
        });
    });
}
