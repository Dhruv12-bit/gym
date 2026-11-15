// Universal Multi-Gym Cloud SaaS Edition
const firebaseConfig = {
  apiKey: "AIzaSyAWDPXozHC1ob9sOEg-pUbZB1ZKcKY3-BU",
  authDomain: "gym-manager-ae9d4.firebaseapp.com",
  projectId: "gym-manager-ae9d4",
  storageBucket: "gym-manager-ae9d4.firebasestorage.app",
  messagingSenderId: "771550906858",
  appId: "1:771550906858:web:0e7ff5ed0aa3208e2d8a93",
  measurementId: "G-4RRCVSL5N5"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DEVELOPER_PIN = "DHRUV2929"; 
const ROLES = { Member: ['scan', 'workout', 'myDiet', 'join'], Reception: ['directory', 'fees', 'offers', 'attendance', 'renewals'], Trainer: ['members', 'diet', 'trainerWorkouts'], Owner: ['report', 'inactive', 'settings'] };
const NAME = { scan: 'Check-In', workout: 'Workouts', myDiet: 'My Diet', join: 'Membership', directory: 'Members', fees: 'Fees & Rates', offers: 'Coupons', attendance: 'Attendance', renewals: 'Renewals', members: 'Clients', diet: 'Diet Builder', trainerWorkouts: 'Workouts', report: 'Analytics', inactive: 'Follow-Up', settings: 'Gym Setup' };

function getInitialData() {
  return {
    gym: { name: 'Unconfigured Gym', code: 'GY', branch: 'Main Branch', upiId: 'gym@upi', ptMonthlyRate: 1500, plans: { 1: { n: '1 Month Standard', p: 1500, m: 1 }, 3: { n: '3 Months Pro', p: 3600, m: 3 }, 12: { n: '12 Months Elite', p: 11400, m: 12 } } },
    coupons: [], staff: { Reception: { name: 'Reception Desk', phone: '1111111111' }, Trainer: { name: 'Head Trainer', phone: '2222222222' }, Owner: { name: 'Gym Owner', phone: '3333333333' } },
    role: 'Owner', loggedInUser: null, screen: 'login', mob: '', generatedOtp: '', plan: 3, cp: '', feeTrainerReq: true, feeTrainerMonths: 1, customFeeAmount: '', recCouponCode: '', mode: 'UPI', split: 'Push', trainerSplit: 'Push', trainerFilterOnlyAssigned: true,
    workoutSplits: { Push: { title: 'Push Day', items: [] }, Pull: { title: 'Pull Day', items: [] }, Legs: { title: 'Leg Day', items: [] } }, exProgress: {}, markedByPhone: {}, q: '', attFilter: '', dirFilter: '', selectedDietMember: '',
    msg: 'Hello [Name], we missed seeing you at the gym this week! Consistency is key to reaching your fitness goals.',
    attTotal: 0, attMorning: 0, attEvening: 0, cashToday: 0, upiToday: 0, pendingToday: 0, newToday: 0, renewalsToday: 0,
    weekChart: [0, 0, 0, 0, 0, 0, 0], attList: [], renewals: [], members: [], mealsByMember: {}, inactive: [], transactions: [], devUnlocked: false
  };
}

let currentGymId = localStorage.getItem('last_gym_id') || null;
let S = loadState(), cameraStream = null, restInterval = null, restSeconds = 0, saveTimeout = null;

function loadState() { 
  if(!currentGymId) return getInitialData();
  try { const raw = localStorage.getItem('gym_saas_' + currentGymId); return raw ? Object.assign(getInitialData(), JSON.parse(raw)) : getInitialData(); } 
  catch (e) { return getInitialData(); } 
}

function saveState() { 
  try { 
    if (currentGymId) {
      localStorage.setItem('gym_saas_' + currentGymId, JSON.stringify(S)); 
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { db.collection('gyms').doc(currentGymId).set(S).catch(e => console.error(e)); }, 1500);
    }
  } catch (e) {} 
}

async function syncFromCloud() {
  if(currentGymId && S.loggedInUser) {
    try {
      const doc = await db.collection('gyms').doc(currentGymId).get();
      if(doc.exists) {
        const localMob = S.mob, localRole = S.role, localScreen = S.screen, localUser = S.loggedInUser;
        S = Object.assign(getInitialData(), doc.data());
        S.mob = localMob; S.role = localRole; S.screen = localScreen; S.loggedInUser = localUser;
        render();
      }
    } catch(e) {}
  }
}

const $ = s => document.querySelector(s);
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmt = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const till = m => { const months = Math.max(0, Number(m) || 0); const d = new Date(); d.setMonth(d.getMonth() + months); d.setDate(d.getDate() - 1); return d; };
const wa = (t, ph) => `https://wa.me/${ph ? '91' + ph : ''}?text=${encodeURIComponent(t)}`;
const ini = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const TD = () => (new Date().getDay() + 6) % 7;
const tag = (t, c = '') => `<span class="t ${c}">${t}</span>`;
const row = (n, sub, right) => `<div class="c rw"><div class="av">${ini(n)}</div><div class="sp"><b>${n}</b><div class="m">${sub}</div></div>${right}</div>`;
const dots = (a, c = '') => [...'MTWTFSS'].map((l, i) => `<div class="d ${c} ${a[i] ? 'on' : ''} ${i == TD() ? 'td' : ''}">${l}</div>`).join('');

let tt;
const toast = m => { const e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 3000); };
const openUrl = url => window.open(url, '_blank', 'noopener');

function findCoupon(codeStr) { if (!codeStr) return null; const clean = codeStr.trim().toUpperCase(); return S.coupons.find(c => c.code.toUpperCase() === clean) || null; }
function computeDiscount(baseAmount, couponObj) { if (!couponObj) return 0; if (couponObj.type === 'PERCENT') return Math.round(baseAmount * (Number(couponObj.val) / 100)); return Math.min(baseAmount, Number(couponObj.val) || 0); }
function computeReceptionFeeSummary() { const p = S.gym.plans[S.plan] || S.gym.plans[3]; const tMonths = S.feeTrainerReq ? Math.max(1, parseInt(S.feeTrainerMonths, 10) || 1) : 0; const ptRate = Number(S.gym.ptMonthlyRate || 0); const trainerFee = tMonths * ptRate; const standardTotal = Number(p.p) + trainerFee; const couponObj = findCoupon(S.recCouponCode); const discount = computeDiscount(standardTotal, couponObj); const calculatedAfterDiscount = Math.max(0, standardTotal - discount); const hasCustomOverride = S.customFeeAmount !== '' && !isNaN(Number(S.customFeeAmount)) && Number(S.customFeeAmount) >= 0; const finalPayable = hasCustomOverride ? Number(S.customFeeAmount) : calculatedAfterDiscount; return { planObj: p, tMonths, ptRate, trainerFee, standardTotal, couponObj, discount, calculatedAfterDiscount, hasCustomOverride, finalPayable }; }
function currentMemberRecord() { if (S.loggedInUser && S.loggedInUser.role === 'Member') { const found = S.members.find(m => m[6] === S.loggedInUser.phone); if (found) return found; } return S.members[0] || ['Unknown Member', 'General Fitness', 0, 0, 0, [0,0,0,0,0,0,0], '0000000000', 'No Plan', 'Expired', false, 0, 0, 'None']; }
function trainerBadgeText(mem) { const req = Boolean(mem[9]) && Number(mem[11] || 0) > 0; if (!req) return 'Self Workout (0M Trainer)'; const m = Number(mem[11]) || 1; return `Trainer: ${m} ${m === 1 ? 'Month' : 'Months'}`; }
function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } }
async function startCameraPreview() { const videoEl = $('#qr-video'); const statusEl = $('#cam-status'); if (!videoEl || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return; try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); videoEl.srcObject = cameraStream; if (statusEl) statusEl.textContent = 'Camera active · Align QR code within frame'; } catch (err) { if (statusEl) statusEl.textContent = 'Scanner ready · Tap button below to verify check-in'; } }

