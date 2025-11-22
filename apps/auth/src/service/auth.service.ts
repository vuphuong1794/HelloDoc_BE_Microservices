import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SignupDto } from '../dto/signup.dto';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import { loginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from 'libs/cache.service';
import { LoginGoogleDto } from '../dto/loginGoogle.dto';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UserSchema } from 'apps/users/src/core/schema/user.schema';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  constructor(
    @Inject('USERS_CLIENT') private usersClient: ClientProxy,
    private jwtService: JwtService,
    private cacheService: CacheService,
    private configService: ConfigService,
  ) { }
  async signup(signUpData: SignupDto) {
    const { email, password, name, phone } = signUpData;
    const users = await firstValueFrom(this.usersClient.send('user.getallusers', {}));
    const existingUser = Array.isArray(users) ? users.find((u) => u.email === email && u.isDeleted === false) : null;
    if (existingUser) {
      throw new Error('Email đã được sử dụng');
    }
    const existingPhone = Array.isArray(users) ? users.find((u) => u.phone === phone && u.isDeleted === false) : null;
    if (existingPhone) {
      throw new Error('Số điện thoại đã được sử dụng');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const data = {
      email,
      password: hashedPassword,
      name,
      phone,
      avatarURL: 'https://imgs.search.brave.com/mDztPWayQWWrIPAy2Hm_FNfDjDVgayj73RTnUIZ15L0/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly90NC5m/dGNkbi5uZXQvanBn/LzAyLzE1Lzg0LzQz/LzM2MF9GXzIxNTg0/NDMyNV90dFg5WWlJ/SXllYVI3TmU2RWFM/TGpNQW15NEd2UEM2/OS5qcGc',
      address: 'Chưa có địa chỉ',

    }
    return await firstValueFrom(this.usersClient.send('user.signup', data));
  }

  async login(loginData: loginDto) {
    try {
      const { email, password } = loginData;

      //console.log('🔍 Step 1: Lấy danh sách users...');
      const response = await firstValueFrom(
        this.usersClient.send('user.getallusers', {})
      );
      //console.log('✅ Step 1: Nhận được danh sách users' + response.length);

      // response là { users: [], doctors: [] }
      const users = response || [];
      //console.log(`✅ Step 2: Nhận được ${users.length} users`);

      const user = users.find((u) => u.email === email && u.isDeleted === false);

      //console.log("USERRR", user);
      if (!user) {
        throw new UnauthorizedException('Email không chính xác' + user);
      }
      //console.log('✅ Step 3: Tìm thấy user');

      //console.log('🔍 Step 4: So sánh password...');
      //console.log('User password:', user.password);
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (!isPasswordMatch) {
        throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
      }
      //console.log('✅ Step 5: Password đúng');

      //console.log('🔍 Step 6: Generating tokens...');

      //console.log('USER NAME', user.name);
      const tokens = await this.generateUserTokens(
        user._id,
        user.email,
        user.name,
        user.phone,
        user.address,
        user.role,
      );
      //console.log('✅ Step 7: Tokens generated');

      //console.log('🔍 Step 8: Caching user...');
      const cacheKey = `user_${user._id}`;
      await this.cacheService.setCache(
        cacheKey,
        {
          userId: user._id,
          name: user.name,
          email: user.email,
        },
        3600 * 1000,
      );
      //console.log('✅ Step 9: User cached');

      return {
        accessToken: tokens.accessToken,
        message: 'Đăng nhập thành công',
      };

    } catch (error) {
      console.error('❌ Login error:', error.message);
      console.error('Stack:', error.stack);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Đã xảy ra lỗi khi đăng nhập: ${error.message}`
      );
    }
  }

  async generateUserTokens(userId, email, name, phone, address, role) {
    try {
      const accessToken = this.jwtService.sign({
        userId,
        email,
        name,
        phone,
        address,
        role,
      });
      return {
        accessToken,
      };
    } catch (error) {
      throw new InternalServerErrorException('Không thể tạo token truy cập');
    }
  }

  async loginGoogle(loginData: LoginGoogleDto) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: loginData.idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      })

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Không thể xác thực thông tin Google');
      }

      const email = payload.email;
      const name = payload.name || 'Người dùng Google';
      const avatarURL = payload.picture || 'default_avatar_url';
      const phone = loginData.phone?.trim() || '';

      let user = await firstValueFrom(this.usersClient.send('user.getallusers', {}));
      user = Array.isArray(user) ? user.find((u) => u.email === email && u.isDeleted === false) : null;
      if (!user) {
        if (phone) {
          const existingPhone = Array.isArray(user) ? user.find((u) => u.phone === phone && u.isDeleted === false) : null;
          if (existingPhone) {
            throw new Error('Số điện thoại đã được sử dụng');
          }
        }

        const data = {
          email,
          password: '',
          name,
          phone,
          avatarURL,
          address: 'Chưa có địa chi',
        };
        user = await firstValueFrom(this.usersClient.send('user.signup', data));
      }
      const tokens = await this.generateUserTokens(
        user._id,
        user.email,
        user.name,
        user.phone,
        user.address,
        user.role
      )

      return {
        accessToken: tokens.accessToken,
        message: 'Đăng nhập thành công',
      };

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(error.message || 'Đăng nhập thất bại');
    }
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Gửi email trực tiếp trong AuthService
  async sendOTPEmail(to: string, otp: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'hellodoc2000@gmail.com',
        pass: 'upqr lzkh dtft rgfv', // phải là app password
      },
    });

    const mailOptions = {
      from: '"OTP System" <hellodoc2000@gmail.com>',
      to,
      subject: 'Mã OTP xác thực',
      html: `<p>Mã OTP của bạn là: <b>${otp}</b>. Mã có hiệu lực trong 5 phút.</p>`,
    };

    await transporter.sendMail(mailOptions);
  }


  async requestOtpSignup(email: string): Promise<string> {
    const user = await firstValueFrom(this.usersClient.send('user.getallusers', {}));
    const existingUser = Array.isArray(user) ? user.find((u) => u.email === email && u.isDeleted === false) : null;

    if (existingUser) {
      throw new UnauthorizedException('Email đã tồn tại trong hệ thống');
    }

    const otp = this.generateOTP();

    const cacheKey = `otp:${email}`;
    console.log(`Setting cache for key: ${cacheKey}`);
    await this.cacheService.setCache(cacheKey, otp, 300 * 1000);

    // Gửi email
    await this.sendOTPEmail(email, otp);
    return otp;
  }

  async requestOtp(email: string) {
    const user = await firstValueFrom(this.usersClient.send('user.getallusers', {}));
    const existingUser = Array.isArray(user) ? user.find((u) => u.email === email && u.isDeleted === false) : null;
    if (!existingUser) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const otp = this.generateOTP();

    const cacheKey = `otp:${email}`;
    console.log(`Setting cache for key: ${cacheKey}`);
    await this.cacheService.setCache(cacheKey, otp, 300 * 1000);

    // Gửi email
    await this.sendOTPEmail(email, otp);
    return otp;

  }

  // Xác minh OTP
  async verifyOTP(email: string, inputOtp: string): Promise<boolean> {
    const cacheKey = `otp:${email}`;
    console.log(`Trying to get OTP from cache with key: ${cacheKey}`);

    const cachedOtp = await this.cacheService.getCache(cacheKey);
    if (!cachedOtp) {
      console.log('OTP not found or expired in cache.');
      return false;
    }

    console.log('Cache HIT - Comparing OTPs...');
    const isValid = cachedOtp === inputOtp;

    if (isValid) {
      await this.cacheService.deleteCache(cacheKey); // Xoá cache sau khi xác minh thành công
      console.log('OTP verified successfully. Cache cleared.');
    } else {
      console.log('OTP does not match.');
    }

    return isValid;
  }

  async resetPassword(email: string, newPassword: string): Promise<any> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // // Tìm và cập nhật trong UserModel
    // const user = await this.UserModel.findOne({ email });
    // if (user) {
    //   await this.UserModel.updateOne({ email }, { password: hashedPassword });
    //   return { message: 'Đặt lại mật khẩu thành công (user)' };
    // }

    // // Tìm và cập nhật trong AdminModel
    // const admin = await this.AdminModel.findOne({ email });
    // if (admin) {
    //   await this.AdminModel.updateOne({ email }, { password: hashedPassword });
    //   return { message: 'Đặt lại mật khẩu thành công (admin)' };
    // }

    // // Tìm và cập nhật trong DoctorModel
    // const doctor = await this.DoctorModel.findOne({ email });
    // if (doctor) {
    //   await this.DoctorModel.updateOne({ email }, { password: hashedPassword });
    //   return { message: 'Đặt lại mật khẩu thành công (doctor)' };
    // }

    const user = await firstValueFrom(this.usersClient.send('user.getallusers', {}));
    const existingUser = Array.isArray(user) ? user.find((u) => u.email === email && u.isDeleted === false) : null;
    if (existingUser) {
      await this.usersClient.send('user.updatePassword', { email, password: hashedPassword });
      return { message: 'Đặt lại mật khẩu thành công' };
    }

    // Không tìm thấy ở bất kỳ model nào
    throw new NotFoundException('Người dùng không tồn tại');
  }

  async generateGoogleTokens(email: string) {
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        throw new BadRequestException('Email không hợp lệ');
      }

      const user = await this.usersClient.send('user.getallusers', {});

      const existingUser = Array.isArray(user) ? user.find((u) => u.email === email && u.isDeleted === false) : null;
      if (!existingUser) {
        throw new UnauthorizedException('Email không tồn tại trong hệ thống');
      }

      //Ensure all required fields exist
      const payload = {
        userId: existingUser._id?.toString() || '',
        email: existingUser.email || '',
        name: existingUser.name || '',
        phone: existingUser.phone || '',
        address: existingUser.address || '',
        role: existingUser.role || 'User', // Default role nếu không có
      };


      // Log payload for debugging
      console.log('JWT Payload:', payload);

      const accessToken = this.jwtService.sign(payload, {
        expiresIn: '24h', // Thêm thời gian hết hạn
      });

      // Validate token được tạo
      if (!accessToken || typeof accessToken !== 'string') {
        throw new InternalServerErrorException('Không thể tạo token hợp lệ');
      }

      console.log('Generated token:', accessToken);

      return {
        accessToken
      };
    } catch (error) {
      console.error('Generate token error:', error);
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Không thể tạo token truy cập', {
        cause: error,
      });
    }
  }
}
