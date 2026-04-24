// pages/payment/result.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PaymentResult() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    const { out_trade_no, trade_no, total_amount } = router.query;

    if (!out_trade_no) {
      setStatus('fail');
      setMessage('未收到订单信息');
      return;
    }

    // 调用后端验证接口
    fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ out_trade_no, trade_no, total_amount }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage('支付成功！您已是 Pro 会员');
          // 3秒后跳转首页
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          setStatus('fail');
          setMessage(data.error || '验证失败，请联系客服');
        }
      })
      .catch(err => {
        console.error('验证失败:', err);
        setStatus('fail');
        setMessage('网络错误，请稍后重试');
      });
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-xl font-bold mb-2">正在确认支付结果...</h1>
            <p className="text-gray-500">请稍候</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2">支付成功！</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-400">即将自动跳转...</p>
          </>
        )}
        {status === 'fail' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h1 className="text-2xl font-bold mb-2">验证失败</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              返回首页
            </button>
          </>
        )}
      </div>
    </div>
  );
}