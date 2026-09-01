// Product Details Page Logic

let currentEbook = null;
let selectedRating = 5;
let appliedCoupon = null;
let lockedPrice = 0;

let customerToken = localStorage.getItem('qelvoria_customer_token') || localStorage.getItem('ebookvault_customer_token') || '';
let currentCustomer = null;
try {
    currentCustomer = JSON.parse(localStorage.getItem('qelvoria_customer') || localStorage.getItem('ebookvault_customer_user') || 'null');
} catch (e) {
    currentCustomer = null;
}
let pendingAction = null;

document.addEventListener('DOMContentLoaded', async () => {
    updateAuthNavbar();
    updateCartBadge();
    await loadStoreInfo();
    const urlParams = new URLSearchParams(window.location.search);
    const ebookParam = urlParams.get('id') || urlParams.get('slug') || '1';
    await loadEbookDetails(ebookParam);
});

async function loadStoreInfo() {
    try {
        const res = await fetch('/api/store-info');
        const data = await res.json();

        // 1. Dynamic Announcement Bar
        const annBar = document.getElementById('topAnnouncementBar');
        if (annBar) {
            if (data.announcement_enabled === false) {
                annBar.classList.add('hidden');
            } else {
                annBar.classList.remove('hidden');
                const annText = document.getElementById('announcementTextContent');
                if (annText && data.announcement_text) {
                    const coupon = data.announcement_coupon || 'QELVORIA20';
                    const link = data.announcement_link || '/#catalog';
                    annText.innerHTML = `
                        <a href="${link}" class="hover:underline flex items-center gap-1.5 flex-wrap justify-center">
                            <span>${data.announcement_text}</span>
                            ${coupon ? `<strong class="font-mono bg-white text-slate-950 font-bold px-1.5 py-0.5 rounded text-[11px]">${coupon}</strong>` : ''}
                        </a>
                    `;
                }
            }
        }

        // 2. Dynamic Social Links
        const ig = document.getElementById('socialLinkInstagram');
        if (ig && data.social_instagram) ig.href = data.social_instagram;
        const yt = document.getElementById('socialLinkYoutube');
        if (yt && data.social_youtube) yt.href = data.social_youtube;
        const tw = document.getElementById('socialLinkTwitter');
        if (tw && data.social_twitter) tw.href = data.social_twitter;
        const li = document.getElementById('socialLinkLinkedin');
        if (li && data.social_linkedin) li.href = data.social_linkedin;
        const wa = document.getElementById('socialLinkWhatsapp');
        if (wa && data.social_whatsapp) wa.href = data.social_whatsapp;

        // 3. Dynamic Chatbot Preset Queries
        if (data.chat_presets && Array.isArray(data.chat_presets)) {
            window.qelvoriaChatPresets = data.chat_presets;
            if (window.qelvoriaChat && window.qelvoriaChat.updatePresets) {
                window.qelvoriaChat.updatePresets(data.chat_presets);
            }
        }

        lucide.createIcons();
    } catch (e) {
        console.error('Store info error on book page', e);
    }
}

async function loadEbookDetails(param) {
    try {
        const res = await fetch(`/api/ebooks/${param}`);
        if (!res.ok) {
            alert('Ebook not found.');
            window.location.href = '/';
            return;
        }
        currentEbook = await res.json();
        renderEbookDetails();
    } catch (e) {
        console.error('Failed to load ebook details', e);
    }
}

