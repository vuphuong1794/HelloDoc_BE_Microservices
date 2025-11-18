
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
    const data = await this.SpecialtyModel.find();

    // Lấy thông tin bác sĩ cho mỗi specialty
    const specialtiesWithDoctors = await Promise.all(
      data.map(async (specialty) => {
        // Lấy thông tin chi tiết của từng bác sĩ
        const doctorDetails = await Promise.all(
          specialty.doctors.map(async (doctorId) => {
            try {
              const doctor = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', doctorId));
              return {
                _id: doctor._id,
                name: doctor.name,
                avatarURL: doctor.avatarURL
              }
            } catch (error) {
              console.error(`Error fetching doctor ${doctorId}:`, error);
              return null;
            }
          })
        );

        // Lọc bỏ các doctor null (trường hợp lỗi)
        const validDoctors = doctorDetails.filter(doc => doc !== null);

        return {
          ...specialty.toObject(), // hoặc specialty._doc nếu dùng Mongoose
          doctors: validDoctors
        };
      })
    );

    console.log('Setting cache...');
    await this.cacheService.setCache(cacheKey, specialtiesWithDoctors, 30 * 1000);
    return specialtiesWithDoctors;
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
    const specialty = await this.SpecialtyModel.findById(id);

    const doctorDetails = await Promise.all(
      specialty.doctors.map(async (doctorId) => {
        try {
          const doctor = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', doctorId));
          return {
            _id: doctor._id,
            name: doctor.name,
            specialty: doctor.specialty,
            address: doctor.address,
            avatarURL: doctor.avatarURL,
            isClinicPaused: doctor.isClinicPaused
          }
        } catch (error) {
          console.error(`Error fetching doctor ${doctorId}:`, error);
          return null;
        }
      })
    );

    // Lọc bỏ các doctor null (trường hợp lỗi)
    const validDoctors = doctorDetails.filter(doc => doc !== null);

    return {
      ...specialty.toObject(), // hoặc specialty._doc nếu dùng Mongoose
      doctors: validDoctors
    };
  }

  async findByIds(ids: string[]) {
    return this.SpecialtyModel.find({
      _id: { $in: ids }
    }).select('_id name icon description doctors');
  }
}
