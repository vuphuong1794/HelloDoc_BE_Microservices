export class GetReportDto {
  _id: string;
  reporter: any;
  reporterModel: string;
  content: string;
  type: string;
  reportedId: string;
  postId?: string;
  status: string;
  responseContent?: string;
  responseTime?: string;
  createdAt: Date;
  updatedAt: Date;
}
