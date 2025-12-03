import { Body, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Neo4jService } from '../service/neo4j.service';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';

@Controller()
export class Neo4jController {
  constructor(private readonly neo4jService: Neo4jService) { }

  @MessagePattern('neo4j.create-node')
  async createNode(@Body() dto: CreateNodeDto) {
    return this.neo4jService.createNode(dto);
  }

  @MessagePattern('neo4j.create-relation')
  async createRelation(@Body() dto: CreateRelationDto) {
    return this.neo4jService.createRelation(dto);
  }

  @MessagePattern('neo4j.get-suggestions')
  async getSuggestions(@Body('word') word: string) {
    return this.neo4jService.getSuggestions(word);
  }

  @MessagePattern('neo4j.get-all')
  async getAll() {
    return this.neo4jService.getAll();
  }

  @MessagePattern('neo4j.delete-all')
  async deleteAll() {
    return this.neo4jService.deleteAll();
  }

  @MessagePattern('neo4j.delete-node')
  async deleteNode(@Payload() payload: { label: string; name: string }) {
    return this.neo4jService.deleteNode(payload.label, payload.name);
  }

  @MessagePattern('neo4j.delete-node-by-id')
  async deleteNodeById(id: string) {
    return this.neo4jService.deleteNodeById(id);
  }

  @MessagePattern('neo4j.delete-relation')
  async deleteRelation(@Payload() payload: { fromLabel: string; fromName: string; toLabel: string; toName: string; relationType: string }) {
    return this.neo4jService.deleteRelation(
      payload.fromLabel,
      payload.fromName,
      payload.toLabel,
      payload.toName,
      payload.relationType,
    );
  }
}
