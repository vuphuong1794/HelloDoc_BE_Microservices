import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { Neo4jService } from '../services/neo4j-client.service';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';

@Controller('neo4j')
export class Neo4jController {
    constructor(private readonly neo4jService: Neo4jService) { }

    @Post('node')
    createNode(@Body() dto: CreateNodeDto) {
        return this.neo4jService.createNode(dto);
    }

    @Post('relation')
    createRelation(@Body() dto: CreateRelationDto) {
        return this.neo4jService.createRelation(dto);
    }

    @Get('suggestions/:word')
    getSuggestions(@Param('word') word: string) {
        return this.neo4jService.getSuggestions(word);
    }

    @Get('get-all')
    getAll() {
        return this.neo4jService.getAll();
    }

    @Delete('node')
    deleteNode(@Body('label') label: string, @Body('name') name: string) {
        return this.neo4jService.deleteNode(label, name);
    }

    @Delete('node/:id')
    deleteNodeById(@Param('id') id: string) {
        return this.neo4jService.deleteNodeById(id);
    }

    @Delete('relation')
    deleteRelation(
        @Body('fromLabel') fromLabel: string,
        @Body('fromName') fromName: string,
        @Body('toLabel') toLabel: string,
        @Body('toName') toName: string,
        @Body('relationType') relationType: string,
    ) {
        return this.neo4jService.deleteRelation(fromLabel, fromName, toLabel, toName, relationType);
    }

    @Delete('delete-all')
    deleteAll() {
        return this.neo4jService.deleteAll();
    }


}