const V = {
  login: () => `<div class="rw" style="margin-top:8px"><div class="av lg">☁️</div><div><b class="h">Multi-Gym SaaS</b><div class="m">Central Cloud Portal</div></div></div><h1 class="h xl" style="margin-top:16px">Portal Sign In</h1><p class="m">Enter your Gym ID, select your role, and enter your registered mobile number.</p><label class="m top db" for="gym-id">1. Gym ID Code</label><input id="gym-id" class="in" style="text-transform:uppercase" placeholder="e.g. POWERHOUSE" value="${currentGymId || ''}"><span class="m top db">2. Select Your Role</span><div class="gr">${Object.keys(ROLES).map(r => `<button class="ch ${r == S.role ? 'on' : ''}" data-act="role" data-v="${r}">${r} Portal</button>`).join('')}</div><label class="m top db" for="mob">3. Registered Mobile Number</label><div class="rw"><span class="c pre">+91</span><input id="mob" class="in" inputmode="numeric" maxlength="10" value="${S.mob}" placeholder="10-digit mobile number"><button class="ch on ap" data-act="sendOtp">Get OTP</button></div><div class="rw between top"><span class="m">4. Enter 4-Digit OTP</span><button class="t g" data-act="autofillOtp">Auto-fill OTP</button></div><div class="rw" id="otp">${[1, 2, 3, 4].map(i => `<input class="in o" maxlength="1" inputmode="numeric" aria-label="Verification digit ${i}">`).join('')}</div><button class="b push" data-act="login">Verify &amp; Connect to Cloud</button>`,
  scan: () => { const mem = currentMemberRecord(); if (mem[0] === 'Unknown Member') return `<div class="c ctr m">You are not registered. Please see Reception.</div>`; const markInfo = S.markedByPhone[mem[6]]; const hasTrainer = Boolean(mem[9]) && Number(mem[11] || 0) > 0; return `<div class="c"><div class="rw"><div class="av">${ini(mem[0])}</div><div class="sp"><b>${mem[0]}</b><div class="m">Gym Plan: ${mem[7]} (Till ${mem[8]})</div></div>${hasTrainer ? tag(trainerBadgeText(mem), 'w') : tag('Self Workout')}</div>${hasTrainer ? `<div class="m top">Personal Trainer Valid Until: <b class="ac">${mem[12] || mem[8]}</b></div>` : ''}</div><h1 class="h">QR Attendance Check-In</h1><div class="vf"><video id="qr-video" autoplay playsinline muted></video><i class="ln"></i><span id="cam-status" class="vf-overlay">Initializing camera scanner...</span></div><button class="b" data-act="scan">Scan Gym Entrance QR Code</button>${markInfo ? `<div class="c rw sel"><div class="av fill">✓</div><div class="sp"><b>Check-In Confirmed</b><div class="m">${markInfo.t}</div></div>${tag(markInfo.b + ' Batch', 'g')}</div>` : '<p class="m ctr">Point your camera at the reception QR standee to mark attendance.</p>'}<div class="c"><div class="rw"><b class="sp">Your Weekly Consistency</b>${tag(mem[5].filter(Boolean).length + '-Day Streak', 'g')}</div><div class="dw between top">${dots(mem[5])}</div></div>`; },
  workout: () => { const splitObj = S.workoutSplits[S.split] || { title: 'No Title', items: [] }; const currentList = splitObj.items || []; const mem = currentMemberRecord(); const key = `${mem[6]}_${S.split}`; const progressArr = S.exProgress[key] || currentList.map(() => 0); const doneCount = progressArr.filter(Boolean).length; return `<div class="rw between"><h1 class="h">Assigned Workouts</h1><button class="t g" data-act="startRest">${restSeconds > 0 ? `Rest: ${restSeconds}s` : '⏱ 60s Rest Timer'}</button></div><div class="gr3">${Object.keys(S.workoutSplits).map(k => `<button class="ch ${k == S.split ? 'on' : ''}" data-act="split" data-v="${k}">${k} Day</button>`).join('')}</div><div class="c"><div class="rw"><span class="sp m">${splitObj.title}</span><b class="ac">${doneCount}/${currentList.length} Done</b></div><div class="bar"><i style="width:${currentList.length ? (doneCount / currentList.length) * 100 : 0}%"></i></div></div>` + (currentList.length ? currentList.map((e, i) => `<label class="c rw"><input type="checkbox" data-act="ex" data-i="${i}" ${progressArr[i] ? 'checked' : ''}><span class="sp"><b>${e[0]}</b><span class="m db">${e[1]}</span></span><a class="t" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e[0] + ' proper exercise form')}" target="_blank" rel="noopener">Video</a></label>`).join('') : `<div class="c ctr m">No exercises assigned yet.</div>`); },
  myDiet: () => { const mem = currentMemberRecord(); const hasTrainer = Boolean(mem[9]) && Number(mem[11] || 0) > 0; const planData = S.mealsByMember[mem[0]] || { macros: { p: 0, c: 0, f: 0 }, meals: [] }; const totalKcal = planData.meals.reduce((a, m) => a + Number(m[2] || 0), 0); return `<h1 class="h">My Custom Nutrition Plan</h1><p class="m">${hasTrainer ? `Personal Trainer Assigned (${mem[11]} Months · Till ${mem[12]})` : 'General Nutrition Guide'} · Goal: <b>${mem[1]}</b></p><div class="gr3"><div class="c"><span class="m">Protein</span><b class="h ac db">${planData.macros.p}g</b></div><div class="c"><span class="m">Carbs</span><b class="h wn db">${planData.macros.c}g</b></div><div class="c"><span class="m">Healthy Fats</span><b class="h bl db">${planData.macros.f}g</b></div></div>` + (planData.meals.length ? planData.meals.map(m => `<div class="c rw"><div class="sp"><b>${m[0]}</b><div class="m">${m[1]}</div></div><b>${m[2]} kcal</b></div>`).join('') : `<div class="c ctr m">No meals assigned yet. Ask your trainer to update your menu.</div>`) + `<div class="c rw between"><span class="m">Total Daily Target</span><b class="h ac">${totalKcal.toLocaleString('en-IN')} kcal</b></div>`; },
  join: () => { const mem = currentMemberRecord(); const plans = S.gym.plans; const p = plans[S.plan] || plans[3]; const cObj = findCoupon(S.cp); const off = computeDiscount(p.p, cObj); const tot = Math.max(0, p.p - off); return `<h1 class="h">Renew Membership</h1><div class="c sel rw"><div class="av fill">✓</div><div class="sp"><b>Current: ${mem[7]}</b><div class="m">Gym valid till ${mem[8]} · ${mem[9] ? `Trainer: ${mem[11]} Mo (Till ${mem[12]})` : 'Self Workout'}</div></div>${tag('Active', 'g')}</div>` + Object.entries(plans).map(([k, v]) => `<button class="c plan ${k == S.plan ? 'sel' : ''}" data-act="plan" data-v="${k}"><span class="sp"><b>${v.n}</b> ${k == 3 ? tag('Most Popular', 'g') : ''}<span class="m db">${inr(Math.round(v.p / v.m))} / month</span></span><b>${inr(v.p)}</b></button>`).join('') + (S.coupons.length ? `<div class="rw wrap"><span class="m">Available Offers:</span>${S.coupons.map(c => `<button class="t g" data-act="pickMemberCoupon" data-code="${c.code}">${c.code} (${c.type === 'PERCENT' ? c.val + '% OFF' : '₹' + c.val + ' OFF'})</button>`).join('')}</div>` : '') + `<div class="rw"><input id="cp" class="in" placeholder="Enter coupon code" value="${S.cp}"><button class="ch on ap" data-act="coupon">Apply</button></div><div class="c"><div class="rw m"><span class="sp">${p.n}</span><span>${inr(p.p)}</span></div>${cObj ? `<div class="rw m top"><span class="sp">Coupon (${cObj.code})</span><span class="ac">−${inr(off)}</span></div>` : ''}<div class="rw top"><b class="sp">Total Payable</b><b class="h">${inr(tot)}</b></div></div><button class="b push" data-act="openUpiModal">Pay ${inr(tot)} via UPI</button>`; },
  directory: () => { const list = S.members.filter(m => m[0].toLowerCase().includes(S.dirFilter.toLowerCase()) || m[6].includes(S.dirFilter)); return `<div class="rw between"><div><h1 class="h">Members Directory (${S.members.length})</h1><p class="m">Add/remove members &amp; set trainer duration in months</p></div><button class="t g" data-act="openAddMemberModal">+ New Member</button></div><input id="dir-search" class="in" placeholder="Search by name or mobile number..." value="${S.dirFilter}">` + (list.length ? list.map(m => { const hasTr = Boolean(m[9]) && Number(m[11] || 0) > 0; return `<div class="c"><div class="rw"><div class="av">${ini(m[0])}</div><div class="sp"><b>${m[0]}</b> ${tag(m[1], 'g')}<div class="m">+91 ${m[6]} · ${m[7]} (Paid ${inr(m[10] || 0)})</div></div><button class="icon-btn del" data-act="deleteMember" data-phone="${m[6]}" title="Delete Member">🗑</button></div><div class="rw between top"><span class="m">Gym till ${m[8]}${hasTr ? ` · PT till ${m[12]}` : ''}</span><button class="t ${hasTr ? 'w' : ''}" data-act="openTrainerDurationModal" data-phone="${m[6]}">${hasTr ? `★ Trainer: ${m[11]} ${m[11] == 1 ? 'Month' : 'Months'} (Edit)` : '+ Assign Trainer'}</button></div></div>`; }).join('') : `<div class="c ctr m">No members found. Register a new member to begin.</div>`); },
  fees: () => { if (S.members.length === 0) return `<h1 class="h">Rates &amp; Fee Collection</h1><div class="c ctr m">No registered members found. Please register a member in the Members tab first.</div>`; const summary = computeReceptionFeeSummary(); return `<h1 class="h">Rates &amp; Fee Collection</h1><div class="c"><div class="rw between"><b>Gym Plan &amp; Monthly Trainer Rates (₹)</b><button class="t g" data-act="saveQuickRates">Save Rates</button></div><div class="gr3 top"><div><span class="m">1 Month (₹)</span><input id="rec-p1" class="in top" type="number" value="${S.gym.plans[1].p}"></div><div><span class="m">3 Months (₹)</span><input id="rec-p3" class="in top" type="number" value="${S.gym.plans[3].p}"></div><div><span class="m">12 Months (₹)</span><input id="rec-p12" class="in top" type="number" value="${S.gym.plans[12].p}"></div></div><div class="rw between top"><span class="m">Personal Trainer Rate per Month (₹/mo)</span><input id="rec-pt-rate" class="in" style="width:120px" type="number" value="${S.gym.ptMonthlyRate}"></div></div><label class="m" for="q">1. Select Registered Member</label><select class="in" id="q">${S.members.map(m => `<option value="${m[0]}" ${S.q === m[0] ? 'selected' : ''}>${m[0]} (+91 ${m[6]})</option>`).join('')}</select><span class="m">2. Select Gym Membership Plan</span><div class="gr3">${[1, 3, 12].map(k => `<button class="ch ${k == S.plan ? 'on' : ''}" data-act="plan" data-v="${k}">${k} Mo (${inr(S.gym.plans[k].p)})</button>`).join('')}</div><span class="m">3. Personal Trainer Required?</span><div class="gr"><button class="ch ${S.feeTrainerReq ? 'on' : ''}" data-act="setFeeTrainer" data-v="1">Yes · Trainer Needed</button><button class="ch ${!S.feeTrainerReq ? 'on' : ''}" data-act="setFeeTrainer" data-v="0">No · Self Workout (₹0)</button></div>${S.feeTrainerReq ? `<div class="c" style="border-color:rgba(163,230,53,.4)"><div class="rw between"><b>How Many Months Trainer Needed?</b><span class="ac"><b>${summary.tMonths} ${summary.tMonths === 1 ? 'Month' : 'Months'}</b> × ${inr(summary.ptRate)} = <b>${inr(summary.trainerFee)}</b></span></div><div class="gr5 top">${[1, 2, 3, 6, 12].map(m => `<button class="ch ${summary.tMonths === m ? 'on' : ''}" data-act="setTrainerMonths" data-v="${m}">${m} Mo</button>`).join('')}</div><div class="rw between top"><span class="m">Or enter exact months (1–24):</span><input id="fee-pt-months-in" class="in" style="width:90px" type="number" min="1" max="24" value="${summary.tMonths}"></div></div>` : ''}<div class="rw between"><span class="m">4. Apply Coupon / Offer</span><div class="rw wrap">${S.coupons.map(c => `<button class="t ${S.recCouponCode === c.code ? 'g' : ''}" data-act="applyRecCoupon" data-code="${c.code}">${c.code}</button>`).join('')}</div></div><div class="rw"><input id="rec-cp-in" class="in" placeholder="Type coupon code (optional)" value="${S.recCouponCode}"><button class="ch ap" data-act="clearRecCoupon">Clear</button></div><label class="m" for="custom-amt">5. Specific / Custom Final Amount Override (₹)</label><div class="rw"><input id="custom-amt" class="in" type="number" placeholder="Leave blank for auto (${inr(summary.calculatedAfterDiscount)})" value="${S.customFeeAmount}">${S.customFeeAmount !== '' ? `<button class="ch ap" data-act="clearCustomAmt">Auto</button>` : ''}</div><div class="c"><div class="rw m"><span class="sp">Gym Plan (${summary.planObj.n} · Till ${fmt(till(summary.planObj.m))})</span><span>${inr(summary.planObj.p)}</span></div><div class="rw m top"><span class="sp">Personal Trainer (${S.feeTrainerReq ? `${summary.tMonths} Mo · Till ${fmt(till(summary.tMonths))}` : 'Not Needed'})</span><span>${S.feeTrainerReq ? '+' + inr(summary.trainerFee) : '₹0'}</span></div>${summary.couponObj ? `<div class="rw m top"><span class="sp">Coupon (${summary.couponObj.code})</span><span class="ac">−${inr(summary.discount)}</span></div>` : ''}${summary.hasCustomOverride ? `<div class="rw m top"><span class="sp wn">Specific Amount Override Applied</span><span class="wn">${inr(summary.finalPayable)}</span></div>` : ''}<div class="rw top"><b class="sp">Final Amount to Collect</b><b class="h ac">${inr(summary.finalPayable)}</b></div></div><span class="m">6. Payment Mode</span><div class="gr3">${['UPI', 'Cash', 'Card'].map(k => `<button class="ch ${k == S.mode ? 'on' : ''}" data-act="mode" data-v="${k}">${k}</button>`).join('')}</div><button class="b push" data-act="save">Collect ${inr(summary.finalPayable)} &amp; Send WhatsApp Receipt</button>`; },
  offers: () => `<div class="rw between"><div><h1 class="h">Coupon &amp; Offer Manager</h1><p class="m">Create percentage (%) or flat (₹) promotional offers</p></div></div><div class="c" style="display:flex;flex-direction:column;gap:8px"><b>Create New Coupon Offer</b><div class="gr"><div><label class="m">Coupon Code</label><input id="new-cp-code" class="in top" placeholder="e.g. SUMMER25"></div><div><label class="m">Discount Type</label><select id="new-cp-type" class="in top"><option value="PERCENT">Percentage (%)</option><option value="FLAT">Flat Amount (₹)</option></select></div></div><div class="gr"><div><label class="m">Discount Value (% or ₹)</label><input id="new-cp-val" class="in top" type="number" placeholder="e.g. 25 or 500"></div><div><label class="m">Short Offer Description</label><input id="new-cp-desc" class="in top" placeholder="e.g. Special Combo Discount"></div></div><button class="b top" data-act="createCoupon">+ Create &amp; Activate Coupon Offer</button></div><span class="m">Active Gym Coupons (${S.coupons.length})</span>` + (S.coupons.length ? S.coupons.map((c, idx) => `<div class="c rw"><div class="av">${c.type === 'PERCENT' ? '%' : '₹'}</div><div class="sp"><b>${c.code}</b> ${tag(c.type === 'PERCENT' ? `${c.val}% OFF` : `Flat ₹${c.val} OFF`, 'g')}<div class="m">${c.desc || 'Valid on gym memberships'}</div></div><button class="icon-btn del" data-act="deleteCoupon" data-i="${idx}" title="Delete coupon">🗑</button></div>`).join('') : `<div class="c ctr m">No active coupons. Create your first offer above.</div>`),
  attendance: () => { const filtered = S.attList.filter(a => a[0].toLowerCase().includes(S.attFilter.toLowerCase())); return `<div class="rw between"><h1 class="h">Today’s Attendance</h1><button class="t g" data-act="openCheckinModal">+ Manual Check-In</button></div><div class="c rw" style="padding:14px"><div class="sp"><div class="big">${S.attTotal}</div><div class="m">Members checked in today</div></div><div class="rt"><b>${S.attMorning}</b> <span class="m">Morning</span><br><b>${S.attEvening}</b> <span class="m">Evening</span></div></div><input id="att-search" class="in" placeholder="Filter checked-in members..." value="${S.attFilter}">` + (filtered.length ? filtered.map(a => row(a[0], `Checked in at ${a[1]}`, (a[3] ? tag('Trainer Assigned', 'w') : tag('Self')) + tag(a[2]))).join('') : `<div class="c ctr m">No attendance records today.</div>`); },
  renewals: () => `<h1 class="h">Upcoming Renewals</h1><p class="m">${S.renewals.length} memberships expiring within 7 days</p>` + (S.renewals.length ? S.renewals.map((r, idx) => row(r[0], `${r[1]} · Expires ${r[2]}`, tag(r[3] == 0 ? 'Due Today' : `${r[3]}d left`, r[3] <= 1 ? 'r' : r[3] <= 4 ? 'w' : 'g') + `<a class="t ${r[5] ? 'g' : ''}" target="_blank" rel="noopener" data-act="markReminded" data-i="${idx}" href="${wa(`Hello ${r[0]}, your ${r[1]} membership at ${S.gym.name} expires ${r[2]}. Renew today at reception or via UPI (${S.gym.upiId}). – ${S.gym.name}`, r[4])}">${r[5] ? 'Sent ✓' : 'Remind'}</a>`)).join('') + `<button class="b push" data-act="remind">Mark All Reminders Dispatched (${S.renewals.length})</button>` : `<div class="c ctr m">No upcoming renewals in the next 7 days.</div>`),
  members: () => { const assignedList = S.trainerFilterOnlyAssigned ? S.members.filter(m => m[9] && Number(m[11] || 0) > 0) : S.members; return `<div class="rw between"><div><h1 class="h">Trainer Clients (${assignedList.length})</h1><p class="m">Includes duration of personal training assigned</p></div><button class="t ${S.trainerFilterOnlyAssigned ? 'g' : ''}" data-act="toggleTrainerFilter">${S.trainerFilterOnlyAssigned ? 'Assigned Only' : 'All Members'}</button></div>` + (assignedList.length ? assignedList.map(m => { const realIdx = S.members.findIndex(orig => orig[6] === m[6]); const totalDiff = Math.max(Math.abs(m[2] - m[4]), 1); const currDiff = Math.min(Math.abs(m[2] - m[3]), totalDiff); const pct = Math.round((currDiff / totalDiff) * 100); const hasTr = Boolean(m[9]) && Number(m[11] || 0) > 0; return `<div class="c"><div class="rw"><div class="av">${ini(m[0])}</div><div class="sp"><b>${m[0]}</b><div class="m">+91 ${m[6]} · ${hasTr ? `PT: ${m[11]} ${m[11] == 1 ? 'Month' : 'Months'} (Till ${m[12]})` : 'Self Workout'}</div></div>${tag(m[1], m[1] == 'Fat Loss' ? 'g' : 'w')}</div><div class="rw m top"><span class="sp">Start: ${m[2]} kg → Current: <b>${m[3]} kg</b></span><span>Goal: ${m[4]} kg (${pct}%)</span></div><div class="bar"><i style="width:${pct}%"></i></div><div class="rw between top"><div class="rw" style="gap:4px"><button class="step-btn" data-act="adjWeight" data-i="${realIdx}" data-d="-0.5">−</button><span class="m">Weight</span><button class="step-btn" data-act="adjWeight" data-i="${realIdx}" data-d="0.5">+</button></div><button class="t g" data-act="openClientDiet" data-name="${m[0]}">Customize Diet Menu →</button></div></div>`; }).join('') : `<div class="c ctr m">No members currently have trainer months assigned.</div>`); },
  diet: () => { const memberName = S.members.some(m => m[0] === S.selectedDietMember) ? S.selectedDietMember : (S.members[0] ? S.members[0][0] : ''); if (!memberName) return `<h1 class="h">Custom Diet Builder</h1><div class="c ctr m">No members found.</div>`; S.selectedDietMember = memberName; if (!S.mealsByMember[memberName]) S.mealsByMember[memberName] = { macros: { p: 0, c: 0, f: 0 }, meals: [] }; const planData = S.mealsByMember[memberName]; const totalKcal = planData.meals.reduce((a, m) => a + Number(m[2] || 0), 0); return `<div class="rw between"><h1 class="h">Custom Diet Builder</h1><select id="diet-member" class="role-select" aria-label="Select Client">${S.members.map(m => `<option value="${m[0]}" ${m[0] == memberName ? 'selected' : ''}>${m[0]} (${m[9] && m[11] ? m[11] + 'M PT' : 'Self'})</option>`).join('')}</select></div><div class="gr3"><div class="c"><span class="m">Protein (g)</span><input id="mac-p" class="in top" type="number" value="${planData.macros.p}"></div><div class="c"><span class="m">Carbs (g)</span><input id="mac-c" class="in top" type="number" value="${planData.macros.c}"></div><div class="c"><span class="m">Fats (g)</span><input id="mac-f" class="in top" type="number" value="${planData.macros.f}"></div></div><div class="rw between"><span class="m">Client Meal Menu (${totalKcal} kcal total)</span><button class="t g" data-act="openAddMealModal">+ Add Meal</button></div>` + (planData.meals.length ? planData.meals.map((m, idx) => `<div class="c rw"><div class="sp"><b>${m[0]}</b><div class="m">${m[1]}</div></div><b>${m[2]} kcal</b><button class="icon-btn del" data-act="deleteMeal" data-i="${idx}" title="Remove meal">✕</button></div>`).join('') : `<div class="c ctr m">No meals in this plan yet.</div>`) + `<button class="b push" data-act="diet">Save &amp; Send Plan via WhatsApp</button>`; },
  trainerWorkouts: () => { const splitObj = S.workoutSplits[S.trainerSplit] || { title: 'Day', items: [] }; return `<div class="rw between"><div><h1 class="h">Workout Plan Builder</h1><p class="m">Global exercise list for all members</p></div><button class="t g" data-act="openAddExerciseModal">+ Add Exercise</button></div><div class="gr3">${Object.keys(S.workoutSplits).map(k => `<button class="ch ${k == S.trainerSplit ? 'on' : ''}" data-act="trainerSplit" data-v="${k}">${k} Split</button>`).join('')}</div><div class="c rw between"><b class="sp">${splitObj.title}</b>${tag((splitObj.items || []).length + ' Exercises', 'g')}</div>` + ((splitObj.items || []).length ? splitObj.items.map((ex, idx) => `<div class="c rw"><div class="sp"><b>${ex[0]}</b><div class="m">${ex[1]}</div></div><button class="icon-btn del" data-act="deleteExercise" data-i="${idx}" title="Remove exercise">✕</button></div>`).join('') : `<div class="c ctr m">No exercises in this split yet.</div>`); },
  report: () => { const totalCollected = S.cashToday + S.upiToday; return `<h1 class="h">Owner Analytics · ${S.gym.name}</h1><div class="c"><span class="m">Revenue Collected Today</span><div class="big">${inr(totalCollected)}</div><div class="rw wrap top">${tag('UPI ' + inr(S.upiToday), 'g')}${tag('Cash ' + inr(S.cashToday))}${tag('Pending ' + inr(S.pendingToday), 'w')}</div></div><div class="gr3">${[[S.members.length, 'Total Members'], [S.members.filter(m => m[9] && m[11] > 0).length, 'PT Clients'], [S.newToday, 'New Joins']].map(x => `<div class="c"><b class="h">${x[0]}</b><div class="m">${x[1]}</div></div>`).join('')}</div><div class="c"><b>7-Day Attendance Trend</b><div class="chart">${S.weekChart.map((v, i) => `<div class="bx ${i == TD() ? 'td' : ''}"><i style="height:${Math.max(v, 8)}px"></i>${'MTWTFSS'[i]}</div>`).join('')}</div></div><div class="c"><b>Recent Transactions</b>${S.transactions.length ? S.transactions.slice(0, 5).map(t => `<div class="rw m top"><span class="sp"><b>${t[0]}</b> · ${t[1]} (${t[3]})</span><b class="ac">+${inr(t[2])}</b></div>`).join('') : '<div class="m top">No transactions today.</div>'}</div>`; },
  inactive: () => `<h1 class="h">Absentee Follow-Up · ${S.inactive.length}</h1><p class="m">Members absent for more than 7 consecutive days</p>` + (S.inactive.length ? S.inactive.map((x, idx) => row(x[0], `Last visit: ${x[1]}`, tag(`${x[2]}d absent`, x[2] >= 10 ? 'r' : 'w') + `<a class="t ${x[4] ? 'g' : ''}" target="_blank" rel="noopener" data-act="markInactiveContacted" data-i="${idx}" href="${wa(S.msg.replace('[Name]', x[0].split(' ')[0]) + ' – ' + S.gym.name, x[3])}">${x[4] ? 'Contacted ✓' : 'WhatsApp'}</a>`)).join('') + `<label class="m" for="msg">Follow-Up Message Template</label><textarea id="msg" class="in ta">${S.msg}</textarea><button class="b push" data-act="bulk">Mark All Follow-Ups Sent (${S.inactive.length})</button>` : `<div class="c ctr m">No inactive members to follow up with.</div>`),
  settings: () => { const devUnlocked = S.devUnlocked === true; return `<h1 class="h">Gym Configuration</h1><div class="c"><div class="rw between"><div><b>Licensed To: ${S.gym.name}</b><div class="m">${S.gym.branch} · Cloud Sync Active</div></div>${tag('Verified', 'g')}</div></div><div class="c" style="display:flex;flex-direction:column;gap:8px"><b>Membership &amp; Monthly Trainer Pricing (₹)</b><div class="gr3"><div><span class="m">1 Month</span><input id="set-p1" class="in top" type="number" value="${S.gym.plans[1].p}"></div><div><span class="m">3 Months</span><input id="set-p3" class="in top" type="number" value="${S.gym.plans[3].p}"></div><div><span class="m">12 Months</span><input id="set-p12" class="in top" type="number" value="${S.gym.plans[12].p}"></div></div><div class="gr"><div><span class="m">Trainer Rate (₹/mo)</span><input id="set-pt" class="in top" type="number" value="${S.gym.ptMonthlyRate}"></div><div><span class="m">Merchant UPI ID</span><input id="set-upi" class="in top" value="${S.gym.upiId}"></div></div></div><div class="c" style="border-color:${devUnlocked ? 'var(--ac)' : 'var(--bd)'};display:flex;flex-direction:column;gap:8px"><div class="rw between"><b>Developer License Lock (Brand &amp; Staff)</b>${devUnlocked ? tag('Unlocked', 'g') : tag('Locked 🔒', 'r')}</div>${!devUnlocked ? `<p class="m">Gym Name, Branch, and Staff Login Numbers are permanently locked to prevent unauthorized resale. Enter Developer Master PIN to modify.</p><div class="rw"><input id="dev-pin-in" class="in" type="password" placeholder="Enter Developer Master PIN"><button class="ch on ap" data-act="unlockDev">Unlock</button></div>` : `<label class="m">Licensed Gym Brand Name</label><input id="set-name" class="in" value="${S.gym.name}"><div class="gr"><div><label class="m">Logo Initials</label><input id="set-code" class="in top" maxlength="2" value="${S.gym.code}"></div><div><label class="m">Branch / City</label><input id="set-branch" class="in top" value="${S.gym.branch}"></div></div><div class="gr3"><div><span class="m">Reception Mob</span><input id="set-rec-ph" class="in top" maxlength="10" value="${S.staff.Reception.phone}"></div><div><span class="m">Trainer Mob</span><input id="set-tr-ph" class="in top" maxlength="10" value="${S.staff.Trainer.phone}"></div><div><span class="m">Owner Mob</span><input id="set-ow-ph" class="in top" maxlength="10" value="${S.staff.Owner.phone}"></div></div>`}</div><button class="b push" data-act="saveGymSettings">Save Configuration & Sync to Cloud</button>`; }
};

