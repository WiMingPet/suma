// pages/member-center.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../contexts/UserContext';
import PaymentModal from '../components/PaymentModal';

export default function MemberCenter() {
  const router = useRouter();
  const { user, loading, refreshUser, logout } = useUser();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'month' | 'season' | 'year'>('month');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const plans = {
    month: { name: '500点币', price: 29, points: 500 },
    season: { name: '1500点币', price: 69, points: 1500 },
    year: { name: '5000点币', price: 199, points: 5000 },
  };

  const handleBuy = (plan: 'month' | 'season' | 'year') => {
    // ✅ 不再检查登录，直接打开支付
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('⚠️ 确定要永久删除账号吗？\n\n此操作不可撤销，您的所有数据（包括点币、生成的应用等）将被清除。')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ 账号已成功删除，感谢您的使用。');
        await logout();
        router.push('/');
      } else {
        alert(`❌ 删除失败：${data.error || '请稍后再试'}`);
      }
    } catch (error) {
      console.error('删除账号错误:', error);
      alert('网络错误，请检查网络连接后重试');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  // ✅ 删除强制登录拦截，允许游客访问

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
            <p className="text-lg font-semibold">{user?.phone || '未登录'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">点币余额</p>
            <p className="text-2xl font-bold">{user?.points ?? 0}</p>
          </div>
        </div>

        {/* ✅ 游客提示 */}
        {!user && (
          <div className="mt-3 text-sm bg-yellow-400/20 rounded-lg p-2 text-center text-yellow-100">
            💡 购买后注册账号，可将点币同步到其他设备
          </div>
        )}

        {user?.is_pro && (user as any).pro_expire_at && (
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
                <p className="text-sm text-gray-500">获得 {plan.points} 点币</p>
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
            <li>支付方式：Apple 账户余额及绑定的支付方式</li>
          </ul>
        </div>
      </div>

      {/* ✅ 账号删除区域 - 仅登录用户可见 */}
      {user && (
        <div className="px-4 py-6 mt-4 border-t border-gray-200">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-2">⚠️ 账号管理</p>
            <p className="text-xs text-red-600 mb-3">
              删除账号将永久清除您的所有数据（点币、生成的应用、会员权益等），此操作不可撤销。
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? '处理中...' : '注销账号'}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">⚠️ 确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">
              您确定要永久删除账号 <strong>{user?.phone}</strong> 吗？
              此操作将清除您的所有数据，且无法恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userId={user?.id || null} // ✅ 允许 null
        onSuccess={() => {
          setShowPaymentModal(false);
          refreshUser();
          if (!user) {
            alert('✅ 购买成功！注册账号可将点币同步到其他设备');
          } else {
            alert('支付成功！');
          }
        }}
        plan={selectedPlan}
      />
    </div>
  );
}