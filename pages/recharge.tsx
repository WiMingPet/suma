// pages/recharge.tsx
import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

export default function RechargePage() {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/user-info', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setUser(data.user);
        });
    }
  }, []);

  const handleRecharge = async (planKey: string, planName: string, amount: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devMode) {
          window.location.href = data.payUrl;
        } else if (data.isMobile && data.payUrl) {
          window.location.href = data.payUrl;
        } else if (data.payUrl) {
          // PC端展示二维码（支付宝返回的是HTML表单，需要提取二维码）
          // 简化处理：跳转到支付宝页面
          window.location.href = data.payUrl;
        }
      } else {
        alert(data.error || '创建订单失败');
      }
    } catch (error) {
      alert('网络错误，请稍后重试');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-6 mb-4">
          <h1 className="text-2xl font-bold text-center">充值中心</h1>
          {user && (
            <div className="mt-2 text-center text-gray-600">
              当前状态：{user.isPro ? 'Pro会员' : '普通用户'}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div
            onClick={() => handleRecharge('basic', '基础包', 9.9)}
            className="bg-white rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">基础包</div>
                <div className="text-gray-500">100 点算力</div>
              </div>
              <div className="text-2xl font-bold text-orange-500">¥9.9</div>
            </div>
          </div>

          <div
            onClick={() => handleRecharge('recommended', '推荐包', 49.9)}
            className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition border-2 border-orange-300"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg text-orange-600">⭐ 推荐包</div>
                <div className="text-gray-500">650 点算力</div>
              </div>
              <div className="text-2xl font-bold text-orange-500">¥49.9</div>
            </div>
          </div>

          <div
            onClick={() => handleRecharge('premium', '超值包', 99.9)}
            className="bg-white rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">超值包</div>
                <div className="text-gray-500">1700 点算力</div>
              </div>
              <div className="text-2xl font-bold text-orange-500">¥99.9</div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>正在跳转支付...</p>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-gray-400 text-sm">
          支付成功后自动升级Pro会员，有效期30天
        </div>
      </div>
    </div>
  );
}