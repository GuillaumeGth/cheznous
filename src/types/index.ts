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
  // undefined/vide = tous les colocs ; [uid] = solo ; [uid1, uid2] = sous-groupe
  member_ids?: string[];
  // URL Firebase Storage d'une photo de couverture (optionnelle)
  cover_photo_url?: string | null;
};

export type GroupMember = {
  uid: string;
  displayName: string;
};

// Firestore collection: `groups`
export type Group = {
  id: string;
  name?: string;          // titre du groupe (éditable)
  user1_id: string;       // legacy
  user2_id: string | null; // legacy
  member_ids: string[];   // liste authoritative de tous les colocs
  invite_code: string;    // code 6 chars (ex: "AB12CD")
  filters: SearchFilters; // legacy — conservé pour migration
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

// Firestore collection: `follows`, doc id `{follower_id}_{following_id}`
export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Match = {
  id: string;
  couple_id: string;   // Firestore field name (= groupId)
  search_list_id?: string; // critère de recherche dans lequel le match a eu lieu
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
  couple_id: string;   // Firestore field name (= groupId)
  text: string;
  created_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  display_name_lower?: string; // minuscules, pour la recherche insensible à la casse
  couple_id: string | null;  // Firestore field name (= groupId)
  push_token: string | null;
  photo_url: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
};
