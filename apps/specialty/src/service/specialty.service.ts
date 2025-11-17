
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Specialty } from '../core/schema/specialty.schema';
import { CacheService } from 'libs/cache.service';
import { CreateSpecialtyDto } from '../core/dto/create-specialty.dto';
import { UpdateSpecialtyDto } from '../core/dto/update-specialty.dto';
import { CloudinaryService } from 'libs/cloudinary/src/service/cloudinary.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';


@Injectable()
export class SpecialtyService {
  constructor(
    @InjectModel(Specialty.name, 'specialtyConnection') private SpecialtyModel: Model<Specialty>,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
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
    const specialties = await this.SpecialtyModel.find().lean();

    // Lấy tất cả doctorIds từ các specialties
    const allDoctorIds = specialties.reduce((acc, specialty) => {
      return [...acc, ...specialty.doctors];
    }, []);

    // Loại bỏ duplicate doctorIds
    const uniqueDoctorIds = [...new Set(allDoctorIds)];
    // Gọi sang Doctor microservice để lấy thông tin doctors
    let doctorsMap = {};
    if (uniqueDoctorIds.length > 0) {
      try {
        // Gọi API hoặc message queue sang Doctor service
        const doctors = await firstValueFrom(this.doctorClient.send('doctor.get-by-specialtyID', uniqueDoctorIds));

        // Tạo mảng doctorsMap
        doctorsMap = doctors.reduce((acc, doctor) => {
          acc[doctor._id] = doctor;
          return acc;
        }, {});
      } catch (error) {
        console.error('Error fetching doctors:', error);
      }
    }


    // Map doctors vào từng specialty
    const data = specialties.map(specialty => ({
      ...specialty,
      doctors: specialty.doctors
        .map(doctorId => doctorsMap[doctorId])
        .filter(doctor => doctor !== undefined) // Loại bỏ doctor không tìm thấy
    }));

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

  async findByIds(ids: string[]) {
    return this.SpecialtyModel.find({
      _id: { $in: ids }
    }).select('_id name icon description doctors');
  }
}
