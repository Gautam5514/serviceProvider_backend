/**
 * Background Check Utility — IDfy Integration Stub
 *
 * Production setup:
 *   1. Sign up at https://app.idfy.io and get API_KEY + ACCOUNT_ID
 *   2. Add to .env:
 *        IDFY_API_KEY=your_key_here
 *        IDFY_ACCOUNT_ID=your_account_id
 *   3. The functions below will call real IDfy endpoints automatically.
 *
 * While env vars are missing the functions return a "pending" result so
 * the onboarding flow stays functional for development & demo.
 */

const IDFY_BASE = "https://eve.idfy.com/v3";

async function idfyRequest(path, body) {
  const key     = process.env.IDFY_API_KEY;
  const account = process.env.IDFY_ACCOUNT_ID;

  if (!key || !account) {
    // Stub: return pending so the flow doesn't break without credentials
    return { status: "pending", message: "IDfy credentials not configured." };
  }

  const res = await fetch(`${IDFY_BASE}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type":   "application/json",
      "api-key":        key,
      "account-id":     account,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IDfy ${path} failed: ${err}`);
  }
  return res.json();
}

// ─── Aadhaar OTP verification ─────────────────────────────────────────────────
// Step 1: Generate OTP to the Aadhaar-linked mobile
async function initiateAadhaarOtp(aadhaarNumber) {
  return idfyRequest("/tasks/sync/extract/ind_aadhaar_otp_generate", {
    task_id:  `aadhaar-${Date.now()}`,
    group_id: `grp-${Date.now()}`,
    data:     { id_number: aadhaarNumber },
  });
}

// Step 2: Verify OTP and get Aadhaar details
async function verifyAadhaarOtp(referenceId, otp) {
  return idfyRequest("/tasks/sync/extract/ind_aadhaar_otp_verify", {
    task_id:      `aadhaar-verify-${Date.now()}`,
    group_id:     `grp-${Date.now()}`,
    data:         { otp, share_code: "1234" },
    reference_id: referenceId,
  });
}

// ─── PAN verification ─────────────────────────────────────────────────────────
async function verifyPan(panNumber, name) {
  return idfyRequest("/tasks/sync/verify_with_source/ind_pan_plus", {
    task_id:  `pan-${Date.now()}`,
    group_id: `grp-${Date.now()}`,
    data:     { id_number: panNumber, name },
  });
}

// ─── Face match (selfie vs Aadhaar photo) ─────────────────────────────────────
// imageBase64: base64-encoded JPEG string (no data-URI prefix)
async function matchFace(selfieBase64, aadhaarPhotoBase64) {
  return idfyRequest("/tasks/sync/verify/ind_face_match", {
    task_id:  `face-${Date.now()}`,
    group_id: `grp-${Date.now()}`,
    data: {
      image1: { source: { base_64: selfieBase64 } },
      image2: { source: { base_64: aadhaarPhotoBase64 } },
    },
  });
}

// ─── Criminal record / court check ────────────────────────────────────────────
async function runCriminalCheck(name, dob, fatherName) {
  return idfyRequest("/tasks/async/verify/ind_criminal_court_check", {
    task_id:  `criminal-${Date.now()}`,
    group_id: `grp-${Date.now()}`,
    data:     { full_name: name, dob, father_name: fatherName },
  });
}

module.exports = {
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  verifyPan,
  matchFace,
  runCriminalCheck,
};
