import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateSpecialtyDto } from "../core/dto/create-specialty.dto";
import { UpdateSpecialtyDto } from "../core/dto/update-specialty.dto";

@Injectable()
export class SpecialtyService {
    constructor(
        @Inject('SPECIALTY_CLIENT') private specialtyClient: ClientProxy
    ) { }

    async getSpecialties() {
        return this.specialtyClient.send('specialty.get-all', {})
    }

    async create(createSpecialtyDto: CreateSpecialtyDto) {
        return this.specialtyClient.send('specialty.create', createSpecialtyDto)
    }

    async update(id: string, updateSpecialty: UpdateSpecialtyDto) {
        return this.specialtyClient.send('specialty.update', { id, updateSpecialty })
    }

    async remove(id: string) {
        return this.specialtyClient.send('specialty.remove', id)
    }

    async getSpecialtyById(id: string) {
        return this.specialtyClient.send('specialty.get-by-id', id)
    }
}