import { dwigo } from '@/lib/dwigo';

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export const fetchUserProfile = () => dwigo.get<UserProfile>('/users/profile');

export const updateUserProfile = (payload: UpdateProfilePayload) =>
  dwigo.put<UpdateProfilePayload, UserProfile>('/users/profile', payload);


