// pages/member-center.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../contexts/UserContext';
import PaymentModal from '../components/PaymentModal';

export default function MemberCenter() {
  const router = useRouter();
  const { user, loading, refreshUser } = useUser();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'month' | 'season' | 'year'>('month');

  const plans = {
    month: { name: '月卡', price: 29.9, points: 500, days: 30 },
    season: { name: '季卡', price: 69.9, points: 1500, days: 90 },
    year: { name: '年卡', price: 199, points: 5000, days: 365 },
  };

  const handleBuy = (plan: 'month' | 'season' | 'year') => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handleBack = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!user || !user.phone) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">未登录，请返回首页登录</p>
        <button onClick={() => router.push('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleBack} className="p-2 hover:bg-white/20 rounded-lg transition flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回
          </button>
          <h1 className="text-xl font-bold">会员中心</h1>
          <div className="w-16"></div>
        </div>

        <div className="mt-4 flex justify-between items-end">
          <div>
            <p className="text-sm opacity-90">手机号</p>
            <p className="text-lg font-semibold">{user.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">点币余额</p>
            <p className="text-2xl font-bold">{user.points || 0}</p>
          </div>
        </div>
        {user.is_pro && (user as any).pro_expire_at && (
          <div className="mt-3 text-sm bg-white/20 rounded-lg p-2 text-center">
            会员有效期至：{new Date((user as any).pro_expire_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">选择套餐</h2>
        <div className="space-y-3">
          {Object.entries(plans).map(([key, plan]) => (
            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-sm text-gray-500">赠送 {plan.points} 点币</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-orange-500">¥{plan.price}</p>
                <button
                  onClick={() => handleBuy(key as 'month' | 'season' | 'year')}
                  className="mt-1 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-full"
                >
                  购买
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium mb-2">💡 购买须知</p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
            <li>点币有效期为永久</li>
            <li>会员权益在有效期内有效</li>
            <li>购买后不支持退款</li>
            <li>支付方式：Apple Pay / 支付宝（根据设备自动适配）</li>
          </ul>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userId={user?.id || user?.phone || ''}
        onSuccess={() => {
          setShowPaymentModal(false);
          refreshUser();
          alert('支付成功！');
        }}
        plan={selectedPlan}
      />
    </div>
  );
}