function updateRegModalPreview() {
  const planSelect = $('#new-m-plan'), trainerMonthsInput = $('#new-m-pt-months'), cpSelect = $('#new-m-cp'), specInput = $('#new-m-spec'), previewEl = $('#new-m-calc-preview');
  if (!planSelect || !previewEl) return;
  const pObj = S.gym.plans[+planSelect.value] || S.gym.plans[3];
  const ptMonths = Math.max(0, parseInt(trainerMonthsInput.value, 10) || 0), ptRate = Number(S.gym.ptMonthlyRate || 0), ptTotal = ptMonths * ptRate, subTotal = Number(pObj.p) + ptTotal;
  const cObj = findCoupon(cpSelect.value), disc = computeDiscount(subTotal, cObj), autoTotal = Math.max(0, subTotal - disc), specVal = specInput.value.trim();
  const finalAmt = specVal !== '' && !isNaN(Number(specVal)) ? Number(specVal) : autoTotal;
  previewEl.innerHTML = `Gym (${pObj.n}): <b>${inr(pObj.p)}</b> + Trainer (${ptMonths} ${ptMonths === 1 ? 'Mo' : 'Mos'} × ${inr(ptRate)}): <b>${inr(ptTotal)}</b>${disc ? ` − Coupon: <b>${inr(disc)}</b>` : ''}<div class="top">Total Payable: <b class="ac">${inr(finalAmt)}</b></div>`;
}

