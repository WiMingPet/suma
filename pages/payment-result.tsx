// pages/payment-result.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PaymentResult() {
  const router = useRouter();
  const [status, setStatus] = useState<'success' | 'failed' | 'loading'>('loading');

  useEffect(() => {
    // 获取 URL 参数
    const { out_trade_no, trade_no, total_amount } = router.query;

    if (out_trade_no) {
      // 调用后端验证支付状态
      fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ out_trade_no, trade_no, total_amount }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStatus('success');
          } else {
            setStatus('failed');
          }
        })
        .catch(() => setStatus('failed'));
    } else {
      setStatus('failed');
    }
  }, [router.query]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-xl font-bold">正在确认支付结果...</h1>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">支付成功！</h1>
          <p className="text-gray-600 mb-4">您已成为 Pro 会员</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
        <div className="text-red-500 text-6xl mb-4">✗</div>
        <h1 className="text-2xl font-bold mb-2">支付失败</h1>
        <p className="text-gray-600 mb-4">未能确认支付结果，请联系客服</p>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}