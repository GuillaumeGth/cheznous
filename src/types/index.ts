export type Listing = {
  id: string;
  title: string;
  price: number;
  charges: number;
  surface: number;
  rooms: number;
  floor: number | null;
  address: string;
  arrondissement: number;
  images: string[];
  description: string;
  url: string;
  source: string;
  has_elevator: boolean;
  has_parking: boolean;
  has_balcony: boolean;
  has_terrace: boolean;
  available_from: string;
  deposit: number;
  lat: number | null;
  lng: number | null;
};

export type SwipeDirection = 'left' | 'right';

export type SearchFilters = {
  arrondissements: number[];
  price_max: number;
  surface_min: number;
  rooms_min: number;
};

export const DEFAULT_FILTERS: SearchFilters = {
  arrondissements: [],
  price_max: 2500,
  surface_min: 25,
  rooms_min: 0,
};

export type SearchList = {
  id: string;
  name: string;
  filters: SearchFilters;
  member_ids?: string[]; // undefined / empty = tous les membres du couple
};

export type CoupleMember = {
  uid: string;
  displayName: string;
};

export type Couple = {
  id: string;
  user1_id: string;
  user2_id: string | null;
  member_ids: string[]; // canonical list; derived from user1/user2 on old docs
  invite_code: string;
  filters: SearchFilters; // legacy — kept for migration
  search_lists: SearchList[];
  active_search_list_id: string;
  created_at: string;
};

export type GroupInvitation = {
  id: string;
  group_id: string;
  inviter_id: string;
  inviter_name: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

export type UserSearchResult = {
  uid: string;
  display_name: string;
  email: string;
  photo_url: string | null;
};

export type Match = {
  id: string;
  couple_id: string;
  listing_id: string;
  listing: Listing;
  matched_at: string;
  status: 'new' | 'contacted' | 'visited' | 'rejected';
};

export type NotificationPrefs = {
  notify_on_partner_swipe: boolean;
  notify_on_new_listings: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notify_on_partner_swipe: false,
  notify_on_new_listings: false,
};

export type Note = {
  user_id: string;
  listing_id: string;
  couple_id: string;
  text: string;
  created_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  couple_id: string | null;
  push_token: string | null;
  photo_url: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
};
