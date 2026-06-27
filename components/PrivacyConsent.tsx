// components/PrivacyConsent.tsx
'use client'

import { useState } from 'react';
import Link from 'next/link';

interface PrivacyConsentProps {
  onAgree: () => void;
}

export default function PrivacyConsent({ onAgree }: PrivacyConsentProps) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-center mb-2">欢迎使用 速码方舟AI软件</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          请阅读并同意以下条款后继续
        </p>

        <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-gray-600 space-y-3 mb-4">
          <p>
            在您使用本应用前，请仔细阅读我们的
            <Link href="/privacy" target="_blank" className="text-blue-600 underline ml-1">
              隐私政策
            </Link>
            。
          </p>
          <p>
            我们将严格保护您的个人信息，您的数据仅用于提供AI生成服务。
            我们不会将您的数据用于模型训练。
          </p>
          <p className="text-xs text-gray-400">
            涉及第三方服务：DeepSeek（AI对话）、阿里云（AI生成）
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            我已阅读并同意
            <Link href="/privacy" target="_blank" className="text-blue-600 underline mx-1">
              《隐私政策》
            </Link>
            和
            <Link href="/terms" target="_blank" className="text-blue-600 underline mx-1">
              《用户协议》
            </Link>
          </span>
        </label>

        <button
          onClick={onAgree}
          disabled={!isChecked}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          同意并继续
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          继续使用即表示您已阅读并同意上述条款
        </p>
      </div>
    </div>
  );
}