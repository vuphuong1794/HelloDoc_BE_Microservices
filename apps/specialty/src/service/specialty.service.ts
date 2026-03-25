
import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Specialty } from '../core/schema/specialty.schema';
import { CacheService } from 'libs/cache.service';
import { DiscordLoggerService } from 'libs/discord-logger.service';
import { CreateSpecialtyDto } from '../core/dto/create-specialty.dto';
import { UpdateSpecialtyDto } from '../core/dto/update-specialty.dto';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MediaUrlHelper } from 'libs/media-url.helper';


@Injectable()
export class SpecialtyService {
  constructor(
    @InjectModel(Specialty.name, 'specialtyConnection') private SpecialtyModel: Model<Specialty>,
    @Inject('DOCTOR_CLIENT') private doctorClient: ClientProxy,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    private cacheService: CacheService,
    private discordLoggerService: DiscordLoggerService,
    private readonly mediaUrlHelper: MediaUrlHelper,
  ) {}

  async getSpecialties() {
    try {
      const data = await this.SpecialtyModel.find().lean();

      // Lấy thông tin bác sĩ cho mỗi specialty
      const specialtiesWithDoctors = await Promise.all(
        data.map(async (specialty) => {
          const doctorDetails = await Promise.all(
            specialty.doctors.map(async (doctorId) => {
              try {
                const doctorObjId = new Types.ObjectId(doctorId);
                const doctor = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', doctorObjId));
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
          const specialtyWithMedia = this.mediaUrlHelper.constructObjectUrls(specialty, ['icon']) as any;
          return {
            ...specialtyWithMedia,
            doctors: doctorDetails.filter(doc => doc !== null) // Lọc bỏ các doctor null (trường hợp lỗi)
          };
        })
      );

      return specialtiesWithDoctors;
    } catch (error) {
      await this.discordLoggerService.sendError(error, 'SpecialtyService - getSpecialties');
      throw error;
    }
  }

  async getAllWithFilter(limit: number, skip: number, searchText?: string) {
    try {
      let filter: any = {};
      if (searchText && searchText.trim() !== '') {
        filter.$or = [
          { name: { $regex: searchText, $options: 'i' } },
          { description: { $regex: searchText, $options: 'i' } },
        ];
      }
  
      const total = await this.SpecialtyModel.countDocuments(filter);
  
      const data = await this.SpecialtyModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      // Lấy thông tin bác sĩ (tái sử dụng logic từ getSpecialties)
      const specialtiesWithDoctors = await Promise.all(
        data.map(async (specialty) => {
          const specialtyObj = specialty.toObject();
          return this.mediaUrlHelper.constructObjectUrls(specialtyObj, ['icon']) as any;
        })
      );
  
      return { data: specialtiesWithDoctors, total };
    } catch (error) {
      this.discordLoggerService.sendError(error, 'SpecialtyService - getAllWithFilter');
      throw error;
    }
  }

  async create(createSpecialtyDto: CreateSpecialtyDto) {
    try {
      // Kiểm tra xem chuyên khoa đã tồn tại hay chưa
      const existingSpecialty = await this.SpecialtyModel.findOne({
        name: createSpecialtyDto.name,
      });
      if (existingSpecialty) {
        throw new BadRequestException(`Specialty ${createSpecialtyDto.name} existed`);
      }

      let uploadedMediaUrl: string = '';

      // Upload image nếu có
      if (createSpecialtyDto.image) {
        try {
          console.log(`Uploading image: ${createSpecialtyDto.image.originalname}`);

          const tempId = new Types.ObjectId().toHexString();
          // Gửi qua Media Client (RPC)
          const uploadResult = await this.mediaClient
            .send('media.upload', {
              buffer: createSpecialtyDto.image.buffer, // Base64 string
              filename: createSpecialtyDto.image.originalname,
              mimetype: createSpecialtyDto.image.mimetype,
              folder: `specialty/${tempId}/icon`,
            })
            .toPromise();

          console.log('Icon đã được tải lên. Relative path:', uploadResult.relative_path);
          uploadedMediaUrl = uploadResult.relative_path;
        } catch (error) {
          console.error(
            `Error uploading image ${createSpecialtyDto.image.originalname}:`,
            error.message,
          );
          throw new Error(
            `Failed to upload image ${createSpecialtyDto.image.originalname}: ${error.message}`,
          );
        }
      }

      // Tạo specialty document
      const specialty = await this.SpecialtyModel.create({
        name: createSpecialtyDto.name,
        description: createSpecialtyDto.description,
        icon: uploadedMediaUrl,
        doctors: createSpecialtyDto.doctors || [],
      });

      if (!specialty) {
        throw new BadRequestException(`Specialty ${createSpecialtyDto.name} create failed`);
      }

      //console.log('Specialty created with ID:', specialty._id);
      await this.discordLoggerService.sendSuccess(`Specialty Created: ${specialty.name}`, 'SpecialtyService - create');
      return specialty;
    } catch (error) {
      //console.error('Error in SpecialtyService.create:', error);
      await this.discordLoggerService.sendError(error, 'SpecialtyService - create');
      throw new InternalServerErrorException(error.message);
    }
  }

  async update(id: string, updateSpecialtyDto: UpdateSpecialtyDto) {
    try {
      const specialty = await this.SpecialtyModel.findById(id);
      if (!specialty) {
        throw new BadRequestException(`Specialty with id ${id} does not exist`);
      }
  
      let uploadedMediaUrl: string = '';
  
      if (updateSpecialtyDto.image) {
        const uploadResult = await this.mediaClient
          .send('media.upload', {
            buffer: updateSpecialtyDto.image.buffer, // Base64 string
            filename: updateSpecialtyDto.image.originalname,
            mimetype: updateSpecialtyDto.image.mimetype,
            folder: `specialty/${id}/icon`,
          })
          .toPromise();
        uploadedMediaUrl = uploadResult.relative_path;
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
        throw new BadRequestException(`Specialty with id ${id} update failed`);
      }
  
      await this.discordLoggerService.sendSuccess(`Specialty Updated: ${updatedSpecialty.name}`, 'SpecialtyService - update');
      return updatedSpecialty;
    } catch (error) {
      await this.discordLoggerService.sendError(error, 'SpecialtyService - update');
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const specialty = await this.SpecialtyModel.findByIdAndDelete(id);
      if (!specialty) {
        throw new BadRequestException(`Specialty with id ${id} does not exist`);
      }
  
      await this.discordLoggerService.sendSuccess(`Specialty Removed: ${specialty.name}`, 'SpecialtyService - remove');
      return specialty;
    } catch (error) {
      await this.discordLoggerService.sendError(error, 'SpecialtyService - remove');
      throw error;
    }
  }

  async getSpecialtyById(id: string) {
    try {
      // 1. Lấy thông tin specialty
      const specialty = await this.SpecialtyModel.findById(id).lean();
      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa');
      }

      // 2. Lặp qua mảng ID bác sĩ để fetch thông tin chi tiết
      const doctorsList = await Promise.all(
        specialty.doctors.map(async (doctorId) => {
          try {
            const doctor = await firstValueFrom(this.doctorClient.send('doctor.get-by-id', doctorId));
            
            // Trả về object chứa các field mà class Doctor (Android) đang cần
            return {
              _id: doctor._id,
              name: doctor.name,
              avatarURL: doctor.avatarURL,
              address: doctor.address,
              isClinicPaused: doctor.isClinicPaused,
              // Lưu ý: Android đang cần field 'specialty: Specialty' bên trong Doctor. 
              // Bạn có thể truyền lại thông tin cơ bản của specialty vào đây nếu cần thiết để tránh lỗi null.
            };
          } catch (error) {
            console.error(`Error fetching doctor ${doctorId}:`, error);
            return null; // Bỏ qua nếu lỗi
          }
        })
      );

      // 3. Trả về đúng cấu trúc mà GetSpecialtyResponse (Android) mong đợi
      return {
        _id: specialty._id,
        name: specialty.name,
        icon: specialty.icon,
        description: specialty.description,
        doctors: doctorsList.filter(doc => doc !== null) // Lọc bỏ các phần tử null, trả về mảng object
      };

    } catch (error) {
      console.error('Lỗi ở getSpecialtyById:', error);
      throw error;
    }
  }

  async getSpecialtyByName(name: string) {
    if (typeof name !== 'string') {
      throw new Error(`name must be string, got ${typeof name}`);
    }

    try {
      const specialty = await this.SpecialtyModel.findOne({ name }).lean();

      if (!specialty) {
        return null;
      }

      // Gọi 1 lần duy nhất thay vì loop
      try {
        const validDoctors = await firstValueFrom(
          this.doctorClient.send('doctor.get-by-ids-with-home-service', specialty.doctors)
        );

        return this.mediaUrlHelper.constructObjectUrls(specialty, ['icon']);
      } catch (error) {
        console.error('Error fetching doctors with home service:', error);
        return {
          ...specialty,
          doctors: [],
        };
      }
    } catch (error) {
      await this.discordLoggerService.sendError(error, 'SpecialtyService - getSpecialtyByName');
      throw error;
    }
  }

  async findByIds(ids: string[]) {
    try {
      const specialties = await this.SpecialtyModel.find({
        _id: { $in: ids }
      }).lean().select('_id name icon description doctors');
      
      return specialties.map(s => {
        return this.mediaUrlHelper.constructObjectUrls(s, ['icon']);
      });
    } catch (error) {
      await this.discordLoggerService.sendError(error, 'SpecialtyService - findByIds');
      throw error;
    }
  }

  analyzeSpecialty(text: string, specialtyNames?: string[]): number {
    const specialties = [
      {
        index: 0,
        name: 'Cơ xương khớp',
        keywords: ['xương','khớp','cột sống','đốt sống','đau lưng','mỏi khớp','thoái hóa','gãy xương','nứt xương','vỡ xương','gãy kín','gãy hở','gãy tay','gãy chân','gãy đùi','gãy cẳng tay','gãy cẳng chân','gãy cổ tay','gãy cổ chân','gãy xương sườn','gãy xương đòn','gãy xương chậu','gãy cột sống','lún đốt sống']
      },
      {
        index: 1,
        name: 'Thần kinh',
        keywords: ['thần kinh','dây thần kinh','não','tủy sống','sọ não','đau đầu','đau nửa đầu','chóng mặt','hoa mắt','choáng váng','mất thăng bằng','tê','tê bì','tê tay','tê chân','yếu tay','yếu chân','liệt','co giật','động kinh','run tay','run chân','rối loạn cảm giác','rối loạn vận động','đau dây thần kinh','đau thần kinh tọa','thoát vị đĩa đệm chèn ép thần kinh']
      },
      {
        index: 2,
        name: 'Tiêu hóa',
        keywords: ['tiêu hóa', 'dạ dày', 'đại tràng', 'bụng', 'đau bụng', 'tiêu chảy', 'táo bón', 'nôn', 'buồn nôn']
      },
      {
        index: 3,
        name: 'Tim mạch',
        keywords: ['tim', 'mạch', 'huyết áp', 'đau ngực', 'nhịp tim', 'đánh trống ngực', 'khó thở']
      },
      {
        index: 4,
        name: 'Tai mũi họng',
        keywords: ['tai', 'mũi', 'họng', 'viêm họng', 'viêm xoang', 'amidan', 'đau họng', 'ho', 'ngạt mũi']
      },
    ];

    console.log(specialtyNames);

    const lowerText = text.toLowerCase().trim();
    let detectedSpecialtyName = '';

    for (const specialty of specialties) {
      for (const keyword of specialty.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          detectedSpecialtyName = specialty.name;
          break;
        }
      }
      if (detectedSpecialtyName) break;
    }

    if (!detectedSpecialtyName) return -1;

    // Nếu có truyền vào mảng specialty names, tìm index trong mảng đó
    if (specialtyNames && specialtyNames.length > 0) {
      const normalizedNames = specialtyNames.map(name => name.toLowerCase().trim());
      const lowerDetectedName = detectedSpecialtyName.toLowerCase().trim();
      return normalizedNames.indexOf(lowerDetectedName);
    }

    // Nếu không có mảng truyền vào, trả về index mặc định trong list cứng
    const matched = specialties.find(s => s.name === detectedSpecialtyName);
    return matched ? matched.index : -1;
  }
}
