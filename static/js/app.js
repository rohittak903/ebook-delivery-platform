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
    } catch (e) {
        console.error('Store info error', e);
    }
}

async function loadHeroSlides() {
    try {
        const res = await fetch('/api/hero-slides');
        const data = await res.json();
        heroSlides = data.slides || [];
        if (heroSlides.length > 0) {
            renderHeroSlider();
            startHeroAutoPlay();
        }
    } catch (e) {
        console.error('Hero slides error', e);
    }
}

function renderHeroSlider() {
    const track = document.getElementById('heroSliderTrack');
    const dotsContainer = document.getElementById('sliderDots');
    if (!track || heroSlides.length === 0) return;

    const slide = heroSlides[currentSlideIndex];

    track.innerHTML = `
        <div class="flex flex-col lg:flex-row items-center justify-between gap-8 animate-fade-in">
            <div class="flex-1 max-w-2xl text-center lg:text-left">
                ${slide.badge_text ? `
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-extrabold uppercase tracking-wider mb-4 border border-brand-400/30">
                        <span>${slide.badge_text}</span>
                    </div>
                ` : ''}
                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
                    ${slide.title}
                </h1>
                <p class="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
                    ${slide.subtitle}
                </p>
                <div class="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                    <a 
                        href="${slide.cta_url || '#bundles'}" 
                        class="px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/30 transition flex items-center gap-2"
                    >
                        <span>${slide.cta_text || 'Explore Offers'}</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
            </div>

            <!-- Responsive Banner Image -->
            <div class="w-full lg:w-96 flex-shrink-0 flex items-center justify-center">
                <div class="relative w-full max-w-xs sm:max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800">
                    <img src="${slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${slide.title}" class="hidden sm:block w-full h-64 sm:h-72 object-cover">
                    <img src="${slide.mobile_image || slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${slide.title}" class="block sm:hidden w-full h-56 object-cover">
                </div>
            </div>
        </div>
    `;

    dotsContainer.innerHTML = heroSlides.map((_, i) => `
        <button onclick="goToHeroSlide(${i})" class="w-2.5 h-2.5 rounded-full transition ${i === currentSlideIndex ? 'bg-brand-500 w-6' : 'bg-slate-700 hover:bg-slate-600'}"></button>
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
        const res = await fetch('/api/bundles');
        const data = await res.json();
        bundleOffers = data.bundles || [];
        renderBundles();
    } catch (e) {
        console.error('Bundles load error', e);
    }
}

function renderBundles() {
    const grid = document.getElementById('bundlesGrid');
    if (!grid) return;

    if (bundleOffers.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-8 text-center text-slate-500 text-sm">
                <p>New special bundle offers launching soon!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = bundleOffers.map(bundle => `
        <div class="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 hover:border-brand-500/80 shadow-xl transition flex flex-col justify-between group">
            <div>
                <div class="flex items-center justify-between gap-2 mb-4">
                    <span class="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase bg-amber-950/80 text-amber-300 border border-amber-800">
                        ${bundle.badge_text || 'BUNDLE PACK'}
                    </span>
                    <span class="text-xs text-emerald-400 font-bold">
                        Save ₹${(bundle.price - bundle.sale_price).toFixed(2)}!
                    </span>
                </div>

                <h3 class="text-xl sm:text-2xl font-extrabold text-white leading-snug group-hover:text-brand-300 transition">
                    ${bundle.title}
                </h3>
                <p class="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                    ${bundle.description}
                </p>

                <!-- Books Included Inside Bundle -->
                <div class="mt-6 space-y-2">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Included Guides (${bundle.books.length} Books):</span>
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
                    class="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
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
        const res = await fetch('/api/ebooks');
        const data = await res.json();
        catalogEbooks = data.ebooks || [];
        availableCategories = data.categories || [];

        renderBestSellers();
        renderCategories();
        renderCatalog();
    } catch (e) {
        console.error('Catalog error', e);
    }
}

function renderBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    let best = catalogEbooks.filter(b => b.is_featured);
    if (best.length < 4) best = catalogEbooks.slice(0, 4);

    grid.innerHTML = best.map((book, idx) => {
        const format = (book.file_format || 'pdf').toUpperCase();
        const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
        const hasDiscount = book.sale_price && book.sale_price < book.price;
        const inCart = cart.some(item => item.id === book.id);

        return `
            <div class="bg-slate-950 rounded-3xl p-5 border border-slate-800 hover:border-brand-500 hover:shadow-2xl transition duration-200 flex flex-col justify-between group">
                <div>
                    <a href="/book.html?id=${book.id}" class="block relative overflow-hidden rounded-2xl mb-4 bg-slate-900 aspect-[3/4] shadow-sm">
                        <img src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${book.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-slate-900/90 text-white backdrop-blur-sm">
                                #${idx + 1} Best Seller
                            </span>
                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-brand-600 text-white">
                                ${format}
                            </span>
                        </div>
                    </a>

                    <div class="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1">${book.category || 'General'}</div>
                    <a href="/book.html?id=${book.id}" class="block font-bold text-white text-sm leading-snug line-clamp-2 hover:text-brand-300 transition">
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
                        <a href="/book.html?id=${book.id}" class="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1">
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
        <button onclick="filterCategory('All')" class="category-pill ${currentCategory === 'All' ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
            All Categories
        </button>
    `;
    availableCategories.forEach(cat => {
        const active = currentCategory === cat;
        html += `
            <button onclick="filterCategory('${cat}')" class="category-pill ${active ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
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
            <div class="bg-slate-900 rounded-3xl p-5 border border-slate-800 hover:border-brand-500 hover:shadow-2xl transition duration-200 flex flex-col justify-between group">
                <div>
                    <a href="/book.html?id=${book.id}" class="block relative overflow-hidden rounded-2xl mb-4 bg-slate-950 aspect-[3/4]">
                        <img src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" alt="${book.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy">
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-brand-600 text-white">${format}</span>
                            ${hasDiscount ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-600 text-white shadow-sm">SALE</span>` : ''}
                        </div>
                    </a>

                    <div class="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1">${book.category || 'General'}</div>
                    <a href="/book.html?id=${book.id}" class="block font-bold text-white text-base leading-snug line-clamp-2 hover:text-brand-300 transition">
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
                        <a href="/book.html?id=${book.id}" class="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1">
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
        input.addEventListener('input', () => {
            renderCatalog();
        });
    }
}

// --- Cart System & Promo Codes ---

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (cart.length > 0) {
        badge.innerText = cart.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function saveCart() {
    localStorage.setItem('ebookvault_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCatalog();
}

function toggleAddToCart(bookId) {
    const book = catalogEbooks.find(b => b.id === bookId);
    if (!book) return;

    const idx = cart.findIndex(item => item.id === bookId);
    if (idx > -1) {
        cart.splice(idx, 1);
    } else {
        const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
        cart.push({
            id: book.id,
            title: book.title,
            author: book.author,
            price: price,
            cover: book.cover_image,
            format: book.file_format
        });
    }
    saveCart();
    renderCartDrawer();
}

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

    if (cart.length === 0) {
        list.innerHTML = `
            <div class="text-center py-16 text-slate-500">
                <i data-lucide="shopping-cart" class="w-12 h-12 mx-auto mb-3 text-slate-600"></i>
                <p class="font-bold text-slate-300 text-sm">Your cart is empty</p>
                <p class="text-xs text-slate-500 mt-1">Browse our bestsellers and bundles to add items.</p>
            </div>
        `;
        totalEl.innerText = `${storeCurrency}0.00`;
        document.getElementById('cartCheckoutBtn').disabled = true;
        lucide.createIcons();
        return;
    }

    document.getElementById('cartCheckoutBtn').disabled = false;
    let subtotal = cart.reduce((acc, item) => acc + item.price, 0);
    let finalAmount = subtotal;

    if (cartAppliedCoupon) {
        finalAmount = cartAppliedCoupon.final_amount;
    }

    list.innerHTML = cart.map(item => `
        <div class="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <div class="flex items-center gap-3 truncate">
                <img src="${item.cover || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-16 object-cover rounded-lg border border-slate-800 shadow-sm flex-shrink-0">
                <div class="truncate">
                    <h4 class="font-bold text-xs text-white truncate">${item.title}</h4>
                    <div class="text-[11px] text-slate-500">By ${item.author}</div>
                    <div class="text-xs font-extrabold text-brand-400 mt-1">${storeCurrency}${item.price.toFixed(2)}</div>
                </div>
            </div>
            <button onclick="toggleAddToCart(${item.id})" class="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition" title="Remove">
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
            name: 'QELVORIA (Raja Rohit Tak)',
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

function handleGoogleSignInDemo() {
    const demo = {
        name: "Google Reader",
        email: "reader.google@example.com",
        phone: "+919035630901"
    };
    customerToken = "google_token_" + Date.now();
    currentCustomer = demo;
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
}

function handleCustomerLogout() {
    customerToken = '';
    currentCustomer = null;
    localStorage.removeItem('qelvoria_customer_token');
    localStorage.removeItem('qelvoria_customer');
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
    btn.disabled = true;

    const payload = {
        customer_name: document.getElementById('helpName').value.trim(),
        customer_email: document.getElementById('helpEmail').value.trim(),
        customer_phone: document.getElementById('helpPhone').value.trim(),
        message: document.getElementById('helpMessage').value.trim()
    };

    try {
        const res = await fetch('/api/support/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('Support request submitted! Raja Rohit Tak will contact you on WhatsApp.');
            closeModal('helpModal');
        } else {
            alert('Failed to submit ticket.');
        }
    } catch (e) {
        console.error('Support error', e);
    } finally {
        btn.disabled = false;
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
