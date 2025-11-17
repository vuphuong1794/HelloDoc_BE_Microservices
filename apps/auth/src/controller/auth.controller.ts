import { BadRequestException, Body, Controller, Get } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SignupDto } from '../dto/signup.dto';
import { LoginGoogleDto } from '../dto/loginGoogle.dto';
import { loginDto } from '../dto/login.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @MessagePattern('auth.signup')
  async signup(@Payload() signUpData: SignupDto) {
    return this.authService.signup(signUpData);
  }

  // @MessagePattern('auth.signup-admin')
  // async signupAdmin(@Body() signUpData: SignupDto) {
  //   return this.authService.signupAdmin(signUpData);
  // }

  @MessagePattern('auth.login')
  async login(@Payload() loginData: loginDto) {
    return this.authService.login(loginData);
  }

  @MessagePattern('auth.login-google')
  async loginAdmin(@Body() loginData: LoginGoogleDto) {
    return this.authService.loginGoogle(loginData);
  }

  @MessagePattern('auth.request-otp')
  async requestOtp(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Emil không được để trống')
    }

    const otp = await this.authService.requestOtp(email);
    return { message: 'OTP đã được gửi tới email', otp };
  }

  @MessagePattern('auth.request-otp-signup')
  async requestOtpSignup(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email không được để trống');
    }

    const otp = await this.authService.requestOtpSignup(email);
    return { message: 'OTP đã được gửi đến email', otp };
  }

  @MessagePattern('auth.verify-otp')
  async verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    if (!email || !otp) {
      throw new BadRequestException('Email và OTP là bắt buộc');
    }

    const isValid = await this.authService.verifyOTP(email, otp);

    if (!isValid) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    return { message: 'Xác minh OTP thành công' };
  }

  @MessagePattern('auth.reset-password')
  async resetPassword(@Body('email') email: string, @Body('newPassword') password: string) {
    // Cập nhật mật khẩu mới (hash trước khi lưu)
    await this.authService.resetPassword(email, password);

    return { message: 'Mật khẩu đã được cập nhật thành công' };
  }

  @MessagePattern('auth.generate-token')
  async generateToken(@Body('email') email: string) {
    return this.authService.generateGoogleTokens(email);
  }
}
