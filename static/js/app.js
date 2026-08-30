// Storefront Client Application with Razorpay SDK, Responsive Hero Slider, Search Engine, and Mandatory Login

let catalogEbooks = [];
let availableCategories = [];
let currentCategory = 'All';
let storeCurrency = '₹';

let heroSlides = [];
let currentSlideIndex = 0;
let slideInterval = null;

let cart = JSON.parse(localStorage.getItem('ebookvault_cart') || '[]');
let customerToken = localStorage.getItem('ebookvault_customer_token') || '';
let currentCustomer = JSON.parse(localStorage.getItem('ebookvault_customer_user') || 'null');

// Pending action after mandatory login
let pendingCheckoutAction = null;

document.addEventListener('DOMContentLoaded', async () => {
    updateAuthNavbar();
    updateCartBadge();
    await loadStoreInfo();
    await loadHeroSlides();
    await loadEbooks();
    setupSearchListeners();
});

// --- Store & Hero Slides Loading ---

async function loadStoreInfo() {
    try {
        const res = await fetch('/api/store-info');
        const data = await res.json();
        if (data.store_name) {
            document.getElementById('brandName').innerText = data.store_name;
            storeCurrency = data.currency || '₹';
        }
    } catch (e) {
        console.error('Failed to load store info', e);
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
        console.error('Failed to load hero slides', e);
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
                        href="${slide.cta_url || '#bestsellers'}" 
                        class="px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/30 transition flex items-center gap-2"
                    >
                        <span>${slide.cta_text || 'Explore Collection'}</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
            </div>

            <!-- Responsive Banner Image (Desktop vs Mobile) -->
            <div class="w-full lg:w-96 flex-shrink-0 flex items-center justify-center">
                <div class="relative w-full max-w-xs sm:max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800">
                    <!-- Desktop Banner (Hidden on Mobile) -->
                    <img 
                        src="${slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" 
                        alt="${slide.title}" 
                        class="hidden sm:block w-full h-64 sm:h-72 object-cover"
                    >
                    <!-- Mobile Banner (Hidden on Desktop) -->
                    <img 
                        src="${slide.mobile_image || slide.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" 
                        alt="${slide.title}" 
                        class="block sm:hidden w-full h-56 object-cover"
                    >
                </div>
            </div>
        </div>
    `;

    // Render Dots
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

function goToHeroSlide(index) {
    currentSlideIndex = index;
    renderHeroSlider();
}

function startHeroAutoPlay() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(nextHeroSlide, 6000);
}

// --- Ebook Catalog & Search Engine ---

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
        console.error('Failed to load ebooks', e);
        document.getElementById('ebooksGrid').innerHTML = `
            <div class="col-span-full py-12 text-center text-red-500">
                <p>Failed to load catalog. Please ensure the server is running.</p>
            </div>
        `;
    }
}

function renderBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    let best = catalogEbooks.filter(b => b.is_featured);
    if (best.length < 4) best = catalogEbooks.slice(0, 4);

    grid.innerHTML = best.map((book, idx) => {
        const format = (book.file_format || 'pdf').toUpperCase();
        let badgeClass = 'badge-pdf';
        if (format.includes('DOC') || format.includes('WORD')) badgeClass = 'badge-docx';

        const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
        const hasDiscount = book.sale_price && book.sale_price < book.price;
        const inCart = cart.some(item => item.id === book.id);

        return `
            <div class="bg-slate-50 rounded-3xl p-5 border border-slate-200 hover:border-brand-400 hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between group">
                <div>
                    <div class="relative overflow-hidden rounded-2xl mb-4 bg-white aspect-[3/4] cursor-pointer shadow-sm" onclick="openEbookDetail(${book.id})">
                        <img 
                            src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" 
                            alt="${book.title}" 
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        >
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm bg-slate-900/90 text-white backdrop-blur-sm">
                                #${idx + 1} Best Seller
                            </span>
                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm ${badgeClass}">
                                ${format}
                            </span>
                        </div>
                        <div class="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-slate-900 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                            <span class="text-amber-500">★</span>
                            <span>4.9 (1.2k+ sales)</span>
                        </div>
                    </div>

                    <div class="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">${book.category || 'Technology'}</div>
                    <h3 class="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-brand-600 transition cursor-pointer" onclick="openEbookDetail(${book.id})">
                        ${book.title}
                    </h3>
                    <p class="text-xs text-slate-500 mt-1 font-medium">By ${book.author}</p>
                </div>

                <div class="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-lg font-extrabold text-slate-900">${storeCurrency}${price.toFixed(2)}</span>
                            ${hasDiscount ? `<span class="text-xs text-slate-400 line-through">${storeCurrency}${book.price.toFixed(2)}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Instant Access</div>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button 
                            onclick="toggleAddToCart(${book.id})" 
                            class="p-2.5 ${inCart ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-700 hover:bg-slate-100'} border rounded-xl transition"
                            title="${inCart ? 'In Cart' : 'Add to Cart'}"
                        >
                            <i data-lucide="${inCart ? 'check' : 'shopping-cart'}" class="w-4 h-4"></i>
                        </button>

                        <button 
                            onclick="handleBuyNowClick(${book.id})" 
                            class="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1"
                        >
                            <span>Buy</span>
                            <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderCategories() {
    const pillsContainer = document.getElementById('categoryPills');
    let html = `
        <button onclick="filterCategory('All')" class="category-pill ${currentCategory === 'All' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
            All Categories
        </button>
    `;
    
    availableCategories.forEach(cat => {
        const active = currentCategory === cat;
        html += `
            <button onclick="filterCategory('${cat}')" class="category-pill ${active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition">
                ${cat}
            </button>
        `;
    });
    
    pillsContainer.innerHTML = html;
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
            <div class="col-span-full py-16 text-center text-slate-400">
                <i data-lucide="book-x" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i>
                <p class="font-bold text-slate-700 text-base">No matching ebooks found</p>
                <p class="text-sm text-slate-500 mt-1">Try searching by topic, author, or file format (PDF / DOCX).</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = filtered.map(book => {
        const format = (book.file_format || 'pdf').toUpperCase();
        let badgeClass = 'badge-pdf';
        if (format.includes('DOC') || format.includes('WORD')) badgeClass = 'badge-docx';

        const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
        const hasDiscount = book.sale_price && book.sale_price < book.price;
        const inCart = cart.some(item => item.id === book.id);

        return `
            <div class="bg-white rounded-3xl p-5 border border-slate-200/90 hover:border-brand-300 hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between group">
                <div>
                    <div class="relative overflow-hidden rounded-2xl mb-4 bg-slate-100 aspect-[3/4] cursor-pointer" onclick="openEbookDetail(${book.id})">
                        <img 
                            src="${book.cover_image || '/uploads/covers/python-ai-cover.jpg'}" 
                            alt="${book.title}" 
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                        >
                        <div class="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shadow-sm ${badgeClass}">
                                ${format}
                            </span>
                            ${hasDiscount ? `
                                <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-500 text-white shadow-sm">
                                    SALE
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <div class="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">${book.category || 'General'}</div>
                    <h3 class="font-bold text-slate-900 text-base leading-snug line-clamp-2 hover:text-brand-600 transition cursor-pointer" onclick="openEbookDetail(${book.id})">
                        ${book.title}
                    </h3>
                    <p class="text-xs text-slate-500 mt-1 font-medium">By ${book.author}</p>
                    <p class="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">${book.description || ''}</p>
                </div>

                <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-xl font-extrabold text-slate-900">${storeCurrency}${price.toFixed(2)}</span>
                            ${hasDiscount ? `<span class="text-xs text-slate-400 line-through">${storeCurrency}${book.price.toFixed(2)}</span>` : ''}
                        </div>
                        <div class="text-[10px] font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                            <i data-lucide="zap" class="w-3 h-3"></i>
                            <span>Email + WhatsApp</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button 
                            onclick="toggleAddToCart(${book.id})" 
                            class="p-2.5 ${inCart ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} border rounded-xl transition"
                            title="${inCart ? 'In Cart' : 'Add to Cart'}"
                        >
                            <i data-lucide="${inCart ? 'check' : 'shopping-cart'}" class="w-4 h-4"></i>
                        </button>

                        <button 
                            onclick="handleBuyNowClick(${book.id})" 
                            class="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1"
                        >
                            <span>Buy</span>
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function setupSearchListeners() {
    const searchDesk = document.getElementById('searchInput');
    if (searchDesk) {
        searchDesk.addEventListener('input', () => {
            renderCatalog();
        });
    }
}

// --- Cart System ---

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
            <div class="text-center py-16 text-slate-400">
                <i data-lucide="shopping-cart" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i>
                <p class="font-bold text-slate-700 text-sm">Your cart is empty</p>
                <p class="text-xs text-slate-400 mt-1">Browse our bestsellers and add ebooks to your cart.</p>
            </div>
        `;
        totalEl.innerText = `${storeCurrency}0.00`;
        document.getElementById('cartCheckoutBtn').disabled = true;
        lucide.createIcons();
        return;
    }

    document.getElementById('cartCheckoutBtn').disabled = false;
    let total = 0;

    list.innerHTML = cart.map(item => {
        total += item.price;
        return `
            <div class="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div class="flex items-center gap-3">
                    <img src="${item.cover || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-16 object-cover rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                    <div>
                        <h4 class="font-bold text-xs text-slate-900 line-clamp-1">${item.title}</h4>
                        <div class="text-[11px] text-slate-500">By ${item.author}</div>
                        <div class="text-xs font-extrabold text-brand-700 mt-1">${storeCurrency}${item.price.toFixed(2)}</div>
                    </div>
                </div>
                <button onclick="toggleAddToCart(${item.id})" class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Remove">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }).join('');

    totalEl.innerText = `${storeCurrency}${total.toFixed(2)}`;
    lucide.createIcons();
}

function proceedCartToCheckout() {
    if (cart.length === 0) return;

    // MANDATORY LOGIN CHECK
    if (!currentCustomer) {
        pendingCheckoutAction = () => proceedCartToCheckout();
        openUnifiedAuthModal('Please sign in or create an account to complete your cart checkout.');
        return;
    }

    closeCartDrawer();
    let bookIds = cart.map(item => item.id);
    startRazorpayPaymentFlow({ mode: 'cart', ebookIds: bookIds });
}

// --- MANDATORY LOGIN GUARD & BUY NOW FLOW ---

function handleBuyNowClick(ebookId) {
    if (!currentCustomer) {
        pendingCheckoutAction = () => handleBuyNowClick(ebookId);
        openUnifiedAuthModal('Please sign in or create an account to purchase this ebook.');
        return;
    }

    startRazorpayPaymentFlow({ mode: 'single', ebookId: ebookId });
}

// --- RAZORPAY PRODUCTION PAYMENT FLOW ---

async function startRazorpayPaymentFlow(context) {
    try {
        // 1. Create Order on Backend (Locked Price)
        const payload = {
            ebook_id: context.ebookId,
            ebook_ids: context.ebookIds || [context.ebookId],
            customer_name: currentCustomer.name,
            customer_email: currentCustomer.email,
            customer_whatsapp: currentCustomer.phone
        };

        const res = await fetch('/api/payment/razorpay/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const orderInfo = await res.json();
        if (!res.ok) {
            alert(orderInfo.detail || 'Failed to initialize payment.');
            return;
        }

        // 2. Open Standard Razorpay Checkout Window
        const options = {
            key: orderInfo.key_id || 'rzp_live_9035630901',
            amount: orderInfo.amount,
            currency: 'INR',
            name: 'EBookVault (Rohit Tak)',
            description: orderInfo.description,
            order_id: orderInfo.order_id,
            prefill: {
                name: currentCustomer.name,
                email: currentCustomer.email,
                contact: currentCustomer.phone
            },
            theme: {
                color: '#4f46e5'
            },
            handler: async function (response) {
                await verifyAndDeliverRazorpayPayment({
                    ...context,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                });
            },
            modal: {
                ondismiss: function() {
                    console.log('Payment modal dismissed');
                }
            }
        };

        if (typeof Razorpay !== 'undefined') {
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (resp){
                alert(`Payment Failed: ${resp.error.description}`);
            });
            rzp.open();
        } else {
            // Fallback verification if standard script blocked
            await verifyAndDeliverRazorpayPayment(context);
        }

    } catch (err) {
        console.error('Razorpay flow error', err);
        alert('Network error while launching Razorpay.');
    }
}

async function verifyAndDeliverRazorpayPayment(context) {
    try {
        const payload = {
            ebook_id: context.ebookId,
            ebook_ids: context.ebookIds || [context.ebookId],
            customer_name: currentCustomer.name,
            customer_email: currentCustomer.email,
            customer_whatsapp: currentCustomer.phone,
            razorpay_payment_id: context.razorpay_payment_id || 'pay_' + Date.now(),
            razorpay_order_id: context.razorpay_order_id || 'order_' + Date.now()
        };

        const res = await fetch('/api/payment/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) {
            alert(result.detail || 'Payment verification failed.');
            return;
        }

        // Clear cart if cart checkout
        if (context.mode === 'cart') {
            cart = [];
            saveCart();
        }

        showSuccessModal(result);
    } catch (err) {
        console.error('Verification error', err);
        alert('Error completing ebook delivery.');
    }
}

function showSuccessModal(data) {
    document.getElementById('successCustomerGreeting').innerText = `Thank you, ${data.customer_name}! Your payment is verified.`;
    const listContainer = document.getElementById('successOrdersListContainer');

    if (data.orders && Array.isArray(data.orders)) {
        listContainer.innerHTML = data.orders.map(o => `
            <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                    <div class="font-bold text-xs text-slate-800 line-clamp-1">${o.ebook_title}</div>
                    <div class="text-[10px] font-mono text-brand-600">${o.order_code}</div>
                </div>
                <div class="flex items-center gap-2">
                    <a href="${o.download_url}" target="_blank" class="px-2.5 py-1.5 bg-brand-600 text-white text-[11px] font-bold rounded-lg transition">
                        Download
                    </a>
                </div>
            </div>
        `).join('');

        document.getElementById('successDirectDownloadBtn').href = data.orders[0].download_url;
        document.getElementById('successWhatsAppBtn').href = data.orders[0].whatsapp_url;
    } else {
        listContainer.innerHTML = `
            <div class="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span class="text-slate-500">Order ID:</span>
                <span class="font-mono font-bold text-slate-800">${data.order_code}</span>
            </div>
            <div class="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span class="text-slate-500">Ebook:</span>
                <span class="font-bold text-slate-800">${data.ebook_title}</span>
            </div>
            <div class="text-xs text-slate-600 pt-1">
                Ebook has been attached & sent to <strong>${data.customer_email}</strong>.
            </div>
        `;
        document.getElementById('successDirectDownloadBtn').href = data.download_url;
        document.getElementById('successWhatsAppBtn').href = data.whatsapp_url;
    }

    openModal('orderSuccessModal');
}

// --- UNIFIED AUTHENTICATION (Admin Auto-Redirect + Customer Login) ---

function updateAuthNavbar() {
    const container = document.getElementById('authNavContainer');
    if (currentCustomer) {
        container.innerHTML = `
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-slate-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-xl hidden sm:inline">
                    👤 ${currentCustomer.name}
                </span>
                <button onclick="handleCustomerLogout()" class="px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-100 rounded-xl transition" title="Log Out">
                    <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button 
                onclick="openUnifiedAuthModal()" 
                class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
            >
                <i data-lucide="user" class="w-3.5 h-3.5"></i>
                <span>Sign In</span>
            </button>
        `;
    }
    lucide.createIcons();
}

function openUnifiedAuthModal(notice = '') {
    const noticeEl = document.getElementById('mandatoryLoginNotice');
    const msgEl = document.getElementById('mandatoryLoginMessage');
    if (notice) {
        msgEl.innerText = notice;
        noticeEl.classList.remove('hidden');
    } else {
        noticeEl.classList.add('hidden');
    }
    openModal('unifiedAuthModal');
}

function toggleSignupSection() {
    const formLogin = document.getElementById('unifiedLoginForm');
    const formSignup = document.getElementById('customerSignupForm');
    const title = document.getElementById('authModalTitle');
    const prompt = document.getElementById('toggleAuthPrompt');

    if (formSignup.classList.contains('hidden')) {
        formLogin.classList.add('hidden');
        formSignup.classList.remove('hidden');
        title.innerText = 'Create Customer Account';
        prompt.innerHTML = `Already have an account? <button onclick="toggleSignupSection()" class="text-brand-600 font-bold hover:underline">Sign In</button>`;
    } else {
        formSignup.classList.add('hidden');
        formLogin.classList.remove('hidden');
        title.innerText = 'Sign In to Your Account';
        prompt.innerHTML = `Don't have an account? <button onclick="toggleSignupSection()" class="text-brand-600 font-bold hover:underline">Create Account</button>`;
    }
}

async function handleUnifiedLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('unifiedLoginBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Verifying...`;

    const identifier = document.getElementById('unifiedLoginInput').value.trim();
    const password = document.getElementById('unifiedPasswordInput').value.trim();

    try {
        const res = await fetch('/api/auth/unified-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username_or_email: identifier, password: password })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Invalid login credentials.');
            return;
        }

        // 1. If Admin -> Automatically Redirect to Admin Panel!
        if (data.role === 'admin') {
            localStorage.setItem('ebookvault_admin_token', data.token);
            btn.innerHTML = `✅ Success! Opening Admin Panel...`;
            setTimeout(() => {
                window.location.href = data.redirect || '/admin.html';
            }, 500);
            return;
        }

        // 2. If Customer -> Update Customer Session
        customerToken = data.token;
        currentCustomer = data.user;
        localStorage.setItem('ebookvault_customer_token', customerToken);
        localStorage.setItem('ebookvault_customer_user', JSON.stringify(currentCustomer));

        closeModal('unifiedAuthModal');
        updateAuthNavbar();

        // Resume pending buy action if exists
        if (pendingCheckoutAction) {
            const act = pendingCheckoutAction;
            pendingCheckoutAction = null;
            act();
        }
    } catch (err) {
        console.error('Unified login error', err);
        alert('Network error during login.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Sign In`;
    }
}

async function handleCustomerSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    try {
        const res = await fetch('/api/customer/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Signup failed.');
            return;
        }

        customerToken = data.token;
        currentCustomer = data.user;
        localStorage.setItem('ebookvault_customer_token', customerToken);
        localStorage.setItem('ebookvault_customer_user', JSON.stringify(currentCustomer));

        closeModal('unifiedAuthModal');
        updateAuthNavbar();

        if (pendingCheckoutAction) {
            const act = pendingCheckoutAction;
            pendingCheckoutAction = null;
            act();
        }
    } catch (err) {
        console.error('Signup error', err);
        alert('Network error during signup.');
    }
}

function handleGoogleSignInDemo() {
    const demoGoogleUser = {
        name: "Google Reader",
        email: "reader.google@example.com",
        phone: "+919876543210"
    };
    customerToken = "google_token_" + Date.now();
    currentCustomer = demoGoogleUser;
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
    localStorage.removeItem('ebookvault_customer_token');
    localStorage.removeItem('ebookvault_customer_user');
    updateAuthNavbar();
}

// --- Help & FAQ ---

function toggleFaq(num) {
    const content = document.getElementById(`faqContent-${num}`);
    const icon = document.getElementById(`faqIcon-${num}`);
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
    }
}

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
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Submitting...`;

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
        const data = await res.json();
        if (res.ok) {
            alert('Support ticket submitted! Rohit Tak will review and contact you on WhatsApp.');
            document.getElementById('helpSupportForm').reset();
            closeModal('helpModal');
        } else {
            alert(data.detail || 'Failed to submit ticket.');
        }
    } catch (err) {
        console.error('Support ticket error', err);
        alert('Network error while submitting ticket.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-4 h-4 mr-2"></i><span>Submit Support Request</span>`;
        lucide.createIcons();
    }
}

