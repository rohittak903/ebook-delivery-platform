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
    const urlParams = new URLSearchParams(window.location.search);
    const ebookParam = urlParams.get('id') || urlParams.get('slug') || '1';
    await loadEbookDetails(ebookParam);
});

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
    const salePrice = currentEbook.sale_price && currentEbook.sale_price > 0 ? currentEbook.sale_price : currentEbook.price;
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
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-950 text-purple-300 border border-purple-800">
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
    const basePrice = currentEbook.sale_price && currentEbook.sale_price > 0 ? currentEbook.sale_price : currentEbook.price;

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
    if (!badge) return;
    const count = cart.length;
    badge.innerText = count;
    if (count > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
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
    cart = cart.filter(item => item.id !== id);
    saveCart();
    renderCartDrawer();
}

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
        subtotal += item.price;
        return `
            <div class="flex items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <img src="${item.cover_image}" alt="Book Cover" class="w-12 h-16 object-cover rounded-lg border border-slate-700 shrink-0">
                <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-bold text-white truncate">${item.title}</h5>
                    <p class="text-[10px] text-slate-400">${item.author || 'Author'}</p>
                    <span class="text-xs font-extrabold text-brand-400">₹${item.price}</span>
                </div>
                <button onclick="removeCartItem(${item.id})" class="p-2 text-slate-500 hover:text-rose-400 transition" title="Remove">
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

function proceedCartToCheckout() {
    if (cart.length === 0) return;

    if (!currentCustomer || !currentCustomer.email) {
        pendingAction = () => proceedCartToCheckout();
        openUnifiedAuthModal();
        return;
    }

    closeCartDrawer();
    startRazorpayCartFlow();
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
            key: orderInfo.key_id || 'rzp_test_TVvbybsCXuOmRn',
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
    if (!currentCustomer || !currentCustomer.email) {
        pendingAction = () => handleProductDirectBuy();
        openUnifiedAuthModal();
        return;
    }

    startRazorpayDirectPayment();
}

async function startRazorpayDirectPayment() {
    const btn = document.getElementById('directBuyBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Initializing Payment...`;

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
            key: orderInfo.key_id || 'rzp_test_TVvbybsCXuOmRn',
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
            document.getElementById('otpSentNotice').innerText = `OTP sent to ${phone}! (Demo Code: ${data.otp_demo})`;
            if (data.otp_demo) {
                document.getElementById('otpCodeInput').value = data.otp_demo;
            }
        } else {
            alert(data.detail || 'Failed to send OTP.');
        }
    } catch (e) {
        console.error('OTP error', e);
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
            if (pendingAction) {
                const act = pendingAction;
                pendingAction = null;
                act();
            }
        } else {
            alert(data.detail || 'OTP verification failed.');
        }
    } catch (e) {
        console.error('Verify error', e);
    }
}

function handleGoogleSignInDemo() {
    const demoUser = {
        name: "Google Reader",
        email: "reader.google@example.com",
        phone: "+919035630901"
    };
    customerToken = "google_token_" + Date.now();
    currentCustomer = demoUser;
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
