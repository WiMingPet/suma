import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, userId, onSuccess }: PaymentModalProps) {
  const [qrCode, setQrCode] = useState('');
  const [outTradeNo, setOutTradeNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'qrcode' | 'h5'>('qrcode');

  const createOrder = async () => {
    setLoading(true);
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: method, amount: '0.01', userId }),
    });
    if (method === 'qrcode') {
      const data = await res.json();
      setQrCode(data.qrCode);
      setOutTradeNo(data.outTradeNo);
    } else {
      // H5模式：直接跳转到支付宝页面
      const html = await res.text();
      document.write(html);
      return;
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!outTradeNo) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/order-status?outTradeNo=${outTradeNo}`);
      const data = await res.json();
      if (data.status === 'paid') {
        clearInterval(interval);
        onSuccess();
        onClose();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [outTradeNo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">升级 Pro 会员</h2>
        <div className="flex gap-4 mb-4">
          <button className={`px-4 py-2 rounded ${method === 'qrcode' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMethod('qrcode')}>电脑扫码</button>
          <button className={`px-4 py-2 rounded ${method === 'h5' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMethod('h5')}>手机支付</button>
        </div>
        {!qrCode && !loading && <button onClick={createOrder} className="bg-green-600 text-white px-6 py-2 rounded">生成订单</button>}
        {loading && <p>生成中...</p>}
        {qrCode && (
          <div className="flex flex-col items-center">
            <QRCodeCanvas value={qrCode} size={200} />
            <p className="mt-2 text-sm text-gray-600">请使用支付宝扫一扫支付</p>
          </div>
        )}
        <button onClick={onClose} className="mt-4 text-gray-500">取消</button>
      </div>
    </div>
  );
}