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
  const [expiryInfo, setExpiryInfo] = useState<string>('');

  useEffect(() => {
    const savedKey = localStorage.getItem('app_license_key');
    const savedExpiry = localStorage.getItem('app_license_expiry');

    if (savedKey) {
      if (savedKey === MASTER_KEY) {
        setIsAuthenticated(true);
        setExpiryInfo('Unlimited Access (Admin)');
        return;
      }

      if (savedExpiry) {
        const expTime = parseInt(savedExpiry, 10);
        if (Date.now() < expTime) {
          setIsAuthenticated(true);
          const daysLeft = Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24));
          setExpiryInfo(`Trial Active (${daysLeft} days remaining)`);
        } else {
          setErrorMsg('Aapka 7-Day Free Trial Expire ho gaya hai! Activation Key dalein.');
          localStorage.removeItem('app_license_key');
          localStorage.removeItem('app_license_expiry');
        }
      }
    }
  }, []);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = licenseKey.trim().toUpperCase();

    if (cleanKey === MASTER_KEY) {
      localStorage.setItem('app_license_key', MASTER_KEY);
      localStorage.removeItem('app_license_expiry');
      setIsAuthenticated(true);
      setExpiryInfo('Unlimited Access (Admin)');
      setErrorMsg('');
      return;
    }

    if (cleanKey === TRIAL_7DAY_KEY) {
      // Get or create unique device ID for single user locking
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

      const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('app_license_key', TRIAL_7DAY_KEY);
      localStorage.setItem('app_license_expiry', sevenDaysFromNow.toString());
      localStorage.setItem('app_key_bound_device', deviceId);
      setIsAuthenticated(true);
      setExpiryInfo('7 Days Free Trial (Single User)');
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
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <button
          onClick={handleLogout}
          title="Logout License Session"
          style={{
            position: 'fixed',
            top: '8px',
            right: '16px',
            zIndex: 9999,
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          🔒 Logout Key ({expiryInfo})
        </button>
        {children}
      </div>
    );
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
          <input 
            type="text"
            placeholder="Paste License Key Here (Ctrl + V)"
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
              width: '100%',
              padding: '14px 16px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '16px',
              textAlign: 'center',
              letterSpacing: '1px'
            }}
          />

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
