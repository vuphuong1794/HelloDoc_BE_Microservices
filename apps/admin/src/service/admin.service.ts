// import {
//   BadRequestException,
//   Inject,
//   Injectable,
//   UnauthorizedException,
//   InternalServerErrorException,
//   NotFoundException,
// } from '@nestjs/common';
// import { Model } from 'mongoose';
// import { InjectModel } from '@nestjs/mongoose';
// import * as bcrypt from 'bcrypt';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';
// import { google } from 'googleapis';
// import e from 'express';
// import { OAuth2Client } from 'google-auth-library';
// import { CacheService } from 'libs/cache.service';
// import { SignupDto } from '../core/dto/signup.dto';

// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// @Injectable()
// export class AuthService {
//   constructor(
//     private configService: ConfigService,
//     private jwtService: JwtService,
//     private cacheService: CacheService,
//   ) { }

//   async signUp(signUpData: SignupDto) {
//     try {
//       const { email, password, name, phone } = signUpData;

//       let user =
//         (await this.UserModel.findOne({ email, isDeleted: false })) ||
//         (await this.AdminModel.findOne({ email })) ||
//         (await this.DoctorModel.findOne({ email, isDeleted: false }));

//       if (user) {
//         throw new UnauthorizedException('Email đã được sử dụng');
//       }

//       let validPhone =
//         (await this.UserModel.findOne({ phone, isDeleted: false })) ||
//         (await this.AdminModel.findOne({ phone })) ||
//         (await this.DoctorModel.findOne({ phone, isDeleted: false }));

//       if (validPhone) {
//         throw new UnauthorizedException('Số điện thoại đã được sử dụng');
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);

//       await this.UserModel.create({
//         email,
//         password: hashedPassword,
//         name,
//         phone,
//         avatarURL: 'https://imgs.search.brave.com/mDztPWayQWWrIPAy2Hm_FNfDjDVgayj73RTnUIZ15L0/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly90NC5m/dGNkbi5uZXQvanBn/LzAyLzE1Lzg0LzQz/LzM2MF9GXzIxNTg0/NDMyNV90dFg5WWlJ/SXllYVI3TmU2RWFM/TGpNQW15NEd2UEM2/OS5qcGc',
//         address: 'Chưa có địa chỉ',
//       });

//       return {
//         message: 'Tạo tài khoản thành công',
//       };
//     } catch (error) {
//       throw new InternalServerErrorException('Đã xảy ra lỗi khi đăng ký tài khoản');
//     }
//   }

//   async signUpAdmin(signUpData: SignupDto) {
//     try {
//       const { email, password, name, phone } = signUpData;

//       let user = await this.AdminModel.findOne({ email });
//       if (user) {
//         throw new UnauthorizedException('Email đã được sử dụng');
//       }

//       let validPhone = await this.AdminModel.findOne({ phone });
//       if (validPhone) {
//         throw new UnauthorizedException('Số điện thoại đã được sử dụng');
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);
//       await this.AdminModel.create({
//         email,
//         password: hashedPassword,
//         name,
//         phone,
//         avatarURL: 'https://imgs.search.brave.com/mDztPWayQWWrIPAy2Hm_FNfDjDVgayj73RTnUIZ15L0/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly90NC5m/dGNkbi5uZXQvanBn/LzAyLzE1Lzg0LzQz/LzM2MF9GXzIxNTg0/NDMyNV90dFg5WWlJ/SXllYVI3TmU2RWFM/TGpNQW15NEd2UEM2/OS5qcGc',
//         address: 'Chưa có địa chỉ',
//       });

//       return {
//         message: 'Tạo tài khoản thành công',
//       };
//     } catch (error) {
//       throw new InternalServerErrorException('Đã xảy ra lỗi khi đăng ký tài khoản');
//     }
//   } // Thay bằng Google Client ID

//   async loginGoogle(LoginData: LoginGoogleDto) {
//     try {
//       const ticket = await client.verifyIdToken({
//         idToken: LoginData.idToken,
//         audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
//       });

//       const payload = ticket.getPayload();

//       if (!payload) {
//         throw new UnauthorizedException('Không thể xác thực thông tin Google');
//       }

//       const email = payload.email;
//       const name = payload.name || 'Người dùng Google';
//       const avatarURL = payload.picture || 'default_avatar_url';
//       const phone = LoginData.phone?.trim() || '';

