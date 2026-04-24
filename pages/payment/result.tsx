// pages/payment/result.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PaymentResult() {
  const router = useRouter();

  useEffect(() => {
    console.log('支付结果参数:', router.query);
    
    const { out_trade_no, trade_no, total_amount } = router.query;
    
    if (out_trade_no) {
      alert(`支付结果页面已收到回调，订单号：${out_trade_no}`);
    }
  }, [router.query]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">支付结果</h1>
        <p className="text-gray-600">正在处理您的支付结果...</p>
      </div>
    </div>
  );
}