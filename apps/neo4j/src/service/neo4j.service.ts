import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { CreateNodeDto } from '../core/dto/createNode.dto';
import { CreateRelationDto } from '../core/dto/createRelation.dto';

@Injectable()
export class Neo4jService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'neo4j://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password',
      ),
    );
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async createNode(dto: CreateNodeDto) {
    const session = this.getSession();
    try {
      const query = `
        MERGE (n:${dto.label} {name: $name})
        RETURN n
      `;
      const result = await session.run(query, { name: dto.name });
      return result.records[0]?.get('n').properties;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo node');
    } finally {
      await session.close();
    }
  }

  async createRelation(dto: CreateRelationDto) {
    const session = this.getSession();
    try {
      const query = `
        MERGE (a:${dto.fromLabel} {name: $fromName})
        MERGE (b:${dto.toLabel} {name: $toName})
        MERGE (a)-[r:${dto.relationType}]->(b)
        SET r.weight = coalesce(r.weight, 0) + coalesce($weight, 0)
        RETURN a, r, b
      `;
      const result = await session.run(query, {
        fromName: dto.fromName,
        toName: dto.toName,
        weight: dto.weight ?? 1, // mặc định weight = 1 nếu không truyền
      });

      const record = result.records[0];
      return {
        from: record.get('a').properties,
        relation: record.get('r').type,
        weight: record.get('r').properties.weight,
        to: record.get('b').properties,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi tạo quan hệ');
    } finally {
      await session.close();
    }
  }

  async getSuggestions(word: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a {name: $word})-[r:RELATES_TO]->(b)
        RETURN b.name AS suggestion, r.weight AS score
        ORDER BY r.weight DESC
        LIMIT 10;
      `;
      const result = await session.run(query, { word });
      return result.records.map(r => r.get('suggestion'));
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn gợi ý');
    } finally {
      await session.close();
    }
  }

  async getSuggestionsByLabel(word: string, fromLabel: string, toLabel: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a:${fromLabel} {name: $word})-[r:RELATES_TO]->(b:${toLabel})
        RETURN b.name AS suggestion, r.weight AS score
        ORDER BY r.weight DESC
        LIMIT 10
      `;
      const result = await session.run(query, { word });
      return result.records.map(r => ({
        suggestion: r.get('suggestion'),
        score: r.get('score'),
      }));
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi truy vấn gợi ý theo label');
    } finally {
      await session.close();
    }
  }

  async getAll() {
    const session = this.getSession();
    try {
      const query = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 500
      `;

      const result = await session.run(query);

      const nodesMap = new Map();
      const relationships: any[] = [];

      for (const record of result.records) {
        const n = record.get('n');
        const r = record.get('r');
        const m = record.get('m');

        // ===== NODE N =====
        if (n) {
          const nodeId = `${n.labels[0]}:${n.properties.name}`;
          nodesMap.set(nodeId, {
            id: nodeId,
            labels: n.labels,
            properties: n.properties
          });
        }

        // ===== NODE M =====
        if (m) {
          const nodeId = `${m.labels[0]}:${m.properties.name}`;
          nodesMap.set(nodeId, {
            id: nodeId,
            labels: m.labels,
            properties: m.properties
          });
        }

        // ===== RELATION =====
        if (r && n && m) {
          relationships.push({
            id: `${r.type}-${n.properties.name}->${m.properties.name}`,
            type: r.type,
            start: `${n.labels[0]}:${n.properties.name}`,
            end: `${m.labels[0]}:${m.properties.name}`,
            properties: r.properties || {}
          });
        }
      }

      return {
        nodes: Array.from(nodesMap.values()),
        relationships
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi lấy toàn bộ graph');
    } finally {
      await session.close();
    }
  }

  async deleteAll() {
    const session = this.getSession();
    try {
      const query = `MATCH (n) DETACH DELETE n`;
      await session.run(query);
      return { message: 'Đã xóa toàn bộ dữ liệu' };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Không thể xóa dữ liệu');
    } finally {
      await session.close();
    }
  }

  async deleteAllRelations() {
    const session = this.getSession();
    try {
      const query = `MATCH ()-[r]->() DELETE r`;
      await session.run(query);
      return { message: 'Đã xóa toàn bộ relation' };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Không thể xóa relation');
    } finally {
      await session.close();
    }
  }

  /** Xóa node theo label và name */
  async deleteNode(label: string, name: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (n:${label} {name: $name})
        DETACH DELETE n
        RETURN COUNT(n) AS deletedCount
      `;
      const result = await session.run(query, { name });
      return { deletedCount: result.records[0].get('deletedCount').toNumber() };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi xóa node');
    } finally {
      await session.close();
    }
  }

  /** Xóa relationship giữa 2 node */
  async deleteRelation(fromLabel: string, fromName: string, toLabel: string, toName: string, relationType: string) {
    const session = this.getSession();
    try {
      const query = `
        MATCH (a:${fromLabel} {name: $fromName})-[r:${relationType}]->(b:${toLabel} {name: $toName})
        DELETE r
        RETURN COUNT(r) AS deletedCount
      `;
      const result = await session.run(query, { fromName, toName });
      return { deletedCount: result.records[0].get('deletedCount').toNumber() };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Lỗi khi xóa quan hệ');
    } finally {
      await session.close();
    }
  }
}