//       // Tìm người dùng theo email
//       let user =
//         (await this.UserModel.findOne({ email, isDeleted: false })) ||
//         (await this.AdminModel.findOne({ email })) ||
//         (await this.DoctorModel.findOne({ email, isDeleted: false }));

//       // Nếu chưa tồn tại thì tạo mới
//       if (!user) {
//         // Kiểm tra trùng số điện thoại nếu có
//         if (phone) {
//           const existingPhone =
//             (await this.UserModel.findOne({ phone, isDeleted: false })) ||
//             (await this.AdminModel.findOne({ phone })) ||
//             (await this.DoctorModel.findOne({ phone, isDeleted: false }));

//           if (existingPhone) {
//             throw new UnauthorizedException('Số điện thoại đã được sử dụng');
//           }
//         }

//         user = await this.UserModel.create({
//           email,
//           password: '', // không cần password với Google login
//           name,
//           phone,
//           avatarURL,
//           address: 'Chưa có địa chỉ',
//         });
//       }

//       // Tạo access token cho người dùng
//       const tokens = await this.generateUserTokens(
//         user._id,
//         user.email,
//         user.name,
//         user.phone,
//         user.address,
//         user.role,
//       );

//       return {
//         accessToken: tokens.accessToken,
//         message: 'Đăng nhập thành công',
//       };
//     } catch (error) {
//       console.error(error);
//       throw new InternalServerErrorException(error.message || 'Đăng nhập thất bại');
//     }
//   }


//   async login(LoginData: loginDto) {
//     try {
//       const { email, password } = LoginData;
//       let user =
//         (await this.UserModel.findOne({ email, isDeleted: false })) ||
//         (await this.AdminModel.findOne({ email })) ||
//         (await this.DoctorModel.findOne({ email, isDeleted: false }));

//       if (!user) {
//         throw new UnauthorizedException('Không tìm thấy người dùng');
//       }

//       const passwordMatches = await bcrypt.compare(password, user.password);
//       if (!passwordMatches) {
//         throw new UnauthorizedException('Mật khẩu không chính xác');
//       }

//       const tokens = await this.generateUserTokens(
//         user._id,
//         user.email,
//         user.name,
//         user.phone,
//         user.address,
//         user.role,
//       );

//       const cacheKey = `user_${user._id}`;
//       await this.cacheService.setCache(
//         cacheKey,
//         {
//           userId: user._id,
//           name: user.name,
//           email: user.email,
//         },
//         3600 * 1000,
//       );

//       const userCache = await this.cacheService.getCache(cacheKey);
//       if (userCache) {
//         console.log('user cache', userCache);
//       }

//       return {
//         accessToken: tokens.accessToken,
//         message: 'Đăng nhập thành công',
//       };
//     } catch (error) {
//       if (error instanceof UnauthorizedException) {
//         throw error;
//       }
//       throw new InternalServerErrorException('Đã xảy ra lỗi khi đăng nhập');
//     }
//   }

//   async generateUserTokens(userId, email, name, phone, address, role) {
//     try {
//       const accessToken = this.jwtService.sign({
//         userId,
//         email,
//         name,
//         phone,
//         address,
//         role,
//       });
//       return {
//         accessToken,
//       };
//     } catch (error) {
//       throw new InternalServerErrorException('Không thể tạo token truy cập');
//     }
//   }

//   async generateGoogleTokens(email: string) {
//     try {
//       // Validate email format
//       if (!email || !email.includes('@')) {
//         throw new BadRequestException('Email không hợp lệ');
//       }

//       const user = await this.findUserByEmail(email);
//       if (!user) {
//         throw new UnauthorizedException('Email không tồn tại trong hệ thống');
//       }

//       // Ensure all required fields exist
//       const payload = {
//         userId: user._id?.toString() || '',
//         email: user.email || '',
//         name: user.name || '',
//         phone: user.phone || '',
//         address: user.address || '',
//         role: user.role || 'User', // Default role nếu không có
//       };

//       // Log payload for debugging
//       console.log('JWT Payload:', payload);

//       const accessToken = this.jwtService.sign(payload, {
//         expiresIn: '24h', // Thêm thời gian hết hạn
//       });

//       // Validate token được tạo
//       if (!accessToken || typeof accessToken !== 'string') {
//         throw new InternalServerErrorException('Không thể tạo token hợp lệ');
//       }

//       console.log('Generated token:', accessToken);

