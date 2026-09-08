export type TrainRentalSpacePublic = {
  id: string;
  displayNumber: string;
  title: string;
  description: string | null;
  image: string;
  objectPosition: string;
};

export type TrainRentalSpaceCms = TrainRentalSpacePublic & {
  order: number;
  isActive: boolean;
  imageUrl: string | null;
};

export const DEFAULT_TRAIN_RENTAL_SPACES = [
  {
    displayNumber: "01",
    title: "Handgrip",
    image: "/brand/landing/train-spaces/handgrip.jpg",
    objectPosition: "50% 40%",
    description: null,
    order: 0,
  },
  {
    displayNumber: "02",
    title: "Wall Panel",
    image: "/brand/landing/intro-train.jpg",
    objectPosition: "30% 50%",
    description: null,
    order: 1,
  },
  {
    displayNumber: "03",
    title: "Train Floor",
    image: "/brand/landing/intro-train.jpg",
    objectPosition: "50% 85%",
    description: null,
    order: 2,
  },
  {
    displayNumber: "04",
    title: "Ceiling Panel",
    image: "/brand/landing/tour-360.jpg",
    objectPosition: "50% 8%",
    description: null,
    order: 3,
  },
  {
    displayNumber: "05",
    title: "Train Door",
    image: "/brand/landing/train-spaces/train-door-v2.jpg",
    objectPosition: "50% 45%",
    description: null,
    order: 4,
  },
  {
    displayNumber: "06",
    title: "In-Train Digital Screen",
    image: "/brand/landing/train-spaces/in-train-digital-screen.jpg",
    objectPosition: "50% 35%",
    description: null,
    order: 5,
  },
  {
    displayNumber: "07",
    title: "Standing Panel",
    image: "/brand/landing/train-spaces/standing-panel.jpg",
    objectPosition: "50% 45%",
    description: null,
    order: 6,
  },
  {
    displayNumber: "08",
    title: "Body Branding",
    image: "/brand/landing/train-spaces/body-branding.jpg",
    objectPosition: "50% 50%",
    description: null,
    order: 7,
  },
] as const;
