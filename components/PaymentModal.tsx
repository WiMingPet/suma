// components/PaymentModal.tsx
import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { initiatePayment, getPaymentMethod, initIAP, getPlatform, fetchProducts } from '../lib/payment/index';

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
  const [plan, setPlan] = useState<'month' | 'season' | 'year'>(initialPlan || 'month');
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const planPrices = { month: 29, season: 69, year: 199 };
  const planPoints = { month: 500, season: 1500, year: 5000 };

  const paymentMethod = getPaymentMethod();
  const platform = getPlatform();
  const isIAP = paymentMethod === 'iap';

  useEffect(() => {
    if (platform === 'ios') {
      initIAP();
    }
  }, [platform]);

  useEffect(() => {
    if (isOpen && isIAP) {
      loadProducts();
    }
  }, [isOpen, isIAP]);

  useEffect(() => {
    if (!isOpen) {
      setQrCode('');
      setOutTradeNo('');
      setLoading(false);
      setPollCount(0);
    }
  }, [isOpen]);

  const setDefaultPlans = () => {
    setPlans([
      { id: 'com.sumaai.coins_500', name: '500点币', price: '¥29', points: 500 },
      { id: 'com.sumaai.coins_1500', name: '1500点币', price: '¥69', points: 1500 },
      { id: 'com.sumaai.coins_5000', name: '5000点币', price: '¥199', points: 5000 },
    ]);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const products = await fetchProducts();
      if (products && products.length > 0) {
        const planList = products.map((p: any) => {
          let name = '500点币';
          let points = 500;
          if (p.identifier?.includes('coins_1500')) { name = '1500点币'; points = 1500; }
          if (p.identifier?.includes('coins_5000')) { name = '5000点币'; points = 5000; }
          return { id: p.identifier, name, price: p.priceString || `¥${planPrices[plan]}`, points };
        });
        setPlans(planList);
      } else {
        setDefaultPlans();
      }
    } catch (error) {
      console.error('加载产品失败:', error);
      setDefaultPlans();
    } finally {
      setLoadingProducts(false);
    }
  };

  const createOrder = async () => {
    setLoading(true);
    try {
      const result = await initiatePayment({
        plan,
        amount: String(planPrices[plan]),
        points: planPoints[plan],
      });
      if (result.success) {
        if (isIAP) {
          alert(`支付成功！获得 ${planPoints[plan]} 点币`);
          onSuccess();
          onClose();
        } else {
          setOutTradeNo(result.orderId || '');
        }
      } else {
        alert(result.message || '购买失败，请重试');
      }
    } catch (error: any) {
      console.error('创建订单失败:', error);
      alert('支付失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const createAlipayOrder = async () => {
    setLoading(true);
    try {
      const amount = planPrices[plan];
      const effectiveUserId = userId || `guest_${Date.now()}`;
      const res = await fetch('https://sumaai.cn/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: method, amount, userId: effectiveUserId, plan }),
      });
      const data = await res.json();
      if (method === 'qrcode') {
        if (data.success) {
          setQrCode(data.qrCode);
          setOutTradeNo(data.outTradeNo);
        } else {
          alert(data.error || '创建订单失败');
        }
      } else {
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

  const handlePayment = () => {
    if (isIAP) {
      createOrder();
    } else {
      createAlipayOrder();
    }
  };

  useEffect(() => {
    if (!outTradeNo || isIAP) return;
    const maxPolls = 30;
    const interval = setInterval(async () => {
      setPollCount(prev => {
        const next = prev + 1;
        if (next >= maxPolls) {
          clearInterval(interval);
          return next;
        }
        return next;
      });
      try {
        const res = await fetch(`https://sumaai.cn/api/order-status?outTradeNo=${outTradeNo}`);
        const data = await res.json();
        if (data.isPaid) {
          clearInterval(interval);
          alert(`✅ 支付成功！获得 ${planPoints[plan]} 点币`);
          onSuccess();
          onClose();
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [outTradeNo, onSuccess, onClose, plan, planPoints, isIAP]);

  const handleManualConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://sumaai.cn/api/order-status?outTradeNo=${outTradeNo}&force=paid`);
      const data = await res.json();
      if (data.success) {
        alert(`✅ 支付确认成功！获得 ${planPoints[plan]} 点币`);
        onSuccess();
        onClose();
      } else {
        alert(data.message || '未检测到支付');
      }
    } catch (err) {
      alert('确认失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getDisplayPrice = () => {
    if (isIAP && plans.length > 0) {
      const id = plan === 'month' ? 'com.sumaai.coins_500' :
                 plan === 'season' ? 'com.sumaai.coins_1500' : 'com.sumaai.coins_5000';
      const p = plans.find((item: any) => item.id === id);
      if (p) return p.price;
    }
    return `¥${planPrices[plan]}`;
  };

  // 根据平台显示不同支付提示
  const getPaymentHint = () => {
    if (isIAP) return '🍎 使用 Apple 内购支付';
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">购买点币</h2>
        <p className="text-gray-600 mb-4">选择套餐，获得对应点币</p>

        {getPaymentHint() && (
          <div className="mb-4 p-2 bg-blue-50 rounded-lg text-center text-sm text-blue-700">
            {getPaymentHint()}
          </div>
        )}

        {!isIAP && platform !== 'harmony' && (
          <div className="flex gap-4 mb-4">
            <button className={`flex-1 py-2 rounded ${method === 'qrcode' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMethod('qrcode')}>
              电脑扫码
            </button>
            <button className={`flex-1 py-2 rounded ${method === 'h5' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={() => setMethod('h5')}>
              手机支付
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">选择套餐</label>
          <div className="grid grid-cols-3 gap-2">
            {isIAP && loadingProducts ? (
              <div className="col-span-3 text-center py-4 text-gray-500">加载中...</div>
            ) : (
              <>
                <button className={`py-2 rounded border ${plan === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`} onClick={() => setPlan('month')}>
                  💰 500点币<br/>
                  {(isIAP || platform === 'harmony') && plans.length > 0 ? plans.find((p: any) => p.id === 'com.sumaai.coins_500')?.price || '¥29' : '¥29'}
                </button>
                <button className={`py-2 rounded border ${plan === 'season' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`} onClick={() => setPlan('season')}>
                  💰 1500点币<br/>
                  {(isIAP || platform === 'harmony') && plans.length > 0 ? plans.find((p: any) => p.id === 'com.sumaai.coins_1500')?.price || '¥69' : '¥69'}
                </button>
                <button className={`py-2 rounded border ${plan === 'year' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-300'}`} onClick={() => setPlan('year')}>
                  💰 5000点币<br/>
                  {(isIAP || platform === 'harmony') && plans.length > 0 ? plans.find((p: any) => p.id === 'com.sumaai.coins_5000')?.price || '¥199' : '¥199'}
                </button>
              </>
            )}
          </div>
        </div>

        {!qrCode && !loading && (
          <button onClick={handlePayment} disabled={(isIAP || platform === 'harmony') && loadingProducts} className="w-full py-3 bg-green-600 text-white rounded-lg disabled:opacity-50">
            {(isIAP || platform === 'harmony') ? `${getDisplayPrice()} 立即购买` : '生成订单'}
          </button>
        )}

        {loading && <p className="text-center py-4">处理中...</p>}

        {qrCode && !isIAP && platform !== 'harmony' && (
          <div className="flex flex-col items-center">
            <QRCodeCanvas value={qrCode} size={200} />
            <p className="mt-2 text-sm text-gray-600">请使用支付宝扫一扫支付</p>
            <p className="text-xs text-gray-500 mt-1">订单号: {outTradeNo}</p>
          </div>
        )}

        {!isIAP && platform !== 'harmony' && outTradeNo && (
          <button onClick={handleManualConfirm} disabled={loading} className="w-full mt-2 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50">
            {loading ? '确认中...' : '我已支付，手动确认'}
          </button>
        )}

        <button onClick={onClose} className="w-full mt-3 text-gray-500">
          取消
        </button>
      </div>
    </div>
  );
}