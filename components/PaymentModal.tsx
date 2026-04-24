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
  const [plan, setPlan] = useState<'month' | 'season' | 'year'>('month');

  const planPrices = { month: 29.9, season: 69.9, year: 199 };
  const planPoints = { month: 500, season: 1500, year: 5000 };

  const createOrder = async () => {
    setLoading(true);
    try {
      const amount = planPrices[plan];
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: method, amount, userId, plan }),
      });

      if (method === 'qrcode') {
        const data = await res.json();
        if (data.success) {
          setQrCode(data.qrCode);
          setOutTradeNo(data.outTradeNo);
        } else {
          alert(data.error || '创建订单失败');
        }
      } else {
        const data = await res.json();
        if (data.success && data.payUrl) {
          window.location.href = data.payUrl;
        } else {
          alert(data.error || '创建订单失败');
        }
        return;
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      alert('创建订单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 轮询查询订单状态
  useEffect(() => {
    if (!outTradeNo) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/order-status?outTradeNo=${outTradeNo}`);
        const data = await res.json();
        if (data.status === 'paid') {
          clearInterval(interval);
          onSuccess();
          onClose();
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [outTradeNo, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">升级 Pro 会员</h2>
        <p className="text-gray-600 mb-4">选择套餐支付，获得对应点币，享受无限次生成</p>

        <div className="flex gap-4 mb-4">
          <button
            className={`flex-1 py-2 rounded ${method === 'qrcode' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setMethod('qrcode')}
          >
            电脑扫码
          </button>
          <button
            className={`flex-1 py-2 rounded ${method === 'h5' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setMethod('h5')}
          >
            手机支付
          </button>
        </div>

        {/* 套餐选择 */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">选择套餐</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              className={`py-2 rounded border ${plan === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('month')}
            >
              📅 月卡<br/>29.9元
            </button>
            <button
              className={`py-2 rounded border ${plan === 'season' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('season')}
            >
              🌿 季卡<br/>69.9元
            </button>
            <button
              className={`py-2 rounded border ${plan === 'year' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('year')}
            >
              🏆 年卡<br/>199元
            </button>
          </div>
        </div>

        {!qrCode && !loading && (
          <button
            onClick={createOrder}
            className="w-full py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            生成订单
          </button>
        )}

        {loading && <p className="text-center">生成中...</p>}

        {qrCode && (
          <div className="flex flex-col items-center">
            <QRCodeCanvas value={qrCode} size={200} />
            <p className="mt-2 text-sm text-gray-600">请使用支付宝扫一扫支付</p>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-3 text-gray-500">
          取消
        </button>
      </div>
    </div>
  );
}