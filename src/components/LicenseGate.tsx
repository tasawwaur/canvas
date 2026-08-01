import React, { useState, useEffect } from 'react';

interface LicenseGateProps {
  children: React.ReactNode;
}

// Master Admin Key (unlimited)
const MASTER_KEY = "TASAWWAUR-ADMIN-2026";

// 7-Day Free Trial Key
const TRIAL_7DAY_KEY = "SURVEY-7DAY-DEMO-2026";

export const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const savedKey = localStorage.getItem('app_license_key');
      const savedExpiry = localStorage.getItem('app_license_expiry');

      if (savedKey) {
        if (savedKey === MASTER_KEY) {
          setIsAuthenticated(true);
          setRemainingTime('Unlimited');
          return;
        }

        if (savedExpiry) {
          const expTime = parseInt(savedExpiry, 10);
          const diff = expTime - Date.now();

          if (diff > 0) {
            setIsAuthenticated(true);
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            const timerStr = days > 0 
              ? `${days}d ${hours}h ${minutes}m ${seconds}s` 
              : `${hours}h ${minutes}m ${seconds}s`;

            setRemainingTime(timerStr);
          } else {
            setIsAuthenticated(false);
            setErrorMsg('Aapka 7-Day Free Trial Expire ho gaya hai!');
            localStorage.removeItem('app_license_key');
            localStorage.removeItem('app_license_expiry');
          }
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = licenseKey.trim().toUpperCase();

    if (cleanKey === MASTER_KEY) {
      localStorage.setItem('app_license_key', MASTER_KEY);
      localStorage.removeItem('app_license_expiry');
      setIsAuthenticated(true);
      setRemainingTime('Unlimited');
      setErrorMsg('');
      return;
    }

    if (cleanKey === TRIAL_7DAY_KEY) {
      let deviceId = localStorage.getItem('app_device_id');
      if (!deviceId) {
        deviceId = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('app_device_id', deviceId);
      }

      const boundDevice = localStorage.getItem('app_key_bound_device');
      if (boundDevice && boundDevice !== deviceId) {
        setErrorMsg('Ye 7-Day Demo Key dusre user/device par already active ho chuki hai!');
        return;
      }

      // Lock global fixed expiry time on first activation ever
      let fixedExpiry = localStorage.getItem('app_fixed_trial_expiry');
      if (!fixedExpiry) {
        fixedExpiry = (Date.now() + 7 * 24 * 60 * 60 * 1000).toString();
        localStorage.setItem('app_fixed_trial_expiry', fixedExpiry);
      }

      localStorage.setItem('app_license_key', TRIAL_7DAY_KEY);
      localStorage.setItem('app_license_expiry', fixedExpiry);
      localStorage.setItem('app_key_bound_device', deviceId);
      setIsAuthenticated(true);
      setErrorMsg('');
      return;
    }

    setErrorMsg('Invalid License Key! Please enter valid key.');
  };

  const handleLogout = () => {
    localStorage.removeItem('app_license_key');
    localStorage.removeItem('app_license_expiry');
    setIsAuthenticated(false);
    setLicenseKey('');
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0a0f1d',
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#111827',
        padding: '36px 40px',
        borderRadius: '16px',
        border: '1px solid #1f2937',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          backgroundColor: '#3b82f61a',
          color: '#3b82f6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          fontSize: '28px'
        }}>
          🔒
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: '#ffffff' }}>
          Land Survey CAD Platform
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
          Ye software protected hai. Canvas use karne ke liye valid <strong>License / Trial Key</strong> enter karein.
        </p>

        <form onSubmit={handleActivate}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input 
              type="text"
              placeholder="Enter / Paste License Key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData('text');
                if (pastedText) {
                  setLicenseKey(pastedText.trim());
                }
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '12px 14px',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                textAlign: 'center',
                letterSpacing: '0.5px'
              }}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    setLicenseKey(text.trim());
                  }
                } catch (err) {
                  // Fallback for browsers
                  const key = prompt("Paste your License Key here:");
                  if (key) setLicenseKey(key.trim());
                }
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 Auto Paste
            </button>
          </div>

          {errorMsg && (
            <div style={{ 
              backgroundColor: '#ef444420', 
              color: '#fca5a5', 
              padding: '10px', 
              borderRadius: '6px', 
              fontSize: '12px',
              marginBottom: '14px'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button 
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#2563eb',
              color: '#fff',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.2s'
            }}
          >
            Activate Access
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1f2937', fontSize: '12px', color: '#6b7280' }}>
          🔒 Private Survey Workspace Access System
        </div>
      </div>
    </div>
  );
};