//       return {
//         accessToken
//       };
//     } catch (error) {
//       console.error('Generate token error:', error);
//       if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new InternalServerErrorException('Không thể tạo token truy cập', {
//         cause: error,
//       });
//     }
//   }

//   generateOTP(): string {
//     return Math.floor(100000 + Math.random() * 900000).toString();
//   }

//   // Gửi email trực tiếp trong AuthService
//   async sendOTPEmail(to: string, otp: string): Promise<void> {
//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: 'hellodoc2000@gmail.com',
//         pass: 'upqr lzkh dtft rgfv', // phải là app password
//       },
//     });

//     const mailOptions = {
//       from: '"OTP System" <hellodoc2000@gmail.com>',
//       to,
//       subject: 'Mã OTP xác thực',
//       html: `<p>Mã OTP của bạn là: <b>${otp}</b>. Mã có hiệu lực trong 5 phút.</p>`,
//     };

//     await transporter.sendMail(mailOptions);
//   }

//   async requestOtpSignup(email: string): Promise<string> {
//     const user = await this.findUserByEmail(email);

//     if (user) {
//       throw new UnauthorizedException('Email đã tồn tại trong hệ thống');
//     }

//     const otp = this.generateOTP();

//     const cacheKey = `otp:${email}`;
//     console.log(`Setting cache for key: ${cacheKey}`);
//     await this.cacheService.setCache(cacheKey, otp, 300 * 1000);

//     // Gửi email
//     await this.sendOTPEmail(email, otp);
//     return otp;
//   }

//   // Đăng nhập (hoặc yêu cầu OTP)
//   async requestOTP(email: string): Promise<string> {
//     const user = await this.findUserByEmail(email);

//     if (!user) {
//       throw new UnauthorizedException('Email không tồn tại trong hệ thống');
//     }

//     const otp = this.generateOTP();

//     const cacheKey = `otp:${email}`;
//     console.log(`Setting cache for key: ${cacheKey}`);
//     await this.cacheService.setCache(cacheKey, otp, 300 * 1000);

//     // Gửi email
//     await this.sendOTPEmail(email, otp);
//     return otp;
//   }

//   // Xác minh OTP
//   async verifyOTP(email: string, inputOtp: string): Promise<boolean> {
//     const cacheKey = `otp:${email}`;
//     console.log(`Trying to get OTP from cache with key: ${cacheKey}`);

//     const cachedOtp = await this.cacheService.getCache(cacheKey);
//     if (!cachedOtp) {
//       console.log('OTP not found or expired in cache.');
//       return false;
//     }

//     console.log('Cache HIT - Comparing OTPs...');
//     const isValid = cachedOtp === inputOtp;

//     if (isValid) {
//       await this.cacheService.deleteCache(cacheKey); // Xoá cache sau khi xác minh thành công
//       console.log('OTP verified successfully. Cache cleared.');
//     } else {
//       console.log('OTP does not match.');
//     }

//     return isValid;
//   }

//   async resetPassword(email: string, newPassword: string): Promise<any> {
//     const hashedPassword = await bcrypt.hash(newPassword, 10);

//     // Tìm và cập nhật trong UserModel
//     const user = await this.UserModel.findOne({ email });
//     if (user) {
//       await this.UserModel.updateOne({ email }, { password: hashedPassword });
//       return { message: 'Đặt lại mật khẩu thành công (user)' };
//     }

//     // Tìm và cập nhật trong AdminModel
//     const admin = await this.AdminModel.findOne({ email });
//     if (admin) {
//       await this.AdminModel.updateOne({ email }, { password: hashedPassword });
//       return { message: 'Đặt lại mật khẩu thành công (admin)' };
//     }

//     // Tìm và cập nhật trong DoctorModel
//     const doctor = await this.DoctorModel.findOne({ email });
//     if (doctor) {
//       await this.DoctorModel.updateOne({ email }, { password: hashedPassword });
//       return { message: 'Đặt lại mật khẩu thành công (doctor)' };
//     }

//     // Không tìm thấy ở bất kỳ model nào
//     throw new NotFoundException('Người dùng không tồn tại');
//   }

//   private async findUserByEmail(email: string): Promise<any> {
//     return (
//       (await this.UserModel.findOne({ email })) ||
//       (await this.AdminModel.findOne({ email })) ||
//       (await this.DoctorModel.findOne({ email }))
//     );
//   }
// }
