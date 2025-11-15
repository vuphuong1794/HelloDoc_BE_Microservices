import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateNodeDto } from "apps/neo4j/src/core/dto/createNode.dto";
import { CreateRelationDto } from "apps/neo4j/src/core/dto/createRelation.dto";

@Injectable()
export class Neo4jService {
    constructor(@Inject('NEO4J_CLIENT') private neo4jClient: ClientProxy) {}

    async createNode(dto: CreateNodeDto) {
        return this.neo4jClient.send('neo4j.create-node', dto);
    }

    async createRelation(dto: CreateRelationDto) {
        return this.neo4jClient.send('neo4j.create-relation', dto);
    }

    async getSuggestions(word: string) {
        return this.neo4jClient.send('neo4j.get-suggestions', { word });
    }

    async getAll() {
        return this.neo4jClient.send('neo4j.get-all', {});
    }

    async deleteAll() {
        return this.neo4jClient.send('neo4j.neo4j.delete-all', {});
    }
}