// --- Modal & Detail Helpers ---

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

function openEbookDetail(ebookId) {
    const book = catalogEbooks.find(b => b.id === ebookId);
    if (!book) return;

    document.getElementById('modalCategory').innerText = book.category || 'General';
    const format = (book.file_format || 'pdf').toUpperCase();
    const badge = document.getElementById('modalFormatBadge');
    badge.innerText = format;
    badge.className = `px-2.5 py-1 rounded-full text-xs font-bold uppercase ${format.includes('DOC') ? 'badge-docx' : 'badge-pdf'}`;

    document.getElementById('modalCover').src = book.cover_image || '/uploads/covers/python-ai-cover.jpg';
    document.getElementById('modalTitle').innerText = book.title;
    document.getElementById('modalAuthor').innerText = `By ${book.author}`;
    document.getElementById('modalDescription').innerText = book.description || 'No description available.';

    const price = book.sale_price && book.sale_price > 0 ? book.sale_price : book.price;
    document.getElementById('modalPrice').innerText = `${storeCurrency}${price.toFixed(2)}`;
    
    const origPriceEl = document.getElementById('modalOriginalPrice');
    if (book.sale_price && book.sale_price < book.price) {
        origPriceEl.innerText = `${storeCurrency}${book.price.toFixed(2)}`;
        origPriceEl.classList.remove('hidden');
    } else {
        origPriceEl.classList.add('hidden');
    }

    document.getElementById('modalSampleText').innerText = book.sample_text || 'No sample excerpt provided.';
    
    document.getElementById('modalAddCartBtn').onclick = () => {
        toggleAddToCart(book.id);
        closeModal('ebookDetailModal');
        openCartDrawer();
    };

    document.getElementById('modalBuyBtn').onclick = () => {
        closeModal('ebookDetailModal');
        handleBuyNowClick(book.id);
    };

    openModal('ebookDetailModal');
}

