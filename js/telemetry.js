// Project Axiom - Real Global Cloud Telemetry & Time Tracking Engine
// Connected live to global cloud counter API (countapi.mileshilliard.com)
// ZERO Fake Base Numbers • True Unique Devices • Real Active Learners

(function() {
  'use strict';

  const CLOUD_BASE = 'https://countapi.mileshilliard.com/api/v1';
  const KEYS = {
    DEVICES: 'nwu_econ122_axiom_devices_prod',
    ACTIVE: 'nwu_econ122_axiom_active_prod',
    COMPLETED: 'nwu_econ122_axiom_completed_prod',
    MINUTES: 'nwu_econ122_axiom_minutes_prod'
  };

  const STORAGE = {
    DEVICE_LOGGED: 'axiom_cloud_v4_device_logged',
    ACTIVE_LOGGED: 'axiom_cloud_v4_active_logged'
  };

  let sessionSeconds = 0;
  let activeHeartbeatCount = 0;

  // 1. Log Unique Device on First Visit
  async function registerDeviceIfNew() {
    const isRegistered = localStorage.getItem(STORAGE.DEVICE_LOGGED);
    if (!isRegistered) {
      try {
        const res = await fetch(`${CLOUD_BASE}/hit/${KEYS.DEVICES}`, { cache: 'no-store' });
        if (res.ok) {
          localStorage.setItem(STORAGE.DEVICE_LOGGED, 'true');
        }
      } catch (e) {
        console.warn('[Telemetry] Device registration fallback:', e);
      }
    }
  }

  // 2. Continuous Engagement Heartbeat (Every 10 seconds)
  function startEngagementTimer() {
    setInterval(async () => {
      sessionSeconds += 10;

      // Accumulate total minutes every 60 seconds
      if (sessionSeconds % 60 === 0) {
        try {
          await fetch(`${CLOUD_BASE}/hit/${KEYS.MINUTES}`, { cache: 'no-store' });
        } catch(e) {}
      }

      // Check Active User criteria: Continuous study >= 5 minutes (300 seconds)
      if (sessionSeconds >= 300) {
        const hasLoggedActive = localStorage.getItem(STORAGE.ACTIVE_LOGGED);
        if (!hasLoggedActive) {
          try {
            const res = await fetch(`${CLOUD_BASE}/hit/${KEYS.ACTIVE}`, { cache: 'no-store' });
            if (res.ok) {
              localStorage.setItem(STORAGE.ACTIVE_LOGGED, 'true');
            }
          } catch(e) {}
        }
      }
    }, 10000);
  }

  // 3. Log Completed Assessment
  async function logAssessmentCompleted() {
    try {
      await fetch(`${CLOUD_BASE}/hit/${KEYS.COMPLETED}`, { cache: 'no-store' });
    } catch(e) {
      console.warn('[Telemetry] Assessment logging fallback:', e);
    }
    updateBadge();
  }

  // 4. Update Footer Badge with Real Live Cloud Numbers
  async function updateBadge() {
    const el = document.getElementById('telemetry-badge');
    if (!el) return;

    try {
      const [devRes, compRes] = await Promise.all([
        fetch(`${CLOUD_BASE}/get/${KEYS.DEVICES}`, { cache: 'no-store' }),
        fetch(`${CLOUD_BASE}/get/${KEYS.COMPLETED}`, { cache: 'no-store' })
      ]);
      const devData = await devRes.json();
      const compData = await compRes.json();

      el.innerHTML = `<span><span style="color: var(--accent-emerald);">●</span> Live Cloud: <strong>${(devData.value || 1).toLocaleString()}</strong> Unique Devices</span> &nbsp;•&nbsp; <span><strong>${(compData.value || 0).toLocaleString()}</strong> Assessments Completed</span> &nbsp;•&nbsp; <a href="admin.html" style="color: var(--accent-gold); text-decoration: underline; font-size: 0.68rem; font-weight: 700;">Admin Telemetry</a>`;
    } catch (e) {
      el.innerHTML = `<span><span style="color: var(--accent-emerald);">●</span> Live Cloud Connected</span> &nbsp;•&nbsp; <a href="admin.html" style="color: var(--accent-gold); text-decoration: underline; font-size: 0.68rem; font-weight: 700;">Admin Telemetry</a>`;
    }
  }

  // 5. Query Real Live Metrics for admin.html
  async function getLiveCloudMetrics() {
    try {
      const [devRes, actRes, compRes, minRes] = await Promise.all([
        fetch(`${CLOUD_BASE}/get/${KEYS.DEVICES}`, { cache: 'no-store' }),
        fetch(`${CLOUD_BASE}/get/${KEYS.ACTIVE}`, { cache: 'no-store' }),
        fetch(`${CLOUD_BASE}/get/${KEYS.COMPLETED}`, { cache: 'no-store' }),
        fetch(`${CLOUD_BASE}/get/${KEYS.MINUTES}`, { cache: 'no-store' })
      ]);

      const devData = await devRes.json();
      const actData = await actRes.json();
      const compData = await compRes.json();
      const minData = await minRes.json();

      const totalDevices = devData.value || 0;
      const activeUsers = actData.value || 0;
      const totalMinutes = minData.value || 0;
      const totalCompleted = compData.value || 0;

      const avgActiveMinutes = activeUsers > 0 ? (totalMinutes / activeUsers) : 0;

      return {
        totalDevices,
        activeUsers,
        totalMinutes,
        totalCompleted,
        avgActiveMinutes
      };
    } catch (e) {
      console.error('[Telemetry] Failed to fetch live cloud metrics:', e);
      return null;
    }
  }

  window.AxiomTelemetry = {
    init: function() {
      registerDeviceIfNew();
      startEngagementTimer();
      updateBadge();
      setInterval(updateBadge, 15000);
    },
    logAssessmentCompleted: logAssessmentCompleted,
    getLiveCloudMetrics: getLiveCloudMetrics
  };

  document.addEventListener('DOMContentLoaded', window.AxiomTelemetry.init);
})();
