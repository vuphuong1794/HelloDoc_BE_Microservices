
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Specialty } from '../core/schema/specialty.schema';
import { CacheService } from 'libs/cache.service';
import { CreateSpecialtyDto } from '../core/dto/create-specialty.dto';
import { UpdateSpecialtyDto } from '../core/dto/update-specialty.dto';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';


@Injectable()
export class SpecialtyService {
  constructor(
    @InjectModel(Specialty.name, 'specialtyConnection') private SpecialtyModel: Model<Specialty>,
    private cloudinaryService: CloudinaryService,
    private cacheService: CacheService,
  ) { }

  async getSpecialties() {
    const cacheKey = 'all_specialties';
    console.log('Trying to get specialties from cache...');

    const cached = await this.cacheService.getCache(cacheKey);
    if (cached) {
      console.log('Cache specialty HIT');
      return cached;
    }

    console.log('Cache MISS - querying DB');
    const data = await this.SpecialtyModel.find().populate({
      path: 'doctors',
      select: 'name',
    });

    console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, data, 30 * 1000);
    return data;
  }

  async create(createSpecialtyDto: CreateSpecialtyDto) {

    // Kiểm tra xem chuyên khoa đã tồn tại hay chưa
    const existingSpecialty = await this.SpecialtyModel.findOne({
      name: createSpecialtyDto.name,
    });
    if (existingSpecialty) {
      throw new BadRequestException('Chuyên khoa nây đã tồn tại');
    }
    let uploadedMediaUrl: string = '';

    if (createSpecialtyDto.image) {
      const uploadResult = await this.cloudinaryService.uploadFile(
        createSpecialtyDto.image,
        `Specialty/${createSpecialtyDto.name}/Icon`
      );
      uploadedMediaUrl = uploadResult.secure_url;
    }

    const specialty = await this.SpecialtyModel.create({
      name: createSpecialtyDto.name,
      description: createSpecialtyDto.description,
      icon: uploadedMediaUrl,
      doctors: createSpecialtyDto.doctors,
    });

    if (!specialty) {
      throw new BadRequestException('Tạo chuyên khoa không thành công');
    }

    return specialty;
  }

  async update(id: string, updateSpecialtyDto: UpdateSpecialtyDto) {
    const specialty = await this.SpecialtyModel.findById(id);
    if (!specialty) {
      throw new BadRequestException('Chuyên khoa không tồn tại');
    }

    let uploadedMediaUrl: string = '';

    if (updateSpecialtyDto.image) {
      const uploadResult = await this.cloudinaryService.uploadFile(
        updateSpecialtyDto.image,
        `Specialty/${updateSpecialtyDto.name}/Icon`
      );
      uploadedMediaUrl = uploadResult.secure_url;
    }

    const updatedSpecialty = await this.SpecialtyModel.findByIdAndUpdate(
      id,
      {
        name: updateSpecialtyDto.name,
        description: updateSpecialtyDto.description,
        icon: uploadedMediaUrl || specialty.icon,
        doctors: updateSpecialtyDto.doctors,
      },
      { new: true }
    );
    if (!updatedSpecialty) {
      throw new BadRequestException('Cập nhật chuyên khoa không thành công');
    }

    return updatedSpecialty;
  }

  async remove(id: string) {
    const specialty = await this.SpecialtyModel.findByIdAndDelete(id);
    if (!specialty) {
      throw new BadRequestException('Chuyên khoa không tồn tại');
    }

    return specialty;
  }

  async getSpecialtyById(id: string) {
    return this.SpecialtyModel.findById(id);
  }
}
