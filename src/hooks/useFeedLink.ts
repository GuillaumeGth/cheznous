import { FeedLink } from '@/types';
import { useDocSnapshot } from './useDocSnapshot';

/**
 * Which provider alert feeds this search list (written by Cloud Functions).
 * `undefined` while loading, `null` when the list isn't linked.
 */
export function useFeedLink(groupId: string | null, listId: string | null): FeedLink | null | undefined {
  return useDocSnapshot<FeedLink>(groupId && listId ? ['groups', groupId, 'feeds', listId] : null);
}
