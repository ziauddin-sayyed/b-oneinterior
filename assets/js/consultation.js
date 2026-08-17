/* Consultation Modal logic — shared across all pages with the bottom nav.
   Wrapped in an IIFE so its top-level consts never collide with page globals
   (e.g. product.html's own copy). The onclick handlers used in the HTML
   (openConsultationModal / closeConsultationModal / sendConsultation) are
   exposed on window. */
(function () {
    "use strict";

    const DJANGO_API_URL = window.API_BASE_URL + "/api/verify-otp/";
    const CONV_API_BASE = window.API_BASE_URL;
    const GRAPHQL_URL = window.API_BASE_URL + "/graphql/";

    let consultMsg91ReqId = '';
    let consultVerifiedMobile = '';
    let consultResendCooldown = 30;
    let consultResendTimer = null;

    const CONSULT_OPTIONS = [
        "🏠 Full Home Interior",
        "🛋️ Living Room",
        "🛏️ Bedroom",
        "🍳 Modular Kitchen",
        "🚿 Bathroom",
        "🏢 Office / Commercial",
        "🏗️ Builder / Developer",
        "🏬 Mall / Commercial Complex",
        "🏘️ Society / Apartment",
        "🏨 Hotel / Restaurant",
        "🏥 Hospital / Clinic",
        "🏫 School / College",
        "🏭 Factory / Warehouse",
        "🏛️ Government Project"
    ];

    function isUserLoggedIn() {
        const token = localStorage.getItem('saleor_auth_token');
        return !!token;
    }

    async function refreshToken() {
        const refreshToken = localStorage.getItem('saleor_refresh_token');
        if (!refreshToken) return false;

        const mutation = `
            mutation {
                tokenRefresh(refreshToken: "${refreshToken}") {
                    token
                    errors {
                        field
                        message
                    }
                }
            }
        `;

        try {
            const res = await fetch(GRAPHQL_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: mutation })
            });
            const json = await res.json();
            if (json.data?.tokenRefresh?.token) {
                localStorage.setItem('saleor_auth_token', json.data.tokenRefresh.token);
                return true;
            }
        } catch (e) {
            console.error("Error refreshing token:", e);
        }
        return false;
    }

    function renderConsultOptions() {
        const list = document.getElementById('consultOptionList');
        if (!list) return;
        list.innerHTML = CONSULT_OPTIONS.map((opt, i) => `
            <button type="button" onclick="sendConsultation(${i})"
                class="w-full text-left flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm font-bold hover:border-gold-500 hover:bg-gold-500/10 transition active:scale-[0.98]">
                <span>${opt}</span>
            </button>
        `).join('');
    }

    function openConsultationModal() {
        const modal = document.getElementById('consultationModal');
        if (!modal) return;
        document.getElementById('consultFormMsg').classList.add('hidden');
        document.getElementById('consultSuccessSection').classList.add('hidden');
        if (isUserLoggedIn()) {
            document.getElementById('consultLoginSection').classList.add('hidden');
            document.getElementById('consultFormSection').classList.remove('hidden');
            renderConsultOptions();
        } else {
            document.getElementById('consultLoginSection').classList.remove('hidden');
            document.getElementById('consultFormSection').classList.add('hidden');
            const phoneEl = document.getElementById('consultPhoneInput');
            if (phoneEl) phoneEl.value = '';
            document.getElementById('consultStepPhone').classList.remove('hidden');
            document.getElementById('consultStepOtp').classList.add('hidden');
            hideConsultLoginMessages();
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeConsultationModal() {
        const modal = document.getElementById('consultationModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function hideConsultLoginMessages() {
        document.getElementById('consultLoginError').classList.add('hidden');
        document.getElementById('consultLoginSuccess').classList.add('hidden');
    }

    function showConsultError(msg) {
        const el = document.getElementById('consultLoginError');
        el.textContent = msg;
        el.classList.remove('hidden');
        document.getElementById('consultLoginSuccess').classList.add('hidden');
    }

    function showConsultSuccess(msg) {
        const el = document.getElementById('consultLoginSuccess');
        el.textContent = msg;
        el.classList.remove('hidden');
        document.getElementById('consultLoginError').classList.add('hidden');
    }

    // MSG91 SDK load & init
    (function () {
        if (window.__msg91SdkInitiated) return;
        window.__msg91SdkInitiated = true;
        window.msg91Config = {
            widgetId: "3666416d5868313933373531",
            tokenAuth: "545332T55g909s1UHa6a3fdfa2P1",
            exposeMethods: true,
            success: function (data) {
                if (data && typeof data === 'object') {
                    var r = data.reqId || data.requestId || data.req_id || (data.data && (data.data.reqId || data.data.requestId || data.data.req_id));
                    if (r) consultMsg91ReqId = r;
                }
            },
            failure: function (error) {
                console.log('MSG91 client failure callback', error);
            }
        };
        function initMsg91() {
            if (typeof window.initSendOTP === 'function') {
                try {
                    window.initSendOTP(window.msg91Config);
                    console.log('MSG91 widget initialized');
                    return true;
                } catch (err) {
                    console.error('Error during initSendOTP:', err);
                    return false;
                }
            }
            return false;
        }
        function initWithRetry(maxRetries) {
            if (initMsg91()) return;
            if (maxRetries > 0) {
                setTimeout(function () { initWithRetry(maxRetries - 1); }, 500);
            }
        }
        if (typeof window.initSendOTP === 'function') {
            initMsg91();
        } else {
            var script = document.createElement('script');
            script.src = 'https://verify.msg91.com/otp-provider.js';
            script.async = true;
            script.onload = function () { initWithRetry(40); };
            script.onerror = function () { console.error('Failed to load MSG91 SDK'); };
            document.body.appendChild(script);
        }
    })();

    function waitForMsg91Method(methodName, callback, maxRetries) {
        if (maxRetries === undefined) maxRetries = 40;
        let attempts = 0;
        const check = function () {
            if (typeof window[methodName] === 'function') {
                callback(true);
            } else if (attempts < maxRetries) {
                attempts++;
                setTimeout(check, 250);
            } else {
                callback(false);
            }
        };
        check();
    }

    function getConsultOtpValue() {
        let val = '';
        document.querySelectorAll('.consult-otp-input').forEach(inp => val += inp.value);
        return val;
    }

    function clearConsultOtpInputs() {
        const inputs = document.querySelectorAll('.consult-otp-input');
        inputs.forEach(inp => inp.value = '');
        if (inputs[0]) inputs[0].focus();
    }

    function startConsultResendTimer() {
        consultResendCooldown = 30;
        const btn = document.getElementById('consultResendOtpBtn');
        const timerEl = document.getElementById('consultResendTimer');
        btn.disabled = true;
        timerEl.textContent = consultResendCooldown;
        if (consultResendTimer) clearInterval(consultResendTimer);
        consultResendTimer = setInterval(() => {
            consultResendCooldown--;
            timerEl.textContent = consultResendCooldown;
            if (consultResendCooldown <= 0) {
                clearInterval(consultResendTimer);
                consultResendTimer = null;
                btn.disabled = false;
                btn.innerHTML = 'Resend OTP';
            }
        }, 1000);
    }

    function setConsultSendOtpLoading(loading) {
        document.getElementById('consultSendOtpBtn').disabled = loading;
        document.getElementById('consultSendOtpText').textContent = loading ? 'Sending OTP...' : 'Send OTP';
        document.getElementById('consultSendOtpSpinner').classList.toggle('hidden', !loading);
    }

    function setConsultVerifyOtpLoading(loading) {
        document.getElementById('consultVerifyOtpBtn').disabled = loading;
        document.getElementById('consultVerifyOtpText').textContent = loading ? 'Verifying OTP...' : 'Verify OTP';
        document.getElementById('consultVerifyOtpSpinner').classList.toggle('hidden', !loading);
    }

    // Send OTP
    document.getElementById('consultSendOtpBtn').addEventListener('click', function () {
        const mobile = document.getElementById('consultPhoneInput').value.trim();
        if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
            showConsultError('Please enter a valid 10-digit mobile number');
            return;
        }
        hideConsultLoginMessages();
        setConsultSendOtpLoading(true);
        const sendOtpTimeout = setTimeout(function () { setConsultSendOtpLoading(false); }, 15000);

        waitForMsg91Method('sendOtp', function (ready) {
            if (!ready) {
                showConsultError('Verification service is not ready. Please try again in a moment.');
                setConsultSendOtpLoading(false);
                return;
            }
            try {
                window.sendOtp('91' + mobile,
                    function (data) {
                        clearTimeout(sendOtpTimeout);
                        try {
                            if (typeof data === 'object' && data) {
                                consultMsg91ReqId = data.reqId || data.requestId || data.req_id || data.message || '';
                            }
                        } catch (e) { console.warn(e); }
                        consultVerifiedMobile = mobile;
                        document.getElementById('consultDisplayPhone').textContent = '+91 ' + mobile;
                        document.getElementById('consultStepPhone').classList.add('hidden');
                        document.getElementById('consultStepOtp').classList.remove('hidden');
                        clearConsultOtpInputs();
                        startConsultResendTimer();
                        hideConsultLoginMessages();
                        setConsultSendOtpLoading(false);
                    },
                    function (errorData) {
                        clearTimeout(sendOtpTimeout);
                        showConsultError((errorData && errorData.message) || 'Failed to send OTP. Please check your number.');
                        setConsultSendOtpLoading(false);
                    }
                );
            } catch (e) {
                clearTimeout(sendOtpTimeout);
                showConsultError('Failed to send OTP. Please try again.');
                setConsultSendOtpLoading(false);
            }
        });
    });

    // Change phone number
    document.getElementById('consultChangePhoneBtn').addEventListener('click', function () {
        document.getElementById('consultStepOtp').classList.add('hidden');
        document.getElementById('consultStepPhone').classList.remove('hidden');
        if (consultResendTimer) {
            clearInterval(consultResendTimer);
            consultResendTimer = null;
        }
        hideConsultLoginMessages();
    });

    // Resend OTP
    document.getElementById('consultResendOtpBtn').addEventListener('click', function () {
        if (this.disabled) return;
        hideConsultLoginMessages();
        waitForMsg91Method('retryOtp', function (ready) {
            if (!ready) {
                showConsultError('Verification service is not ready.');
                return;
            }
            window.retryOtp(consultMsg91ReqId || '11',
                function (data) {
                    try {
                        if (typeof data === 'object' && data) {
                            consultMsg91ReqId = data.reqId || data.requestId || data.req_id || consultMsg91ReqId;
                        }
                    } catch (e) { }
                    startConsultResendTimer();
                    clearConsultOtpInputs();
                },
                function (errorData) {
                    showConsultError((errorData && errorData.message) || 'Failed to resend OTP.');
                }
            );
        });
    });

    // Verify OTP
    document.getElementById('consultVerifyOtpBtn').addEventListener('click', async function () {
        const otp = getConsultOtpValue();
        if (otp.length !== 6) {
            showConsultError('Please enter the complete 6-digit OTP');
            return;
        }
        hideConsultLoginMessages();
        setConsultVerifyOtpLoading(true);

        if (!consultMsg91ReqId) {
            showConsultError('Session expired. Please request a new OTP.');
            setConsultVerifyOtpLoading(false);
            return;
        }
        const mobile = document.getElementById('consultPhoneInput').value.trim();
        const payload = {
            tokenAuth: "545332T55g909s1UHa6a3fdfa2P1",
            otp: otp,
            identifier: mobile,
            widgetId: "3666416d5868313933373531",
            reqId: consultMsg91ReqId
        };

        try {
            const res = await fetch(DJANGO_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || 'Verification failed');
            }
            const data = await res.json();

            const token = data.token || data.access || '';
            if (!token) {
                showConsultError('Login failed: no token returned.');
                setConsultVerifyOtpLoading(false);
                return;
            }

            localStorage.setItem('saleor_auth_token', token);
            localStorage.setItem('saleor_refresh_token', data.refreshToken || data.refresh || '');
            localStorage.setItem('saleor_csrf_token', data.csrfToken || '');
            if (data.user) {
                localStorage.setItem('saleor_user_email', data.user.email || '');
                localStorage.setItem('saleor_user_name',
                    ((data.user.firstName || '') + ' ' + (data.user.lastName || '')).trim() || data.user.email || ''
                );
                localStorage.setItem('saleor_user_is_staff', data.user.isStaff || false);
            }

            showConsultSuccess('Login successful!');

            document.getElementById('consultLoginSection').classList.add('hidden');
            document.getElementById('consultFormSection').classList.remove('hidden');
            renderConsultOptions();
        } catch (err) {
            console.error('Verify OTP error:', err);
            showConsultError(err.message || 'Invalid or expired OTP.');
            setConsultVerifyOtpLoading(false);
        }
    });

    // OTP input auto-advance
    const consultOtpInputs = document.querySelectorAll('.consult-otp-input');
    consultOtpInputs.forEach(function (inp, idx) {
        inp.addEventListener('input', function () {
            if (this.value && idx < consultOtpInputs.length - 1) {
                consultOtpInputs[idx + 1].focus();
            }
        });
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) {
                consultOtpInputs[idx - 1].focus();
            }
        });
    });
    const consultPhoneInput = document.getElementById('consultPhoneInput');
    if (consultPhoneInput) {
        consultPhoneInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                document.getElementById('consultSendOtpBtn').click();
            }
        });
    }

    // Send consultation for a selected option
    async function sendConsultation(optionIndex) {
        const msgEl = document.getElementById('consultFormMsg');
        const option = CONSULT_OPTIONS[optionIndex];
        if (!option) return;

        const token = localStorage.getItem('saleor_auth_token');
        if (!token) {
            msgEl.textContent = 'Please login first.';
            msgEl.className = 'mt-3 text-sm text-red-400';
            msgEl.classList.remove('hidden');
            return;
        }

        let authToken = token;
        if (localStorage.getItem('saleor_refresh_token')) {
            try {
                await refreshToken();
                authToken = localStorage.getItem('saleor_auth_token') || token;
            } catch (e) {
                console.warn('Token refresh failed:', e);
            }
        }

        const content = `[${option}]\n`;

        try {
            const res = await fetch(`${CONV_API_BASE}/api/conversation/messages/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ content })
            });
            if (res.status === 429) {
                const err = await res.json();
                msgEl.textContent = err.error || 'Rate limited. Please wait.';
                msgEl.className = 'mt-3 text-sm text-red-400';
                msgEl.classList.remove('hidden');
                return;
            }
            if (res.status === 401) {
                msgEl.textContent = 'Unauthorized. Please login again and retry.';
                msgEl.className = 'mt-3 text-sm text-red-400';
                msgEl.classList.remove('hidden');
                return;
            }
            if (!res.ok) {
                msgEl.textContent = 'Failed to send message.';
                msgEl.className = 'mt-3 text-sm text-red-400';
                msgEl.classList.remove('hidden');
                return;
            }

            document.getElementById('consultFormSection').classList.add('hidden');
            document.getElementById('consultSuccessSection').classList.remove('hidden');
        } catch (e) {
            msgEl.textContent = 'Network error. Try again.';
            msgEl.className = 'mt-3 text-sm text-red-400';
            msgEl.classList.remove('hidden');
        }
    }

    // Expose to global scope for the HTML onclick="" handlers
    window.openConsultationModal = openConsultationModal;
    window.closeConsultationModal = closeConsultationModal;
    window.sendConsultation = sendConsultation;
})();
