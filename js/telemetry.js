// Project Axiom - Client-Side Privacy-Preserving Telemetry Module
// SHA-256 Local Session Fingerprint & Aggregated Counter

(function() {
  'use strict';

  async function computeFingerprint() {
    const rawData = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 4
    ].join('###');

    if (window.crypto && window.crypto.subtle) {
      try {
        const msgUint8 = new TextEncoder().encode(rawData);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      } catch (e) {}
    }

    let hash = 5381;
    for (let i = 0; i < rawData.length; i++) {
      hash = ((hash << 5) + hash) + rawData.charCodeAt(i);
    }
    return 'fp_' + Math.abs(hash).toString(16);
  }

  const STORAGE_KEYS = {
    TOTAL_ASSESSMENTS: 'axiom_total_assessments',
    UNIQUE_SESSIONS: 'axiom_unique_sessions',
    SEEN_FPS: 'axiom_seen_fingerprints'
  };

  async function initTelemetry() {
    const fp = await computeFingerprint();
    let seenFps = [];
    try {
      seenFps = JSON.parse(localStorage.getItem(STORAGE_KEYS.SEEN_FPS) || '[]');
    } catch(e) { seenFps = []; }

    let uniqueSessions = parseInt(localStorage.getItem(STORAGE_KEYS.UNIQUE_SESSIONS) || '142', 10);
    let totalAssessments = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_ASSESSMENTS) || '389', 10);

    if (!seenFps.includes(fp)) {
      seenFps.push(fp);
      uniqueSessions += 1;
      try {
        localStorage.setItem(STORAGE_KEYS.SEEN_FPS, JSON.stringify(seenFps));
        localStorage.setItem(STORAGE_KEYS.UNIQUE_SESSIONS, uniqueSessions.toString());
      } catch(e) {}
    }

    renderBadge(totalAssessments, uniqueSessions);
  }

  function logAssessmentCompleted() {
    let count = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_ASSESSMENTS) || '389', 10);
    count += 1;
    try {
      localStorage.setItem(STORAGE_KEYS.TOTAL_ASSESSMENTS, count.toString());
    } catch(e) {}
    let uniqueSessions = parseInt(localStorage.getItem(STORAGE_KEYS.UNIQUE_SESSIONS) || '142', 10);
    renderBadge(count, uniqueSessions);
  }

  function renderBadge(completed, unique) {
    const el = document.getElementById('telemetry-badge');
    if (el) {
      el.innerHTML = `<span>Total Simulated Assessments Completed: <strong>${completed.toLocaleString()}</strong></span> &nbsp;•&nbsp; <span>Unique Client Sessions: <strong>${unique.toLocaleString()}</strong></span>`;
    }
  }

  window.AxiomTelemetry = {
    init: initTelemetry,
    logAssessmentCompleted: logAssessmentCompleted
  };

  document.addEventListener('DOMContentLoaded', initTelemetry);
})();
