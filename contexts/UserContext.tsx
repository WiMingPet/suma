// contexts/UserContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  phone: string;
  is_pro: boolean;
  daily_count: number;
  free_used: number;
  points: number;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 从 localStorage 恢复 + API 更新
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('suma_user');
    
    // 1. 先立即显示缓存
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }

    // 2. 如果有 token，从服务器获取最新数据
    if (token) {
      try {
        const res = await fetch('https://sumaai.cn/api/user-info', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            const latestUser = {
              id: data.user.id,
              phone: data.user.phone,
              is_pro: data.user.is_pro,
              daily_count: data.user.daily_count,
              free_used: data.user.free_used ?? 0,
              points: data.user.points ?? 0,
            };
            setUser(latestUser);
            localStorage.setItem('suma_user', JSON.stringify(latestUser));
          } else {
            // token 无效，清除
            localStorage.removeItem('token');
            localStorage.removeItem('suma_user');
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('刷新用户信息失败', err);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('suma_user');
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, setUser, refreshUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}