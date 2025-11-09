import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { SignupDto } from "apps/auth/src/dto/signup.dto";
import { loginDto } from "../core/dto/login.dto";
import { LoginGoogleDto } from "../core/dto/loginGoogle.dto";
import { AuthService } from "../services/auth.service";

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('signup')
    async signUp(@Body() signUpData: SignupDto) {
        return this.authService.signUp(signUpData);
    }

    // @Post('signup-admin')
    // async signUpAdmin(@Body() signUpData: SignupDto) {
    //     return this.authService.signUpAdmin(signUpData);
    // }

    @Post('login')
    async login(@Body() credentials: loginDto) {
        return this.authService.login(credentials);
    }

    @Post('login-google')
    async loginGoogle(@Body() loginGoogleData: LoginGoogleDto) {
        return this.authService.loginGoogle(loginGoogleData);
    }

    // Gửi OTP qua email
    @Post('request-otp')
    async requestOtp(@Body('email') email: string) {
        if (!email) {
            throw new BadRequestException('Email không được để trống');
        }

        const otp = await this.authService.requestOTP(email);

        // Với mục đích demo, trả về otp (sản phẩm thật thì không trả)
        return { message: 'OTP đã được gửi đến email', otp };
    }

    @Post('request-otp-signup')
    async requestOtpForSignUp(@Body('email') email: string) {
        if (!email) {
            throw new BadRequestException('Email không được để trống');
        }

        const otp = await this.authService.requestOtpSignup(email);

        // Với mục đích demo, trả về otp (sản phẩm thật thì không trả)
        return { message: 'OTP đã được gửi đến email', otp };
    }

    // Xác minh OTP
    @Post('verify-otp')
    async verifyOtp(
        @Body('email') email: string,
        @Body('otp') otp: string,
    ) {
        if (!email || !otp) {
            throw new BadRequestException('Email và OTP là bắt buộc');
        }

        const isValid = await this.authService.verifyOTP(email, otp);

        if (!isValid) {
            throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
        }

        return { message: 'Xác minh OTP thành công' };
    }

    @Post('reset-password')
    async resetPassword(
        @Body('email') email: string,
        @Body('newPassword') newPassword: string
    ) {
        // Cập nhật mật khẩu mới (hash trước khi lưu)
        await this.authService.resetPassword(email, newPassword);

        return { message: 'Mật khẩu đã được cập nhật thành công' };
    }

    @Post('generate-token')
    async generateTokenGoogle(@Body() { email }: { email: string, }) {
        return this.authService.generateGoogleTokens(email);

    }
}