function renderEbookDetails() {
    if (!currentEbook) return;

    document.title = `${currentEbook.title} - QELVORIA Digital Publishing`;
    document.getElementById('breadcrumbTitle').innerText = currentEbook.title;

    document.getElementById('productCover').src = currentEbook.cover_image || '/uploads/covers/python-ai-cover.jpg';
    document.getElementById('productTitle').innerText = currentEbook.title;
    document.getElementById('productAuthor').innerText = currentEbook.author;
    document.getElementById('productCategory').innerText = currentEbook.category || 'General';

    const format = (currentEbook.file_format || 'pdf').toUpperCase();
    document.getElementById('productFormatBadge').innerText = format;
    document.getElementById('productDownloadsCount').innerText = `${currentEbook.downloads_count || 120}+ Downloads`;

    document.getElementById('productDescription').innerText = currentEbook.description || '';
    document.getElementById('productSampleText').innerText = currentEbook.sample_text || 'Sample preview included with purchase.';

    // Ratings
    document.getElementById('productRatingNum').innerText = currentEbook.avg_rating || '5.0';
    document.getElementById('productReviewCountText').innerText = `(${currentEbook.review_count || 0} reviews)`;

    // Pricing
    const salePrice = (currentEbook.sale_price && currentEbook.sale_price > 0 && currentEbook.sale_price < currentEbook.price) ? currentEbook.sale_price : currentEbook.price;
    lockedPrice = salePrice;

    document.getElementById('productFinalPrice').innerText = `₹${salePrice.toFixed(2)}`;
    if (currentEbook.sale_price && currentEbook.sale_price < currentEbook.price) {
        document.getElementById('productOrigPrice').innerText = `₹${currentEbook.price.toFixed(2)}`;
        document.getElementById('productOrigPrice').classList.remove('hidden');
        document.getElementById('productSaleBadge').classList.remove('hidden');
        const pct = Math.round(((currentEbook.price - currentEbook.sale_price) / currentEbook.price) * 100);
        document.getElementById('productDiscountPill').innerText = `${pct}% OFF`;
        document.getElementById('productDiscountPill').classList.remove('hidden');
    } else {
        document.getElementById('productOrigPrice').classList.add('hidden');
        document.getElementById('productDiscountPill').classList.add('hidden');
    }

    // External Marketplace Links (Google Books, Kindle, Apple Books)
    if (currentEbook.google_books_url) {
        const gb = document.getElementById('googleBooksLink');
        gb.href = currentEbook.google_books_url;
        gb.classList.remove('hidden');
    }
    if (currentEbook.kindle_url) {
        const kb = document.getElementById('kindleBooksLink');
        kb.href = currentEbook.kindle_url;
        kb.classList.remove('hidden');
    }
    if (currentEbook.apple_books_url) {
        const ab = document.getElementById('appleBooksLink');
        ab.href = currentEbook.apple_books_url;
        ab.classList.remove('hidden');
    }

    renderReviewsList(currentEbook.reviews || []);
    lucide.createIcons();
}

