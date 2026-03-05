from pydantic import BaseModel


class BreedRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class SpeciesRead(BaseModel):
    id: int
    name: str
    breeds: list[BreedRead] = []

    model_config = {"from_attributes": True}


class ContactTypeRead(BaseModel):
    id: int
    type_key: str
    display_name: str

    model_config = {"from_attributes": True}
