// Storefront Client Application with Bundles, Promo Codes, OTP Authentication, and Razorpay Checkout

let catalogEbooks = [];
let availableCategories = [];
let currentCategory = 'All';
let storeCurrency = '₹';

let heroSlides = [];
let bundleOffers = [];
let currentSlideIndex = 0;
let slideInterval = null;

let cart = JSON.parse(localStorage.getItem('ebookvault_cart') || '[]');
let cartAppliedCoupon = null;

let customerToken = localStorage.getItem('ebookvault_customer_token') || '';
let currentCustomer = JSON.parse(localStorage.getItem('ebookvault_customer_user') || 'null');
let pendingCheckoutAction = null;

document.addEventListener('DOMContentLoaded', async () => {
    updateAuthNavbar();
    updateCartBadge();
    await loadStoreInfo();
    await loadHeroSlides();
    await loadBundles();
    await loadEbooks();
    setupSearchListeners();
});

// --- Store & Hero Slides ---

async function loadStoreInfo() {
    try {
        const res = await fetch('/api/store-info');
        const data = await res.json();
        if (data.store_name) {
            document.getElementById('brandName').innerText = data.store_name;
            let c = data.currency || '₹';
            if (c.includes('100') || c.length > 3) c = '₹';
            storeCurrency = c;
        }

        // 1. Dynamic Top Announcement Bar
        const annBar = document.getElementById('topAnnouncementBar');
        if (annBar) {
            const isEnabled = (data.announcement_enabled !== false && data.announcement_enabled !== 'false');
            if (!isEnabled) {
                annBar.classList.add('hidden');
            } else {
                annBar.classList.remove('hidden');
                const annText = document.getElementById('announcementTextContent');
                if (annText) {
                    const text = data.announcement_text || '🎉 Welcome to QELVORIA: Premium Digital Publishing & Ebook Bundles.';
                    const coupon = data.announcement_coupon;
                    const link = data.announcement_link || '/#catalog';
                    
                    let couponHtml = '';
                    if (coupon && typeof coupon === 'string' && coupon.trim() !== '' && !text.includes(coupon.trim())) {
                        couponHtml = `<strong class="font-mono bg-white text-slate-950 font-bold px-1.5 py-0.5 rounded text-[11px] ml-1">${coupon.trim()}</strong>`;
                    }

                    annText.innerHTML = `
                        <a href="${link}" class="hover:underline flex items-center gap-1.5 flex-wrap justify-center text-xs font-semibold text-slate-200 hover:text-white transition">
                            <span>${text}</span>
                            ${couponHtml}
                        </a>
                    `;
                }
            }
        }

        // 2. Dynamic Social Media Accounts Section
        updateSocialLinksUI(data);

        // 3. Dynamic Chatbot Preset Queries
        if (data.chat_presets && Array.isArray(data.chat_presets)) {
            window.qelvoriaChatPresets = data.chat_presets;
            if (window.qelvoriaChat && window.qelvoriaChat.updatePresets) {
                window.qelvoriaChat.updatePresets(data.chat_presets);
            }
        }

    } catch (e) {
        console.error('Store info error', e);
    }
}