// "Find My Purchases" Customer Lookup
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
    const resultsArea = document.getElementById('lookupResultsArea');
    
    resultsArea.innerHTML = `
        <div class="py-8 text-center text-slate-400">
            <span class="inline-block animate-spin text-brand-600 mb-2">⏳</span>
            <p>Searching purchased orders...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/customer/orders?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            resultsArea.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <p class="font-bold text-slate-700">No purchases found for "${query}"</p>
                    <p class="text-xs text-slate-400 mt-1">Please verify the email address or phone number used during checkout.</p>
                </div>
            `;
            return;
        }

        resultsArea.innerHTML = orders.map(order => `
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <img src="${order.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-16 object-cover rounded-lg border border-slate-200 shadow-sm">
                    <div>
                        <div class="text-[10px] font-bold text-brand-600 uppercase font-mono">${order.order_code}</div>
                        <h4 class="font-bold text-sm text-slate-900 line-clamp-1">${order.ebook_title}</h4>
                        <div class="text-xs text-slate-500 mt-0.5">Purchased on ${new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <a 
                        href="${order.download_url}" 
                        target="_blank"
                        class="flex-1 sm:flex-none px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1"
                    >
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        <span>Download</span>
                    </a>
                    <a 
                        href="${order.whatsapp_url}" 
                        target="_blank"
                        class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                        title="Send via WhatsApp"
                    >
                        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                </div>
            </div>
        `).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Customer lookup error', err);
        resultsArea.innerHTML = `<p class="text-center py-6 text-red-500 text-sm">Failed to search purchases.</p>`;
    }
}
