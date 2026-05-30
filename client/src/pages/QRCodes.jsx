import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/common/PageHeader';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, ArrowPathIcon, QrCodeIcon } from '@heroicons/react/24/outline';

const SERVER = process.env.REACT_APP_PUBLIC_URL || 'http://localhost:4000';

export default function QRCodes() {
  const { isAdmin } = useAuth();
  const [qrCodes, setQrCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cacheBust, setCacheBust] = useState(Date.now());

  const load = async () => {
    try {
      const r = await api.get('/qr');
      setQrCodes(r.data);
    } catch { toast.error('Failed to load QR codes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const regenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/qr/generate');
      const newBust = Date.now();
      setCacheBust(newBust);
      toast.success('QR codes regenerated');
      load();
    } catch { toast.error('Failed to generate QR codes'); }
    finally { setGenerating(false); }
  };

  const download = async (slug) => {
    try {
      const r = await api.get(`/qr/${slug}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gojump-qr-${slug}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Codes"
        subtitle="One QR code per dropzone — print and post for anonymous hazard reporting"
        actions={
          isAdmin && (
            <button onClick={regenerate} disabled={generating} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowPathIcon className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Regenerating...' : 'Regenerate All'}
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {qrCodes.map((qr) => (
            <div key={qr.id} className="card flex flex-col items-center text-center">
              <h3 className="font-semibold text-gray-900 mb-3">{qr.name}</h3>
              {qr.qrCodeUrl ? (
                <img
                  src={`${SERVER}${qr.qrCodeUrl}?v=${cacheBust}`}
                  alt={`QR code for ${qr.name}`}
                  className="w-48 h-48 border border-gray-200 rounded-lg mb-3"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-3">
                  <QrCodeIcon className="h-16 w-16 text-gray-300" />
                </div>
              )}
              <p className="text-xs text-gray-400 mb-1">Scan to report a hazard</p>
              <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded px-2 py-1 mb-4 break-all">
                {qr.formUrl}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => download(qr.slug)}
                  className="btn-primary flex items-center gap-1.5 text-sm"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" /> Download PNG
                </button>
                <a href={qr.formUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                  Open Form
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card bg-blue-50 border-blue-100">
        <h4 className="font-semibold text-blue-900 mb-2">Posting Instructions</h4>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>Download the QR code PNG for your dropzone location</li>
          <li>Print at minimum 4×4 inches on weatherproof paper/signage</li>
          <li>Post at manifest, gear room, and aircraft loading area</li>
          <li>Include the following text: "Scan to report a safety concern — anonymous reporting available. Protected under GoJump Just Culture policy."</li>
          <li>QR codes link to a mobile-optimized form — no app or login required</li>
        </ol>
      </div>
    </div>
  );
}
