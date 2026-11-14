# Aapka Gym – web prototype

Plain HTML + CSS + JavaScript. No install, no build step.

## Run
Open `index.html` in Chrome or Safari. On a phone, open it from any web host (see Deploy).
Demo login: any 10-digit mobile, OTP **1234**, then pick a role.

## Files
- `index.html` – page shell
- `styles.css` – design system (colours, type, cards, buttons, nav)
- `app.js` – all 11 screens, role navigation, interactions and sample data
- `tokens.json` – design tokens for designers or other platforms (Flutter, Android, React Native)
- `members.sample.csv` – template for moving paper-register members into a database

## What works
Role-based nav, plan and coupon (`NEWYEAR10`) with live total, QR scan simulation with batch and streak,
workout checkboxes, fee amount and validity dates, WhatsApp receipts / diet plan / reminders (wa.me links).

## What is demo only
OTP, UPI payment, QR camera, attendance numbers and bulk WhatsApp are simulated. To go live you need:
1. Backend + database (Supabase, Firebase or Node + PostgreSQL) for members, payments and attendance.
2. SMS OTP (MSG91, Firebase Auth) and Razorpay or Cashfree for UPI.
3. WhatsApp Business API (Gupshup, Interakt, WATI) for bulk reminders.
4. A QR library such as `html5-qrcode` for real scanning.

## Deploy
Drag this folder onto Netlify Drop, or push it to GitHub Pages.