function updateSocialLinksUI(data) {
    const container = document.getElementById('socialLinksContainer');
    const section = document.getElementById('socialConnectSection');
    if (!container) return;

    const platforms = [
        { key: 'social_instagram', label: 'Instagram', icon: 'instagram', colorClass: 'text-pink-400', url: data.social_instagram },
        { key: 'social_youtube', label: 'YouTube', icon: 'youtube', colorClass: 'text-rose-400', url: data.social_youtube },
        { key: 'social_twitter', label: 'X (Twitter)', icon: 'twitter', colorClass: 'text-slate-300', url: data.social_twitter },
        { key: 'social_linkedin', label: 'LinkedIn', icon: 'linkedin', colorClass: 'text-blue-400', url: data.social_linkedin },
        { key: 'social_facebook', label: 'Facebook', icon: 'facebook', colorClass: 'text-blue-500', url: data.social_facebook },
        { key: 'social_telegram', label: 'Telegram', icon: 'send', colorClass: 'text-sky-400', url: data.social_telegram },
        { key: 'social_whatsapp', label: 'WhatsApp Support', icon: 'message-circle', colorClass: 'text-emerald-400', url: data.social_whatsapp }
    ];

    const activePlatforms = platforms.filter(p => p.url && typeof p.url === 'string' && p.url.trim() !== '');

    if (activePlatforms.length === 0) {
        if (section) section.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    if (section) section.classList.remove('hidden');

    container.innerHTML = activePlatforms.map(p => `
        <a 
            href="${p.url}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-2xl text-xs font-bold text-slate-200 hover:text-white transition shadow-sm"
        >
            <i data-lucide="${p.icon}" class="w-4 h-4 ${p.colorClass}"></i>
            <span>${p.label}</span>
        </a>
    `).join('');

    lucide.createIcons();
}

async function loadHeroSlides() {
    try {
        const res = await fetch('/api/hero-slides?_t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        heroSlides = data.slides || [];
        if (heroSlides.length > 0) {
            renderHeroSlider();
            startHeroAutoPlay();
        }
    } catch (e) {
        console.error('Hero slides load error', e);
    }
}

function renderHeroSlider() {
    const bannerContainer = document.getElementById('heroBannerSlide');
    const dotsContainer = document.getElementById('heroDots');
    if (!bannerContainer || !dotsContainer || heroSlides.length === 0) return;

    const slide = heroSlides[currentSlideIndex];
    if (!slide) return;

    bannerContainer.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div class="lg:col-span-7 space-y-4 sm:space-y-6 text-left">
                ${slide.badge_text ? `
                    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-300 shadow-sm">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>${slide.badge_text}</span>
                    </div>
                ` : ''}

                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                    ${slide.title}
                </h1>

                <p class="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
                    ${slide.subtitle}
                </p>

                <div class="flex flex-wrap items-center gap-3.5 pt-2">
                    <a href="${slide.cta_url || '#bestsellers'}" class="px-7 py-3.5 bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center gap-2 transform active:scale-95">
                        <span>${slide.cta_text || 'Explore Collection'}</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                    <a href="#catalog" class="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-800 transition">
                        View All Books
                    </a>
                </div>
            </div>

            <div class="lg:col-span-5 flex justify-center">
                <div class="relative w-full max-w-xs sm:max-w-md lg:max-w-none rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900">
                    <!-- Desktop Banner (1400x520 aspect) -->
                    <img 
                        src="${slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" 
                        alt="${slide.title}" 
                        class="hidden sm:block w-full h-64 sm:h-72 lg:h-80 object-cover hover:scale-105 transition-transform duration-500"
                    >
                    <!-- Mobile Banner (375x600 aspect) -->
                    <img 
                        src="${slide.mobile_image || slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" 
                        alt="${slide.title}" 
                        class="block sm:hidden w-full h-60 object-cover"
                    >
                </div>
            </div>
        </div>
    `;

    dotsContainer.innerHTML = heroSlides.map((_, i) => `
        <button onclick="goToHeroSlide(${i})" class="w-2.5 h-2.5 rounded-full transition ${i === currentSlideIndex ? 'bg-white w-6' : 'bg-slate-700 hover:bg-slate-600'}" title="Slide ${i + 1}"></button>
    `).join('');

    lucide.createIcons();
}

function nextHeroSlide() {
    if (heroSlides.length === 0) return;
    currentSlideIndex = (currentSlideIndex + 1) % heroSlides.length;
    renderHeroSlider();
}

function prevHeroSlide() {
    if (heroSlides.length === 0) return;
    currentSlideIndex = (currentSlideIndex - 1 + heroSlides.length) % heroSlides.length;
    renderHeroSlider();
}

function goToHeroSlide(idx) {
    currentSlideIndex = idx;
    renderHeroSlider();
}

function startHeroAutoPlay() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(nextHeroSlide, 6000);
}

// --- Special Bundle Deals ---

async function loadBundles() {
    try {
        const res = await fetch('/api/bundles?_t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        bundleOffers = data.bundles || [];
        renderBundles();
    } catch (e) {
        console.error('Bundles load error', e);
    }
}

function renderBundles() {
    const section = document.getElementById('bundles');
    const grid = document.getElementById('bundlesGrid');
    if (!grid) return;

    if (bundleOffers.length === 0) {
        if (section) section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }

    if (section) section.classList.remove('hidden');

    grid.innerHTML = bundleOffers.map(bundle => `
        <div class="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 hover:border-slate-600 shadow-xl transition flex flex-col justify-between group">
            <div>
                <div class="flex items-center justify-between gap-2 mb-4">
                    <span class="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                        ${bundle.badge_text || 'BUNDLE PACK'}
                    </span>
                    <span class="text-xs text-emerald-400 font-bold">
                        Save ₹${(bundle.price - bundle.sale_price).toFixed(2)}!
                    </span>
                </div>

                <h3 class="text-xl sm:text-2xl font-extrabold text-white leading-snug group-hover:text-slate-300 transition">
                    ${bundle.title}
                </h3>
                <p class="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                    ${bundle.description || ''}
                </p>

                <!-- Books Included Inside Bundle -->
                <div class="mt-6 space-y-2">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Includes ${bundle.books.length} Best-Selling Guides:</div>
                    ${bundle.books.map(b => `
                        <div class="flex items-center gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                            <img src="${b.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-8 h-11 object-cover rounded-md flex-shrink-0">
                            <div class="flex-1 truncate">
                                <div class="font-bold text-slate-200 truncate">${b.title}</div>
                                <div class="text-[10px] text-slate-500">By ${b.author}</div>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-800 text-slate-300">${(b.file_format || 'PDF').toUpperCase()}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span class="text-[11px] text-slate-400 font-bold block">Bundle Price</span>
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-extrabold text-white">₹${bundle.sale_price.toFixed(2)}</span>
                        <span class="text-sm text-slate-500 line-through">₹${bundle.price.toFixed(2)}</span>
                    </div>
                </div>

                <button 
                    onclick="handleBuyBundleClick(${bundle.id})" 
                    class="px-6 py-3.5 bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                    <i data-lucide="zap" class="w-4 h-4"></i>
                    <span>Get Bundle Now (₹${bundle.sale_price.toFixed(2)})</span>
                </button>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

// --- Ebook Catalog ---

async function loadEbooks() {
    try {
        const res = await fetch('/api/ebooks?_t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        catalogEbooks = data.ebooks || [];
        availableCategories = data.categories || [];

        // Auto-sync cart items with latest catalog prices
        if (cart && cart.length > 0 && catalogEbooks.length > 0) {
            cart = cart.map(item => {
                const fresh = catalogEbooks.find(b => String(b.id) === String(item.id) || Number(b.id) === Number(item.id));
                if (fresh) {
                    const freshPrice = (fresh.sale_price && fresh.sale_price > 0 && fresh.sale_price < fresh.price) ? fresh.sale_price : fresh.price;
                    return {
                        ...item,
                        title: fresh.title,
                        author: fresh.author,
                        price: freshPrice,
                        cover: fresh.cover_image || item.cover,
                        cover_image: fresh.cover_image || item.cover_image
                    };
                }
                return item;
            });
            saveCart();
            renderCartDrawer();
        }

        renderBestSellers();
        renderCategories();
        renderCatalog();
    } catch (e) {
        console.error('Catalog error', e);
    }
}

function renderBestSellers() {
    const section = document.getElementById('bestsellers');
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    // Only show Best Sellers section if there are multiple books and at least one is explicitly marked as featured
    const featured = catalogEbooks.filter(b => b.is_featured);
    if (catalogEbooks.length <= 1 || featured.length === 0) {
        if (section) section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }

    if (section) section.classList.remove('hidden');

    grid.innerHTML = featured.slice(0, 4).map((book, idx) => {
        const format = (book.file_format || 'pdf').toUpperCase();
        const price = (book.sale_price && book.sale_price > 0 && book.sale_price < book.price) ? book.sale_price : book.price;
        const hasDiscount = book.sale_price && book.sale_price < book.price;
        const inCart = cart.some(item => item.id === book.id);

        return `
            <div class="bg-slate-950 rounded-3xl p-5 border border-slate-800 hover:border-slate-600 hover:shadow-2xl transition duration-200 flex flex-col justify-between group">
                <div>
                    <a href="/book.html?id=${book.id}" class="block relative overflow-hidden rounded-2xl mb-4 bg-slate-900 aspect-[3/4] shadow-sm">
                        <img src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${book.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-slate-900/90 text-white backdrop-blur-sm">
                                #${idx + 1} Best Seller
                            </span>
                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-white text-slate-950">
                                ${format}
                            </span>
                        </div>
                    </a>

                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">${book.category || 'General'}</div>
                    <a href="/book.html?id=${book.id}" class="block font-bold text-white text-sm leading-snug line-clamp-2 hover:text-slate-300 transition">
                        ${book.title}
                    </a>
                    <p class="text-xs text-slate-400 mt-1">By ${book.author}</p>
                </div>

                <div class="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-lg font-extrabold text-white">${storeCurrency}${price.toFixed(2)}</span>
                            ${hasDiscount ? `<span class="text-xs text-slate-500 line-through">${storeCurrency}${book.price.toFixed(2)}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-emerald-400 font-semibold mt-0.5">Instant Access</div>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button onclick="toggleAddToCart(${book.id})" class="p-2.5 ${inCart ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'} border border-slate-700 rounded-xl transition" title="Add to Cart">
                            <i data-lucide="${inCart ? 'check' : 'shopping-cart'}" class="w-4 h-4"></i>
                        </button>
                        <a href="/book.html?id=${book.id}" class="px-3.5 py-2.5 bg-white hover:bg-slate-200 text-slate-950 text-xs font-extrabold rounded-xl shadow transition flex items-center gap-1">
                            <span>Details</span>
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderCategories() {
    const pills = document.getElementById('categoryPills');
    let html = `
        <button onclick="filterCategory('All')" class="category-pill ${currentCategory === 'All' ? 'bg-white text-slate-950 font-bold shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
            All Categories
        </button>
    `;
    availableCategories.forEach(cat => {
        const active = currentCategory === cat;
        html += `
            <button onclick="filterCategory('${cat}')" class="category-pill ${active ? 'bg-white text-slate-950 font-bold shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
                ${cat}
            </button>
        `;
    });
    pills.innerHTML = html;
}

function filterCategory(cat) {
    currentCategory = cat;
    renderCategories();
    renderCatalog();
}

function renderCatalog() {
    const grid = document.getElementById('ebooksGrid');
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    let filtered = catalogEbooks.filter(book => {
        const matchCat = (currentCategory === 'All' || book.category === currentCategory);
        const matchSearch = !searchVal || 
            book.title.toLowerCase().includes(searchVal) || 
            book.author.toLowerCase().includes(searchVal) || 
            (book.file_format && book.file_format.toLowerCase().includes(searchVal)) ||
            (book.description && book.description.toLowerCase().includes(searchVal));
        return matchCat && matchSearch;
    });

    document.getElementById('catalogCount').innerText = `Showing ${filtered.length} of ${catalogEbooks.length} ebooks`;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-16 text-center text-slate-500">
                <i data-lucide="book-x" class="w-12 h-12 mx-auto mb-3 text-slate-600"></i>
                <p class="font-bold text-slate-300 text-base">No matching ebooks found</p>
                <p class="text-xs text-slate-500 mt-1">Try searching another topic or clearing your filter.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = filtered.map(book => {
        const format = (book.file_format || 'pdf').toUpperCase();
        const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
        const hasDiscount = book.sale_price && book.sale_price < book.price;
        const inCart = cart.some(item => item.id === book.id);

        return `
            <div class="bg-slate-900 rounded-3xl p-5 border border-slate-800 hover:border-slate-600 hover:shadow-2xl transition duration-200 flex flex-col justify-between group">
                <div>
                    <a href="/book.html?id=${book.id}" class="block relative overflow-hidden rounded-2xl mb-4 bg-slate-950 aspect-[3/4]">
                        <img src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${book.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy">
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-white text-slate-950">${format}</span>
                            ${hasDiscount ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-600 text-white shadow-sm">SALE</span>` : ''}
                        </div>
                    </a>

                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">${book.category || 'General'}</div>
                    <a href="/book.html?id=${book.id}" class="block font-bold text-white text-base leading-snug line-clamp-2 hover:text-slate-300 transition">
                        ${book.title}
                    </a>
                    <p class="text-xs text-slate-400 mt-1">By ${book.author}</p>
                    <p class="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">${book.description || ''}</p>
                </div>

                <div class="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-xl font-extrabold text-white">${storeCurrency}${price.toFixed(2)}</span>
                            ${hasDiscount ? `<span class="text-xs text-slate-500 line-through">${storeCurrency}${book.price.toFixed(2)}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                            <i data-lucide="zap" class="w-3 h-3"></i>
                            <span>Email + WhatsApp</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button onclick="toggleAddToCart(${book.id})" class="p-2.5 ${inCart ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'} border border-slate-800 rounded-xl transition" title="Add to Cart">
                            <i data-lucide="${inCart ? 'check' : 'shopping-cart'}" class="w-4 h-4"></i>
                        </button>
                        <a href="/book.html?id=${book.id}" class="px-3.5 py-2.5 bg-white hover:bg-slate-200 text-slate-950 text-xs font-extrabold rounded-xl shadow transition flex items-center gap-1">
                            <span>Details</span>
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function setupSearchListeners() {
    const input = document.getElementById('searchInput');
    if (input) {
        // Handle URL search parameter if passed from product page
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('q');
        if (queryParam) {
            input.value = queryParam;
            renderCatalog();
            setTimeout(() => {
                const cat = document.getElementById('catalog');
                if (cat) cat.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }

        input.addEventListener('input', () => {
            renderCatalog();
            const cat = document.getElementById('catalog');
            if (cat && input.value.trim().length > 0) {
                cat.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// --- Cart System & Promo Codes ---

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const mobBadge = document.getElementById('mobileCartBadge');
    if (cart.length > 0) {
        if (badge) {
            badge.innerText = cart.length;
            badge.classList.remove('hidden');
        }
        if (mobBadge) {
            mobBadge.innerText = cart.length;
            mobBadge.classList.remove('hidden');
        }
    } else {
        if (badge) badge.classList.add('hidden');
        if (mobBadge) mobBadge.classList.add('hidden');
    }
}

function saveCart() {
    localStorage.setItem('ebookvault_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCatalog();
    renderBestSellers();
}

function removeFromCart(bookId) {
    const idStr = String(bookId);
    const idNum = Number(bookId);
    cart = cart.filter(item => String(item.id) !== idStr && Number(item.id) !== idNum);
    saveCart();
    renderCartDrawer();
}
window.removeFromCart = removeFromCart;
window.removeCartItem = removeFromCart;

function toggleAddToCart(bookId) {
    const idStr = String(bookId);
    const idNum = Number(bookId);
    const idx = cart.findIndex(item => String(item.id) === idStr || Number(item.id) === idNum);
    if (idx > -1) {
        cart.splice(idx, 1);
    } else {
        const book = catalogEbooks.find(b => String(b.id) === idStr || Number(b.id) === idNum);
        if (book) {
            const price = (book.sale_price && book.sale_price > 0 && book.sale_price < book.price) ? book.sale_price : book.price;
            cart.push({
                id: book.id,
                title: book.title,
                author: book.author,
                price: price,
                cover: book.cover_image,
                cover_image: book.cover_image,
                format: book.file_format
            });
        }
    }
    saveCart();
    renderCartDrawer();
}
window.toggleAddToCart = toggleAddToCart;

function openCartDrawer() {
    renderCartDrawer();
    document.getElementById('cartDrawer').classList.remove('hidden');
    lucide.createIcons();
}

function closeCartDrawer() {
    document.getElementById('cartDrawer').classList.add('hidden');
}

function renderCartDrawer() {
    const list = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotalAmount');
    if (!list || !totalEl) return;

    if (cart.length === 0) {
        list.innerHTML = `
            <div class="text-center py-16 text-slate-500">
                <i data-lucide="shopping-cart" class="w-12 h-12 mx-auto mb-3 text-slate-600"></i>
                <p class="font-bold text-slate-300 text-sm">Your cart is empty</p>
                <p class="text-xs text-slate-500 mt-1">Browse our bestsellers and bundles to add items.</p>
            </div>
        `;
        totalEl.innerText = `${storeCurrency}0.00`;
        const chkBtn = document.getElementById('cartCheckoutBtn');
        if (chkBtn) chkBtn.disabled = true;
        lucide.createIcons();
        return;
    }

    const chkBtn = document.getElementById('cartCheckoutBtn');
    if (chkBtn) chkBtn.disabled = false;
    
    let subtotal = cart.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
    let finalAmount = subtotal;

    if (cartAppliedCoupon) {
        finalAmount = cartAppliedCoupon.final_amount;
    }

    list.innerHTML = cart.map(item => `
        <div class="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <div class="flex items-center gap-3 truncate">
                <img src="${item.cover || item.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-16 object-cover rounded-lg border border-slate-800 shadow-sm flex-shrink-0">
                <div class="truncate">
                    <h4 class="font-bold text-xs text-white truncate">${item.title}</h4>
                    <div class="text-[11px] text-slate-500">By ${item.author || 'Author'}</div>
                    <div class="text-xs font-extrabold text-brand-400 mt-1">${storeCurrency}${Number(item.price).toFixed(2)}</div>
                </div>
            </div>
            <button onclick="removeFromCart('${item.id}')" class="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition" title="Remove from Cart">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');

    totalEl.innerText = `${storeCurrency}${finalAmount.toFixed(2)}`;
    lucide.createIcons();
}

async function applyCartCoupon() {
    const code = document.getElementById('cartCouponInput').value.trim();
    const status = document.getElementById('cartCouponStatus');
    const subtotal = cart.reduce((acc, item) => acc + item.price, 0);

    if (!code) return;

    try {
        const res = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, amount: subtotal })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            cartAppliedCoupon = data;
            status.innerHTML = `✅ Saved ₹${data.discount_amount.toFixed(2)} with <strong>${data.code}</strong>!`;
            status.className = 'text-[11px] text-emerald-400 block font-semibold';
            renderCartDrawer();
        } else {
            cartAppliedCoupon = null;
            status.innerText = `❌ ${data.detail || 'Invalid coupon'}`;
            status.className = 'text-[11px] text-rose-400 block';
            renderCartDrawer();
        }
    } catch (e) {
        console.error('Coupon error', e);
    }
}

let pendingAppContext = null;

function openCheckoutCustomerModal(context) {
    pendingAppContext = context;
    
    // Prefill from currentCustomer or localStorage
    const savedName = (currentCustomer && currentCustomer.name) || localStorage.getItem('qelvoria_cust_name') || '';
    const savedEmail = (currentCustomer && currentCustomer.email) || localStorage.getItem('qelvoria_cust_email') || '';
    const savedPhone = (currentCustomer && currentCustomer.phone) || localStorage.getItem('qelvoria_cust_phone') || '';
    
    const nameInput = document.getElementById('custCheckoutName');
    const emailInput = document.getElementById('custCheckoutEmail');
    const phoneInput = document.getElementById('custCheckoutPhone');
    
    if (nameInput) nameInput.value = savedName;
    if (emailInput) emailInput.value = savedEmail;
    if (phoneInput) phoneInput.value = savedPhone;
    
    const btnText = document.getElementById('proceedToPayBtnText');
    if (btnText) {
        btnText.innerText = `Proceed to Razorpay Payment`;
    }
    
    openModal('checkoutCustomerModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function handleProceedToPaymentWithDetails(e) {
    e.preventDefault();
    const name = document.getElementById('custCheckoutName').value.trim();
    const email = document.getElementById('custCheckoutEmail').value.trim().toLowerCase();
    const phone = document.getElementById('custCheckoutPhone').value.trim();

    if (!name || !email || !phone) {
        alert('Please fill in your name, email, and mobile number.');
        return;
    }

    currentCustomer = { name, email, phone };
    localStorage.setItem('qelvoria_customer', JSON.stringify(currentCustomer));
    localStorage.setItem('qelvoria_cust_name', name);
    localStorage.setItem('qelvoria_cust_email', email);
    localStorage.setItem('qelvoria_cust_phone', phone);

    closeModal('checkoutCustomerModal');

    if (pendingAppContext) {
        startRazorpayFlow(pendingAppContext);
    }
}

function proceedCartToCheckout() {
    if (cart.length === 0) return;
    closeCartDrawer();
    openCheckoutCustomerModal({
        mode: 'cart',
        ebookIds: cart.map(i => i.id),
        couponCode: cartAppliedCoupon ? cartAppliedCoupon.code : null
    });
}

// --- Bundle Purchase Flow ---

function handleBuyBundleClick(bundleId) {
    openCheckoutCustomerModal({ mode: 'bundle', bundleId: bundleId });
}

function handleDirectBookPurchase(ebookId) {
    openCheckoutCustomerModal({ mode: 'direct', ebookIds: [ebookId] });
}

// --- Standard Razorpay Flow ---

async function startRazorpayFlow(context) {

    try {
        const payload = {
            bundle_id: context.bundleId || null,
            ebook_ids: context.ebookIds || [],
            customer_name: currentCustomer.name || 'Valued Reader',
            customer_email: currentCustomer.email,
            customer_whatsapp: currentCustomer.phone || '',
            coupon_code: context.couponCode || null
        };

        const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let orderInfo;
        try {
            orderInfo = await res.json();
        } catch (parseErr) {
            alert('Server is syncing. Please click Buy again in a moment.');
            return;
        }

        if (!res.ok || !orderInfo.success) {
            alert(`⚠️ Checkout Notice: ${orderInfo.detail || orderInfo.message || 'Failed to initialize checkout.'}`);
            return;
        }

        const options = {
            key: orderInfo.key_id || 'rzp_live_TVwW1GpXBFloh7',
            amount: orderInfo.amount,
            currency: 'INR',
            name: 'QELVORIA',
            description: orderInfo.description,
            order_id: orderInfo.order_id,
            prefill: {
                name: currentCustomer.name || '',
                email: currentCustomer.email || '',
                contact: currentCustomer.phone || ''
            },
            theme: { color: '#6366f1' },
            modal: {
                ondismiss: function() {
                    console.log('Checkout window closed by customer.');
                }
            },
            handler: async function (response) {
                await verifyRazorpayFlow({
                    ...context,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                });
            }
        };

        if (typeof Razorpay !== 'undefined') {
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response) {
                console.error('Razorpay payment failed:', response.error);
                alert(`❌ Payment Failed: ${response.error.description || 'Transaction declined by bank.'}`);
            });
            rzp.open();
        } else {
            // Direct verification fallback if razorpay checkout.js script isn't loaded
            await verifyRazorpayFlow(context);
        }

    } catch (e) {
        console.error('Checkout error:', e);
        alert(`Checkout notice: ${e.message || 'Unable to proceed with checkout.'}`);
    }
}

async function verifyRazorpayFlow(context) {
    try {
        const payload = {
            bundle_id: context.bundleId || null,
            ebook_ids: context.ebookIds || [],
            customer_name: currentCustomer ? currentCustomer.name : 'Valued Reader',
            customer_email: currentCustomer ? currentCustomer.email : '',
            customer_whatsapp: currentCustomer ? currentCustomer.phone : '',
            coupon_code: context.couponCode || null,
            razorpay_payment_id: context.razorpay_payment_id || ('pay_' + Date.now()),
            razorpay_order_id: context.razorpay_order_id || null,
            razorpay_signature: context.razorpay_signature || null
        };

        const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) {
            alert(`❌ ${result.detail || 'Payment verification failed.'}`);
            return;
        }

        if (context.mode === 'cart') {
            cart = [];
            cartAppliedCoupon = null;
            saveCart();
        }

        showSuccessModal(result);
    } catch (e) {
        console.error('Verification error', e);
        alert('Error communicating with verification server.');
    }
}

function showSuccessModal(data) {
    document.getElementById('successCustomerGreeting').innerText = `Thank you, ${data.customer_name}! Your payment is verified.`;
    const list = document.getElementById('successOrdersListContainer');

    list.innerHTML = data.orders.map(o => `
        <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
                <div class="font-bold text-xs text-white">${o.ebook_title}</div>
                <div class="text-[10px] font-mono text-brand-400">${o.order_code}</div>
            </div>
            <a href="${o.download_url}" target="_blank" class="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg transition">Download</a>
        </div>
    `).join('');

    document.getElementById('successDirectDownloadBtn').href = data.orders[0].download_url;
    document.getElementById('successWhatsAppBtn').href = data.orders[0].whatsapp_url;
    openModal('orderSuccessModal');
}

// --- OTP Authentication Flow ---

function updateAuthNavbar() {
    const container = document.getElementById('authNavContainer');
    if (!container) return;

    if (currentCustomer) {
        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl hidden sm:inline">
                    👤 ${currentCustomer.name}
                </span>
                <button onclick="handleCustomerLogout()" class="px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-400 bg-slate-800 rounded-xl transition" title="Log Out">
                    <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button onclick="openUnifiedAuthModal()" class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-200 rounded-xl transition shadow-sm">
                <i data-lucide="user" class="w-3.5 h-3.5"></i>
                <span>Sign In</span>
            </button>
        `;
    }
    lucide.createIcons();
}

function openUnifiedAuthModal() {
    openModal('unifiedAuthModal');
}

function toggleEmailPasswordSection() {
    const el = document.getElementById('emailPasswordForm');
    el.classList.toggle('hidden');
}

async function handleSendOtp(e) {
    e.preventDefault();
    const phone = document.getElementById('otpPhoneInput').value.trim();
    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.innerText = 'Sending OTP...';

    try {
        const res = await fetch('/api/auth/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('otpPhoneForm').classList.add('hidden');
            document.getElementById('otpVerifyForm').classList.remove('hidden');
            document.getElementById('otpSentNotice').innerText = `OTP sent to ${phone}! (Code: ${data.otp_demo})`;
            if (data.otp_demo) {
                document.getElementById('otpCodeInput').value = data.otp_demo;
            }
        } else {
            alert(data.detail || 'Failed to send OTP.');
        }
    } catch (e) {
        console.error('OTP send error', e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Send 6-Digit OTP';
    }
}

async function handleVerifyOtp(e) {
    e.preventDefault();
    const phone = document.getElementById('otpPhoneInput').value.trim();
    const otp = document.getElementById('otpCodeInput').value.trim();

    try {
        const res = await fetch('/api/auth/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp_code: otp })
        });
        const data = await res.json();
        if (res.ok) {
            customerToken = data.token;
            currentCustomer = data.user;
            localStorage.setItem('qelvoria_customer_token', customerToken);
            localStorage.setItem('qelvoria_customer', JSON.stringify(currentCustomer));
            localStorage.setItem('ebookvault_customer_token', customerToken);
            localStorage.setItem('ebookvault_customer_user', JSON.stringify(currentCustomer));

            closeModal('unifiedAuthModal');
            updateAuthNavbar();
            if (pendingCheckoutAction) {
                const act = pendingCheckoutAction;
                pendingCheckoutAction = null;
                act();
            }
        } else {
            alert(data.detail || 'Invalid OTP code.');
        }
    } catch (e) {
        console.error('Verify error', e);
    }
}

async function handleUnifiedLoginSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('unifiedLoginInput').value.trim();
    const pw = document.getElementById('unifiedPasswordInput').value.trim();

    try {
        const res = await fetch('/api/auth/unified-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username_or_email: id, password: pw })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Invalid login.');
            return;
        }

        if (data.role === 'admin') {
            localStorage.setItem('qelvoria_admin_token', data.token);
            localStorage.setItem('ebookvault_admin_token', data.token);
            window.location.href = data.redirect || '/admin.html';
            return;
        }

        customerToken = data.token;
        currentCustomer = data.user;
        localStorage.setItem('qelvoria_customer_token', customerToken);
        localStorage.setItem('qelvoria_customer', JSON.stringify(currentCustomer));
        localStorage.setItem('ebookvault_customer_token', customerToken);
        localStorage.setItem('ebookvault_customer_user', JSON.stringify(currentCustomer));

        closeModal('unifiedAuthModal');
        updateAuthNavbar();
        if (pendingCheckoutAction) {
            const act = pendingCheckoutAction;
            pendingCheckoutAction = null;
            act();
        }
    } catch (e) {
        console.error('Login error', e);
    }
}

// --- Firebase Authentication Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyAxjODfrgNIP7_wijJlgc01uXTArdQUiLE",
    authDomain: "qelvoria-publishing.firebaseapp.com",
    projectId: "qelvoria-publishing",
    storageBucket: "qelvoria-publishing.firebasestorage.app",
    messagingSenderId: "331946961771",
    appId: "1:331946961771:web:e8bc939ec409de91183a2e",
    measurementId: "G-82XC8LWNZC"
};

let firebaseApp = null;
let firebaseAuth = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.app();
        }
        firebaseAuth = firebase.auth();

        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                currentCustomer = {
                    name: user.displayName || 'Valued Reader',
                    email: user.email,
                    phone: user.phoneNumber || localStorage.getItem('qelvoria_cust_phone') || ''
                };
                customerToken = user.uid;
                localStorage.setItem('qelvoria_customer_token', customerToken);
                localStorage.setItem('qelvoria_customer', JSON.stringify(currentCustomer));
                localStorage.setItem('qelvoria_cust_name', currentCustomer.name);
                localStorage.setItem('qelvoria_cust_email', currentCustomer.email);
                updateAuthNavbar();
            }
        });
    }
} catch (e) {
    console.warn('Firebase init warning:', e);
}

async function handleGoogleSignIn() {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            alert('Connecting to Google Auth service. Please try again in 1 second.');
            return;
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        currentCustomer = {
            name: user.displayName || 'Valued Reader',
            email: user.email,
            phone: user.phoneNumber || localStorage.getItem('qelvoria_cust_phone') || ''
        };
        customerToken = user.uid;

        localStorage.setItem('qelvoria_customer_token', customerToken);
        localStorage.setItem('qelvoria_customer', JSON.stringify(currentCustomer));
        localStorage.setItem('qelvoria_cust_name', currentCustomer.name);
        localStorage.setItem('qelvoria_cust_email', currentCustomer.email);
        if (user.phoneNumber) {
            localStorage.setItem('qelvoria_cust_phone', user.phoneNumber);
        }

        closeModal('unifiedAuthModal');
        updateAuthNavbar();

        // If a checkout action was pending, run it immediately
        if (pendingAppContext) {
            startRazorpayFlow(pendingAppContext);
            pendingAppContext = null;
        } else if (pendingCheckoutAction) {
            const act = pendingCheckoutAction;
            pendingCheckoutAction = null;
            act();
        } else {
            alert(`🎉 Welcome, ${currentCustomer.name}! Signed in successfully with Google.`);
        }
    } catch (error) {
        console.error('Firebase Google Sign-In error:', error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            alert(`Google Sign-In Notice: ${error.message || 'Sign in canceled'}`);
        }
    }
}

function handleGoogleSignInDemo() {
    handleGoogleSignIn();
}

function handleCustomerLogout() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        try { firebase.auth().signOut(); } catch (e) {}
    }
    customerToken = '';
    currentCustomer = null;
    localStorage.removeItem('qelvoria_customer_token');
    localStorage.removeItem('qelvoria_customer');
    localStorage.removeItem('qelvoria_cust_name');
    localStorage.removeItem('qelvoria_cust_email');
    localStorage.removeItem('ebookvault_customer_token');
    localStorage.removeItem('ebookvault_customer_user');
    updateAuthNavbar();
}

// --- Customer Order Lookup ---

function openCustomerOrdersModal() {
    if (currentCustomer) {
        document.getElementById('lookupInput').value = currentCustomer.email;
        handleCustomerLookup(new Event('submit'));
    }
    openModal('customerOrdersModal');
}

async function handleCustomerLookup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const query = document.getElementById('lookupInput').value.trim();
    const results = document.getElementById('lookupResultsArea');

    results.innerHTML = `<p class="text-center py-6 text-slate-500">Searching orders...</p>`;

    try {
        const res = await fetch(`/api/customer/orders?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            results.innerHTML = `<p class="text-center py-6 text-slate-400">No purchases found for "${query}".</p>`;
            return;
        }

        results.innerHTML = orders.map(o => `
            <div class="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src="${o.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-16 object-cover rounded-lg">
                    <div>
                        <div class="text-[10px] font-mono text-brand-400 font-bold">${o.order_code}</div>
                        <h4 class="font-bold text-sm text-white">${o.ebook_title}</h4>
                        <div class="text-xs text-slate-500">${new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a href="${o.download_url}" target="_blank" class="px-3 py-1.5 bg-brand-600 text-white font-bold text-xs rounded-xl">Download</a>
                    <a href="${o.whatsapp_url}" target="_blank" class="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl">WhatsApp</a>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Lookup error', err);
    }
}

// --- Support / Help ---

function openHelpModal() {
    if (currentCustomer) {
        document.getElementById('helpName').value = currentCustomer.name || '';
        document.getElementById('helpEmail').value = currentCustomer.email || '';
        document.getElementById('helpPhone').value = currentCustomer.phone || '';
    }
    openModal('helpModal');
}

async function handleSupportSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('helpSubmitBtn');
    if (btn) btn.disabled = true;

    const sessionId = localStorage.getItem('qelvoria_chat_session_id') || '';
    const name = document.getElementById('helpName').value.trim();
    const email = document.getElementById('helpEmail').value.trim();
    const phone = document.getElementById('helpPhone').value.trim();
    const orderRef = document.getElementById('helpOrderRef')?.value.trim() || '';
    const message = document.getElementById('helpMessage').value.trim();
    const fileInput = document.getElementById('helpFile');
    const hasFile = fileInput && fileInput.files && fileInput.files[0];

    let fetchOptions = {};
    if (hasFile) {
        const formData = new FormData();
        formData.append('customer_name', name);
        formData.append('customer_email', email);
        formData.append('customer_phone', phone);
        formData.append('order_code', orderRef);
        formData.append('transaction_ref', orderRef);
        formData.append('message', message);
        formData.append('session_id', sessionId);
        formData.append('attachment_file', fileInput.files[0]);

        fetchOptions = {
            method: 'POST',
            body: formData
        };
    } else {
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                order_code: orderRef,
                transaction_ref: orderRef,
                message: message,
                session_id: sessionId
            })
        };
    }

    try {
        const res = await fetch('/api/support/ticket', fetchOptions);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            alert(`🎉 Support Ticket #${data.ticket_id || ''} submitted successfully! Our support team will assist you promptly.`);
            document.getElementById('supportTicketForm')?.reset();
            closeModal('helpModal');
            
            // Auto-refresh chat if open
            if (window.qelvoriaChat && window.qelvoriaChat.fetchHistory) {
                window.qelvoriaChat.fetchHistory();
            }
        } else {
            let errorDetail = 'Failed to submit ticket.';
            if (data.detail) {
                if (typeof data.detail === 'string') {
                    errorDetail = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorDetail = data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
                } else {
                    errorDetail = JSON.stringify(data.detail);
                }
            } else if (data.message) {
                errorDetail = data.message;
            }
            alert(`Submission Error: ${errorDetail}`);
        }
    } catch (e) {
        console.error('Support error', e);
        alert('Network error submitting ticket. Please check your connection and try again.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function toggleFaq(n) {
    const el = document.getElementById(`faqContent-${n}`);
    const icon = document.getElementById(`faqIcon-${n}`);
    el.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-180');
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        lucide.createIcons();
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// ================= QELVORIA NATIVE AI CHAT AGENT & LIVE DESK WIDGET =================

(function() {
    'use strict';

    let isChatOpen = false;
    let isAgentTyping = false;
    let chatHistory = [];
    let visitorSessionId = localStorage.getItem('qelvoria_chat_session_id');
    if (!visitorSessionId) {
        visitorSessionId = 'qv_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
        localStorage.setItem('qelvoria_chat_session_id', visitorSessionId);
    }

    let visitorSessionStatus = 'bot_active';
    let visitorChatSyncTimer = null;

    function getCustomerIdentity() {
        let name = 'Visitor';
        let email = '';
        let phone = '';
        try {
            const cust = JSON.parse(localStorage.getItem('qelvoria_customer') || '{}');
            if (cust.name) name = cust.name;
            if (cust.email) email = cust.email;
            if (cust.phone) phone = cust.phone;
        } catch (e) {}

        if (name === 'Visitor' && localStorage.getItem('qelvoria_cust_name')) {
            name = localStorage.getItem('qelvoria_cust_name');
        }
        if (!email && localStorage.getItem('qelvoria_cust_email')) {
            email = localStorage.getItem('qelvoria_cust_email');
        }
        return { name, email, phone };
    }

    let currentChatPresets = window.qelvoriaChatPresets || [
        { id: 1, question: "How do I get my ebook after purchase?", answer: "⚡ **Instant Automated Delivery:**\nImmediately after payment, your download link appears on screen and is automatically sent to your **Email** and **WhatsApp** within 5 seconds!\n\nYou can also click **'Find Past Purchases'** anytime to re-download with lifetime access." },
        { id: 2, question: "What payment methods are supported?", answer: "💳 **Accepted Payment Methods:**\nWe accept 100% secure payments via **Razorpay**:\n• **UPI:** Google Pay, PhonePe, Paytm, BHIM, CRED, FamPay\n• **Cards:** Visa, Mastercard, RuPay, Maestro\n• **Net Banking:** All major Indian banks\n• **Wallets:** Paytm, Mobikwik, Amazon Pay" },
        { id: 3, question: "Which devices and file formats are supported?", answer: "📱 **Device & Format Compatibility:**\nAll our ebooks come in universal, high-quality **PDF** and **Word DOCX** formats with lifetime access!\n• Compatible with Android, iPhone, iPad, Windows PC, Mac, Kindle, and tablets.\n• No special reader app required." },
        { id: 4, question: "Are there any active discount coupons or bundle deals?", answer: "🎁 **Active Discounts & Bundles:**\n• Use promo code **`QELVORIA20`** for **20% OFF** your entire cart!\n• Check out our **Special Bundle Deals** section to get multi-book collections with over **60% savings**." },
        { id: 5, question: "How do I contact customer support if I need help?", answer: "👋 **Customer Support Desk:**\n• **Support Ticket:** Click 'Submit Support Ticket' to submit your order or payment details for prompt assistance.\n• **Live Support:** A live support specialist can also assist you directly here!" }
    ];

    function getPresetQuestions() {
        return currentChatPresets
            .filter(p => p && p.question && p.question.trim().length > 0 && p.answer && p.answer.trim().length > 0)
            .map(p => p.question.trim());
    }

    const INITIAL_GREETING = {
        sender: 'bot',
        sender_name: 'QELVORIA Assistant',
        created_at: new Date().toISOString(),
        message: `👋 **Welcome to QELVORIA!**\n\nI am your 24/7 Digital Assistant. Click any quick query below or type your question:`,
        quick_replies: getPresetQuestions(),
        books: []
    };

    function formatChatTime(dStr) {
        try {
            const d = dStr ? new Date(dStr) : new Date();
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function initChatAgentWidget() {
        if (document.getElementById('qelvoriaChatContainer')) return;

        // Inject Styles
        const style = document.createElement('style');
        style.textContent = `
            #qelvoriaChatContainer {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 99999;
                font-family: inherit;
            }
            .qelvoria-chat-launcher {
                width: 58px;
                height: 58px;
                border-radius: 50%;
                background: #090d16;
                border: 1.5px solid #334155;
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
            }
            .qelvoria-chat-launcher:hover {
                transform: scale(1.06);
                border-color: #94a3b8;
            }
            .qelvoria-chat-window {
                position: fixed;
                bottom: 92px;
                right: 24px;
                width: 380px;
                max-width: calc(100vw - 32px);
                height: 530px;
                max-height: calc(100vh - 110px);
                background: #090d16;
                border: 1px solid #1e293b;
                border-radius: 24px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                pointer-events: none;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: 99999;
            }
            .qelvoria-chat-window.active {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }
            .qelvoria-msg-bubble {
                max-width: 88%;
                padding: 10px 14px;
                border-radius: 18px;
                font-size: 12.5px;
                line-height: 1.5;
                word-break: break-word;
            }
            .qelvoria-msg-bot {
                background: #0f172a;
                border: 1px solid #1e293b;
                color: #e2e8f0;
                border-bottom-left-radius: 4px;
                align-self: flex-start;
            }
            .qelvoria-msg-admin {
                background: #064e3b;
                border: 1px solid #059669;
                color: #ecfdf5;
                border-bottom-left-radius: 4px;
                align-self: flex-start;
            }
            .qelvoria-msg-user {
                background: #ffffff;
                color: #090d16;
                font-weight: 600;
                border-bottom-right-radius: 4px;
                align-self: flex-end;
            }
            .qelvoria-quick-chip {
                display: inline-flex;
                align-items: center;
                padding: 5px 11px;
                background: #0f172a;
                border: 1px solid #334155;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: #cbd5e1;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .qelvoria-quick-chip:hover {
                background: #ffffff;
                color: #090d16;
                border-color: #ffffff;
            }
            .qelvoria-typing-dot {
                width: 6px;
                height: 6px;
                background: #94a3b8;
                border-radius: 50%;
                display: inline-block;
                animation: qelvoriaBounce 1.4s infinite ease-in-out both;
            }
            .qelvoria-typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .qelvoria-typing-dot:nth-child(2) { animation-delay: -0.16s; }
            @keyframes qelvoriaBounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
            }
            @media (max-width: 480px) {
                #qelvoriaChatContainer { bottom: 16px; right: 16px; }
                .qelvoria-chat-window {
                    bottom: 84px;
                    right: 12px;
                    width: calc(100vw - 24px);
                    height: calc(100vh - 100px);
                }
            }
        `;
        document.head.appendChild(style);

        // Build HTML Markup
        const container = document.createElement('div');
        container.id = 'qelvoriaChatContainer';
        container.innerHTML = `
            <!-- Chat Window -->
            <div id="qelvoriaChatWindow" class="qelvoria-chat-window">
                
                <!-- Header -->
                <div class="px-4 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="relative w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-white flex-shrink-0">
                            <span class="font-black text-xs text-white" id="qelvoriaHeaderAvatar">Q</span>
                            <span id="qelvoriaStatusDot" class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-950 rounded-full"></span>
                        </div>
                        <div>
                            <div class="text-xs font-bold text-white flex items-center gap-1.5">
                                <span id="qelvoriaHeaderTitle">QELVORIA Assistant</span>
                                <span id="qelvoriaHeaderTag" class="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 text-[9px] font-extrabold rounded border border-emerald-800">AI 24/7</span>
                            </div>
                            <div class="text-[10px] text-slate-400" id="qelvoriaHeaderSubtitle">Customer Care & Instant Delivery Desk</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="window.qelvoriaChat.endChat()" class="px-2 py-1 bg-slate-900 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1" title="End conversation">
                            <span>End Chat</span>
                        </button>
                        <button onclick="window.qelvoriaChat.clearHistory()" class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition" title="Clear Chat">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                        <button onclick="window.qelvoriaChat.toggle()" class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition" title="Close">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Messages Thread -->
                <div id="qelvoriaChatMessages" class="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
                    <!-- Injected dynamically -->
                </div>

                <!-- Typing indicator -->
                <div id="qelvoriaTyping" class="px-4 py-1 text-slate-400 text-xs hidden items-center gap-1.5">
                    <span class="text-[11px] font-medium text-slate-400">Assistant is typing</span>
                    <span class="qelvoria-typing-dot"></span>
                    <span class="qelvoria-typing-dot"></span>
                    <span class="qelvoria-typing-dot"></span>
                </div>

                <!-- Footer Input Area -->
                <div class="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                    <form onsubmit="window.qelvoriaChat.handleSubmit(event)" class="flex items-center gap-2">
                        <input 
                            type="text" 
                            id="qelvoriaChatInput" 
                            placeholder="Ask about books, coupons, orders..." 
                            class="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none transition"
                        >
                        <button 
                            type="submit" 
                            id="qelvoriaChatSendBtn"
                            class="p-2.5 bg-white hover:bg-slate-200 text-slate-950 rounded-xl transition shadow-md flex items-center justify-center flex-shrink-0 font-bold"
                            title="Send"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        </button>
                    </form>
                    <div class="flex items-center justify-between text-[10px] text-slate-500 px-1">
                        <button onclick="openHelpModal()" class="text-slate-400 hover:text-white transition flex items-center gap-1">
                            <span>📋 Submit Support Ticket</span>
                        </button>
                        <span>⚡ Instant Delivery Guarantee</span>
                    </div>
                </div>
            </div>

            <!-- Floating Launcher Button -->
            <button 
                id="qelvoriaChatLauncher" 
                onclick="window.qelvoriaChat.toggle()" 
                class="qelvoria-chat-launcher"
                title="Chat with QELVORIA Support"
            >
                <svg id="qelvoriaIconChat" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                <svg id="qelvoriaIconClose" class="w-6 h-6 text-white hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                
                <!-- Online Green Status Indicator -->
                <span class="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-ping opacity-75"></span>
                <span class="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full"></span>
            </button>
        `;

        document.body.appendChild(container);

        fetchVisitorChatHistory();

        // Background poller every 3.5s for live admin replies
        if (!visitorChatSyncTimer) {
            visitorChatSyncTimer = setInterval(fetchVisitorChatHistory, 3500);
        }
    }

    async function fetchVisitorChatHistory() {
        try {
            const res = await fetch(`/api/chat/messages/${visitorSessionId}`);
            if (!res.ok) return;
            const data = await res.json();
            
            visitorSessionStatus = data.status || 'bot_active';
            updateWidgetHeaderStatus(visitorSessionStatus);

            if (data.messages && data.messages.length > 0) {
                chatHistory = data.messages;
            } else if (chatHistory.length === 0) {
                chatHistory = [INITIAL_GREETING];
            }
            renderChatMessages();
        } catch (e) {
            if (chatHistory.length === 0) {
                chatHistory = [INITIAL_GREETING];
                renderChatMessages();
            }
        }
    }

    function updateWidgetHeaderStatus(status) {
        const titleEl = document.getElementById('qelvoriaHeaderTitle');
        const tagEl = document.getElementById('qelvoriaHeaderTag');
        const subtitleEl = document.getElementById('qelvoriaHeaderSubtitle');

        if (status === 'admin_joined') {
            if (titleEl) titleEl.innerText = 'Support Specialist';
            if (tagEl) {
                tagEl.className = 'px-1.5 py-0.2 bg-emerald-900 text-emerald-200 text-[9px] font-extrabold rounded border border-emerald-700';
                tagEl.innerText = 'Live Support';
            }
            if (subtitleEl) subtitleEl.innerText = 'Online • Direct Assistance';
        } else if (status === 'closed') {
            if (titleEl) titleEl.innerText = 'QELVORIA Assistant';
            if (tagEl) {
                tagEl.className = 'px-1.5 py-0.2 bg-slate-800 text-slate-400 text-[9px] font-extrabold rounded border border-slate-700';
                tagEl.innerText = 'Closed';
            }
            if (subtitleEl) subtitleEl.innerText = 'Chat ended by customer';
        } else {
            if (titleEl) titleEl.innerText = 'QELVORIA Assistant';
            if (tagEl) {
                tagEl.className = 'px-1.5 py-0.2 bg-emerald-950 text-emerald-300 text-[9px] font-extrabold rounded border border-emerald-800';
                tagEl.innerText = 'AI 24/7';
            }
            if (subtitleEl) subtitleEl.innerText = 'Customer Care & Instant Delivery Desk';
        }
    }

    let lastRenderedCustomerChatKey = '';
    let forceCustomerChatScroll = false;

    function renderChatMessages() {
        const thread = document.getElementById('qelvoriaChatMessages');
        if (!thread) return;

        const lastM = chatHistory[chatHistory.length - 1];
        const currentKey = `${chatHistory.length}_${lastM?.id || ''}_${lastM?.message?.length || lastM?.text?.length || ''}`;
        const isNearBottom = (thread.scrollHeight - thread.scrollTop - thread.clientHeight) < 95;

        if (currentKey !== lastRenderedCustomerChatKey) {
            lastRenderedCustomerChatKey = currentKey;

            thread.innerHTML = chatHistory.map((m, idx) => {
                const isUser = m.sender === 'visitor' || m.sender === 'user';
                const isAdmin = m.sender === 'admin';
                const rawMsg = m.message || m.text || '';
                const hasSupportTag = rawMsg.includes('[SUPPORT_FORM]') || m.show_support_form || (!isUser && !isAdmin && (rawMsg.toLowerCase().includes('support request form') || rawMsg.toLowerCase().includes('support ticket form') || rawMsg.toLowerCase().includes('customer support desk')));
                const cleanMsgText = rawMsg.replace(/\[SUPPORT_FORM\]/g, '').trim();
                const formattedText = parseChatMarkdown(cleanMsgText);

                let cardsHtml = '';
                if (m.books && m.books.length > 0) {
                    cardsHtml = `
                        <div class="mt-2.5 space-y-2 w-full">
                            ${m.books.map(b => `
                                <a href="/book.html?id=${b.id}" class="flex items-center gap-2.5 p-2 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-600 transition block">
                                    <img src="${b.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-9 h-12 object-cover rounded-lg border border-slate-800 flex-shrink-0">
                                    <div class="flex-1 min-w-0">
                                        <div class="font-bold text-white text-[11px] truncate">${b.title}</div>
                                        <div class="text-[10px] font-mono font-bold text-emerald-400">₹${b.sale_price || b.price}</div>
                                    </div>
                                    <span class="px-2 py-1 bg-white text-slate-950 rounded-lg text-[9px] font-extrabold flex-shrink-0">View</span>
                                </a>
                            `).join('')}
                        </div>
                    `;
                }

                let supportFormHtml = '';
                if (hasSupportTag) {
                    const identity = getCustomerIdentity();
                    if (m.ticket_submitted) {
                        supportFormHtml = `
                            <div class="mt-2.5 p-3 bg-emerald-950/80 border border-emerald-800 rounded-2xl text-emerald-200 space-y-1">
                                <div class="font-extrabold flex items-center gap-1.5 text-xs text-emerald-300">
                                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                    <span>Support Ticket #${m.ticket_id || 'Submitted'} Confirmed</span>
                                </div>
                                <p class="text-[11px] text-emerald-300/90 leading-relaxed">
                                    Our support team has received your ticket and will verify & assist you promptly!
                                </p>
                            </div>
                        `;
                    } else {
                        supportFormHtml = `
                            <div id="inChatTicketWrapper_${idx}" class="mt-2.5 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2 text-xs text-white shadow-inner">
                                <div class="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                    <div class="flex items-center gap-1.5 font-bold text-amber-400">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                        <span>Instant Support Request Form</span>
                                    </div>
                                    <span class="text-[9px] text-slate-400 uppercase font-bold">24/7 Desk</span>
                                </div>
                                <form onsubmit="window.qelvoriaChat.submitInChatTicket(event, ${idx})" class="space-y-2">
                                    <div>
                                        <input type="text" id="inChatName_${idx}" required placeholder="Your Full Name *" value="${identity.name !== 'Visitor' ? identity.name : ''}" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none">
                                    </div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input type="email" id="inChatEmail_${idx}" required placeholder="Email Address *" value="${identity.email || ''}" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none">
                                        <input type="tel" id="inChatPhone_${idx}" required placeholder="WhatsApp / Mobile *" value="${identity.phone || ''}" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none">
                                    </div>
                                    <div>
                                        <input type="text" id="inChatOrder_${idx}" placeholder="Order ID or Payment Ref (Optional)" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none">
                                    </div>
                                    <div>
                                        <textarea id="inChatMsg_${idx}" required rows="2" placeholder="Describe your question or issue in detail... *" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-500 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none resize-none"></textarea>
                                    </div>
                                    <div class="flex items-center gap-2 pt-0.5">
                                        <button type="submit" id="inChatSubmitBtn_${idx}" class="flex-1 py-2 bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                            <span>Submit Support Ticket</span>
                                        </button>
                                        <button type="button" onclick="openHelpModal()" class="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-bold rounded-xl transition" title="Open full screen form to attach file">
                                            <span>Attach File</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        `;
                    }
                }

                let chipsHtml = '';
                if (m.quick_replies && m.quick_replies.length > 0 && idx === chatHistory.length - 1) {
                    chipsHtml = `
                        <div class="flex flex-wrap gap-1.5 mt-2.5">
                            ${m.quick_replies.map(qr => `
                                <button onclick="window.qelvoriaChat.sendQuery('${escapeChatAttr(qr)}')" class="qelvoria-quick-chip">
                                    ${qr}
                                </button>
                            `).join('')}
                        </div>
                    `;
                }

                let bubbleClass = 'qelvoria-msg-bot';
                let senderNameLabel = '';
                if (isUser) {
                    bubbleClass = 'qelvoria-msg-user';
                } else if (isAdmin) {
                    bubbleClass = 'qelvoria-msg-admin';
                    senderNameLabel = `<span class="text-[9px] font-bold text-emerald-400 mb-0.5 block">🛡️ Support Specialist</span>`;
                }

                return `
                    <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1">
                        <div class="qelvoria-msg-bubble ${bubbleClass}">
                            ${senderNameLabel}
                            <div>${formattedText}</div>
                            ${supportFormHtml}
                            ${cardsHtml}
                        </div>
                        ${chipsHtml}
                        <span class="text-[9px] text-slate-500 px-1">${formatChatTime(m.created_at || m.time)}</span>
                    </div>
                `;
            }).join('');

            if (forceCustomerChatScroll || isNearBottom || chatHistory.length <= 2) {
                setTimeout(() => {
                    thread.scrollTop = thread.scrollHeight;
                }, 10);
                forceCustomerChatScroll = false;
            }
        }
    }

    function parseChatMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-slate-800 rounded font-mono text-[11px] text-amber-300">$1</code>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-indigo-400 underline font-bold hover:text-indigo-300">$1</a>')
            .replace(/\n/g, '<br>');
    }

    function escapeChatAttr(s) {
        return s.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    function toggleChatWidget() {
        isChatOpen = !isChatOpen;
        const win = document.getElementById('qelvoriaChatWindow');
        const iconChat = document.getElementById('qelvoriaIconChat');
        const iconClose = document.getElementById('qelvoriaIconClose');

        if (win) {
            if (isChatOpen) {
                win.classList.add('active');
                iconChat?.classList.add('hidden');
                iconClose?.classList.remove('hidden');
                setTimeout(() => document.getElementById('qelvoriaChatInput')?.focus(), 200);
            } else {
                win.classList.remove('active');
                iconChat?.classList.remove('hidden');
                iconClose?.classList.add('hidden');
            }
        }
    }

    async function sendChatMessage(text) {
        const query = (text || '').trim();
        if (!query || isAgentTyping) return;

        // Check special quick action shortcuts
        if (query.includes('Open Support Ticket Form') || query.includes('Submit Support Ticket')) {
            openHelpModal();
            return;
        }
        if (query.includes('Start New Chat') || query.includes('Restart Chat')) {
            visitorSessionId = 'qv_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
            localStorage.setItem('qelvoria_chat_session_id', visitorSessionId);
            chatHistory = [INITIAL_GREETING];
            renderChatMessages();
            return;
        }

        const identity = getCustomerIdentity();

        // Push User Message
        chatHistory.push({
            sender: 'visitor',
            sender_name: identity.name,
            created_at: new Date().toISOString(),
            message: query
        });
        renderChatMessages();

        // Clear Input
        const inp = document.getElementById('qelvoriaChatInput');
        if (inp) inp.value = '';

        // Show typing indicator if in bot mode
        if (visitorSessionStatus !== 'admin_joined') {
            isAgentTyping = true;
            const typingEl = document.getElementById('qelvoriaTyping');
            if (typingEl) {
                typingEl.classList.remove('hidden');
                typingEl.classList.add('flex');
            }
        }

        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: visitorSessionId,
                    message: query,
                    visitor_name: identity.name,
                    visitor_email: identity.email
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.reply) {
                    chatHistory.push({
                        sender: 'bot',
                        sender_name: 'QELVORIA Assistant',
                        created_at: new Date().toISOString(),
                        message: data.reply,
                        quick_replies: data.quick_replies || [],
                        books: data.books || []
                    });
                }
            } else {
                throw new Error('API error');
            }
        } catch (e) {
            // Client Fallback Knowledge using active presets
            const cleanQ = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
            const foundPreset = currentChatPresets.find(p => {
                const pq = p.question.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                return pq === cleanQ || (cleanQ.length >= 8 && (pq.includes(cleanQ) || cleanQ.includes(pq)));
            });

            if (foundPreset) {
                const otherQuestions = currentChatPresets.filter(p => p.id !== foundPreset.id).map(p => p.question);
                chatHistory.push({
                    sender: 'bot',
                    sender_name: 'QELVORIA Assistant',
                    created_at: new Date().toISOString(),
                    message: foundPreset.answer,
                    quick_replies: otherQuestions,
                    books: []
                });
            } else if (cleanQ.includes('help') || cleanQ.includes('support') || cleanQ.includes('ticket') || cleanQ.includes('issue') || cleanQ.includes('problem')) {
                chatHistory.push({
                    sender: 'bot',
                    sender_name: 'QELVORIA Assistant',
                    created_at: new Date().toISOString(),
                    message: "👋 **QELVORIA Customer Support Desk:**\n\nPlease fill out the instant **Support Request Form** below with your details, and our team will resolve your request promptly:\n\n[SUPPORT_FORM]",
                    quick_replies: getPresetQuestions(),
                    books: []
                });
            } else {
                chatHistory.push({
                    sender: 'bot',
                    sender_name: 'QELVORIA Assistant',
                    created_at: new Date().toISOString(),
                    message: "👋 I'm here to help! Click any question below, or submit a support ticket for personal assistance.",
                    quick_replies: getPresetQuestions(),
                    books: []
                });
            }
        } finally {
            isAgentTyping = false;
            const typingEl = document.getElementById('qelvoriaTyping');
            if (typingEl) {
                typingEl.classList.add('hidden');
                typingEl.classList.remove('flex');
            }
            renderChatMessages();
        }
    }

    async function endChatSession() {
        if (!confirm('End this conversation?')) return;

        try {
            await fetch('/api/chat/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: visitorSessionId })
            });
            visitorSessionStatus = 'closed';
            updateWidgetHeaderStatus('closed');
            chatHistory.push({
                sender: 'bot',
                sender_name: 'QELVORIA Assistant',
                created_at: new Date().toISOString(),
                message: "🔒 **This chat session has ended.** Thank you for visiting QELVORIA!",
                quick_replies: ["🔄 Start New Chat", "🔥 Browse Ebooks", "📋 Open Support Ticket Form"]
            });
            renderChatMessages();
        } catch (e) {
            console.error('End chat error', e);
        }
    }

    function handleChatSubmit(e) {
        if (e) e.preventDefault();
        const inp = document.getElementById('qelvoriaChatInput');
        if (inp) sendChatMessage(inp.value);
    }

    function clearChatHistory() {
        if (!confirm('Clear chat history?')) return;
        visitorSessionId = 'qv_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
        localStorage.setItem('qelvoria_chat_session_id', visitorSessionId);
        chatHistory = [INITIAL_GREETING];
        renderChatMessages();
    }

    function updateChatPresets(presets) {
        if (presets && Array.isArray(presets)) {
            const valid = presets.filter(p => p && p.question && p.question.trim().length > 0 && p.answer && p.answer.trim().length > 0);
            if (valid.length > 0) {
                currentChatPresets = valid;
                INITIAL_GREETING.quick_replies = getPresetQuestions();
                if (chatHistory.length === 1 && chatHistory[0].sender === 'bot') {
                    chatHistory[0].quick_replies = getPresetQuestions();
                    renderChatMessages();
                }
            }
        }
    }

    async function submitInChatTicket(e, msgIdx) {
        if (e) e.preventDefault();
        const btn = document.getElementById(`inChatSubmitBtn_${msgIdx}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="inline-block w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1"></span><span>Submitting...</span>`;
        }

        const name = document.getElementById(`inChatName_${msgIdx}`)?.value.trim() || '';
        const email = document.getElementById(`inChatEmail_${msgIdx}`)?.value.trim() || '';
        const phone = document.getElementById(`inChatPhone_${msgIdx}`)?.value.trim() || '';
        const orderRef = document.getElementById(`inChatOrder_${msgIdx}`)?.value.trim() || '';
        const message = document.getElementById(`inChatMsg_${msgIdx}`)?.value.trim() || '';

        try {
            const res = await fetch('/api/support/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: name,
                    customer_email: email,
                    customer_phone: phone,
                    order_code: orderRef,
                    transaction_ref: orderRef,
                    message: message,
                    session_id: visitorSessionId
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (chatHistory[msgIdx]) {
                    chatHistory[msgIdx].ticket_submitted = true;
                    chatHistory[msgIdx].ticket_id = data.ticket_id;
                }
                forceCustomerChatScroll = true;
                renderChatMessages();
                setTimeout(fetchVisitorChatHistory, 600);
            } else {
                alert(`Notice: ${data.detail || data.message || 'Could not submit ticket.'}`);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `<span>Submit Support Ticket</span>`;
                }
            }
        } catch (err) {
            alert('Network sync issue. Please try again.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<span>Submit Support Ticket</span>`;
            }
        }
    }

    // Expose global controller
    window.qelvoriaChat = {
        toggle: toggleChatWidget,
        sendQuery: sendChatMessage,
        handleSubmit: handleChatSubmit,
        clearHistory: clearChatHistory,
        endChat: endChatSession,
        updatePresets: updateChatPresets,
        submitInChatTicket: submitInChatTicket
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatAgentWidget);
    } else {
        initChatAgentWidget();
    }
})();



