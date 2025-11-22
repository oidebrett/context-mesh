import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { baseUrl } from '../utils';

interface User {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch(`${baseUrl}/auth/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to check auth status:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = () => {
        window.location.href = `${baseUrl}/auth/google`;
    };

    const logout = () => {
        window.location.href = `${baseUrl}/auth/logout`;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
