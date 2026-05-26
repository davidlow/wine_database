'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Profile } from '@/types';

interface ProfileContextType {
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfile: () => {},
  loading: true,
  refresh: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/profiles');
      if (!res.ok) return;
      const data: Profile[] = await res.json();
      setProfiles(data);

      const savedId = typeof window !== 'undefined'
        ? localStorage.getItem('activeProfileId')
        : null;
      const saved = data.find((p) => p.id === savedId);
      setActiveProfileState(saved ?? data[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const setActiveProfile = useCallback((profile: Profile) => {
    setActiveProfileState(profile);
    localStorage.setItem('activeProfileId', profile.id);
  }, []);

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfile, loading, refresh: loadProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