function renderReviewsList(reviews) {
    const grid = document.getElementById('reviewsListGrid');
    if (!reviews || reviews.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-8 text-center text-slate-500">
                <p class="font-bold text-slate-400">No reviews yet for this ebook.</p>
                <p class="text-xs text-slate-500 mt-1">Be the first verified reader to share your feedback!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = reviews.map(r => `
        <div class="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <div class="flex text-amber-400 text-xs">
                        ${'★'.repeat(r.rating || 5)}
                    </div>
                    ${r.is_ai_generated ? `
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-800 text-slate-200 border border-slate-700">
                            ⭐ Top Review
                        </span>
                    ` : `
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <i data-lucide="check" class="w-3 h-3"></i> Verified Buyer
                        </span>
                    `}
                </div>
                ${r.title ? `<h4 class="font-bold text-xs text-white line-clamp-1 mb-1">${r.title}</h4>` : ''}
                <p class="text-xs text-slate-300 leading-relaxed italic">"${r.review_text}"</p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span class="font-bold text-slate-400">${r.customer_name}</span>
                <span>${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

// --- Promo Code Application ---

async function handleApplyProductCoupon() {
    const code = document.getElementById('promoCodeInput').value.trim();
    const statusMsg = document.getElementById('couponStatusMessage');
    const basePrice = (currentEbook.sale_price && currentEbook.sale_price > 0 && currentEbook.sale_price < currentEbook.price) ? currentEbook.sale_price : currentEbook.price;

    if (!code) {
        statusMsg.innerText = 'Please enter a coupon code.';
        statusMsg.className = 'text-xs text-rose-400 block';
        return;
    }

    try {
        const res = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, amount: basePrice })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            appliedCoupon = data;
            lockedPrice = data.final_amount;
            document.getElementById('productFinalPrice').innerText = `₹${data.final_amount.toFixed(2)}`;
            statusMsg.innerHTML = `✅ <strong>${data.code}</strong> applied! You saved ₹${data.discount_amount.toFixed(2)}.`;
            statusMsg.className = 'text-xs text-emerald-400 block font-semibold';
        } else {
            appliedCoupon = null;
            lockedPrice = basePrice;
            document.getElementById('productFinalPrice').innerText = `₹${basePrice.toFixed(2)}`;
            statusMsg.innerText = `❌ ${data.detail || 'Invalid coupon code.'}`;
            statusMsg.className = 'text-xs text-rose-400 block';
        }
    } catch (e) {
        console.error('Coupon apply error', e);
        statusMsg.innerText = 'Error verifying coupon.';
        statusMsg.className = 'text-xs text-rose-400 block';
    }
}

// --- Cart Management Logic ---

let cart = [];
try {
    cart = JSON.parse(localStorage.getItem('qelvoria_cart') || localStorage.getItem('ebookvault_cart') || '[]');
} catch (e) {
    cart = [];
}
let cartAppliedCoupon = null;

function saveCart() {
    localStorage.setItem('qelvoria_cart', JSON.stringify(cart));
    localStorage.setItem('ebookvault_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const mobBadge = document.getElementById('mobileCartBadge');
    const count = cart.length;
    if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    }
    if (mobBadge) {
        mobBadge.innerText = count;
        if (count > 0) mobBadge.classList.remove('hidden');
        else mobBadge.classList.add('hidden');
    }
}

function handleProductAddToCart() {
    if (!currentEbook) return;
    const exists = cart.some(item => item.id === currentEbook.id);
    if (!exists) {
        cart.push({
            id: currentEbook.id,
            title: currentEbook.title,
            author: currentEbook.author,
            price: currentEbook.sale_price && currentEbook.sale_price > 0 ? currentEbook.sale_price : currentEbook.price,
            cover_image: currentEbook.cover_image || '/uploads/covers/python-ai-cover.jpg'
        });
        saveCart();
    }
    openCartDrawer();
}

function openCartDrawer() {
    renderCartDrawer();
    const backdrop = document.getElementById('cartDrawerBackdrop');
    const drawer = document.getElementById('cartDrawer');
    if (backdrop && drawer) {
        backdrop.classList.remove('hidden');
        setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
    }
    lucide.createIcons();
}

function closeCartDrawer() {
    const backdrop = document.getElementById('cartDrawerBackdrop');
    const drawer = document.getElementById('cartDrawer');
    if (backdrop && drawer) {
        drawer.classList.add('translate-x-full');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
}

function removeCartItem(id) {
    const idStr = String(id);
    const idNum = Number(id);
    cart = cart.filter(item => String(item.id) !== idStr && Number(item.id) !== idNum);
    saveCart();
    renderCartDrawer();
}
window.removeCartItem = removeCartItem;
window.removeFromCart = removeCartItem;

function renderCartDrawer() {
    const container = document.getElementById('cartItemsContainer');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <i data-lucide="shopping-cart" class="w-8 h-8"></i>
                </div>
                <h4 class="font-bold text-white text-sm">Your Cart is Empty</h4>
                <p class="text-xs text-slate-400 mt-1">Browse our bookstore catalog to add books.</p>
            </div>
        `;
        document.getElementById('cartSubtotalText').innerText = '₹0';
        document.getElementById('cartTotalText').innerText = '₹0';
        document.getElementById('cartDiscountRow').classList.add('hidden');
        document.getElementById('cartCheckoutBtn').disabled = true;
        lucide.createIcons();
        return;
    }

    document.getElementById('cartCheckoutBtn').disabled = false;

    let subtotal = 0;
    container.innerHTML = cart.map(item => {
        const itemPrice = Number(item.price) || 0;
        subtotal += itemPrice;
        return `
            <div class="flex items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <img src="${item.cover_image || item.cover || '/uploads/covers/python-ai-cover.jpg'}" alt="Book Cover" class="w-12 h-16 object-cover rounded-lg border border-slate-700 shrink-0">
                <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-bold text-white truncate">${item.title}</h5>
                    <p class="text-[10px] text-slate-400">${item.author || 'Author'}</p>
                    <span class="text-xs font-extrabold text-brand-400">₹${itemPrice.toFixed(2)}</span>
                </div>
                <button onclick="removeCartItem('${item.id}')" class="p-2 text-slate-500 hover:text-rose-400 transition" title="Remove from Cart">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }).join('');

    let discount = 0;
    if (cartAppliedCoupon) {
        if (cartAppliedCoupon.discount_type === 'percentage') {
            discount = Math.round((subtotal * cartAppliedCoupon.discount_value) / 100);
        } else {
            discount = Math.min(cartAppliedCoupon.discount_value, subtotal);
        }
    }

    const finalTotal = Math.max(1, subtotal - discount);

    document.getElementById('cartSubtotalText').innerText = `₹${subtotal}`;
    if (discount > 0) {
        document.getElementById('cartDiscountRow').classList.remove('hidden');
        document.getElementById('cartDiscountText').innerText = `-₹${discount}`;
    } else {
        document.getElementById('cartDiscountRow').classList.add('hidden');
    }
    document.getElementById('cartTotalText').innerText = `₹${finalTotal}`;
    lucide.createIcons();
}

async function handleApplyCartCoupon() {
    const input = document.getElementById('cartCouponInput');
    const code = input.value.trim().toUpperCase();
    const status = document.getElementById('cartCouponStatus');
    if (!code) return;

    let subtotal = cart.reduce((acc, i) => acc + i.price, 0);
    try {
        const res = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, amount: subtotal })
        });
        const data = await res.json();
        if (res.ok) {
            cartAppliedCoupon = data;
            status.innerText = `✅ Code '${data.code}' applied! Saved ₹${data.discount_amount}`;
            status.className = 'text-[11px] text-emerald-400 block font-semibold';
            renderCartDrawer();
        } else {
            cartAppliedCoupon = null;
            status.innerText = `❌ ${data.detail || 'Invalid coupon code.'}`;
            status.className = 'text-[11px] text-rose-400 block';
            renderCartDrawer();
        }
    } catch (e) {
        console.error('Coupon error', e);
    }
}

let pendingCheckoutMode = 'direct'; // 'direct' or 'cart'

function openCheckoutCustomerModal(mode = 'direct') {
    pendingCheckoutMode = mode;
    
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
        if (mode === 'cart') {
            btnText.innerText = `Proceed to Razorpay Payment`;
        } else if (currentEbook) {
            const price = currentEbook.sale_price && currentEbook.sale_price > 0 ? currentEbook.sale_price : currentEbook.price;
            btnText.innerText = `Proceed to Razorpay Payment (₹${price.toFixed(2)})`;
        }
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

    if (pendingCheckoutMode === 'cart') {
        closeCartDrawer();
        startRazorpayCartFlow();
    } else {
        startRazorpayDirectPayment();
    }
}

function proceedCartToCheckout() {
    if (cart.length === 0) return;
    openCheckoutCustomerModal('cart');
}

async function startRazorpayCartFlow() {
    try {
        const payload = {
            ebook_ids: cart.map(i => i.id),
            customer_name: currentCustomer.name || 'Valued Reader',
            customer_email: currentCustomer.email,
            customer_whatsapp: currentCustomer.phone || '',
            coupon_code: cartAppliedCoupon ? cartAppliedCoupon.code : null
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
            alert('Server is syncing. Please click Checkout again in a moment.');
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
                    console.log('Payment modal dismissed by reader.');
                }
            },
            handler: async function (response) {
                await verifyDirectPayment(response, orderInfo, true);
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
            await verifyDirectPayment({}, orderInfo, true);
        }

    } catch (e) {
        console.error('Cart checkout error', e);
        alert(`Checkout notice: ${e.message || 'Unable to proceed with checkout.'}`);
    }
}

// --- Checkout & Purchase Flow ---

function handleProductDirectBuy() {
    openCheckoutCustomerModal('direct');
}

async function startRazorpayDirectPayment() {
    const btn = document.getElementById('directBuyBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Initializing Payment...`;
    }

    try {
        const payload = {
            ebook_id: currentEbook.id,
            customer_name: currentCustomer.name || 'Valued Reader',
            customer_email: currentCustomer.email,
            customer_whatsapp: currentCustomer.phone || '',
            coupon_code: appliedCoupon ? appliedCoupon.code : null
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
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="zap" class="w-5 h-5 mr-2"></i><span>Buy Instant Digital Copy Now</span>`;
            lucide.createIcons();
            return;
        }

        if (!res.ok || !orderInfo.success) {
            alert(`⚠️ Checkout Notice: ${orderInfo.detail || orderInfo.message || 'Failed to initialize payment.'}`);
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="zap" class="w-5 h-5 mr-2"></i><span>Buy Instant Digital Copy Now</span>`;
            lucide.createIcons();
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
                    console.log('Payment modal dismissed by reader.');
                }
            },
            handler: async function (response) {
                await verifyDirectPayment(response, orderInfo, false);
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
            await verifyDirectPayment({}, orderInfo, false);
        }

    } catch (e) {
        console.error('Razorpay flow error', e);
        alert(`Checkout notice: ${e.message || 'Unable to proceed with checkout.'}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="zap" class="w-5 h-5 mr-2"></i><span>Buy Instant Digital Copy Now</span>`;
        lucide.createIcons();
    }
}

async function verifyDirectPayment(response, orderInfo, isCart = false) {
    try {
        const payload = {
            ebook_id: isCart ? null : currentEbook.id,
            ebook_ids: isCart ? cart.map(i => i.id) : [currentEbook.id],
            customer_name: currentCustomer ? currentCustomer.name : 'Valued Reader',
            customer_email: currentCustomer ? currentCustomer.email : '',
            customer_whatsapp: currentCustomer ? currentCustomer.phone : '',
            coupon_code: isCart ? (cartAppliedCoupon ? cartAppliedCoupon.code : null) : (appliedCoupon ? appliedCoupon.code : null),
            razorpay_payment_id: response.razorpay_payment_id || ('pay_' + Date.now()),
            razorpay_order_id: response.razorpay_order_id || orderInfo.order_id,
            razorpay_signature: response.razorpay_signature || null
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

        if (isCart) {
            cart = [];
            cartAppliedCoupon = null;
            saveCart();
        }

        document.getElementById('successCustomerGreeting').innerText = `Thank you, ${result.customer_name}! Your ebook is ready.`;
        const list = document.getElementById('successOrdersListContainer');
        list.innerHTML = result.orders.map(o => `
            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                    <div class="font-bold text-xs text-white">${o.ebook_title}</div>
                    <div class="text-[10px] font-mono text-brand-400">${o.order_code}</div>
                </div>
                <a href="${o.download_url}" target="_blank" class="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg transition">Download</a>
            </div>
        `).join('');

        document.getElementById('successDirectDownloadBtn').href = result.orders[0].download_url;
        document.getElementById('successWhatsAppBtn').href = result.orders[0].whatsapp_url;
        openModal('orderSuccessModal');

    } catch (e) {
        console.error('Verify error', e);
    }
}

// --- Leave Review Modal ---

function openLeaveReviewModal() {
    if (currentCustomer) {
        document.getElementById('reviewAuthorName').value = currentCustomer.name || '';
    }
    setReviewRating(5);
    openModal('leaveReviewModal');
}

function setReviewRating(stars) {
    selectedRating = stars;
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`star-${i}`);
        if (el) {
            el.className = i <= stars ? 'text-amber-400' : 'text-slate-700';
        }
    }
}

async function handleReviewSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitReviewBtn');
    btn.disabled = true;
    btn.innerText = 'Publishing...';

    const payload = {
        customer_name: document.getElementById('reviewAuthorName').value.trim(),
        customer_email: currentCustomer ? currentCustomer.email : '',
        rating: selectedRating,
        title: document.getElementById('reviewHeadline').value.trim(),
        review_text: document.getElementById('reviewMessage').value.trim()
    };

    try {
        const res = await fetch(`/api/ebooks/${currentEbook.id}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert('Thank you! Your review has been submitted.');
            closeModal('leaveReviewModal');
            loadEbookDetails(currentEbook.id);
        } else {
            alert(data.detail || 'Failed to submit review.');
        }
    } catch (err) {
        console.error('Review submit error', err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Publish Review';
    }
}

// --- Auth & OTP Helpers ---

function updateAuthNavbar() {
    const container = document.getElementById('authNavContainer');
    if (!container) return;

    if (currentCustomer) {
        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
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
        if (pendingAction) {
            const act = pendingAction;
            pendingAction = null;
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

        if (pendingAction) {
            const act = pendingAction;
            pendingAction = null;
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

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        lucide.createIcons();
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

