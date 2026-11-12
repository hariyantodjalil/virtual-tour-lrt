export type TrainFleetCar = { id: string; slug: string; label: string; order: number; isActive: boolean };
export type TrainFleetSet = { id: string; code: string; order: number; isActive: boolean };
export type TrainFleet = { trainId: string; advertisingCapacity: number | null; cars: TrainFleetCar[]; trainsets: TrainFleetSet[] };
