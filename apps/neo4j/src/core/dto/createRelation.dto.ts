export class CreateRelationDto {
  fromLabel: string;
  fromName: string;
  toLabel: string;
  toName: string;
  relationType: string;
  weight?: number; // optional
}
