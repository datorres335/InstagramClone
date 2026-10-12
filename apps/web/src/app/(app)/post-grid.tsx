import Link from 'next/link';

export interface PostGridTile {
  id: string;
  thumbnailUrl: string | null;
}

/**
 * The 3-column square thumbnail grid shared by the profile page and Explore
 * (mobile's `components/post-grid.tsx` is its twin). A tile without a
 * thumbnail keeps its square on the surface color.
 */
export function PostGrid({ posts }: { posts: PostGridTile[] }) {
  return (
    <ul className="grid grid-cols-3 gap-1">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={`/p/${post.id}`}
            aria-label="View post"
            className="block aspect-square bg-surface-variant hover:opacity-90"
          >
            {post.thumbnailUrl && (
              <img
                src={post.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
