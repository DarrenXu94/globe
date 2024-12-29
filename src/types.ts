export interface VisitedCountry {
  country: string;
  gallery: Gallery[];
}

interface Gallery {
  city: string;
  photo: string;
}

export interface Visited {
  visited: VisitedCountry[];
}