const A = {
  role: v => { S.role = v; saveState(); render(); },
  sendOtp: () => { if (S.mob.length !== 10) return toast('Please enter a valid 10-digit mobile number'); S.generatedOtp = String(Math.floor(1000 + Math.random() * 9000)); saveState(); const banner = $('#sms-banner'); $('#sms-text').textContent = `Your verification code is ${S.generatedOtp}. Tap to auto-fill.`; banner.hidden = false; },
  autofillOtp: () => { const digits = [...document.querySelectorAll('#otp input')]; const code = S.generatedOtp || '4829'; digits.forEach((el, idx) => { el.value = code[idx] || ''; }); $('#sms-banner').hidden = true; toast('OTP auto-filled'); },
  
  login: async () => {
    const gId = ($('#gym-id').value || '').trim().toUpperCase();
    const o = [...document.querySelectorAll('#otp input')].map(i => i.value).join('');
    if (!gId) return toast('Enter your Gym ID');
    if (S.mob.length !== 10) return toast('Enter a valid 10-digit mobile number');
    if (o.length !== 4) return toast('Enter the 4-digit OTP code');

    const btn = document.querySelector('[data-act="login"]');
    btn.textContent = 'Connecting to Cloud...'; btn.disabled = true;

    try {
      const docSnap = await db.collection('gyms').doc(gId).get();
      if (docSnap.exists) {
        const localMob = S.mob, localRole = S.role;
        S = Object.assign(getInitialData(), docSnap.data());
        S.mob = localMob; S.role = localRole;
      } else {
        if (S.role === 'Owner' && S.mob === '3333333333') {
          S = getInitialData();
          await db.collection('gyms').doc(gId).set(S);
          toast('New Gym Database Created!');
        } else {
          btn.textContent = 'Verify & Connect to Cloud'; btn.disabled = false;
          return toast('Gym ID not found in cloud.');
        }
      }

      if (S.role === 'Member') {
        const mem = S.members.find(m => m[6] === S.mob);
        if (!mem) { btn.textContent = 'Verify & Connect to Cloud'; btn.disabled = false; return toast('Mobile number not registered in this gym.'); }
        S.loggedInUser = { name: mem[0], phone: mem[6], role: 'Member' };
      } else {
        const staffObj = S.staff[S.role];
        if (!staffObj || staffObj.phone !== S.mob) { btn.textContent = 'Verify & Connect to Cloud'; btn.disabled = false; return toast(`Use authorized ${S.role} number.`); }
        S.loggedInUser = { name: staffObj.name, phone: staffObj.phone, role: S.role };
      }

      currentGymId = gId;
      localStorage.setItem('last_gym_id', currentGymId);
      $('#sms-banner').hidden = true; S.screen = ROLES[S.role][0]; saveState(); render(); toast(`Connected to ${gId} Cloud`);
    } catch(e) {
      btn.textContent = 'Verify & Connect to Cloud'; btn.disabled = false; toast('Database connection error.');
    }
  },

  go: v => { if (!S.loggedInUser || !ROLES[S.loggedInUser.role].includes(v)) return toast('Unauthorized screen for your role'); stopCamera(); S.screen = v; saveState(); render(); $('#screen').scrollTop = 0; },
  logout: () => { stopCamera(); S.loggedInUser = null; S.screen = 'login'; saveState(); render(); toast('Disconnected from cloud safely'); },
  unlockDev: () => { const pin = ($('#dev-pin-in').value || '').trim(); if (pin !== DEVELOPER_PIN) return toast('Access Denied: Invalid Developer Master PIN'); S.devUnlocked = true; render(); toast('Developer Branding Controls Unlocked'); },
  
  openAddMemberModal: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Reception') return toast('Only Reception can register new members');
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">Register New Member</b><button class="icon-btn" data-act="closeModal">✕</button></div><div class="gr"><div><label class="m">Full Name</label><input id="new-m-name" class="in top" placeholder="e.g. Rohan Deshmukh"></div><div><label class="m">10-Digit Mobile</label><input id="new-m-phone" class="in top" inputmode="numeric" maxlength="10" placeholder="9820551234"></div></div><div class="gr"><div><label class="m">Fitness Goal</label><select id="new-m-goal" class="in top"><option value="Fat Loss">Fat Loss</option><option value="Muscle Gain">Muscle Gain</option><option value="Strength & Conditioning">Strength & Conditioning</option><option value="General Fitness">General Fitness</option></select></div><div><label class="m">Gym Membership Plan</label><select id="new-m-plan" class="in top"><option value="1">1 Month (${inr(S.gym.plans[1].p)})</option><option value="3" selected>3 Months (${inr(S.gym.plans[3].p)})</option><option value="12">12 Months (${inr(S.gym.plans[12].p)})</option></select></div></div><div><label class="m">Trainer Needed for How Many Months? (${inr(S.gym.ptMonthlyRate)}/mo)</label><div class="gr5 top">${[0, 1, 2, 3, 6].map(m => `<button type="button" class="ch" data-act="pickModalPtMonths" data-v="${m}">${m === 0 ? 'None (0)' : m + ' Mo'}</button>`).join('')}</div><input id="new-m-pt-months" class="in top" type="number" min="0" max="24" value="0" placeholder="Enter months trainer needed"></div><div class="gr"><div><label class="m">Apply Coupon Offer</label><select id="new-m-cp" class="in top"><option value="">No Coupon</option>${S.coupons.map(c => `<option value="${c.code}">${c.code} (${c.type === 'PERCENT' ? c.val + '% OFF' : '₹' + c.val + ' OFF'})</option>`).join('')}</select></div><div><label class="m">Specific Amount (₹)</label><input id="new-m-spec" class="in top" type="number" placeholder="Auto if blank"></div></div><div id="new-m-calc-preview" class="c m"></div><div class="gr"><div><label class="m">Start Weight (kg)</label><input id="new-m-cur" class="in top" type="number" step="0.5" value="70"></div><div><label class="m">Target Weight (kg)</label><input id="new-m-tar" class="in top" type="number" step="0.5" value="65"></div></div><button class="b top" data-act="confirmAddMember">Register Member &amp; Record Fee</button>`;
    $('#modal').hidden = false; updateRegModalPreview();
  },
  pickModalPtMonths: (v) => { const input = $('#new-m-pt-months'); if (input) { input.value = v; updateRegModalPreview(); } },
  confirmAddMember: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Reception') return;
    const name = ($('#new-m-name').value || '').trim(), phone = ($('#new-m-phone').value || '').replace(/\D/g, ''), goal = $('#new-m-goal').value, planKey = +$('#new-m-plan').value, ptMonths = Math.max(0, parseInt($('#new-m-pt-months').value, 10) || 0), trainerReq = ptMonths > 0, cpCode = $('#new-m-cp').value, specRaw = ($('#new-m-spec').value || '').trim(), curW = parseFloat($('#new-m-cur').value) || 70, tarW = parseFloat($('#new-m-tar').value) || 65;
    if (!name) return toast('Please enter the member full name');
    if (phone.length !== 10) return toast('Please enter a valid 10-digit mobile number');
    if (S.members.some(m => m[6] === phone)) return toast('Mobile number already exists');
    const pObj = S.gym.plans[planKey] || S.gym.plans[3];
    const ptFee = ptMonths * Number(S.gym.ptMonthlyRate || 0);
    const baseTotal = Number(pObj.p) + ptFee;
    const cObj = findCoupon(cpCode);
    const disc = computeDiscount(baseTotal, cObj);
    const autoAmt = Math.max(0, baseTotal - disc);
    const finalAmt = specRaw !== '' && !isNaN(Number(specRaw)) ? Number(specRaw) : autoAmt;
    const gymValidStr = fmt(till(pObj.m)), ptValidStr = trainerReq ? fmt(till(ptMonths)) : 'None';
    S.members.unshift([name, goal, curW, curW, tarW, [1, 0, 0, 0, 0, 0, 0], phone, pObj.n, gymValidStr, trainerReq, finalAmt, ptMonths, ptValidStr]);
    S.upiToday += finalAmt; S.newToday += 1; S.transactions.unshift([name, `${pObj.n}${trainerReq ? ` + ${ptMonths}M Trainer` : ''}`, finalAmt, 'UPI', 'Just now']);
    S.selectedDietMember = name; S.q = name; $('#modal').hidden = true; saveState(); render(); toast(`${name} added!`);
  },
  openTrainerDurationModal: (v, el) => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Reception') return;
    const phone = el.dataset.phone; const mem = S.members.find(m => m[6] === phone); if (!mem) return;
    const curMonths = mem[9] ? (Number(mem[11]) || 1) : 0;
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">Trainer Duration · ${mem[0]}</b><button class="icon-btn" data-act="closeModal">✕</button></div><p class="m">Select how many months Personal Trainer is needed for ${mem[0]} (${inr(S.gym.ptMonthlyRate)}/month).</p><div class="gr5 top">${[0, 1, 2, 3, 6].map(m => `<button type="button" class="ch ${curMonths === m ? 'on' : ''}" data-act="setEditPtMonthsInput" data-v="${m}">${m === 0 ? 'None (0)' : m + ' Mo'}</button>`).join('')}</div><label class="m top">Exact Number of Months (0 = No Trainer)</label><input id="edit-pt-months-val" class="in" type="number" min="0" max="24" value="${curMonths}"><button class="b top" data-act="saveMemberTrainerDuration" data-phone="${phone}">Save Trainer Duration</button>`;
    $('#modal').hidden = false;
  },
  setEditPtMonthsInput: (v) => { const input = $('#edit-pt-months-val'); if (input) input.value = v; },
  saveMemberTrainerDuration: (v, el) => {
    const phone = el.dataset.phone; const mem = S.members.find(m => m[6] === phone); if (!mem) return;
    const months = Math.max(0, parseInt($('#edit-pt-months-val').value, 10) || 0);
    mem[9] = months > 0; mem[11] = months; mem[12] = months > 0 ? fmt(till(months)) : 'None';
    $('#modal').hidden = true; saveState(); render(); toast(months > 0 ? `${mem[0]}: Trainer assigned for ${months} months` : `${mem[0]}: Switched to Self Workout`);
  },
  deleteMember: (v, el) => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Reception') return toast('Only Reception can delete members');
    const phone = el.dataset.phone; const target = S.members.find(m => m[6] === phone); if (!target) return;
    const name = target[0]; S.members = S.members.filter(m => m[6] !== phone); S.renewals = S.renewals.filter(r => r[4] !== phone && r[0] !== name); S.inactive = S.inactive.filter(i => i[3] !== phone && i[0] !== name); delete S.mealsByMember[name];
    saveState(); render(); toast(`Removed ${name} from the gym database`);
  },
  saveQuickRates: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Reception') return;
    S.gym.plans[1].p = parseInt($('#rec-p1').value, 10) || 1500; S.gym.plans[3].p = parseInt($('#rec-p3').value, 10) || 3600; S.gym.plans[12].p = parseInt($('#rec-p12').value, 10) || 11400; S.gym.ptMonthlyRate = parseInt($('#rec-pt-rate').value, 10) || 0;
    saveState(); render(); toast('Updated Gym Plan Rates & Monthly Personal Trainer Rate');
  },
  setFeeTrainer: v => { S.feeTrainerReq = v === '1'; if (S.feeTrainerReq && (!S.feeTrainerMonths || S.feeTrainerMonths < 1)) S.feeTrainerMonths = 1; saveState(); render(); },
  setTrainerMonths: v => { S.feeTrainerReq = true; S.feeTrainerMonths = Math.max(1, parseInt(v, 10) || 1); saveState(); render(); },
  applyRecCoupon: (v, el) => { S.recCouponCode = el.dataset.code; saveState(); render(); toast(`Applied coupon ${S.recCouponCode}`); },
  clearRecCoupon: () => { S.recCouponCode = ''; saveState(); render(); },
  clearCustomAmt: () => { S.customFeeAmount = ''; saveState(); render(); },
  createCoupon: () => {
    if (!S.loggedInUser || (S.loggedInUser.role !== 'Reception' && S.loggedInUser.role !== 'Owner')) return;
    const code = ($('#new-cp-code').value || '').trim().toUpperCase().replace(/\s+/g, ''); const type = $('#new-cp-type').value; const val = parseInt($('#new-cp-val').value, 10) || 0; const desc = ($('#new-cp-desc').value || '').trim() || (type === 'PERCENT' ? `${val}% discount offer` : `Flat ₹${val} discount offer`);
    if (!code) return toast('Please enter a coupon code (e.g. SUMMER25)');
    if (val <= 0) return toast('Please enter a valid discount value greater than 0');
    if (type === 'PERCENT' && val > 90) return toast('Percentage discount cannot exceed 90%');
    const existingIdx = S.coupons.findIndex(c => c.code === code); if (existingIdx >= 0) S.coupons[existingIdx] = { code, type, val, desc }; else S.coupons.unshift({ code, type, val, desc });
    saveState(); render(); toast(`Coupon "${code}" is now live!`);
  },
  deleteCoupon: (v, el) => { const idx = +el.dataset.i; if (S.coupons[idx]) { const removed = S.coupons.splice(idx, 1)[0]; saveState(); render(); toast(`Deleted coupon ${removed.code}`); } },
  toggleTrainerFilter: () => { S.trainerFilterOnlyAssigned = !S.trainerFilterOnlyAssigned; saveState(); render(); },
  openClientDiet: (v, el) => { S.selectedDietMember = el.dataset.name; S.screen = 'diet'; saveState(); render(); },
  openAddMealModal: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Trainer') return;
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">Add Custom Meal to Menu</b><button class="icon-btn" data-act="closeModal">✕</button></div><label class="m">Meal Slot &amp; Time</label><input id="meal-slot" class="in" placeholder="e.g. Post-Workout · 6:30 PM"><label class="m">Food Items &amp; Portions</label><input id="meal-items" class="in" placeholder="e.g. 1 scoop whey isolate"><label class="m">Calories (kcal)</label><input id="meal-kcal" class="in" type="number" placeholder="e.g. 320"><button class="b top" data-act="confirmAddMeal">Add to ${S.selectedDietMember}'s Plan</button>`;
    $('#modal').hidden = false;
  },
  confirmAddMeal: () => {
    const slot = ($('#meal-slot').value || '').trim(), items = ($('#meal-items').value || '').trim(), kcal = parseInt($('#meal-kcal').value, 10) || 0;
    if (!slot || !items) return toast('Please enter both meal time and food items');
    const memberName = S.selectedDietMember; if (!S.mealsByMember[memberName]) S.mealsByMember[memberName] = { macros: { p: 0, c: 0, f: 0 }, meals: [] };
    S.mealsByMember[memberName].meals.push([slot, items, kcal]); $('#modal').hidden = true; saveState(); render(); toast(`Added "${slot}" to ${memberName}'s diet plan`);
  },
  deleteMeal: (v, el) => { const idx = +el.dataset.i; const planData = S.mealsByMember[S.selectedDietMember]; if (planData && planData.meals[idx]) { planData.meals.splice(idx, 1); saveState(); render(); toast('Meal removed from plan'); } },
  trainerSplit: v => { S.trainerSplit = v; saveState(); render(); },
  openAddExerciseModal: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Trainer') return;
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">Add Exercise (${S.trainerSplit} Split)</b><button class="icon-btn" data-act="closeModal">✕</button></div><label class="m">Exercise Name</label><input id="ex-name" class="in" placeholder="e.g. Dumbbell Arnold Press"><label class="m">Sets × Reps / Duration</label><input id="ex-reps" class="in" placeholder="e.g. 4 sets × 12 reps"><button class="b top" data-act="confirmAddExercise">Add to ${S.trainerSplit} Workout</button>`;
    $('#modal').hidden = false;
  },
  confirmAddExercise: () => {
    const exName = ($('#ex-name').value || '').trim(), exReps = ($('#ex-reps').value || '').trim();
    if (!exName || !exReps) return toast('Please enter exercise name and sets/reps');
    S.workoutSplits[S.trainerSplit].items.push([exName, exReps]); $('#modal').hidden = true; saveState(); render(); toast(`Added ${exName} to ${S.trainerSplit} split`);
  },
  deleteExercise: (v, el) => { const idx = +el.dataset.i; const list = S.workoutSplits[S.trainerSplit].items; if (list && list[idx]) { list.splice(idx, 1); saveState(); render(); toast('Exercise removed from split'); } },
  saveGymSettings: () => {
    if (!S.loggedInUser || S.loggedInUser.role !== 'Owner') return;
    S.gym.plans[1].p = parseInt($('#set-p1').value, 10) || 1500; S.gym.plans[3].p = parseInt($('#set-p3').value, 10) || 3600; S.gym.plans[12].p = parseInt($('#set-p12').value, 10) || 11400; S.gym.ptMonthlyRate = parseInt($('#set-pt').value, 10) || 0; S.gym.upiId = ($('#set-upi').value || '').trim() || 'gym@upi';
    if (S.devUnlocked) {
      const name = ($('#set-name').value || '').trim(); if (name) S.gym.name = name;
      S.gym.code = ($('#set-code').value || ini(S.gym.name)).trim().toUpperCase().slice(0, 2); S.gym.branch = ($('#set-branch').value || 'Main Branch').trim();
      S.staff.Reception.phone = ($('#set-rec-ph').value || S.staff.Reception.phone).replace(/\D/g, ''); S.staff.Trainer.phone = ($('#set-tr-ph').value || S.staff.Trainer.phone).replace(/\D/g, ''); S.staff.Owner.phone = ($('#set-ow-ph').value || S.staff.Owner.phone).replace(/\D/g, ''); S.devUnlocked = false; 
    }
    saveState(); render(); toast('Configuration saved & synced to cloud');
  },
  plan: v => { S.plan = +v; saveState(); render(); }, mode: v => { S.mode = v; saveState(); render(); }, split: v => { S.split = v; saveState(); render(); },
  startRest: () => { if (restInterval) { clearInterval(restInterval); restInterval = null; restSeconds = 0; render(); return toast('Rest timer stopped'); } restSeconds = 60; render(); restInterval = setInterval(() => { restSeconds--; if (restSeconds <= 0) { clearInterval(restInterval); restInterval = null; toast('Rest complete! Start your next set.'); } if (S.screen === 'workout') render(); }, 1000); },
  pickMemberCoupon: (v, el) => { S.cp = el.dataset.code; saveState(); render(); toast(`Coupon ${S.cp} applied!`); },
  coupon: () => { S.cp = ($('#cp').value || '').trim().toUpperCase(); const cObj = findCoupon(S.cp); saveState(); if (!cObj) toast('Invalid coupon code.'); else toast(`Coupon ${cObj.code} applied!`); render(); },
  openUpiModal: () => {
    const p = S.gym.plans[S.plan], cObj = findCoupon(S.cp), off = computeDiscount(p.p, cObj), tot = Math.max(0, p.p - off);
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">UPI Express Checkout</b><button class="icon-btn" data-act="closeModal">✕</button></div><div class="c rw"><div class="sp"><b>${p.n}</b><div class="m">${S.gym.name} (${S.gym.upiId})</div></div><b class="h ac">${inr(tot)}</b></div><span class="m">Choose UPI App</span><div class="gr3"><button class="ch on" data-act="confirmUpiPay" data-v="Google Pay">Google Pay</button><button class="ch" data-act="confirmUpiPay" data-v="PhonePe">PhonePe</button><button class="ch" data-act="confirmUpiPay" data-v="Paytm">Paytm</button></div><button class="b" data-act="confirmUpiPay" data-v="UPI">Approve Payment of ${inr(tot)}</button>`;
    $('#modal').hidden = false;
  },
  confirmUpiPay: appName => {
    const p = S.gym.plans[S.plan], cObj = findCoupon(S.cp), off = computeDiscount(p.p, cObj), tot = Math.max(0, p.p - off), validDate = fmt(till(p.m)), mem = currentMemberRecord();
    mem[7] = p.n; mem[8] = validDate; mem[10] = tot; S.upiToday += tot; S.renewalsToday += 1; S.transactions.unshift([mem[0], p.n, tot, appName || 'UPI', 'Just now']);
    $('#modal').hidden = true; saveState(); render(); toast(`Payment of ${inr(tot)} verified! Membership valid till ${validDate}.`);
  },
  closeModal: () => { $('#modal').hidden = true; },
  scan: () => {
    const mem = currentMemberRecord(); if (mem[0] === 'Unknown Member') return toast('You are not registered.');
    const n = new Date(), timeStr = n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), batch = n.getHours() < 15 ? 'Morning' : 'Evening';
    S.markedByPhone[mem[6]] = { t: `${mem[0]} · Checked in at ${timeStr}`, b: batch }; mem[5][TD()] = 1; S.attTotal += 1; if (batch === 'Morning') S.attMorning += 1; else S.attEvening += 1;
    S.weekChart[TD()] = Math.min(100, (S.weekChart[TD()] || 70) + 4); S.attList.unshift([mem[0], timeStr, batch, mem[9] ? 1 : 0]); saveState(); render(); toast(`Check-in confirmed for ${mem[0]}`);
  },
  openCheckinModal: () => {
    if (S.members.length === 0) return toast('No members registered yet.');
    $('#modal-body').innerHTML = `<div class="rw between"><b class="h">Manual Member Check-In</b><button class="icon-btn" data-act="closeModal">✕</button></div><label class="m" for="checkin-name">Select Registered Member</label><select id="checkin-name" class="in">${S.members.map(m => `<option value="${m[0]}">${m[0]} (${m[9] && m[11] ? m[11] + 'M Trainer' : 'Self Workout'})</option>`).join('')}</select><button class="b top" data-act="confirmManualCheckin">Mark Present Now</button>`;
    $('#modal').hidden = false;
  },
  confirmManualCheckin: () => {
    const name = ($('#checkin-name').value || '').trim(); if (!name) return toast('Please select a member');
    const n = new Date(), timeStr = n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), batch = n.getHours() < 15 ? 'Morning' : 'Evening', mem = S.members.find(m => m[0] === name);
    S.attList.unshift([name, timeStr, batch, mem && mem[9] ? 1 : 0]); if (mem) mem[5][TD()] = 1; S.attTotal += 1; if (batch === 'Morning') S.attMorning += 1; else S.attEvening += 1;
    $('#modal').hidden = true; saveState(); render(); toast(`${name} checked in for ${batch} batch`);
  },
  save: () => {
    const summary = computeReceptionFeeSummary(), enteredName = S.q.trim(), found = S.members.find(x => x[0].toLowerCase() === enteredName.toLowerCase());
    if (!found) return toast('Member not found. Register them in the Members tab first.');
    const gymValidStr = fmt(till(summary.planObj.m)), ptValidStr = S.feeTrainerReq ? fmt(till(summary.tMonths)) : 'None';
    found[7] = summary.planObj.n; found[8] = gymValidStr; found[9] = S.feeTrainerReq; found[10] = summary.finalPayable; found[11] = S.feeTrainerReq ? summary.tMonths : 0; found[12] = ptValidStr;
    if (S.mode === 'Cash') S.cashToday += summary.finalPayable; else S.upiToday += summary.finalPayable; S.renewalsToday += 1;
    const descLabel = `${summary.planObj.n}${S.feeTrainerReq ? ` + ${summary.tMonths}M Trainer` : ''}${summary.hasCustomOverride ? ' (Custom)' : ''}`;
    S.transactions.unshift([found[0], descLabel, summary.finalPayable, S.mode, 'Just now']); saveState();
    openUrl(wa(`${S.gym.name} — Official Payment Receipt\nMember: ${found[0]}\nGym Plan: ${summary.planObj.n} (${inr(summary.planObj.p)} · Valid till ${gymValidStr})\nPersonal Trainer: ${S.feeTrainerReq ? `${summary.tMonths} ${summary.tMonths === 1 ? 'Month' : 'Months'} (${inr(summary.trainerFee)} · Valid till ${ptValidStr})` : 'Self Workout (₹0)'}\n${summary.couponObj ? `Coupon Applied: ${summary.couponObj.code} (-${inr(summary.discount)})\n` : ''}Total Paid: ${inr(summary.finalPayable)} (${S.mode})\nThank you for training with ${S.gym.name}!`, found[6]));
    toast(`Collected ${inr(summary.finalPayable)} & generated WhatsApp receipt`); render();
  },
  markReminded: (v, el) => { const idx = +el.dataset.i; if (S.renewals[idx]) { S.renewals[idx][5] = true; saveState(); setTimeout(render, 200); } },
  remind: () => { S.renewals.forEach(r => { r[5] = true; }); saveState(); render(); toast(`Renewal reminders marked sent`); },
  adjWeight: (v, el) => { const idx = +el.dataset.i; const delta = parseFloat(el.dataset.d); if (S.members[idx]) { S.members[idx][3] = Math.round((S.members[idx][3] + delta) * 10) / 10; saveState(); render(); toast(`Updated ${S.members[idx][0]}'s current weight to ${S.members[idx][3]} kg`); } },
  diet: () => {
    const memberName = S.selectedDietMember, memberObj = S.members.find(m => m[0] === memberName) || S.members[0]; if (!memberObj) return toast('No member selected');
    const planData = S.mealsByMember[memberName], totalKcal = planData.meals.reduce((a, m) => a + Number(m[2] || 0), 0);
    openUrl(wa(`${S.gym.name} — Personalized Nutrition Plan for ${memberName}\n\n` + planData.meals.map(m => `• ${m[0]}: ${m[1]} (${m[2]} kcal)`).join('\n') + `\n\nDaily Target: ${totalKcal} kcal | Protein: ${planData.macros.p}g · Carbs: ${planData.macros.c}g · Fats: ${planData.macros.f}g`, memberObj[6]));
    toast(`Saved & opened ${memberName}'s nutrition plan in WhatsApp`);
  },
  markInactiveContacted: (v, el) => { const idx = +el.dataset.i; if (S.inactive[idx]) { S.inactive[idx][4] = true; saveState(); setTimeout(render, 200); } },
  bulk: () => { S.inactive.forEach(i => { i[4] = true; }); saveState(); render(); toast(`Follow-up messages marked sent`); }
};

