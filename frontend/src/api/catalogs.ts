import api from "@/api";

export interface BreedRead {
  id: number;
  name: string;
}

export interface SpeciesRead {
  id: number;
  name: string;
  breeds: BreedRead[];
}

export interface ContactTypeRead {
  id: number;
  type_key: string;
  display_name: string;
}

export const catalogsApi = {
  species: (): Promise<SpeciesRead[]> =>
    api.get("/catalogs/species").then((r) => r.data),

  contactTypes: (): Promise<ContactTypeRead[]> =>
    api.get("/catalogs/contact-types").then((r) => r.data),
};
