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

export type CommentItem = {
  id: string;
  authorId?: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  parentId?: string;
};
