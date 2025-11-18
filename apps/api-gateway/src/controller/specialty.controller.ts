import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateSpecialtyDto } from '../core/dto/update-specialty.dto';
import { CreateSpecialtyDto } from '../core/dto/create-specialty.dto';
import { SpecialtyService } from '../services/specialty.service';

@Controller('specialty')
export class SpecialtyController {
    constructor(private readonly specialtyService: SpecialtyService) { }

    @Get('get-all')
    getSpecialties() {
        return this.specialtyService.getSpecialties();
    }

    @Post('create')
    @UseInterceptors(FileInterceptor('icon')) // 'icon' là tên field form-data
    async createSpecialty(
        @UploadedFile() file: Express.Multer.File,
        @Body() createSpecialtyDto: CreateSpecialtyDto,
    ) {
        if (file) {
            createSpecialtyDto.image = file;
        }

        return this.specialtyService.create(createSpecialtyDto);
    }

    @Put(':id')
    @UseInterceptors(FileInterceptor('icon'))
    async updateSpecialty(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() updateSpecialtyDto: UpdateSpecialtyDto,
    ) {
        if (file) {
            updateSpecialtyDto.image = file;
        }

        return this.specialtyService.update(id, updateSpecialtyDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.specialtyService.remove(id);
    }

    @Get('doctors/:id')
    getSpecialtyById(@Param('id') id: string) {
        return this.specialtyService.getSpecialtyById(id);
    }

}
