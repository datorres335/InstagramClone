import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlineOutlined';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { EmptyState } from '../../components/ui/empty-state';
import { FollowListItem } from './follow-list-item';

interface UserListProps {
  title: string;
  items: FollowListItemType[];
  emptyMessage: string;
  /** The signed-in viewer, whose own row gets no follow button. */
  viewerUsername: string | null;
}

/** The likers, followers and following pages: a heading over a list of `FollowListItem` rows. */
export function UserList({
  title,
  items,
  emptyMessage,
  viewerUsername,
}: UserListProps) {
  return (
    <main className="mx-auto flex w-full max-w-feed flex-col gap-2">
      <h1 className="text-title font-semibold">{title}</h1>
      {items.length === 0 ? (
        <EmptyState icon={<PeopleOutlineIcon />} message={emptyMessage} />
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <FollowListItem
              key={item.id}
              item={item}
              isViewer={item.username === viewerUsername}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
