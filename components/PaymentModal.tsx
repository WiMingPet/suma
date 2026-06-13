// components/PaymentModal.tsx
import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { initiatePayment, getPaymentMethod, initIAP, getPlatform } from '../lib/payment';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  plan?: 'month' | 'season' | 'year';
}

export default function PaymentModal({ isOpen, onClose, userId, onSuccess, plan: initialPlan }: PaymentModalProps) {
  const [qrCode, setQrCode] = useState('');
  const [outTradeNo, setOutTradeNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'qrcode' | 'h5'>('qrcode');
  const [plan, setPlan] = useState<'month' | 'season' | 'year'>(initialPlan || 'month');  // ✅ 修正

  const planPrices = { month: 29.9, season: 69.9, year: 199 };
  const planPoints = { month: 500, season: 1500, year: 5000 };

  // 检测当前支付方式
  const paymentMethod = getPaymentMethod();
  const platform = getPlatform();
  const isIAP = paymentMethod === 'iap';

  // 初始化 IAP（仅 iOS）
  useEffect(() => {
    if (platform === 'ios') {
      initIAP();
    }
  }, [platform]);

  // 创建订单（新版本，统一支付入口）
  const createOrder = async () => {
    setLoading(true);
    
    try {
      // 使用统一支付接口
      const result = await initiatePayment({
        plan,
        amount: String(planPrices[plan]),
        points: planPoints[plan],
      });
      
      if (result.success) {
        if (isIAP) {
          // IAP 支付成功，直接返回
          alert(`支付成功！获得 ${planPoints[plan]} 点币`);
          onSuccess();
          onClose();
        } else {
          // 支付宝支付：需要轮询
          setOutTradeNo(result.orderId || '');
        }
      } else {
        alert(result.message || '创建订单失败');
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      alert('创建订单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 支付宝旧版订单创建（保留兼容）
  const createAlipayOrder = async () => {
    setLoading(true);
    try {
      const amount = planPrices[plan];
      const res = await fetch('https://suma.zeabur.app/api/create-payment', {
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
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      alert('创建订单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理支付按钮点击
  const handlePayment = () => {
    if (isIAP) {
      // iOS IAP 支付
      createOrder();
    } else {
      // 安卓/Web 支付宝支付
      createAlipayOrder();
    }
  };

  // 轮询查询订单状态（仅支付宝）
  useEffect(() => {
    if (!outTradeNo || isIAP) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`https://suma.zeabur.app/api/order-status?outTradeNo=${outTradeNo}`);
        const data = await res.json();
        if (data.status === 'paid') {
          clearInterval(interval);
          alert(`支付成功！获得 ${planPoints[plan]} 点币`);
          onSuccess();
          onClose();
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [outTradeNo, onSuccess, onClose, plan, planPoints, isIAP]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">升级 Pro 会员</h2>
        <p className="text-gray-600 mb-4">选择套餐支付，获得对应点币，享受无限次生成</p>

        {/* 支付方式提示（仅 iOS 显示） */}
        {isIAP && (
          <div className="mb-4 p-2 bg-blue-50 rounded-lg text-center text-sm text-blue-700">
            🍎 使用 Apple 内购支付
          </div>
        )}

        {/* 支付方式选择（仅非 iOS 显示） */}
        {!isIAP && (
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
        )}

        {/* 套餐选择 */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">选择套餐</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              className={`py-2 rounded border ${plan === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('month')}
            >
              📅 月卡<br/>{planPrices.month}元
            </button>
            <button
              className={`py-2 rounded border ${plan === 'season' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('season')}
            >
              🌿 季卡<br/>{planPrices.season}元
            </button>
            <button
              className={`py-2 rounded border ${plan === 'year' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`}
              onClick={() => setPlan('year')}
            >
              🏆 年卡<br/>{planPrices.year}元
            </button>
          </div>
        </div>

        {/* 支付按钮 */}
        {!qrCode && !loading && (
          <button
            onClick={handlePayment}
            className="w-full py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            {isIAP ? `¥${planPrices[plan]} 立即购买` : '生成订单'}
          </button>
        )}

        {loading && <p className="text-center py-4">处理中...</p>}

        {/* 支付宝二维码 */}
        {qrCode && !isIAP && (
          <div className="flex flex-col items-center">
            <QRCodeCanvas value={qrCode} size={200} />
            <p className="mt-2 text-sm text-gray-600">请使用支付宝扫一扫支付</p>
            <p className="text-xs text-gray-500 mt-1">订单号: {outTradeNo}</p>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-3 text-gray-500">
          取消
        </button>
      </div>
    </div>
  );
}