export type Category = "Все" | "Автомобили" | "Другая техника" | "Недвижимость" | "Запчасти" | "Разное";

export type Listing = {
  id: string;
  title: string;
  price: string;
  location: string;
  category: Exclude<Category, "Все">;
  description: string;
  image: string;
  author: { name: string; avatar: string };
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
  author: string;
  avatar: string;
  text: string;
  time: string;
  parentId?: string;
};