function render() {
  if (S.screen !== 'login' && !S.loggedInUser) S.screen = 'login';
  if (S.loggedInUser && !ROLES[S.loggedInUser.role].includes(S.screen)) S.screen = ROLES[S.loggedInUser.role][0];
  const lg = S.screen === 'login'; $('#topbar').hidden = lg; $('#nav').hidden = lg;
  if (!lg && S.loggedInUser) {
    $('#brand-logo').textContent = S.gym.code; $('#brand-title').textContent = S.gym.name; $('#user-badge').textContent = `${S.loggedInUser.name} · ${S.loggedInUser.role}`;
    $('#nav').innerHTML = ROLES[S.loggedInUser.role].map(k => `<button class="${k == S.screen ? 'on' : ''}" data-act="go" data-v="${k}">${NAME[k]}</button>`).join('');
  }
  $('#screen').innerHTML = V[S.screen](); if (S.screen === 'scan') startCameraPreview();
}

document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.type === 'checkbox') return; const act = b.dataset.act; if (A[act]) A[act](b.dataset.v, b); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.act === 'ex') { const mem = currentMemberRecord(); const key = `${mem[6]}_${S.split}`; if (!S.exProgress[key]) S.exProgress[key] = S.workoutSplits[S.split].items.map(() => 0); S.exProgress[key][+t.dataset.i] = t.checked ? 1 : 0; saveState(); render(); }
  if (t.id === 'diet-member') { S.selectedDietMember = t.value; saveState(); render(); }
  if (t.id === 'new-m-plan' || t.id === 'new-m-cp') updateRegModalPreview();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'mob') { S.mob = t.value.replace(/\D/g, ''); saveState(); }
  if (t.id === 'gym-id') { currentGymId = t.value.trim().toUpperCase(); }
  if (t.id === 'q') {
    S.q = t.value; const found = S.members.find(x => x[0].toLowerCase() === t.value.trim().toLowerCase());
    if (found) { S.feeTrainerReq = Boolean(found[9]); S.feeTrainerMonths = Number(found[11]) || 1; saveState(); render(); const qEl = $('#q'); if (qEl) { qEl.focus(); qEl.setSelectionRange(qEl.value.length, qEl.value.length); } return; }
    saveState();
  }
  if (t.id === 'fee-pt-months-in') { const val = Math.max(1, Math.min(24, parseInt(t.value, 10) || 1)); S.feeTrainerMonths = val; saveState(); render(); const el = $('#fee-pt-months-in'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  if (t.id === 'rec-cp-in') { S.recCouponCode = t.value.toUpperCase(); saveState(); render(); const el = $('#rec-cp-in'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  if (t.id === 'custom-amt') { S.customFeeAmount = t.value; saveState(); render(); const el = $('#custom-amt'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  if (t.id === 'new-m-spec' || t.id === 'new-m-pt-months') updateRegModalPreview();
  if (t.id === 'msg') { S.msg = t.value; saveState(); }
  if (t.id === 'mac-p' || t.id === 'mac-c' || t.id === 'mac-f') { const planData = S.mealsByMember[S.selectedDietMember]; if (planData) { planData.macros.p = parseInt($('#mac-p').value, 10) || 0; planData.macros.c = parseInt($('#mac-c').value, 10) || 0; planData.macros.f = parseInt($('#mac-f').value, 10) || 0; saveState(); } }
  if (t.id === 'att-search') { S.attFilter = t.value; render(); const input = $('#att-search'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  if (t.id === 'dir-search') { S.dirFilter = t.value; render(); const input = $('#dir-search'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  if (t.closest('#otp') && t.value && t.nextElementSibling) { t.nextElementSibling.focus(); }
});

syncFromCloud();
render();