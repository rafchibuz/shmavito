export type Category = string;

export type Listing = {
  id: string;
  title: string;
  originalTitle?: string;
  submitterComment?: string;
  price: string;
  location: string;
  category: Category;
  description: string;
  image: string;
  images?: string[];
  author: { id?: string; name: string; avatar: string };
  published: string;
  likes: number;
  comments: number;
  views: number;
  year?: number;
  mileage?: string;
  unavailable?: boolean;
  sourceUrl: string;
};

export type CatalogStats = {
  findings: number;
  pending: number;
  outboundClicks: number;
};

export type CatalogViewer = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  likedIds: string[];
  viewedIds: string[];
  bookmarkIds: string[];
};

export type CatalogPayload = {
  listings: Listing[];
  total: number;
  stats: CatalogStats;
  viewer: CatalogViewer | null;
};

export type CommentItem = {
  id: string;
  authorId?: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  parentId?: string;
};
